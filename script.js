document.body.classList.add('is-loading');

const currentYear = document.querySelector('[data-current-year]');
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const loader = document.querySelector('.loader');
const loaderCount = document.querySelector('.loader__count');
const loaderLine = document.querySelector('.loader__line span');
let progress = 0;

const finishLoading = () => {
  progress = 100;
  loaderCount.textContent = '100';
  loaderLine.style.width = '100%';
  window.setTimeout(() => {
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
  }, 250);
};

const loadingTimer = window.setInterval(() => {
  progress += Math.max(1, Math.round((92 - progress) * 0.08));
  progress = Math.min(progress, 92);
  loaderCount.textContent = String(progress).padStart(2, '0');
  loaderLine.style.width = `${progress}%`;
}, 45);

window.addEventListener('load', () => {
  window.clearInterval(loadingTimer);
  finishLoading();
});

window.setTimeout(() => {
  if (!document.body.classList.contains('is-ready')) {
    window.clearInterval(loadingTimer);
    finishLoading();
  }
}, 2200);

const header = document.querySelector('[data-header]');
const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 50);
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');

const closeMenu = () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  mobileMenu.setAttribute('aria-hidden', 'true');
  mobileMenu.classList.remove('is-open');
  document.body.classList.remove('menu-open');
};

menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!open));
  mobileMenu.setAttribute('aria-hidden', String(open));
  mobileMenu.classList.toggle('is-open', !open);
  document.body.classList.toggle('menu-open', !open);
});

mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
);

document.querySelectorAll('.reveal, .reveal-text').forEach((element) => revealObserver.observe(element));

const filterButtons = document.querySelectorAll('.filter');
const projects = document.querySelectorAll('.project');

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle('is-active', item === button));
    document.querySelector('.projects').classList.toggle('is-filtered', filter !== 'all');

    projects.forEach((project) => {
      const visible = filter === 'all' || project.dataset.category === filter;
      project.classList.toggle('is-hidden', !visible);
    });
  });
});

document.querySelectorAll('.service button').forEach((button) => {
  button.addEventListener('click', () => {
    const service = button.closest('.service');
    const wasOpen = service.classList.contains('is-open');

    document.querySelectorAll('.service').forEach((item) => {
      item.classList.remove('is-open');
      item.querySelector('button').setAttribute('aria-expanded', 'false');
      item.querySelector('.service__toggle').textContent = '+';
    });

    if (!wasOpen) {
      service.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      service.querySelector('.service__toggle').textContent = '−';
    }
  });
});

const cursor = document.querySelector('.cursor');
if (window.matchMedia('(pointer: fine)').matches) {
  window.addEventListener('pointermove', (event) => {
    cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
  });

  document.querySelectorAll('.image-hover').forEach((element) => {
    element.addEventListener('pointerenter', () => cursor.classList.add('is-view'));
    element.addEventListener('pointerleave', () => cursor.classList.remove('is-view'));
  });
}

const portraitTrigger = document.querySelector('[data-portrait-open]');
const portraitLightbox = document.querySelector('[data-portrait-lightbox]');
const portraitClose = document.querySelector('[data-portrait-close]');
const lightboxImage = portraitLightbox?.querySelector('[data-lightbox-image]');
const lightboxCounter = portraitLightbox?.querySelector('[data-lightbox-counter]');
const lightboxPrevious = portraitLightbox?.querySelector('[data-lightbox-prev]');
const lightboxNext = portraitLightbox?.querySelector('[data-lightbox-next]');
const projectImageTriggers = document.querySelectorAll('[data-image-lightbox]');
const lightboxGalleries = {
  casal: [
    { src: 'assets/portfolio/casal-01.webp', alt: 'Casal a sorrir junto a uma parede de pedra' },
    { src: 'assets/portfolio/casal-02.webp', alt: 'Retrato de homem num jardim' },
    { src: 'assets/portfolio/casal-03.webp', alt: 'Casal abraçado num jardim' },
    { src: 'assets/portfolio/casal-04.webp', alt: 'Retrato de mulher num jardim' },
    { src: 'assets/portfolio/casal-05.webp', alt: 'Casal junto a uma árvore num jardim' },
  ],
  sintra: [
    { src: 'assets/portfolio/sintra-01.webp', alt: 'Fachada histórica enquadrada por árvores em Sintra' },
    { src: 'assets/portfolio/sintra-02.webp', alt: 'Arquitetura histórica e árvores em Sintra' },
    { src: 'assets/portfolio/sintra-03.webp', alt: 'Detalhe de arcos neomanuelinos em Sintra' },
    { src: 'assets/portfolio/sintra-04.webp', alt: 'Pórtico histórico coberto por vegetação em Sintra' },
  ],
  nazare: [
    { src: 'assets/portfolio/nazare-01.webp', alt: 'Retrato de mulher na praia ao fim da tarde' },
    { src: 'assets/portfolio/nazare-02.webp', alt: 'Retrato de mulher na Nazaré com papagaios no céu' },
    { src: 'assets/portfolio/nazare-03.webp', alt: 'Vista da praia da Nazaré com papagaios no céu' },
    { src: 'assets/portfolio/nazare-04.webp', alt: 'Casal sentado na praia sob papagaios coloridos' },
    { src: 'assets/portfolio/nazare-05.webp', alt: 'Casa histórica junto à costa da Nazaré' },
  ],
};
let activeLightboxTrigger = portraitTrigger;
let activeLightboxItems = [];
let activeLightboxIndex = 0;

const renderLightboxItem = () => {
  const item = activeLightboxItems[activeLightboxIndex];
  if (!item || !lightboxImage) return;

  lightboxImage.src = item.src;
  lightboxImage.alt = item.alt || 'Fotografia ampliada';
  if (lightboxCounter) {
    lightboxCounter.textContent = activeLightboxItems.length > 1
      ? `${activeLightboxIndex + 1} / ${activeLightboxItems.length}`
      : '';
  }

  const hasSeveralImages = activeLightboxItems.length > 1;
  if (lightboxPrevious) lightboxPrevious.hidden = !hasSeveralImages;
  if (lightboxNext) lightboxNext.hidden = !hasSeveralImages;
};

const openPortraitLightbox = (trigger = portraitTrigger) => {
  if (!portraitLightbox || portraitLightbox.open || !trigger) return;

  const sourceImage = trigger.querySelector('img');
  const gallery = lightboxGalleries[trigger.dataset.lightboxGallery];

  activeLightboxItems = gallery || (sourceImage
    ? [{ src: sourceImage.currentSrc || sourceImage.src, alt: sourceImage.alt }]
    : []);
  activeLightboxIndex = Math.min(
    Math.max(Number.parseInt(trigger.dataset.lightboxStart || '0', 10) || 0, 0),
    Math.max(activeLightboxItems.length - 1, 0),
  );
  activeLightboxTrigger = trigger;
  renderLightboxItem();
  cursor?.classList.remove('is-view');
  document.body.classList.add('portrait-lightbox-open');
  portraitLightbox.showModal();
  portraitClose?.focus({ preventScroll: true });
};

const moveLightbox = (direction) => {
  if (activeLightboxItems.length < 2) return;
  activeLightboxIndex = (activeLightboxIndex + direction + activeLightboxItems.length) % activeLightboxItems.length;
  renderLightboxItem();
};

const closePortraitLightbox = () => {
  if (portraitLightbox?.open) portraitLightbox.close();
};

portraitTrigger?.addEventListener('click', () => openPortraitLightbox(portraitTrigger));
portraitTrigger?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openPortraitLightbox(portraitTrigger);
  }
});
projectImageTriggers.forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openPortraitLightbox(trigger);
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPortraitLightbox(trigger);
    }
  });
});
lightboxPrevious?.addEventListener('click', () => moveLightbox(-1));
lightboxNext?.addEventListener('click', () => moveLightbox(1));
portraitClose?.addEventListener('click', closePortraitLightbox);
portraitLightbox?.addEventListener('click', (event) => {
  if (event.target === portraitLightbox) closePortraitLightbox();
});
portraitLightbox?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') moveLightbox(-1);
  if (event.key === 'ArrowRight') moveLightbox(1);
});
portraitLightbox?.addEventListener('close', () => {
  document.body.classList.remove('portrait-lightbox-open');
  activeLightboxTrigger?.focus({ preventScroll: true });
});

const heroImage = document.querySelector('.hero__image-wrap img');
const contactBackdrop = document.querySelector('.contact__backdrop');

window.addEventListener(
  'scroll',
  () => {
    const scroll = window.scrollY;
    if (scroll < window.innerHeight * 1.2 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      heroImage.style.transform = `scale(1) translateY(${scroll * 0.045}px)`;
    }

    const contactTop = document.querySelector('.contact').offsetTop;
    if (scroll + window.innerHeight > contactTop) {
      contactBackdrop.style.transform = `scale(1.04) translateY(${(scroll - contactTop) * 0.025}px)`;
    }
  },
  { passive: true },
);
