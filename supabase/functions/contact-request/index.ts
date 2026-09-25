import { createServiceClient } from '../_shared/supabase.ts';
import { contactEmailContent, validateContactRequest } from '../_shared/contact.js';
import {
  corsHeaders,
  errorMessage,
  getClientIp,
  getEnv,
  hashSessionToken,
  json,
  readJson,
} from '../_shared/security.js';

const RATE_WINDOW_MINUTES = 60;
const RATE_LIMIT = 5;

type ContactValues = ReturnType<typeof validateContactRequest>['values'];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const body = await readJson(request);
    // Campo escondido (honeypot): os robôs recebem sucesso, mas nada é guardado nem enviado.
    if (String(body.website || '').trim()) return json({ ok: true });

    const { values, errors } = validateContactRequest(body);
    if (errors.length) return json({ error: errors[0] }, 400);

    const supabase = createServiceClient();
    const ipHash = await hashSessionToken(`contact:${getClientIp(request)}`, getEnv('SESSION_TOKEN_PEPPER'));
    const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('contact_requests')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since);
    if (countError) throw countError;
    if ((count || 0) >= RATE_LIMIT) {
      return json(
        { error: 'Recebemos vários pedidos seguidos desta ligação. Tente mais tarde ou envie um email.' },
        429,
      );
    }

    const { data: saved, error: insertError } = await supabase
      .from('contact_requests')
      .insert({
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        session_type: values.sessionType,
        preferred_date: values.preferredDate || null,
        location: values.location || null,
        message: values.message,
        ip_hash: ipHash,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    try {
      if (await sendContactEmail(values)) {
        await supabase.from('contact_requests').update({ email_sent_at: new Date().toISOString() }).eq('id', saved.id);
      }
    } catch (emailError) {
      // O pedido fica guardado e aparece nas notificações da administração mesmo sem email.
      console.error('contact email failed', errorMessage(emailError));
    }

    return json({ ok: true });
  } catch (error) {
    console.error('contact-request error', errorMessage(error));
    return json({ error: 'Não foi possível enviar o pedido.' }, 500);
  }
});

async function sendContactEmail(values: ContactValues) {
  const apiKey = String(getEnv('RESEND_API_KEY') || '').trim();
  const from = String(getEnv('CONTACT_FROM_EMAIL') || getEnv('ORDER_FROM_EMAIL') || '').trim();
  const to = String(getEnv('CONTACT_TO_EMAIL') || getEnv('SALES_SUPPORT_EMAIL') || '').trim();
  if (!apiKey || !from || !to) return false;

  const { subject, text, html } = contactEmailContent(values);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: values.email, subject, text, html }),
  });
  if (!response.ok) throw new Error(`Contact email failed (${response.status})`);
  return true;
}
