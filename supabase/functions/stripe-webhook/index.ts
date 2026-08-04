import Stripe from 'stripe';
import { createServiceClient } from '../_shared/supabase.ts';
import { errorMessage, getEnv } from '../_shared/security.js';
import { sendOrderConfirmationEmail } from '../_shared/commerce.ts';

const stripeSecret = String(getEnv('STRIPE_SECRET_KEY') || '').trim();
const webhookSecret = String(getEnv('STRIPE_WEBHOOK_SECRET') || '').trim();
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function stripeId(value: string | { id?: string } | null | undefined) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id || null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!stripe || !webhookSecret) return new Response('Webhook not configured', { status: 503 });

  const signature = request.headers.get('stripe-signature') || '';
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error('Stripe webhook signature rejected', errorMessage(error));
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: claimed, error: claimError } = await supabase.rpc('claim_stripe_event', {
    p_event_id: event.id,
    p_event_type: event.type,
  });
  if (claimError) {
    console.error('Stripe event claim failed', claimError.message);
    return new Response('Temporary error', { status: 500 });
  }
  if (!claimed) return Response.json({ received: true, duplicate: true });

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') await markOrderPaid(supabase, session);
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await updatePendingOrder(supabase, session, 'failed');
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      await updatePendingOrder(supabase, session, 'expired', true);
    } else if (event.type === 'charge.refunded') {
      await applyRefund(supabase, event.data.object as Stripe.Charge);
    }

    await supabase.from('stripe_webhook_events').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      last_error: null,
    }).eq('event_id', event.id);
    return Response.json({ received: true });
  } catch (error) {
    const message = errorMessage(error).slice(0, 500);
    console.error(`Stripe event ${event.id} failed`, message);
    await supabase.from('stripe_webhook_events').update({
      status: 'failed',
      last_error: message,
    }).eq('event_id', event.id);
    return new Response('Temporary processing error', { status: 500 });
  }
});

async function findOrderForSession(supabase: ReturnType<typeof createServiceClient>, session: Stripe.Checkout.Session) {
  const orderId = String(session.metadata?.order_id || '').trim();
  if (!orderId) throw new Error('Stripe session has no order_id metadata');
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, email_sent_at, total_cents, gallery_id, albums(download_expiry_days)')
    .eq('id', orderId)
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  if (error || !order) throw error || new Error('Order not found for Stripe session');
  return order;
}

async function markOrderPaid(supabase: ReturnType<typeof createServiceClient>, session: Stripe.Checkout.Session) {
  const order = await findOrderForSession(supabase, session);
  if (order.status === 'refunded') return;
  if (order.status === 'paid') {
    if (!order.email_sent_at) {
      try {
        await sendOrderConfirmationEmail(supabase, order.id, 'email');
      } catch (emailError) {
        console.error('Order confirmation email failed', errorMessage(emailError));
      }
    }
    return;
  }
  const album = Array.isArray(order.albums) ? order.albums[0] : order.albums;
  const expiryDays = Math.min(90, Math.max(1, Number(album?.download_expiry_days || 7)));
  const paidAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
  const customerEmail = session.customer_details?.email || session.customer_email || null;
  const paymentIntentId = stripeId(session.payment_intent);

  const { error } = await supabase.from('orders').update({
    status: 'paid',
    customer_email: customerEmail,
    stripe_payment_intent_id: paymentIntentId,
    paid_at: paidAt,
    expires_at: expiresAt,
  }).eq('id', order.id).in('status', ['pending', 'paid']);
  if (error) throw error;
  await supabase.from('order_access_tokens').update({ expires_at: expiresAt }).eq('order_id', order.id).is(
    'revoked_at',
    null,
  );

  if (!order.email_sent_at && customerEmail) {
    try {
      await sendOrderConfirmationEmail(supabase, order.id, 'email');
    } catch (emailError) {
      console.error('Order confirmation email failed', errorMessage(emailError));
    }
  }
}

async function updatePendingOrder(
  supabase: ReturnType<typeof createServiceClient>,
  session: Stripe.Checkout.Session,
  status: 'failed' | 'expired',
  revokeTokens = false,
) {
  const order = await findOrderForSession(supabase, session);
  if (order.status !== 'pending') return;
  const now = new Date().toISOString();
  const { error } = await supabase.from('orders').update({ status }).eq('id', order.id).eq('status', 'pending');
  if (error) throw error;
  if (revokeTokens) {
    await supabase.from('order_access_tokens').update({ revoked_at: now }).eq('order_id', order.id).is(
      'revoked_at',
      null,
    );
  }
}

async function applyRefund(supabase: ReturnType<typeof createServiceClient>, charge: Stripe.Charge) {
  const paymentIntentId = stripeId(charge.payment_intent);
  if (!paymentIntentId) return;
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, total_cents, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return;
  const refundedCents = Math.min(Number(order.total_cents), Number(charge.amount_refunded || 0));
  const fullyRefunded = refundedCents >= Number(order.total_cents);
  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from('orders').update({
    refunded_cents: refundedCents,
    stripe_charge_id: charge.id,
    status: fullyRefunded ? 'refunded' : 'partially_refunded',
    downloads_invalidated_at: fullyRefunded ? now : null,
  }).eq('id', order.id);
  if (updateError) throw updateError;
  if (fullyRefunded) {
    await supabase.from('order_access_tokens').update({ revoked_at: now }).eq('order_id', order.id).is(
      'revoked_at',
      null,
    );
  }
}
