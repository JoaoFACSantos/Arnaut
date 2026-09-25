export const CONTACT_SESSION_TYPES = Object.freeze([
  'Casamento',
  'Retrato',
  'Família',
  'Marca ou editorial',
  'Evento',
  'Outro',
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\s.-]{6,40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clean(value, maxLength) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

// Mesmas regras do formulário (script.js), repetidas no servidor.
export function validateContactRequest(input = {}, now = new Date()) {
  const values = {
    name: clean(input.name, 120),
    email: clean(input.email, 200).toLowerCase(),
    phone: clean(input.phone, 40),
    sessionType: clean(input.sessionType, 60),
    preferredDate: clean(input.preferredDate, 10),
    location: clean(input.location, 160),
    message: String(input.message ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 2000),
  };
  const errors = [];
  if (values.name.length < 2) errors.push('Indique o seu nome.');
  if (!EMAIL_PATTERN.test(values.email)) errors.push('Indique um email válido.');
  if (values.phone && !PHONE_PATTERN.test(values.phone)) errors.push('Indique um telefone válido.');
  if (!CONTACT_SESSION_TYPES.includes(values.sessionType)) errors.push('Selecione o tipo de sessão.');
  if (values.preferredDate) {
    const date = DATE_PATTERN.test(values.preferredDate) ? new Date(`${values.preferredDate}T12:00:00Z`) : null;
    // Um dia de tolerância para diferenças de fuso horário entre o visitante e o servidor.
    const earliest = new Date(now.getTime() - 36 * 60 * 60 * 1000);
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== values.preferredDate) {
      errors.push('Indique uma data válida.');
    } else if (date < earliest) errors.push('Escolha uma data futura.');
  }
  if (values.message.length < 10) errors.push('Escreva uma mensagem com pelo menos 10 caracteres.');
  return { values, errors };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function contactEmailContent(values) {
  const rows = [
    ['Nome', values.name],
    ['Email', values.email],
    ['Telefone', values.phone],
    ['Tipo de sessão', values.sessionType],
    ['Data pretendida', values.preferredDate],
    ['Local', values.location],
  ].filter(([, value]) => value);
  const subject = `Pedido de informação — ${values.sessionType} — ${values.name}`.slice(0, 180);
  const text = `${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${values.message}\n`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#2e2926;line-height:1.6;max-width:640px">
      <p style="margin:0 0 16px;color:#856652;font-size:12px;letter-spacing:1px;text-transform:uppercase">Novo pedido pelo site</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:18px">${
    rows.map(([label, value]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#74685f;white-space:nowrap;vertical-align:top">${
        escapeHtml(label)
      }</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`
    ).join('')
  }</table>
      <p style="margin:0;white-space:pre-wrap">${escapeHtml(values.message)}</p>
      <p style="margin:22px 0 0;color:#74685f;font-size:12px">Responda diretamente a este email para contactar ${
    escapeHtml(values.name)
  }.</p>
    </div>`;
  return { subject, text, html };
}
