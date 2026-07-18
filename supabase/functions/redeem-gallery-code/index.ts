import { createServiceClient } from '../_shared/supabase.ts';
import {
  GALLERY_SESSION_SECONDS,
  constantTimeEqual,
  corsHeaders,
  getClientIp,
  getEnv,
  hashAccessCode,
  hashSessionToken,
  json,
  lookupAccessCode,
  normalizeGalleryCode,
  randomToken,
  readJson,
} from '../_shared/security.js';

const GENERIC_ERROR = 'Código inválido ou galeria indisponível.';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabase = createServiceClient();
  const body = await readJson(request);
  const code = normalizeGalleryCode(body.code);
  const deviceId = String(body.deviceId || 'unknown').slice(0, 120);

  if (code.length !== 12) return json({ error: GENERIC_ERROR }, 400);

  const pepper = getEnv('ACCESS_CODE_PEPPER');
  const lookup = await lookupAccessCode(code, pepper);
  const ipHash = await hashSessionToken(getClientIp(request), getEnv('SESSION_TOKEN_PEPPER'));
  const deviceHash = await hashSessionToken(deviceId, getEnv('SESSION_TOKEN_PEPPER'));
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from('album_access_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since)
    .eq('success', false);

  if ((count || 0) >= 8) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return json({ error: 'Demasiadas tentativas. Tente novamente mais tarde.' }, 429);
  }

  const { data: album } = await supabase
    .from('albums')
    .select('id, public_id, access_code_hash, is_active, is_archived, status, expires_at, session_version')
    .eq('access_code_lookup', lookup)
    .maybeSingle();

  const validHash = album && constantTimeEqual(album.access_code_hash, await hashAccessCode(code, pepper));
  const expired = album?.expires_at && new Date(album.expires_at).getTime() <= Date.now();
  const available = album && album.is_active && !album.is_archived && album.status === 'active' && !expired;

  if (!validHash || !available) {
    await supabase.from('album_access_attempts').insert({
      album_id: album?.id || null,
      slug: 'code-only',
      code_lookup: lookup,
      ip_hash: ipHash,
      device_hash: deviceHash,
      success: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
    return json({ error: GENERIC_ERROR }, 401);
  }

  const token = randomToken();
  const tokenHash = await hashSessionToken(token, getEnv('SESSION_TOKEN_PEPPER'));
  const expiresAt = new Date(Date.now() + GALLERY_SESSION_SECONDS * 1000).toISOString();

  await supabase.from('album_access_attempts').insert({
    album_id: album.id,
    slug: 'code-only',
    code_lookup: lookup,
    ip_hash: ipHash,
    device_hash: deviceHash,
    success: true,
  });

  await supabase.from('album_sessions').insert({
    album_id: album.id,
    token_hash: tokenHash,
    session_version: album.session_version,
    expires_at: expiresAt,
  });

  return json({
    token,
    publicId: album.public_id,
    expiresAt,
    expiresInSeconds: GALLERY_SESSION_SECONDS,
  });
});
