import { createServiceClient } from '../_shared/supabase.ts';
import {
  BUCKET,
  SIGNED_URL_SECONDS,
  corsHeaders,
  getEnv,
  hashSessionToken,
  json,
  readJson,
} from '../_shared/security.js';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabase = createServiceClient();
  const body = await readJson(request);
  const publicId = String(body.publicId || '').trim();
  const token = String(body.token || '').trim();

  if (!publicId || token.length < 20) {
    return json({ error: 'Galeria ou sessão inválida.' }, 401);
  }

  const tokenHash = await hashSessionToken(token, getEnv('SESSION_TOKEN_PEPPER'));
  const { data: session } = await supabase
    .from('album_sessions')
    .select('id, album_id, session_version, expires_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!session) {
    return json({ error: 'Sessão expirada. Introduza novamente o código.' }, 401);
  }

  const { data: album } = await supabase
    .from('albums')
    .select('id, public_id, slug, title, event_type, event_date, location, description, guest_message, cover_path, downloads_enabled, watermark_enabled, watermark_original_downloads, is_active, is_archived, status, expires_at, session_version')
    .eq('id', session.album_id)
    .eq('public_id', publicId)
    .maybeSingle();

  const expired = album?.expires_at && new Date(album.expires_at).getTime() <= Date.now();
  if (!album || !album.is_active || album.is_archived || album.status !== 'active' || expired || album.session_version !== session.session_version) {
    return json({ error: 'Esta galeria expirou ou foi desativada.' }, 403);
  }

  await supabase
    .from('album_sessions')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', session.id);

  const { data: photos, error } = await supabase
    .from('album_photos')
    .select('id, storage_path, original_path, web_path, watermarked_path, thumbnail_path, watermark_mode, processing_status, filename, caption, sort_order, width, height, created_at')
    .eq('album_id', album.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return json({ error: 'Não foi possível carregar a galeria.' }, 500);
  }

  const sign = async (path: string, download = false) => {
    const { data, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS, download ? { download: true } : undefined);
    if (signError) return null;
    return data.signedUrl;
  };

  const visiblePhotos = (photos || [])
    .map((photo) => {
      const mode = photo.watermark_mode || 'inherit';
      const usesWatermark = mode === 'enabled' || (mode === 'inherit' && album.watermark_enabled);
      const fallbackOriginal = photo.original_path || photo.storage_path;
      const viewPath = usesWatermark
        ? photo.watermarked_path
        : photo.web_path || fallbackOriginal;
      const thumbnailPath = photo.thumbnail_path || viewPath;
      const ready = usesWatermark
        ? photo.processing_status === 'ready' && photo.watermarked_path
        : Boolean(viewPath);
      const downloadPath = album.downloads_enabled
        ? (album.watermark_original_downloads ? fallbackOriginal : viewPath)
        : null;
      return { ...photo, viewPath, thumbnailPath, downloadPath, ready };
    })
    .filter((photo) => Boolean(photo.ready));
  const pendingPhotoCount = (photos || []).length - visiblePhotos.length;

  const signedPhotos = await Promise.all(visiblePhotos.map(async (photo) => ({
    id: photo.id,
    filename: photo.filename,
    caption: photo.caption,
    width: photo.width,
    height: photo.height,
    thumbUrl: await sign(photo.thumbnailPath || photo.viewPath),
    url: await sign(photo.viewPath),
    downloadUrl: photo.downloadPath ? await sign(photo.downloadPath, true) : null,
  })));

  const coverPhoto = visiblePhotos.find((photo) => [photo.original_path, photo.storage_path, photo.web_path, photo.watermarked_path, photo.thumbnail_path].includes(album.cover_path)) || visiblePhotos[0];
  const coverUrl = coverPhoto ? await sign(coverPhoto.thumbnailPath || coverPhoto.viewPath) : null;

  return json({
    album: {
      slug: album.slug,
      publicId: album.public_id,
      title: album.title,
      eventType: album.event_type,
      eventDate: album.event_date,
      location: album.location,
      description: album.guest_message || album.description,
      downloadsEnabled: album.downloads_enabled,
      coverUrl,
    },
    photos: signedPhotos.filter((photo) => Boolean(photo.url)),
    pendingPhotoCount,
    signedUrlSeconds: SIGNED_URL_SECONDS,
  });
});
