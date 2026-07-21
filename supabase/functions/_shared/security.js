export const BUCKET = 'private-galleries';
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const GALLERY_SESSION_SECONDS = 2 * 60 * 60;
export const SIGNED_URL_SECONDS = 10 * 60;
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const encoder = new TextEncoder();

export function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function isValidSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''));
}

export function sanitizeText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

export function normalizeGalleryCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[O]/g, '0')
    .replace(/[IL]/g, '1');
}

export function formatGalleryCode(value) {
  return normalizeGalleryCode(value).slice(0, 12).replace(/(.{4})(?=.)/g, '$1-');
}

export function maskGalleryCode(value) {
  const clean = normalizeGalleryCode(value);
  return `••••-••••-${clean.slice(-4) || '••••'}`;
}

export function generateGalleryCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let value = '';
  bytes.forEach((byte) => {
    value += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  });
  return formatGalleryCode(value);
}

export async function hmacSha256Hex(value, pepper) {
  if (!pepper) throw new Error('Missing hash pepper');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(value)));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashAccessCode(code, pepper) {
  return hmacSha256Hex(normalizeGalleryCode(code), pepper);
}

export async function lookupAccessCode(code, pepper) {
  return hmacSha256Hex(`lookup:${normalizeGalleryCode(code)}`, pepper);
}

async function aesKeyFromSecret(secret) {
  if (!secret) throw new Error('Missing gallery code encryption key');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export async function encryptGalleryCode(code, secret) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await aesKeyFromSecret(secret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(formatGalleryCode(code)),
  );
  return JSON.stringify({
    v: 1,
    alg: 'AES-GCM',
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
  });
}

export async function decryptGalleryCode(payload, secret) {
  if (!payload) throw new Error('Código cifrado indisponível.');
  const parsed = JSON.parse(payload);
  if (parsed.v !== 1 || parsed.alg !== 'AES-GCM') throw new Error('Formato de código cifrado inválido.');
  const key = await aesKeyFromSecret(secret);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) },
    key,
    base64ToBytes(parsed.data),
  );
  return new TextDecoder().decode(plain);
}

export async function hashSessionToken(token, pepper) {
  return hmacSha256Hex(String(token || '').trim(), pepper);
}

export function constantTimeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function buildStoragePath(albumId, originalName, variant = 'originals') {
  if (!['originals', 'web', 'thumbs', 'watermarked', 'web-watermarked', 'thumbs-watermarked'].includes(variant)) {
    throw new Error('Invalid storage variant');
  }
  const extension = String(originalName || 'image')
    .toLowerCase()
    .split('.')
    .pop()
    .replace(/[^a-z0-9]/g, '') || 'jpg';
  return `albums/${albumId}/${variant}/${crypto.randomUUID()}.${extension}`;
}

export function buildProcessedStoragePath(albumId, photoId, variant) {
  if (!['web', 'watermarked', 'thumbs', 'web-watermarked', 'thumbs-watermarked'].includes(variant)) {
    throw new Error('Invalid processed storage variant');
  }
  return `albums/${albumId}/${variant}/${photoId}.webp`;
}

export function assertAllowedImage(fileLike) {
  if (!fileLike || !ALLOWED_IMAGE_TYPES.has(fileLike.type)) {
    throw new Error('Tipo de ficheiro inválido. Use JPEG, PNG ou WebP.');
  }
  if (fileLike.size > MAX_IMAGE_BYTES) {
    throw new Error('Ficheiro demasiado grande. O limite é 50 MB.');
  }
}

export function getClientIp(request) {
  const header = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown';
  return header.split(',')[0].trim();
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function getEnv(name, fallback = '') {
  if (globalThis.Deno?.env?.get) return Deno.env.get(name) || fallback;
  return fallback;
}

export function getSecretKey() {
  const modern = getEnv('SUPABASE_SECRET_KEYS');
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed.default) return parsed.default;
    } catch {
      return modern;
    }
  }
  return getEnv('SUPABASE_SECRET_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export function getPublishableKey() {
  const modern = getEnv('SUPABASE_PUBLISHABLE_KEYS');
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed.default) return parsed.default;
    } catch {
      return modern;
    }
  }
  return getEnv('SUPABASE_PUBLISHABLE_KEY') || getEnv('SUPABASE_ANON_KEY');
}
