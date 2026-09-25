import { createClient } from '@supabase/supabase-js';
import { getEnv, getSecretKey, isAdminEmail } from './security.js';

export function createServiceClient() {
  const url = getEnv('SUPABASE_URL');
  const key = getSecretKey();

  if (!url || !key) {
    throw new Error('Supabase service environment is not configured');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireAdmin(request: Request, supabase = createServiceClient()) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { ok: false as const, response: new Response('Unauthorized', { status: 401 }) };
  }

  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email;

  if (error || !email) {
    return { ok: false as const, response: new Response('Unauthorized', { status: 401 }) };
  }

  // Comparação exata (sem ilike): '%', '_' e '*' num email não podem funcionar como curingas.
  const { data: admins, error: adminError } = await supabase
    .from('gallery_admins')
    .select('email');
  const isAdmin = isAdminEmail(email, admins || []);

  if (adminError || !isAdmin) {
    return { ok: false as const, response: new Response('Forbidden', { status: 403 }) };
  }

  return { ok: true as const, user: data.user };
}
