// Recurso em tempo de execução para quando `npm run build` não correu com SITE_URL:
// completa canonical, og:url, og:image absoluta e dados estruturados da página inicial.
// Quando o build correu, as tags já existem no HTML e este script não as duplica.
(() => {
  const config = window.ARNAUT_CONFIG || {};
  const configuredBase = String(config.SITE_URL || '').trim().replace(/\/$/, '');
  const isUsableBase = /^https?:\/\//i.test(configuredBase) && !/localhost|127\.0\.0\.1/i.test(configuredBase);
  if (!isUsableBase) return;

  const canonicalUrl = `${configuredBase}${window.location.pathname === '/index.html' ? '/' : window.location.pathname}`;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = canonicalUrl;
    document.head.appendChild(canonical);
  }

  const setMeta = (property, content) => {
    const selector = property.startsWith('og:') ? `meta[property="${property}"]` : `meta[name="${property}"]`;
    let meta = document.querySelector(selector);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(property.startsWith('og:') ? 'property' : 'name', property);
      document.head.appendChild(meta);
    }
    meta.content = content;
  };
  if (!document.querySelector('meta[property="og:url"]')) setMeta('og:url', canonical.href);
  const image = document.querySelector('meta[property="og:image"]')?.content;
  if (image && !/^https?:\/\//i.test(image)) {
    const absolute = `${configuredBase}/${image.replace(/^\//, '')}`;
    setMeta('og:image', absolute);
    setMeta('twitter:image', absolute);
  }

  if (document.body.dataset.page === 'home' && !document.querySelector('script[type="application/ld+json"]')) {
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'Fotografia Arnaut',
      url: `${configuredBase}/`,
      image: `${configuredBase}/assets/og-image.jpg`,
      email: 'fotografiaarnaut@gmail.com',
      founder: { '@type': 'Person', name: 'Beatriz Arnaut', jobTitle: 'Fotógrafa' },
      address: { '@type': 'PostalAddress', addressLocality: 'Pombal', addressRegion: 'Leiria', addressCountry: 'PT' },
      areaServed: ['Pombal', 'Leiria', 'Portugal'],
      sameAs: ['https://www.instagram.com/fotografiarnaut/'],
    });
    document.head.appendChild(schema);
  }
})();
