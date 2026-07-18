import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAllowedImage,
  buildStoragePath,
  constantTimeEqual,
  decryptGalleryCode,
  encryptGalleryCode,
  formatGalleryCode,
  generateGalleryCode,
  hashAccessCode,
  hashSessionToken,
  isValidSlug,
  lookupAccessCode,
  maskGalleryCode,
  normalizeGalleryCode,
  normalizeSlug,
  randomToken,
} from '../supabase/functions/_shared/security.js';

test('normalizes and validates slugs', () => {
  assert.equal(normalizeSlug(' Casamento Ana & Pedro 2026 '), 'casamento-ana-pedro-2026');
  assert.equal(isValidSlug('casamento-ana-pedro'), true);
  assert.equal(isValidSlug('../segredo'), false);
});

test('hashes access codes without returning plain text', async () => {
  const hash = await hashAccessCode(' abcd-2345-wxyz ', 'pepper-one');
  assert.equal(hash.length, 64);
  assert.notEqual(hash, 'ABCD2345WXYZ');
  assert.equal(hash, await hashAccessCode('abcd 2345 wxyz', 'pepper-one'));
  assert.notEqual(hash, await hashAccessCode('ABCD2345WXYZ', 'pepper-two'));
});

test('generates, formats and masks gallery codes', () => {
  const code = generateGalleryCode();
  assert.match(code, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(formatGalleryCode('abcd2345wxyz'), 'ABCD-2345-WXYZ');
  assert.equal(normalizeGalleryCode('abcd 2345-wxyz'), 'ABCD2345WXYZ');
  assert.equal(maskGalleryCode('ABCD-2345-WXYZ'), '••••-••••-WXYZ');
});

test('creates a lookup that is separate from the stored hash', async () => {
  const hash = await hashAccessCode('ABCD-2345-WXYZ', 'pepper-one');
  const lookup = await lookupAccessCode('abcd2345wxyz', 'pepper-one');
  assert.equal(lookup.length, 64);
  assert.notEqual(lookup, hash);
  assert.equal(lookup, await lookupAccessCode('ABCD 2345 WXYZ', 'pepper-one'));
});

test('encrypts gallery codes for later admin retrieval', async () => {
  const encrypted = await encryptGalleryCode('ABCD-2345-WXYZ', 'encryption-secret');
  assert.notEqual(encrypted.includes('ABCD-2345-WXYZ'), true);
  assert.equal(await decryptGalleryCode(encrypted, 'encryption-secret'), 'ABCD-2345-WXYZ');
  await assert.rejects(() => decryptGalleryCode(encrypted, 'wrong-secret'));
  await assert.rejects(() => decryptGalleryCode('', 'encryption-secret'));
});

test('hashes session tokens separately and compares safely', async () => {
  const hash = await hashSessionToken('token', 'session-pepper');
  assert.equal(constantTimeEqual(hash, hash), true);
  assert.equal(constantTimeEqual(hash, `${hash.slice(0, -1)}0`), false);
});

test('generates random url-safe tokens', () => {
  const token = randomToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(token, randomToken());
});

test('builds private storage paths', () => {
  const path = buildStoragePath('00000000-0000-4000-8000-000000000001', 'Foto Final.JPG');
  assert.match(path, /^albums\/00000000-0000-4000-8000-000000000001\/originals\/[a-f0-9-]+\.jpg$/);
});

test('accepts only configured image mime types and sizes', () => {
  assert.doesNotThrow(() => assertAllowedImage({ type: 'image/jpeg', size: 1024 }));
  assert.throws(() => assertAllowedImage({ type: 'application/x-msdownload', size: 1024 }));
  assert.throws(() => assertAllowedImage({ type: 'image/png', size: 60 * 1024 * 1024 }));
});
