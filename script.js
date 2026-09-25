const introKey = 'arnaut_intro_seen';
const skipIntro = document.documentElement.classList.contains('skip-intro');

const currentYear = document.querySelector('[data-current-year]');
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const loader = document.querySelector('.loader');
const loaderCount = document.querySelector('.loader__count');
const loaderLine = document.querySelector('.loader__line span');
const heroImage = document.querySelector('.hero__image-wrap img');
let progress = 0;
let loadingTimer = 0;
let loadingFinished = false;

const markReady = () => {
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
};

const finishLoading = () => {
  if (loadingFinished) return;
  loadingFinished = true;
  window.clearInterval(loadingTimer);
  progress = 100;
  loaderCount.textContent = '100';
  loaderLine.style.width = '100%';
  try { sessionStorage.setItem(introKey, '1'); } catch { /* Sem storage, a intro volta a aparecer. */ }
  window.setTimeout(() => {
    loader.classList.add('is-done');
    markReady();
  }, 250);
};

if (skipIntro) {
  // Visitas seguintes na mesma sessão (ou movimento reduzido): sem intro, mas com a entrada do título.
  loader.classList.add('is-done');
  requestAnimationFrame(() => requestAnimationFrame(markReady));
} else {
  document.body.classList.add('is-loading');
  const introStartedAt = performance.now();
  const wait = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });
  const heroLoaded = !heroImage || heroImage.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
      heroImage.addEventListener('load', resolve, { once: true });
      heroImage.addEventListener('error', resolve, { once: true });
    });
  const fontsLoaded = document.fonts?.ready || Promise.resolve();

  loadingTimer = window.setInterval(() => {
    progress += Math.max(1, Math.round((92 - progress) * 0.1));
    progress = Math.min(progress, 92);
    loaderCount.textContent = String(progress).padStart(2, '0');
    loaderLine.style.width = `${progress}%`;
  }, 45);

  // Termina quando a imagem principal e os tipos de letra estão prontos (mínimo 0,9 s, máximo 1,8 s),
  // em vez de esperar por todos os recursos da página.
  Promise.race([Promise.all([heroLoaded, fontsLoaded]), wait(1800)])
    .then(() => wait(Math.max(0, 900 - (performance.now() - introStartedAt))))
    .then(finishLoading);
}

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
const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
const bindCursorTargets = () => {
  if (!hasFinePointer || !cursor) return;
  document.querySelectorAll('.image-hover:not([data-cursor-bound])').forEach((element) => {
    element.dataset.cursorBound = 'true';
    element.addEventListener('pointerenter', () => cursor.classList.add('is-view'));
    element.addEventListener('pointerleave', () => cursor.classList.remove('is-view'));
  });
};
if (hasFinePointer && cursor) {
  window.addEventListener('pointermove', (event) => {
    cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
  }, { passive: true });
  bindCursorTargets();
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
const lightboxGalleries = {
  // Série de Sintra aberta pela imagem principal (data-lightbox-gallery="sintra").
  sintra: [
    ['sintra-01', 'Fachada histórica enquadrada por árvores em Sintra'],
    ['sintra-02', 'Arquitetura histórica e árvores em Sintra'],
    ['sintra-03', 'Detalhe de arcos neomanuelinos em Sintra'],
    ['sintra-04', 'Varanda neomanuelina em pedra rendilhada entre folhas de outono, em Sintra'],
  ].map(([name, alt]) => ({
    src: `assets/portfolio/${name}.webp`,
    thumbSrc: `assets/portfolio/w800/${name}.webp`,
    alt,
  })),
};
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

  activeLightboxItems = gallery?.length ? gallery : (sourceImage
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
    src: photo.web_url || photo.legacy_public_url || photo.image_url || photo.url || '',
    thumbSrc: photo.thumbnail_url || photo.thumb_url || '',
    alt: photo.alt_text || 'Fotografia do portefólio',
  })).filter((item) => item.src);
  projectImageTriggers = document.querySelectorAll('[data-image-lightbox]');
  projectImageTriggers.forEach((trigger) => { if (!trigger.dataset.lightboxGallery) trigger.dataset.lightboxGallery = 'portfolio'; });
  bindCursorTargets();
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

const faqButtons = [...document.querySelectorAll('[data-faq-list] button[aria-controls]')];

const setFaqItemState = (button, open) => {
  const answer = document.getElementById(button.getAttribute('aria-controls'));
  const item = button.closest('article');
  button.setAttribute('aria-expanded', String(open));
  answer?.setAttribute('aria-hidden', String(!open));
  item?.classList.toggle('is-open', open);
};

faqButtons.forEach((button) => {
  setFaqItemState(button, false);
  button.addEventListener('click', () => {
    const willOpen = button.getAttribute('aria-expanded') !== 'true';
    faqButtons.forEach((item) => setFaqItemState(item, item === button && willOpen));
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

const contactConfig = window.ARNAUT_CONFIG || {};
const contactFunctionsBase = (() => {
  const url = String(contactConfig.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  return url ? `${url}/functions/v1` : '';
})();

const setContactStatus = (text, type) => {
  if (!contactStatus) return;
  contactStatus.textContent = text;
  contactStatus.dataset.type = type;
};

// Recurso: abre o programa de email com o pedido preenchido.
const openContactEmailDraft = (values) => {
  const lines = [
    `Nome: ${values.name}`,
    `Email: ${values.email}`,
    values.phone ? `Telefone: ${values.phone}` : null,
    `Tipo de sessão: ${values.sessionType}`,
    values.preferredDate ? `Data pretendida: ${values.preferredDate}` : null,
    values.location ? `Local: ${values.location}` : null,
    '',
    values.message,
  ].filter((line) => line !== null);
  const subject = encodeURIComponent(`Pedido de informação — ${values.sessionType}`);
  const body = encodeURIComponent(lines.join('\n'));
  window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
};

const sendContactRequest = async (values) => {
  if (!contactFunctionsBase || !contactConfig.SUPABASE_PUBLISHABLE_KEY) {
    throw Object.assign(new Error('Envio direto indisponível.'), { fallback: true });
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${contactFunctionsBase}/contact-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: contactConfig.SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({
        name: values.name,
        email: values.email,
        phone: values.phone,
        sessionType: values.sessionType,
        preferredDate: values.preferredDate,
        location: values.location,
        message: values.message,
        website: values.website,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // 400 e 429 têm mensagens úteis para o visitante; os restantes erros usam o email como recurso.
      throw Object.assign(new Error(data.error || 'Não foi possível enviar o pedido.'), {
        fallback: response.status !== 400 && response.status !== 429,
      });
    }
    return data;
  } catch (error) {
    if (error?.fallback === undefined) error.fallback = true;
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

publicContactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(publicContactForm);
  const values = Object.fromEntries(data.entries());
  if (String(values.website || '').trim()) return;
  ['name', 'email', 'phone', 'sessionType', 'preferredDate', 'location', 'message'].forEach((name) => contactError(name));
  const errors = validatePublicContact(values);
  Object.entries(errors).forEach(([name, text]) => contactError(name, text));
  if (Object.keys(errors).length) {
    setContactStatus('Revise os campos assinalados.', 'error');
    publicContactForm.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const submitButton = publicContactForm.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  setContactStatus('A enviar o pedido…', 'neutral');
  try {
    await sendContactRequest(values);
    publicContactForm.reset();
    setContactStatus('Pedido enviado. Obrigada! Responderei assim que possível.', 'success');
  } catch (error) {
    if (error.fallback) {
      setContactStatus('Não foi possível enviar diretamente. A abrir o seu programa de email para confirmar o envio.', 'success');
      openContactEmailDraft(values);
    } else {
      setContactStatus(error.message, 'error');
    }
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

const whatsappNumber = String(contactConfig.WHATSAPP_NUMBER || '').replace(/\D/g, '');
if (whatsappNumber) {
  document.querySelectorAll('[data-whatsapp-link]').forEach((link) => {
    link.href = `https://wa.me/${whatsappNumber}`;
    link.hidden = false;
  });
}

const contactSection = document.querySelector('.contact');
const contactBackdrop = document.querySelector('.contact__backdrop');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let contactTop = contactSection?.offsetTop || 0;
let parallaxFrame = 0;

// A posição da secção de contacto só muda quando o conteúdo acima muda de tamanho;
// medimo-la nesses momentos em vez de a ler em cada evento de scroll.
const measureContact = () => { contactTop = contactSection?.offsetTop || 0; };
if ('ResizeObserver' in window && contactSection) {
  new ResizeObserver(measureContact).observe(contactSection.parentElement || document.body);
}
window.addEventListener('resize', measureContact, { passive: true });
window.addEventListener('load', measureContact);

const updateParallax = () => {
  parallaxFrame = 0;
  const scroll = window.scrollY;
  if (heroImage && scroll < window.innerHeight * 1.2 && !reducedMotion.matches) {
    heroImage.style.transform = `scale(1) translateY(${scroll * 0.045}px)`;
  }
  if (contactBackdrop && scroll + window.innerHeight > contactTop) {
    contactBackdrop.style.transform = `scale(1.04) translateY(${(scroll - contactTop) * 0.025}px)`;
  }
};

window.addEventListener(
  'scroll',
  () => {
    if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(updateParallax);
  },
  { passive: true },
);
