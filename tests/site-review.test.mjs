import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { isAdminEmail } from '../supabase/functions/_shared/security.js';
import { contactEmailContent, validateContactRequest } from '../supabase/functions/_shared/contact.js';
import { COMPLAINTS_BOOK_URL, LEGAL_PAGES } from '../legal-content.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readBytes = (path) => readFile(new URL(`../${path}`, import.meta.url));
const PUBLIC_PAGES = ['index.html', 'casamentos/index.html', 'retratos-familias/index.html', 'marcas/index.html', 'galeria.html', '404.html', 'termos/index.html', 'privacidade/index.html', 'admin.html'];

test('admin check compares emails exactly, without LIKE wildcards', () => {
  const admins = [{ email: 'Fotografia.Arnaut@example.com ' }];
  assert.equal(isAdminEmail('fotografia.arnaut@example.com', admins), true);
  assert.equal(isAdminEmail('fotografia%@example.com', admins), false);
  assert.equal(isAdminEmail('fotografia_arnaut@example.com', admins), false);
  assert.equal(isAdminEmail('', admins), false);
});

test('admin guard no longer uses ilike for the admin lookup', async () => {
  const source = await read('supabase/functions/_shared/supabase.ts');
  assert.doesNotMatch(source, /\.ilike\(/);
  assert.match(source, /isAdminEmail\(email/);
});

test('contact requests are validated on the server like in the form', () => {
  const now = new Date('2026-09-25T10:00:00Z');
  const valid = { name: 'Ana', email: 'Ana@Example.com', sessionType: 'Casamento', message: 'Casamos em junho em Pombal.', preferredDate: '2027-06-12' };
  const ok = validateContactRequest(valid, now);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.values.email, 'ana@example.com');
  assert.match(validateContactRequest({ ...valid, email: 'ana@' }, now).errors[0], /email/);
  assert.match(validateContactRequest({ ...valid, sessionType: 'Qualquer' }, now).errors[0], /tipo de sessão/);
  assert.match(validateContactRequest({ ...valid, preferredDate: '2026-01-01' }, now).errors[0], /futura/);
  assert.match(validateContactRequest({ ...valid, preferredDate: '2026-02-31' }, now).errors[0], /data válida/);
  assert.match(validateContactRequest({ ...valid, phone: 'liga-me' }, now).errors[0], /telefone/);
  assert.match(validateContactRequest({ ...valid, message: 'curta' }, now).errors[0], /10 caracteres/);
});

test('contact email escapes visitor content', () => {
  const { html, text, subject } = contactEmailContent({
    name: '<b>Ana</b>', email: 'ana@example.com', phone: '', sessionType: 'Retrato', preferredDate: '', location: '', message: '<script>x</script>',
  });
  assert.doesNotMatch(html, /<script>|<b>Ana/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(text, /<script>x<\/script>/);
  assert.match(subject, /Retrato/);
});

test('contact form sends to the Edge Function and keeps the email fallback', async () => {
  const [script, fn, migration, config] = await Promise.all([
    read('script.js'), read('supabase/functions/contact-request/index.ts'),
    read('supabase/migrations/202609250004_contact_requests.sql'), read('supabase/config.toml'),
  ]);
  assert.match(script, /functions\/v1|contactFunctionsBase/);
  assert.match(script, /\/contact-request`/);
  assert.match(script, /openContactEmailDraft/);
  assert.match(fn, /reply_to: values\.email/);
  assert.match(fn, /RATE_LIMIT/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /contact_request/);
  assert.match(config, /\[functions\.contact-request\]\s*verify_jwt = false/);
});

test('paid galleries never hand out free originals', async () => {
  const [getGallery, adminAlbums, admin, migration] = await Promise.all([
    read('supabase/functions/get-gallery/index.ts'), read('supabase/functions/admin-albums/index.ts'),
    read('admin.js'), read('supabase/migrations/202609250001_sales_originals_guard.sql'),
  ]);
  assert.match(getGallery, /watermark_original_downloads\) && !album\.sales_enabled/);
  assert.match(adminAlbums, /watermark_original_downloads: !salesEnabled &&/);
  assert.match(admin, /downloadsAllowed && !fields\.salesEnabled\.checked/);
  assert.match(migration, /check \(sales_enabled = false or watermark_original_downloads = false\)/);
  assert.doesNotMatch(adminAlbums, /nÃ£o/);
});

test('gallery links are signed in batches and refreshed before they expire', async () => {
  const [getGallery, gallery] = await Promise.all([read('supabase/functions/get-gallery/index.ts'), read('gallery.js')]);
  assert.match(getGallery, /createSignedUrls\(batch, SIGNED_URL_SECONDS/);
  assert.doesNotMatch(getGallery, /createSignedUrl\(/);
  assert.match(gallery, /scheduleUrlRefresh\(data\.signedUrlSeconds\)/);
  assert.match(gallery, /retryExpiredImage/);
  assert.match(gallery, /visibilitychange/);
});

test('checkout requires the digital-content withdrawal waiver', async () => {
  const [html, gallery, checkout, migration] = await Promise.all([
    read('galeria.html'), read('gallery.js'), read('supabase/functions/create-checkout-session/index.ts'),
    read('supabase/migrations/202609250002_withdrawal_waiver.sql'),
  ]);
  assert.match(html, /data-cart-waiver/);
  assert.match(html, /direito de livre resolução/);
  assert.match(gallery, /withdrawalWaiver: cartWaiver\.checked/);
  assert.match(gallery, /!cartTerms\.checked \|\| !cartWaiver\.checked/);
  assert.match(checkout, /body\.withdrawalWaiver !== true/);
  assert.match(checkout, /withdrawal_waiver_accepted_at/);
  assert.match(migration, /withdrawal_waiver_accepted_at timestamptz/);
});

test('stuck Stripe events can be processed again', async () => {
  const migration = await read('supabase/migrations/202609250003_stripe_event_reclaim.sql');
  assert.match(migration, /status = 'processing'[\s\S]*claimed_at < now\(\) - interval '10 minutes'/);
});

test('maintenance and trigger functions are not callable by visitors', async () => {
  const migration = await read('supabase/migrations/202609250005_function_privileges.sql');
  for (const fn of ['cleanup_abandoned_gallery_drafts', 'cleanup_expired_gallery_sessions', 'notify_order_change', 'notify_contact_request']) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\(\\) from public, anon, authenticated`), fn);
  }
  assert.doesNotMatch(migration, /is_gallery_admin/);
  assert.match(migration, /touch_updated_at\(\) set search_path = public/);
});

test('legal pages include the Portuguese consumer information', () => {
  const terms = LEGAL_PAGES.terms.sections.map((section) => section.html).join('\n');
  const privacy = LEGAL_PAGES.privacy.sections.map((section) => section.html).join('\n');
  assert.match(terms, /Livro de Reclamações/);
  assert.match(terms, /Resolução Alternativa de Litígios/);
  assert.match(terms, /livre resolução/);
  assert.match(terms, /Decreto-Lei n\.º 24\/2014/);
  assert.match(privacy, /CNPD/);
  assert.match(privacy, /Resend/);
  assert.equal(COMPLAINTS_BOOK_URL, 'https://www.livroreclamacoes.pt/');
});

test('every public footer links to the electronic complaints book', async () => {
  for (const page of ['index.html', 'galeria.html', 'casamentos/index.html', 'retratos-familias/index.html', 'marcas/index.html', 'legal-page.js']) {
    assert.match(await read(page), /livroreclamacoes\.pt|COMPLAINTS_BOOK_URL/, page);
  }
  assert.doesNotMatch(await read('index.html'), /Pinterest/);
  assert.doesNotMatch(await read('legal-page.js'), /Pinterest/);
});

test('the published portrait carries no EXIF/GPS metadata', async () => {
  const bytes = await readBytes('assets/beatriz-arnaut.jpg');
  assert.equal(bytes.includes(Buffer.from('Exif\0\0')), false);
  for (const file of ['assets/beatriz-arnaut.webp', 'assets/beatriz-arnaut-760.webp']) {
    assert.equal((await readBytes(file)).includes(Buffer.from('EXIF')), false, file);
  }
});

test('pages use self-hosted fonts and light assets', async () => {
  for (const page of PUBLIC_PAGES) {
    const html = await read(page);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/, page);
    assert.doesNotMatch(html, /logo-arnaut\.png/, page);
  }
  const css = await read('styles.css');
  assert.match(css, /@font-face[\s\S]*assets\/fonts\/newsreader-latin\.woff2/);
  const fonts = await readdir(new URL('../assets/fonts/', import.meta.url));
  assert.ok(fonts.includes('manrope-latin.woff2') && fonts.includes('dm-mono-400-latin.woff2'));
  const headers = await read('_headers');
  assert.doesNotMatch(headers, /fonts\.googleapis/);
  assert.match(headers, /Strict-Transport-Security/);
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512', '512x512']);
});

test('site, gallery and admin styles are split by page', async () => {
  const [site, gallery, admin, galleryHtml, adminHtml, home] = await Promise.all([
    read('styles.css'), read('gallery.css'), read('admin.css'), read('galeria.html'), read('admin.html'), read('index.html'),
  ]);
  assert.doesNotMatch(site, /\.admin-(?:shell|sidebar|gallery-card)\b/);
  assert.doesNotMatch(site, /\.client-photo\b/);
  assert.match(gallery, /\.client-photo\b/);
  assert.match(admin, /\.admin-/);
  assert.ok(site.length < 90_000, `styles.css should stay light (${site.length} bytes)`);
  assert.doesNotMatch(home, /gallery\.css|admin\.css/);
  assert.match(galleryHtml, /styles\.css[^>]*>\s*<link rel="stylesheet" href="gallery\.css/);
  assert.match(adminHtml, /styles\.css[^>]*>\s*<link rel="stylesheet" href="gallery\.css[^>]*>\s*<link rel="stylesheet" href="admin\.css/);
});

test('homepage portfolio no longer loads the full Supabase client', async () => {
  const [portfolio, home] = await Promise.all([read('portfolio-public.js'), read('index.html')]);
  assert.doesNotMatch(portfolio, /esm\.sh|createClient/);
  assert.match(portfolio, /\/rest\/v1\//);
  assert.match(portfolio, /\/storage\/v1\/object\/sign\/public-portfolio/);
  assert.match(portfolio, /SIGNED_CACHE_KEY/);
  assert.match(home, /<noscript>[\s\S]*assets\/portfolio\/w800\//);
});

test('intro loader only runs on the first visit of a session', async () => {
  const [intro, script, home, css] = await Promise.all([read('intro-state.js'), read('script.js'), read('index.html'), read('styles.css')]);
  assert.match(intro, /arnaut_intro_seen/);
  assert.match(intro, /prefers-reduced-motion/);
  assert.match(home, /<script src="intro-state\.js[^"]*"><\/script>/);
  assert.match(script, /skipIntro/);
  assert.doesNotMatch(script, /window\.addEventListener\('load', \(\) => \{\s*window\.clearInterval\(loadingTimer\)/);
  assert.match(css, /\.skip-intro \.loader \{ display: none; \}/);
});

test('service pages are indexable, unique and linked from the homepage', async () => {
  const home = await read('index.html');
  const titles = new Set();
  for (const slug of ['casamentos', 'retratos-familias', 'marcas']) {
    const html = await read(`${slug}/index.html`);
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    assert.ok(!titles.has(title), `duplicate title ${title}`);
    titles.add(title);
    assert.match(html, /<meta name="description" content="[^"]{80,}"/);
    assert.match(html, /<!-- seo:start[\s\S]*<!-- seo:end -->/);
    assert.match(html, /href="\/#contacto"/);
    assert.match(home, new RegExp(`href="${slug}/"`));
  }
  const generator = await read('scripts/generate-site-files.mjs');
  for (const path of ['/casamentos/', '/retratos-familias/', '/marcas/']) assert.match(generator, new RegExp(path));
  assert.match(generator, /application\/ld\+json/);
  assert.match(generator, /config\.js/);
});
