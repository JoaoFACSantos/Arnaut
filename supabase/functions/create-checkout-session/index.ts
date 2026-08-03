import Stripe from 'npm:stripe@^22';
import { createServiceClient } from '../_shared/supabase.ts';
import {
  corsHeaders,
  getClientIp,
  getEnv,
  hashSessionToken,
  hmacSha256Hex,
  json,
  randomToken,
  readJson,
} from '../_shared/security.js';
import { centsForStripe, normalizePhotoIds } from '../_shared/commerce.js';
import { getSiteUrl, hashOrderAccessToken, validateGallerySession } from '../_shared/commerce.ts';

const CHECKOUT_RATE_WINDOW_MINUTES = 10;
const CHECKOUT_RATE_LIMIT = 5;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const stripeSecret = String(getEnv('STRIPE_SECRET_KEY') || '').trim();
  if (!stripeSecret) return json({ error: 'Os pagamentos ainda não estão configurados.' }, 503);

  const supabase = createServiceClient();
  const body = await readJson(request);
  const publicId = String(body.publicId || '').trim();
  const galleryToken = String(body.token || '').trim();
  const suppliedIds = Array.isArray(body.photoIds) ? body.photoIds : [];
  const photoIds = normalizePhotoIds(suppliedIds);

  if (!photoIds.length || photoIds.length !== suppliedIds.length) {
    return json({ error: 'Seleção de fotografias inválida.' }, 400);
  }

  const galleryAccess = await validateGallerySession(supabase, publicId, galleryToken);
  if (!galleryAccess) return json({ error: 'Sessão da galeria inválida ou expirada.' }, 401);
  const { session, album } = galleryAccess;

  if (!album.sales_enabled || !album.watermark_enabled) {
    return json({ error: 'A venda de fotografias não está disponível nesta galeria.' }, 403);
  }

  centsForStripe(album.photo_price_cents);
  const since = new Date(Date.now() - CHECKOUT_RATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('commerce_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('album_session_id', session.id)
    .eq('action', 'checkout')
    .gte('created_at', since);
  if ((count || 0) >= CHECKOUT_RATE_LIMIT) {
    return json({ error: 'Foram iniciadas demasiadas tentativas de pagamento. Tente novamente dentro de alguns minutos.' }, 429);
  }

  const ipHash = await hashSessionToken(getClientIp(request), getEnv('SESSION_TOKEN_PEPPER'));
  const { data: attempt } = await supabase
    .from('commerce_attempts')
    .insert({ album_session_id: session.id, ip_hash: ipHash, action: 'checkout', success: false })
    .select('id')
    .single();

  const { data: selectedPhotos, error: selectedError } = await supabase
    .from('album_photos')
    .select('id')
    .eq('album_id', album.id)
    .in('id', photoIds)
    .eq('processing_status', 'ready')
    .not('watermarked_path', 'is', null);
  if (selectedError || (selectedPhotos || []).length !== photoIds.length) {
    return json({ error: 'Uma ou mais fotografias não pertencem a esta galeria ou ainda não estão disponíveis.' }, 400);
  }

  const sortedIds = [...photoIds].sort();
  const fingerprint = await hmacSha256Hex(
    `selection:${session.id}:${sortedIds.join(',')}`,
    getEnv('ORDER_TOKEN_PEPPER'),
  );
  const receiptToken = randomToken(36);
  const receiptTokenHash = await hashOrderAccessToken(receiptToken);
  const initialAccessExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: createdRows, error: createError } = await supabase.rpc('create_pending_photo_order', {
    p_gallery_id: album.id,
    p_album_session_id: session.id,
    p_photo_ids: sortedIds,
    p_selection_fingerprint: fingerprint,
    p_access_token_hash: receiptTokenHash,
    p_access_expires_at: initialAccessExpiry,
  });
  if (createError || !createdRows?.[0]) {
    console.error('create pending order error', createError?.message || createError);
    return json({ error: 'Não foi possível preparar a encomenda.' }, 500);
  }
  const order = createdRows[0];
  const checkoutUnitPriceCents = centsForStripe(Number(order.total_cents) / photoIds.length);

  const siteUrl = getSiteUrl();
  const successUrl = `${siteUrl}/galeria.html?order=${encodeURIComponent(order.order_public_id)}&receipt_token=${encodeURIComponent(receiptToken)}&checkout=success`;
  const cancelUrl = `${siteUrl}/galeria.html?id=${encodeURIComponent(publicId)}&checkout=cancelled`;
  const stripe = new Stripe(stripeSecret);

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'pt',
      client_reference_id: order.order_public_id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_creation: 'always',
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      line_items: [{
        quantity: photoIds.length,
        price_data: {
          currency: String(order.currency || album.currency).toLowerCase(),
          unit_amount: checkoutUnitPriceCents,
          product_data: {
            name: `Fotografia digital · ${album.title}`,
            description: 'Ficheiro digital sem marca de água, disponível após confirmação do pagamento.',
          },
        },
      }],
      metadata: {
        order_id: order.order_id,
        order_public_id: order.order_public_id,
        gallery_id: album.id,
      },
      payment_intent_data: {
        metadata: {
          order_id: order.order_id,
          order_public_id: order.order_public_id,
        },
      },
    }, { idempotencyKey: order.order_id });

    if (!checkout.url) throw new Error('Stripe Checkout URL unavailable');
    const { error: updateError } = await supabase
      .from('orders')
      .update({ stripe_checkout_session_id: checkout.id })
      .eq('id', order.order_id)
      .eq('status', 'pending');
    if (updateError) throw updateError;
    if (attempt?.id) await supabase.from('commerce_attempts').update({ success: true }).eq('id', attempt.id);
    return json({ url: checkout.url });
  } catch (error) {
    console.error('Stripe Checkout creation error', error?.message || error);
    await supabase.from('orders').update({ status: 'failed' }).eq('id', order.order_id).eq('status', 'pending');
    return json({ error: 'Não foi possível iniciar o pagamento. Tente novamente.' }, 502);
  }
});
