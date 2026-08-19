import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.ARNAUT_CONFIG || {};
const root = document.querySelector('[data-public-portfolio]');
const filtersRoot = document.querySelector('[data-public-portfolio-filters]');
const supabase = config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY
  ? createClient(String(config.SUPABASE_URL).replace(/\/$/, ''), config.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
let photos = [];
let categories = [];
let activeFilter = 'all';

const assetUrl = (photo) => photo.web_url || photo.legacy_public_url || '';

function renderFilters() {
  filtersRoot.replaceChildren();
  const entries = [{ slug: 'all', label: 'Todos', count: photos.length }, ...categories.map((category) => ({
    slug: category.slug, label: category.label, count: photos.filter((photo) => photo.portfolio_categories?.slug === category.slug).length,
  }))];
  entries.forEach((entry) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `filter${activeFilter === entry.slug ? ' is-active' : ''}`; button.dataset.filter = entry.slug;
    button.append(document.createTextNode(`${entry.label} `)); const count = document.createElement('sup'); count.textContent = String(entry.count).padStart(2, '0'); button.append(count);
    button.addEventListener('click', () => { activeFilter = entry.slug; renderPortfolio(); });
    filtersRoot.appendChild(button);
  });
}

function renderPortfolio() {
  renderFilters(); root.replaceChildren();
  const visible = activeFilter === 'all' ? photos : photos.filter((photo) => photo.portfolio_categories?.slug === activeFilter);
  root.classList.toggle('is-filtered', activeFilter !== 'all');
  visible.forEach((photo, index) => {
    const article = document.createElement('article'); article.className = 'project project--portfolio-card is-visible'; article.dataset.category = photo.portfolio_categories?.slug || '';
    const link = document.createElement('a'); link.className = 'project__image image-hover'; link.href = assetUrl(photo); link.dataset.imageLightbox = ''; link.dataset.lightboxGallery = 'portfolio'; link.dataset.lightboxStart = String(index); link.setAttribute('aria-label', photo.alt_text ? `Ampliar: ${photo.alt_text}` : 'Ampliar fotografia');
    const image = document.createElement('img'); image.src = assetUrl(photo); image.alt = photo.alt_text || ''; image.loading = index === 0 ? 'eager' : 'lazy'; image.decoding = 'async';
    if (photo.thumbnail_url && photo.web_url) {
      image.srcset = `${photo.thumbnail_url} 500w, ${photo.web_url} 2200w`;
      image.sizes = '(max-width: 640px) 92vw, (max-width: 1100px) 44vw, 28vw';
    }
    if (index === 0) image.fetchPriority = 'high';
    if (photo.width && photo.height) { image.width = photo.width; image.height = photo.height; }
    link.appendChild(image); article.appendChild(link); root.appendChild(article);
  });
  root.ariaBusy = 'false'; window.dispatchEvent(new CustomEvent('portfolio:rendered', { detail: { photos: visible } }));
}

async function loadPortfolio() {
  if (!root || !filtersRoot || !supabase) return;
  try {
    const [{ data: settings }, { data: categoryData, error: categoryError }] = await Promise.all([
      supabase.from('portfolio_settings').select('max_recent').eq('id', true).maybeSingle(),
      supabase.from('portfolio_categories').select('id,slug,label,sort_order').eq('enabled', true).order('sort_order'),
    ]);
    if (categoryError) throw categoryError;
    const limit = Math.min(24, Math.max(1, Number(settings?.max_recent || 8)));
    let { data, error } = await supabase.from('portfolio_photos')
      .select('id,web_path,thumbnail_path,legacy_public_url,alt_text,focal_x,focal_y,width,height,sort_order,is_featured,portfolio_categories(slug,label)')
      .eq('is_published', true).order('is_featured', { ascending: false }).order('sort_order', { ascending: true }).limit(limit);
    if (error?.code === '42703' || /is_featured/i.test(String(error?.message || ''))) {
      ({ data, error } = await supabase.from('portfolio_photos')
        .select('id,web_path,thumbnail_path,legacy_public_url,alt_text,focal_x,focal_y,width,height,sort_order,portfolio_categories(slug,label)')
        .eq('is_published', true).order('sort_order', { ascending: true }).limit(limit));
    }
    if (error) throw error;
    photos = data || [];
    const stored = photos.filter((photo) => photo.web_path);
    if (stored.length) {
      const paths = [...new Set(stored.flatMap((photo) => [photo.thumbnail_path, photo.web_path]).filter(Boolean))];
      const { data: signed, error: signedError } = await supabase.storage.from('public-portfolio').createSignedUrls(paths, 60 * 60);
      if (signedError) throw signedError;
      const signedByPath = new Map((signed || []).map((item) => [item.path, item.signedUrl]));
      photos = photos.map((photo) => ({
        ...photo,
        thumbnail_url: signedByPath.get(photo.thumbnail_path) || signedByPath.get(photo.web_path) || '',
        web_url: signedByPath.get(photo.web_path) || '',
      }));
    }
    categories = categoryData || []; renderPortfolio();
  } catch (error) {
    console.error('Não foi possível carregar Trabalho recente.', error);
    root.ariaBusy = 'false'; root.innerHTML = '<p class="portfolio-public-error">Não foi possível carregar esta seleção.</p>';
    filtersRoot.innerHTML = '<button class="filter" type="button" data-retry-portfolio>Tentar novamente</button>';
    filtersRoot.querySelector('button').addEventListener('click', loadPortfolio);
  }
}

loadPortfolio();
