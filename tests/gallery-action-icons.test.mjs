import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('uses the supplied SVG assets in the public gallery action bar', async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL('../galeria.html', import.meta.url), 'utf8'),
    readFile(new URL('../gallery.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);

  for (const icon of ['icon_favoritos.svg', 'icon_partilhar.svg', 'icon_ajuda.svg', 'icon_carrinho.svg']) {
    assert.equal(css.includes(icon), true, `missing public gallery icon: ${icon}`);
  }

  for (const oldMarkup of [
    'client-gallery__action-icon" aria-hidden="true">♡',
    'client-gallery__action-icon" aria-hidden="true">⌯',
    'client-gallery__action-icon" aria-hidden="true">?',
    'client-gallery__action-icon" aria-hidden="true">▱',
  ]) {
    assert.equal(html.includes(oldMarkup), false, `old action symbol found: ${oldMarkup}`);
  }

  for (const oldSymbol of ['▱', '♡', '⌯']) {
    assert.equal(`${html}\n${source}`.includes(oldSymbol), false, `old public action symbol found: ${oldSymbol}`);
  }
  assert.match(html, /client-cart-bar__icon[\s\S]*?client-ui-icon is-cart/);
  assert.match(html, /data-open-cart[^>]*>[\s\S]*?client-ui-icon is-cart is-button/);
  assert.match(source, /galleryIconMarkup\('cart'/);
  assert.match(source, /createGalleryIcon\('cart'/);
});

test('keeps public gallery action handlers and accessible labels intact', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('../galeria.html', import.meta.url), 'utf8'),
    readFile(new URL('../gallery.js', import.meta.url), 'utf8'),
  ]);

  for (const selector of ['data-favorites-action', 'data-share-gallery', 'data-gallery-help', 'data-open-cart-top']) {
    assert.equal(html.includes(selector), true, `missing action control: ${selector}`);
  }
  for (const label of ['Ver favoritas', 'Partilhar galeria', 'Ajuda', 'Abrir carrinho']) {
    assert.equal(html.includes(`aria-label="${label}"`), true, `missing accessible label: ${label}`);
  }
  assert.match(source, /\$\('\[data-favorites-action\]'\)\.addEventListener\('click'/);
  assert.match(source, /\$\('\[data-share-gallery\]'\)\.addEventListener\('click', shareGallery\)/);
  assert.match(source, /\$\('\[data-gallery-help\]'\)\.addEventListener\('click'/);
  assert.match(source, /openCartTop\.addEventListener\('click', openCart\)/);
});
