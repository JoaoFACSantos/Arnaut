const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeCurrency(value, fallback = 'EUR') {
  const currency = String(value || fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : fallback;
}

export function normalizePhotoIds(value, maxItems = 100) {
  if (!Array.isArray(value)) return [];
  const unique = [];
  const seen = new Set();
  for (const rawId of value) {
    const id = String(rawId || '').trim().toLowerCase();
    if (!UUID_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= maxItems) break;
  }
  return unique;
}

export function calculateOrderTotals(photoCount, unitPriceCents, discountCents = 0) {
  const count = Number(photoCount);
  const unit = Number(unitPriceCents);
  const discount = Number(discountCents);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('invalid_photo_count');
  if (!Number.isSafeInteger(unit) || unit < 1) throw new Error('invalid_unit_price');
  if (!Number.isSafeInteger(discount) || discount < 0) throw new Error('invalid_discount');
  const subtotalCents = count * unit;
  const totalCents = subtotalCents - discount;
  if (!Number.isSafeInteger(subtotalCents) || totalCents < 0) throw new Error('invalid_total');
  return { subtotalCents, discountCents: discount, totalCents };
}

export function isPaidOrderStatus(status) {
  return status === 'paid' || status === 'partially_refunded';
}

export function canDownloadOrder(order, now = Date.now()) {
  if (!order || !isPaidOrderStatus(order.status)) return false;
  if (order.downloads_invalidated_at) return false;
  const expiry = new Date(order.expires_at || 0).getTime();
  return Number.isFinite(expiry) && expiry > Number(now);
}

export function centsForStripe(value) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 99999999) {
    throw new Error('invalid_stripe_amount');
  }
  return cents;
}

export function safeOrderStatus(value) {
  const status = String(value || 'pending');
  return new Set(['pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded']).has(status)
    ? status
    : 'pending';
}

