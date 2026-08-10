export const DEFAULT_ADMIN_PROFILE = Object.freeze({
  full_name: '',
  role_label: 'Administradora',
  bio: '',
  avatar_path: null,
  phone: '',
  timezone: 'Europe/Lisbon',
  locale: 'pt-PT',
});

export const DEFAULT_USER_PREFERENCES = Object.freeze({
  date_format: 'dd/mm/yyyy',
  default_gallery_expiry_days: null,
  default_downloads_enabled: true,
  default_watermark_enabled: true,
  default_sales_enabled: false,
  default_currency: 'EUR',
  notification_preferences: {},
});

export const SETTINGS_SECTIONS = Object.freeze([
  'profile',
  'account',
  'preferences',
  'notifications',
  'storage',
  'security',
  'billing',
]);

export function normalizeAdminProfile(profile = {}, fallbackName = '') {
  return {
    ...DEFAULT_ADMIN_PROFILE,
    ...profile,
    full_name: String(profile.full_name || fallbackName || '').trim(),
    role_label: String(profile.role_label || DEFAULT_ADMIN_PROFILE.role_label).trim(),
    bio: String(profile.bio || '').slice(0, 280),
    avatar_path: profile.avatar_path ? String(profile.avatar_path) : null,
    phone: String(profile.phone || '').trim(),
    timezone: String(profile.timezone || DEFAULT_ADMIN_PROFILE.timezone),
    locale: profile.locale === 'pt-PT' ? profile.locale : DEFAULT_ADMIN_PROFILE.locale,
  };
}

export function normalizeUserPreferences(preferences = {}) {
  const rawExpiry = preferences.default_gallery_expiry_days;
  const expiry = rawExpiry === null || rawExpiry === undefined || rawExpiry === ''
    ? null
    : Math.min(365, Math.max(1, Number.parseInt(rawExpiry, 10) || 30));
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...preferences,
    date_format: 'dd/mm/yyyy',
    default_gallery_expiry_days: expiry,
    default_downloads_enabled: preferences.default_downloads_enabled !== false,
    default_watermark_enabled: preferences.default_watermark_enabled !== false,
    default_sales_enabled: preferences.default_sales_enabled === true,
    default_currency: 'EUR',
    notification_preferences: preferences.notification_preferences && typeof preferences.notification_preferences === 'object'
      ? preferences.notification_preferences
      : {},
  };
}

export function serializeForm(form) {
  if (!form) return '';
  const values = {};
  [...form.elements].forEach((field) => {
    if (!field.name || field.disabled || ['submit', 'button', 'file'].includes(field.type)) return;
    if (field.type === 'checkbox' || field.type === 'radio') values[field.name] = field.checked;
    else values[field.name] = String(field.value ?? '');
  });
  return JSON.stringify(values);
}

export function passwordStrength(value = '') {
  const password = String(value);
  const checks = [
    password.length >= 10,
    /[a-záàâãéêíóôõúç]/.test(password),
    /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(password),
    /\d/.test(password),
    /[^\p{L}\d]/u.test(password),
    password.length >= 14,
  ];
  const score = checks.filter(Boolean).length;
  return {
    score,
    valid: checks[0] && checks[1] && checks[2] && checks[3],
    label: score <= 2 ? 'Fraca' : score <= 4 ? 'Razoável' : 'Forte',
  };
}

export function galleryExpiryValue(days, now = new Date()) {
  if (days === null || days === undefined || days === '') return '';
  const parsed = Number.parseInt(days, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return '';
  const expires = new Date(now);
  expires.setDate(expires.getDate() + parsed);
  expires.setHours(23, 59, 0, 0);
  const local = new Date(expires.getTime() - expires.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function settingsSectionFromHash(hash = '') {
  const match = String(hash).match(/^#definicoes\/([a-z-]+)$/);
  return match && SETTINGS_SECTIONS.includes(match[1]) ? match[1] : 'profile';
}

export function avatarMimeFromBytes(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (
    data.length >= 8
    && data[0] === 0x89
    && data[1] === 0x50
    && data[2] === 0x4e
    && data[3] === 0x47
    && data[4] === 0x0d
    && data[5] === 0x0a
    && data[6] === 0x1a
    && data[7] === 0x0a
  ) return 'image/png';
  if (
    data.length >= 12
    && String.fromCharCode(...data.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...data.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';
  return '';
}

export async function validateAvatarFile(file, maxBytes = 5 * 1024 * 1024) {
  if (!file) throw new Error('Escolha uma fotografia.');
  if (file.size > maxBytes) throw new Error('A fotografia não pode exceder 5 MB.');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const actualType = avatarMimeFromBytes(bytes);
  if (!actualType) throw new Error('Escolha uma imagem JPEG, PNG ou WebP válida.');
  if (file.type && file.type !== actualType) throw new Error('O conteúdo do ficheiro não corresponde ao formato indicado.');
  return actualType;
}

export function formatInternationalPhone(value = '') {
  return String(value).replace(/[^+\d\s().-]/g, '').trim().slice(0, 32);
}
