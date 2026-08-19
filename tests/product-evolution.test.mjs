import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('private gallery has a real-data welcome and an accessible premium lightbox', async () => {
  const [html, source] = await Promise.all([read('galeria.html'), read('gallery.js')]);
  for (const marker of [
    'data-gallery-welcome', 'data-gallery-welcome-cover', 'data-gallery-welcome-open',
    'data-lightbox-counter', 'data-lightbox-thumbs', 'data-lightbox-share', 'data-lightbox-fullscreen',
  ]) assert.match(html, new RegExp(marker));
  assert.match(source, /album\.coverUrl/);
  assert.match(source, /preloadLightboxNeighbours/);
  assert.match(source, /renderLightboxThumbs/);
  assert.match(source, /touchstart/);
  assert.match(source, /button:not\(\[hidden\]\):not\(:disabled\), a\[href\]:not\(\[hidden\]\)/);
  assert.doesNotMatch(source, /client-photo__caption/);
});

test('public experience includes FAQ, validated contact fallback and branded 404', async () => {
  const [home, script, notFound] = await Promise.all([read('index.html'), read('script.js'), read('404.html')]);
  assert.match(home, /data-faq-list/);
  assert.match(home, /data-contact-form/);
  assert.match(home, /name="sessionType"/);
  assert.match(script, /validatePublicContact/);
  assert.match(script, /mailto:/);
  assert.match(notFound, /Esta fotografia[\s\S]*parece ter-se/);
  assert.match(notFound, /noindex/);
});

test('recent work opens the selected legacy or stored photograph in the lightbox', async () => {
  const [home, portfolio, script] = await Promise.all([
    read('index.html'), read('portfolio-public.js'), read('script.js'),
  ]);

  assert.match(portfolio, /link\.dataset\.lightboxGallery = 'portfolio'/);
  assert.match(portfolio, /link\.dataset\.lightboxStart = String\(index\)/);
  assert.match(script, /photo\.web_url \|\| photo\.legacy_public_url/);
  assert.match(script, /gallery\?\.length \? gallery/);
  assert.match(home, /portfolio-public\.js\?v=20260819-lightbox-1/);
  assert.match(home, /script\.js\?v=20260819-lightbox-1/);
});

test('portfolio editor supports curation, filtering and autosave feedback', async () => {
  const [html, source, migration] = await Promise.all([
    read('admin.html'), read('admin.js'), read('supabase/migrations/202608180001_portfolio_editor_fields.sql'),
  ]);
  for (const marker of ['data-portfolio-search', 'data-portfolio-state', 'data-portfolio-featured', 'data-portfolio-edit-title']) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(source, /portfolioSearch/);
  assert.match(source, /portfolioFeatured/);
  assert.match(source, /A guardar/);
  assert.match(source, /Tentar novamente/);
  assert.match(migration, /internal_title/);
  assert.match(migration, /is_featured/);
});

test('admin notifications are persistent, RLS protected and derived from real events', async () => {
  const [html, source, migration] = await Promise.all([
    read('admin.html'), read('admin.js'), read('supabase/migrations/202608180002_admin_notifications.sql'),
  ]);
  assert.match(html, /data-notifications-toggle/);
  assert.match(html, /data-notifications-panel/);
  assert.match(source, /from\('admin_notifications'\)/);
  assert.match(source, /setInterval\(\(\) => loadAdminNotifications\(\), 60_000\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /notify_order_change/);
  assert.match(migration, /refresh_gallery_expiry_notifications/);
});

test('admin global search uses real galleries and orders with keyboard access', async () => {
  const [html, source] = await Promise.all([read('admin.html'), read('admin.js')]);
  assert.match(html, /data-global-search-trigger/);
  assert.match(html, /data-global-search-dialog/);
  assert.match(source, /callAdminOrders\('list'/);
  assert.match(source, /normalizedSearchText/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(source, /'ArrowDown', 'ArrowUp'/);
});

test('publication assets include SEO generation, operations and email templates', async () => {
  const [generator, operations, robots, galleryEmail, orderEmail] = await Promise.all([
    read('scripts/generate-site-files.mjs'), read('OPERATIONS.md'), read('robots.txt'),
    read('supabase/email-templates/gallery-ready.html'), read('supabase/email-templates/purchase-confirmed.html'),
  ]);
  assert.match(generator, /sitemap\.xml/);
  assert.match(generator, /SITE_URL/);
  assert.match(operations, /Backup/i);
  assert.match(robots, /Disallow: \/admin\.html/);
  assert.match(galleryEmail, /Fotografia Arnaut/);
  assert.match(orderEmail, /Fotografia Arnaut/);
});
