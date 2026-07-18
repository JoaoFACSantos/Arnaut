import test from 'node:test';
import assert from 'node:assert/strict';
import { formatExpirationStatus } from '../admin-utils.js';

function localNoonOffset(days) {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, 12).toISOString();
}

test('formats missing or invalid expiration dates', () => {
  assert.equal(formatExpirationStatus(null), 'Sem expiração');
  assert.equal(formatExpirationStatus('not-a-date'), 'Sem expiração');
});

test('formats future expiration dates with singular and plural', () => {
  assert.equal(formatExpirationStatus(localNoonOffset(1)), 'expira em 1 dia');
  assert.equal(formatExpirationStatus(localNoonOffset(2)), 'expira em 2 dias');
});

test('formats current-day expiration without zero days', () => {
  assert.equal(formatExpirationStatus(localNoonOffset(0)), 'expira hoje');
});

test('formats past expiration dates with singular and plural', () => {
  assert.equal(formatExpirationStatus(localNoonOffset(-1)), 'expirou há 1 dia');
  assert.equal(formatExpirationStatus(localNoonOffset(-3)), 'expirou há 3 dias');
});
