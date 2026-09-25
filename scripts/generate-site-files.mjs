// Passo de publicação (`npm run build`), pensado para correr no Cloudflare Pages ou localmente:
// 1. cria config.js a partir das variáveis de ambiente, quando existem;
// 2. com um SITE_URL HTTPS, escreve canonical, URLs absolutas (og:image, og:url) e dados
//    estruturados nas páginas públicas, e gera sitemap.xml e robots.txt.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fileUrl = (path) => new URL(path, root);
const env = process.env;

const PAGES = [
  { path: '/', file: 'index.html', priority: '1.0' },
  { path: '/casamentos/', file: 'casamentos/index.html', priority: '0.8' },
  { path: '/retratos-familias/', file: 'retratos-familias/index.html', priority: '0.8' },
  { path: '/marcas/', file: 'marcas/index.html', priority: '0.8' },
  { path: '/privacidade/', file: 'privacidade/index.html', priority: '0.3' },
  { path: '/termos/', file: 'termos/index.html', priority: '0.3' },
];

if (env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY) {
  const config = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
    SITE_URL: env.SITE_URL || '',
    ADMIN_EMAIL: env.ADMIN_EMAIL || '',
    WHATSAPP_NUMBER: env.WHATSAPP_NUMBER || '',
  };
  await writeFile(fileUrl('config.js'), `window.ARNAUT_CONFIG = ${JSON.stringify(config, null, 2)};\n`, 'utf8');
  console.log('config.js gerado a partir das variáveis de ambiente.');
}

const configSource = await readFile(fileUrl('config.js'), 'utf8').catch(() => '');
const configured = configSource.match(/SITE_URL"?\s*:\s*['"]([^'"]+)['"]/)?.[1] || '';
const siteUrl = String(env.SITE_URL || configured).replace(/\/$/, '');
const isProductionUrl = /^https:\/\//i.test(siteUrl) && !/localhost|127\.0\.0\.1/i.test(siteUrl);

if (!isProductionUrl) {
  console.log('SEO: SITE_URL ainda não é um domínio HTTPS; sitemap e URLs absolutas serão gerados na publicação.');
  process.exit(0);
}

function businessSchema(base) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${base}/#negocio`,
    name: 'Fotografia Arnaut',
    description: 'Fotografia documental de casamentos, retratos, famílias e marcas por Beatriz Arnaut, em Pombal, Leiria e por todo o país.',
    url: `${base}/`,
    image: `${base}/assets/og-image.jpg`,
    logo: `${base}/assets/icons/icon-512.png`,
    email: 'fotografiaarnaut@gmail.com',
    founder: { '@type': 'Person', name: 'Beatriz Arnaut', jobTitle: 'Fotógrafa' },
    address: { '@type': 'PostalAddress', addressLocality: 'Pombal', addressRegion: 'Leiria', addressCountry: 'PT' },
    areaServed: ['Pombal', 'Leiria', 'Portugal'],
    sameAs: ['https://www.instagram.com/fotografiarnaut/'],
    makesOffer: [
      ['Fotografia de casamento', '/casamentos/'],
      ['Retratos e fotografia de família', '/retratos-familias/'],
      ['Fotografia para marcas e editoriais', '/marcas/'],
    ].map(([name, path]) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name, url: `${base}${path}` } })),
  };
}

const GENERATED = /\n?[ \t]*<(?:link rel="canonical"|meta property="og:url"|meta name="twitter:image")[^>]*>|\n?[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>/g;

async function injectSeo(page) {
  const html = await readFile(fileUrl(page.file), 'utf8');
  const start = html.indexOf('<!-- seo:start');
  const end = html.indexOf('<!-- seo:end -->');
  if (start < 0 || end < start) return false;
  const url = `${siteUrl}${page.path}`;
  let block = html.slice(start, end).replace(GENERATED, '');
  block = block.replace(/(<meta property="og:image" content=")\/?(?!https?:)([^"]+)"/, `$1${siteUrl}/$2"`);
  const image = block.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const additions = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    image ? `<meta name="twitter:image" content="${image}" />` : '',
    page.path === '/' ? `<script type="application/ld+json">${JSON.stringify(businessSchema(siteUrl))}</script>` : '',
  ].filter(Boolean).map((line) => `    ${line}\n`).join('');
  const next = `${html.slice(0, start)}${block.replace(/\s*$/, '\n')}${additions}    ${html.slice(end)}`;
  if (next !== html) await writeFile(fileUrl(page.file), next, 'utf8');
  return true;
}

const injected = [];
for (const page of PAGES) if (await injectSeo(page)) injected.push(page.path);

const lastmod = new Date().toISOString().slice(0, 10);
const urls = PAGES.map(({ path, priority }) => `  <url><loc>${siteUrl}${path}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin.html\nDisallow: /galeria.html\nDisallow: /supabase/\nSitemap: ${siteUrl}/sitemap.xml\n`;

await Promise.all([
  writeFile(fileUrl('sitemap.xml'), sitemap, 'utf8'),
  writeFile(fileUrl('robots.txt'), robots, 'utf8'),
]);
console.log(`SEO: sitemap, robots e metadados (${injected.join(', ')}) gerados para ${siteUrl}`);
