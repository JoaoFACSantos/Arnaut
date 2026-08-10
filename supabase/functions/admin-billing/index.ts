import Stripe from 'stripe';
import { buildBillingSummary } from '../_shared/billing.js';
import { createServiceClient, requireAdmin } from '../_shared/supabase.ts';
import { corsHeaders, errorMessage, getEnv, json, readJson, sanitizeText } from '../_shared/security.js';

const ORDER_STATUSES = new Set(['pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded']);
const stripeSecret = String(getEnv('STRIPE_SECRET_KEY') || '').trim();
const stripeWebhookSecret = String(getEnv('STRIPE_WEBHOOK_SECRET') || '').trim();
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

type ServiceClient = ReturnType<typeof createServiceClient>;
type AdminUser = { id: string; email?: string | null };
type OrderRow = {
  id: string;
  order_number: string;
  customer_email: string | null;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  refunded_cents: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  expires_at?: string | null;
  stripe_payment_intent_id?: string | null;
  albums?: { id?: string; title?: string } | Array<{ id?: string; title?: string }> | null;
  order_items?: Array<Record<string, unknown>> | null;
  [key: string]: unknown;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const supabase = createServiceClient();
  const admin = await requireAdmin(request, supabase);
  if (!admin.ok) return admin.response;
  const body = await readJson(request);
  const action = sanitizeText(body.action, 40);
  try {
    if (action === 'dashboard') return dashboard(supabase, admin.user, body);
    if (action === 'list') return listBillingRecords(supabase, body.filters || {}, body.page, body.pageSize);
    if (action === 'export') return exportBillingRecords(supabase, body.filters || {});
    if (action === 'detail') return billingDetail(supabase, sanitizeText(body.orderId, 80));
    if (action === 'save-profile') return saveBillingProfile(supabase, admin.user, body.profile || {});
    if (action === 'refund') return requestRefund(supabase, sanitizeText(body.orderId, 80));
    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) {
    console.error('admin-billing error', errorMessage(error));
    return json({ error: 'Não foi possível concluir a operação de faturação.' }, 500);
  }
});

function stripeState(currency = 'EUR') {
  const configured = Boolean(stripeSecret && stripeWebhookSecret);
  const mode = !stripeSecret ? 'unconfigured' : stripeSecret.startsWith('sk_test_') ? 'test' : 'live';
  return { configured, mode, currency: String(currency || 'EUR').toUpperCase() };
}

function albumFor(order: OrderRow) {
  return Array.isArray(order.albums) ? order.albums[0] || null : order.albums || null;
}

function safeOrder(order: OrderRow) {
  return {
    id: order.id,
    reference: order.order_number,
    customerEmail: order.customer_email,
    currency: order.currency,
    subtotalCents: Number(order.subtotal_cents || 0),
    discountCents: Number(order.discount_cents || 0),
    totalCents: Number(order.total_cents || 0),
    refundedCents: Number(order.refunded_cents || 0),
    status: order.status,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    album: albumFor(order),
    itemCount: Array.isArray(order.order_items) ? order.order_items.length : 0,
  };
}

async function dashboard(supabase: ServiceClient, user: AdminUser, body: Record<string, unknown>) {
  const months = Math.min(12, Math.max(1, Number(body.months || 6)));
  const queryStart = new Date();
  queryStart.setUTCMonth(queryStart.getUTCMonth() - 13, 1);
  queryStart.setUTCHours(0, 0, 0, 0);
  const [ordersResult, recentResult, pendingResult, profileResult, preferencesResult] = await Promise.all([
    supabase.from('orders')
      .select('id, order_number, customer_email, currency, subtotal_cents, discount_cents, total_cents, refunded_cents, status, created_at, paid_at, albums(id, title), order_items(id)')
      .gte('created_at', queryStart.toISOString()).order('created_at', { ascending: false }).limit(5000),
    supabase.from('orders')
      .select('id, order_number, customer_email, currency, subtotal_cents, discount_cents, total_cents, refunded_cents, status, created_at, paid_at, albums(id, title), order_items(id)')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('orders')
      .select('total_cents').eq('status', 'pending').limit(5000),
    supabase.from('billing_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_preferences').select('default_currency').eq('user_id', user.id).maybeSingle(),
  ]);
  if (ordersResult.error) throw ordersResult.error;
  if (recentResult.error) throw recentResult.error;
  if (pendingResult.error) throw pendingResult.error;
  const orders = (ordersResult.data || []) as unknown as OrderRow[];
  const summary = buildBillingSummary(orders, new Date(), months);
  summary.pendingCents = (pendingResult.data || []).reduce(
    (total, order) => total + Math.max(0, Number(order.total_cents || 0)),
    0,
  );
  summary.pendingCount = pendingResult.data?.length || 0;
  const profileMissing = profileResult.error?.code === '42P01';
  if (profileResult.error && !profileMissing) throw profileResult.error;
  const currency = String(preferencesResult.data?.default_currency || orders[0]?.currency || 'EUR').toUpperCase();
  return json({
    summary,
    recent: ((recentResult.data || []) as unknown as OrderRow[]).map(safeOrder),
    profile: profileMissing ? null : profileResult.data,
    profileSchemaAvailable: !profileMissing,
    stripe: stripeState(currency),
  });
}

function applyBillingFilters(query: any, filters: Record<string, unknown>) {
  const status = sanitizeText(filters.status, 30);
  const search = sanitizeText(filters.search, 160).replace(/[%_,()]/g, '');
  const dateFrom = sanitizeText(filters.dateFrom, 30);
  const dateTo = sanitizeText(filters.dateTo, 30);
  if (status && ORDER_STATUSES.has(status)) query = query.eq('status', status);
  if (search) query = query.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%`);
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
  return query;
}

async function listBillingRecords(supabase: ServiceClient, filters: Record<string, unknown>, pageValue: unknown, pageSizeValue: unknown) {
  const page = Math.max(1, Number(pageValue || 1));
  const pageSize = Math.min(50, Math.max(5, Number(pageSizeValue || 10)));
  const from = (page - 1) * pageSize;
  let query = supabase.from('orders').select(
    'id, order_number, customer_email, currency, subtotal_cents, discount_cents, total_cents, refunded_cents, status, created_at, paid_at, albums(id, title), order_items(id)',
    { count: 'exact' },
  );
  query = applyBillingFilters(query, filters);
  const sort = sanitizeText(filters.sort, 30);
  if (sort === 'oldest') query = query.order('created_at', { ascending: true });
  else if (sort === 'amount-desc') query = query.order('total_cents', { ascending: false });
  else if (sort === 'amount-asc') query = query.order('total_cents', { ascending: true });
  else query = query.order('created_at', { ascending: false });
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return json({ records: ((data || []) as unknown as OrderRow[]).map(safeOrder), count: count || 0, page, pageSize });
}

async function exportBillingRecords(supabase: ServiceClient, filters: Record<string, unknown>) {
  let query = supabase.from('orders').select(
    'id, order_number, customer_email, currency, subtotal_cents, discount_cents, total_cents, refunded_cents, status, created_at, paid_at, albums(id, title), order_items(id)',
  );
  query = applyBillingFilters(query, filters).order('created_at', { ascending: false }).limit(5000);
  const { data, error } = await query;
  if (error) throw error;
  return json({ records: ((data || []) as unknown as OrderRow[]).map(safeOrder) });
}

async function billingDetail(supabase: ServiceClient, orderId: string) {
  if (!orderId) return json({ error: 'Registo inválido.' }, 400);
  const { data, error } = await supabase.from('orders').select(
    'id, order_number, customer_email, currency, subtotal_cents, discount_cents, total_cents, refunded_cents, status, created_at, paid_at, expires_at, stripe_payment_intent_id, albums(id, title), order_items(id, unit_price_cents, album_photos(filename))',
  ).eq('id', orderId).maybeSingle();
  if (error || !data) return json({ error: 'Registo não encontrado.' }, 404);
  const order = data as unknown as OrderRow;
  const items = (order.order_items || []).map((item: any) => {
    const photo = Array.isArray(item.album_photos) ? item.album_photos[0] : item.album_photos;
    return { filename: photo?.filename || 'Fotografia', unitPriceCents: Number(item.unit_price_cents || 0) };
  });
  return json({ record: {
    ...safeOrder(order), expiresAt: order.expires_at || null,
    paymentMethod: order.stripe_payment_intent_id ? 'Stripe Checkout' : null,
    paymentIntentId: order.stripe_payment_intent_id || null, items,
    canRefund: Boolean(stripe && order.stripe_payment_intent_id && ['paid', 'partially_refunded'].includes(order.status)),
  } });
}

function optionalText(value: unknown, maxLength: number) {
  const text = sanitizeText(value, maxLength);
  return text || null;
}

async function saveBillingProfile(supabase: ServiceClient, user: AdminUser, profile: Record<string, unknown>) {
  const billingEmail = optionalText(profile.billingEmail, 180);
  if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) return json({ error: 'Introduza um email de faturação válido.' }, 400);
  const payload = {
    user_id: user.id,
    business_name: optionalText(profile.businessName, 120),
    tax_id: optionalText(profile.taxId, 32),
    billing_email: billingEmail,
    address_line1: optionalText(profile.addressLine1, 180),
    address_line2: optionalText(profile.addressLine2, 180),
    postal_code: optionalText(profile.postalCode, 24),
    city: optionalText(profile.city, 100),
    country: optionalText(profile.country, 80),
  };
  const { data, error } = await supabase.from('billing_profiles').upsert(payload, { onConflict: 'user_id' }).select('*').single();
  if (error) {
    if (error.code === '42P01') return json({ error: 'A migration do perfil fiscal ainda não foi aplicada.' }, 409);
    throw error;
  }
  return json({ profile: data });
}

async function requestRefund(supabase: ServiceClient, orderId: string) {
  if (!stripe) return json({ error: 'A Stripe não está configurada.' }, 409);
  const { data: order, error } = await supabase.from('orders')
    .select('id, total_cents, refunded_cents, status, stripe_payment_intent_id').eq('id', orderId).maybeSingle();
  if (error || !order) return json({ error: 'Pagamento não encontrado.' }, 404);
  if (!['paid', 'partially_refunded'].includes(order.status) || !order.stripe_payment_intent_id) return json({ error: 'Este pagamento não pode ser reembolsado.' }, 409);
  const remainingCents = Math.max(0, Number(order.total_cents) - Number(order.refunded_cents || 0));
  if (!remainingCents) return json({ error: 'Este pagamento já foi totalmente reembolsado.' }, 409);
  const refund = await stripe.refunds.create(
    { payment_intent: order.stripe_payment_intent_id, amount: remainingCents },
    { idempotencyKey: `arnaut-refund-${order.id}-${Number(order.refunded_cents || 0)}` },
  );
  return json({ ok: true, refund: { id: refund.id, status: refund.status, amountCents: refund.amount } });
}
