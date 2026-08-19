const config = window.ARNAUT_CONFIG || {};
const supabaseUrl = String(config.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const functionsBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : '';
const params = new URLSearchParams(window.location.search);
const initialPublicId = params.get('id') || '';
const initialOrderId = params.get('order') || '';
const suppliedReceiptToken = params.get('receipt_token') || '';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const loginView = $('[data-gallery-login]');
const galleryView = $('[data-gallery-view]');
const form = $('[data-gallery-form]');
const codeInput = $('[data-access-code]');
const message = $('[data-gallery-message]');
const statusLabel = $('[data-gallery-status]');
const title = $('[data-gallery-title]');
const meta = $('[data-gallery-meta]');
const eventBadge = $('[data-gallery-event-type]');
const grid = $('[data-gallery-grid]');
const notice = $('[data-gallery-notice]');
const noticeText = $('[data-gallery-notice-text]');
const galleryBody = $('[data-gallery-body]');
const gallerySidebar = $('[data-gallery-sidebar]');
const salesAvailability = $('[data-sales-availability]');
const gallerySupport = $('[data-gallery-support]');
const sortControl = $('[data-gallery-sort]');
const galleryWelcome = $('[data-gallery-welcome]');
const galleryWelcomeVisual = $('[data-gallery-welcome-visual]');
const galleryWelcomeCover = $('[data-gallery-welcome-cover]');
const galleryWelcomeTitle = $('[data-gallery-welcome-title]');
const galleryWelcomeDate = $('[data-gallery-welcome-date]');
const galleryWelcomeMessage = $('[data-gallery-welcome-message]');
const galleryWelcomeOpen = $('[data-gallery-welcome-open]');
const allCount = $('[data-all-count]');
const favoritesCount = $('[data-favorites-count]');
const headerFavoritesCount = $('[data-header-favorites-count]');
const headerCartCount = $('[data-header-cart-count]');
const openCartTop = $('[data-open-cart-top]');
const lightbox = $('[data-lightbox]');
const lightboxImage = $('[data-lightbox-image]');
const lightboxCounter = $('[data-lightbox-counter]');
const lightboxThumbs = $('[data-lightbox-thumbs]');
const lightboxDownload = $('[data-lightbox-download]');
const lightboxSelect = $('[data-lightbox-select]');
const lightboxFavorite = $('[data-lightbox-favorite]');
const lightboxShare = $('[data-lightbox-share]');
const lightboxFullscreen = $('[data-lightbox-fullscreen]');
const cartBar = $('[data-cart-bar]');
const cartCount = $('[data-cart-count]');
const cartTotal = $('[data-cart-total]');
const cartThumbs = $('[data-cart-thumbs]');
const cartDialog = $('[data-cart-dialog]');
const cartBackdrop = $('[data-cart-backdrop]');
const cartItems = $('[data-cart-items]');
const cartSubtotal = $('[data-cart-subtotal]');
const cartSubtotalLabel = $('[data-cart-subtotal-label]');
const cartDialogTotal = $('[data-cart-dialog-total]');
const cartTerms = $('[data-cart-terms]');
const cartPolicy = $('[data-cart-policy]');
const cartMessage = $('[data-cart-message]');
const checkoutButton = $('[data-checkout]');
const receiptView = $('[data-order-receipt]');
const orderTitle = $('[data-order-title]');
const orderMessage = $('[data-order-message]');
const orderSummary = $('[data-order-summary]');
const orderDownloads = $('[data-order-downloads]');
const orderStatusIcon = $('[data-order-status-icon]');
const galleryToast = $('[data-gallery-toast]');
const helpDialog = $('[data-help-dialog]');

let photos = [];
let album = null;
let galleryPublicId = '';
let galleryToken = '';
let activeIndex = 0;
let activeFilter = 'all';
let selected = new Set();
let favorites = new Set();
let receiptPollTimer = 0;
let lightboxOpener = null;
let lightboxTouchStartX = 0;
const mobileCartMedia = window.matchMedia('(max-width: 980px)');

const deviceKey = 'arnaut_gallery_device';
const sessionKey = (publicId) => `arnaut_gallery_session_${publicId}`;
const cartKey = (publicId) => `arnaut_gallery_cart_${publicId}`;
const favoritesKey = (publicId) => `arnaut_gallery_favorites_${publicId}`;
const receiptKey = (orderId) => `arnaut_order_receipt_${orderId}`;
const welcomeKey = (publicId) => `arnaut_gallery_welcome_${publicId}`;

function setText(element, value) {
  if (element) element.textContent = String(value ?? '');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function money(cents, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(Number(cents || 0) / 100);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function toast(text) {
  galleryToast.textContent = text;
  galleryToast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { galleryToast.hidden = true; }, 2600);
}

function setMessage(text, type = 'neutral') {
  message.textContent = text;
  message.dataset.type = type;
}

function setLoading(loading) {
  form.querySelector('button').disabled = loading;
  statusLabel.textContent = loading ? 'A verificar…' : '';
}

function getDeviceId() {
  let value = sessionStorage.getItem(deviceKey);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    sessionStorage.setItem(deviceKey, value);
  }
  return value;
}

async function callFunction(name, body) {
  if (!functionsBase || !config.SUPABASE_PUBLISHABLE_KEY) throw new Error('Configuração Supabase em falta.');
  const response = await fetch(`${functionsBase}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir o pedido.');
  return data;
}

function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function createGalleryIcon(name, modifier = '') {
  if (name === 'favorites') {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('focusable', 'false');
    icon.classList.add('client-ui-icon', 'is-favorites');
    if (modifier) icon.classList.add(...modifier.split(/\s+/).filter(Boolean));
    icon.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z');
    icon.appendChild(path);
    return icon;
  }
  const icon = document.createElement('span');
  icon.className = `client-ui-icon is-${name}${modifier ? ` ${modifier}` : ''}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function galleryIconMarkup(name, modifier = '') {
  return `<span class="client-ui-icon is-${name}${modifier ? ` ${modifier}` : ''}" aria-hidden="true"></span>`;
}

function loadStoredSet(key, storage) {
  try { return new Set(JSON.parse(storage.getItem(key) || '[]')); }
  catch { return new Set(); }
}

function cleanStoredSet(values) {
  const valid = new Set(photos.map((photo) => photo.id));
  return new Set([...values].filter((id) => valid.has(id)));
}

function loadSelections() {
  selected = cleanStoredSet(loadStoredSet(cartKey(galleryPublicId), sessionStorage));
  favorites = cleanStoredSet(loadStoredSet(favoritesKey(galleryPublicId), localStorage));
}

function saveCart() {
  sessionStorage.setItem(cartKey(galleryPublicId), JSON.stringify([...selected]));
}

function saveFavorites() {
  localStorage.setItem(favoritesKey(galleryPublicId), JSON.stringify([...favorites]));
}

function togglePhoto(photoId) {
  if (!album?.sales?.enabled) return;
  if (selected.has(photoId)) selected.delete(photoId); else selected.add(photoId);
  saveCart();
  updateCommerceUi();
  toast(selected.has(photoId) ? 'Fotografia adicionada ao carrinho.' : 'Fotografia removida do carrinho.');
}

function toggleFavorite(photoId) {
  if (favorites.has(photoId)) favorites.delete(photoId); else favorites.add(photoId);
  saveFavorites();
  updateFavoriteUi();
  renderPhotoGrid();
  toast(favorites.has(photoId) ? 'Fotografia guardada nas favoritas.' : 'Fotografia removida das favoritas.');
}

function createPhotoCard(photo, index) {
  const card = document.createElement('article');
  card.className = 'client-photo';
  card.dataset.photoId = photo.id;

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'client-photo__open';
  open.setAttribute('aria-label', album?.sales?.enabled
    ? `Adicionar ou remover ${photo.caption || photo.filename || `fotografia ${index + 1}`} do carrinho`
    : `Ampliar ${photo.caption || photo.filename || `fotografia ${index + 1}`}`);
  open.addEventListener('click', () => {
    if (album?.sales?.enabled) togglePhoto(photo.id);
    else openLightbox(index);
  });

  const image = document.createElement('img');
  image.src = photo.thumbUrl || photo.url;
  image.alt = photo.caption || photo.filename || `Fotografia ${index + 1}`;
  image.loading = 'lazy';
  open.appendChild(image);
  card.appendChild(open);

  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.className = 'client-photo__favorite';
  favorite.appendChild(createGalleryIcon('favorites'));
  favorite.setAttribute('aria-label', favorites.has(photo.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
  favorite.setAttribute('aria-pressed', String(favorites.has(photo.id)));
  favorite.addEventListener('click', () => toggleFavorite(photo.id));
  card.appendChild(favorite);

  if (album?.sales?.enabled) {
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.className = 'client-photo__select';
    choose.classList.toggle('is-selected', selected.has(photo.id));
    choose.setAttribute('aria-label', selected.has(photo.id) ? 'Remover do carrinho' : 'Adicionar ao carrinho');
    choose.setAttribute('aria-pressed', String(selected.has(photo.id)));
    choose.addEventListener('click', () => togglePhoto(photo.id));
    card.classList.toggle('is-selected', selected.has(photo.id));
    card.appendChild(choose);

    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'client-photo__preview';
    preview.innerHTML = '<span aria-hidden="true"></span>';
    preview.setAttribute('aria-label', `Ampliar ${photo.caption || photo.filename || `fotografia ${index + 1}`}`);
    preview.addEventListener('click', () => openLightbox(index));
    card.appendChild(preview);
  }

  return card;
}

function visiblePhotos() {
  let list = photos.map((photo, index) => ({ photo, index }));
  if (activeFilter === 'favorites') list = list.filter(({ photo }) => favorites.has(photo.id));
  if (sortControl.value === 'recent') list.reverse();
  if (sortControl.value === 'name') {
    list.sort((a, b) => String(a.photo.filename || '').localeCompare(String(b.photo.filename || ''), 'pt', { numeric: true }));
  }
  return list;
}

function renderPhotoGrid() {
  clearElement(grid);
  const visible = visiblePhotos();
  if (!photos.length) {
    const empty = document.createElement('div');
    empty.className = 'client-gallery__empty';
    empty.innerHTML = '<span class="client-gallery__empty-mark" aria-hidden="true"></span><strong>Sem fotografias publicadas</strong><p>As fotografias desta galeria ainda estão a ser preparadas.</p>';
    grid.appendChild(empty);
    return;
  }
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'client-gallery__empty';
    empty.innerHTML = `${galleryIconMarkup('favorites', 'is-empty')}<strong>Ainda não tem favoritas</strong><p>Use o coração nas fotografias que deseja guardar.</p>`;
    grid.appendChild(empty);
    return;
  }
  visible.forEach(({ photo, index }) => grid.appendChild(createPhotoCard(photo, index)));
}

function setFilter(filter) {
  activeFilter = filter;
  $$('[data-gallery-filter]').forEach((button) => {
    const active = button.dataset.galleryFilter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const favoritesAction = $('[data-favorites-action]');
  if (favoritesAction) favoritesAction.setAttribute('aria-pressed', String(filter === 'favorites'));
  renderPhotoGrid();
}

function renderFlow() {
  const steps = $('[data-flow-steps]');
  const benefits = $('[data-flow-benefits]');
  if (!steps || !benefits) return;
  if (album?.sales?.enabled) {
    steps.innerHTML = [
      ['1. Selecionar', 'Escolha as fotografias que deseja comprar.'],
      ['2. Carrinho', 'Reveja a seleção e o valor total.'],
      ['3. Pagamento', 'Pague de forma segura através da Stripe.'],
      ['4. Receber', 'Receba os links para download por email.'],
    ].map(([heading, copy]) => `<article><strong>${heading}</strong><p>${copy}</p></article>`).join('');
    benefits.innerHTML = `<p>Downloads disponíveis durante ${Number(album.sales.downloadExpiryDays || 7)} dias</p><p>Ficheiros em máxima qualidade</p><p>Apoio ao cliente disponível</p>`;
  } else {
    steps.innerHTML = [
      ['1. Explorar', 'Percorra todos os momentos desta galeria.'],
      ['2. Favoritar', 'Guarde as fotografias de que mais gosta.'],
      ['3. Descarregar', album.downloadsEnabled ? 'Abra uma fotografia para descarregar.' : 'Os downloads seguem as opções da fotógrafa.'],
    ].map(([heading, copy]) => `<article><strong>${heading}</strong><p>${copy}</p></article>`).join('');
    benefits.innerHTML = '<p>Galeria privada e protegida</p><p>Favoritas guardadas neste dispositivo</p><p>Visualização em alta qualidade</p>';
  }
}

function configureSidebar() {
  setText($('[data-sidebar-event]'), album.eventType || 'Galeria privada');
  setText($('[data-sidebar-location]'), album.location || '—');
  setText($('[data-sidebar-date]'), formatDate(album.eventDate) || '—');
  setText($('[data-sidebar-count]'), `${photos.length} ${photos.length === 1 ? 'fotografia' : 'fotografias'}`);
  setText($('[data-download-title]'), album.downloadsEnabled ? 'Downloads disponíveis' : 'Downloads condicionados');
  setText($('[data-download-copy]'), album.downloadsEnabled
    ? 'Abra uma fotografia para descarregar a versão disponibilizada.'
    : 'Os downloads estão sujeitos às opções definidas pela fotógrafa.');
  if (salesAvailability) salesAvailability.hidden = Boolean(album.sales?.enabled);

  const supportEmail = album.sales?.supportEmail || '';
  if (supportEmail) {
    if (gallerySupport) {
      gallerySupport.href = `mailto:${supportEmail}?subject=${encodeURIComponent(`Ajuda com a galeria ${album.title}`)}`;
      gallerySupport.hidden = false;
    }
    const helpContact = $('[data-help-contact]');
    if (helpContact && gallerySupport) {
      helpContact.href = gallerySupport.href;
      helpContact.hidden = false;
    }
  } else {
    if (gallerySupport) gallerySupport.hidden = true;
    const helpContact = $('[data-help-contact]');
    if (helpContact) helpContact.hidden = true;
  }
}

function revealGalleryContent({ remember = false } = {}) {
  if (remember && galleryPublicId) {
    try { sessionStorage.setItem(welcomeKey(galleryPublicId), 'seen'); } catch (error) { /* A galeria continua funcional sem storage. */ }
  }
  if (galleryWelcome) galleryWelcome.hidden = true;
  if (notice) notice.hidden = false;
  if (galleryBody) galleryBody.hidden = false;
}

function configureGalleryWelcome() {
  if (!galleryWelcome) return;
  let alreadySeen = false;
  try { alreadySeen = sessionStorage.getItem(welcomeKey(galleryPublicId)) === 'seen'; } catch (error) { /* Sem impacto na entrada. */ }
  if (alreadySeen) {
    revealGalleryContent();
    return;
  }

  setText(galleryWelcomeTitle, album.title || 'A sua galeria');
  const date = formatDate(album.eventDate);
  setText(galleryWelcomeDate, date);
  galleryWelcomeDate.hidden = !date;
  setText(galleryWelcomeMessage, album.description || 'A sua galeria está pronta.');
  galleryWelcomeMessage.hidden = !album.description;

  if (album.coverUrl) {
    galleryWelcomeCover.src = album.coverUrl;
    galleryWelcomeCover.alt = album.title ? `Capa da galeria ${album.title}` : 'Capa da galeria';
    galleryWelcomeVisual.hidden = false;
  } else {
    galleryWelcomeCover.removeAttribute('src');
    galleryWelcomeVisual.hidden = true;
  }

  if (notice) notice.hidden = true;
  if (galleryBody) galleryBody.hidden = true;
  galleryWelcome.hidden = false;
  requestAnimationFrame(() => galleryWelcomeOpen?.focus({ preventScroll: true }));
}

function renderGallery(data) {
  if (!data?.album) throw new Error('Não foi possível preparar os dados desta galeria.');
  photos = data.photos || [];
  album = data.album;

  setText(title, album.title);
  const formattedDate = formatDate(album.eventDate);
  setText(meta, [album.location, formattedDate].filter(Boolean).join(' · '));
  setText(eventBadge, album.eventType || '');
  if (eventBadge) eventBadge.hidden = !album.eventType;
  setText(allCount, photos.length);

  if (notice) notice.hidden = false;
  setText(noticeText, album.sales?.enabled
    ? 'Estas fotografias têm marca de água. Após a compra, receberá as versões finais sem marca.'
    : 'Galeria privada · Explore e guarde as suas fotografias favoritas.');

  loadSelections();
  galleryBody.classList.toggle('has-sales', Boolean(album.sales?.enabled));
  configureSidebar();
  renderFlow();
  updateFavoriteUi();
  renderPhotoGrid();
  updateCommerceUi();
  openCartTop.hidden = !album.sales?.enabled;
  gallerySidebar.hidden = Boolean(album.sales?.enabled);

  document.body.classList.toggle('has-gallery-sales', Boolean(album.sales?.enabled));
  document.body.classList.add('is-gallery-unlocked');
  receiptView.hidden = true;
  galleryView.hidden = false;
  loginView.hidden = true;
  configureGalleryWelcome();
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
}

async function loadGallery(publicId, token) {
  galleryPublicId = publicId;
  galleryToken = token;
  const data = await callFunction('get-gallery', { publicId, token });
  renderGallery(data);
}

function updateFavoriteUi() {
  const count = favorites.size;
  setText(favoritesCount, count);
  setText(headerFavoritesCount, count);
  if (headerFavoritesCount) headerFavoritesCount.hidden = count === 0;
  if (!lightbox.hidden) updateLightboxFavorite();
}

function selectedPhotos() {
  return photos.filter((photo) => selected.has(photo.id));
}

function updateCommerceUi() {
  if (!album?.sales?.enabled) {
    cartBar.hidden = true;
    closeCart();
    return;
  }
  const items = selectedPhotos();
  const total = items.length * album.sales.photoPriceCents;
  cartBar.hidden = items.length === 0;
  cartCount.textContent = `${items.length} ${items.length === 1 ? 'selecionada' : 'selecionadas'}`;
  cartTotal.textContent = money(total, album.sales.currency);
  headerCartCount.textContent = items.length;
  headerCartCount.hidden = items.length === 0;
  clearElement(cartThumbs);
  items.slice(0, 4).forEach((photo) => {
    const image = document.createElement('img');
    image.src = photo.thumbUrl || photo.url;
    image.alt = '';
    cartThumbs.appendChild(image);
  });
  $$('[data-photo-id]').forEach((card) => {
    const isSelected = selected.has(card.dataset.photoId);
    card.classList.toggle('is-selected', isSelected);
    const button = card.querySelector('.client-photo__select');
    if (button) {
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-label', isSelected ? 'Remover do carrinho' : 'Adicionar ao carrinho');
      button.setAttribute('aria-pressed', String(isSelected));
    }
  });
  if (!lightbox.hidden) updateLightboxSelection();
  renderCart();
}

function renderCart() {
  if (!album?.sales?.enabled) return;
  const items = selectedPhotos();
  const total = items.length * album.sales.photoPriceCents;
  clearElement(cartItems);
  items.forEach((photo) => {
    const row = document.createElement('article');
    row.innerHTML = `<img src="${escapeHtml(photo.thumbUrl || photo.url)}" alt="" /><div><strong>${escapeHtml(photo.filename || 'Fotografia')}</strong><small>${escapeHtml(money(album.sales.photoPriceCents, album.sales.currency))}</small></div><button type="button" aria-label="Remover">×</button>`;
    row.querySelector('button').addEventListener('click', () => togglePhoto(photo.id));
    cartItems.appendChild(row);
  });
  if (!items.length) cartItems.innerHTML = `<div class="client-cart__empty">${galleryIconMarkup('cart', 'is-empty')}<strong>O carrinho está vazio</strong><p>Selecione fotografias para começar.</p></div>`;
  cartSubtotalLabel.textContent = `Subtotal (${items.length} ${items.length === 1 ? 'foto' : 'fotos'})`;
  cartSubtotal.textContent = money(total, album.sales.currency);
  cartDialogTotal.textContent = money(total, album.sales.currency);
  cartPolicy.textContent = album.sales.refundPolicyText || 'Os ficheiros digitais são disponibilizados após a confirmação do pagamento.';
  checkoutButton.disabled = !items.length || !cartTerms.checked;
}

function syncCartScrollLock() {
  const shouldLock = !cartDialog.hidden && mobileCartMedia.matches;
  document.body.classList.toggle('client-cart-open', shouldLock);
}

function openCart() {
  if (!album?.sales?.enabled) return;
  renderCart();
  cartDialog.hidden = false;
  cartBackdrop.hidden = false;
  galleryBody.classList.add('is-cart-open');
  syncCartScrollLock();
  if (mobileCartMedia.matches) $('[data-close-cart]').focus({ preventScroll: true });
}

function closeCart() {
  cartDialog.hidden = true;
  cartBackdrop.hidden = true;
  galleryBody.classList.remove('is-cart-open');
  document.body.classList.remove('client-cart-open');
}

function preloadLightboxNeighbours() {
  if (photos.length < 2) return;
  [-1, 1].forEach((offset) => {
    const neighbour = photos[(activeIndex + offset + photos.length) % photos.length];
    if (neighbour?.url) new Image().src = neighbour.url;
  });
}

function renderLightboxThumbs() {
  clearElement(lightboxThumbs);
  if (photos.length < 2) {
    lightboxThumbs.hidden = true;
    return;
  }
  lightboxThumbs.hidden = false;
  const radius = mobileCartMedia.matches ? 2 : 4;
  const indices = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    const index = (activeIndex + offset + photos.length) % photos.length;
    if (!indices.includes(index)) indices.push(index);
  }
  indices.forEach((index) => {
    const photo = photos[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.lightboxIndex = String(index);
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', `Ver fotografia ${index + 1}`);
    button.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
    const image = document.createElement('img');
    image.src = photo.thumbUrl || photo.url;
    image.alt = '';
    image.loading = 'lazy';
    button.appendChild(image);
    button.addEventListener('click', () => {
      activeIndex = index;
      updateLightboxPhoto();
    });
    lightboxThumbs.appendChild(button);
  });
}

function updateLightboxPhoto() {
  const photo = photos[activeIndex];
  if (!photo) return;
  lightboxImage.src = photo.url;
  lightboxImage.alt = photo.caption || 'Fotografia da galeria';
  setText(lightboxCounter, `${activeIndex + 1} / ${photos.length}`);
  if (photo.downloadUrl) {
    lightboxDownload.href = photo.downloadUrl;
    lightboxDownload.hidden = false;
  } else lightboxDownload.hidden = true;
  lightboxSelect.hidden = !album?.sales?.enabled;
  updateLightboxSelection();
  updateLightboxFavorite();
  renderLightboxThumbs();
  preloadLightboxNeighbours();
}

function openLightbox(index) {
  activeIndex = index;
  lightboxOpener = document.activeElement;
  updateLightboxPhoto();
  lightbox.hidden = false;
  document.body.classList.add('client-lightbox-open');
  $('[data-lightbox-close]').focus({ preventScroll: true });
}

function updateLightboxSelection() {
  const photo = photos[activeIndex];
  if (!photo || !album?.sales?.enabled) return;
  const included = selected.has(photo.id);
  lightboxSelect.replaceChildren(
    createGalleryIcon('cart', 'is-small'),
    document.createTextNode(included ? 'No carrinho' : 'Adicionar ao carrinho'),
  );
  lightboxSelect.classList.toggle('is-selected', included);
}

function updateLightboxFavorite() {
  const photo = photos[activeIndex];
  if (!photo) return;
  const included = favorites.has(photo.id);
  lightboxFavorite.replaceChildren(createGalleryIcon('favorites', 'is-small'), document.createTextNode(' Favorita'));
  lightboxFavorite.classList.toggle('is-selected', included);
  lightboxFavorite.setAttribute('aria-pressed', String(included));
  lightboxFavorite.setAttribute('aria-label', included ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.removeAttribute('src');
  clearElement(lightboxThumbs);
  document.body.classList.remove('client-lightbox-open');
  lightboxOpener?.focus?.({ preventScroll: true });
  lightboxOpener = null;
}

function moveLightbox(direction) {
  if (!photos.length || lightbox.hidden) return;
  activeIndex = (activeIndex + direction + photos.length) % photos.length;
  updateLightboxPhoto();
}

async function shareLightboxPhoto() {
  const photo = photos[activeIndex];
  if (!photo) return;
  const shareData = {
    title: album?.title || 'Fotografia Arnaut',
    text: `Fotografia ${activeIndex + 1} de ${album?.title || 'uma galeria privada'}`,
    url: window.location.href,
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(window.location.href);
      toast('Ligação da galeria copiada. O código de acesso continua a ser necessário.');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Não foi possível partilhar esta fotografia.');
  }
}

async function toggleLightboxFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await lightbox.requestFullscreen();
  } catch (error) {
    toast('O ecrã inteiro não está disponível neste dispositivo.');
  }
}

async function shareGallery() {
  const shareData = { title: album?.title || 'Fotografia Arnaut', text: `Galeria privada — ${album?.title || 'Fotografia Arnaut'}`, url: window.location.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(window.location.href);
      toast('Ligação copiada. O código de acesso continua a ser necessário.');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Não foi possível partilhar a galeria.');
  }
}

async function startCheckout() {
  if (!cartTerms.checked) {
    cartMessage.textContent = 'Confirme que leu e aceita as condições antes de continuar.';
    return;
  }
  const photoIds = [...selected];
  if (!photoIds.length) return;
  checkoutButton.disabled = true;
  checkoutButton.replaceChildren(createGalleryIcon('cart', 'is-small'), document.createTextNode('A preparar pagamento…'));
  cartMessage.textContent = '';
  try {
    const result = await callFunction('create-checkout-session', { publicId: galleryPublicId, token: galleryToken, photoIds });
    window.location.assign(result.url);
  } catch (error) {
    cartMessage.textContent = error.message || 'Não foi possível iniciar o pagamento.';
    checkoutButton.disabled = false;
    checkoutButton.replaceChildren(createGalleryIcon('cart', 'is-small'), document.createTextNode('Finalizar compra'));
  }
}

const paidStatuses = new Set(['paid', 'partially_refunded']);
async function loadOrderReceipt(orderId, token, attempt = 0) {
  loginView.hidden = true;
  galleryView.hidden = true;
  cartBar.hidden = true;
  receiptView.hidden = false;
  document.body.classList.add('is-gallery-receipt');
  try {
    const { order, pollAfterSeconds } = await callFunction('order-access', { action: 'status', orderPublicId: orderId, token });
    const isPaid = paidStatuses.has(order.status) && order.downloadAvailable;
    orderStatusIcon.textContent = isPaid ? '✓' : order.status === 'pending' ? '…' : '!';
    orderStatusIcon.classList.toggle('is-pending', order.status === 'pending');
    orderTitle.textContent = isPaid ? 'Obrigado pela tua compra' : order.status === 'pending' ? 'A confirmar pagamento…' : 'Encomenda indisponível';
    orderMessage.textContent = isPaid ? 'Pagamento recebido com sucesso. As fotografias compradas já estão disponíveis para download.' : order.status === 'pending' ? 'A confirmação pode demorar alguns segundos. Esta página atualiza automaticamente.' : 'O pagamento não foi confirmado ou os downloads já expiraram.';
    orderSummary.innerHTML = `<dl><div><dt>Encomenda</dt><dd>${escapeHtml(order.number)}</dd></div><div><dt>Galeria</dt><dd>${escapeHtml(order.galleryTitle)}</dd></div><div><dt>Fotografias</dt><dd>${order.items.length}</dd></div><div><dt>Total</dt><dd>${escapeHtml(money(order.totalCents, order.currency))}</dd></div>${order.expiresAt ? `<div><dt>Downloads até</dt><dd>${escapeHtml(new Date(order.expiresAt).toLocaleDateString('pt-PT'))}</dd></div>` : ''}</dl>`;
    clearElement(orderDownloads);
    order.items.forEach((item) => {
      const row = document.createElement('article');
      row.innerHTML = `<img src="${escapeHtml(item.previewUrl || '')}" alt="" /><div><strong>${escapeHtml(item.filename)}</strong><small>Original em alta qualidade</small></div><button type="button" ${isPaid ? '' : 'disabled'}>Descarregar</button>`;
      row.querySelector('button').addEventListener('click', () => downloadPurchasedPhoto(orderId, token, item.photoId, row.querySelector('button')));
      orderDownloads.appendChild(row);
    });
    if (order.refundPolicyText || order.supportEmail) {
      const info = document.createElement('p');
      info.className = 'order-receipt__support';
      info.textContent = [order.refundPolicyText, order.supportEmail ? `Apoio: ${order.supportEmail}` : ''].filter(Boolean).join(' · ');
      orderDownloads.appendChild(info);
    }
    if (pollAfterSeconds && attempt < 24) receiptPollTimer = setTimeout(() => loadOrderReceipt(orderId, token, attempt + 1), pollAfterSeconds * 1000);
  } catch (error) {
    orderStatusIcon.textContent = '!';
    orderTitle.textContent = 'Não foi possível abrir a encomenda';
    orderMessage.textContent = error.message;
    orderDownloads.innerHTML = '<button type="button" class="order-retry">Tentar novamente</button>';
    orderDownloads.querySelector('.order-retry').addEventListener('click', () => loadOrderReceipt(orderId, token, 0));
  }
}

async function downloadPurchasedPhoto(orderId, token, photoId, button) {
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = 'A preparar…';
  try {
    const result = await callFunction('order-access', { action: 'download', orderPublicId: orderId, token, photoId });
    window.location.assign(result.url);
  } catch (error) {
    toast(error.message || 'Não foi possível preparar o download.');
  } finally {
    button.disabled = false;
    button.textContent = previous;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');
  setLoading(true);
  try {
    const newSession = await callFunction('redeem-gallery-code', { code: codeInput.value, deviceId: getDeviceId() });
    sessionStorage.setItem(sessionKey(newSession.publicId), newSession.token);
    window.location.replace(`galeria.html?id=${encodeURIComponent(newSession.publicId)}`);
    return;
  } catch (error) {
    document.body.classList.remove('is-gallery-unlocked', 'has-gallery-sales');
    galleryView.hidden = true;
    loginView.hidden = false;
    setMessage(error.message || 'Código inválido ou galeria indisponível.', 'error');
  } finally {
    setLoading(false);
  }
});

codeInput.addEventListener('input', () => {
  const clean = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  codeInput.value = clean.replace(/(.{4})(?=.)/g, '$1-');
});

$$('[data-gallery-filter]').forEach((button) => button.addEventListener('click', () => setFilter(button.dataset.galleryFilter)));
sortControl.addEventListener('change', renderPhotoGrid);
$('[data-favorites-action]').addEventListener('click', () => {
  setFilter('favorites');
  grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('[data-share-gallery]').addEventListener('click', shareGallery);
$('[data-gallery-help]').addEventListener('click', () => helpDialog.showModal());
$('[data-close-help]').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('click', (event) => { if (event.target === helpDialog) helpDialog.close(); });
$('[data-dismiss-notice]').addEventListener('click', () => { notice.hidden = true; });
galleryWelcomeOpen?.addEventListener('click', () => revealGalleryContent({ remember: true }));
$('[data-lightbox-close]').addEventListener('click', closeLightbox);
$('[data-lightbox-prev]').addEventListener('click', () => moveLightbox(-1));
$('[data-lightbox-next]').addEventListener('click', () => moveLightbox(1));
lightboxFavorite.addEventListener('click', () => toggleFavorite(photos[activeIndex].id));
lightboxSelect.addEventListener('click', () => togglePhoto(photos[activeIndex].id));
lightboxShare?.addEventListener('click', shareLightboxPhoto);
lightboxFullscreen?.addEventListener('click', toggleLightboxFullscreen);
lightbox.addEventListener('click', (event) => { if (event.target === lightbox) closeLightbox(); });
lightbox.addEventListener('touchstart', (event) => {
  lightboxTouchStartX = event.changedTouches[0]?.clientX || 0;
}, { passive: true });
lightbox.addEventListener('touchend', (event) => {
  const distance = (event.changedTouches[0]?.clientX || 0) - lightboxTouchStartX;
  if (Math.abs(distance) >= 54) moveLightbox(distance > 0 ? -1 : 1);
}, { passive: true });
$('[data-open-cart]').addEventListener('click', openCart);
openCartTop.addEventListener('click', openCart);
$('[data-close-cart]').addEventListener('click', closeCart);
$('[data-cart-continue]').addEventListener('click', closeCart);
cartBackdrop.addEventListener('click', closeCart);
$('[data-clear-cart]').addEventListener('click', () => {
  selected.clear();
  saveCart();
  updateCommerceUi();
  toast('Carrinho limpo.');
});
cartTerms.addEventListener('change', renderCart);
checkoutButton.addEventListener('click', startCheckout);
mobileCartMedia.addEventListener?.('change', syncCartScrollLock);
$('[data-order-back]').addEventListener('click', () => {
  clearTimeout(receiptPollTimer);
  window.location.assign('galeria.html');
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !cartDialog.hidden) closeCart();
  if (lightbox.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeLightbox(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); moveLightbox(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); moveLightbox(1); }
  if (event.key === 'Tab') {
    const focusable = [...lightbox.querySelectorAll('button:not([hidden]):not(:disabled), a[href]:not([hidden])')]
      .filter((element) => element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

if (initialOrderId) {
  if (suppliedReceiptToken) {
    sessionStorage.setItem(receiptKey(initialOrderId), suppliedReceiptToken);
    window.history.replaceState(null, '', `galeria.html?order=${encodeURIComponent(initialOrderId)}`);
  }
  const token = suppliedReceiptToken || sessionStorage.getItem(receiptKey(initialOrderId));
  if (token) loadOrderReceipt(initialOrderId, token);
  else {
    loginView.hidden = true;
    receiptView.hidden = false;
    orderTitle.textContent = 'Ligação incompleta';
    orderMessage.textContent = 'Utilize a ligação recebida por email para aceder à encomenda.';
  }
} else if (initialPublicId) {
  const token = sessionStorage.getItem(sessionKey(initialPublicId));
  if (token) loadGallery(initialPublicId, token).catch((error) => {
    sessionStorage.removeItem(sessionKey(initialPublicId));
    document.body.classList.remove('is-gallery-unlocked', 'has-gallery-sales');
    galleryView.hidden = true;
    loginView.hidden = false;
    setMessage(error.message || 'A sessão desta galeria terminou. Introduza novamente o código.', 'error');
  });
}
