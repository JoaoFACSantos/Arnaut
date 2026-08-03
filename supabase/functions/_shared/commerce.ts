import { createServiceClient } from './supabase.ts';
import {
  getEnv,
  hashSessionToken,
  randomToken,
} from './security.js';
import { canDownloadOrder } from './commerce.js';

type ServiceClient = ReturnType<typeof createServiceClient>;

export const ORDER_STATUS_POLL_SECONDS = 5;
export const ORDER_DOWNLOAD_URL_SECONDS = 2 * 60;

export async function validateGallerySession(
  supabase: ServiceClient,
  publicId: string,
  token: string,
) {
  if (!publicId || token.length < 20) return null;
  const tokenHash = await hashSessionToken(token, getEnv('SESSION_TOKEN_PEPPER'));
  const { data: session } = await supabase
    .from('album_sessions')
    .select('id, album_id, session_version, expires_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!session) return null;

  const { data: album } = await supabase
    .from('albums')
    .select('id, public_id, title, sales_enabled, photo_price_cents, currency, download_expiry_days, sales_support_email, refund_policy_text, watermark_enabled, downloads_enabled, is_active, is_archived, status, expires_at, session_version')
    .eq('id', session.album_id)
    .eq('public_id', publicId)
    .maybeSingle();

  const albumExpired = album?.expires_at && new Date(album.expires_at).getTime() <= Date.now();
  if (
    !album
    || !album.is_active
    || album.is_archived
    || album.status !== 'active'
    || albumExpired
    || album.session_version !== session.session_version
  ) return null;

  return { session, album };
}

export async function hashOrderAccessToken(token: string) {
  return hashSessionToken(`order:${String(token || '').trim()}`, getEnv('ORDER_TOKEN_PEPPER'));
}

export async function createOrderAccessToken(
  supabase: ServiceClient,
  orderId: string,
  purpose: 'checkout' | 'email' | 'admin-resend',
  expiresAt: string,
) {
  const token = randomToken(36);
  const tokenHash = await hashOrderAccessToken(token);
  const { error } = await supabase.from('order_access_tokens').insert({
    order_id: orderId,
    token_hash: tokenHash,
    purpose,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return token;
}

export async function authenticateOrderAccess(
  supabase: ServiceClient,
  orderPublicId: string,
  token: string,
) {
  if (!orderPublicId || token.length < 24) return null;
  const tokenHash = await hashOrderAccessToken(token);
  const { data: access } = await supabase
    .from('order_access_tokens')
    .select('id, order_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .is('revoked_at', null)
    .maybeSingle();
  if (!access) return null;

  const { data: order } = await supabase
    .from('orders')
    .select('id, public_id, order_number, gallery_id, album_session_id, customer_email, currency, subtotal_cents, discount_cents, total_cents, status, created_at, paid_at, expires_at, downloads_invalidated_at, email_sent_at')
    .eq('id', access.order_id)
    .eq('public_id', orderPublicId)
    .maybeSingle();
  if (!order) return null;
  return { access, order };
}

export function orderDownloadAvailable(order: Record<string, unknown>) {
  return canDownloadOrder(order);
}

export function getSiteUrl() {
  const value = String(getEnv('SITE_URL') || '').trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(value)) throw new Error('SITE_URL is not configured');
  return value;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100);
}

export async function sendOrderConfirmationEmail(
  supabase: ServiceClient,
  orderId: string,
  purpose: 'email' | 'admin-resend' = 'email',
) {
  const apiKey = String(getEnv('RESEND_API_KEY') || '').trim();
  const from = String(getEnv('ORDER_FROM_EMAIL') || '').trim();
  if (!apiKey || !from) return { sent: false, reason: 'email_not_configured' };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, public_id, order_number, customer_email, currency, total_cents, status, paid_at, expires_at, downloads_invalidated_at, albums(title, sales_support_email), order_items(id)')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order || !order.customer_email || !orderDownloadAvailable(order)) {
    return { sent: false, reason: 'order_not_deliverable' };
  }

  const album = Array.isArray(order.albums) ? order.albums[0] : order.albums;
  const itemCount = Array.isArray(order.order_items) ? order.order_items.length : 0;
  const supportEmail = String(album?.sales_support_email || getEnv('SALES_SUPPORT_EMAIL') || '').trim();
  const token = await createOrderAccessToken(supabase, order.id, purpose, order.expires_at);
  const downloadUrl = `${getSiteUrl()}/galeria.html?order=${encodeURIComponent(order.public_id)}&receipt_token=${encodeURIComponent(token)}`;
  const supportBlock = supportEmail
    ? `<p>Apoio: <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></p>`
    : '';
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171713;line-height:1.6;max-width:620px;margin:auto">
      <h1 style="font-family:Georgia,serif;font-weight:400">Pagamento confirmado</h1>
      <p>Recebemos o pagamento da sua encomenda de fotografias digitais.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0">
        <tr><td style="padding:8px 0">Encomenda</td><td style="padding:8px 0;text-align:right"><strong>${escapeHtml(order.order_number)}</strong></td></tr>
        <tr><td style="padding:8px 0">Galeria</td><td style="padding:8px 0;text-align:right">${escapeHtml(album?.title || '')}</td></tr>
        <tr><td style="padding:8px 0">Fotografias</td><td style="padding:8px 0;text-align:right">${itemCount}</td></tr>
        <tr><td style="padding:8px 0">Total</td><td style="padding:8px 0;text-align:right"><strong>${escapeHtml(formatMoney(order.total_cents, order.currency))}</strong></td></tr>
      </table>
      <p><a href="${escapeHtml(downloadUrl)}" style="display:inline-block;padding:14px 22px;background:#9b6546;color:#fff;text-decoration:none;border-radius:10px">Aceder às fotografias</a></p>
      <p>Os downloads ficam disponíveis até ${escapeHtml(new Date(order.expires_at).toLocaleDateString('pt-PT'))}.</p>
      ${supportBlock}
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [order.customer_email],
      subject: `Fotografias disponíveis · ${order.order_number}`,
      html,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Transactional email failed (${response.status})`);
  await supabase.from('orders').update({ email_sent_at: new Date().toISOString() }).eq('id', order.id);
  return { sent: true, id: result.id || null };
}
