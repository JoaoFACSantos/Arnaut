import { createServiceClient, requireAdmin } from '../_shared/supabase.ts';
import { BUCKET, corsHeaders, json, readJson, sanitizeText } from '../_shared/security.js';
import { sendOrderConfirmationEmail } from '../_shared/commerce.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const supabase = createServiceClient();
  const admin = await requireAdmin(request, supabase);
  if (!admin.ok) return admin.response;
  const body = await readJson(request);

  try {
    if (body.action === 'list') return listOrders(supabase, body.filters || {});
    if (body.action === 'detail') return orderDetail(supabase, String(body.orderId || ''));
    if (body.action === 'resend-email') {
      const result = await sendOrderConfirmationEmail(supabase, String(body.orderId || ''), 'admin-resend');
      if (!result.sent) return json({ error: 'A confirmação ainda não pode ser enviada.', reason: result.reason }, 409);
      return json({ ok: true });
    }
    if (body.action === 'invalidate-downloads') {
      const orderId = String(body.orderId || '');
      const now = new Date().toISOString();
      const { error } = await supabase.from('orders').update({ downloads_invalidated_at: now }).eq('id', orderId);
      if (error) throw error;
      await supabase.from('order_access_tokens').update({ revoked_at: now }).eq('order_id', orderId).is('revoked_at', null);
      return json({ ok: true });
    }
    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) {
    console.error('admin-orders error', error?.message || error);
    return json({ error: 'Não foi possível concluir a operação.' }, 500);
  }
});

async function listOrders(supabase: ReturnType<typeof createServiceClient>, filters: Record<string, unknown>) {
  let query = supabase.from('orders')
    .select('id, public_id, order_number, customer_email, currency, total_cents, status, created_at, paid_at, expires_at, albums(id, title), order_items(id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200);
  const status = sanitizeText(filters.status, 30);
  const galleryId = sanitizeText(filters.galleryId, 80);
  const email = sanitizeText(filters.email, 180);
  const dateFrom = sanitizeText(filters.dateFrom, 30);
  const dateTo = sanitizeText(filters.dateTo, 30);
  if (status) query = query.eq('status', status);
  if (galleryId) query = query.eq('gallery_id', galleryId);
  if (email) query = query.ilike('customer_email', `%${email.replace(/[%_]/g, '')}%`);
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
  const { data, error, count } = await query;
  if (error) throw error;
  return json({ orders: (data || []).map((order: any) => ({
    ...order,
    album: Array.isArray(order.albums) ? order.albums[0] : order.albums,
    itemCount: Array.isArray(order.order_items) ? order.order_items.length : 0,
    albums: undefined,
    order_items: undefined,
  })), count });
}

async function orderDetail(supabase: ReturnType<typeof createServiceClient>, orderId: string) {
  const { data, error } = await supabase.from('orders')
    .select('id, public_id, order_number, customer_email, currency, subtotal_cents, discount_cents, total_cents, status, created_at, paid_at, expires_at, downloads_invalidated_at, email_sent_at, stripe_checkout_session_id, stripe_payment_intent_id, albums(id, title, sales_support_email), order_items(id, photo_id, unit_price_cents, album_photos(filename, thumbnail_path, watermarked_path))')
    .eq('id', orderId).maybeSingle();
  if (error || !data) return json({ error: 'Encomenda não encontrada.' }, 404);
  const items = await Promise.all((data.order_items || []).map(async (item: any) => {
    const photo = Array.isArray(item.album_photos) ? item.album_photos[0] : item.album_photos;
    const path = photo?.thumbnail_path || photo?.watermarked_path;
    const signed = path ? await supabase.storage.from(BUCKET).createSignedUrl(path, 5 * 60) : null;
    return { id: item.id, photoId: item.photo_id, filename: photo?.filename || 'Fotografia', unitPriceCents: item.unit_price_cents, previewUrl: signed?.data?.signedUrl || null };
  }));
  return json({ order: { ...data, album: Array.isArray(data.albums) ? data.albums[0] : data.albums, items, albums: undefined, order_items: undefined } });
}
