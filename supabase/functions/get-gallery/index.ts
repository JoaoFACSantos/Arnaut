import { createServiceClient } from '../_shared/supabase.ts';
import {
  BUCKET,
  SIGNED_URL_SECONDS,
  corsHeaders,
  getEnv,
  hashSessionToken,
  isValidSlug,
  json,
  readJson,
} from '../_shared/security.js';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabase = createServiceClient();
  const body = await readJson(request);
  const slug = String(body.slug || '').trim().toLowerCase();
  const token = String(body.token || '').trim();

  if (!isValidSlug(slug) || token.length < 20) {
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
    .select('id, slug, title, event_date, location, description, cover_path, downloads_enabled, is_active, expires_at, session_version')
    .eq('id', session.album_id)
    .eq('slug', slug)
    .eq('is_archived', false)
    .maybeSingle();

  const expired = album?.expires_at && new Date(album.expires_at).getTime() <= Date.now();
  if (!album || !album.is_active || expired || album.session_version !== session.session_version) {
    return json({ error: 'Esta galeria expirou ou foi desativada.' }, 403);
  }

  await supabase
    .from('album_sessions')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', session.id);

  const { data: photos, error } = await supabase
    .from('album_photos')
    .select('id, storage_path, filename, caption, sort_order, width, height, created_at')
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

  const signedPhotos = await Promise.all((photos || []).map(async (photo) => ({
    id: photo.id,
    filename: photo.filename,
    caption: photo.caption,
    width: photo.width,
    height: photo.height,
    url: await sign(photo.storage_path),
    downloadUrl: album.downloads_enabled ? await sign(photo.storage_path, true) : null,
  })));

  const coverUrl = album.cover_path ? await sign(album.cover_path) : signedPhotos[0]?.url || null;

  return json({
    album: {
      slug: album.slug,
      title: album.title,
      eventDate: album.event_date,
      location: album.location,
      description: album.description,
      downloadsEnabled: album.downloads_enabled,
      coverUrl,
    },
    photos: signedPhotos.filter((photo) => Boolean(photo.url)),
    signedUrlSeconds: SIGNED_URL_SECONDS,
  });
});
