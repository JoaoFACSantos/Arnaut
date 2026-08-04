import { createServiceClient } from '../_shared/supabase.ts';
import { BUCKET, corsHeaders, getClientIp, getEnv, hashSessionToken, json, readJson } from '../_shared/security.js';
import {
  authenticateOrderAccess,
  ORDER_DOWNLOAD_URL_SECONDS,
  ORDER_STATUS_POLL_SECONDS,
  orderDownloadAvailable,
} from '../_shared/commerce.ts';

const RATE_WINDOW_MINUTES = 10;
const RATE_LIMIT = 40;

type OrderReference = {
  id: string;
  status?: string;
  expires_at?: string | null;
  downloads_invalidated_at?: string | null;
  [key: string]: unknown;
};

type OrderItemRow = {
  id: string;
  photo_id: string;
  unit_price_cents: number;
  album_photos: OrderPhotoRow | OrderPhotoRow[] | null;
};

type OrderPhotoRow = {
  filename: string | null;
  thumbnail_path?: string | null;
  watermarked_path?: string | null;
  original_path?: string | null;
  storage_path?: string | null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabase = createServiceClient();
  const body = await readJson(request);
  const orderPublicId = String(body.orderPublicId || '').trim();
  const token = String(body.token || '').trim();
  const action = String(body.action || 'status');
  const authenticated = await authenticateOrderAccess(supabase, orderPublicId, token);
  if (!authenticated) return json({ error: 'Ligação inválida ou expirada.' }, 401);

  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const auditAction = action === 'download' ? 'download' : 'order-status';
  const { count } = await supabase.from('commerce_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('album_session_id', authenticated.order.album_session_id)
    .eq('action', auditAction)
    .gte('created_at', since);
  if ((count || 0) >= RATE_LIMIT) return json({ error: 'Demasiados pedidos. Aguarde um momento.' }, 429);
  await supabase.from('commerce_attempts').insert({
    album_session_id: authenticated.order.album_session_id,
    ip_hash: await hashSessionToken(getClientIp(request), getEnv('SESSION_TOKEN_PEPPER')),
    action: auditAction,
    success: true,
  });

  if (action === 'status') return orderStatus(supabase, authenticated.order);
  if (action === 'download') {
    return createDownload(supabase, authenticated.order, String(body.photoId || '').trim());
  }
  return json({ error: 'Ação desconhecida.' }, 400);
});

async function orderStatus(supabase: ReturnType<typeof createServiceClient>, order: OrderReference) {
  const { data, error } = await supabase.from('orders')
    .select(
      'id, public_id, order_number, customer_email, currency, subtotal_cents, discount_cents, total_cents, status, created_at, paid_at, expires_at, downloads_invalidated_at, albums(title, sales_support_email, refund_policy_text), order_items(id, photo_id, unit_price_cents, album_photos(filename, thumbnail_path, watermarked_path))',
    )
    .eq('id', order.id)
    .maybeSingle();
  if (error || !data) return json({ error: 'Encomenda não encontrada.' }, 404);

  const album = Array.isArray(data.albums) ? data.albums[0] : data.albums;
  const downloadAvailable = orderDownloadAvailable(data);
  const orderItems = (data.order_items || []) as unknown as OrderItemRow[];
  const items = await Promise.all(orderItems.map(async (item) => {
    const photo = Array.isArray(item.album_photos) ? item.album_photos[0] : item.album_photos;
    let previewUrl = null;
    const previewPath = photo?.thumbnail_path || photo?.watermarked_path;
    if (previewPath) {
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(previewPath, 5 * 60);
      previewUrl = signed.data?.signedUrl || null;
    }
    return {
      id: item.id,
      photoId: item.photo_id,
      filename: photo?.filename || 'Fotografia',
      unitPriceCents: item.unit_price_cents,
      previewUrl,
      downloadAvailable,
    };
  }));

  return json({
    order: {
      publicId: data.public_id,
      number: data.order_number,
      galleryTitle: album?.title || '',
      customerEmail: data.customer_email,
      currency: data.currency,
      subtotalCents: data.subtotal_cents,
      discountCents: data.discount_cents,
      totalCents: data.total_cents,
      status: data.status,
      createdAt: data.created_at,
      paidAt: data.paid_at,
      expiresAt: data.expires_at,
      downloadAvailable,
      supportEmail: album?.sales_support_email || null,
      refundPolicyText: album?.refund_policy_text || null,
      items,
    },
    pollAfterSeconds: ['pending'].includes(data.status) ? ORDER_STATUS_POLL_SECONDS : null,
  });
}

async function createDownload(
  supabase: ReturnType<typeof createServiceClient>,
  order: OrderReference,
  photoId: string,
) {
  if (!photoId || !orderDownloadAvailable(order)) {
    return json({ error: 'O download não está disponível.' }, 403);
  }
  const { data: item, error } = await supabase.from('order_items')
    .select('photo_id, album_photos(filename, original_path, storage_path)')
    .eq('order_id', order.id)
    .eq('photo_id', photoId)
    .maybeSingle();
  if (error || !item) return json({ error: 'Fotografia não incluída nesta encomenda.' }, 404);
  const photo = Array.isArray(item.album_photos) ? item.album_photos[0] : item.album_photos;
  const path = photo?.original_path || photo?.storage_path;
  if (!path) return json({ error: 'Ficheiro original indisponível.' }, 404);
  const { data: signed, error: signError } = await supabase.storage.from(BUCKET)
    .createSignedUrl(path, ORDER_DOWNLOAD_URL_SECONDS, { download: photo?.filename || true });
  if (signError || !signed?.signedUrl) return json({ error: 'Não foi possível preparar o download.' }, 500);
  return json({ url: signed.signedUrl, expiresIn: ORDER_DOWNLOAD_URL_SECONDS });
}
