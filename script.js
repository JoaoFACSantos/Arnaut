document.body.classList.add('is-loading');

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
