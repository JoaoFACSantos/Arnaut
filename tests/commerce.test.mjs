import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderTotals,
  canDownloadOrder,
  centsForStripe,
  normalizeCurrency,
  normalizePhotoIds,
} from '../supabase/functions/_shared/commerce.js';

test('normalizes currency and accepts only unique UUID photo ids', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(normalizeCurrency('eur'), 'EUR');
  assert.deepEqual(normalizePhotoIds([id, id, 'invalid']), [id]);
});

test('calculates totals exclusively in integer cents', () => {
  assert.deepEqual(calculateOrderTotals(3, 699), {
    subtotalCents: 2097,
    discountCents: 0,
    totalCents: 2097,
  });
  assert.throws(() => calculateOrderTotals(0, 699));
  assert.throws(() => centsForStripe(6.99));
});

test('allows original downloads only for paid, valid and non-invalidated orders', () => {
  const valid = { status: 'paid', expires_at: new Date(Date.now() + 60_000).toISOString(), downloads_invalidated_at: null };
  assert.equal(canDownloadOrder(valid), true);
  assert.equal(canDownloadOrder({ ...valid, status: 'pending' }), false);
  assert.equal(canDownloadOrder({ ...valid, expires_at: new Date(Date.now() - 1).toISOString() }), false);
  assert.equal(canDownloadOrder({ ...valid, downloads_invalidated_at: new Date().toISOString() }), false);
});
