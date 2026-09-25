// "Trabalho recente": lê as fotografias publicadas diretamente da API REST do Supabase
// (sem carregar a biblioteca supabase-js completa na página inicial).
const config = window.ARNAUT_CONFIG || {};
const root = document.querySelector('[data-public-portfolio]');
const filtersRoot = document.querySelector('[data-public-portfolio-filters]');
const supabaseUrl = String(config.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const apiKey = config.SUPABASE_PUBLISHABLE_KEY || '';
const SIGNED_URL_SECONDS = 60 * 60;
const SIGNED_URL_REUSE_MARGIN_MS = 10 * 60 * 1000;
const SIGNED_CACHE_KEY = 'arnaut_portfolio_signed_v1';
const LEGACY_ASSET = /^assets\/portfolio\/([a-z0-9-]+)\.webp$/;
let photos = [];
let categories = [];
let activeFilter = 'all';

const authHeaders = () => ({ apikey: apiKey, Authorization: `Bearer ${apiKey}` });
// Sem resposta do Supabase em 8 s, mostra as fotografias do site em vez de ficar em "A carregar…".
const requestSignal = () => (typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined);

async function restSelect(table, params) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${new URLSearchParams(params)}`, {
    headers: { ...authHeaders(), Accept: 'application/json' },
    signal: requestSignal(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Pedido ao portefólio falhou (${response.status}).`);
    error.code = data?.code || '';
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

// As ligações assinadas são reaproveitadas enquanto forem válidas, para que o navegador
// consiga usar as imagens que já tem em cache nas visitas seguintes.
function readSignedCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SIGNED_CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSignedCache(cache) {
  try { localStorage.setItem(SIGNED_CACHE_KEY, JSON.stringify(cache)); } catch { /* Sem storage: assina de novo na próxima visita. */ }
}

async function signPortfolioPaths(paths) {
  const now = Date.now();
  const cache = readSignedCache();
  Object.keys(cache).forEach((path) => { if (!Array.isArray(cache[path]) || cache[path][1] - now < SIGNED_URL_REUSE_MARGIN_MS) delete cache[path]; });
  const missing = paths.filter((path) => !cache[path]);
  if (missing.length) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/public-portfolio`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS, paths: missing }),
      signal: requestSignal(),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data)) throw new Error(data?.message || 'Não foi possível preparar as imagens do portefólio.');
    const expiresAt = now + SIGNED_URL_SECONDS * 1000;
    data.forEach((item) => {
      if (item?.path && item.signedURL && !item.error) cache[item.path] = [encodeURI(`${supabaseUrl}/storage/v1${item.signedURL}`), expiresAt];
    });
    writeSignedCache(cache);
  }
  return new Map(paths.filter((path) => cache[path]).map((path) => [path, cache[path][0]]));
}

const assetUrl = (photo) => photo.web_url || photo.legacy_public_url || '';

function legacyVariant(url) {
  const match = LEGACY_ASSET.exec(String(url || ''));
  return match ? `assets/portfolio/w800/${match[1]}.webp` : '';
}

function renderFilters() {
  filtersRoot.replaceChildren();
  const allCount = photos.filter((photo) => photo.show_in_all).length;
  const entries = [{ slug: 'all', label: 'Todos', count: allCount }, ...categories.map((category) => ({
    slug: category.slug,
    label: category.label,
    count: photos.filter((photo) => photo.show_in_category && photo.portfolio_categories?.slug === category.slug).length,
  })).filter((entry) => entry.count > 0)];
  if (!entries.some((entry) => entry.slug === activeFilter)) activeFilter = 'all';
  entries.forEach((entry) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `filter${activeFilter === entry.slug ? ' is-active' : ''}`; button.dataset.filter = entry.slug;
    button.setAttribute('aria-pressed', String(activeFilter === entry.slug));
    button.append(document.createTextNode(`${entry.label} `)); const count = document.createElement('sup'); count.textContent = String(entry.count).padStart(2, '0'); button.append(count);
    button.addEventListener('click', () => { activeFilter = entry.slug; renderPortfolio(); });
    filtersRoot.appendChild(button);
  });
}

function renderPortfolio() {
  renderFilters(); root.replaceChildren();
  const visible = activeFilter === 'all'
    ? photos.filter((photo) => photo.show_in_all).sort((a, b) => (a.all_sort_order ?? 9999) - (b.all_sort_order ?? 9999))
    : photos.filter((photo) => photo.show_in_category && photo.portfolio_categories?.slug === activeFilter)
      .sort((a, b) => (a.category_sort_order ?? 9999) - (b.category_sort_order ?? 9999));
  root.classList.toggle('is-filtered', activeFilter !== 'all');
  visible.forEach((photo, index) => {
    const article = document.createElement('article'); article.className = 'project project--portfolio-card is-visible'; article.dataset.category = photo.portfolio_categories?.slug || '';
    const link = document.createElement('a'); link.className = 'project__image image-hover'; link.href = assetUrl(photo); link.dataset.imageLightbox = ''; link.dataset.lightboxGallery = 'portfolio'; link.dataset.lightboxStart = String(index); link.setAttribute('aria-label', photo.alt_text ? `Ampliar: ${photo.alt_text}` : 'Ampliar fotografia');
    const image = document.createElement('img'); image.src = assetUrl(photo); image.alt = photo.alt_text || ''; image.loading = index === 0 ? 'eager' : 'lazy'; image.decoding = 'async';
    const sizes = '(max-width: 640px) 92vw, (max-width: 1100px) 44vw, 28vw';
    if (photo.thumbnail_url && photo.web_url) {
      image.srcset = `${photo.thumbnail_url} 500w, ${photo.web_url} 2200w`;
      image.sizes = sizes;
    } else if (photo.legacy_thumbnail_url && photo.width) {
      image.src = photo.legacy_thumbnail_url;
      image.srcset = `${photo.legacy_thumbnail_url} 800w, ${photo.legacy_public_url} ${photo.width}w`;
      image.sizes = sizes;
    }
    if (index === 0) image.fetchPriority = 'high';
    if (photo.width && photo.height) { image.width = photo.width; image.height = photo.height; }
    link.appendChild(image); article.appendChild(link); root.appendChild(article);
  });
  root.ariaBusy = 'false'; window.dispatchEvent(new CustomEvent('portfolio:rendered', { detail: { photos: visible } }));
}

async function loadPortfolioRows() {
  try {
    return await restSelect('portfolio_photos', {
      select: 'id,web_path,thumbnail_path,legacy_public_url,alt_text,focal_x,focal_y,width,height,show_in_all,all_sort_order,show_in_category,category_sort_order,portfolio_categories(slug,label)',
      is_published: 'eq.true',
      or: '(show_in_all.eq.true,show_in_category.eq.true)',
    });
  } catch (error) {
    // Base de dados anterior à curadoria por secções: usa a ordem antiga.
    if (error.code !== '42703' && !/show_in_all|show_in_category/i.test(String(error.message || ''))) throw error;
    const rows = await restSelect('portfolio_photos', {
      select: 'id,web_path,thumbnail_path,legacy_public_url,alt_text,focal_x,focal_y,width,height,sort_order,portfolio_categories(slug,label)',
      is_published: 'eq.true',
      order: 'sort_order.asc',
      limit: '8',
    });
    return rows.map((photo, index) => ({
      ...photo, show_in_all: true, all_sort_order: (index + 1) * 10,
      show_in_category: true, category_sort_order: (index + 1) * 10,
    }));
  }
}

// Seleção estática do <noscript> (as mesmas 8 fotografias em assets/portfolio), usada quando o
// Supabase não está configurado (ex.: servidor local sem config.js), não responde ou não tem fotografias.
function staticPortfolio() {
  const fallback = root.parentElement?.querySelector('noscript');
  const markup = document.createElement('template');
  markup.innerHTML = fallback?.textContent || '';
  return [...markup.content.querySelectorAll('.project__image')].map((link, index) => {
    const image = link.querySelector('img');
    return {
      id: `static-${index}`,
      legacy_public_url: link.getAttribute('href'),
      legacy_thumbnail_url: image?.getAttribute('src') || '',
      alt_text: image?.getAttribute('alt') || '',
      width: Number(image?.getAttribute('width')) || 0,
      height: Number(image?.getAttribute('height')) || 0,
      show_in_all: true,
      all_sort_order: index,
    };
  });
}

function renderStaticPortfolio() {
  photos = staticPortfolio(); categories = []; activeFilter = 'all';
  renderPortfolio();
}

async function loadPortfolio() {
  if (!root || !filtersRoot) return;
  if (!supabaseUrl || !apiKey) { renderStaticPortfolio(); return; }
  try {
    const [categoryData, rows] = await Promise.all([
      restSelect('portfolio_categories', { select: 'id,slug,label,sort_order', enabled: 'eq.true', order: 'sort_order.asc' }),
      loadPortfolioRows(),
    ]);
    photos = rows.map((photo) => ({ ...photo, legacy_thumbnail_url: legacyVariant(photo.legacy_public_url) }));
    const stored = photos.filter((photo) => photo.web_path);
    if (stored.length) {
      const paths = [...new Set(stored.flatMap((photo) => [photo.thumbnail_path, photo.web_path]).filter(Boolean))];
      const signedByPath = await signPortfolioPaths(paths);
      photos = photos.map((photo) => ({
        ...photo,
        thumbnail_url: signedByPath.get(photo.thumbnail_path) || signedByPath.get(photo.web_path) || '',
        web_url: signedByPath.get(photo.web_path) || '',
      }));
    }
    photos = photos.map((photo) => (photo.web_url || !photo.legacy_thumbnail_url ? photo : { ...photo, thumbnail_url: photo.legacy_thumbnail_url }));
    if (!photos.some((photo) => photo.show_in_all)) { renderStaticPortfolio(); return; }
    categories = categoryData; renderPortfolio();
  } catch (error) {
    console.error('Não foi possível carregar Trabalho recente; a mostrar a seleção do site.', error);
    renderStaticPortfolio();
  }
}

loadPortfolio();
