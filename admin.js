import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dayDifference, formatExpirationStatus, startOfLocalDay } from './admin-utils.js';

const config = window.ARNAUT_CONFIG || {};
const supabaseUrl = String(config.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const functionsBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : '';
const supabase = supabaseUrl && config.SUPABASE_PUBLISHABLE_KEY
  ? createClient(supabaseUrl, config.SUPABASE_PUBLISHABLE_KEY)
  : null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  login: $('[data-admin-login]'),
  app: $('[data-admin-app]'),
  loginForm: $('[data-login-form]'),
  loginMessage: $('[data-login-message]'),
  logout: $('[data-logout]'),
  sidebar: $('[data-sidebar]'),
  sidebarBackdrop: $('[data-sidebar-backdrop]'),
  toggleSidebar: $('[data-toggle-sidebar]'),
  pageTitle: $('[data-page-title]'),
  content: $('.admin-content'),
  nav: $$('[data-view]'),
  viewPanels: $$('[data-view-panel]'),
  statGrid: $('[data-stat-grid]'),
  recentList: $('[data-recent-list]'),
  expiringList: $('[data-expiring-list]'),
  chart: $('[data-photo-chart]'),
  chartRange: $('[data-chart-range]'),
  galleryBoard: $('[data-gallery-board]'),
  search: $('[data-gallery-search]'),
  statusFilter: $('[data-status-filter]'),
  typeFilter: $('[data-type-filter]'),
  sortFilter: $('[data-sort-filter]'),
  layoutButtons: $$('[data-gallery-layout]'),
  drawer: $('[data-gallery-drawer]'),
  drawerBackdrop: $('[data-drawer-backdrop]'),
  restoreDrawer: $('[data-restore-drawer]'),
  drawerForm: $('[data-gallery-form]'),
  drawerTitle: $('[data-drawer-title]'),
  drawerKicker: $('[data-drawer-kicker]'),
  drawerMeta: $('[data-drawer-meta]'),
  closeDrawer: $('[data-close-drawer]'),
  discardDrawer: $('[data-discard-drawer]'),
  previewGallery: $('[data-preview-gallery]'),
  actionShowCode: $('[data-action-show-code]'),
  actionCopyInstructions: $('[data-action-copy-instructions]'),
  actionRegenerateCode: $('[data-action-regenerate-code]'),
  actionEndSessions: $('[data-action-end-sessions]'),
  actionActivate: $('[data-action-activate]'),
  actionDisable: $('[data-action-disable]'),
  actionArchive: $('[data-action-archive]'),
  actionDelete: $('[data-action-delete]'),
  stepButtons: $$('[data-step-target]'),
  steps: $$('[data-step]'),
  prevStep: $('[data-prev-step]'),
  nextStep: $('[data-next-step]'),
  saveGallery: $('[data-save-gallery]'),
  albumMessage: $('[data-album-message]'),
  dropzone: $('[data-dropzone]'),
  uploadInput: $('[data-photo-upload]'),
  uploadProgress: $('[data-upload-progress]'),
  photoList: $('[data-photo-list]'),
  queueExistingWatermarks: $('[data-queue-existing-watermarks]'),
  watermarkPreview: $('[data-watermark-preview]'),
  confirmSummary: $('[data-confirm-summary]'),
  codeValue: $('[data-code-value]'),
  codeCard: $('[data-code-card]'),
  codeModal: $('[data-code-modal]'),
  copyCode: $('[data-copy-code]'),
  copyInstructions: $('[data-copy-guest-instructions]'),
  openCreatedGallery: $('[data-open-created-gallery]'),
  closeCodeModal: $('[data-close-code-modal]'),
  confirmModal: $('[data-confirm-modal]'),
  confirmTitle: $('[data-confirm-title]'),
  confirmMessage: $('[data-confirm-message]'),
  confirmCancel: $('[data-confirm-cancel]'),
  confirmOk: $('[data-confirm-ok]'),
  toastRegion: $('[data-toast-region]'),
  storageLabel: $('[data-storage-label]'),
  storageDetail: $('[data-storage-detail]'),
  storageBar: $('[data-storage-bar]'),
  profileMenu: $('[data-profile-menu]'),
  inlineCodeValue: $('[data-inline-code-value]'),
  inlineCodeMessage: $('[data-inline-code-message]'),
  inlineShowCode: $('[data-inline-show-code]'),
  inlineHideCode: $('[data-inline-hide-code]'),
  inlineCopyCode: $('[data-inline-copy-code]'),
  inlineCopyInstructions: $('[data-inline-copy-instructions]'),
  inlineRetryCode: $('[data-inline-retry-code]'),
  inlineRegenerateCode: $('[data-inline-regenerate-code]'),
  uploadPickerModal: $('[data-upload-picker-modal]'),
  uploadPickerSearch: $('[data-upload-picker-search]'),
  uploadPickerStatus: $('[data-upload-picker-status]'),
  uploadPickerList: $('[data-upload-picker-list]'),
  closeUploadPicker: $('[data-close-upload-picker]'),
  reloadUploadPicker: $('[data-reload-upload-picker]'),
  pickerNewGallery: $('[data-picker-new-gallery]'),
  accessManager: $('[data-access-manager]'),
  accessModal: $('[data-access-modal]'),
  accessList: $('[data-access-list]'),
  closeAccessModal: $('[data-close-access-modal]'),
};

const fields = {
  id: els.drawerForm.elements.id,
  title: els.drawerForm.elements.title,
  eventType: els.drawerForm.elements.eventType,
  eventDate: els.drawerForm.elements.eventDate,
  location: els.drawerForm.elements.location,
  description: els.drawerForm.elements.description,
  guestMessage: els.drawerForm.elements.guestMessage,
  expiresAt: els.drawerForm.elements.expiresAt,
  slug: els.drawerForm.elements.slug,
  isActive: els.drawerForm.elements.isActive,
  downloadsEnabled: els.drawerForm.elements.downloadsEnabled,
  downloadAllEnabled: els.drawerForm.elements.downloadAllEnabled,
  isArchived: els.drawerForm.elements.isArchived,
  watermarkEnabled: els.drawerForm.elements.watermarkEnabled,
  watermarkPosition: els.drawerForm.elements.watermarkPosition,
  watermarkOpacity: els.drawerForm.elements.watermarkOpacity,
  watermarkScale: els.drawerForm.elements.watermarkScale,
  watermarkOriginalDownloads: els.drawerForm.elements.watermarkOriginalDownloads,
};

let session = null;
let albums = [];
let storageInfo = null;
let currentAlbum = null;
let activeView = 'overview';
let currentStep = 1;
let drawerMinimized = false;
let galleryLayout = 'grid';
let filters = { search: '', status: 'all', type: 'all', sort: 'recent' };
let pendingFiles = [];
let selectedPendingCoverId = null;
let lastShownCode = '';
let createdAlbumForModal = null;
let codeLoading = false;
let confirmResolve = null;
let uploadPickerFilters = { search: '', status: 'all' };
const accessCodeCache = new Map();

function clearElement(element) {
  if (!element) return;
  while (element.firstChild) element.removeChild(element.firstChild);
}

function setMessage(text, type = 'neutral') {
  els.albumMessage.textContent = text || '';
  els.albumMessage.dataset.type = type;
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `admin-toast admin-toast--${type}`;
  item.textContent = message;
  els.toastRegion.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function friendlyError(error, fallback = 'Não foi possível concluir a operação.') {
  const message = String(error?.message || '');
  if (error?.status === 401 || /sess[aã]o|jwt|token|auth/i.test(message)) return 'A sua sessão expirou. Inicie sessão novamente.';
  if (error?.status === 409 || error?.code === 'code_unrecoverable') return 'Não é possível recuperar o código desta galeria.';
  if (/upload|storage|ficheiro/i.test(message)) return 'O upload falhou. Tente novamente.';
  if (/slug|nome|obrigat/i.test(message)) return message;
  return fallback;
}

async function withBusy(button, text, task) {
  if (button?.dataset.loading === 'true') return null;
  const previous = button?.textContent;
  if (button) {
    button.disabled = true;
    button.dataset.loading = 'true';
    if (text) button.textContent = text;
  }
  try {
    return await task();
  } finally {
    if (button) {
      button.disabled = false;
      button.dataset.loading = 'false';
      if (previous) button.textContent = previous;
    }
  }
}

function askConfirm(title, message) {
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  els.confirmModal.showModal();
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

function resolveConfirm(value) {
  confirmResolve?.(value);
  confirmResolve = null;
}

async function callAdmin(action, payload = {}) {
  if (!supabase || !functionsBase) throw new Error('Supabase não está configurado.');
  const { data } = await supabase.auth.getSession();
  session = data.session || session;
  if (!session?.access_token) throw new Error('Sessão de administração inválida.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  const response = await fetch(`${functionsBase}/admin-albums`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      apikey: config.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  }).finally(() => clearTimeout(timeout));
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Operação falhou.');
    error.status = response.status;
    error.code = body.code || '';
    throw error;
  }
  return body;
}

function albumUrl() {
  return `${(config.SITE_URL || window.location.origin).replace(/\/$/, '')}/galeria.html`;
}

function guestInstructions(album, code = '') {
  return [
    'A galeria privada do evento já está disponível.',
    '',
    `Aceda a: ${albumUrl(album)}`,
    code ? `Código: ${code}` : `Código: ${album.access_code_masked || 'código disponível na área administrativa'}`,
    '',
    'Por favor, não partilhe este código fora dos convidados do evento.',
  ].join('\n');
}

function formatDate(value, fallback = 'Sem data') {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value, fallback = 'Sem registo') {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function statusOf(album) {
  if (album.is_archived || album.status === 'archived') return 'archived';
  if (dayDifference(album.expires_at) !== null && dayDifference(album.expires_at) < 0) return 'expired';
  if (album.status === 'draft') return 'draft';
  if (!album.is_active || album.status === 'disabled') return 'disabled';
  return 'active';
}

function statusLabel(status) {
  return { active: 'Ativa', draft: 'Rascunho', disabled: 'Desativada', expiring: 'A expirar', expired: 'Expirada', archived: 'Arquivada' }[status] || 'Ativa';
}

function makeBadge(status) {
  const badge = document.createElement('span');
  badge.className = `admin-badge admin-badge--${status}`;
  badge.textContent = statusLabel(status);
  return badge;
}

function photoCount(album) {
  return album.album_photos?.length || 0;
}

function processingLabel(status) {
  return {
    pending: 'A processar',
    processing: 'A processar',
    ready: 'Concluído',
    failed: 'Falhou',
  }[status] || 'A processar';
}

function updateWatermarkPreview() {
  if (!els.watermarkPreview) return;
  const opacity = Number(fields.watermarkOpacity.value || 0.3);
  const scale = Number(fields.watermarkScale.value || 0.2);
  const position = fields.watermarkPosition.value || 'bottom-center';
  els.watermarkPreview.style.setProperty('--watermark-opacity-preview', String(opacity));
  els.watermarkPreview.style.setProperty('--watermark-scale-preview', `${Math.round(scale * 100)}%`);
  els.watermarkPreview.dataset.position = position;
  els.watermarkPreview.classList.toggle('is-disabled', fields.watermarkEnabled.value === 'false');
}

function isExpiringSoon(album) {
  const days = dayDifference(album.expires_at);
  return statusOf(album) === 'active' && days !== null && days >= 0 && days <= 30;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(0, bytes / 1024 / 1024).toFixed(1)} MB`;
}

function estimateStorage() {
  if (!storageInfo || !Number.isFinite(Number(storageInfo.bytes))) {
    els.storageLabel.textContent = 'Indisponível';
    els.storageDetail.textContent = 'Valor indisponível no momento';
    els.storageBar.style.width = '0%';
    return { bytes: null, percent: null, label: 'Indisponível', detail: 'Sem dados de armazenamento' };
  }
  const bytes = Number(storageInfo.bytes);
  const quota = Number(storageInfo.quotaBytes || 150 * 1024 * 1024 * 1024);
  const percent = quota > 0 ? Math.min(100, Math.round((bytes / quota) * 100)) : 0;
  const detail = storageInfo.approximate ? `${formatBytes(bytes)} estimados de ${formatBytes(quota)}` : `${formatBytes(bytes)} de ${formatBytes(quota)}`;
  els.storageLabel.textContent = `${percent}% utilizado`;
  els.storageDetail.textContent = detail;
  els.storageBar.style.width = `${percent}%`;
  return { bytes, percent, label: `${percent}%`, detail: storageInfo.approximate ? `${formatBytes(bytes)} estimados` : `${formatBytes(bytes)} usado` };
}

function setView(view) {
  activeView = view;
  els.content.classList.toggle('is-overview-active', view === 'overview');
  els.pageTitle.textContent = view === 'overview' ? 'Visão geral' : view === 'galleries' ? 'Galerias' : 'Definições';
  els.viewPanels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
  els.nav.forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  closeMobileSidebar();
}

function skeletonDashboard() {
  clearElement(els.statGrid);
  for (let index = 0; index < 6; index += 1) {
    const item = document.createElement('div');
    item.className = 'admin-skeleton-card';
    els.statGrid.appendChild(item);
  }
}

function renderDashboard() {
  const active = albums.filter((album) => statusOf(album) === 'active').length;
  const draft = albums.filter((album) => statusOf(album) === 'draft').length;
  const expired = albums.filter((album) => statusOf(album) === 'expired').length;
  const photos = albums.reduce((total, album) => total + photoCount(album), 0);
  const storage = estimateStorage();
  const cards = [
    ['▧', 'Total de galerias', albums.length, 'Todas as galerias', 'all', 'brown'],
    ['▣', 'Galerias ativas', active, 'Publicadas e ativas', 'active', 'green'],
    ['☁', 'Rascunhos', draft, 'Não publicadas', 'draft', 'sand'],
    ['♡', 'Expiradas', expired, 'Sem acesso público', 'expired', 'terracotta'],
    ['▤', 'Total de fotografias', photos.toLocaleString('pt-PT'), 'Fotografias privadas', null, 'cream'],
    ['◎', 'Armazenamento', storage.label, storage.detail, null, 'peach'],
  ];
  clearElement(els.statGrid);
  cards.forEach(([icon, title, value, hint, status, tone]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-stat-card admin-stat-card--${tone}`;
    button.innerHTML = `<span>${icon}</span><p>${title}</p><strong>${value}</strong><small>${hint}</small>`;
    if (status) button.addEventListener('click', () => {
      filters.status = status;
      els.statusFilter.value = status;
      setView('galleries');
      renderGalleries();
    });
    els.statGrid.appendChild(button);
  });

  renderRecentList();
  renderExpiringList();
  renderChart();
}

function renderRecentList() {
  clearElement(els.recentList);
  const recent = albums.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  if (!recent.length) return renderEmpty(els.recentList, 'Ainda não existem galerias.');
  recent.forEach((album) => els.recentList.appendChild(galleryRow(album)));
}

function renderExpiringList() {
  clearElement(els.expiringList);
  const expiring = albums
    .filter(isExpiringSoon)
    .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
    .slice(0, 4);
  if (!expiring.length) return renderEmpty(els.expiringList, 'Nenhuma galeria a expirar em breve.');
  expiring.forEach((album) => {
    const row = galleryRow(album, true);
    els.expiringList.appendChild(row);
  });
}

function renderChart() {
  clearElement(els.chart);
  const { buckets, previousTotal, previousLabel } = photoBuckets(els.chartRange.value);
  const max = Math.max(...buckets.map((item) => item.count), 1);
  const total = buckets.reduce((sum, item) => sum + item.count, 0);
  const width = 760;
  const height = 210;
  const padX = 38;
  const padY = 28;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;
  const points = buckets.map((item, index) => {
    const x = padX + (buckets.length === 1 ? plotWidth / 2 : (plotWidth / (buckets.length - 1)) * index);
    const y = padY + plotHeight - ((item.count / max) * plotHeight);
    return { ...item, x, y };
  });
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${points.at(-1)?.x || padX} ${height - padY} L ${points[0]?.x || padX} ${height - padY} Z`;
  const previousText = previousTotal > 0 && total > 0
    ? `${Math.round(((total - previousTotal) / previousTotal) * 100)}% em relação a ${previousLabel}`
    : 'Sem comparação anterior suficiente';

  const metric = document.createElement('div');
  metric.className = 'admin-chart-metric';
  metric.innerHTML = `<span>${els.chartRange.value}</span><strong>${total}</strong><small>${previousText}</small>`;

  const svgWrap = document.createElement('div');
  svgWrap.className = 'admin-chart-area';
  svgWrap.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Fotografias carregadas">
      <defs>
        <linearGradient id="arnaut-chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(138,95,69,.24)" />
          <stop offset="100%" stop-color="rgba(138,95,69,0)" />
        </linearGradient>
      </defs>
      ${[0, 1, 2, 3].map((step) => {
        const y = padY + (plotHeight / 3) * step;
        return `<line class="admin-chart-grid" x1="${padX}" x2="${width - padX}" y1="${y}" y2="${y}" />`;
      }).join('')}
      <path class="admin-chart-fill" d="${area}" />
      <path class="admin-chart-line" d="${line}" />
      ${points.map((point) => `
        <g class="admin-chart-point" tabindex="0">
          <title>${point.tooltip}\n${point.count} ${point.count === 1 ? 'fotografia' : 'fotografias'}</title>
          <circle cx="${point.x}" cy="${point.y}" r="4" />
        </g>
      `).join('')}
      ${points.map((point) => `<text class="admin-chart-label" x="${point.x}" y="${height - 5}" text-anchor="middle">${point.label}</text>`).join('')}
    </svg>
    ${!total ? '<p class="admin-chart-empty">Sem fotografias carregadas neste período.</p>' : ''}
  `;
  els.chart.append(metric, svgWrap);
}

function photoBuckets(rangeLabel = 'Esta semana') {
  const photos = albums.flatMap((album) => album.album_photos || []);
  const today = startOfLocalDay();
  const makeBuckets = (offset = 0) => {
    const buckets = [];
    if (rangeLabel === 'Este mês') {
      const anchor = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const year = anchor.getFullYear();
      const month = anchor.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        buckets.push({ date, label: String(day), tooltip: new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(date), count: 0 });
      }
    } else if (rangeLabel === 'Últimos 3 meses') {
      for (let index = 11; index >= 0; index -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - ((index + (offset ? 12 : 0)) * 7));
        const start = startOfLocalDay(date);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        buckets.push({
          start,
          end,
          label: `${start.getDate()}/${start.getMonth() + 1}`,
          tooltip: `${formatDate(start)} - ${formatDate(end)}`,
          count: 0,
        });
      }
    } else {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + (offset * 7));
      for (let index = 0; index < 7; index += 1) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        buckets.push({
          date,
          label: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][index],
          tooltip: new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: '2-digit', month: 'short' }).format(date),
          count: 0,
        });
      }
    }
    return buckets;
  };

  const fillBuckets = (targetBuckets) => {
    photos.forEach((photo) => {
      const created = startOfLocalDay(photo.created_at);
      if (!created) return;
      const bucket = targetBuckets.find((item) => {
        if (item.start && item.end) return created >= item.start && created <= item.end;
        return created.getTime() === item.date.getTime();
      });
      if (bucket) bucket.count += 1;
    });
    return targetBuckets;
  };

  const buckets = fillBuckets(makeBuckets(0));
  const previousBuckets = fillBuckets(makeBuckets(-1));
  const previousTotal = previousBuckets.reduce((sum, item) => sum + item.count, 0);
  const previousLabel = rangeLabel === 'Esta semana' ? 'semana anterior' : rangeLabel === 'Este mês' ? 'mês anterior' : 'período anterior';
  return { buckets, previousTotal, previousLabel };
}

function galleryRow(album, compact = false) {
  const row = document.createElement('article');
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.className = `admin-gallery-row${compact ? ' is-compact' : ''}`;
  row.addEventListener('click', () => openDrawer(album));
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDrawer(album);
    }
  });
  const status = statusOf(album);
  row.append(
    coverNode(album),
    textNode('strong', album.title || 'Sem nome'),
    textNode('span', `${album.event_type || 'Evento'} · ${formatDate(album.event_date)} · ${album.location || 'Sem local'}`),
    makeBadge(status),
    textNode('span', `${photoCount(album)} fotografias`),
    textNode('span', formatExpirationStatus(album.expires_at)),
    actionMenu(album),
  );
  return row;
}

function coverNode(album) {
  const cover = document.createElement('span');
  cover.className = 'admin-cover-thumb';
  if (album.cover_url) {
    const img = document.createElement('img');
    img.src = album.cover_url;
    img.alt = album.title || 'Capa da galeria';
    cover.appendChild(img);
  } else {
    cover.innerHTML = '<b aria-hidden="true">▧</b><small>Sem capa</small>';
  }
  return cover;
}

function textNode(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function actionMenu(album) {
  const wrapper = document.createElement('span');
  wrapper.className = 'admin-card-menu';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '⋮';
  button.setAttribute('aria-label', `Ações de ${album.title}`);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    openDrawer(album);
  });
  wrapper.appendChild(button);
  return wrapper;
}

function renderEmpty(container, message) {
  const empty = document.createElement('div');
  empty.className = 'admin-empty';
  empty.innerHTML = `<span>◇</span><p>${message}</p>`;
  container.appendChild(empty);
}

function uploadPickerAlbums() {
  const query = uploadPickerFilters.search.trim().toLowerCase();
  return albums
    .filter((album) => statusOf(album) !== 'archived')
    .filter((album) => {
      const status = statusOf(album);
      const haystack = [album.title, album.event_type, album.event_date, album.location].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const matchesStatus = uploadPickerFilters.status === 'all' || status === uploadPickerFilters.status;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
}

function galleryPickerCard(album) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'admin-picker-card';
  button.append(coverNode(album));

  const info = document.createElement('span');
  info.className = 'admin-picker-card__info';
  info.innerHTML = `
    <strong>${escapeText(album.title || 'Sem nome')}</strong>
    <small>${escapeText(album.event_type || 'Evento')} · ${escapeText(formatDate(album.event_date))}</small>
  `;

  button.append(info, makeBadge(statusOf(album)));
  button.addEventListener('click', () => {
    els.uploadPickerModal.close();
    openDrawer(album, 2);
    toast(`Upload preparado para ${album.title || 'a galeria selecionada'}.`, 'neutral');
  });
  return button;
}

function renderUploadPicker() {
  clearElement(els.uploadPickerList);
  const available = uploadPickerAlbums();
  if (!albums.length) {
    renderEmpty(els.uploadPickerList, 'Ainda não existem galerias. Crie uma galeria antes de carregar fotografias.');
    return;
  }
  if (!available.length) {
    renderEmpty(els.uploadPickerList, 'Nenhuma galeria encontrada.');
    return;
  }
  available.forEach((album) => els.uploadPickerList.appendChild(galleryPickerCard(album)));
}

function openUploadPicker() {
  uploadPickerFilters = { search: '', status: 'all' };
  els.uploadPickerSearch.value = '';
  els.uploadPickerStatus.value = 'all';
  renderUploadPicker();
  els.uploadPickerModal.showModal();
  setTimeout(() => els.uploadPickerSearch.focus(), 60);
}

function renderAccessList() {
  clearElement(els.accessList);
  const items = albums.filter((album) => statusOf(album) !== 'archived')
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
  if (!items.length) {
    renderEmpty(els.accessList, 'Ainda não existem galerias com acessos para gerir.');
    return;
  }

  items.forEach((album) => {
    const status = statusOf(album);
    const cachedCode = accessCodeCache.get(album.id);
    const row = document.createElement('article');
    row.className = 'admin-access-row';
    row.innerHTML = `
      <div class="admin-access-main">
        <strong>${escapeText(album.title || 'Sem nome')}</strong>
        <small>${escapeText(album.event_type || 'Evento')} · ${escapeText(formatDate(album.event_date))}</small>
      </div>
      <span class="admin-access-status">${statusLabel(status)}</span>
      <code>${escapeText(cachedCode || album.access_code_masked || 'Sem código')}</code>
      <small>Sessões ativas: ${Number(album.active_session_count || 0)}</small>
      <small>Última utilização: ${escapeText(formatDateTime(album.last_session_at))}</small>
      <small>${escapeText(cachedCode ? 'Código carregado nesta sessão' : 'Mostrar para verificar disponibilidade')}</small>
      <small>Sessões: geridas no servidor</small>
      <small>Expiração: ${escapeText(formatExpirationStatus(album.expires_at))}</small>
    `;

    const actions = document.createElement('div');
    actions.className = 'admin-access-actions';

    const show = actionButton('Mostrar', async () => {
      await withBusy(show, 'A obter...', async () => {
        try {
          const data = await callAdmin('get-code', { albumId: album.id });
          accessCodeCache.set(album.id, data.accessCode);
          renderAccessList();
          toast('Código carregado.');
        } catch (error) {
          if (handleExpiredAdminSession(error)) return;
          toast(friendlyError(error, 'Não foi possível obter o código.'), 'error');
        }
      });
    });

    const copy = actionButton('Copiar', async () => {
      await withBusy(copy, 'A copiar...', async () => {
        let code = accessCodeCache.get(album.id);
        if (!code) {
          const data = await callAdmin('get-code', { albumId: album.id });
          code = data.accessCode;
          accessCodeCache.set(album.id, code);
          renderAccessList();
        }
        await navigator.clipboard.writeText(code);
        toast('Código copiado.');
      }).catch((error) => {
        if (handleExpiredAdminSession(error)) return;
        toast(friendlyError(error, 'Não foi possível copiar o código.'), 'error');
      });
    });

    const instructions = actionButton('Instruções', async () => {
      await withBusy(instructions, 'A copiar...', async () => {
        let code = accessCodeCache.get(album.id);
        if (!code) {
          const data = await callAdmin('get-code', { albumId: album.id });
          code = data.accessCode;
          accessCodeCache.set(album.id, code);
          renderAccessList();
        }
        await navigator.clipboard.writeText(guestInstructions(album, code));
        toast('Instruções copiadas.');
      }).catch((error) => {
        if (handleExpiredAdminSession(error)) return;
        toast(friendlyError(error, 'Não foi possível copiar as instruções.'), 'error');
      });
    });

    const regenerate = actionButton('Novo código', async () => {
      if (!await askConfirm('Gerar novo código', 'O código antigo deixa de funcionar e todas as sessões serão terminadas.')) return;
      await withBusy(regenerate, 'A gerar...', async () => {
        const data = await callAdmin('regenerate-code', { albumId: album.id });
        accessCodeCache.set(album.id, data.accessCode);
        await loadAlbums();
        renderAccessList();
        toast('Novo código gerado.');
      }).catch((error) => {
        if (handleExpiredAdminSession(error)) return;
        toast(friendlyError(error, 'Não foi possível gerar novo código.'), 'error');
      });
    });

    const sessions = actionButton('Terminar sessões', async () => {
      if (!await askConfirm('Terminar sessões', 'Os convidados terão de introduzir novamente o código.')) return;
      await withBusy(sessions, 'A terminar...', async () => {
        await callAdmin('end-sessions', { albumId: album.id });
        toast('Sessões terminadas.');
      }).catch((error) => {
        if (handleExpiredAdminSession(error)) return;
        toast(friendlyError(error, 'Não foi possível terminar sessões.'), 'error');
      });
    });

    actions.append(show, copy, instructions, regenerate, sessions);
    row.append(actions);
    els.accessList.appendChild(row);
  });
}

function openAccessManager() {
  renderAccessList();
  els.accessModal.showModal();
}

function filteredAlbums() {
  const query = filters.search.trim().toLowerCase();
  return albums
    .filter((album) => {
      const haystack = [album.title, album.location, album.event_type, album.access_code_masked].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const status = statusOf(album);
      const matchesStatus = filters.status === 'all' || (filters.status === 'expiring' ? isExpiringSoon(album) : status === filters.status);
      const matchesType = filters.type === 'all' || (album.event_type || 'Outro') === filters.type;
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      if (filters.sort === 'title') return String(a.title).localeCompare(String(b.title), 'pt');
      if (filters.sort === 'event') return new Date(b.event_date || 0) - new Date(a.event_date || 0);
      return new Date(b.created_at) - new Date(a.created_at);
    });
}

function renderGalleries() {
  clearElement(els.galleryBoard);
  els.galleryBoard.classList.toggle('is-grid', galleryLayout === 'grid');
  els.galleryBoard.classList.toggle('is-list', galleryLayout === 'list');
  const items = filteredAlbums();
  if (!items.length) return renderEmpty(els.galleryBoard, 'Nenhuma galeria corresponde aos filtros.');
  items.forEach((album) => els.galleryBoard.appendChild(galleryCard(album)));
}

function galleryCard(album) {
  const card = document.createElement('article');
  card.className = 'admin-gallery-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Gerir galeria ${album.title || 'sem nome'}`);
  const status = statusOf(album);
  const cover = coverNode(album);
  const info = document.createElement('div');
  info.className = 'admin-gallery-card__body';
  info.innerHTML = `
    <h3>${escapeText(album.title || 'Sem nome')}</h3>
    <p>${escapeText(album.event_type || 'Evento')} · ${escapeText(formatDate(album.event_date))}</p>
  `;
  const open = () => openDrawer(album, 1);
  card.append(cover, info, makeBadge(status));
  card.addEventListener('click', open);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function actionButton(label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    handler();
  });
  return button;
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function renderTypeFilter() {
  const selected = els.typeFilter.value || 'all';
  clearElement(els.typeFilter);
  const all = new Option('Todos os tipos', 'all');
  els.typeFilter.appendChild(all);
  [...new Set(albums.map((album) => album.event_type || 'Outro'))].sort().forEach((type) => els.typeFilter.appendChild(new Option(type, type)));
  els.typeFilter.value = [...els.typeFilter.options].some((option) => option.value === selected) ? selected : 'all';
  filters.type = els.typeFilter.value;
}

function renderAll() {
  renderTypeFilter();
  renderDashboard();
  renderGalleries();
}

function setStep(step) {
  currentStep = Math.max(1, Math.min(3, step));
  els.steps.forEach((panel) => panel.classList.toggle('is-active', Number(panel.dataset.step) === currentStep));
  els.stepButtons.forEach((button) => button.classList.toggle('is-active', Number(button.dataset.stepTarget) === currentStep));
  els.prevStep.hidden = currentStep === 1;
  els.nextStep.hidden = currentStep === 3;
  els.saveGallery.hidden = currentStep !== 3;
  if (currentStep === 3) renderConfirmSummary();
}

function resetForm() {
  currentAlbum = null;
  els.drawerForm.reset();
  fields.id.value = '';
  fields.isActive.checked = true;
  fields.downloadsEnabled.checked = false;
  fields.downloadAllEnabled.checked = false;
  fields.isArchived.checked = false;
  fields.watermarkEnabled.value = 'true';
  fields.watermarkPosition.value = 'bottom-center';
  fields.watermarkOpacity.value = '0.3';
  fields.watermarkScale.value = '0.2';
  fields.watermarkOriginalDownloads.value = 'false';
  updateWatermarkPreview();
  clearPendingFiles();
  renderPhotos([]);
  setCodeState('empty');
  setMessage('');
  els.drawerKicker.textContent = 'Nova galeria';
  els.drawerTitle.textContent = 'Criar galeria';
  els.drawerMeta.textContent = 'Fluxo em três passos com upload antes de concluir.';
  setStep(1);
}

function openDrawer(album = null, step = 1) {
  resetForm();
  if (album) {
    currentAlbum = album;
    fields.id.value = album.id || '';
    fields.title.value = album.title || '';
    fields.eventType.value = album.event_type || 'Outro';
    fields.eventDate.value = album.event_date || '';
    fields.location.value = album.location || '';
    fields.description.value = album.description || '';
    fields.guestMessage.value = album.guest_message || '';
    fields.expiresAt.value = album.expires_at ? album.expires_at.slice(0, 16) : '';
    fields.slug.value = album.slug || '';
    fields.isActive.checked = Boolean(album.is_active);
    fields.downloadsEnabled.checked = Boolean(album.downloads_enabled);
    fields.downloadAllEnabled.checked = Boolean(album.download_all_enabled);
    fields.isArchived.checked = Boolean(album.is_archived);
    fields.watermarkEnabled.value = album.watermark_enabled === false ? 'false' : 'true';
    fields.watermarkPosition.value = album.watermark_position || 'bottom-center';
    fields.watermarkOpacity.value = String(album.watermark_opacity ?? 0.3);
    fields.watermarkScale.value = String(album.watermark_scale ?? 0.2);
    fields.watermarkOriginalDownloads.value = album.watermark_original_downloads ? 'true' : 'false';
    updateWatermarkPreview();
    els.drawerKicker.textContent = 'Gerir galeria';
    els.drawerTitle.textContent = album.title || 'Galeria';
    els.drawerMeta.textContent = `${album.event_type || 'Evento'} · ${album.location || 'Sem local'} · ${album.access_code_masked || 'sem código'}`;
    renderPhotos(album.album_photos || []);
    setCodeState('hidden');
  }
  els.drawer.classList.add('is-open');
  els.drawer.classList.remove('is-minimized');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.drawerBackdrop.hidden = false;
  els.restoreDrawer.hidden = true;
  drawerMinimized = false;
  setStep(step);
  setTimeout(() => fields.title.focus(), 60);
}

function closeDrawer() {
  els.drawer.classList.remove('is-open');
  els.drawer.classList.remove('is-minimized');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.drawerBackdrop.hidden = true;
  els.restoreDrawer.hidden = true;
  drawerMinimized = false;
}

function minimizeDrawer() {
  if (!els.drawer.classList.contains('is-open')) return;
  els.drawer.classList.add('is-minimized');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.drawerBackdrop.hidden = true;
  els.restoreDrawer.hidden = false;
  drawerMinimized = true;
}

function restoreDrawer() {
  if (!drawerMinimized) return;
  els.drawer.classList.remove('is-minimized');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.drawerBackdrop.hidden = false;
  els.restoreDrawer.hidden = true;
  drawerMinimized = false;
  setTimeout(() => fields.title.focus(), 60);
}

function drawerHasDraft() {
  return Boolean(fields.title.value || fields.location.value || fields.description.value || fields.guestMessage.value || fields.eventDate.value || fields.expiresAt.value || pendingFiles.length);
}

async function discardDrawer() {
  if (!currentAlbum && drawerHasDraft()) {
    const confirmed = await askConfirm('Descartar esta galeria?', 'Os dados e ficheiros preparados serão eliminados.');
    if (!confirmed) return;
  }
  closeDrawer();
  resetForm();
}

function buildPayload(overrides = {}) {
  return {
    id: fields.id.value || null,
    title: fields.title.value,
    eventType: fields.eventType.value,
    slug: fields.slug.value,
    eventDate: fields.eventDate.value || null,
    location: fields.location.value,
    description: fields.description.value,
    guestMessage: fields.guestMessage.value,
    coverPath: overrides.coverPath || currentAlbum?.cover_path || null,
    downloadsEnabled: fields.downloadsEnabled.checked,
    downloadAllEnabled: fields.downloadAllEnabled.checked,
    watermarkEnabled: fields.watermarkEnabled.value !== 'false',
    watermarkPosition: fields.watermarkPosition.value,
    watermarkOpacity: Number(fields.watermarkOpacity.value || 0.3),
    watermarkScale: Number(fields.watermarkScale.value || 0.2),
    watermarkOriginalDownloads: fields.watermarkOriginalDownloads.value === 'true',
    isActive: fields.isActive.checked,
    isArchived: fields.isArchived.checked,
    status: fields.isArchived.checked ? 'archived' : (fields.isActive.checked ? 'active' : 'draft'),
    expiresAt: fields.expiresAt.value ? new Date(fields.expiresAt.value).toISOString() : null,
    ...overrides,
  };
}

async function saveGallery(event) {
  event.preventDefault();
  try {
    await withBusy(els.saveGallery, 'A guardar...', async () => {
      const payload = buildPayload();
      const result = await callAdmin('save-album', { album: payload });
      await loadAlbums();
      let updated = albums.find((album) => album.id === result.album.id) || result.album;
      const uploadResult = await uploadPendingFiles(updated);
      if (uploadResult.coverPath && uploadResult.coverPath !== updated.cover_path) {
        await callAdmin('save-album', { album: buildPayload({ id: updated.id, coverPath: uploadResult.coverPath }) });
        await loadAlbums();
        updated = albums.find((album) => album.id === result.album.id) || updated;
      }
      currentAlbum = updated;
      createdAlbumForModal = updated;
      setMessage('Galeria guardada.', 'success');
      toast('Galeria guardada.');
      renderAll();
      if (result.accessCode) {
        lastShownCode = result.accessCode;
        els.codeValue.textContent = result.accessCode;
        els.codeModal.showModal();
        setCodeState('visible', result.accessCode);
        closeDrawer();
      } else {
        openDrawer(updated, currentStep);
      }
    });
  } catch (error) {
    const message = friendlyError(error, 'Não foi possível guardar as alterações.');
    setMessage(message, 'error');
    toast(message, 'error');
  }
}

function addPendingFiles(files) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  const valid = [];
  files.forEach((file) => {
    if (!allowed.includes(file.type) || file.size > 50 * 1024 * 1024) {
      toast(`Ficheiro inválido: ${file.name}`, 'error');
      return;
    }
    valid.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      file,
      caption: '',
      previewUrl: URL.createObjectURL(file),
      status: 'ready',
    });
  });
  pendingFiles.push(...valid);
  if (!selectedPendingCoverId && pendingFiles[0]) selectedPendingCoverId = pendingFiles[0].id;
  renderPhotos(currentAlbum?.album_photos || []);
}

function clearPendingFiles() {
  pendingFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  pendingFiles = [];
  selectedPendingCoverId = null;
}

function renderPhotos(existing = []) {
  clearElement(els.photoList);
  const hasItems = existing.length || pendingFiles.length;
  if (!hasItems) return renderEmpty(els.photoList, 'Ainda não existem fotografias nesta galeria.');

  pendingFiles.forEach((item) => {
    const card = document.createElement('article');
    card.className = `admin-photo-card${selectedPendingCoverId === item.id ? ' is-cover' : ''}`;
    card.innerHTML = `<img src="${item.previewUrl}" alt="${escapeText(item.file.name)}"><strong>${escapeText(item.file.name)}</strong>`;
    const caption = document.createElement('input');
    caption.placeholder = 'Legenda';
    caption.value = item.caption;
    caption.addEventListener('input', () => { item.caption = caption.value; });
    const cover = actionButton(selectedPendingCoverId === item.id ? 'Capa' : 'Definir capa', () => {
      selectedPendingCoverId = item.id;
      renderPhotos(existing);
    });
    const remove = actionButton('Remover', () => {
      URL.revokeObjectURL(item.previewUrl);
      pendingFiles = pendingFiles.filter((pending) => pending.id !== item.id);
      renderPhotos(existing);
    });
    card.append(caption, cover, remove);
    els.photoList.appendChild(card);
  });

  existing.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((photo, index, ordered) => {
    const card = document.createElement('article');
    card.className = `admin-photo-card${currentAlbum?.cover_path === photo.storage_path ? ' is-cover' : ''}`;
    const processingStatus = photo.processing_status || 'pending';
    card.innerHTML = `
      <div class="admin-photo-placeholder">Foto</div>
      <strong>${escapeText(photo.filename)}</strong>
      <span>${escapeText(photo.caption || 'Sem legenda')}</span>
      <small class="admin-processing-status admin-processing-status--${escapeText(processingStatus)}">${processingLabel(processingStatus)}</small>
      ${photo.processing_error ? `<small class="admin-processing-error">${escapeText(photo.processing_error)}</small>` : ''}
    `;
    if (processingStatus === 'failed') {
      card.append(actionButton('Tentar novamente', () => retryPhotoProcessing(photo)));
    }
    card.append(
      actionButton('Capa', () => setCover(photo)),
      actionButton('↑', () => reorderPhoto(ordered, index, index - 1)),
      actionButton('↓', () => reorderPhoto(ordered, index, index + 1)),
      actionButton('Eliminar', () => deletePhoto(photo)),
    );
    els.photoList.appendChild(card);
  });
}

async function uploadPendingFiles(album) {
  if (!pendingFiles.length) return { coverPath: currentAlbum?.cover_path || null };
  els.uploadProgress.value = 0;
  els.uploadProgress.max = pendingFiles.length;
  let coverPath = currentAlbum?.cover_path || null;
  for (let index = 0; index < pendingFiles.length; index += 1) {
    const item = pendingFiles[index];
    item.status = 'uploading';
    const { path } = await callAdmin('create-storage-path', {
      albumId: album.id,
      filename: item.file.name,
      mimeType: item.file.type,
      size: item.file.size,
    });
    const { error } = await supabase.storage.from('private-galleries').upload(path, item.file, {
      contentType: item.file.type,
      upsert: false,
    });
    if (error) throw error;
    await callAdmin('register-photo', {
      photo: {
        albumId: album.id,
        storagePath: path,
        filename: item.file.name,
        caption: item.caption,
        sortOrder: (album.album_photos || []).length + index,
        sizeBytes: item.file.size,
      },
    });
    if (item.id === selectedPendingCoverId) coverPath = path;
    els.uploadProgress.value = index + 1;
  }
  clearPendingFiles();
  return { coverPath };
}

async function retryPhotoProcessing(photo) {
  if (!currentAlbum || !photo?.id) return;
  try {
    await callAdmin('queue-watermark-processing', { albumId: currentAlbum.id, photoIds: [photo.id] });
    await loadAlbums();
    const updated = albums.find((album) => album.id === currentAlbum.id);
    if (updated) openDrawer(updated, 2);
    toast('Processamento reenviado.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível reenviar o processamento.'), 'error');
  }
}

async function queueExistingWatermarks() {
  if (!currentAlbum) {
    toast('Guarde a galeria antes de aplicar a marca às fotografias existentes.', 'neutral');
    return;
  }
  if (!await askConfirm('Aplicar marca de água', 'Serão criadas tarefas apenas para fotografias sem versão processada ou com falha. Os originais não serão alterados.')) return;
  try {
    await withBusy(els.queueExistingWatermarks, 'A preparar...', async () => {
      const result = await callAdmin('queue-existing-watermarks', { albumId: currentAlbum.id });
      await loadAlbums();
      const updated = albums.find((album) => album.id === currentAlbum.id);
      if (updated) openDrawer(updated, 2);
      toast(`${result.queued || 0} fotografia(s) colocada(s) em processamento.`, 'neutral');
    });
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível criar tarefas de processamento.'), 'error');
  }
}

async function setCover(photo) {
  if (!currentAlbum) return;
  try {
    await callAdmin('save-album', { album: buildPayload({ coverPath: photo.storage_path }) });
    await loadAlbums();
    const updated = albums.find((album) => album.id === currentAlbum.id);
    if (updated) openDrawer(updated, 2);
    toast('Capa atualizada.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível definir a capa.'), 'error');
  }
}

async function reorderPhoto(items, from, to) {
  if (to < 0 || to >= items.length) return;
  const ordered = items.slice();
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  try {
    await callAdmin('reorder-photos', { photos: ordered.map((photo, index) => ({ id: photo.id, sortOrder: index })) });
    await loadAlbums();
    const updated = albums.find((album) => album.id === currentAlbum.id);
    if (updated) openDrawer(updated, 2);
    toast('Ordem atualizada.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível reorganizar as fotografias.'), 'error');
  }
}

async function deletePhoto(photo) {
  if (!await askConfirm('Eliminar fotografia', 'Esta fotografia será removida do armazenamento privado.')) return;
  try {
    await callAdmin('delete-photo', { photoId: photo.id });
    await loadAlbums();
    const updated = albums.find((album) => album.id === currentAlbum.id);
    if (updated) openDrawer(updated, 2);
    toast('Fotografia eliminada.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível eliminar a fotografia.'), 'error');
  }
}

function renderConfirmSummary() {
  clearElement(els.confirmSummary);
  const items = [
    ['Nome', fields.title.value || '—'],
    ['Tipo', fields.eventType.value || '—'],
    ['Data', formatDate(fields.eventDate.value, '—')],
    ['Local', fields.location.value || '—'],
    ['Fotografias', `${pendingFiles.length + photoCount(currentAlbum || {})}`],
    ['Estado', fields.isActive.checked ? 'Ativa' : 'Rascunho'],
    ['Marca de água', fields.watermarkEnabled.value === 'false' ? 'Desativada' : 'Ativa'],
    ['Download', fields.watermarkOriginalDownloads.value === 'true' ? 'Original autorizado' : 'Versão com marca'],
    ['Expiração', fields.expiresAt.value ? formatDate(fields.expiresAt.value) : 'Sem expiração'],
  ];
  items.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.innerHTML = `<span>${label}</span><strong>${escapeText(value)}</strong>`;
    els.confirmSummary.appendChild(row);
  });
}

function setCodeState(state, code = '') {
  const masked = currentAlbum?.access_code_masked || '••••-••••-••••';
  if (els.codeCard) els.codeCard.hidden = !currentAlbum && state === 'empty';
  if (state === 'visible') lastShownCode = code || lastShownCode;
  els.inlineCodeValue.textContent = state === 'visible' ? lastShownCode : masked;
  els.inlineCodeValue.classList.toggle('is-loading', state === 'loading');
  els.inlineCodeMessage.textContent =
    state === 'empty' ? 'O código será gerado automaticamente ao criar.' :
    state === 'loading' ? 'A obter código de forma segura...' :
    state === 'unrecoverable' ? 'O código original desta galeria não pode ser recuperado. Gere um novo código para continuar.' :
    state === 'error' ? 'Não foi possível obter o código.' :
    'Código protegido no servidor.';
  els.inlineShowCode.hidden = state === 'visible' || state === 'loading' || state === 'unrecoverable';
  els.inlineHideCode.hidden = state !== 'visible';
  els.inlineCopyCode.disabled = state !== 'visible';
  els.inlineCopyCode.hidden = state === 'unrecoverable';
  els.inlineCopyInstructions.disabled = state !== 'visible';
  els.inlineCopyInstructions.hidden = state === 'unrecoverable';
  els.inlineShowCode.disabled = !currentAlbum || state === 'loading';
  els.inlineRetryCode.hidden = state !== 'error';
  els.inlineRegenerateCode.hidden = state !== 'unrecoverable';
}

async function revealCode() {
  if (!currentAlbum || codeLoading) return;
  codeLoading = true;
  setCodeState('loading');
  try {
    const data = await callAdmin('get-code', { albumId: currentAlbum.id });
    lastShownCode = data.accessCode;
    setCodeState('visible', data.accessCode);
    toast('Código carregado.');
  } catch (error) {
    if (handleExpiredAdminSession(error)) return;
    if (error.status === 409 || error.code === 'code_unrecoverable') setCodeState('unrecoverable');
    else setCodeState('error');
    toast(friendlyError(error, 'Não foi possível obter o código.'), 'error');
  } finally {
    codeLoading = false;
  }
}

async function regenerateCode() {
  if (!currentAlbum) return;
  if (!await askConfirm('Gerar novo código', 'O código antigo deixa de funcionar e todas as sessões serão terminadas.')) return;
  try {
    const data = await callAdmin('regenerate-code', { albumId: currentAlbum.id });
    await loadAlbums();
    currentAlbum = albums.find((album) => album.id === currentAlbum.id) || currentAlbum;
    lastShownCode = data.accessCode;
    setCodeState('visible', data.accessCode);
    els.codeValue.textContent = data.accessCode;
    els.codeModal.showModal();
    toast('Novo código gerado.');
  } catch (error) {
    if (handleExpiredAdminSession(error)) return;
    toast(friendlyError(error, 'Não foi possível gerar novo código.'), 'error');
  }
}

async function endSessions() {
  if (!currentAlbum) return;
  if (!await askConfirm('Terminar sessões', 'Os convidados terão de introduzir novamente o código.')) return;
  try {
    await callAdmin('end-sessions', { albumId: currentAlbum.id });
    toast('Sessões terminadas.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível terminar sessões.'), 'error');
  }
}

async function setAlbumState(state) {
  if (!currentAlbum) return;
  const patch = state === 'active'
    ? { isActive: true, isArchived: false, status: 'active' }
    : state === 'disabled'
      ? { isActive: false, isArchived: false, status: 'disabled' }
      : { isArchived: true, status: 'archived' };
  try {
    await callAdmin('save-album', { album: buildPayload(patch) });
    await loadAlbums();
    const updated = albums.find((album) => album.id === currentAlbum.id);
    if (updated) openDrawer(updated, 1);
    toast('Estado atualizado.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível atualizar o estado.'), 'error');
  }
}

async function deleteAlbum() {
  if (!currentAlbum) return;
  if (!await askConfirm('Eliminar galeria', 'Esta ação elimina a galeria e as fotografias associadas. Confirme apenas se existe backup.')) return;
  try {
    await callAdmin('delete-album', { albumId: currentAlbum.id });
    closeDrawer();
    await loadAlbums();
    toast('Galeria eliminada.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível eliminar a galeria.'), 'error');
  }
}

async function loadAlbums() {
  skeletonDashboard();
  try {
    const data = await callAdmin('list');
    albums = data.albums || [];
    storageInfo = data.storage || null;
    renderAll();
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível carregar as galerias.'), 'error');
  }
}

async function showApp(activeSession) {
  session = activeSession;
  els.login.hidden = true;
  els.app.hidden = false;
  els.content.classList.toggle('is-overview-active', activeView === 'overview');
  await loadAlbums();
}

function showLogin() {
  session = null;
  els.login.hidden = false;
  els.app.hidden = true;
}

function openMobileSidebar() {
  els.app.classList.add('is-mobile-sidebar-open');
}

function closeMobileSidebar() {
  els.app.classList.remove('is-mobile-sidebar-open');
}

function handleExpiredAdminSession(error) {
  if (error?.status !== 401) return false;
  toast('A sua sessão expirou. Inicie sessão novamente.', 'error');
  showLogin();
  return true;
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) {
    els.loginMessage.textContent = 'Configure o ficheiro config.js antes de iniciar sessão.';
    return;
  }
  els.loginMessage.textContent = 'A entrar...';
  const email = els.loginForm.elements.email.value.trim();
  const password = els.loginForm.elements.password.value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    els.loginMessage.textContent = 'Email ou palavra-passe inválidos.';
    return;
  }
  els.loginMessage.textContent = '';
  await showApp(data.session);
});

els.logout.addEventListener('click', async () => {
  await withBusy(els.logout, 'A sair...', async () => {
    await supabase?.auth.signOut();
    showLogin();
  });
});

els.nav.forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$$('[data-new-gallery]').forEach((button) => button.addEventListener('click', () => openDrawer()));
$('[data-filter-expiring]').addEventListener('click', () => {
  filters.status = 'expiring';
  els.statusFilter.value = 'expiring';
  setView('galleries');
  renderGalleries();
});
$('[data-quick-upload]').addEventListener('click', () => {
  openUploadPicker();
});
els.accessManager?.addEventListener('click', openAccessManager);
els.closeUploadPicker?.addEventListener('click', () => els.uploadPickerModal.close());
els.uploadPickerModal?.addEventListener('click', (event) => {
  if (event.target === els.uploadPickerModal) els.uploadPickerModal.close();
});
els.uploadPickerSearch?.addEventListener('input', () => {
  uploadPickerFilters.search = els.uploadPickerSearch.value;
  renderUploadPicker();
});
els.uploadPickerStatus?.addEventListener('change', () => {
  uploadPickerFilters.status = els.uploadPickerStatus.value;
  renderUploadPicker();
});
els.reloadUploadPicker?.addEventListener('click', async () => {
  await withBusy(els.reloadUploadPicker, 'A atualizar...', async () => {
    await loadAlbums();
    renderUploadPicker();
  });
});
els.pickerNewGallery?.addEventListener('click', () => {
  els.uploadPickerModal.close();
  openDrawer(null, 1);
});
els.closeAccessModal?.addEventListener('click', () => els.accessModal.close());
els.accessModal?.addEventListener('click', (event) => {
  if (event.target === els.accessModal) els.accessModal.close();
});
els.profileMenu?.addEventListener('click', () => {
  setView('settings');
  toast('Definições abertas.', 'neutral');
});
els.toggleSidebar.addEventListener('click', () => {
  if (matchMedia('(max-width: 820px)').matches) openMobileSidebar();
  else els.app.classList.toggle('is-sidebar-collapsed');
});
els.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
els.closeDrawer.addEventListener('click', minimizeDrawer);
els.drawerBackdrop.addEventListener('click', minimizeDrawer);
els.restoreDrawer.addEventListener('click', restoreDrawer);
els.discardDrawer.addEventListener('click', discardDrawer);
els.previewGallery.addEventListener('click', () => {
  if (currentAlbum) window.open(albumUrl(currentAlbum), '_blank', 'noopener,noreferrer');
});
els.actionShowCode.addEventListener('click', () => {
  setStep(3);
  revealCode();
});
els.actionCopyInstructions.addEventListener('click', async () => {
  if (!currentAlbum) return;
  await navigator.clipboard.writeText(guestInstructions(currentAlbum, lastShownCode));
  toast('Instruções copiadas.');
});
els.actionRegenerateCode.addEventListener('click', regenerateCode);
els.actionEndSessions.addEventListener('click', endSessions);
els.actionActivate.addEventListener('click', () => setAlbumState('active'));
els.actionDisable.addEventListener('click', () => setAlbumState('disabled'));
els.actionArchive.addEventListener('click', () => setAlbumState('archived'));
els.actionDelete.addEventListener('click', deleteAlbum);
els.stepButtons.forEach((button) => button.addEventListener('click', () => setStep(Number(button.dataset.stepTarget))));
els.prevStep.addEventListener('click', () => setStep(currentStep - 1));
els.nextStep.addEventListener('click', () => setStep(currentStep + 1));
els.drawerForm.addEventListener('submit', saveGallery);
els.search.addEventListener('input', () => { filters.search = els.search.value; renderGalleries(); });
els.statusFilter.addEventListener('change', () => { filters.status = els.statusFilter.value; renderGalleries(); });
els.typeFilter.addEventListener('change', () => { filters.type = els.typeFilter.value; renderGalleries(); });
els.sortFilter.addEventListener('change', () => { filters.sort = els.sortFilter.value; renderGalleries(); });
els.chartRange.addEventListener('change', renderChart);
els.layoutButtons.forEach((button) => button.addEventListener('click', () => {
  galleryLayout = button.dataset.galleryLayout;
  els.layoutButtons.forEach((item) => item.classList.toggle('is-active', item === button));
  renderGalleries();
}));
els.uploadInput.addEventListener('change', () => {
  addPendingFiles([...els.uploadInput.files]);
  els.uploadInput.value = '';
});
els.queueExistingWatermarks?.addEventListener('click', queueExistingWatermarks);
[fields.watermarkEnabled, fields.watermarkPosition, fields.watermarkOpacity, fields.watermarkScale, fields.watermarkOriginalDownloads]
  .forEach((field) => field?.addEventListener('input', updateWatermarkPreview));
els.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  els.dropzone.classList.add('is-dragging');
});
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('is-dragging'));
els.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  els.dropzone.classList.remove('is-dragging');
  addPendingFiles([...event.dataTransfer.files]);
});
els.inlineShowCode.addEventListener('click', revealCode);
els.inlineRetryCode.addEventListener('click', revealCode);
els.inlineHideCode.addEventListener('click', () => setCodeState('hidden'));
els.inlineRegenerateCode.addEventListener('click', regenerateCode);
els.inlineCopyCode.addEventListener('click', async () => {
  if (!lastShownCode) return;
  await navigator.clipboard.writeText(lastShownCode);
  toast('Código copiado.');
});
els.inlineCopyInstructions.addEventListener('click', async () => {
  if (!currentAlbum) return;
  await navigator.clipboard.writeText(guestInstructions(currentAlbum, lastShownCode));
  toast('Instruções copiadas.');
});
els.copyCode.addEventListener('click', async () => {
  await navigator.clipboard.writeText(lastShownCode);
  toast('Código copiado.');
});
els.copyInstructions.addEventListener('click', async () => {
  const album = createdAlbumForModal || currentAlbum;
  await navigator.clipboard.writeText(guestInstructions(album, lastShownCode));
  toast('Instruções copiadas.');
});
els.openCreatedGallery.addEventListener('click', () => window.open(albumUrl(createdAlbumForModal || currentAlbum), '_blank', 'noopener,noreferrer'));
els.closeCodeModal.addEventListener('click', () => {
  els.codeModal.close();
  const album = createdAlbumForModal || currentAlbum;
  if (album) openDrawer(album, 1);
});
els.confirmCancel.addEventListener('click', () => {
  els.confirmModal.close();
  resolveConfirm(false);
});
els.confirmOk.addEventListener('click', () => {
  els.confirmModal.close();
  resolveConfirm(true);
});
els.confirmModal.addEventListener('cancel', () => resolveConfirm(false));
els.confirmModal.addEventListener('close', () => resolveConfirm(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMobileSidebar();
    if (els.drawer.classList.contains('is-open')) minimizeDrawer();
  }
});

document.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-album-action]');
  if (!action) return;
  const album = albums.find((item) => item.id === action.dataset.albumId);
  if (!album) return;
  openDrawer(album, Number(action.dataset.step || 1));
});

if (!supabase) {
  els.loginMessage.textContent = 'Configure config.js com SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.';
} else {
  const { data } = await supabase.auth.getSession();
  if (data.session) await showApp(data.session);
  else showLogin();
}

window.adminActions = {
  regenerateCode,
  endSessions,
  setAlbumState,
  deleteAlbum,
};
