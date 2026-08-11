import { LEGAL_LAST_UPDATED, LEGAL_PAGES } from './legal-content.js';

function createSiteHeader() {
  return `
    <a class="skip-link" href="#conteudo-principal">Saltar para o conteúdo</a>
    <header class="site-header legal-site-header is-scrolled" data-header>
      <a class="brand" href="/index.html#inicio" aria-label="Fotografia Arnaut — início">
        <img class="brand__logo-img" src="/assets/logo-arnaut.png" alt="Fotografia Arnaut" />
      </a>
      <nav class="desktop-nav" aria-label="Navegação principal">
        <a href="/index.html#trabalho">Trabalho</a>
        <a href="/index.html#servicos">Serviços</a>
        <a href="/galeria.html">Galerias privadas</a>
        <a href="/index.html#contacto">Contacto</a>
      </nav>
      <a class="header-cta" href="https://www.instagram.com/fotografiarnaut/" target="_blank" rel="noopener noreferrer">Instagram <span>↗</span></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu">
        <span></span><span></span><span></span><span class="sr-only">Abrir menu</span>
      </button>
    </header>
    <div class="mobile-menu" id="mobile-menu" aria-hidden="true">
      <nav aria-label="Navegação móvel">
        <a href="/index.html#trabalho"><small>01</small> Trabalho</a>
        <a href="/index.html#servicos"><small>02</small> Serviços</a>
        <a href="/galeria.html"><small>03</small> Galerias privadas</a>
        <a href="/index.html#contacto"><small>04</small> Contacto</a>
        <a href="https://www.instagram.com/fotografiarnaut/" target="_blank" rel="noopener noreferrer"><small>05</small> Instagram</a>
      </nav>
      <div class="mobile-menu__meta">
        <p>Pombal, Leiria</p>
        <a href="mailto:fotografiaarnaut@gmail.com">fotografiaarnaut@gmail.com</a>
      </div>
    </div>
  `;
}

function createLegalHero(page) {
  return `
    <header class="legal-hero">
      <h1>${page.title}</h1>
      <p class="legal-hero__updated">Última atualização: <time datetime="${LEGAL_LAST_UPDATED.iso}">${LEGAL_LAST_UPDATED.label}</time></p>
      <div class="legal-hero__intro">
        <p>${page.intro}</p>
        <p>${page.closing}</p>
      </div>
    </header>
  `;
}

function createLegalSection(section, index) {
  return `
    <section class="legal-section" aria-labelledby="legal-section-${index + 1}">
      <h2 id="legal-section-${index + 1}">${index + 1}. ${section.title}</h2>
      <div class="legal-section__body">${section.html}</div>
    </section>
  `;
}

function createSiteFooter(activePage) {
  const active = (page) => (page === activePage ? ' class="is-active" aria-current="page"' : '');
  return `
    <footer class="footer">
      <a class="brand brand--footer" href="/index.html#inicio" aria-label="Fotografia Arnaut — início">
        <img class="brand__logo-img" src="/assets/logo-arnaut.png" alt="Fotografia Arnaut" />
      </a>
      <p class="footer__intro">Fotografia por Beatriz Arnaut<br />Pombal, Leiria<br /><em>Fotografias que ficam.</em></p>
      <div class="footer__links">
        <a href="https://www.instagram.com/fotografiarnaut/" target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true">↗</span></a>
        <a href="/index.html#inicio">Pinterest <span aria-hidden="true">↗</span></a>
        <a href="/galeria.html">Galerias privadas <span aria-hidden="true">↗</span></a>
        <a href="mailto:fotografiaarnaut@gmail.com">Email <span aria-hidden="true">↗</span></a>
      </div>
      <div class="footer__bottom">
        <span>© <span data-current-year></span> FOTOGRAFIA ARNAUT</span>
        <span>POMBAL · LEIRIA</span>
        <div class="footer__bottom-right">
          <a href="/privacidade/"${active('privacy')}>Privacidade</a><span aria-hidden="true">·</span>
          <a href="/termos/"${active('terms')}>Termos</a><span aria-hidden="true">·</span>
          <a href="#top">Voltar ao topo ↑</a>
        </div>
      </div>
    </footer>
  `;
}

function setupMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.mobile-menu');
  if (!toggle || !menu) return;

  const close = () => {
    toggle.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  };

  toggle.addEventListener('click', () => {
    const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(willOpen));
    menu.setAttribute('aria-hidden', String(!willOpen));
    menu.classList.toggle('is-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

function renderLegalPage() {
  const pageKey = document.body.dataset.legalPage;
  const page = LEGAL_PAGES[pageKey];
  if (!page) return;

  document.querySelector('[data-site-header]').innerHTML = createSiteHeader();
  document.querySelector('[data-legal-main]').innerHTML = `${createLegalHero(page)}<div class="legal-content">${page.sections.map(createLegalSection).join('')}</div>`;
  document.querySelector('[data-site-footer]').innerHTML = createSiteFooter(pageKey);
  document.querySelector('[data-current-year]').textContent = String(new Date().getFullYear());
  setupMobileMenu();
}

renderLegalPage();
