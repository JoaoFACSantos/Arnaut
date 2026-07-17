import { createServiceClient } from '../_shared/supabase.ts';
import {
  corsHeaders,
  getClientIp,
  getEnv,
  hashAccessCode,
  hashSessionToken,
  isValidSlug,
  json,
  randomToken,
  readJson,
  constantTimeEqual,
} from '../_shared/security.js';

const GENERIC_ERROR = 'Galeria ou código inválido.';
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 8;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabase = createServiceClient();
  const body = await readJson(request);
  const slug = String(body.slug || '').trim().toLowerCase();
  const code = String(body.code || '').trim();

  if (!isValidSlug(slug) || code.length < 3 || code.length > 120) {
    return json({ error: GENERIC_ERROR }, 400);
  }

  const ipHash = await hashSessionToken(getClientIp(request), getEnv('SESSION_TOKEN_PEPPER'));
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabase
    .from('album_access_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
    .eq('ip_hash', ipHash)
    .eq('success', false)
    .gte('created_at', since);

  if ((count || 0) >= RATE_LIMIT_MAX_FAILURES) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return json({ error: 'Demasiadas tentativas. Tente novamente mais tarde.' }, 429);
  }

  const { data: album } = await supabase
    .from('albums')
    .select('id, access_code_hash, is_active, expires_at, session_version')
    .eq('slug', slug)
    .eq('is_archived', false)
    .maybeSingle();

  const codeHash = await hashAccessCode(code, getEnv('ACCESS_CODE_PEPPER'));
  const expired = album?.expires_at && new Date(album.expires_at).getTime() <= Date.now();
  const valid = album && album.is_active && !expired && constantTimeEqual(album.access_code_hash, codeHash);

  if (!valid) {
    await supabase.from('album_access_attempts').insert({
      album_id: album?.id || null,
      slug,
      ip_hash: ipHash,
      success: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
    return json({ error: GENERIC_ERROR }, 401);
  }

  const token = randomToken();
  const tokenHash = await hashSessionToken(token, getEnv('SESSION_TOKEN_PEPPER'));
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  await supabase.from('album_access_attempts').insert({
    album_id: album.id,
    slug,
    ip_hash: ipHash,
    success: true,
  });

  const { error: sessionError } = await supabase.from('album_sessions').insert({
    album_id: album.id,
    token_hash: tokenHash,
    session_version: album.session_version,
    expires_at: expiresAt,
  });

  if (sessionError) {
    return json({ error: 'Não foi possível criar a sessão da galeria.' }, 500);
  }

  return json({
    token,
    expiresAt,
    expiresInSeconds: 2 * 60 * 60,
  });
});
