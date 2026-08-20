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
  const [home, script, css, notFound] = await Promise.all([read('index.html'), read('script.js'), read('styles.css'), read('404.html')]);
  assert.match(home, /data-faq-list/);
  assert.match(home, /id="faq-answer-1" aria-hidden="true"/);
  assert.match(home, /data-contact-form/);
  assert.match(home, /name="sessionType"/);
  assert.match(script, /const setFaqItemState/);
  assert.match(script, /classList\.toggle\('is-open', open\)/);
  assert.match(script, /faqButtons\.forEach\(\(item\) => setFaqItemState/);
  assert.match(css, /faq__list article > div[\s\S]*?grid-template-rows: 0fr/);
  assert.match(css, /faq__list article\.is-open > div[\s\S]*?grid-template-rows: 1fr/);
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
  assert.match(home, /portfolio-public\.js\?v=20260820-curation-1/);
  assert.match(home, /script\.js\?v=20260820-ux-1/);
});

test('gallery editor actions are compact, ordered and keyboard accessible', async () => {
  const [html, source] = await Promise.all([read('admin.html'), read('admin.js')]);
  const menuStart = html.indexOf('id="gallery-actions-menu"');
  const menuEnd = html.indexOf('</div>', menuStart);
  const menu = html.slice(menuStart, menuEnd);
  const actions = [
    'data-action-copy-code',
    'data-action-regenerate-code',
    'data-action-end-sessions',
    'data-action-toggle-state',
    'data-action-delete',
  ];
  actions.reduce((previous, action) => {
    const position = menu.indexOf(action);
    assert.ok(position > previous, `${action} is out of order`);
    return position;
  }, -1);
  assert.doesNotMatch(menu, /data-action-show-code|data-action-copy-instructions/);
  assert.match(html, /data-preview-gallery aria-label="Pré-visualizar galeria"/);
  assert.match(html, /data-gallery-actions-toggle[\s\S]*?aria-haspopup="menu"/);
  assert.match(source, /navigator\.clipboard\.writeText\(lastShownCode\)/);
  assert.match(source, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/);
  assert.match(source, /els\.galleryActionsToggle\?\.focus/);
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

test('portfolio curation has independent selections and enforced limits', async () => {
  const [migration, repairMigration, edge, publicPortfolio, admin, adminHtml] = await Promise.all([
    read('supabase/migrations/202608200001_portfolio_curated_selections.sql'),
    read('supabase/migrations/202608200002_portfolio_curated_backfill.sql'),
    read('supabase/functions/admin-portfolio/index.ts'),
    read('portfolio-public.js'),
    read('admin.js'),
    read('admin.html'),
  ]);
  assert.match(migration, /show_in_all boolean not null default false/i);
  assert.match(migration, /show_in_category boolean not null default false/i);
  assert.match(migration, /category_count >= 5/i);
  assert.match(migration, /selected_count >= 8/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(repairMigration, /not exists[\s\S]*show_in_all/i);
  assert.match(repairMigration, /category_without_selection/i);
  assert.match(edge, /category-create/);
  assert.match(edge, /all_sort_order/);
  assert.match(publicPortfolio, /show_in_all\.eq\.true,show_in_category\.eq\.true/);
  assert.match(admin, /portfolioFeatured = 'all';[\s\S]*portfolioFeatured\.value = 'all'/);
  assert.match(admin, /filter\.published.*portfolioLimits\.selection/s);
  assert.doesNotMatch(adminHtml, /data-portfolio-all-selection|Seleção “Todos”/);
});

test('intro uses the warm Fotografia Arnaut palette without changing its animation', async () => {
  const [home, css, script] = await Promise.all([read('index.html'), read('styles.css'), read('script.js')]);
  assert.match(home, /id="loader-brand-colours"/);
  assert.match(css, /--intro-background: #2C2523/);
  assert.match(css, /--intro-camera: #9A897C/);
  assert.match(css, /--intro-logo-text: #EDE9E3/);
  assert.match(css, /filter: url\("#loader-brand-colours"\)/);
  assert.match(script, /loaderLine\.style\.width/);
  assert.match(script, /loader\.classList\.add\('is-done'\)/);
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
