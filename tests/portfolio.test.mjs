import test from 'node:test';
import assert from 'node:assert/strict';
import { clampFocalPoint, portfolioMimeFromBytes, portfolioSelectionCapacity, publicPortfolioQuery, reorderPortfolioItems, validatePortfolioFile } from '../portfolio-utils.js';

test('portfolio validates supported files and the 30 MB limit', () => {
  assert.equal(validatePortfolioFile({ type: 'image/jpeg', size: 1024 }).valid, true);
  assert.equal(validatePortfolioFile({ type: 'image/tiff', size: 1024 }).valid, false);
  assert.equal(validatePortfolioFile({ type: 'image/webp', size: 31 * 1024 * 1024 }).valid, false);
});

test('portfolio detects the real image MIME from file signatures', () => {
  assert.equal(portfolioMimeFromBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(portfolioMimeFromBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(portfolioMimeFromBytes(new TextEncoder().encode('RIFFxxxxWEBP')), 'image/webp');
  assert.equal(portfolioMimeFromBytes(new TextEncoder().encode('not-an-image')), '');
});

test('portfolio reordering is immutable and preserves every item', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const result = reorderPortfolioItems(items, 'c', 'a');
  assert.deepEqual(result.map(({ id }) => id), ['c', 'a', 'b']);
  assert.deepEqual(items.map(({ id }) => id), ['a', 'b', 'c']);
});

test('public portfolio query is published, ordered and limited safely', () => {
  assert.deepEqual(publicPortfolioQuery(8), { published: true, order: 'sort_order', ascending: true, limit: 8 });
  assert.equal(publicPortfolioQuery(100).limit, 8);
  assert.equal(publicPortfolioQuery(0).limit, 8);
});

test('focal point remains inside the image', () => {
  assert.equal(clampFocalPoint(-20), 0);
  assert.equal(clampFocalPoint(52.4), 52.4);
  assert.equal(clampFocalPoint(140), 100);
});

test('portfolio public selections never exceed eight photographs', () => {
  assert.deepEqual(portfolioSelectionCapacity(7, 1), { available: 1, allowed: true });
  assert.deepEqual(portfolioSelectionCapacity(7, 2), { available: 1, allowed: false });
});
