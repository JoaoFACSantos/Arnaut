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
const lightboxThumbs = portraitLightbox?.querySelector('[data-lightbox-thumbs]');
let projectImageTriggers = document.querySelectorAll('[data-image-lightbox]');
const lightboxGalleries = {};
let activeLightboxTrigger = portraitTrigger;
let activeLightboxItems = [];
let activeLightboxIndex = 0;
let lightboxTouchStartX = 0;

const renderLightboxThumbs = () => {
  if (!lightboxThumbs) return;
  lightboxThumbs.replaceChildren();
  lightboxThumbs.hidden = activeLightboxItems.length < 2;
  if (activeLightboxItems.length < 2) return;
  const radius = window.matchMedia('(max-width: 700px)').matches ? 2 : 4;
  const indices = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    const index = (activeLightboxIndex + offset + activeLightboxItems.length) % activeLightboxItems.length;
    if (!indices.includes(index)) indices.push(index);
  }
  indices.forEach((index) => {
    const item = activeLightboxItems[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', `Ver fotografia ${index + 1}`);
    button.setAttribute('aria-current', index === activeLightboxIndex ? 'true' : 'false');
    const image = document.createElement('img');
    image.src = item.thumbSrc || item.src;
    image.alt = '';
    image.loading = 'lazy';
    button.appendChild(image);
    button.addEventListener('click', () => { activeLightboxIndex = index; renderLightboxItem(); });
    lightboxThumbs.appendChild(button);
  });
};

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
  renderLightboxThumbs();
  if (hasSeveralImages) {
    [-1, 1].forEach((offset) => {
      const neighbour = activeLightboxItems[(activeLightboxIndex + offset + activeLightboxItems.length) % activeLightboxItems.length];
      if (neighbour?.src) new Image().src = neighbour.src;
    });
  }
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
const bindProjectLightboxes = () => document.querySelectorAll('[data-image-lightbox]:not([data-lightbox-bound])').forEach((trigger) => {
  trigger.dataset.lightboxBound = 'true';
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
bindProjectLightboxes();
window.addEventListener('portfolio:rendered', (event) => {
  const renderedPhotos = event.detail?.photos || [];
  lightboxGalleries.portfolio = renderedPhotos.map((photo) => ({
    src: photo.web_url || photo.image_url || photo.url || '',
    thumbSrc: photo.thumbnail_url || photo.thumb_url || '',
    alt: photo.alt_text || 'Fotografia do portefólio',
  })).filter((item) => item.src);
  projectImageTriggers = document.querySelectorAll('[data-image-lightbox]');
  projectImageTriggers.forEach((trigger) => { if (!trigger.dataset.lightboxGallery) trigger.dataset.lightboxGallery = 'portfolio'; });
  document.querySelectorAll('.image-hover').forEach((element) => {
    element.addEventListener('pointerenter', () => cursor.classList.add('is-view'));
    element.addEventListener('pointerleave', () => cursor.classList.remove('is-view'));
  });
  bindProjectLightboxes();
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
portraitLightbox?.addEventListener('touchstart', (event) => {
  lightboxTouchStartX = event.changedTouches[0]?.clientX || 0;
}, { passive: true });
portraitLightbox?.addEventListener('touchend', (event) => {
  const distance = (event.changedTouches[0]?.clientX || 0) - lightboxTouchStartX;
  if (Math.abs(distance) >= 54) moveLightbox(distance > 0 ? -1 : 1);
}, { passive: true });
portraitLightbox?.addEventListener('close', () => {
  document.body.classList.remove('portrait-lightbox-open');
  activeLightboxTrigger?.focus({ preventScroll: true });
});

document.querySelectorAll('[data-faq-list] button[aria-controls]').forEach((button) => {
  button.addEventListener('click', () => {
    const answer = document.getElementById(button.getAttribute('aria-controls'));
    const willOpen = button.getAttribute('aria-expanded') !== 'true';
    document.querySelectorAll('[data-faq-list] button[aria-controls]').forEach((item) => {
      item.setAttribute('aria-expanded', 'false');
      const itemAnswer = document.getElementById(item.getAttribute('aria-controls'));
      if (itemAnswer) itemAnswer.hidden = true;
    });
    button.setAttribute('aria-expanded', String(willOpen));
    if (answer) answer.hidden = !willOpen;
  });
});

const publicContactForm = document.querySelector('[data-contact-form]');
const contactStatus = publicContactForm?.querySelector('[data-contact-status]');
const contactEmail = 'fotografiaarnaut@gmail.com';

const contactError = (name, text = '') => {
  const field = publicContactForm?.elements[name];
  const output = publicContactForm?.querySelector(`[data-error-for="${name}"]`);
  if (field) field.setAttribute('aria-invalid', String(Boolean(text)));
  if (output) output.textContent = text;
};

const validatePublicContact = (values) => {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Indique o seu nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Indique um email válido.';
  if (!values.sessionType) errors.sessionType = 'Selecione o tipo de sessão.';
  if (values.message.trim().length < 10) errors.message = 'Escreva uma mensagem com pelo menos 10 caracteres.';
  if (values.preferredDate) {
    const chosen = new Date(`${values.preferredDate}T12:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (chosen < today) errors.preferredDate = 'Escolha uma data futura.';
  }
  return errors;
};

publicContactForm?.addEventListener('input', (event) => {
  if (event.target?.name) contactError(event.target.name);
  if (contactStatus) contactStatus.textContent = '';
});

publicContactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(publicContactForm);
  const values = Object.fromEntries(data.entries());
  if (String(values.website || '').trim()) return;
  ['name', 'email', 'phone', 'sessionType', 'preferredDate', 'location', 'message'].forEach((name) => contactError(name));
  const errors = validatePublicContact(values);
  Object.entries(errors).forEach(([name, text]) => contactError(name, text));
  if (Object.keys(errors).length) {
    contactStatus.textContent = 'Revise os campos assinalados.';
    contactStatus.dataset.type = 'error';
    publicContactForm.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const lines = [
    `Nome: ${values.name}`,
    `Email: ${values.email}`,
    values.phone ? `Telefone: ${values.phone}` : '',
    `Tipo de sessão: ${values.sessionType}`,
    values.preferredDate ? `Data pretendida: ${values.preferredDate}` : '',
    values.location ? `Local: ${values.location}` : '',
    '',
    values.message,
  ].filter((line) => line !== '');
  contactStatus.textContent = 'A abrir o seu programa de email para confirmar o envio.';
  contactStatus.dataset.type = 'success';
  const subject = encodeURIComponent(`Pedido de informação — ${values.sessionType}`);
  const body = encodeURIComponent(lines.join('\n'));
  window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
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
