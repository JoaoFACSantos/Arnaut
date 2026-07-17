import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAllowedImage,
  buildStoragePath,
  constantTimeEqual,
  hashAccessCode,
  hashSessionToken,
  isValidSlug,
  normalizeSlug,
  randomToken,
} from '../supabase/functions/_shared/security.js';

test('normalizes and validates slugs', () => {
  assert.equal(normalizeSlug(' Casamento Ana & Pedro 2026 '), 'casamento-ana-pedro-2026');
  assert.equal(isValidSlug('casamento-ana-pedro'), true);
  assert.equal(isValidSlug('../segredo'), false);
});

test('hashes access codes without returning plain text', async () => {
  const hash = await hashAccessCode(' 1234 ', 'pepper-one');
  assert.equal(hash.length, 64);
  assert.notEqual(hash, '1234');
  assert.equal(hash, await hashAccessCode('1234', 'pepper-one'));
  assert.notEqual(hash, await hashAccessCode('1234', 'pepper-two'));
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
