import { readFile, writeFile } from 'node:fs/promises';

const configSource = await readFile(new URL('../config.js', import.meta.url), 'utf8').catch(() => '');
const configured = configSource.match(/SITE_URL\s*:\s*['"]([^'"]+)['"]/)?.[1] || '';
const siteUrl = String(process.env.SITE_URL || configured).replace(/\/$/, '');
const isProductionUrl = /^https:\/\//i.test(siteUrl) && !/localhost|127\.0\.0\.1/i.test(siteUrl);

if (!isProductionUrl) {
  console.log('SEO: SITE_URL ainda não é um domínio HTTPS; sitemap será gerado na publicação.');
  process.exit(0);
}

const pages = [
  ['', '1.0'],
  ['/privacidade/', '0.4'],
  ['/termos/', '0.4'],
];
const lastmod = new Date().toISOString().slice(0, 10);
const urls = pages.map(([path, priority]) => `  <url><loc>${siteUrl}${path}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /galeria.html\nDisallow: /supabase/\nSitemap: ${siteUrl}/sitemap.xml\n`;

await Promise.all([
  writeFile(new URL('../sitemap.xml', import.meta.url), sitemap, 'utf8'),
  writeFile(new URL('../robots.txt', import.meta.url), robots, 'utf8'),
]);
console.log(`SEO: sitemap e robots gerados para ${siteUrl}`);
