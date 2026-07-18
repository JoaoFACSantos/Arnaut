const config = window.ARNAUT_CONFIG || {};
const supabaseUrl = String(config.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const functionsBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : '';
const params = new URLSearchParams(window.location.search);
const initialPublicId = params.get('id') || '';

const loginView = document.querySelector('[data-gallery-login]');
const galleryView = document.querySelector('[data-gallery-view]');
const form = document.querySelector('[data-gallery-form]');
const codeInput = document.querySelector('[data-access-code]');
const message = document.querySelector('[data-gallery-message]');
const statusLabel = document.querySelector('[data-gallery-status]');
const title = document.querySelector('[data-gallery-title]');
const meta = document.querySelector('[data-gallery-meta]');
const description = document.querySelector('[data-gallery-description]');
const cover = document.querySelector('[data-gallery-cover]');
const grid = document.querySelector('[data-gallery-grid]');
const privacy = document.querySelector('[data-gallery-privacy]');
const lightbox = document.querySelector('[data-lightbox]');
const lightboxImage = document.querySelector('[data-lightbox-image]');
const lightboxCaption = document.querySelector('[data-lightbox-caption]');
const lightboxDownload = document.querySelector('[data-lightbox-download]');

let photos = [];
let activeIndex = 0;

const setMessage = (text, type = 'neutral') => {
  message.textContent = text;
  message.dataset.type = type;
};

const setLoading = (loading) => {
  form.querySelector('button').disabled = loading;
  statusLabel.textContent = loading ? 'A verificar...' : '';
};

const deviceKey = 'arnaut_gallery_device';
const getDeviceId = () => {
  let value = sessionStorage.getItem(deviceKey);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    sessionStorage.setItem(deviceKey, value);
  }
  return value;
};
const sessionKey = (publicId) => `arnaut_gallery_session_${publicId}`;

async function callFunction(name, body) {
  if (!functionsBase || !config.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Configuração Supabase em falta.');
  }

  const response = await fetch(`${functionsBase}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir o pedido.');
  return data;
}

function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function createPhotoButton(photo, index) {
  const button = document.createElement('button');
  button.className = 'gallery-card';
  button.type = 'button';
  button.addEventListener('click', () => openLightbox(index));

  const image = document.createElement('img');
  image.src = photo.thumbUrl || photo.url;
  image.alt = photo.caption || photo.filename || `Fotografia ${index + 1}`;
  image.loading = 'lazy';
  button.appendChild(image);

  if (photo.caption) {
    const caption = document.createElement('span');
    caption.textContent = photo.caption;
    button.appendChild(caption);
  }

  return button;
}

function renderGallery(data) {
  photos = data.photos || [];
  loginView.hidden = true;
  galleryView.hidden = false;
  privacy.hidden = false;

  title.textContent = data.album.title;
  meta.textContent = [data.album.eventDate, data.album.location].filter(Boolean).join(' · ');
  description.textContent = data.album.description || 'Galeria privada disponível para convidados autorizados.';

  if (data.album.coverUrl) {
    cover.src = data.album.coverUrl;
    cover.alt = `Capa da galeria ${data.album.title}`;
    cover.hidden = false;
  } else {
    cover.hidden = true;
  }

  clearElement(grid);
  if (!photos.length) {
    const empty = document.createElement('p');
    empty.className = 'gallery-empty';
    empty.textContent = 'Esta galeria ainda não tem fotografias publicadas.';
    grid.appendChild(empty);
    return;
  }

  photos.forEach((photo, index) => grid.appendChild(createPhotoButton(photo, index)));
}

async function loadGallery(publicId, token) {
  const data = await callFunction('get-gallery', { publicId, token });
  renderGallery(data);
}

function openLightbox(index) {
  activeIndex = index;
  const photo = photos[activeIndex];
  lightboxImage.src = photo.url;
  lightboxImage.alt = photo.caption || photo.filename || 'Fotografia da galeria';
  lightboxCaption.textContent = photo.caption || photo.filename || '';
  if (photo.downloadUrl) {
    lightboxDownload.href = photo.downloadUrl;
    lightboxDownload.hidden = false;
  } else {
    lightboxDownload.hidden = true;
  }
  lightbox.hidden = false;
  lightbox.querySelector('[data-lightbox-close]').focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.removeAttribute('src');
}

function moveLightbox(direction) {
  if (!photos.length || lightbox.hidden) return;
  activeIndex = (activeIndex + direction + photos.length) % photos.length;
  openLightbox(activeIndex);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = codeInput.value;

  setMessage('', 'neutral');
  setLoading(true);
  try {
    const session = await callFunction('redeem-gallery-code', { code, deviceId: getDeviceId() });
    sessionStorage.setItem(sessionKey(session.publicId), session.token);
    window.history.replaceState(null, '', `galeria.html?id=${encodeURIComponent(session.publicId)}`);
    await loadGallery(session.publicId, session.token);
  } catch (error) {
    setMessage(error.message || 'Código inválido ou galeria indisponível.', 'error');
  } finally {
    setLoading(false);
  }
});

codeInput.addEventListener('input', () => {
  const cursorAtEnd = codeInput.selectionStart === codeInput.value.length;
  const clean = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  codeInput.value = clean.replace(/(.{4})(?=.)/g, '$1-');
  if (cursorAtEnd) codeInput.setSelectionRange(codeInput.value.length, codeInput.value.length);
});

document.querySelector('[data-lightbox-close]').addEventListener('click', closeLightbox);
document.querySelector('[data-lightbox-prev]').addEventListener('click', () => moveLightbox(-1));
document.querySelector('[data-lightbox-next]').addEventListener('click', () => moveLightbox(1));

window.addEventListener('keydown', (event) => {
  if (lightbox.hidden) return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowLeft') moveLightbox(-1);
  if (event.key === 'ArrowRight') moveLightbox(1);
});

if (initialPublicId) {
  const token = sessionStorage.getItem(sessionKey(initialPublicId));
  if (token) {
    loadGallery(initialPublicId, token).catch(() => sessionStorage.removeItem(sessionKey(initialPublicId)));
  }
}
