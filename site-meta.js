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
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

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
  setMeta('og:url', canonicalUrl);
  const image = document.querySelector('meta[property="og:image"]')?.content;
  if (image && !/^https?:\/\//i.test(image)) setMeta('og:image', `${configuredBase}/${image.replace(/^\//, '')}`);

  if (document.body.dataset.page === 'home') {
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'Fotografia Arnaut',
      url: configuredBase,
      founder: { '@type': 'Person', name: 'Beatriz Arnaut', jobTitle: 'Fotógrafa' },
      areaServed: { '@type': 'AdministrativeArea', name: 'Pombal, Leiria' },
    });
    document.head.appendChild(schema);
  }
})();
