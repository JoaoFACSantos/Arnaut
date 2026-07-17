import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.ARNAUT_CONFIG || {};
const functionsBase = config.SUPABASE_URL ? `${config.SUPABASE_URL}/functions/v1` : '';
const supabase = config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY
  ? createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY)
  : null;

const loginPanel = document.querySelector('[data-admin-login]');
const appPanel = document.querySelector('[data-admin-app]');
const loginForm = document.querySelector('[data-login-form]');
const loginMessage = document.querySelector('[data-login-message]');
const logoutButton = document.querySelector('[data-logout]');
const albumList = document.querySelector('[data-album-list]');
const albumForm = document.querySelector('[data-album-form]');
const albumMessage = document.querySelector('[data-album-message]');
const uploadInput = document.querySelector('[data-photo-upload]');
const uploadProgress = document.querySelector('[data-upload-progress]');
const photoList = document.querySelector('[data-photo-list]');
const copyLinkButton = document.querySelector('[data-copy-link]');
const newAlbumButton = document.querySelector('[data-new-album]');
const deleteAlbumButton = document.querySelector('[data-delete-album]');

let session = null;
let albums = [];
let currentAlbum = null;

const fields = {
  id: albumForm.elements.id,
  title: albumForm.elements.title,
  slug: albumForm.elements.slug,
  eventDate: albumForm.elements.eventDate,
  location: albumForm.elements.location,
  description: albumForm.elements.description,
  coverPath: albumForm.elements.coverPath,
  accessCode: albumForm.elements.accessCode,
  downloadsEnabled: albumForm.elements.downloadsEnabled,
  isActive: albumForm.elements.isActive,
  isArchived: albumForm.elements.isArchived,
  expiresAt: albumForm.elements.expiresAt,
};

function setText(element, text) {
  element.textContent = text || '';
}

function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function setAdminMessage(text, type = 'neutral') {
  albumMessage.textContent = text;
  albumMessage.dataset.type = type;
}

async function callAdmin(action, payload = {}) {
  if (!functionsBase || !session?.access_token) throw new Error('Sessão de administração inválida.');
  const response = await fetch(`${functionsBase}/admin-albums`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Operação falhou.');
  return data;
}

function albumUrl(album) {
  const base = (config.SITE_URL || window.location.origin).replace(/\/$/, '');
  return `${base}/galeria.html?album=${album.slug}`;
}

function resetForm() {
  currentAlbum = null;
  albumForm.reset();
  fields.id.value = '';
  fields.isActive.checked = true;
  fields.downloadsEnabled.checked = false;
  fields.isArchived.checked = false;
  clearElement(photoList);
  uploadInput.disabled = true;
  copyLinkButton.disabled = true;
  deleteAlbumButton.disabled = true;
  setAdminMessage('Crie ou selecione um álbum para gerir fotografias.');
}

function fillForm(album) {
  currentAlbum = album;
  fields.id.value = album.id || '';
  fields.title.value = album.title || '';
  fields.slug.value = album.slug || '';
  fields.eventDate.value = album.event_date || '';
  fields.location.value = album.location || '';
  fields.description.value = album.description || '';
  fields.coverPath.value = album.cover_path || '';
  fields.accessCode.value = '';
  fields.downloadsEnabled.checked = Boolean(album.downloads_enabled);
  fields.isActive.checked = Boolean(album.is_active);
  fields.isArchived.checked = Boolean(album.is_archived);
  fields.expiresAt.value = album.expires_at ? album.expires_at.slice(0, 16) : '';
  uploadInput.disabled = false;
  copyLinkButton.disabled = false;
  deleteAlbumButton.disabled = false;
  renderPhotos(album.album_photos || []);
  setAdminMessage('Código atual oculto. Preencha o campo apenas para definir um novo código.');
}

function renderAlbums() {
  clearElement(albumList);
  if (!albums.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Ainda não existem álbuns.';
    albumList.appendChild(empty);
    return;
  }

  albums.forEach((album) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-album-card';
    button.addEventListener('click', () => fillForm(album));

    const title = document.createElement('strong');
    title.textContent = album.title;
    const meta = document.createElement('span');
    meta.textContent = `${album.slug} · ${album.is_active ? 'ativo' : 'desativado'}${album.is_archived ? ' · arquivado' : ''}`;
    button.append(title, meta);
    albumList.appendChild(button);
  });
}

function renderPhotos(items) {
  clearElement(photoList);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Sem fotografias carregadas.';
    photoList.appendChild(empty);
    return;
  }

  items
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .forEach((photo, index) => {
      const row = document.createElement('div');
      row.className = 'admin-photo-row';

      const name = document.createElement('span');
      name.textContent = `${index + 1}. ${photo.filename}`;

      const cover = document.createElement('button');
      cover.type = 'button';
      cover.textContent = 'Definir capa';
      cover.addEventListener('click', () => {
        fields.coverPath.value = photo.storage_path;
        setAdminMessage('Capa preparada. Guarde o álbum para confirmar.');
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Apagar';
      remove.addEventListener('click', async () => {
        if (!window.confirm('Apagar esta fotografia?')) return;
        await callAdmin('delete-photo', { photoId: photo.id });
        await loadAlbums();
        const updated = albums.find((album) => album.id === currentAlbum.id);
        if (updated) fillForm(updated);
      });

      row.append(name, cover, remove);
      photoList.appendChild(row);
    });
}

async function loadAlbums() {
  const data = await callAdmin('list');
  albums = data.albums || [];
  renderAlbums();
}

async function showApp(activeSession) {
  session = activeSession;
  loginPanel.hidden = true;
  appPanel.hidden = false;
  logoutButton.hidden = false;
  await loadAlbums();
  resetForm();
}

async function showLogin() {
  session = null;
  loginPanel.hidden = false;
  appPanel.hidden = true;
  logoutButton.hidden = true;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) {
    setText(loginMessage, 'Configure o ficheiro config.js antes de iniciar sessão.');
    return;
  }
  setText(loginMessage, 'A entrar...');
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setText(loginMessage, 'Email ou palavra-passe inválidos.');
    return;
  }
  setText(loginMessage, '');
  await showApp(data.session);
});

logoutButton.addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
  showLogin();
});

newAlbumButton.addEventListener('click', resetForm);

albumForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setAdminMessage('A guardar...');
  try {
    const album = {
      id: fields.id.value || null,
      title: fields.title.value,
      slug: fields.slug.value,
      eventDate: fields.eventDate.value || null,
      location: fields.location.value,
      description: fields.description.value,
      coverPath: fields.coverPath.value || null,
      accessCode: fields.accessCode.value,
      downloadsEnabled: fields.downloadsEnabled.checked,
      isActive: fields.isActive.checked,
      isArchived: fields.isArchived.checked,
      expiresAt: fields.expiresAt.value ? new Date(fields.expiresAt.value).toISOString() : null,
    };
    const data = await callAdmin('save-album', { album });
    await loadAlbums();
    const updated = albums.find((item) => item.id === data.album.id) || data.album;
    fillForm(updated);
    setAdminMessage('Álbum guardado. O código não será mostrado novamente.', 'success');
  } catch (error) {
    setAdminMessage(error.message, 'error');
  }
});

uploadInput.addEventListener('change', async () => {
  if (!currentAlbum || !uploadInput.files.length || !supabase) return;
  const files = [...uploadInput.files];
  uploadProgress.value = 0;
  uploadProgress.max = files.length;
  setAdminMessage(`A carregar 0/${files.length}...`);

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error(`Tipo inválido: ${file.name}`);
      }
      const { path } = await callAdmin('create-storage-path', {
        albumId: currentAlbum.id,
        filename: file.name,
      });
      const { error: uploadError } = await supabase.storage
        .from('private-galleries')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      await callAdmin('register-photo', {
        photo: {
          albumId: currentAlbum.id,
          storagePath: path,
          filename: file.name,
          sortOrder: (currentAlbum.album_photos || []).length + index,
        },
      });
      uploadProgress.value = index + 1;
      setAdminMessage(`A carregar ${index + 1}/${files.length}...`);
    }
    await loadAlbums();
    const updated = albums.find((album) => album.id === currentAlbum.id);
    if (updated) fillForm(updated);
    setAdminMessage('Upload concluído.', 'success');
  } catch (error) {
    setAdminMessage(error.message || 'Upload falhou.', 'error');
  } finally {
    uploadInput.value = '';
  }
});

copyLinkButton.addEventListener('click', async () => {
  if (!currentAlbum) return;
  await navigator.clipboard.writeText(albumUrl(currentAlbum));
  setAdminMessage('Link privado copiado.', 'success');
});

deleteAlbumButton.addEventListener('click', async () => {
  if (!currentAlbum || !window.confirm('Eliminar permanentemente este álbum e fotografias?')) return;
  await callAdmin('delete-album', { albumId: currentAlbum.id });
  await loadAlbums();
  resetForm();
});

if (!supabase) {
  setText(loginMessage, 'Configure config.js com SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.');
} else {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await showApp(data.session);
  } else {
    showLogin();
  }
}
