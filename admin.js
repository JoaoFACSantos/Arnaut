import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dayDifference, formatExpirationStatus, startOfLocalDay } from './admin-utils.js';
import {
  DEFAULT_USER_PREFERENCES,
  formatInternationalPhone,
  galleryExpiryValue,
  normalizeAdminProfile,
  normalizeUserPreferences,
  passwordStrength,
  serializeForm,
  settingsSectionFromHash,
  validateAvatarFile,
} from './admin-settings.js';
import { clampFocalPoint, reorderPortfolioItems, validatePortfolioFileContent } from './portfolio-utils.js';

const config = window.ARNAUT_CONFIG || {};
const supabaseUrl = String(config.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const functionsBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : '';
const rememberPreferenceKey = 'fotografia-arnaut:remember-admin-session';
let rememberSession = localStorage.getItem(rememberPreferenceKey) === '1';
const authStorage = {
  getItem(key) {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },
  setItem(key, value) {
    const selectedStorage = rememberSession ? localStorage : sessionStorage;
    const otherStorage = rememberSession ? sessionStorage : localStorage;
    selectedStorage.setItem(key, value);
    otherStorage.removeItem(key);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
const supabase = supabaseUrl && config.SUPABASE_PUBLISHABLE_KEY
  ? createClient(supabaseUrl, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: authStorage,
      },
    })
  : null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  authGate: $('[data-auth-gate]'),
  authGateTitle: $('[data-auth-gate-title]'),
  authGateMessage: $('[data-auth-gate-message]'),
  authRetry: $('[data-auth-retry]'),
  login: $('[data-admin-login]'),
  app: $('[data-admin-app]'),
  loginForm: $('[data-login-form]'),
  loginMessage: $('[data-login-message]'),
  forgotPassword: $('[data-forgot-password]'),
  passwordToggles: $$('[data-password-toggle]'),
  logout: $('[data-logout]'),
  sidebar: $('[data-sidebar]'),
  sidebarBackdrop: $('[data-sidebar-backdrop]'),
  toggleSidebar: $('[data-toggle-sidebar]'),
  pageTitle: $('[data-page-title]'),
  notificationsToggle: $('[data-notifications-toggle]'),
  notificationsCount: $('[data-notifications-count]'),
  notificationsPanel: $('[data-notifications-panel]'),
  notificationsList: $('[data-notifications-list]'),
  notificationsReadAll: $('[data-notifications-read-all]'),
  globalSearchTrigger: $('[data-global-search-trigger]'),
  globalSearchDialog: $('[data-global-search-dialog]'),
  globalSearchInput: $('[data-global-search-input]'),
  globalSearchResults: $('[data-global-search-results]'),
  globalSearchClose: $('[data-global-search-close]'),
  content: $('.admin-content'),
  nav: $$('[data-view]'),
  viewPanels: $$('[data-view-panel]'),
  portfolioPage: $('[data-portfolio-page]'),
  portfolioGrid: $('[data-portfolio-grid]'),
  portfolioStatus: $('[data-portfolio-status]'),
  portfolioFilters: $('[data-portfolio-filters]'),
  portfolioSearch: $('[data-portfolio-search]'),
  portfolioState: $('[data-portfolio-state]'),
  portfolioFeatured: $('[data-portfolio-featured]'),
  portfolioTotal: $('[data-portfolio-total]'),
  portfolioLimit: $('[data-portfolio-limit]'),
  portfolioAdd: $('[data-portfolio-add]'),
  portfolioAddDialog: $('[data-portfolio-add-dialog]'),
  portfolioAddClose: $('[data-portfolio-add-close]'),
  portfolioAddCancel: $('[data-portfolio-add-cancel]'),
  portfolioSourceTabs: $$('[data-portfolio-source]'),
  portfolioUploadPanel: $('[data-portfolio-upload-panel]'),
  portfolioGalleryPanel: $('[data-portfolio-gallery-panel]'),
  portfolioSelectFiles: $('[data-portfolio-select-files]'),
  portfolioFileInput: $('[data-portfolio-file-input]'),
  portfolioUploadQueue: $('[data-portfolio-upload-queue]'),
  portfolioGallerySelect: $('[data-portfolio-gallery-select]'),
  portfolioGalleryPhotos: $('[data-portfolio-gallery-photos]'),
  portfolioAddCategory: $('[data-portfolio-add-category]'),
  portfolioAddPublished: $('[data-portfolio-add-published]'),
  portfolioAddSubmit: $('[data-portfolio-add-submit]'),
  portfolioAddMessage: $('[data-portfolio-add-message]'),
  portfolioEditDialog: $('[data-portfolio-edit-dialog]'),
  portfolioEditClose: $('[data-portfolio-edit-close]'),
  portfolioEditCancel: $('[data-portfolio-edit-cancel]'),
  portfolioEditSave: $('[data-portfolio-edit-save]'),
  portfolioEditImage: $('[data-portfolio-edit-image]'),
  portfolioEditCategory: $('[data-portfolio-edit-category]'),
  portfolioEditAlt: $('[data-portfolio-edit-alt]'),
  portfolioEditTitle: $('[data-portfolio-edit-title]'),
  portfolioEditPublished: $('[data-portfolio-edit-published]'),
  portfolioEditFeatured: $('[data-portfolio-edit-featured]'),
  portfolioFocal: $('[data-portfolio-focal]'),
  portfolioFocalMarker: $('[data-portfolio-focal-marker]'),
  portfolioFocalX: $('[data-portfolio-focal-x]'),
  portfolioFocalY: $('[data-portfolio-focal-y]'),
  portfolioEditMessage: $('[data-portfolio-edit-message]'),
  portfolioMenu: $('[data-portfolio-menu]'),
  portfolioReplaceInput: $('[data-portfolio-replace-input]'),
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
  restoreTitle: $('[data-restore-title]'),
  restoreMeta: $('[data-restore-meta]'),
  restoreThumb: $('[data-restore-thumb]'),
  drawerForm: $('[data-gallery-form]'),
  drawerTitle: $('[data-drawer-title]'),
  drawerMeta: $('[data-drawer-meta]'),
  finalStepLabel: $('[data-final-step-label]'),
  finalPanelTitle: $('[data-final-panel-title]'),
  finalPanelDescription: $('[data-final-panel-description]'),
  publishChoices: $$('[data-publish-choice]'),
  noExpiration: $('[data-no-expiration]'),
  closeDrawer: $('[data-close-drawer]'),
  discardDrawer: $('[data-discard-drawer]'),
  previewGallery: $('[data-preview-gallery]'),
  galleryActionsToggle: $('[data-gallery-actions-toggle]'),
  galleryActionsMenu: $('[data-gallery-actions-menu]'),
  actionShowCode: $('[data-action-show-code]'),
  actionCopyInstructions: $('[data-action-copy-instructions]'),
  actionRegenerateCode: $('[data-action-regenerate-code]'),
  actionEndSessions: $('[data-action-end-sessions]'),
  actionToggleState: $('[data-action-toggle-state]'),
  actionDelete: $('[data-action-delete]'),
  stepButtons: $$('[data-step-target]'),
  steps: $$('[data-step]'),
  prevStep: $('[data-prev-step]'),
  nextStep: $('[data-next-step]'),
  saveGallery: $('[data-save-gallery]'),
  albumMessage: $('[data-album-message]'),
  dropzone: $('[data-dropzone]'),
  selectPhotos: $('[data-select-photos]'),
  uploadInput: $('[data-photo-upload]'),
  uploadProgress: $('[data-upload-progress]'),
  photoList: $('[data-photo-list]'),
  confirmSummary: $('[data-confirm-summary]'),
  codeValue: $('[data-code-value]'),
  codeCard: $('[data-code-card]'),
  codeModal: $('[data-code-modal]'),
  copyCode: $('[data-copy-code]'),
  copyInstructions: $('[data-copy-guest-instructions]'),
  openCreatedGallery: $('[data-open-created-gallery]'),
  closeCodeModal: $('[data-close-code-modal]'),
  dismissCodeModal: $('[data-dismiss-code-modal]'),
  originalDownloadsSetting: $('[data-original-downloads-setting]'),
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
  mobileProfileMenu: $('[data-mobile-profile-menu]'),
  mobileAvatarImage: $('[data-mobile-avatar-image]'),
  mobileAvatarFallback: $('[data-mobile-avatar-fallback]'),
  profilePopover: $('[data-profile-popover]'),
  profileEdit: $('[data-profile-edit]'),
  profileLogout: $('[data-profile-logout]'),
  profileName: $('[data-profile-name]'),
  profileAvatarImage: $('[data-profile-avatar-image]'),
  profileAvatarFallback: $('[data-profile-avatar-fallback]'),
  profileForm: $('[data-profile-form]'),
  profileMessage: $('[data-profile-message]'),
  saveProfile: $('[data-save-profile]'),
  selectAvatar: $('[data-select-avatar]'),
  removeAvatar: $('[data-remove-avatar]'),
  avatarUpload: $('[data-avatar-upload]'),
  settingsAvatarImage: $('[data-settings-avatar-image]'),
  settingsAvatarFallback: $('[data-settings-avatar-fallback]'),
  settingsProfileName: $('[data-settings-profile-name]'),
  bioCount: $('[data-bio-count]'),
  avatarProgress: $('[data-avatar-progress]'),
  contactForm: $('[data-contact-form]'),
  contactMessage: $('[data-contact-message]'),
  saveContact: $('[data-save-contact]'),
  emailForm: $('[data-email-form]'),
  emailMessage: $('[data-email-message]'),
  emailStatus: $('[data-email-status]'),
  emailPending: $('[data-email-pending]'),
  changeEmail: $('[data-change-email]'),
  preferencesForm: $('[data-preferences-form]'),
  preferencesMessage: $('[data-preferences-message]'),
  savePreferences: $('[data-save-preferences]'),
  customExpiry: $('[data-custom-expiry]'),
  settingsNav: $$('[data-settings-section]'),
  settingsPanels: $$('[data-settings-panel]'),
  settingsForms: $$('[data-settings-form]'),
  supportLink: $('[data-support-link]'),
  storageSettings: $('[data-storage-settings]'),
  storageTotal: $('[data-storage-total]'),
  storagePercent: $('[data-storage-percent]'),
  storageSource: $('[data-storage-source]'),
  storageSettingsBar: $('[data-storage-settings-bar]'),
  storageBreakdown: $('[data-storage-breakdown]'),
  storageRefresh: $('[data-storage-refresh]'),
  passwordForm: $('[data-password-form]'),
  passwordMessage: $('[data-password-message]'),
  changePassword: $('[data-change-password]'),
  passwordStrengthBar: $('[data-password-strength-bar]'),
  passwordStrengthLabel: $('[data-password-strength-label]'),
  currentPasswordRow: $('[data-current-password-row]'),
  sessionStatus: $('[data-session-status]'),
  sessionEmail: $('[data-session-email]'),
  sessionLastSignIn: $('[data-session-last-sign-in]'),
  sessionCreatedAt: $('[data-session-created-at]'),
  sessionDevice: $('[data-session-device]'),
  sessionMessage: $('[data-session-message]'),
  signoutOthers: $('[data-signout-others]'),
  signoutAll: $('[data-signout-all]'),
  settingsLogout: $('[data-settings-logout]'),
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
  accessSearch: $('[data-access-search]'),
  accessFilterButtons: $$('[data-access-filter]'),
  accessSort: $('[data-access-sort]'),
  accessActiveCount: $('[data-access-active-count]'),
  accessExpiredCount: $('[data-access-expired-count]'),
  accessTotal: $('[data-access-total]'),
  accessList: $('[data-access-list]'),
  closeAccessModal: $$('[data-close-access-modal]'),
  minimizeDrawer: $('[data-minimize-drawer]'),
  quickSaveDrawer: $('[data-quick-save-drawer]'),
  salesSettings: $('[data-sales-settings]'),
  salesFreeDownload: $('[data-sales-free-download]'),
  ordersList: $('[data-orders-list]'),
  ordersRefresh: $('[data-orders-refresh]'),
  orderGalleryFilter: $('[data-order-gallery-filter]'),
  orderStatusFilter: $('[data-order-status-filter]'),
  orderEmailFilter: $('[data-order-email-filter]'),
  orderDateFrom: $('[data-order-date-from]'),
  orderDateTo: $('[data-order-date-to]'),
  orderDialog: $('[data-order-dialog]'),
  orderDetail: $('[data-order-detail]'),
  closeOrderDialog: $('[data-close-order-dialog]'),
  billingPage: $('[data-billing-page]'),
  billingMetrics: $('[data-billing-metrics]'),
  billingError: $('[data-billing-error]'),
  billingErrorMessage: $('[data-billing-error-message]'),
  billingRefresh: $('[data-billing-refresh]'),
  billingRetry: $('[data-billing-retry]'),
  billingDashboardView: $('[data-billing-dashboard-view]'),
  billingListView: $('[data-billing-list-view]'),
  billingRecentTable: $('[data-billing-recent-table]'),
  billingChart: $('[data-billing-chart]'),
  billingChartRange: $('[data-billing-chart-range]'),
  billingStripe: $('[data-billing-stripe]'),
  billingProfile: $('[data-billing-profile]'),
  billingViewAll: $('[data-billing-view-all]'),
  billingBack: $('[data-billing-back]'),
  billingExport: $$('[data-billing-export]'),
  billingManageStripe: $('[data-billing-manage-stripe]'),
  billingEditProfile: $('[data-billing-edit-profile]'),
  billingUpdateProfile: $('[data-billing-update-profile]'),
  billingSearch: $('[data-billing-search]'),
  billingStatusFilter: $('[data-billing-status-filter]'),
  billingDateFrom: $('[data-billing-date-from]'),
  billingDateTo: $('[data-billing-date-to]'),
  billingSort: $('[data-billing-sort]'),
  billingListTable: $('[data-billing-list-table]'),
  billingPagination: $('[data-billing-pagination]'),
  billingProfileDialog: $('[data-billing-profile-dialog]'),
  billingProfileForm: $('[data-billing-profile-form]'),
  billingProfileMessage: $('[data-billing-profile-message]'),
  closeBillingProfile: $$('[data-close-billing-profile]'),
  billingDetailDialog: $('[data-billing-detail-dialog]'),
  billingDetail: $('[data-billing-detail]'),
  closeBillingDetail: $('[data-close-billing-detail]'),
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
  watermarkEnabled: els.drawerForm.elements.watermarkEnabled,
  watermarkOriginalDownloads: els.drawerForm.elements.watermarkOriginalDownloads,
  salesEnabled: els.drawerForm.elements.salesEnabled,
  photoPrice: els.drawerForm.elements.photoPrice,
  currency: els.drawerForm.elements.currency,
  downloadExpiryDays: els.drawerForm.elements.downloadExpiryDays,
  salesSupportEmail: els.drawerForm.elements.salesSupportEmail,
  refundPolicyText: els.drawerForm.elements.refundPolicyText,
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
let albumLoadVersion = 0;
let authenticatedUserId = '';
let appLoadPromise = null;
let recoveryMode = false;
let adminNotifications = [];
let notificationsRefreshTimer = 0;
let globalSearchOrders = [];
let globalSearchOrdersLoaded = false;
let drawerDirty = false;
let drawerSaving = false;
let pendingLoginNotice = '';
let profileAvatarPath = '';
let profileAvatarUrl = '';
let adminProfile = null;
let userPreferences = { ...DEFAULT_USER_PREFERENCES };
let settingsSchemaAvailable = true;
let settingsSection = 'profile';
let settingsBaselines = new Map();
let pendingAvatarBlob = null;
let pendingAvatarPreviewUrl = '';
let removeAvatarRequested = false;
let saveAsDraftRequested = false;
let detailsValidationAttempted = false;
let orders = [];
let billingDashboard = null;
let billingProfile = null;
let billingListMode = false;
let billingListPage = 1;
let billingListCount = 0;
let billingListRecords = [];
let billingLoading = false;
let billingFilters = { search: '', status: '', dateFrom: '', dateTo: '', sort: 'recent' };
const accessCodeCache = new Map();
const visibleAccessCodes = new Set();
let accessFilters = { search: '', status: 'active', sort: 'recent' };
let portfolioPhotos = [];
let portfolioCategories = [];
let portfolioFilter = 'all';
let portfolioSearch = '';
let portfolioState = 'all';
let portfolioFeatured = 'all';
let portfolioLoaded = false;
let portfolioLoading = false;
let portfolioPendingFiles = [];
let portfolioGallerySelections = new Map();
let portfolioEditingPhoto = null;
let portfolioReplacingPhoto = null;
let portfolioDragId = '';

function clearElement(element) {
  if (!element) return;
  while (element.firstChild) element.removeChild(element.firstChild);
}

function appendChildren(container, children) {
  const fragment = document.createDocumentFragment();
  children.forEach((child) => fragment.appendChild(child));
  container.appendChild(fragment);
}

function debounce(callback, delay = 140) {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
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
  const settingsForm = button?.closest?.('[data-settings-form]');
  if (button) {
    button.disabled = true;
    button.dataset.loading = 'true';
    if (text) button.textContent = text;
  }
  try {
    return await task();
  } finally {
    if (button) {
      button.disabled = settingsForm ? !updateSettingsSaveState(settingsForm) : false;
      button.dataset.loading = 'false';
      if (previous) button.textContent = previous;
    }
  }
}

function askConfirm(title, message, options = {}) {
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  els.confirmCancel.textContent = options.cancelLabel || 'Cancelar';
  els.confirmOk.textContent = options.confirmLabel || 'Confirmar';
  els.confirmModal.showModal();
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

function resolveConfirm(value) {
  confirmResolve?.(value);
  confirmResolve = null;
  els.confirmCancel.textContent = 'Cancelar';
  els.confirmOk.textContent = 'Confirmar';
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
async function callAdminOrders(action, payload = {}) {
  if (!supabase || !functionsBase) throw new Error('Supabase não está configurado.');
  const { data } = await supabase.auth.getSession();
  session = data.session || session;
  if (!session?.access_token) throw new Error('Sessão de administração inválida.');
  const response = await fetch(`${functionsBase}/admin-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Operação falhou.');
  return body;
}

async function callAdminBilling(action, payload = {}) {
  if (!supabase || !functionsBase) throw new Error('Supabase não está configurado.');
  const { data } = await supabase.auth.getSession();
  session = data.session || session;
  if (!session?.access_token) throw new Error('Sessão de administração inválida.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const response = await fetch(`${functionsBase}/admin-billing`, {
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
    const error = new Error(body.error || 'A operação de faturação falhou.');
    error.status = response.status;
    throw error;
  }
  return body;
}

async function callAdminPortfolio(action, payload = {}) {
  if (!supabase || !functionsBase) throw new Error('Supabase não está configurado.');
  const { data } = await supabase.auth.getSession();
  session = data.session || session;
  if (!session?.access_token) throw new Error('Sessão de administração inválida.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(`${functionsBase}/admin-portfolio`, {
    method: 'POST', signal: controller.signal,
    headers: { 'Content-Type': 'application/json', apikey: config.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  }).finally(() => clearTimeout(timeout));
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'A operação do Portefólio falhou.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function portfolioAssetUrl(photo, thumbnail = true) {
  const value = thumbnail ? photo.thumbnail_url || photo.web_url : photo.web_url || photo.thumbnail_url;
  if (!value) return '';
  return /^https?:/i.test(value) ? value : new URL(value, document.baseURI).href;
}

function renderPortfolioSkeleton() {
  clearElement(els.portfolioGrid);
  for (let index = 0; index < 8; index += 1) {
    const item = document.createElement('div');
    item.className = 'portfolio-skeleton';
    els.portfolioGrid.appendChild(item);
  }
}

function renderPortfolioFilters() {
  clearElement(els.portfolioFilters);
  const filters = [{ slug: 'all', label: 'Todas', count: portfolioPhotos.length }, ...portfolioCategories.map((category) => ({
    slug: category.slug, label: category.label, count: portfolioPhotos.filter((photo) => photo.portfolio_categories?.slug === category.slug).length,
  }))];
  filters.forEach((filter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = portfolioFilter === filter.slug ? 'is-active' : '';
    button.innerHTML = `${escapeText(filter.label)} <b>${filter.count}</b>`;
    button.addEventListener('click', () => { portfolioFilter = filter.slug; renderPortfolio(); });
    els.portfolioFilters.appendChild(button);
  });
}

function closePortfolioMenu() {
  els.portfolioMenu.hidden = true;
  clearElement(els.portfolioMenu);
}

function openPortfolioEditor(photo) {
  portfolioEditingPhoto = photo;
  fillPortfolioCategorySelect(els.portfolioEditCategory, photo.category_id);
  els.portfolioEditTitle.value = photo.internal_title || '';
  els.portfolioEditAlt.value = photo.alt_text || '';
  els.portfolioEditPublished.checked = Boolean(photo.is_published);
  els.portfolioEditFeatured.checked = Boolean(photo.is_featured);
  els.portfolioFocalX.value = photo.focal_x ?? 50;
  els.portfolioFocalY.value = photo.focal_y ?? 50;
  els.portfolioEditImage.src = portfolioAssetUrl(photo, false);
  els.portfolioEditImage.alt = photo.alt_text || 'Pré-visualização da fotografia';
  updatePortfolioFocalMarker();
  els.portfolioEditMessage.textContent = '';
  els.portfolioEditDialog.showModal();
}

function portfolioMenuAction(label, action, danger = false) {
  const button = document.createElement('button');
  button.type = 'button'; button.role = 'menuitem'; button.textContent = label;
  if (danger) button.className = 'is-danger';
  button.addEventListener('click', async () => { closePortfolioMenu(); await action(); });
  return button;
}

function openPortfolioMenu(photo, anchor) {
  clearElement(els.portfolioMenu);
  els.portfolioMenu.append(
    portfolioMenuAction('Editar', () => openPortfolioEditor(photo)),
    portfolioMenuAction(photo.is_published ? 'Ocultar' : 'Publicar', async () => {
      await callAdminPortfolio('save', { photo: { id: photo.id, categoryId: photo.category_id, internalTitle: photo.internal_title, altText: photo.alt_text, focalX: photo.focal_x, focalY: photo.focal_y, isPublished: !photo.is_published, isFeatured: photo.is_featured } });
      toast(photo.is_published ? 'Fotografia ocultada.' : 'Fotografia publicada.'); await loadPortfolio({ force: true });
    }),
    portfolioMenuAction(photo.is_featured ? 'Remover destaque' : 'Marcar como destaque', async () => {
      await callAdminPortfolio('save', { photo: { id: photo.id, categoryId: photo.category_id, internalTitle: photo.internal_title, altText: photo.alt_text, focalX: photo.focal_x, focalY: photo.focal_y, isPublished: photo.is_published, isFeatured: !photo.is_featured } });
      await loadPortfolio({ force: true });
    }),
    portfolioMenuAction('Substituir fotografia', () => { portfolioReplacingPhoto = photo; els.portfolioReplaceInput.click(); }),
    portfolioMenuAction('Mover para cima', () => movePortfolioPhoto(photo.id, -1)),
    portfolioMenuAction('Mover para baixo', () => movePortfolioPhoto(photo.id, 1)),
    portfolioMenuAction('Eliminar', async () => {
      const confirmed = await askConfirm('Eliminar fotografia?', 'Esta fotografia deixará de aparecer no portefólio. O original de uma galeria privada não será eliminado.', { confirmLabel: 'Eliminar' });
      if (!confirmed) return;
      await callAdminPortfolio('delete', { photoId: photo.id }); toast('Fotografia removida.'); await loadPortfolio({ force: true });
    }, true),
  );
  const rect = anchor.getBoundingClientRect();
  els.portfolioMenu.style.left = `${Math.min(window.innerWidth - 225, Math.max(10, rect.right - 210))}px`;
  els.portfolioMenu.style.top = `${Math.min(window.innerHeight - 285, rect.bottom + 6)}px`;
  els.portfolioMenu.hidden = false;
}

function renderPortfolio() {
  renderPortfolioFilters();
  clearElement(els.portfolioGrid);
  els.portfolioStatus.className = 'admin-portfolio__status';
  els.portfolioStatus.innerHTML = '';
  const query = portfolioSearch.trim().toLocaleLowerCase('pt');
  const visible = portfolioPhotos.filter((photo) => {
    if (portfolioFilter !== 'all' && photo.portfolio_categories?.slug !== portfolioFilter) return false;
    if (portfolioState === 'published' && !photo.is_published) return false;
    if (portfolioState === 'hidden' && photo.is_published) return false;
    if (portfolioFeatured === 'featured' && !photo.is_featured) return false;
    if (portfolioFeatured === 'regular' && photo.is_featured) return false;
    if (query && ![photo.internal_title, photo.alt_text, photo.portfolio_categories?.label].some((value) => String(value || '').toLocaleLowerCase('pt').includes(query))) return false;
    return true;
  });
  if (!portfolioPhotos.length) {
    els.portfolioStatus.classList.add('is-empty');
    els.portfolioStatus.innerHTML = '<div><h3>O seu Portefólio ainda está vazio</h3><p>Adicione fotografias para começar a construir o seu Trabalho recente.</p><button class="admin-primary" type="button">＋ Adicionar fotografias</button></div>';
    els.portfolioStatus.querySelector('button').addEventListener('click', openPortfolioAddDialog);
  }
  visible.forEach((photo) => {
    const position = portfolioPhotos.findIndex((item) => item.id === photo.id) + 1;
    const card = document.createElement('article');
    card.className = 'portfolio-card'; card.draggable = true; card.dataset.photoId = photo.id;
    card.style.setProperty('--focal-x', `${photo.focal_x ?? 50}%`); card.style.setProperty('--focal-y', `${photo.focal_y ?? 50}%`);
    const imageUrl = portfolioAssetUrl(photo);
    card.innerHTML = `<span class="portfolio-card__position">${String(position).padStart(2, '0')}</span>${photo.is_featured ? '<span class="portfolio-card__featured">Destaque</span>' : ''}<button class="portfolio-card__menu" type="button" aria-label="Ações da fotografia" aria-haspopup="menu">•••</button><div class="portfolio-card__image"><img src="${escapeText(imageUrl)}" alt="${escapeText(photo.alt_text || '')}" loading="lazy"></div><div class="portfolio-card__meta"><span title="${escapeText(photo.internal_title || '')}">${escapeText(photo.internal_title || photo.portfolio_categories?.label || '')}</span><i class="portfolio-status-dot${photo.is_published ? ' is-published' : ''}" aria-hidden="true"></i><span>${photo.is_published ? 'Publicada' : 'Oculta'}</span><b class="portfolio-card__drag" title="Arrastar para reordenar" aria-label="Arrastar para reordenar"><i></i><i></i><i></i><i></i><i></i><i></i></b></div>`;
    card.querySelector('.portfolio-card__menu').addEventListener('click', (event) => openPortfolioMenu(photo, event.currentTarget));
    card.addEventListener('dragstart', () => { portfolioDragId = photo.id; card.classList.add('is-dragging'); });
    card.addEventListener('dragend', () => { portfolioDragId = ''; card.classList.remove('is-dragging'); document.querySelectorAll('.is-drag-over').forEach((item) => item.classList.remove('is-drag-over')); });
    card.addEventListener('dragover', (event) => { event.preventDefault(); if (portfolioDragId && portfolioDragId !== photo.id) card.classList.add('is-drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'));
    card.addEventListener('drop', async (event) => { event.preventDefault(); card.classList.remove('is-drag-over'); if (!portfolioDragId) return; portfolioPhotos = reorderPortfolioItems(portfolioPhotos, portfolioDragId, photo.id); renderPortfolio(); await persistPortfolioOrder(); });
    els.portfolioGrid.appendChild(card);
  });
  const published = portfolioPhotos.filter((photo) => photo.is_published).length;
  els.portfolioTotal.textContent = `${portfolioPhotos.length} fotografias no total · ${published} publicadas`;
  if (portfolioPhotos.length && !visible.length) {
    els.portfolioStatus.classList.add('is-empty');
    els.portfolioStatus.innerHTML = '<div><h3>Sem resultados</h3><p>Altere a pesquisa ou os filtros aplicados.</p></div>';
  }
}

async function loadPortfolio({ force = false } = {}) {
  if (portfolioLoading || (portfolioLoaded && !force)) return;
  portfolioLoading = true; renderPortfolioSkeleton();
  try {
    const result = await callAdminPortfolio('list');
    portfolioPhotos = result.photos || []; portfolioCategories = result.categories || []; portfolioLoaded = true;
    els.portfolioLimit.value = String(result.maxRecent || 8); renderPortfolio();
  } catch (error) {
    clearElement(els.portfolioGrid); els.portfolioStatus.className = 'admin-portfolio__status is-error';
    els.portfolioStatus.innerHTML = '<div><h3>Não foi possível carregar o Portefólio.</h3><button type="button">Tentar novamente</button></div>';
    els.portfolioStatus.querySelector('button').addEventListener('click', () => loadPortfolio({ force: true }));
  } finally { portfolioLoading = false; }
}

async function persistPortfolioOrder() {
  els.portfolioStatus.className = 'admin-portfolio__status is-saving';
  els.portfolioStatus.textContent = 'A guardar…';
  try {
    await callAdminPortfolio('reorder', { items: portfolioPhotos.map(({ id }) => ({ id })) });
    els.portfolioStatus.className = 'admin-portfolio__status is-saved';
    els.portfolioStatus.textContent = 'Guardado';
    clearTimeout(persistPortfolioOrder.timer);
    persistPortfolioOrder.timer = setTimeout(() => {
      if (els.portfolioStatus.classList.contains('is-saved')) {
        els.portfolioStatus.className = 'admin-portfolio__status';
        els.portfolioStatus.textContent = '';
      }
    }, 2200);
  } catch (error) {
    els.portfolioStatus.className = 'admin-portfolio__status is-error-inline';
    els.portfolioStatus.innerHTML = 'Não foi possível guardar. <button type="button">Tentar novamente</button>';
    els.portfolioStatus.querySelector('button').addEventListener('click', persistPortfolioOrder, { once: true });
  }
}

async function movePortfolioPhoto(id, direction) {
  const index = portfolioPhotos.findIndex((photo) => photo.id === id); const target = index + direction;
  if (index < 0 || target < 0 || target >= portfolioPhotos.length) return;
  portfolioPhotos = reorderPortfolioItems(portfolioPhotos, id, portfolioPhotos[target].id); renderPortfolio(); await persistPortfolioOrder();
}

function fillPortfolioCategorySelect(select, selected = '') {
  clearElement(select);
  portfolioCategories.forEach((category) => { const option = document.createElement('option'); option.value = category.id; option.textContent = category.label; option.selected = category.id === selected; select.appendChild(option); });
}

function imageElementFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image(); const url = URL.createObjectURL(blob);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a fotografia.')); };
    image.src = url;
  });
}

async function optimizePortfolioAsset(blob, maxSize, quality, crop = false) {
  const image = 'createImageBitmap' in window ? await createImageBitmap(blob) : await imageElementFromBlob(blob);
  const ratio = crop ? Math.max(maxSize / image.width, maxSize / image.height) : Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = crop ? maxSize : Math.max(1, Math.round(image.width * ratio));
  const height = crop ? maxSize : Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (crop) {
    const scaledWidth = image.width * ratio; const scaledHeight = image.height * ratio;
    context.drawImage(image, (width - scaledWidth) / 2, (height - scaledHeight) / 2, scaledWidth, scaledHeight);
  } else context.drawImage(image, 0, 0, width, height);
  image.close?.();
  const output = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Não foi possível otimizar a fotografia.')), 'image/webp', quality));
  return { blob: output, width, height };
}

async function uploadPortfolioSource(source, { published, categoryId }) {
  const response = await fetch(source.url);
  if (!response.ok) throw new Error('Não foi possível ler a fotografia selecionada.');
  const input = await response.blob();
  const web = await optimizePortfolioAsset(input, 2200, .84, false);
  const thumb = await optimizePortfolioAsset(input, 500, .82, true);
  const result = await callAdminPortfolio('create-record', { source: {
    categoryId, sourcePhotoId: source.sourcePhotoId, sourceGalleryId: source.sourceGalleryId,
    altText: source.altText || '', isPublished: published, width: web.width, height: web.height, sizeBytes: input.size,
  } });
  const paths = result.photo;
  const uploaded = [];
  try {
    for (const [path, asset] of [[paths.web_path, web.blob], [paths.thumbnail_path, thumb.blob]]) {
      const { error } = await supabase.storage.from('public-portfolio').upload(path, asset, { contentType: 'image/webp', upsert: false });
      if (error) throw error; uploaded.push(path);
    }
  } catch (error) {
    if (uploaded.length) await supabase.storage.from('public-portfolio').remove(uploaded);
    await callAdminPortfolio('delete', { photoId: paths.id }).catch(() => {});
    throw error;
  }
}

function resetPortfolioAddDialog() {
  portfolioPendingFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  portfolioPendingFiles = []; portfolioGallerySelections.clear();
  clearElement(els.portfolioUploadQueue); clearElement(els.portfolioGalleryPhotos);
  els.portfolioGallerySelect.value = ''; els.portfolioAddPublished.checked = false;
  els.portfolioAddMessage.textContent = ''; updatePortfolioAddButton();
}

async function openPortfolioAddDialog() {
  fillPortfolioCategorySelect(els.portfolioAddCategory);
  resetPortfolioAddDialog(); setPortfolioSource('computer');
  els.portfolioAddDialog.showModal();
  try {
    const result = await callAdminPortfolio('albums'); clearElement(els.portfolioGallerySelect);
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Selecione uma galeria'; els.portfolioGallerySelect.appendChild(placeholder);
    (result.albums || []).forEach((album) => { const option = document.createElement('option'); option.value = album.id; option.textContent = album.title; els.portfolioGallerySelect.appendChild(option); });
  } catch (error) { els.portfolioAddMessage.textContent = 'Não foi possível carregar as galerias existentes.'; }
}

function setPortfolioSource(source) {
  els.portfolioSourceTabs.forEach((button) => { const active = button.dataset.portfolioSource === source; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', String(active)); });
  els.portfolioUploadPanel.hidden = source !== 'computer'; els.portfolioGalleryPanel.hidden = source !== 'gallery'; updatePortfolioAddButton();
}

function updatePortfolioAddButton() {
  const count = els.portfolioGalleryPanel.hidden ? portfolioPendingFiles.length : portfolioGallerySelections.size;
  els.portfolioAddSubmit.disabled = count === 0;
  els.portfolioAddSubmit.textContent = `${els.portfolioAddPublished.checked ? 'Publicar' : 'Adicionar como oculta'}${count ? ` (${count})` : ''}`;
}

async function addPortfolioFiles(files) {
  for (const file of [...files]) {
    const validation = await validatePortfolioFileContent(file);
    if (!validation.valid) { toast(`${file.name}: ${validation.error}`, 'error'); return; }
    portfolioPendingFiles.push({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), status: 'Pronta' });
  }
  renderPortfolioUploadQueue(); updatePortfolioAddButton();
}

function renderPortfolioUploadQueue() {
  clearElement(els.portfolioUploadQueue);
  portfolioPendingFiles.forEach((item) => {
    const row = document.createElement('div'); row.className = 'portfolio-upload-item';
    row.innerHTML = `<img src="${item.previewUrl}" alt=""><div><strong>${escapeText(item.file.name)}</strong><small>${escapeText(item.status)}</small></div><button type="button" aria-label="Remover">×</button>`;
    row.querySelector('button').addEventListener('click', () => { URL.revokeObjectURL(item.previewUrl); portfolioPendingFiles = portfolioPendingFiles.filter((file) => file.id !== item.id); renderPortfolioUploadQueue(); updatePortfolioAddButton(); });
    els.portfolioUploadQueue.appendChild(row);
  });
}

async function loadPortfolioGalleryPhotos(albumId) {
  portfolioGallerySelections.clear(); clearElement(els.portfolioGalleryPhotos);
  if (!albumId) { updatePortfolioAddButton(); return; }
  els.portfolioGalleryPhotos.innerHTML = '<p>A carregar fotografias…</p>';
  try {
    const result = await callAdminPortfolio('album-photos', { albumId }); clearElement(els.portfolioGalleryPhotos);
    (result.photos || []).forEach((photo) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'portfolio-gallery-photo'; button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<img src="${escapeText(photo.preview_url || '')}" alt="${escapeText(photo.caption || '')}" loading="lazy">`;
      button.addEventListener('click', () => { const selected = !portfolioGallerySelections.has(photo.id); if (selected) portfolioGallerySelections.set(photo.id, photo); else portfolioGallerySelections.delete(photo.id); button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected)); updatePortfolioAddButton(); });
      els.portfolioGalleryPhotos.appendChild(button);
    });
  } catch (error) { els.portfolioGalleryPhotos.innerHTML = '<p>Não foi possível carregar as fotografias.</p>'; }
  updatePortfolioAddButton();
}

async function runConcurrent(items, task, concurrency = 4) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const index = next; next += 1; await task(items[index], index); }
  });
  await Promise.all(workers);
}

async function submitPortfolioAdd() {
  const published = els.portfolioAddPublished.checked; const categoryId = els.portfolioAddCategory.value;
  const sources = els.portfolioGalleryPanel.hidden
    ? portfolioPendingFiles.map((item) => ({ item, url: item.previewUrl, altText: '' }))
    : [...portfolioGallerySelections.values()].map((photo) => ({ photo, url: photo.source_url, altText: photo.caption || '', sourcePhotoId: photo.id, sourceGalleryId: photo.album_id }));
  if (!sources.length || !categoryId) return;
  els.portfolioAddSubmit.disabled = true; els.portfolioAddMessage.textContent = `A preparar 0 de ${sources.length}…`;
  let completed = 0; const failed = [];
  await runConcurrent(sources, async (source) => {
    try { await uploadPortfolioSource(source, { published, categoryId }); if (source.item) source.item.status = 'Concluída'; }
    catch (error) { failed.push(source); if (source.item) source.item.status = 'Falhou · tente novamente'; }
    completed += 1; els.portfolioAddMessage.textContent = `A preparar ${completed} de ${sources.length}…`; renderPortfolioUploadQueue();
  }, 4);
  if (failed.length) {
    if (els.portfolioGalleryPanel.hidden) {
      const failedIds = new Set(failed.map((source) => source.item?.id));
      portfolioPendingFiles.forEach((item) => { if (!failedIds.has(item.id)) URL.revokeObjectURL(item.previewUrl); });
      portfolioPendingFiles = portfolioPendingFiles.filter((item) => failedIds.has(item.id));
    } else {
      portfolioGallerySelections = new Map(failed.map((source) => [source.sourcePhotoId, source.photo]));
    }
    els.portfolioAddMessage.textContent = `${failed.length} fotografia(s) falharam. Pode tentar novamente.`; toast('Alguns uploads falharam.', 'error'); renderPortfolioUploadQueue(); updatePortfolioAddButton(); return;
  }
  els.portfolioAddDialog.close(); resetPortfolioAddDialog(); toast('Fotografias adicionadas.'); await loadPortfolio({ force: true });
}

function updatePortfolioFocalMarker() {
  els.portfolioFocalMarker.style.left = `${clampFocalPoint(els.portfolioFocalX.value)}%`;
  els.portfolioFocalMarker.style.top = `${clampFocalPoint(els.portfolioFocalY.value)}%`;
}

async function replacePortfolioPhoto(file) {
  const validation = validatePortfolioFile(file); if (!validation.valid) { toast(validation.error, 'error'); return; }
  const web = await optimizePortfolioAsset(file, 2200, .84, false); const thumb = await optimizePortfolioAsset(file, 500, .82, true);
  const prepared = await callAdminPortfolio('prepare-replace', { photoId: portfolioReplacingPhoto.id });
  const paths = [prepared.web_path, prepared.thumbnail_path];
  for (const [path, asset] of [[paths[0], web.blob], [paths[1], thumb.blob]]) {
    const { error } = await supabase.storage.from('public-portfolio').upload(path, asset, { contentType: 'image/webp', upsert: true }); if (error) throw error;
  }
  await callAdminPortfolio('finalize-replace', { photoId: portfolioReplacingPhoto.id, width: web.width, height: web.height, sizeBytes: file.size });
  toast('Fotografia substituída.'); await loadPortfolio({ force: true });
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

function setInlineMessage(element, text = '', type = 'neutral') {
  if (!element) return;
  element.textContent = text;
  element.dataset.type = type;
}

function setAuthUiState(state, details = {}) {
  const checking = state === 'checking';
  const failed = state === 'error';
  const authenticated = state === 'authenticated';
  const unauthenticated = state === 'unauthenticated';
  els.authGate.hidden = !(checking || failed);
  els.authGate.dataset.state = state;
  els.login.hidden = !unauthenticated;
  els.app.hidden = !authenticated;
  els.authRetry.hidden = !failed;
  els.authGateTitle.textContent = details.title || (failed ? 'Não foi possível verificar a sessão' : 'A verificar sessão');
  els.authGateMessage.textContent = details.message || (failed
    ? 'Verifique a ligação à internet e tente novamente.'
    : 'A confirmar o acesso seguro à área administrativa.');
  if (unauthenticated) {
    requestAnimationFrame(() => els.loginForm.elements.email.focus({ preventScroll: true }));
  }
}

function isNetworkError(error) {
  return !navigator.onLine || /fetch|network|failed to fetch|load failed|abort/i.test(String(error?.message || ''));
}

function displayNameFor(user = session?.user) {
  const profileName = String(adminProfile?.full_name || '').trim();
  if (profileName) return profileName;
  const metadataName = String(user?.user_metadata?.display_name || '').trim();
  if (metadataName) return metadataName;
  const emailName = String(user?.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  return emailName ? emailName.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) : 'Administradora';
}

function initialsFor(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || 'FA').toUpperCase();
}

function setProfileAvatar(url = '') {
  const name = displayNameFor();
  const initials = initialsFor(name);
  const pairs = [
    [els.profileAvatarImage, els.profileAvatarFallback],
    [els.settingsAvatarImage, els.settingsAvatarFallback],
    [els.mobileAvatarImage, els.mobileAvatarFallback],
  ];
  pairs.forEach(([image, fallback]) => {
    if (!image || !fallback) return;
    fallback.textContent = initials;
    if (url) {
      image.src = url;
      image.hidden = false;
      fallback.hidden = true;
      image.onerror = () => {
        image.hidden = true;
        fallback.hidden = false;
      };
    } else {
      image.removeAttribute('src');
      image.hidden = true;
      fallback.hidden = false;
    }
  });
}

function setSettingsAvatarPreview(url = '') {
  const image = els.settingsAvatarImage;
  const fallback = els.settingsAvatarFallback;
  if (!image || !fallback) return;
  fallback.textContent = initialsFor(displayNameFor());
  if (url) {
    image.src = url;
    image.hidden = false;
    fallback.hidden = true;
    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
    };
    return;
  }
  image.removeAttribute('src');
  image.hidden = true;
  fallback.hidden = false;
}

function avatarStorage(path = '') {
  return String(path).startsWith('admin-profiles/')
    ? { bucket: 'private-galleries', path: String(path) }
    : { bucket: 'admin-avatars', path: String(path) };
}

function settingsTableMissing(error) {
  return error?.code === '42P01' || /admin_profiles|user_preferences|relation .* does not exist/i.test(String(error?.message || ''));
}

async function loadSettingsData() {
  const user = session?.user;
  if (!user) return;
  const fallbackName = displayNameFor(user);
  settingsSchemaAvailable = true;
  const [profileResult, preferencesResult] = await Promise.all([
    supabase.from('admin_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
  ]);
  const errors = [profileResult.error, preferencesResult.error].filter(Boolean);
  if (errors.some(settingsTableMissing)) {
    settingsSchemaAvailable = false;
    adminProfile = normalizeAdminProfile({
      full_name: user.user_metadata?.display_name,
      avatar_path: user.user_metadata?.avatar_path,
    }, fallbackName);
    userPreferences = normalizeUserPreferences();
  } else if (errors.length) {
    throw errors[0];
  } else {
    adminProfile = normalizeAdminProfile(profileResult.data || {
      full_name: user.user_metadata?.display_name,
      avatar_path: user.user_metadata?.avatar_path,
    }, fallbackName);
    userPreferences = normalizeUserPreferences(preferencesResult.data || {});
  }
  populateSettingsForms();
}

function populateSettingsForms() {
  if (!session?.user || !adminProfile) return;
  const profile = els.profileForm?.elements;
  if (profile) {
    profile.fullName.value = adminProfile.full_name;
    profile.roleLabel.value = adminProfile.role_label;
    profile.bio.value = adminProfile.bio;
    if (els.bioCount) els.bioCount.textContent = String(adminProfile.bio.length);
  }
  const contact = els.contactForm?.elements;
  if (contact) {
    contact.email.value = session.user.email || '';
    contact.phone.value = adminProfile.phone || '';
    contact.timezone.value = adminProfile.timezone;
    contact.locale.value = adminProfile.locale;
  }
  populateEmailAccountFields();
  const preferences = els.preferencesForm?.elements;
  if (preferences) {
    preferences.dateFormat.value = userPreferences.date_format;
    const expiry = userPreferences.default_gallery_expiry_days;
    const preset = [7, 15, 30, 60].includes(expiry) ? String(expiry) : expiry ? 'custom' : 'none';
    preferences.expiryPreset.value = preset;
    preferences.customExpiryDays.value = expiry || 30;
    preferences.currency.value = userPreferences.default_currency;
    preferences.downloadsEnabled.checked = userPreferences.default_downloads_enabled;
    preferences.watermarkEnabled.checked = userPreferences.default_watermark_enabled;
    preferences.salesEnabled.checked = userPreferences.default_sales_enabled;
    if (els.customExpiry) els.customExpiry.hidden = preset !== 'custom';
    preferences.customExpiryDays.disabled = preset !== 'custom';
  }
  els.passwordForm?.reset();
  updatePasswordStrength();
  settingsBaselines = new Map(els.settingsForms.map((form) => [form.dataset.settingsForm, serializeForm(form)]));
  pendingAvatarBlob = null;
  removeAvatarRequested = false;
  revokePendingAvatarPreview();
  updateAllSettingsSaveStates();
}

function populateEmailAccountFields() {
  if (!session?.user) return;
  const email = els.emailForm?.elements;
  if (email) {
    email.currentEmail.value = session.user.email || '';
    email.newEmail.value = '';
  }
  const pendingEmail = String(session.user.new_email || '').trim();
  if (els.emailPending) {
    els.emailPending.hidden = !pendingEmail;
    els.emailPending.textContent = pendingEmail
      ? `Alteração pendente de confirmação para ${pendingEmail}.`
      : 'Alteração de email pendente de confirmação.';
  }
  if (els.emailStatus) {
    els.emailStatus.textContent = pendingEmail ? 'Pendente' : 'Confirmado';
    els.emailStatus.classList.toggle('is-pending', Boolean(pendingEmail));
    els.emailStatus.classList.toggle('is-success', !pendingEmail);
  }
}

function settingsFormIsDirty(form) {
  if (!form) return false;
  const key = form.dataset.settingsForm;
  return serializeForm(form) !== settingsBaselines.get(key);
}

function settingsHaveUnsavedChanges() {
  return Boolean(pendingAvatarBlob || removeAvatarRequested || els.settingsForms.some(settingsFormIsDirty));
}

function updateSettingsSaveState(form) {
  const dirty = settingsFormIsDirty(form)
    || (form === els.profileForm && Boolean(pendingAvatarBlob || removeAvatarRequested));
  const submit = form?.querySelector('[type="submit"]');
  if (submit) submit.disabled = !dirty;
  form?.classList.toggle('has-unsaved-changes', dirty);
  return dirty;
}

function updateAllSettingsSaveStates() {
  els.settingsForms.forEach(updateSettingsSaveState);
}

function markSettingsFormSaved(form) {
  if (!form) return;
  settingsBaselines.set(form.dataset.settingsForm, serializeForm(form));
  updateSettingsSaveState(form);
}

function revokePendingAvatarPreview() {
  if (pendingAvatarPreviewUrl) URL.revokeObjectURL(pendingAvatarPreviewUrl);
  pendingAvatarPreviewUrl = '';
}

async function refreshProfileUI({ refreshAvatar = false } = {}) {
  const user = session?.user;
  if (!user) return;
  const name = displayNameFor(user);
  const avatarPath = String(adminProfile?.avatar_path || user.user_metadata?.avatar_path || '');
  if (els.profileName) els.profileName.textContent = name;
  if (els.settingsProfileName) els.settingsProfileName.textContent = name;
  if (els.sessionEmail) els.sessionEmail.textContent = user.email || '—';
  if (els.sessionLastSignIn) els.sessionLastSignIn.textContent = formatDateTime(user.last_sign_in_at);
  if (els.sessionCreatedAt) els.sessionCreatedAt.textContent = formatDateTime(user.created_at);
  if (els.sessionDevice) els.sessionDevice.textContent = currentDeviceLabel();
  if (els.sessionStatus) els.sessionStatus.textContent = 'Ativa';
  if (els.currentPasswordRow) els.currentPasswordRow.hidden = recoveryMode;
  if (els.passwordForm) els.passwordForm.elements.currentPassword.required = !recoveryMode;

  if (!avatarPath) {
    profileAvatarPath = '';
    profileAvatarUrl = '';
    setProfileAvatar('');
    return;
  }
  if (!refreshAvatar && avatarPath === profileAvatarPath && profileAvatarUrl) {
    setProfileAvatar(profileAvatarUrl);
    return;
  }
  const storage = avatarStorage(avatarPath);
  const { data, error } = await supabase.storage.from(storage.bucket).createSignedUrl(storage.path, 3600);
  if (error) {
    setProfileAvatar('');
    return;
  }
  profileAvatarPath = avatarPath;
  profileAvatarUrl = data.signedUrl;
  setProfileAvatar(profileAvatarUrl);
}

function currentDeviceLabel() {
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Navegador atual';
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  return [browser, platform].filter(Boolean).join(' · ');
}

async function persistAdminProfile(changes = {}) {
  if (!settingsSchemaAvailable) throw new Error('A migration das Definições ainda não foi aplicada no Supabase.');
  const next = normalizeAdminProfile({ ...adminProfile, ...changes }, displayNameFor());
  const payload = {
    user_id: session.user.id,
    full_name: next.full_name,
    role_label: next.role_label,
    bio: next.bio,
    avatar_path: next.avatar_path,
    phone: next.phone || null,
    timezone: next.timezone,
    locale: next.locale,
  };
  const { data, error } = await supabase
    .from('admin_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  adminProfile = normalizeAdminProfile(data, next.full_name);
  return adminProfile;
}

async function persistUserPreferences(changes = {}) {
  if (!settingsSchemaAvailable) throw new Error('A migration das Definições ainda não foi aplicada no Supabase.');
  const next = normalizeUserPreferences({ ...userPreferences, ...changes });
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: session.user.id, ...next }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  userPreferences = normalizeUserPreferences(data);
  return userPreferences;
}

async function removeStoredAvatar(path) {
  if (!path) return;
  const storage = avatarStorage(path);
  const { error } = await supabase.storage.from(storage.bucket).remove([storage.path]);
  if (error) throw error;
}

function clearAdminState() {
  albumLoadVersion += 1;
  albums = [];
  storageInfo = null;
  currentAlbum = null;
  authenticatedUserId = '';
  appLoadPromise = null;
  accessCodeCache.clear();
  lastShownCode = '';
  createdAlbumForModal = null;
  portfolioPhotos = [];
  portfolioCategories = [];
  portfolioLoaded = false;
  portfolioFilter = 'all';
  portfolioSearch = '';
  portfolioState = 'all';
  portfolioFeatured = 'all';
  if (els.portfolioSearch) els.portfolioSearch.value = '';
  if (els.portfolioState) els.portfolioState.value = 'all';
  if (els.portfolioFeatured) els.portfolioFeatured.value = 'all';
  portfolioReplacingPhoto = null;
  adminNotifications = [];
  globalSearchOrders = [];
  globalSearchOrdersLoaded = false;
  if (notificationsRefreshTimer) window.clearInterval(notificationsRefreshTimer);
  notificationsRefreshTimer = 0;
  if (els.notificationsToggle) els.notificationsToggle.hidden = true;
  if (els.notificationsPanel) els.notificationsPanel.hidden = true;
  resetPortfolioAddDialog();
  closeGalleryActionsMenu();
  closeDrawer();
  resetForm();
  $$('dialog[open]').forEach((dialog) => dialog.close());
  resolveConfirm(false);
  els.profileForm?.reset();
  els.passwordForm?.reset();
  setInlineMessage(els.profileMessage);
  setInlineMessage(els.passwordMessage);
  setInlineMessage(els.sessionMessage);
  clearElement(els.statGrid);
  clearElement(els.recentList);
  clearElement(els.expiringList);
  clearElement(els.galleryBoard);
  clearElement(els.chart);
  setProfileAvatar('');
  profileAvatarPath = '';
  profileAvatarUrl = '';
  adminProfile = null;
  userPreferences = { ...DEFAULT_USER_PREFERENCES };
  settingsBaselines.clear();
  pendingAvatarBlob = null;
  removeAvatarRequested = false;
  revokePendingAvatarPreview();
}

function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    image.src = objectUrl;
  });
}

async function optimizeAvatar(file) {
  await validateAvatarFile(file);
  const source = 'createImageBitmap' in window ? await createImageBitmap(file) : await imageFromFile(file);
  const size = Math.min(source.width, source.height);
  const sourceX = Math.max(0, (source.width - size) / 2);
  const sourceY = Math.max(0, (source.height - size) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  canvas.getContext('2d', { alpha: false }).drawImage(source, sourceX, sourceY, size, size, 0, 0, 512, 512);
  source.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível otimizar a fotografia.')), 'image/webp', .9);
  });
}

function passwordIsStrong(value) {
  return passwordStrength(value).valid;
}

function updatePasswordStrength() {
  if (!els.passwordForm || !els.passwordStrengthBar || !els.passwordStrengthLabel) return;
  const value = els.passwordForm.elements.newPassword.value;
  const strength = passwordStrength(value);
  const percent = value ? Math.max(16, Math.round((strength.score / 6) * 100)) : 0;
  const color = strength.score <= 2 ? '#b7685c' : strength.score <= 4 ? '#b88648' : '#4f8063';
  els.passwordStrengthBar.parentElement.parentElement.style.setProperty('--password-strength', `${percent}%`);
  els.passwordStrengthBar.parentElement.parentElement.style.setProperty('--password-color', color);
  els.passwordStrengthLabel.textContent = value ? strength.label : '—';
}

function togglePasswordVisibility(button) {
  const field = button.closest('.admin-password-field')?.querySelector('input');
  if (!field) return;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const show = field.type === 'password';
  field.type = show ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(show));
  const baseLabel = button.getAttribute('aria-label') || '';
  button.setAttribute('aria-label', show
    ? baseLabel.replace(/^Mostrar/, 'Ocultar')
    : baseLabel.replace(/^Ocultar/, 'Mostrar'));
  const showIcon = button.querySelector('[data-password-icon="show"]');
  const hideIcon = button.querySelector('[data-password-icon="hide"]');
  if (showIcon && hideIcon) {
    showIcon.hidden = show;
    hideIcon.hidden = !show;
    button.classList.toggle('is-password-visible', show);
  } else button.textContent = show ? '◎' : '◉';
  field.focus({ preventScroll: true });
  if (start !== null && end !== null) field.setSelectionRange(start, end);
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().slice(0, 16);
}

function hasExpired(expiresAt) {
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function statusOf(album) {
  if (album.is_archived || album.status === 'archived') return 'archived';
  if (hasExpired(album.expires_at)) return 'expired';
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

function photoUsesWatermark(photo, album = currentAlbum) {
  const mode = photo?.watermark_mode || 'inherit';
  return mode === 'enabled' || (mode === 'inherit' && album?.watermark_enabled !== false);
}

function watermarkStatus(photo, album = currentAlbum) {
  if (!photoUsesWatermark(photo, album)) return { key: 'plain', label: 'Sem marca' };
  if (photo?.processing_status === 'failed') return { key: 'failed', label: 'Erro' };
  if (photo?.processing_status === 'ready' && photo?.watermarked_path) return { key: 'ready', label: 'Com marca' };
  return { key: 'pending', label: 'A processar' };
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

function renderStorageSettings({ loading = false, error = false } = {}) {
  if (!els.storageSettings) return;
  if (loading) {
    els.storageSettings.dataset.state = 'loading';
    els.storageTotal.textContent = 'A calcular…';
    els.storagePercent.textContent = '—';
    els.storageSource.textContent = 'Estamos a calcular os ficheiros guardados.';
    els.storageSettingsBar.style.width = '0%';
    clearElement(els.storageBreakdown);
    return;
  }
  if (error || !storageInfo || !Number.isFinite(Number(storageInfo.bytes))) {
    els.storageSettings.dataset.state = 'error';
    els.storageTotal.textContent = 'Dados indisponíveis';
    els.storagePercent.textContent = '—';
    els.storageSource.textContent = 'Não foi possível calcular o armazenamento. Tente novamente.';
    els.storageSettingsBar.style.width = '0%';
    clearElement(els.storageBreakdown);
    return;
  }
  const bytes = Number(storageInfo.bytes);
  const quota = Number(storageInfo.quotaBytes || 150 * 1024 * 1024 * 1024);
  const precisePercent = quota > 0 ? (bytes / quota) * 100 : 0;
  const percent = Math.min(100, precisePercent);
  els.storageSettings.dataset.state = 'success';
  els.storageTotal.textContent = `${formatBytes(bytes)} utilizados de ${formatBytes(quota)}`;
  els.storagePercent.textContent = `${precisePercent < 1 && bytes > 0 ? '<1' : Math.round(percent)}% utilizado`;
  els.storageSource.textContent = storageInfo.approximate
    ? `Valor estimado · ${Number(storageInfo.photoCount || 0).toLocaleString('pt-PT')} fotografias`
    : `Valor calculado no Storage · ${Number(storageInfo.photoCount || 0).toLocaleString('pt-PT')} fotografias`;
  els.storageSettingsBar.style.width = `${Math.max(bytes > 0 ? .35 : 0, percent)}%`;
  clearElement(els.storageBreakdown);
  const breakdown = storageInfo.breakdown || {};
  const items = [
    ['Originais', breakdown.originals],
    ['Versões web', breakdown.web],
    ['Miniaturas', breakdown.thumbnails],
    ['Marca de água', breakdown.watermarked],
    ['Outros ficheiros', breakdown.other],
  ];
  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    const title = document.createElement('span');
    const amount = document.createElement('strong');
    title.textContent = label;
    amount.textContent = Number.isFinite(Number(value)) ? formatBytes(Number(value)) : 'Indisponível';
    item.append(title, amount);
    els.storageBreakdown.appendChild(item);
  });
}

function setView(view) {
  activeView = view;
  els.content.classList.toggle('is-overview-active', view === 'overview');
  const pageTitles = { overview: 'Visão geral', galleries: 'Galerias', orders: 'Encomendas', billing: 'Faturação', portfolio: 'Portefólio', settings: 'Definições' };
  els.pageTitle.textContent = pageTitles[view] || 'Administração';
  els.viewPanels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
  els.nav.forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  if (view === 'overview') renderDashboard();
  if (view === 'galleries') renderGalleries();
  if (view === 'orders') loadOrders();
  if (view === 'billing') {
    setBillingMode(billingListMode, { updateHash: true });
    if (billingListMode) loadBillingList();
    else loadBillingDashboard();
  }
  if (view === 'portfolio') {
    history.replaceState(null, '', `${location.pathname}${location.search}#portfolio`);
    loadPortfolio();
  }
  if (view === 'settings') {
    refreshProfileUI();
    setSettingsSection(settingsSection, { updateHash: true });
  } else if (location.hash.startsWith('#definicoes/')) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
  if (view !== 'billing' && location.hash.startsWith('#faturacao')) history.replaceState(null, '', `${location.pathname}${location.search}`);
  if (view !== 'portfolio' && location.hash === '#portfolio') history.replaceState(null, '', `${location.pathname}${location.search}`);
  closeMobileSidebar();
}

function setSettingsSection(section, { updateHash = true } = {}) {
  settingsSection = els.settingsPanels.some((panel) => panel.dataset.settingsPanel === section) ? section : 'profile';
  els.settingsNav.forEach((button) => {
    const active = button.dataset.settingsSection === settingsSection;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  els.settingsPanels.forEach((panel) => {
    const active = panel.dataset.settingsPanel === settingsSection;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  if (updateHash) history.replaceState(null, '', `${location.pathname}${location.search}#definicoes/${settingsSection}`);
  if (settingsSection === 'storage') renderStorageSettings();
}

async function confirmDiscardSettings() {
  if (!settingsHaveUnsavedChanges()) return true;
  const discard = await askConfirm(
    'Alterações não guardadas',
    'Pretende sair sem guardar?',
    { confirmLabel: 'Descartar alterações', cancelLabel: 'Continuar a editar' },
  );
  if (!discard) return false;
  populateSettingsForms();
  await refreshProfileUI({ refreshAvatar: true });
  return true;
}

async function requestSettingsSection(section) {
  if (section === settingsSection) return;
  if (!await confirmDiscardSettings()) return;
  setSettingsSection(section);
}

async function requestView(view) {
  if (activeView === 'settings' && view !== 'settings' && !await confirmDiscardSettings()) return;
  if (view === 'billing') billingListMode = false;
  setView(view);
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
  const cardNodes = cards.map(([icon, title, value, hint, status, tone]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-stat-card admin-stat-card--${tone}`;
    button.innerHTML = `<span>${icon}</span><p>${title}</p><strong>${value}</strong><small>${hint}</small>`;
    if (status) button.addEventListener('click', () => {
      filters.status = status;
      els.statusFilter.value = status;
      setView('galleries');
    });
    return button;
  });
  appendChildren(els.statGrid, cardNodes);

  renderRecentList();
  renderExpiringList();
  renderChart();
}

function renderRecentList() {
  clearElement(els.recentList);
  const recent = albums.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  if (!recent.length) return renderEmpty(els.recentList, 'Ainda não existem galerias.');
  appendChildren(els.recentList, recent.map((album) => galleryRow(album)));
}

function renderExpiringList() {
  clearElement(els.expiringList);
  const expiring = albums
    .filter(isExpiringSoon)
    .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
    .slice(0, 4);
  if (!expiring.length) return renderEmpty(els.expiringList, 'Nenhuma galeria a expirar em breve.');
  appendChildren(els.expiringList, expiring.map((album) => galleryRow(album, true)));
}

function renderChart() {
  clearElement(els.chart);
  const { buckets, previousTotal, periodLabel, comparisonLabel } = photoBuckets(els.chartRange.value);
  const max = Math.max(...buckets.map((item) => item.count), 1);
  const total = buckets.reduce((sum, item) => sum + item.count, 0);
  const width = 860;
  const height = 270;
  const padX = 34;
  const padY = 34;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;
  const points = buckets.map((item, index) => {
    const x = padX + (buckets.length === 1 ? plotWidth / 2 : (plotWidth / (buckets.length - 1)) * index);
    const y = padY + plotHeight - ((item.count / max) * plotHeight);
    return { ...item, x, y };
  });
  const line = points.reduce((path, point, index) => {
    if (!index) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    if (index === points.length - 1) return `${path} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const next = points[index + 1];
    return `${path} Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${((point.x + next.x) / 2).toFixed(1)} ${((point.y + next.y) / 2).toFixed(1)}`;
  }, '');
  const area = `${line} L ${points.at(-1)?.x || padX} ${height - padY} L ${points[0]?.x || padX} ${height - padY} Z`;
  const change = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;
  const comparisonText = change == null
    ? 'Ainda sem histórico suficiente para comparar'
    : `${change > 0 ? '+' : ''}${change}% face ao ${comparisonLabel}`;
  const comparisonTone = change == null ? '' : change >= 0 ? ' is-positive' : ' is-negative';

  const metric = document.createElement('div');
  metric.className = 'admin-chart-metric';
  metric.innerHTML = `
    <span class="admin-chart-metric__icon" aria-hidden="true"><i></i></span>
    <strong><b>${total.toLocaleString('pt-PT')}</b><em>${total === 1 ? 'fotografia' : 'fotografias'}</em></strong>
    <p>carregadas ${escapeText(periodLabel)}</p>
    <span class="admin-chart-comparison${comparisonTone}">${escapeText(comparisonText)}</span>
  `;

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
        <g class="admin-chart-point" tabindex="0" role="button" aria-label="${escapeText(point.tooltip)}: ${point.count} ${point.count === 1 ? 'fotografia' : 'fotografias'}" data-x="${point.x}" data-y="${point.y}" data-label="${escapeText(point.tooltip)}" data-count="${point.count}">
          <circle cx="${point.x}" cy="${point.y}" r="3.5" />
        </g>
      `).join('')}
      ${points.map((point) => `<text class="admin-chart-label" x="${point.x}" y="${height - 5}" text-anchor="middle">${point.label}</text>`).join('')}
    </svg>
    ${!total ? '<p class="admin-chart-empty">Ainda não existem fotografias neste período.</p>' : ''}
    <div class="admin-chart-tooltip" role="tooltip" hidden><strong></strong><span></span></div>
  `;
  const tooltip = svgWrap.querySelector('.admin-chart-tooltip');
  const showTooltip = (point) => {
    tooltip.querySelector('strong').textContent = point.dataset.label;
    const count = Number(point.dataset.count || 0);
    tooltip.querySelector('span').textContent = `${count} ${count === 1 ? 'fotografia' : 'fotografias'}`;
    tooltip.style.left = `${(Number(point.dataset.x) / width) * 100}%`;
    tooltip.style.top = `${(Number(point.dataset.y) / height) * 100}%`;
    tooltip.hidden = false;
    point.classList.add('is-active');
  };
  const hideTooltip = (point) => {
    tooltip.hidden = true;
    point.classList.remove('is-active');
  };
  svgWrap.querySelectorAll('.admin-chart-point').forEach((point) => {
    point.addEventListener('pointerenter', () => showTooltip(point));
    point.addEventListener('pointerleave', () => hideTooltip(point));
    point.addEventListener('focus', () => showTooltip(point));
    point.addEventListener('blur', () => hideTooltip(point));
  });
  els.chart.append(metric, svgWrap);
}

function photoBuckets(range = '3m') {
  const photos = albums.flatMap((album) => album.album_photos || []);
  const today = startOfLocalDay();
  const safeRange = ['7d', '30d', '3m', '1y'].includes(range) ? range : '3m';
  const makeBuckets = (previous = false) => {
    const buckets = [];
    if (safeRange === '1y') {
      const anchor = new Date(today.getFullYear(), today.getMonth() - (previous ? 12 : 0), 1);
      for (let offset = 11; offset >= 0; offset -= 1) {
        const start = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        buckets.push({
          start,
          end,
          label: new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(start).replace('.', ''),
          tooltip: new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(start),
          count: 0,
        });
      }
    } else {
      const days = safeRange === '7d' ? 7 : safeRange === '30d' ? 30 : 84;
      const groupDays = safeRange === '7d' ? 1 : safeRange === '30d' ? 3 : 7;
      const rangeEnd = new Date(today);
      if (previous) rangeEnd.setDate(rangeEnd.getDate() - days);
      const rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeEnd.getDate() - days + 1);
      for (let index = 0; index < Math.ceil(days / groupDays); index += 1) {
        const start = new Date(rangeStart);
        start.setDate(rangeStart.getDate() + (index * groupDays));
        const end = new Date(start);
        end.setDate(start.getDate() + groupDays - 1);
        if (end > rangeEnd) end.setTime(rangeEnd.getTime());
        buckets.push({
          start,
          end,
          label: safeRange === '7d'
            ? new Intl.DateTimeFormat('pt-PT', { weekday: 'short' }).format(start).replace('.', '')
            : `${start.getDate()}/${start.getMonth() + 1}`,
          tooltip: groupDays === 1
            ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(start)
            : `${formatDate(start)} – ${formatDate(end)}`,
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
      const bucket = targetBuckets.find((item) => created >= item.start && created <= item.end);
      if (bucket) bucket.count += 1;
    });
    return targetBuckets;
  };

  const buckets = fillBuckets(makeBuckets(false));
  const previousBuckets = fillBuckets(makeBuckets(true));
  const previousTotal = previousBuckets.reduce((sum, item) => sum + item.count, 0);
  const labels = {
    '7d': ['nos últimos 7 dias', 'período anterior'],
    '30d': ['nos últimos 30 dias', 'período anterior'],
    '3m': ['nos últimos 3 meses', 'período anterior'],
    '1y': ['no último ano', 'ano anterior'],
  }[safeRange];
  return { buckets, previousTotal, periodLabel: labels[0], comparisonLabel: labels[1] };
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
    img.loading = 'lazy';
    img.decoding = 'async';
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
  appendChildren(els.uploadPickerList, available.map((album) => galleryPickerCard(album)));
}

function openUploadPicker() {
  uploadPickerFilters = { search: '', status: 'all' };
  els.uploadPickerSearch.value = '';
  els.uploadPickerStatus.value = 'all';
  renderUploadPicker();
  els.uploadPickerModal.showModal();
  setTimeout(() => els.uploadPickerSearch.focus(), 60);
}

function accessGroupStatus(album) {
  return statusOf(album) === 'expired' ? 'expired' : 'active';
}

function maskAccessCode(code = '') {
  const raw = String(code || '').trim();
  if (!raw) return '•••• •••• ••••';
  const suffix = raw.replace(/\s+/g, '').slice(-4).toUpperCase();
  return `•••• •••• •••• ${suffix}`;
}

function accessAlbums() {
  const query = accessFilters.search.trim().toLowerCase();
  return albums
    .filter((album) => statusOf(album) !== 'archived')
    .filter((album) => accessGroupStatus(album) === accessFilters.status)
    .filter((album) => {
      if (!query) return true;
      const cachedCode = accessCodeCache.get(album.id) || '';
      const haystack = [album.title, album.event_type, album.location, album.access_code_masked, cachedCode]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (accessFilters.sort === 'oldest') {
        return new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0);
      }
      if (accessFilters.sort === 'title-asc') return String(a.title || '').localeCompare(String(b.title || ''), 'pt');
      if (accessFilters.sort === 'title-desc') return String(b.title || '').localeCompare(String(a.title || ''), 'pt');
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });
}

async function loadAccessCode(album, { makeVisible = true } = {}) {
  let code = accessCodeCache.get(album.id);
  if (!code) {
    const data = await callAdmin('get-code', { albumId: album.id });
    code = data.accessCode;
    accessCodeCache.set(album.id, code);
  }
  if (makeVisible) visibleAccessCodes.add(album.id);
  return code;
}

async function toggleAccessCode(album, button) {
  if (visibleAccessCodes.has(album.id) && accessCodeCache.has(album.id)) {
    visibleAccessCodes.delete(album.id);
    renderAccessList();
    return;
  }
  await withBusy(button, 'A obter...', async () => {
    try {
      await loadAccessCode(album);
      renderAccessList();
      toast('Código carregado.');
    } catch (error) {
      if (handleExpiredAdminSession(error)) return;
      toast(friendlyError(error, 'Não foi possível obter o código.'), 'error');
    }
  });
}

function renderAccessList() {
  clearElement(els.accessList);
  const allItems = albums.filter((album) => statusOf(album) !== 'archived');
  const activeCount = allItems.filter((album) => accessGroupStatus(album) === 'active').length;
  const expiredCount = allItems.filter((album) => accessGroupStatus(album) === 'expired').length;
  if (els.accessActiveCount) els.accessActiveCount.textContent = String(activeCount);
  if (els.accessExpiredCount) els.accessExpiredCount.textContent = String(expiredCount);
  if (els.accessTotal) els.accessTotal.textContent = `${allItems.length} ${allItems.length === 1 ? 'código' : 'códigos'} no total`;

  els.accessFilterButtons.forEach((button) => {
    const active = button.dataset.accessFilter === accessFilters.status;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const items = accessAlbums();
  if (!allItems.length) {
    renderEmpty(els.accessList, 'Ainda não existem galerias com acessos para gerir.');
    return;
  }
  if (!items.length) {
    renderEmpty(els.accessList, 'Nenhum código encontrado.');
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((album) => {
    const status = statusOf(album);
    const visible = visibleAccessCodes.has(album.id) && accessCodeCache.has(album.id);
    const cachedCode = accessCodeCache.get(album.id);
    const codeLabel = visible ? cachedCode : maskAccessCode(cachedCode || album.access_code_masked || '');
    const card = document.createElement('article');
    card.className = 'admin-access-card';

    const cover = coverNode(album);
    cover.classList.add('admin-access-cover');

    const details = document.createElement('div');
    details.className = 'admin-access-details';
    details.innerHTML = `
      <div class="admin-access-title-row">
        <div><strong>${escapeText(album.title || 'Sem nome')}</strong><small>${escapeText(album.event_type || 'Evento')} · ${escapeText(formatDate(album.event_date))}</small></div>
        <span class="admin-access-status is-${escapeText(accessGroupStatus(album))}">${escapeText(statusLabel(status))}</span>
      </div>
      <dl class="admin-access-meta">
        <div><dt>Sessões ativas</dt><dd>${Number(album.active_session_count || 0)}</dd></div>
        <div><dt>Última utilização</dt><dd>${escapeText(formatDateTime(album.last_session_at))}</dd></div>
        <div><dt>Expiração</dt><dd>${escapeText(formatExpirationStatus(album.expires_at))}</dd></div>
      </dl>
    `;

    const codeBlock = document.createElement('div');
    codeBlock.className = 'admin-access-code';
    const codeToggle = actionButton(visible ? 'Ocultar' : 'Ver', () => toggleAccessCode(album, codeToggle));
    codeToggle.setAttribute('aria-label', visible ? 'Ocultar código' : 'Mostrar código');
    codeBlock.innerHTML = `<span aria-hidden="true">🔒</span><code>${escapeText(codeLabel || 'Sem código')}</code>`;
    codeBlock.append(codeToggle);

    const actions = document.createElement('div');
    actions.className = 'admin-access-actions';

    const show = actionButton(visible ? 'Ocultar' : 'Mostrar', () => toggleAccessCode(album, show));

    const copy = actionButton('Copiar', async () => {
      await withBusy(copy, 'A copiar...', async () => {
        try {
          const code = await loadAccessCode(album, { makeVisible: false });
          await navigator.clipboard.writeText(code);
          renderAccessList();
          toast('Código copiado.');
        } catch (error) {
          if (handleExpiredAdminSession(error)) return;
          toast(friendlyError(error, 'Não foi possível copiar o código.'), 'error');
        }
      });
    });

    const instructions = actionButton('Instruções', async () => {
      await withBusy(instructions, 'A copiar...', async () => {
        try {
          const code = await loadAccessCode(album, { makeVisible: false });
          await navigator.clipboard.writeText(guestInstructions(album, code));
          renderAccessList();
          toast('Instruções copiadas.');
        } catch (error) {
          if (handleExpiredAdminSession(error)) return;
          toast(friendlyError(error, 'Não foi possível copiar as instruções.'), 'error');
        }
      });
    });

    const regenerate = actionButton('Novo código', async () => {
      if (!await askConfirm('Gerar novo código', 'O código antigo deixa de funcionar e todas as sessões serão terminadas.')) return;
      await withBusy(regenerate, 'A gerar...', async () => {
        try {
          const data = await callAdmin('regenerate-code', { albumId: album.id });
          accessCodeCache.set(album.id, data.accessCode);
          visibleAccessCodes.add(album.id);
          await loadAlbums();
          renderAccessList();
          toast('Novo código gerado.');
        } catch (error) {
          if (handleExpiredAdminSession(error)) return;
          toast(friendlyError(error, 'Não foi possível gerar novo código.'), 'error');
        }
      });
    });

    const sessions = actionButton('Terminar sessões', async () => {
      if (!await askConfirm('Terminar sessões', 'Os convidados terão de introduzir novamente o código.')) return;
      await withBusy(sessions, 'A terminar...', async () => {
        try {
          await callAdmin('end-sessions', { albumId: album.id });
          await loadAlbums();
          renderAccessList();
          toast('Sessões terminadas.');
        } catch (error) {
          if (handleExpiredAdminSession(error)) return;
          toast(friendlyError(error, 'Não foi possível terminar sessões.'), 'error');
        }
      });
    });
    sessions.classList.add('is-danger');

    actions.append(show, copy, instructions, regenerate, sessions);
    card.append(cover, details, codeBlock, actions);
    fragment.appendChild(card);
  });
  els.accessList.appendChild(fragment);
}

function openAccessManager() {
  accessFilters = { search: '', status: 'active', sort: 'recent' };
  if (els.accessSearch) els.accessSearch.value = '';
  if (els.accessSort) els.accessSort.value = 'recent';
  renderAccessList();
  els.accessModal.showModal();
  setTimeout(() => els.accessSearch?.focus({ preventScroll: true }), 60);
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
  appendChildren(els.galleryBoard, items.map((album) => galleryCard(album)));
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
  if (activeView === 'overview') renderDashboard();
  if (activeView === 'galleries') renderGalleries();
}

function updateRestoreCard() {
  if (els.restoreTitle) els.restoreTitle.textContent = currentAlbum
    ? currentAlbum.title || 'Editar galeria'
    : fields.title.value.trim() || 'Nova galeria';
  if (els.restoreMeta) els.restoreMeta.textContent = currentAlbum
    ? `Secção ${currentStep} de 3`
    : `Passo ${currentStep} de 3`;
  if (!els.restoreThumb) return;
  els.restoreThumb.replaceChildren();
  const pendingCover = pendingFiles.find((item) => item.id === selectedPendingCoverId);
  const src = pendingCover?.previewUrl || currentAlbum?.cover_url;
  if (src) {
    const image = document.createElement('img');
    image.src = src;
    image.alt = '';
    els.restoreThumb.appendChild(image);
  } else {
    els.restoreThumb.textContent = currentAlbum ? '▧' : '+';
  }
}

function updatePublishChoice() {
  els.publishChoices.forEach((button) => {
    const isSelected = button.dataset.publishChoice === (fields.isActive.checked ? 'active' : 'draft');
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
}

function noExpirationSelected() {
  return els.noExpiration?.getAttribute('aria-pressed') === 'true';
}

function setNoExpiration(selected) {
  if (!els.noExpiration) return;
  els.noExpiration.setAttribute('aria-pressed', String(selected));
  els.noExpiration.classList.toggle('is-selected', selected);
  fields.expiresAt.disabled = selected;
  fields.expiresAt.closest('label')?.classList.toggle('is-disabled', selected);
}

function requiredDetailFields() {
  return $$('[data-step="1"] [required]', els.drawerForm);
}

function detailFieldIsValid(field) {
  return String(field.value || '').trim().length > 0 && field.checkValidity();
}

function updateStepAvailability() {
  const detailsComplete = currentAlbum || requiredDetailFields().every(detailFieldIsValid);
  els.stepButtons.forEach((button) => {
    const locked = Number(button.dataset.stepTarget) > 1 && !detailsComplete;
    button.disabled = locked;
    button.classList.toggle('is-locked', locked);
    button.setAttribute('aria-disabled', String(locked));
  });
  requiredDetailFields().forEach((field) => {
    const invalid = detailsValidationAttempted && !detailFieldIsValid(field);
    field.setAttribute('aria-invalid', String(invalid));
    field.closest('label')?.classList.toggle('is-invalid', invalid);
  });
  if (detailsComplete && detailsValidationAttempted) {
    detailsValidationAttempted = false;
    setMessage('');
  }
  return detailsComplete;
}

function validateRequiredDetails() {
  if (currentAlbum || updateStepAvailability()) return true;
  detailsValidationAttempted = true;
  updateStepAvailability();
  setMessage('Preencha o nome do evento, a data e a localização para continuar.', 'error');
  requiredDetailFields().find((field) => !detailFieldIsValid(field))?.focus();
  return false;
}

function setStep(step) {
  const totalSteps = 3;
  const targetStep = Math.max(1, Math.min(totalSteps, step));
  if (targetStep > 1 && !validateRequiredDetails()) return;
  currentStep = targetStep;
  updateStepAvailability();
  if (!currentAlbum && els.drawerMeta) {
    els.drawerMeta.textContent = {
      1: 'Adicione os detalhes do evento.',
      2: 'Adicione as fotografias e escolha a capa.',
      3: 'Reveja as definições e publique a galeria.',
    }[currentStep];
  }
  els.drawer.dataset.currentStep = String(currentStep);
  els.steps.forEach((panel) => panel.classList.toggle('is-active', Number(panel.dataset.step) === currentStep));
  els.stepButtons.forEach((button) => {
    const target = Number(button.dataset.stepTarget);
    const isCurrent = target === currentStep;
    button.classList.toggle('is-active', isCurrent);
    button.classList.toggle('is-complete', target < currentStep);
    if (isCurrent) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  els.prevStep.hidden = currentAlbum || currentStep === 1;
  els.nextStep.hidden = currentAlbum || currentStep === totalSteps;
  els.saveGallery.hidden = !currentAlbum && currentStep !== totalSteps;
  if (currentStep === 3) renderConfirmSummary();
  updateRestoreCard();
}

function closeGalleryActionsMenu() {
  if (!els.galleryActionsMenu) return;
  els.galleryActionsMenu.hidden = true;
  els.galleryActionsToggle?.setAttribute('aria-expanded', 'false');
}

function updateGalleryActionsState() {
  const disabled = !currentAlbum;
  if (els.galleryActionsToggle) els.galleryActionsToggle.disabled = disabled;
  [els.actionShowCode, els.actionCopyInstructions, els.actionRegenerateCode, els.actionEndSessions, els.actionToggleState, els.actionDelete]
    .forEach((button) => { if (button) button.disabled = disabled; });
  if (els.actionToggleState) {
    els.actionToggleState.textContent = statusOf(currentAlbum || {}) === 'active' ? 'Desativar' : 'Ativar';
  }
  if (disabled) closeGalleryActionsMenu();
}

function positionGalleryActionsMenu() {
  if (!els.galleryActionsMenu || !els.galleryActionsToggle || els.galleryActionsMenu.hidden) return;
  const buttonRect = els.galleryActionsToggle.getBoundingClientRect();
  const menuRect = els.galleryActionsMenu.getBoundingClientRect();
  const gap = 8;
  const left = Math.min(
    window.innerWidth - menuRect.width - 12,
    Math.max(12, buttonRect.right - menuRect.width),
  );
  let top = buttonRect.bottom + gap;
  if (top + menuRect.height > window.innerHeight - 12) {
    top = Math.max(12, buttonRect.top - menuRect.height - gap);
  }
  els.galleryActionsMenu.style.left = `${left}px`;
  els.galleryActionsMenu.style.top = `${top}px`;
}

function toggleGalleryActionsMenu() {
  if (!currentAlbum || !els.galleryActionsMenu) return;
  const willOpen = els.galleryActionsMenu.hidden;
  els.galleryActionsMenu.hidden = !willOpen;
  els.galleryActionsToggle?.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    positionGalleryActionsMenu();
    els.galleryActionsMenu.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
  }
}

function updateDrawerSaveState() {
  els.quickSaveDrawer.textContent = currentAlbum ? 'Guardar alterações' : 'Guardar rascunho';
  if (els.previewGallery) {
    els.previewGallery.disabled = !currentAlbum;
    els.previewGallery.hidden = !currentAlbum;
  }
  if (els.galleryActionsToggle) els.galleryActionsToggle.hidden = !currentAlbum;
}

function updateDownloadOptions() {
  const downloadsAllowed = fields.downloadsEnabled.checked;
  if (els.salesFreeDownload) els.salesFreeDownload.checked = downloadsAllowed;
  fields.watermarkOriginalDownloads.disabled = !downloadsAllowed;
  els.originalDownloadsSetting?.classList.toggle('is-disabled', !downloadsAllowed);
  els.originalDownloadsSetting?.setAttribute('aria-disabled', String(!downloadsAllowed));
}

function updateSalesOptions() {
  const enabled = fields.salesEnabled.checked;
  els.salesSettings.hidden = !enabled;
  fields.watermarkEnabled.disabled = enabled;
  if (enabled) fields.watermarkEnabled.checked = true;
  fields.photoPrice.required = enabled;
  fields.downloadExpiryDays.required = enabled;
  fields.salesSupportEmail.required = enabled;
  fields.refundPolicyText.required = enabled;
  if (currentStep === 3) renderConfirmSummary();
}

function markDrawerDirty() {
  if (!els.drawer.classList.contains('is-open')) return;
  drawerDirty = true;
  updateDrawerSaveState();
}

function markDrawerSaved() {
  drawerDirty = false;
  updateDrawerSaveState();
}

function resetForm() {
  currentAlbum = null;
  lastShownCode = '';
  els.drawer.classList.add('is-create-mode');
  els.drawer.classList.remove('is-edit-mode');
  els.drawerForm.reset();
  detailsValidationAttempted = false;
  fields.id.value = '';
  fields.isActive.checked = true;
  fields.downloadsEnabled.checked = userPreferences.default_downloads_enabled !== false;
  fields.watermarkEnabled.checked = userPreferences.default_watermark_enabled !== false;
  fields.watermarkOriginalDownloads.checked = false;
  fields.salesEnabled.checked = userPreferences.default_sales_enabled === true;
  fields.photoPrice.value = '6.99';
  fields.currency.value = userPreferences.default_currency || 'EUR';
  fields.downloadExpiryDays.value = '7';
  fields.salesSupportEmail.value = '';
  fields.refundPolicyText.value = '';
  fields.expiresAt.value = galleryExpiryValue(userPreferences.default_gallery_expiry_days);
  setNoExpiration(!fields.expiresAt.value);
  updatePublishChoice();
  updateDownloadOptions();
  updateSalesOptions();
  els.uploadProgress.hidden = true;
  clearPendingFiles();
  renderPhotos([]);
  setCodeState('empty');
  setMessage('');
  els.drawerTitle.textContent = 'Criar galeria';
  els.finalStepLabel.textContent = 'Publicar';
  els.finalPanelTitle.textContent = 'Estado da galeria';
  els.finalPanelDescription.textContent = 'Escolha como pretende guardar a galeria.';
  els.saveGallery.textContent = 'Criar galeria';
  els.discardDrawer.textContent = 'Cancelar';
  updateGalleryActionsState();
  setStep(1);
  markDrawerSaved();
}

function openDrawer(album = null, step = 1) {
  resetForm();
  if (album) {
    currentAlbum = album;
    els.drawer.classList.remove('is-create-mode');
    els.drawer.classList.add('is-edit-mode');
    fields.id.value = album.id || '';
    fields.title.value = album.title || '';
    fields.eventType.value = album.event_type || 'Outro';
    fields.eventDate.value = album.event_date || '';
    fields.location.value = album.location || '';
    fields.description.value = album.description || '';
    fields.guestMessage.value = album.guest_message || '';
    fields.expiresAt.value = toDateTimeLocal(album.expires_at);
    fields.slug.value = album.slug || '';
    fields.isActive.checked = Boolean(album.is_active);
    fields.downloadsEnabled.checked = album.downloads_enabled !== false;
    fields.watermarkEnabled.checked = album.watermark_enabled !== false;
    fields.watermarkOriginalDownloads.checked = Boolean(album.watermark_original_downloads);
    fields.salesEnabled.checked = Boolean(album.sales_enabled);
    fields.photoPrice.value = Number(album.photo_price_cents || 699) / 100;
    fields.currency.value = album.currency || 'EUR';
    fields.downloadExpiryDays.value = album.download_expiry_days || 7;
    fields.salesSupportEmail.value = album.sales_support_email || '';
    fields.refundPolicyText.value = album.refund_policy_text || '';
    setNoExpiration(!fields.expiresAt.value);
    updatePublishChoice();
    updateDownloadOptions();
    updateSalesOptions();
    els.drawerTitle.textContent = 'Editar galeria';
    els.drawerMeta.textContent = `${album.title || 'Galeria'} · ${album.event_type || 'Evento'}`;
    els.finalStepLabel.textContent = 'Acesso';
    els.finalPanelTitle.textContent = 'Acesso';
    els.finalPanelDescription.textContent = 'Publicação, permissões e código.';
    els.saveGallery.textContent = 'Guardar alterações';
    els.discardDrawer.textContent = 'Fechar';
    renderPhotos(album.album_photos || []);
    setCodeState('hidden');
  }
  els.drawer.classList.add('is-open');
  els.drawer.classList.remove('is-minimized');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.drawerBackdrop.hidden = false;
  els.restoreDrawer.hidden = true;
  drawerMinimized = false;
  updateGalleryActionsState();
  setStep(step);
  markDrawerSaved();
  setTimeout(() => fields.title.focus(), 60);
}

function closeDrawer() {
  closeGalleryActionsMenu();
  els.drawer.classList.remove('is-open');
  els.drawer.classList.remove('is-minimized');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.drawerBackdrop.hidden = true;
  els.restoreDrawer.hidden = true;
  drawerMinimized = false;
}

function minimizeDrawer() {
  if (!els.drawer.classList.contains('is-open')) return;
  closeGalleryActionsMenu();
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

async function requestCloseDrawer() {
  if (drawerDirty || (!currentAlbum && drawerHasDraft())) {
    const confirmed = await askConfirm(
      'Fechar sem guardar?',
      'Existem alterações por guardar. Pode minimizar o editor para as manter ou confirmar para as descartar.',
    );
    if (!confirmed) return;
  }
  closeDrawer();
  resetForm();
}

function quickSaveDrawer() {
  if (!validateRequiredDetails()) {
    setStep(1);
    return;
  }
  if (!currentAlbum) {
    fields.isActive.checked = false;
    updatePublishChoice();
    saveAsDraftRequested = true;
  }
  els.drawerForm.requestSubmit(els.saveGallery);
}

async function discardDrawer() {
  if (drawerDirty || (!currentAlbum && drawerHasDraft())) {
    const confirmed = await askConfirm('Descartar esta galeria?', 'Os dados e ficheiros preparados serão eliminados.');
    if (!confirmed) return;
  }
  closeDrawer();
  resetForm();
}

function buildPayload(overrides = {}) {
  const isArchived = Boolean(currentAlbum?.is_archived);
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
    downloadAllEnabled: false,
    watermarkEnabled: fields.watermarkEnabled.checked,
    watermarkOriginalDownloads: fields.watermarkOriginalDownloads.checked,
    salesEnabled: fields.salesEnabled.checked,
    photoPriceCents: Math.round(Number(fields.photoPrice.value || 0) * 100),
    currency: fields.currency.value || 'EUR',
    downloadExpiryDays: Number(fields.downloadExpiryDays.value || 7),
    salesSupportEmail: fields.salesSupportEmail.value,
    refundPolicyText: fields.refundPolicyText.value,
    isActive: fields.isActive.checked,
    isArchived,
    status: isArchived ? 'archived' : (fields.isActive.checked ? 'active' : 'draft'),
    expiresAt: fields.expiresAt.value ? new Date(fields.expiresAt.value).toISOString() : null,
    ...overrides,
  };
}

async function saveGallery(event) {
  event.preventDefault();
  if (!validateRequiredDetails()) {
    setStep(1);
    return;
  }
  if (fields.salesEnabled.checked) {
    const price = Number(fields.photoPrice.value);
    const days = Number(fields.downloadExpiryDays.value);
    if (price < 0.5 || days < 1 || days > 90 || !fields.salesSupportEmail.validity.valid || !fields.salesSupportEmail.value || !fields.refundPolicyText.value.trim()) {
      setStep(3);
      setMessage('Complete o preço, validade, email de apoio e política de reembolso antes de ativar as vendas.', 'error');
      return;
    }
  }
  if (drawerSaving) return;
  drawerSaving = true;
  updateDrawerSaveState();
  try {
    await withBusy(els.saveGallery, 'A guardar...', async () => {
      const payload = buildPayload();
      const shouldQueueExistingWatermarks = currentAlbum
        && currentAlbum.watermark_enabled === false
        && payload.watermarkEnabled === true
        && (currentAlbum.album_photos || []).length > 0
        && await askConfirm('Aplicar marca às fotografias existentes?', 'A galeria passará a usar marca de água. Quer preparar também as fotografias que já existem?');
      const result = await callAdmin('save-album', { album: payload });
      await loadAlbums();
      let updated = albums.find((album) => album.id === result.album.id) || result.album;
      let queuedExistingWatermarks = 0;
      if (shouldQueueExistingWatermarks) {
        const queued = await callAdmin('queue-existing-watermarks', { albumId: updated.id });
        queuedExistingWatermarks = Number(queued.queued || 0);
        toast(`${queued.queued || 0} fotografia(s) colocada(s) em processamento.`, 'neutral');
      }
      const uploadResult = await uploadPendingFiles(updated);
      if (uploadResult.coverPath && uploadResult.coverPath !== updated.cover_path) {
        await callAdmin('save-album', { album: buildPayload({ id: updated.id, coverPath: uploadResult.coverPath }) });
        await loadAlbums();
        updated = albums.find((album) => album.id === result.album.id) || updated;
      }
      if (
        queuedExistingWatermarks > 0
        || uploadResult.uploadedCount > 0
        || (payload.isActive && payload.watermarkEnabled)
      ) {
        await triggerWatermarkProcessing();
      }
      currentAlbum = updated;
      createdAlbumForModal = updated;
      markDrawerSaved();
      setMessage('Galeria guardada.', 'success');
      toast('Galeria guardada.');
      renderAll();
      if (result.accessCode) {
        lastShownCode = result.accessCode;
        accessCodeCache.set(updated.id, result.accessCode);
        els.codeValue.textContent = result.accessCode;
        setCodeState('visible', result.accessCode);
        closeDrawer();
        if (!saveAsDraftRequested) els.codeModal.showModal();
        else resetForm();
      } else {
        openDrawer(updated, currentStep);
      }
    });
  } catch (error) {
    const message = friendlyError(error, 'Não foi possível guardar as alterações.');
    setMessage(message, 'error');
    toast(message, 'error');
  } finally {
    drawerSaving = false;
    saveAsDraftRequested = false;
    updateDrawerSaveState();
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
  if (valid.length) markDrawerDirty();
}

function clearPendingFiles() {
  pendingFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  pendingFiles = [];
  selectedPendingCoverId = null;
}

function photoActionsMenu(actions) {
  const wrapper = document.createElement('div');
  wrapper.className = 'create-gallery-photo-menu';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'create-gallery-photo-menu__toggle';
  toggle.textContent = '•••';
  toggle.setAttribute('aria-label', 'Ações da fotografia');
  toggle.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.className = 'create-gallery-photo-menu__panel';
  panel.append(...actions);
  toggle.addEventListener('click', () => {
    const isOpen = wrapper.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  wrapper.append(toggle, panel);
  return wrapper;
}

function renderPhotos(existing = []) {
  clearElement(els.photoList);
  updateRestoreCard();
  const hasItems = existing.length || pendingFiles.length;
  if (!hasItems) {
    const empty = document.createElement('p');
    empty.className = 'create-gallery-photo-empty';
    empty.textContent = 'As fotografias adicionadas aparecerão aqui.';
    els.photoList.appendChild(empty);
    return;
  }

  const listHeader = document.createElement('div');
  listHeader.className = 'create-gallery-photo-head';
  const listTitle = document.createElement('h4');
  listTitle.textContent = `Fotografias adicionadas (${existing.length + pendingFiles.length})`;
  const orderToggle = document.createElement('button');
  orderToggle.type = 'button';
  orderToggle.textContent = 'Ordenar';
  orderToggle.disabled = existing.length < 2;
  orderToggle.title = existing.length < 2 ? 'Adicione ou guarde mais fotografias para ordenar' : 'Alterar a ordem das fotografias';
  orderToggle.addEventListener('click', () => {
    const isOrdering = els.photoList.classList.toggle('is-ordering');
    orderToggle.textContent = isOrdering ? 'Concluir' : 'Ordenar';
  });
  listHeader.append(listTitle, orderToggle);
  els.photoList.appendChild(listHeader);

  pendingFiles.forEach((item) => {
    const card = document.createElement('article');
    card.className = `create-gallery-photo${selectedPendingCoverId === item.id ? ' is-cover' : ''}`;
    card.innerHTML = `<img src="${item.previewUrl}" alt="${escapeText(item.file.name)}"><strong>${escapeText(item.file.name)}</strong>`;
    const caption = document.createElement('input');
    caption.placeholder = 'Legenda';
    caption.value = item.caption;
    caption.addEventListener('input', () => {
      item.caption = caption.value;
      markDrawerDirty();
    });
    const cover = actionButton(selectedPendingCoverId === item.id ? 'Capa' : 'Definir capa', () => {
      selectedPendingCoverId = item.id;
      renderPhotos(existing);
      markDrawerDirty();
    });
    const remove = actionButton('Remover', () => {
      URL.revokeObjectURL(item.previewUrl);
      pendingFiles = pendingFiles.filter((pending) => pending.id !== item.id);
      renderPhotos(existing);
      markDrawerDirty();
    });
    cover.classList.add('create-gallery-photo-cover-action');
    remove.classList.add('create-gallery-photo-delete-action');
    card.append(caption, photoActionsMenu([cover, remove]));
    els.photoList.appendChild(card);
  });

  existing.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((photo, index, ordered) => {
    const card = document.createElement('article');
    card.className = `create-gallery-photo${[photo.storage_path, photo.original_path, photo.web_path, photo.watermarked_path, photo.thumbnail_path].includes(currentAlbum?.cover_path) ? ' is-cover' : ''}`;
    const status = watermarkStatus(photo);
    const mode = photo.watermark_mode || 'inherit';
    const watermarkControl = document.createElement('label');
    watermarkControl.className = 'create-gallery-photo-watermark';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = photoUsesWatermark(photo);
    checkbox.addEventListener('change', () => setPhotoWatermarkMode(photo, checkbox.checked ? 'enabled' : 'disabled'));
    watermarkControl.append(checkbox, document.createTextNode(' Usar marca de água'));
    card.innerHTML = `
      <div class="create-gallery-photo-placeholder">Foto</div>
      <strong>${escapeText(photo.filename)}</strong>
      <span>${escapeText(photo.caption || 'Sem legenda')}</span>
      <small class="admin-processing-status admin-processing-status--${escapeText(status.key)}">${escapeText(status.label)}</small>
      ${photo.processing_error ? `<small class="admin-processing-error">${escapeText(photo.processing_error)}</small>` : ''}
    `;
    card.append(watermarkControl);
    if (mode !== 'inherit') {
      card.append(actionButton('Herdar galeria', () => setPhotoWatermarkMode(photo, 'inherit')));
    }
    if (status.key === 'failed') {
      card.append(actionButton('Tentar novamente', () => retryPhotoProcessing(photo)));
    }
    const setCoverButton = actionButton('Capa', () => setCover(photo));
    const moveUpButton = actionButton('↑', () => reorderPhoto(ordered, index, index - 1));
    const moveDownButton = actionButton('↓', () => reorderPhoto(ordered, index, index + 1));
    const deleteButton = actionButton('Eliminar', () => deletePhoto(photo));
    setCoverButton.classList.add('create-gallery-photo-cover-action');
    moveUpButton.classList.add('create-gallery-photo-order-action');
    moveDownButton.classList.add('create-gallery-photo-order-action');
    deleteButton.classList.add('create-gallery-photo-delete-action');
    card.append(photoActionsMenu([setCoverButton, moveUpButton, moveDownButton, deleteButton]));
    els.photoList.appendChild(card);
  });
}

async function uploadPendingFiles(album) {
  if (!pendingFiles.length) return { coverPath: currentAlbum?.cover_path || null, uploadedCount: 0 };
  els.uploadProgress.hidden = false;
  els.uploadProgress.value = 0;
  els.uploadProgress.max = pendingFiles.length;
  const uploadedCount = pendingFiles.length;
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
  els.uploadProgress.hidden = true;
  return { coverPath, uploadedCount };
}

async function triggerWatermarkProcessing({ notify = true } = {}) {
  try {
    const result = await callAdmin('trigger-watermark-processing');
    if (result.triggered) {
      if (notify) toast(`Processamento iniciado para ${result.pending || 0} fotografia(s).`, 'neutral');
      return true;
    }
    if (result.reason !== 'no_pending_jobs' && notify) {
      toast('As fotografias ficaram em fila e serão retomadas pelo processamento de segurança.', 'neutral');
    }
    return false;
  } catch (error) {
    if (handleExpiredAdminSession(error)) return false;
    if (notify) toast('As fotografias ficaram em fila e serão retomadas automaticamente.', 'neutral');
    return false;
  }
}

async function retryPhotoProcessing(photo) {
  if (!currentAlbum || !photo?.id) return;
  try {
    const result = await callAdmin('queue-watermark-processing', { albumId: currentAlbum.id, photoIds: [photo.id] });
    if (result.queued) await triggerWatermarkProcessing();
    await loadAlbums();
    const updated = albums.find((album) => album.id === currentAlbum.id);
    if (updated) openDrawer(updated, 2);
    toast('Processamento reenviado.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível reenviar o processamento.'), 'error');
  }
}

async function setPhotoWatermarkMode(photo, mode) {
  if (!currentAlbum || !photo?.id) return;
  try {
    const result = await callAdmin('set-photo-watermark-mode', {
      albumId: currentAlbum.id,
      photoId: photo.id,
      mode,
    });
    if (result.queued) await triggerWatermarkProcessing();
    await loadAlbums();
    const updated = albums.find((album) => album.id === currentAlbum.id);
    if (updated) openDrawer(updated, 2);
    toast(mode === 'inherit' ? 'Fotografia voltou a herdar a definição da galeria.' : 'Definição da fotografia atualizada.');
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível atualizar a marca desta fotografia.'), 'error');
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
      if (result.queued) await triggerWatermarkProcessing();
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
  const title = document.createElement('h4');
  title.textContent = 'Resumo da galeria';
  const content = document.createElement('div');
  content.className = 'create-gallery-summary__content';
  const cover = document.createElement('span');
  cover.className = 'create-gallery-summary__cover';
  const pendingCover = pendingFiles.find((item) => item.id === selectedPendingCoverId);
  const coverUrl = pendingCover?.previewUrl || currentAlbum?.cover_url;
  if (coverUrl) {
    const image = document.createElement('img');
    image.src = coverUrl;
    image.alt = 'Capa da galeria';
    cover.appendChild(image);
  } else {
    cover.innerHTML = '<b aria-hidden="true">▧</b><small>Sem capa</small>';
  }
  const details = document.createElement('div');
  details.className = 'create-gallery-summary__details';
  const name = document.createElement('strong');
  name.textContent = fields.title.value || 'Galeria sem nome';
  const meta = document.createElement('p');
  meta.textContent = [fields.eventType.value, fields.location.value, formatDate(fields.eventDate.value, '')].filter(Boolean).join(' · ');
  const facts = document.createElement('div');
  facts.className = 'create-gallery-summary__facts';
  const items = [
    ['Fotografias', `${pendingFiles.length + photoCount(currentAlbum || {})}`],
    ['Estado', fields.isActive.checked ? 'Ativa' : 'Rascunho'],
    ['Downloads', fields.downloadsEnabled.checked ? 'Sim' : 'Não'],
    ['Marca de água', fields.watermarkEnabled.checked ? 'Sim' : 'Não'],
    ['Venda de fotos', fields.salesEnabled.checked ? `${Number(fields.photoPrice.value || 0).toLocaleString('pt-PT', { style: 'currency', currency: fields.currency.value || 'EUR' })} / foto` : 'Não'],
    ['Expiração', fields.expiresAt.value ? formatDate(fields.expiresAt.value) : 'Sem expiração'],
  ];
  items.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.innerHTML = `<span>${label}</span><strong>${escapeText(value)}</strong>`;
    facts.appendChild(row);
  });
  details.append(name, meta, facts);
  content.append(cover, details);
  els.confirmSummary.append(title, content);
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
    if (error.status === 409 || error.code === 'code_unrecoverable') {
      setCodeState('unrecoverable');
      const confirmed = await askConfirm('Código antigo indisponível', 'Esta galeria foi criada antes de o código ficar cifrado para recuperação. Quer gerar um novo código seguro agora? As sessões atuais serão terminadas.');
      if (confirmed) await regenerateCode({ skipConfirm: true });
      else toast('Pode gerar um novo código quando quiser.', 'neutral');
    } else {
      setCodeState('error');
      toast(friendlyError(error, 'Não foi possível obter o código.'), 'error');
    }
  } finally {
    codeLoading = false;
  }
}

async function regenerateCode(options = {}) {
  if (!currentAlbum) return;
  if (!options.skipConfirm && !await askConfirm('Gerar novo código', 'O código antigo deixa de funcionar e todas as sessões serão terminadas.')) return;
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
    ? {
        isActive: true,
        isArchived: false,
        status: 'active',
        ...(hasExpired(currentAlbum.expires_at) ? { expiresAt: null } : {}),
      }
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

function notificationTime(value) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'Agora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(date);
}

function renderAdminNotifications() {
  if (!els.notificationsList) return;
  clearElement(els.notificationsList);
  const unread = adminNotifications.filter((item) => !item.is_read).length;
  els.notificationsCount.textContent = String(unread > 99 ? '99+' : unread);
  els.notificationsCount.hidden = unread === 0;
  els.notificationsToggle.setAttribute('aria-label', unread ? `Abrir notificações, ${unread} por ler` : 'Abrir notificações');
  if (!adminNotifications.length) {
    els.notificationsList.innerHTML = '<p class="admin-notifications-empty">Não existem novas notificações.</p>';
    els.notificationsReadAll.hidden = true;
    return;
  }
  els.notificationsReadAll.hidden = unread === 0;
  adminNotifications.forEach((notification) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-notification${notification.is_read ? ' is-read' : ''}`;
    button.innerHTML = `<span class="admin-notification__dot" aria-hidden="true"></span><span><strong>${escapeText(notification.title)}</strong><p>${escapeText(notification.message)}</p></span><time datetime="${escapeText(notification.created_at)}">${escapeText(notificationTime(notification.created_at))}</time>`;
    button.addEventListener('click', async () => {
      if (!notification.is_read) {
        const { error } = await supabase.from('admin_notifications').update({ is_read: true }).eq('id', notification.id);
        if (!error) { notification.is_read = true; renderAdminNotifications(); }
      }
      els.notificationsPanel.hidden = true;
      els.notificationsToggle.setAttribute('aria-expanded', 'false');
      if (notification.related_kind === 'order') requestView('orders');
      if (notification.related_kind === 'gallery') requestView('galleries');
      if (notification.related_kind === 'storage') { await requestView('settings'); await requestSettingsSection('storage'); }
    });
    els.notificationsList.appendChild(button);
  });
}

async function loadAdminNotifications() {
  if (!supabase || !els.notificationsToggle) return;
  try {
    await supabase.rpc('refresh_gallery_expiry_notifications');
    const { data, error } = await supabase.from('admin_notifications')
      .select('id,type,title,message,related_kind,related_id,is_read,created_at')
      .order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    adminNotifications = data || [];
    els.notificationsToggle.hidden = false;
    renderAdminNotifications();
  } catch (error) {
    adminNotifications = [];
    els.notificationsToggle.hidden = true;
    els.notificationsPanel.hidden = true;
  }
}

function normalizedSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT').trim();
}

function closeGlobalSearch() {
  if (els.globalSearchDialog?.open) els.globalSearchDialog.close();
}

async function openGlobalSearch() {
  if (!els.globalSearchDialog || els.globalSearchDialog.open) return;
  els.globalSearchDialog.showModal();
  els.globalSearchInput.value = '';
  els.globalSearchResults.innerHTML = '<div class="admin-global-search__hint"><strong>Pesquisa global</strong><p>Encontre galerias, encomendas e clientes reais.</p></div>';
  requestAnimationFrame(() => els.globalSearchInput.focus({ preventScroll: true }));
  if (!globalSearchOrdersLoaded) {
    try {
      const data = await callAdminOrders('list', { filters: {} });
      globalSearchOrders = data.orders || [];
      globalSearchOrdersLoaded = true;
      if (els.globalSearchInput.value.trim()) renderGlobalSearchResults();
    } catch (error) {
      globalSearchOrders = [];
    }
  }
}

function globalSearchResultButton({ kind, title, meta, id }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.searchKind = kind;
  button.dataset.searchId = id;
  const type = document.createElement('i');
  type.textContent = kind === 'gallery' ? 'Galeria' : 'Encomenda';
  const copy = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = title;
  const small = document.createElement('small');
  small.textContent = meta;
  copy.append(strong, small);
  button.append(type, copy);
  button.addEventListener('click', async () => {
    closeGlobalSearch();
    if (kind === 'gallery') {
      await requestView('galleries');
      const album = albums.find((item) => item.id === id);
      if (album) openDrawer(album, 1);
    } else {
      await requestView('orders');
      await openOrderDetail(id);
    }
  });
  return button;
}

function renderGlobalSearchResults() {
  if (!els.globalSearchResults) return;
  const query = normalizedSearchText(els.globalSearchInput.value);
  clearElement(els.globalSearchResults);
  if (query.length < 2) {
    els.globalSearchResults.innerHTML = '<div class="admin-global-search__hint"><strong>Escreva pelo menos 2 caracteres</strong><p>A pesquisa não envia dados para serviços externos.</p></div>';
    return;
  }

  const galleryMatches = albums.filter((album) => normalizedSearchText([album.title, album.location, album.event_type].join(' ')).includes(query)).slice(0, 6);
  const orderMatches = globalSearchOrders.filter((order) => normalizedSearchText([order.order_number, order.customer_email, order.album?.title].join(' ')).includes(query)).slice(0, 6);
  if (!galleryMatches.length && !orderMatches.length) {
    els.globalSearchResults.innerHTML = '<div class="admin-global-search__hint"><strong>Sem resultados</strong><p>Tente o nome da galeria, referência ou email do cliente.</p></div>';
    return;
  }
  galleryMatches.forEach((album) => els.globalSearchResults.appendChild(globalSearchResultButton({
    kind: 'gallery', id: album.id, title: album.title, meta: [album.location, album.event_type].filter(Boolean).join(' · ') || 'Galeria',
  })));
  orderMatches.forEach((order) => els.globalSearchResults.appendChild(globalSearchResultButton({
    kind: 'order', id: order.id, title: order.order_number, meta: [order.album?.title, order.customer_email].filter(Boolean).join(' · '),
  })));
}

async function loadAlbums() {
  const requestVersion = ++albumLoadVersion;
  if (!albums.length && activeView === 'overview') skeletonDashboard();
  if (activeView === 'settings' && settingsSection === 'storage') renderStorageSettings({ loading: true });
  try {
    const data = await callAdmin('list');
    if (requestVersion !== albumLoadVersion) return;
    albums = data.albums || [];
    storageInfo = data.storage || null;
    renderAll();
    renderStorageSettings();
  } catch (error) {
    if (requestVersion !== albumLoadVersion) return;
    renderStorageSettings({ error: true });
    toast(friendlyError(error, 'Não foi possível carregar as galerias.'), 'error');
  }
}

function orderMoney(cents, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(Number(cents || 0) / 100);
}

const orderStatusLabels = {
  pending: 'Pendente', paid: 'Paga', partially_refunded: 'Reembolso parcial',
  refunded: 'Reembolsada', failed: 'Falhou', expired: 'Expirada',
};

function populateOrderGalleryFilter() {
  if (!els.orderGalleryFilter) return;
  const selected = els.orderGalleryFilter.value;
  els.orderGalleryFilter.replaceChildren(new Option('Todas as galerias', ''));
  albums.forEach((album) => els.orderGalleryFilter.append(new Option(album.title, album.id)));
  els.orderGalleryFilter.value = selected;
}

async function loadOrders() {
  if (!els.ordersList) return;
  populateOrderGalleryFilter();
  els.ordersList.innerHTML = '<p class="admin-orders-empty">A carregar encomendas…</p>';
  try {
    const data = await callAdminOrders('list', { filters: {
      galleryId: els.orderGalleryFilter.value,
      status: els.orderStatusFilter.value,
      email: els.orderEmailFilter.value,
      dateFrom: els.orderDateFrom.value,
      dateTo: els.orderDateTo.value,
    } });
    orders = data.orders || [];
    renderOrders();
  } catch (error) {
    els.ordersList.innerHTML = `<p class="admin-orders-empty">${escapeText(friendlyError(error, 'Não foi possível carregar as encomendas.'))}</p>`;
  }
}

function renderOrders() {
  clearElement(els.ordersList);
  if (!orders.length) {
    const hasFilters = Boolean(els.orderGalleryFilter.value || els.orderStatusFilter.value || els.orderEmailFilter.value || els.orderDateFrom.value || els.orderDateTo.value);
    if (hasFilters) {
      els.ordersList.innerHTML = '<div class="admin-orders-empty"><span aria-hidden="true"></span><strong>Sem resultados</strong><p>Altere ou limpe os filtros aplicados.</p></div>';
    } else {
      els.ordersList.innerHTML = '<div class="admin-orders-empty"><span aria-hidden="true"></span><strong>Ainda não existem encomendas</strong><p>As compras realizadas nas galerias aparecerão aqui.</p><button type="button">Ver galerias</button></div>';
      els.ordersList.querySelector('button').addEventListener('click', () => requestView('galleries'));
    }
    return;
  }
  const table = document.createElement('table');
  table.className = 'admin-orders-table';
  table.innerHTML = '<thead><tr><th>Encomenda</th><th>Galeria</th><th>Cliente</th><th>Fotos</th><th>Total</th><th>Estado</th><th>Data</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');
  orders.forEach((order) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td><strong>${escapeText(order.order_number)}</strong></td><td>${escapeText(order.album?.title || '—')}</td><td>${escapeText(order.customer_email || 'A aguardar')}</td><td>${Number(order.itemCount || 0)}</td><td><strong>${escapeText(orderMoney(order.total_cents, order.currency))}</strong></td><td><span class="admin-order-status is-${escapeText(order.status)}">${escapeText(orderStatusLabels[order.status] || order.status)}</span></td><td>${escapeText(formatDateTime(order.paid_at || order.created_at))}</td><td><button type="button" class="admin-order-open">Ver</button></td>`;
    row.querySelector('.admin-order-open').addEventListener('click', () => openOrderDetail(order.id));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  els.ordersList.appendChild(table);
}

async function openOrderDetail(orderId) {
  els.orderDetail.innerHTML = '<p class="admin-orders-empty">A carregar detalhes…</p>';
  els.orderDialog.showModal();
  try {
    const { order } = await callAdminOrders('detail', { orderId });
    const itemCards = (order.items || []).map((item) => `<article><img src="${escapeText(item.previewUrl || '')}" alt="" /><div><strong>${escapeText(item.filename)}</strong><small>${escapeText(orderMoney(item.unitPriceCents, order.currency))}</small></div></article>`).join('');
    els.orderDetail.innerHTML = `
      <header class="admin-order-detail-head"><span>ENCOMENDA</span><h2>${escapeText(order.order_number)}</h2><p>${escapeText(order.album?.title || '')}</p></header>
      <div class="admin-order-detail-grid"><dl>
        <div><dt>Cliente</dt><dd>${escapeText(order.customer_email || 'A aguardar pagamento')}</dd></div>
        <div><dt>Estado</dt><dd><span class="admin-order-status is-${escapeText(order.status)}">${escapeText(orderStatusLabels[order.status] || order.status)}</span></dd></div>
        <div><dt>Total</dt><dd>${escapeText(orderMoney(order.total_cents, order.currency))}</dd></div>
        <div><dt>Pago em</dt><dd>${escapeText(formatDateTime(order.paid_at))}</dd></div>
        <div><dt>Downloads até</dt><dd>${escapeText(formatDateTime(order.expires_at))}</dd></div>
        <div><dt>Email enviado</dt><dd>${escapeText(formatDateTime(order.email_sent_at, 'Não'))}</dd></div>
        <details class="admin-order-stripe"><summary>Referências Stripe</summary><small>Sessão: ${escapeText(order.stripe_checkout_session_id || '—')}<br>Pagamento: ${escapeText(order.stripe_payment_intent_id || '—')}</small></details>
      </dl><section class="admin-order-items">${itemCards}</section></div>
      <footer class="admin-order-detail-actions"><button type="button" data-order-resend>Reenviar email</button><button type="button" class="admin-text-danger" data-order-invalidate>Invalidar downloads</button></footer>`;
    els.orderDetail.querySelector('[data-order-resend]').addEventListener('click', async (event) => {
      await withBusy(event.currentTarget, 'A enviar…', async () => {
        try { await callAdminOrders('resend-email', { orderId }); toast('Email reenviado.'); }
        catch (error) { toast(friendlyError(error, 'Não foi possível enviar o email.'), 'error'); }
      });
    });
    els.orderDetail.querySelector('[data-order-invalidate]').addEventListener('click', async () => {
      if (!await askConfirm('Invalidar downloads?', 'As ligações desta encomenda deixam de funcionar imediatamente.')) return;
      try { await callAdminOrders('invalidate-downloads', { orderId }); els.orderDialog.close(); await loadOrders(); toast('Downloads invalidados.'); }
      catch (error) { toast(friendlyError(error, 'Não foi possível invalidar os downloads.'), 'error'); }
    });
  } catch (error) {
    els.orderDetail.innerHTML = `<p class="admin-orders-empty">${escapeText(friendlyError(error, 'Não foi possível carregar a encomenda.'))}</p>`;
  }
}

const billingStatusLabels = {
  paid: 'Pago', pending: 'Pendente', failed: 'Falhado', expired: 'Expirado',
  refunded: 'Reembolsado', partially_refunded: 'Reembolso parcial',
};

function billingMoney(cents, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: String(currency || 'EUR').toUpperCase() })
    .format(Number(cents || 0) / 100);
}

function billingMonthLabel(key, long = false) {
  const [year, month] = String(key || '').split('-').map(Number);
  if (!year || !month) return '';
  return new Intl.DateTimeFormat('pt-PT', { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function setBillingMode(showList, { updateHash = true } = {}) {
  billingListMode = Boolean(showList);
  if (els.billingDashboardView) els.billingDashboardView.hidden = billingListMode;
  if (els.billingListView) els.billingListView.hidden = !billingListMode;
  if (updateHash && activeView === 'billing') {
    history.replaceState(null, '', `${location.pathname}${location.search}${billingListMode ? '#faturacao/faturas' : '#faturacao'}`);
  }
}

function skeletonBillingDashboard() {
  if (els.billingMetrics) {
    els.billingMetrics.innerHTML = '<article class="admin-billing-metric is-skeleton"></article>'.repeat(4);
  }
  if (els.billingRecentTable) els.billingRecentTable.innerHTML = '<div class="admin-billing-table-skeleton"></div>';
  if (els.billingChart) els.billingChart.innerHTML = '<div class="admin-billing-chart-skeleton"></div>';
  if (els.billingStripe) els.billingStripe.innerHTML = '<div class="admin-billing-card-skeleton"></div>';
  if (els.billingProfile) els.billingProfile.innerHTML = '<div class="admin-billing-card-skeleton"></div>';
}

function billingMetric(icon, label, value, detail, tone = '', trend = '') {
  const article = document.createElement('article');
  article.className = `admin-billing-metric${tone ? ` is-${tone}` : ''}`;
  article.innerHTML = `<span class="admin-billing-metric__icon" aria-hidden="true"><i class="admin-billing-metric__glyph is-${escapeText(icon)}"></i></span><div><span>${escapeText(label)}</span><strong>${escapeText(value)}</strong><small class="${escapeText(trend)}">${escapeText(detail)}</small></div>`;
  return article;
}

function renderBillingMetrics(summary, currency) {
  if (!els.billingMetrics) return;
  clearElement(els.billingMetrics);
  const comparison = summary.comparisonPercent;
  const comparisonText = comparison == null ? 'Sem dados comparáveis no mês anterior' : `${comparison > 0 ? '+' : ''}${comparison}% vs mês anterior`;
  const comparisonTone = comparison == null ? '' : comparison >= 0 ? 'is-positive' : 'is-negative';
  appendChildren(els.billingMetrics, [
    billingMetric('billed', 'Faturado este mês', billingMoney(summary.currentMonthCents, currency), comparisonText, '', comparisonTone),
    billingMetric('received', 'Pagamentos recebidos', billingMoney(summary.receivedCents, currency), `${Number(summary.receivedPayments || 0)} pagamentos confirmados`, 'success'),
    billingMetric('invoices', 'Faturas emitidas', String(summary.invoiceCount || 0), summary.invoicesConfigured ? 'Este período' : 'Emissão fiscal não configurada'),
    billingMetric('pending', 'Pagamentos pendentes', billingMoney(summary.pendingCents, currency), `${Number(summary.pendingCount || 0)} pagamentos pendentes`, 'warning'),
  ]);
}

function billingTable(records, { emptyMessage = 'Ainda não existem registos de faturação.' } = {}) {
  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-billing-empty';
    empty.innerHTML = `<div><strong>${escapeText(emptyMessage)}</strong><p>Os pagamentos aparecerão aqui quando forem criados.</p></div>`;
    return empty;
  }
  const table = document.createElement('table');
  table.className = 'admin-billing-table';
  table.innerHTML = '<thead><tr><th>Referência</th><th>Cliente</th><th>Data</th><th>Galeria</th><th>Total</th><th>Estado</th></tr></thead>';
  const tbody = document.createElement('tbody');
  records.forEach((record) => {
    const row = document.createElement('tr');
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Abrir ${record.reference}`);
    row.innerHTML = `
      <td data-label="Referência"><strong>${escapeText(record.reference || '—')}</strong><small>Documento interno</small></td>
      <td data-label="Cliente">${escapeText(record.customerEmail || 'Cliente não identificado')}</td>
      <td data-label="Data">${escapeText(formatDateTime(record.paidAt || record.createdAt))}</td>
      <td data-label="Galeria">${escapeText(record.album?.title || '—')}</td>
      <td data-label="Total"><strong>${escapeText(billingMoney(record.totalCents, record.currency))}</strong></td>
      <td data-label="Estado"><span class="admin-billing-status is-${escapeText(record.status)}">${escapeText(billingStatusLabels[record.status] || record.status)}</span></td>`;
    const open = () => openBillingDetail(record.id);
    row.addEventListener('click', open);
    row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function renderBillingRecent(records) {
  if (!els.billingRecentTable) return;
  clearElement(els.billingRecentTable);
  els.billingRecentTable.appendChild(billingTable(records));
}

function renderBillingStripe(stripeState) {
  if (!els.billingStripe) return;
  const stateLabel = !stripeState.configured ? 'Não configurada' : stripeState.mode === 'test' ? 'Ligada · Modo de teste' : 'Ligada · Produção';
  els.billingStripe.innerHTML = `
    <div class="admin-billing-stripe__identity"><span class="admin-billing-stripe__logo" aria-hidden="true">S</span><div><strong>Stripe</strong><small>Pagamentos online</small></div></div>
    <dl><div><dt>Estado</dt><dd><span class="admin-billing-status ${stripeState.configured ? 'is-paid' : 'is-failed'}">${escapeText(stateLabel)}</span></dd></div><div><dt>Moeda</dt><dd>${escapeText(stripeState.currency || 'EUR')}</dd></div></dl>
    <p class="admin-billing-stripe__note">Os pagamentos são processados de forma segura através da Stripe. As chaves privadas nunca são apresentadas no painel.</p>`;
}

function renderBillingProfile(profile, schemaAvailable = true) {
  if (!els.billingProfile) return;
  billingProfile = profile || null;
  const hasData = profile && ['business_name', 'tax_id', 'billing_email', 'address_line1', 'address_line2', 'postal_code', 'city', 'country']
    .some((key) => String(profile[key] || '').trim());
  els.billingEditProfile.disabled = !schemaAvailable;
  if (!hasData) {
    els.billingProfile.innerHTML = `<div class="admin-billing-profile__empty"><strong>Dados fiscais ainda não configurados.</strong><p>${schemaAvailable ? 'Adicione os dados usados pela administradora.' : 'A migration do perfil fiscal ainda não foi aplicada.'}</p><button type="button" data-billing-add-profile ${schemaAvailable ? '' : 'disabled'}>Adicionar dados</button></div>`;
    els.billingProfile.querySelector('[data-billing-add-profile]')?.addEventListener('click', openBillingProfileDialog);
    return;
  }
  const address = [profile.address_line1, profile.address_line2, profile.postal_code, profile.city, profile.country].filter(Boolean).join(', ');
  els.billingProfile.innerHTML = `<dl>
    <div><dt>Nome / Empresa</dt><dd>${escapeText(profile.business_name || '—')}</dd></div>
    <div><dt>NIF</dt><dd>${escapeText(profile.tax_id || '—')}</dd></div>
    <div><dt>Email</dt><dd>${escapeText(profile.billing_email || '—')}</dd></div>
    <div><dt>Morada</dt><dd>${escapeText(address || '—')}</dd></div>
  </dl>`;
}

function renderBillingChart(summary, currency) {
  if (!els.billingChart) return;
  clearElement(els.billingChart);
  const series = summary.series || [];
  const hasData = series.some((point) => Number(point.totalCents) > 0);
  if (!hasData) {
    const empty = document.createElement('div');
    empty.className = 'admin-billing-empty';
    empty.innerHTML = '<div><strong>Ainda não existem dados suficientes.</strong><p>O gráfico usa exclusivamente pagamentos confirmados.</p></div>';
    els.billingChart.appendChild(empty);
    return;
  }
  const width = 900;
  const height = 260;
  const padding = { top: 20, right: 22, bottom: 40, left: 54 };
  const max = Math.max(...series.map((point) => Number(point.totalCents || 0)), 100);
  const xStep = series.length > 1 ? (width - padding.left - padding.right) / (series.length - 1) : 0;
  const points = series.map((point, index) => ({
    ...point,
    x: series.length === 1 ? width / 2 : padding.left + index * xStep,
    y: padding.top + (1 - Number(point.totalCents || 0) / max) * (height - padding.top - padding.bottom),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padding.left},${height - padding.bottom} ${line} ${points.at(-1).x},${height - padding.bottom}`;
  const gridLines = [0, .25, .5, .75, 1].map((ratio) => {
    const y = padding.top + ratio * (height - padding.top - padding.bottom);
    const value = max * (1 - ratio);
    return `<line class="admin-billing-chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/><text class="admin-billing-chart-label" x="0" y="${y + 4}">${escapeText(billingMoney(value, currency).replace(/,00\s?€/, ' €'))}</text>`;
  }).join('');
  const labels = points.map((point) => `<text class="admin-billing-chart-label" text-anchor="middle" x="${point.x}" y="${height - 12}">${escapeText(billingMonthLabel(point.month))}</text>`).join('');
  const circles = points.map((point, index) => `<circle class="admin-billing-chart-point" tabindex="0" role="img" aria-label="${escapeText(`${billingMonthLabel(point.month, true)}: ${billingMoney(point.totalCents, currency)}, ${point.payments} pagamentos`)}" data-chart-point="${index}" cx="${point.x}" cy="${point.y}" r="5"/>`).join('');
  els.billingChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-label="Resumo de pagamentos confirmados" role="img"><defs><linearGradient id="billingChartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a87553" stop-opacity=".24"/><stop offset="100%" stop-color="#a87553" stop-opacity=".02"/></linearGradient></defs>${gridLines}<polygon class="admin-billing-chart-area" points="${area}"/><polyline class="admin-billing-chart-line" points="${line}"/>${circles}${labels}</svg>`;
  const hideTooltip = () => els.billingChart.querySelector('.admin-billing-chart-tooltip')?.remove();
  els.billingChart.querySelectorAll('[data-chart-point]').forEach((circle) => {
    const showTooltip = () => {
      hideTooltip();
      const point = points[Number(circle.dataset.chartPoint)];
      const tooltip = document.createElement('div');
      tooltip.className = 'admin-billing-chart-tooltip';
      tooltip.style.left = `${(point.x / width) * 100}%`;
      tooltip.style.top = `${(point.y / height) * 100}%`;
      tooltip.innerHTML = `<span>${escapeText(billingMonthLabel(point.month, true))}</span><strong>${escapeText(billingMoney(point.totalCents, currency))}</strong><small>${Number(point.payments)} pagamentos</small>`;
      els.billingChart.appendChild(tooltip);
    };
    circle.addEventListener('mouseenter', showTooltip);
    circle.addEventListener('focus', showTooltip);
    circle.addEventListener('mouseleave', hideTooltip);
    circle.addEventListener('blur', hideTooltip);
  });
}

function renderBillingDashboard() {
  if (!billingDashboard) return;
  const currency = billingDashboard.stripe?.currency || 'EUR';
  renderBillingMetrics(billingDashboard.summary, currency);
  renderBillingRecent(billingDashboard.recent || []);
  renderBillingChart(billingDashboard.summary, currency);
  renderBillingStripe(billingDashboard.stripe || { configured: false, mode: 'unconfigured', currency });
  renderBillingProfile(billingDashboard.profile, billingDashboard.profileSchemaAvailable !== false);
}

async function loadBillingDashboard({ force = false } = {}) {
  if (!els.billingPage || billingLoading) return;
  const months = Number(els.billingChartRange?.value || 6);
  if (!force && billingDashboard?.months === months) {
    renderBillingDashboard();
    return;
  }
  billingLoading = true;
  els.billingError.hidden = true;
  skeletonBillingDashboard();
  try {
    billingDashboard = await callAdminBilling('dashboard', { months });
    billingDashboard.months = months;
    renderBillingDashboard();
  } catch (error) {
    if (handleExpiredAdminSession(error)) return;
    els.billingError.hidden = false;
    els.billingErrorMessage.textContent = friendlyError(error, 'Verifique a ligação e tente novamente.');
  } finally {
    billingLoading = false;
  }
}

function billingFilterPayload() {
  return { ...billingFilters };
}

async function loadBillingList() {
  if (!els.billingListTable) return;
  els.billingListTable.innerHTML = '<div class="admin-billing-table-skeleton"></div>';
  els.billingPagination.innerHTML = '';
  try {
    const data = await callAdminBilling('list', { filters: billingFilterPayload(), page: billingListPage, pageSize: 10 });
    billingListRecords = data.records || [];
    billingListCount = Number(data.count || 0);
    clearElement(els.billingListTable);
    els.billingListTable.appendChild(billingTable(billingListRecords));
    renderBillingPagination();
  } catch (error) {
    if (handleExpiredAdminSession(error)) return;
    els.billingListTable.innerHTML = `<div class="admin-billing-empty"><div><strong>Não foi possível carregar os registos.</strong><p>${escapeText(friendlyError(error))}</p></div></div>`;
  }
}

function renderBillingPagination() {
  if (!els.billingPagination) return;
  clearElement(els.billingPagination);
  const totalPages = Math.max(1, Math.ceil(billingListCount / 10));
  const first = billingListCount ? (billingListPage - 1) * 10 + 1 : 0;
  const last = Math.min(billingListCount, billingListPage * 10);
  const label = document.createElement('small');
  label.textContent = `A mostrar ${first} a ${last} de ${billingListCount}`;
  const controls = document.createElement('div');
  controls.className = 'admin-billing-pagination-buttons';
  const addButton = (labelText, page, disabled = false, active = false) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = labelText; button.disabled = disabled; button.classList.toggle('is-active', active);
    button.addEventListener('click', () => { billingListPage = page; loadBillingList(); });
    controls.appendChild(button);
  };
  addButton('‹', Math.max(1, billingListPage - 1), billingListPage === 1);
  const start = Math.max(1, Math.min(billingListPage - 1, totalPages - 2));
  for (let page = start; page <= Math.min(totalPages, start + 2); page += 1) addButton(String(page), page, false, page === billingListPage);
  addButton('›', Math.min(totalPages, billingListPage + 1), billingListPage === totalPages);
  els.billingPagination.append(label, controls);
}

function openBillingProfileDialog() {
  if (!els.billingProfileDialog || els.billingEditProfile?.disabled) return;
  const form = els.billingProfileForm;
  const profile = billingProfile || {};
  form.elements.businessName.value = profile.business_name || '';
  form.elements.taxId.value = profile.tax_id || '';
  form.elements.billingEmail.value = profile.billing_email || '';
  form.elements.addressLine1.value = profile.address_line1 || '';
  form.elements.addressLine2.value = profile.address_line2 || '';
  form.elements.postalCode.value = profile.postal_code || '';
  form.elements.city.value = profile.city || '';
  form.elements.country.value = profile.country || '';
  setInlineMessage(els.billingProfileMessage, '');
  els.billingProfileDialog.showModal();
  form.elements.businessName.focus();
}

async function saveBillingProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = form.querySelector('[type="submit"]');
  const payload = Object.fromEntries(new FormData(form).entries());
  await withBusy(button, 'A guardar…', async () => {
    try {
      const data = await callAdminBilling('save-profile', { profile: payload });
      billingProfile = data.profile;
      if (billingDashboard) billingDashboard.profile = data.profile;
      renderBillingProfile(data.profile, true);
      els.billingProfileDialog.close();
      toast('Dados fiscais atualizados.');
    } catch (error) {
      setInlineMessage(els.billingProfileMessage, friendlyError(error, error.message || 'Não foi possível guardar os dados fiscais.'), 'error');
    }
  });
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function exportBilling() {
  try {
    const data = await callAdminBilling('export', { filters: billingListMode ? billingFilterPayload() : {} });
    const rows = data.records || [];
    const statusText = (status) => billingStatusLabels[status] || status;
    const lines = [
      ['Referência interna', 'Cliente', 'Email', 'Data', 'Subtotal', 'Desconto', 'Total', 'Reembolsado', 'Moeda', 'Estado', 'Galeria', 'Fotografias'],
      ...rows.map((record) => [record.reference, record.customerEmail || 'Cliente não identificado', record.customerEmail || '', record.paidAt || record.createdAt, (record.subtotalCents / 100).toFixed(2).replace('.', ','), (record.discountCents / 100).toFixed(2).replace('.', ','), (record.totalCents / 100).toFixed(2).replace('.', ','), (record.refundedCents / 100).toFixed(2).replace('.', ','), record.currency, statusText(record.status), record.album?.title || '', record.itemCount]),
    ];
    const csv = `\uFEFF${lines.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fotografia-arnaut-faturacao-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    toast(`${rows.length} registos exportados.`);
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível exportar a faturação.'), 'error');
  }
}

async function openBillingDetail(orderId) {
  if (!els.billingDetailDialog) return;
  els.billingDetail.innerHTML = '<div class="admin-billing-detail-skeleton"></div>';
  els.billingDetailDialog.showModal();
  try {
    const { record } = await callAdminBilling('detail', { orderId });
    const items = (record.items || []).map((item) => `<li><span>${escapeText(item.filename)}</span><strong>${escapeText(billingMoney(item.unitPriceCents, record.currency))}</strong></li>`).join('');
    els.billingDetail.innerHTML = `
      <header class="admin-billing-detail-head"><div><span>Referência interna</span><h2 id="billing-detail-title">${escapeText(record.reference)}</h2><p>${escapeText(record.album?.title || 'Sem galeria associada')}</p></div></header>
      <div class="admin-billing-detail-body"><dl class="admin-billing-detail-grid">
        <div><dt>Cliente</dt><dd>${escapeText(record.customerEmail || 'Cliente não identificado')}</dd></div>
        <div><dt>Estado</dt><dd><span class="admin-billing-status is-${escapeText(record.status)}">${escapeText(billingStatusLabels[record.status] || record.status)}</span></dd></div>
        <div><dt>Data</dt><dd>${escapeText(formatDateTime(record.paidAt || record.createdAt))}</dd></div>
        <div><dt>Método</dt><dd>${escapeText(record.paymentMethod || 'Não disponível')}</dd></div>
        <div><dt>Subtotal</dt><dd>${escapeText(billingMoney(record.subtotalCents, record.currency))}</dd></div>
        <div><dt>Desconto</dt><dd>${escapeText(billingMoney(record.discountCents, record.currency))}</dd></div>
        <div><dt>Total</dt><dd>${escapeText(billingMoney(record.totalCents, record.currency))}</dd></div>
        <div><dt>Reembolsado</dt><dd>${escapeText(billingMoney(record.refundedCents, record.currency))}</dd></div>
        <div><dt>PaymentIntent</dt><dd>${escapeText(record.paymentIntentId || '—')}</dd></div>
        <div><dt>Downloads até</dt><dd>${escapeText(formatDateTime(record.expiresAt))}</dd></div>
      </dl><section class="admin-billing-detail-items"><h3>Fotografias compradas (${Number(record.itemCount || 0)})</h3><ul>${items || '<li><span>Sem fotografias associadas.</span></li>'}</ul></section></div>
      <footer class="admin-billing-detail-actions"><button type="button" data-billing-resend>Reenviar email</button>${record.canRefund ? '<button type="button" class="is-danger" data-billing-refund>Reembolsar pagamento</button>' : ''}</footer>`;
    els.billingDetail.querySelector('[data-billing-resend]')?.addEventListener('click', async (event) => {
      await withBusy(event.currentTarget, 'A enviar…', async () => {
        try { await callAdminOrders('resend-email', { orderId }); toast('Email reenviado.'); }
        catch (error) { toast(friendlyError(error, 'Não foi possível reenviar o email.'), 'error'); }
      });
    });
    els.billingDetail.querySelector('[data-billing-refund]')?.addEventListener('click', async (event) => {
      const remaining = Math.max(0, Number(record.totalCents) - Number(record.refundedCents || 0));
      const confirmed = await askConfirm('Reembolsar pagamento?', `Valor: ${billingMoney(remaining, record.currency)}. A ação será processada através da Stripe.`, { confirmLabel: 'Confirmar reembolso' });
      if (!confirmed) return;
      await withBusy(event.currentTarget, 'A processar…', async () => {
        try {
          await callAdminBilling('refund', { orderId });
          els.billingDetailDialog.close();
          billingDashboard = null;
          await loadBillingDashboard({ force: true });
          if (billingListMode) await loadBillingList();
          toast('Reembolso enviado à Stripe. O estado será atualizado pelo webhook.');
        } catch (error) { toast(friendlyError(error, error.message || 'Não foi possível iniciar o reembolso.'), 'error'); }
      });
    });
  } catch (error) {
    els.billingDetail.innerHTML = `<div class="admin-billing-empty"><div><strong>Não foi possível abrir o registo.</strong><p>${escapeText(friendlyError(error))}</p></div></div>`;
  }
}

async function showApp(activeSession, { reload = false } = {}) {
  if (!activeSession?.user) {
    showLogin();
    return;
  }
  const previousUserId = authenticatedUserId;
  session = activeSession;
  authenticatedUserId = activeSession.user.id;
  setAuthUiState('authenticated');
  if (location.hash.startsWith('#definicoes/')) {
    activeView = 'settings';
    settingsSection = settingsSectionFromHash(location.hash);
  } else if (location.hash.startsWith('#faturacao')) {
    activeView = 'billing';
    billingListMode = location.hash === '#faturacao/faturas';
  } else if (location.hash === '#portfolio') {
    activeView = 'portfolio';
  }
  els.content.classList.toggle('is-overview-active', activeView === 'overview');
  if (previousUserId !== authenticatedUserId || !adminProfile) {
    try {
      await loadSettingsData();
    } catch (error) {
      adminProfile = normalizeAdminProfile({
        full_name: activeSession.user.user_metadata?.display_name,
        avatar_path: activeSession.user.user_metadata?.avatar_path,
      }, displayNameFor(activeSession.user));
      userPreferences = normalizeUserPreferences();
      populateSettingsForms();
      toast(friendlyError(error, 'Não foi possível carregar as definições.'), 'error');
    }
  }
  await refreshProfileUI({ refreshAvatar: previousUserId !== authenticatedUserId });
  if (reload || previousUserId !== authenticatedUserId || !albums.length) {
    appLoadPromise ||= loadAlbums().finally(() => { appLoadPromise = null; });
    await appLoadPromise;
  } else {
    renderAll();
  }
  setView(activeView);
  await loadAdminNotifications();
  if (!notificationsRefreshTimer) {
    notificationsRefreshTimer = window.setInterval(() => loadAdminNotifications(), 60_000);
  }
}

function showLogin(notice = '') {
  session = null;
  recoveryMode = false;
  setAuthUiState('unauthenticated');
  els.loginForm.elements.password.value = '';
  setInlineMessage(els.loginMessage, notice || pendingLoginNotice, notice || pendingLoginNotice ? 'success' : 'neutral');
  pendingLoginNotice = '';
}

async function verifyAuthentication() {
  if (!supabase) {
    setAuthUiState('error', {
      title: 'Configuração em falta',
      message: 'Configure o Supabase em config.js antes de iniciar sessão.',
    });
    return;
  }
  setAuthUiState('checking');
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      clearAdminState();
      showLogin();
      return;
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      if (isNetworkError(userError)) throw userError;
      await supabase.auth.signOut({ scope: 'local' });
      clearAdminState();
      showLogin('A sessão expirou. Inicie sessão novamente.');
      return;
    }
    await showApp({ ...sessionData.session, user: userData.user });
  } catch (error) {
    if (isNetworkError(error)) {
      setAuthUiState('error');
      return;
    }
    clearAdminState();
    showLogin('Não foi possível validar a sessão. Inicie sessão novamente.');
  }
}

function openMobileSidebar() {
  els.app.classList.add('is-mobile-sidebar-open');
}

function closeMobileSidebar() {
  els.app.classList.remove('is-mobile-sidebar-open');
}

function handleExpiredAdminSession(error) {
  if (error?.status !== 401) return false;
  pendingLoginNotice = 'A sua sessão expirou. Inicie sessão novamente.';
  supabase?.auth.signOut({ scope: 'local' });
  clearAdminState();
  showLogin(pendingLoginNotice);
  return true;
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) {
    els.loginMessage.textContent = 'Configure o ficheiro config.js antes de iniciar sessão.';
    return;
  }
  setInlineMessage(els.loginMessage, 'A verificar credenciais…');
  const email = els.loginForm.elements.email.value.trim();
  const password = els.loginForm.elements.password.value;
  rememberSession = els.loginForm.elements.remember.checked;
  if (rememberSession) localStorage.setItem(rememberPreferenceKey, '1');
  else localStorage.removeItem(rememberPreferenceKey);
  await withBusy(els.loginForm.querySelector('[type="submit"]'), 'A iniciar…', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setInlineMessage(
        els.loginMessage,
        isNetworkError(error) ? 'Sem ligação ao serviço. Verifique a internet e tente novamente.' : 'Email ou palavra-passe inválidos.',
        'error',
      );
      return;
    }
    setInlineMessage(els.loginMessage);
    await showApp(data.session);
  });
});

async function logoutCurrentSession(button = els.logout) {
  if (settingsHaveUnsavedChanges() && !await confirmDiscardSettings()) return;
  await withBusy(button, 'A sair…', async () => {
    const { error } = await supabase?.auth.signOut({ scope: 'local' }) || {};
    if (error && isNetworkError(error)) {
      toast('Não foi possível terminar a sessão. Tente novamente.', 'error');
      return;
    }
    clearAdminState();
    history.replaceState(null, '', location.pathname);
    showLogin('Sessão terminada com segurança.');
  });
}

els.logout?.addEventListener('click', () => logoutCurrentSession(els.logout));
els.settingsLogout?.addEventListener('click', () => logoutCurrentSession(els.settingsLogout));
els.authRetry?.addEventListener('click', verifyAuthentication);
els.passwordToggles.forEach((button) => button.addEventListener('click', () => togglePasswordVisibility(button)));
els.loginForm.elements.remember.checked = rememberSession;

els.forgotPassword?.addEventListener('click', async () => {
  const email = els.loginForm.elements.email.value.trim();
  if (!email) {
    setInlineMessage(els.loginMessage, 'Introduza primeiro o email da conta.', 'error');
    els.loginForm.elements.email.focus();
    return;
  }
  await withBusy(els.forgotPassword, 'A enviar…', async () => {
    const redirectTo = new URL('admin.html?recovery=1', location.href).href;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setInlineMessage(
        els.loginMessage,
        isNetworkError(error) ? 'Sem ligação ao serviço. Tente novamente.' : 'Não foi possível enviar o email de recuperação.',
        'error',
      );
      return;
    }
    setInlineMessage(els.loginMessage, 'Enviámos um link de recuperação. Verifique também a pasta de spam.', 'success');
  });
});

els.profileForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fullName = els.profileForm.elements.fullName.value.trim();
  const bio = els.profileForm.elements.bio.value.trim();
  if (fullName.length < 2) return setInlineMessage(els.profileMessage, 'Indique um nome válido.', 'error');
  if (bio.length > 280) return setInlineMessage(els.profileMessage, 'O texto Sobre não pode exceder 280 caracteres.', 'error');
  await withBusy(els.saveProfile, 'A guardar…', async () => {
    const previousAvatarPath = adminProfile?.avatar_path || session.user.user_metadata?.avatar_path || null;
    let uploadedPath = '';
    try {
      let nextAvatarPath = removeAvatarRequested ? null : previousAvatarPath;
      if (pendingAvatarBlob) {
        uploadedPath = `avatars/${session.user.id}/${crypto.randomUUID()}.webp`;
        if (els.avatarProgress) {
          els.avatarProgress.hidden = false;
          els.avatarProgress.style.setProperty('--avatar-progress', '68%');
          els.avatarProgress.querySelector('span').textContent = 'A enviar fotografia…';
        }
        const { error: uploadError } = await supabase.storage.from('admin-avatars').upload(uploadedPath, pendingAvatarBlob, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false,
        });
        if (uploadError) throw uploadError;
        nextAvatarPath = uploadedPath;
      }
      await persistAdminProfile({ full_name: fullName, bio, avatar_path: nextAvatarPath });
      const nextMetadata = { ...session.user.user_metadata, display_name: fullName };
      if (nextAvatarPath) nextMetadata.avatar_path = nextAvatarPath;
      else delete nextMetadata.avatar_path;
      const { data, error: metadataError } = await supabase.auth.updateUser({ data: nextMetadata });
      if (metadataError) throw metadataError;
      session = { ...session, user: data.user };
      if (previousAvatarPath && previousAvatarPath !== nextAvatarPath) {
        await removeStoredAvatar(previousAvatarPath).catch(() => {});
      }
      pendingAvatarBlob = null;
      removeAvatarRequested = false;
      revokePendingAvatarPreview();
      if (els.avatarProgress) els.avatarProgress.hidden = true;
      await refreshProfileUI({ refreshAvatar: true });
      els.profileForm.elements.fullName.value = adminProfile.full_name;
      els.profileForm.elements.roleLabel.value = adminProfile.role_label;
      els.profileForm.elements.bio.value = adminProfile.bio;
      if (els.bioCount) els.bioCount.textContent = String(adminProfile.bio.length);
      markSettingsFormSaved(els.profileForm);
      setInlineMessage(els.profileMessage, 'Perfil atualizado.', 'success');
      toast(uploadedPath ? 'Fotografia de perfil atualizada.' : 'Perfil atualizado.');
    } catch (error) {
      if (uploadedPath) await supabase.storage.from('admin-avatars').remove([uploadedPath]).catch(() => {});
      if (els.avatarProgress) els.avatarProgress.hidden = true;
      setInlineMessage(els.profileMessage, friendlyError(error, error.message || 'Não foi possível guardar o perfil.'), 'error');
    }
  });
});

els.selectAvatar?.addEventListener('click', () => els.avatarUpload.click());
els.avatarUpload?.addEventListener('change', async () => {
  const [file] = els.avatarUpload.files;
  els.avatarUpload.value = '';
  if (!file || !session?.user) return;
  await withBusy(els.selectAvatar, 'A preparar…', async () => {
    if (els.avatarProgress) {
      els.avatarProgress.hidden = false;
      els.avatarProgress.style.setProperty('--avatar-progress', '28%');
      els.avatarProgress.querySelector('span').textContent = 'A validar fotografia…';
    }
    try {
      const blob = await optimizeAvatar(file);
      revokePendingAvatarPreview();
      pendingAvatarBlob = blob;
      removeAvatarRequested = false;
      pendingAvatarPreviewUrl = URL.createObjectURL(blob);
      setSettingsAvatarPreview(pendingAvatarPreviewUrl);
      if (els.avatarProgress) {
        els.avatarProgress.style.setProperty('--avatar-progress', '100%');
        els.avatarProgress.querySelector('span').textContent = 'Pré-visualização pronta para guardar.';
      }
      updateSettingsSaveState(els.profileForm);
      setInlineMessage(els.profileMessage, 'Pré-visualização pronta. Guarde as alterações.', 'success');
    } catch (error) {
      if (els.avatarProgress) els.avatarProgress.hidden = true;
      setInlineMessage(els.profileMessage, error.message || 'Não foi possível preparar a fotografia.', 'error');
    }
  });
});

els.removeAvatar?.addEventListener('click', async () => {
  if (!adminProfile?.avatar_path && !pendingAvatarBlob && !session?.user?.user_metadata?.avatar_path) return;
  const confirmed = await askConfirm('Remover fotografia?', 'A fotografia será removida depois de guardar o perfil.', { confirmLabel: 'Remover fotografia' });
  if (!confirmed) return;
  pendingAvatarBlob = null;
  revokePendingAvatarPreview();
  removeAvatarRequested = true;
  setSettingsAvatarPreview('');
  if (els.avatarProgress) els.avatarProgress.hidden = true;
  updateSettingsSaveState(els.profileForm);
  setInlineMessage(els.profileMessage, 'A fotografia será removida ao guardar.', 'success');
});

els.contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const phone = formatInternationalPhone(els.contactForm.elements.phone.value);
  els.contactForm.elements.phone.value = phone;
  await withBusy(els.saveContact, 'A guardar…', async () => {
    try {
      await persistAdminProfile({
        phone,
        timezone: els.contactForm.elements.timezone.value,
        locale: els.contactForm.elements.locale.value,
      });
      markSettingsFormSaved(els.contactForm);
      setInlineMessage(els.contactMessage, 'Informações de contacto atualizadas.', 'success');
      toast('Informações de contacto atualizadas.');
    } catch (error) {
      setInlineMessage(els.contactMessage, friendlyError(error, error.message || 'Não foi possível guardar as informações.'), 'error');
    }
  });
});

els.emailForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const newEmail = els.emailForm.elements.newEmail.value.trim().toLowerCase();
  if (!newEmail || !els.emailForm.elements.newEmail.checkValidity()) {
    setInlineMessage(els.emailMessage, 'Indique um novo email válido.', 'error');
    return;
  }
  if (newEmail === String(session.user.email || '').toLowerCase()) {
    setInlineMessage(els.emailMessage, 'O novo email deve ser diferente do atual.', 'error');
    return;
  }
  await withBusy(els.changeEmail, 'A enviar…', async () => {
    const redirectTo = new URL('admin.html', location.href).href.split('#')[0];
    const { data, error } = await supabase.auth.updateUser({ email: newEmail }, { emailRedirectTo: redirectTo });
    if (error) {
      setInlineMessage(els.emailMessage, friendlyError(error, 'Não foi possível iniciar a alteração do email.'), 'error');
      return;
    }
    session = { ...session, user: data.user };
    populateEmailAccountFields();
    markSettingsFormSaved(els.emailForm);
    setInlineMessage(els.emailMessage, 'Confirmação enviada para o novo email.', 'success');
    toast('Confirmação enviada para o novo email.');
  });
});

els.preferencesForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = els.preferencesForm.elements;
  const expiry = form.expiryPreset.value === 'none'
    ? null
    : form.expiryPreset.value === 'custom'
      ? Number(form.customExpiryDays.value)
      : Number(form.expiryPreset.value);
  if (expiry !== null && (!Number.isInteger(expiry) || expiry < 1 || expiry > 365)) {
    setInlineMessage(els.preferencesMessage, 'A duração deve estar entre 1 e 365 dias.', 'error');
    return;
  }
  await withBusy(els.savePreferences, 'A guardar…', async () => {
    try {
      await persistUserPreferences({
        date_format: form.dateFormat.value,
        default_gallery_expiry_days: expiry,
        default_downloads_enabled: form.downloadsEnabled.checked,
        default_watermark_enabled: form.watermarkEnabled.checked,
        default_sales_enabled: form.salesEnabled.checked,
        default_currency: form.currency.value,
      });
      markSettingsFormSaved(els.preferencesForm);
      setInlineMessage(els.preferencesMessage, 'Preferências guardadas.', 'success');
      toast('Preferências guardadas.');
    } catch (error) {
      setInlineMessage(els.preferencesMessage, friendlyError(error, error.message || 'Não foi possível guardar as preferências.'), 'error');
    }
  });
});

els.passwordForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const currentPassword = els.passwordForm.elements.currentPassword.value;
  const newPassword = els.passwordForm.elements.newPassword.value;
  const confirmation = els.passwordForm.elements.confirmPassword.value;
  if (!passwordIsStrong(newPassword)) {
    setInlineMessage(els.passwordMessage, 'A nova palavra-passe não cumpre os requisitos de segurança.', 'error');
    return;
  }
  if (newPassword !== confirmation) {
    setInlineMessage(els.passwordMessage, 'As novas palavras-passe não coincidem.', 'error');
    return;
  }
  if (!recoveryMode && currentPassword === newPassword) {
    setInlineMessage(els.passwordMessage, 'Escolha uma palavra-passe diferente da atual.', 'error');
    return;
  }
  await withBusy(els.changePassword, 'A atualizar…', async () => {
    if (!recoveryMode) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setInlineMessage(els.passwordMessage, 'A palavra-passe atual está incorreta.', 'error');
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setInlineMessage(els.passwordMessage, 'Não foi possível atualizar a palavra-passe.', 'error');
      return;
    }
    els.passwordForm.reset();
    pendingLoginNotice = 'Palavra-passe atualizada. Inicie sessão novamente.';
    await supabase.auth.signOut({ scope: 'global' });
    clearAdminState();
    history.replaceState(null, '', location.pathname);
    showLogin(pendingLoginNotice);
  });
});

els.signoutOthers?.addEventListener('click', async () => {
  const confirmed = await askConfirm(
    'Terminar outras sessões?',
    'As outras sessões deixarão de ter acesso à administração. Esta sessão continuará ativa.',
    { confirmLabel: 'Terminar sessões' },
  );
  if (!confirmed) return;
  await withBusy(els.signoutOthers, 'A terminar…', async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) {
      setInlineMessage(els.sessionMessage, 'Não foi possível terminar as outras sessões.', 'error');
      return;
    }
    setInlineMessage(els.sessionMessage, 'As outras sessões foram terminadas.', 'success');
    toast('Outras sessões terminadas.');
  });
});

els.signoutAll?.addEventListener('click', async () => {
  if (settingsHaveUnsavedChanges() && !await confirmDiscardSettings()) return;
  const confirmed = await askConfirm(
    'Terminar todas as sessões?',
    'Todos os dispositivos, incluindo este, terão de iniciar sessão novamente.',
    { confirmLabel: 'Terminar todas' },
  );
  if (!confirmed) return;
  await withBusy(els.signoutAll, 'A terminar…', async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      setInlineMessage(els.sessionMessage, 'Não foi possível terminar todas as sessões.', 'error');
      return;
    }
    clearAdminState();
    history.replaceState(null, '', location.pathname);
    showLogin('Todas as sessões foram terminadas.');
  });
});

els.settingsForms.forEach((form) => {
  const update = () => {
    updateSettingsSaveState(form);
    if (form === els.profileForm && els.bioCount) {
      els.bioCount.textContent = String(form.elements.bio.value.length);
    }
    if (form === els.passwordForm) updatePasswordStrength();
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
});

els.preferencesForm?.elements.expiryPreset.addEventListener('change', () => {
  const custom = els.preferencesForm.elements.expiryPreset.value === 'custom';
  els.customExpiry.hidden = !custom;
  els.preferencesForm.elements.customExpiryDays.disabled = !custom;
  if (custom) els.preferencesForm.elements.customExpiryDays.focus({ preventScroll: true });
  updateSettingsSaveState(els.preferencesForm);
});

els.storageRefresh?.addEventListener('click', () => withBusy(els.storageRefresh, 'A calcular…', loadAlbums));

if (els.supportLink && config.ADMIN_EMAIL) {
  els.supportLink.href = `mailto:${String(config.ADMIN_EMAIL).trim()}?subject=${encodeURIComponent('Apoio — painel Fotografia Arnaut')}`;
}

els.settingsNav.forEach((button, index) => {
  button.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let target = index;
    if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = els.settingsNav.length - 1;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % els.settingsNav.length;
    else target = (index - 1 + els.settingsNav.length) % els.settingsNav.length;
    els.settingsNav[target].focus();
  });
});

els.nav.forEach((button) => button.addEventListener('click', () => requestView(button.dataset.view)));
els.portfolioAdd?.addEventListener('click', openPortfolioAddDialog);
els.portfolioAddClose?.addEventListener('click', () => els.portfolioAddDialog.close());
els.portfolioAddCancel?.addEventListener('click', () => els.portfolioAddDialog.close());
els.portfolioSourceTabs.forEach((button) => button.addEventListener('click', () => setPortfolioSource(button.dataset.portfolioSource)));
els.portfolioSelectFiles?.addEventListener('click', () => els.portfolioFileInput.click());
els.portfolioFileInput?.addEventListener('change', async () => { await addPortfolioFiles(els.portfolioFileInput.files); els.portfolioFileInput.value = ''; });
els.portfolioGallerySelect?.addEventListener('change', () => loadPortfolioGalleryPhotos(els.portfolioGallerySelect.value));
els.portfolioAddPublished?.addEventListener('change', updatePortfolioAddButton);
els.portfolioAddSubmit?.addEventListener('click', () => submitPortfolioAdd().catch((error) => { els.portfolioAddMessage.textContent = friendlyError(error); toast('Não foi possível adicionar as fotografias.', 'error'); updatePortfolioAddButton(); }));
els.portfolioSearch?.addEventListener('input', debounce(() => { portfolioSearch = els.portfolioSearch.value; renderPortfolio(); }, 180));
els.portfolioState?.addEventListener('change', () => { portfolioState = els.portfolioState.value; renderPortfolio(); });
els.portfolioFeatured?.addEventListener('change', () => { portfolioFeatured = els.portfolioFeatured.value; renderPortfolio(); });
els.portfolioLimit?.addEventListener('change', async () => {
  try { await callAdminPortfolio('setting', { maxRecent: Number(els.portfolioLimit.value) }); toast('Limite de Trabalho recente atualizado.'); }
  catch (error) { toast('Não foi possível guardar o limite.', 'error'); }
});
els.portfolioEditClose?.addEventListener('click', () => els.portfolioEditDialog.close());
els.portfolioEditCancel?.addEventListener('click', () => els.portfolioEditDialog.close());
els.portfolioFocal?.addEventListener('click', (event) => {
  const rect = els.portfolioFocal.getBoundingClientRect();
  els.portfolioFocalX.value = String(clampFocalPoint(((event.clientX - rect.left) / rect.width) * 100));
  els.portfolioFocalY.value = String(clampFocalPoint(((event.clientY - rect.top) / rect.height) * 100)); updatePortfolioFocalMarker();
});
els.portfolioEditSave?.addEventListener('click', async () => {
  if (!portfolioEditingPhoto) return;
  els.portfolioEditSave.disabled = true; els.portfolioEditMessage.textContent = '';
  try {
    await callAdminPortfolio('save', { photo: { id: portfolioEditingPhoto.id, categoryId: els.portfolioEditCategory.value, internalTitle: els.portfolioEditTitle.value.trim(), altText: els.portfolioEditAlt.value.trim(), focalX: els.portfolioFocalX.value, focalY: els.portfolioFocalY.value, isPublished: els.portfolioEditPublished.checked, isFeatured: els.portfolioEditFeatured.checked } });
    els.portfolioEditDialog.close(); toast('Alterações guardadas.'); await loadPortfolio({ force: true });
  } catch (error) { els.portfolioEditMessage.textContent = friendlyError(error); }
  finally { els.portfolioEditSave.disabled = false; }
});
els.portfolioReplaceInput?.addEventListener('change', async () => {
  const file = els.portfolioReplaceInput.files?.[0]; els.portfolioReplaceInput.value = '';
  if (!file || !portfolioReplacingPhoto) return;
  try { await replacePortfolioPhoto(file); } catch (error) { toast('Não foi possível substituir a fotografia.', 'error'); }
  finally { portfolioReplacingPhoto = null; }
});
els.portfolioAddDialog?.addEventListener('close', resetPortfolioAddDialog);
document.addEventListener('click', (event) => { if (!els.portfolioMenu.hidden && !els.portfolioMenu.contains(event.target) && !event.target.closest('.portfolio-card__menu')) closePortfolioMenu(); });
els.settingsNav.forEach((button) => button.addEventListener('click', () => requestSettingsSection(button.dataset.settingsSection)));
$$('[data-new-gallery]').forEach((button) => button.addEventListener('click', async () => {
  if (activeView === 'settings' && !await confirmDiscardSettings()) return;
  openDrawer();
}));
$('[data-filter-expiring]').addEventListener('click', () => {
  filters.status = 'expiring';
  els.statusFilter.value = 'expiring';
  setView('galleries');
});
$('[data-quick-upload]').addEventListener('click', () => {
  openUploadPicker();
});
els.accessManager?.addEventListener('click', openAccessManager);
els.closeUploadPicker?.addEventListener('click', () => els.uploadPickerModal.close());
els.uploadPickerModal?.addEventListener('click', (event) => {
  if (event.target === els.uploadPickerModal) els.uploadPickerModal.close();
});
els.uploadPickerSearch?.addEventListener('input', debounce(() => {
  uploadPickerFilters.search = els.uploadPickerSearch.value;
  renderUploadPicker();
}));
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
els.closeAccessModal?.forEach((button) => button.addEventListener('click', () => els.accessModal.close()));
els.accessModal?.addEventListener('click', (event) => {
  if (event.target === els.accessModal) els.accessModal.close();
});
els.accessSearch?.addEventListener('input', debounce(() => {
  accessFilters.search = els.accessSearch.value;
  renderAccessList();
}));
els.accessFilterButtons?.forEach((button) => {
  button.addEventListener('click', () => {
    accessFilters.status = button.dataset.accessFilter || 'active';
    renderAccessList();
  });
});
els.accessSort?.addEventListener('change', () => {
  accessFilters.sort = els.accessSort.value || 'recent';
  renderAccessList();
});
function closeProfilePopover() {
  if (!els.profilePopover) return;
  els.profilePopover.hidden = true;
  els.profileMenu?.setAttribute('aria-expanded', 'false');
  els.mobileProfileMenu?.setAttribute('aria-expanded', 'false');
}

function toggleProfilePopover(anchor) {
  if (!els.profilePopover || !anchor) return;
  const willOpen = els.profilePopover.hidden;
  closeProfilePopover();
  if (!willOpen) return;
  const rect = anchor.getBoundingClientRect();
  els.profilePopover.hidden = false;
  const width = 180;
  const left = Math.max(12, Math.min(innerWidth - width - 12, rect.right - width));
  const top = rect.bottom + 8 + els.profilePopover.offsetHeight <= innerHeight
    ? rect.bottom + 8
    : Math.max(12, rect.top - els.profilePopover.offsetHeight - 8);
  els.profilePopover.style.left = `${left}px`;
  els.profilePopover.style.top = `${top}px`;
  anchor.setAttribute('aria-expanded', 'true');
  els.profilePopover.querySelector('button')?.focus({ preventScroll: true });
}

els.profileMenu?.setAttribute('aria-expanded', 'false');
els.profileMenu?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleProfilePopover(els.profileMenu);
});
els.mobileProfileMenu?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleProfilePopover(els.mobileProfileMenu);
});
els.notificationsToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  const willOpen = els.notificationsPanel.hidden;
  els.notificationsPanel.hidden = !willOpen;
  els.notificationsToggle.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) els.notificationsPanel.querySelector('button:not([hidden])')?.focus({ preventScroll: true });
});
els.notificationsReadAll?.addEventListener('click', async () => {
  const unreadIds = adminNotifications.filter((item) => !item.is_read).map((item) => item.id);
  if (!unreadIds.length) return;
  const { error } = await supabase.from('admin_notifications').update({ is_read: true }).in('id', unreadIds);
  if (error) { toast('Não foi possível atualizar as notificações.', 'error'); return; }
  adminNotifications.forEach((item) => { item.is_read = true; });
  renderAdminNotifications();
});
els.globalSearchTrigger?.addEventListener('click', openGlobalSearch);
els.globalSearchClose?.addEventListener('click', closeGlobalSearch);
els.globalSearchInput?.addEventListener('input', renderGlobalSearchResults);
els.globalSearchDialog?.addEventListener('click', (event) => {
  if (event.target === els.globalSearchDialog) closeGlobalSearch();
});
els.globalSearchDialog?.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const results = $$('[data-search-kind]', els.globalSearchResults);
  if (!results.length) return;
  event.preventDefault();
  const active = results.indexOf(document.activeElement);
  const next = event.key === 'ArrowDown'
    ? (active + 1 + results.length) % results.length
    : (active - 1 + results.length) % results.length;
  results[next].focus();
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !els.app.hidden) {
    event.preventDefault();
    openGlobalSearch();
  }
});
els.profileEdit?.addEventListener('click', async () => {
  closeProfilePopover();
  await requestView('settings');
  await requestSettingsSection('profile');
});
els.profileLogout?.addEventListener('click', () => {
  closeProfilePopover();
  logoutCurrentSession(els.profileLogout);
});
document.addEventListener('click', (event) => {
  if (!els.profilePopover?.hidden && !els.profilePopover.contains(event.target)) closeProfilePopover();
  if (!els.notificationsPanel?.hidden && !els.notificationsPanel.contains(event.target) && !event.target.closest('[data-notifications-toggle]')) {
    els.notificationsPanel.hidden = true;
    els.notificationsToggle.setAttribute('aria-expanded', 'false');
  }
});
els.toggleSidebar.addEventListener('click', () => {
  if (matchMedia('(max-width: 820px)').matches) openMobileSidebar();
  else els.app.classList.toggle('is-sidebar-collapsed');
});
els.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
els.closeDrawer.addEventListener('click', requestCloseDrawer);
els.minimizeDrawer?.addEventListener('click', minimizeDrawer);
els.quickSaveDrawer?.addEventListener('click', quickSaveDrawer);
els.drawerBackdrop.addEventListener('click', minimizeDrawer);
els.restoreDrawer.addEventListener('click', restoreDrawer);
els.discardDrawer.addEventListener('click', discardDrawer);
els.drawerForm.addEventListener('input', markDrawerDirty);
els.drawerForm.addEventListener('change', markDrawerDirty);
els.drawerForm.addEventListener('change', () => {
  if (currentStep === 3) renderConfirmSummary();
});
requiredDetailFields().forEach((field) => {
  field.addEventListener('input', updateStepAvailability);
  field.addEventListener('change', updateStepAvailability);
});
fields.downloadsEnabled.addEventListener('change', updateDownloadOptions);
els.salesFreeDownload?.addEventListener('change', () => {
  fields.downloadsEnabled.checked = els.salesFreeDownload.checked;
  updateDownloadOptions();
  markDrawerDirty();
});
fields.salesEnabled.addEventListener('change', () => {
  updateSalesOptions();
  markDrawerDirty();
});
fields.title.addEventListener('input', updateRestoreCard);
els.publishChoices.forEach((button) => button.addEventListener('click', () => {
  fields.isActive.checked = button.dataset.publishChoice === 'active';
  updatePublishChoice();
  markDrawerDirty();
  if (currentStep === 3) renderConfirmSummary();
}));
els.noExpiration?.addEventListener('click', () => {
  const selected = !noExpirationSelected();
  if (selected) fields.expiresAt.value = '';
  setNoExpiration(selected);
  markDrawerDirty();
  if (currentStep === 3) renderConfirmSummary();
});
fields.expiresAt.addEventListener('input', () => {
  if (fields.expiresAt.value && noExpirationSelected()) setNoExpiration(false);
});
els.previewGallery?.addEventListener('click', () => {
  if (currentAlbum) window.open(albumUrl(currentAlbum), '_blank', 'noopener,noreferrer');
});
els.galleryActionsToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleGalleryActionsMenu();
});
els.galleryActionsMenu?.addEventListener('click', (event) => {
  if (event.target.closest('button')) closeGalleryActionsMenu();
});
els.actionShowCode.addEventListener('click', () => {
  setStep(3);
  revealCode();
});
els.actionCopyInstructions.addEventListener('click', async () => {
  if (!currentAlbum) return;
  if (!lastShownCode) await revealCode();
  if (!lastShownCode) return;
  await navigator.clipboard.writeText(guestInstructions(currentAlbum, lastShownCode));
  toast('Instruções copiadas.');
});
els.actionRegenerateCode.addEventListener('click', regenerateCode);
els.actionEndSessions.addEventListener('click', endSessions);
els.actionToggleState.addEventListener('click', () => setAlbumState(statusOf(currentAlbum || {}) === 'active' ? 'disabled' : 'active'));
els.actionDelete.addEventListener('click', deleteAlbum);
els.stepButtons.forEach((button) => button.addEventListener('click', () => setStep(Number(button.dataset.stepTarget))));
els.prevStep.addEventListener('click', () => setStep(currentStep - 1));
els.nextStep.addEventListener('click', () => setStep(currentStep + 1));
els.drawerForm.addEventListener('submit', saveGallery);
els.search.addEventListener('input', debounce(() => {
  filters.search = els.search.value;
  renderGalleries();
}));
els.statusFilter.addEventListener('change', () => { filters.status = els.statusFilter.value; renderGalleries(); });
els.typeFilter.addEventListener('change', () => { filters.type = els.typeFilter.value; renderGalleries(); });
els.sortFilter.addEventListener('change', () => { filters.sort = els.sortFilter.value; renderGalleries(); });
els.chartRange.addEventListener('change', renderChart);
els.layoutButtons.forEach((button) => button.addEventListener('click', () => {
  galleryLayout = button.dataset.galleryLayout;
  els.layoutButtons.forEach((item) => item.classList.toggle('is-active', item === button));
  renderGalleries();
}));
els.ordersRefresh?.addEventListener('click', loadOrders);
[els.orderGalleryFilter, els.orderStatusFilter, els.orderDateFrom, els.orderDateTo].forEach((element) => element?.addEventListener('change', loadOrders));
els.orderEmailFilter?.addEventListener('input', debounce(loadOrders));
els.closeOrderDialog?.addEventListener('click', () => els.orderDialog.close());
els.orderDialog?.addEventListener('click', (event) => { if (event.target === els.orderDialog) els.orderDialog.close(); });
els.billingRefresh?.addEventListener('click', () => loadBillingDashboard({ force: true }));
els.billingRetry?.addEventListener('click', () => loadBillingDashboard({ force: true }));
els.billingChartRange?.addEventListener('change', () => loadBillingDashboard({ force: true }));
els.billingViewAll?.addEventListener('click', () => { setBillingMode(true); billingListPage = 1; loadBillingList(); });
els.billingBack?.addEventListener('click', () => { setBillingMode(false); loadBillingDashboard(); });
els.billingExport?.forEach((button) => button.addEventListener('click', () => withBusy(button, 'A exportar…', exportBilling)));
els.billingEditProfile?.addEventListener('click', openBillingProfileDialog);
els.billingUpdateProfile?.addEventListener('click', openBillingProfileDialog);
els.billingManageStripe?.addEventListener('click', () => {
  showToast('A configuração privada da Stripe é gerida nas variáveis seguras do Supabase.');
});
els.billingProfileForm?.addEventListener('submit', saveBillingProfile);
els.closeBillingProfile?.forEach((button) => button.addEventListener('click', () => els.billingProfileDialog.close()));
els.billingProfileDialog?.addEventListener('click', (event) => { if (event.target === els.billingProfileDialog) els.billingProfileDialog.close(); });
els.closeBillingDetail?.addEventListener('click', () => els.billingDetailDialog.close());
els.billingDetailDialog?.addEventListener('click', (event) => { if (event.target === els.billingDetailDialog) els.billingDetailDialog.close(); });
els.billingSearch?.addEventListener('input', debounce(() => { billingFilters.search = els.billingSearch.value; billingListPage = 1; loadBillingList(); }, 250));
[els.billingStatusFilter, els.billingDateFrom, els.billingDateTo, els.billingSort].forEach((element) => element?.addEventListener('change', () => {
  billingFilters = {
    search: els.billingSearch.value,
    status: els.billingStatusFilter.value,
    dateFrom: els.billingDateFrom.value,
    dateTo: els.billingDateTo.value,
    sort: els.billingSort.value,
  };
  billingListPage = 1;
  loadBillingList();
}));
els.uploadInput.addEventListener('change', () => {
  addPendingFiles([...els.uploadInput.files]);
  els.uploadInput.value = '';
});
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
els.selectPhotos?.addEventListener('click', () => els.uploadInput.click());
els.dismissCodeModal?.addEventListener('click', () => els.codeModal.close());
els.codeModal.addEventListener('click', (event) => {
  const bounds = els.codeModal.getBoundingClientRect();
  const clickedOutside = event.clientX < bounds.left
    || event.clientX > bounds.right
    || event.clientY < bounds.top
    || event.clientY > bounds.bottom;
  if (clickedOutside) els.codeModal.close();
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
    if (els.notificationsPanel && !els.notificationsPanel.hidden) {
      els.notificationsPanel.hidden = true;
      els.notificationsToggle.setAttribute('aria-expanded', 'false');
      els.notificationsToggle.focus({ preventScroll: true });
      return;
    }
    if (els.galleryActionsMenu && !els.galleryActionsMenu.hidden) {
      closeGalleryActionsMenu();
      return;
    }
    closeMobileSidebar();
    if (els.drawer.classList.contains('is-open')) minimizeDrawer();
  }
});

document.addEventListener('click', async (event) => {
  if (
    els.galleryActionsMenu
    && !els.galleryActionsMenu.hidden
    && !els.galleryActionsMenu.contains(event.target)
    && !els.galleryActionsToggle?.contains(event.target)
  ) {
    closeGalleryActionsMenu();
  }
  const action = event.target.closest('[data-album-action]');
  if (!action) return;
  const album = albums.find((item) => item.id === action.dataset.albumId);
  if (!album) return;
  openDrawer(album, Number(action.dataset.step || 1));
});

window.addEventListener('resize', positionGalleryActionsMenu);
window.addEventListener('scroll', positionGalleryActionsMenu, true);
window.addEventListener('beforeunload', (event) => {
  if (!drawerDirty && !settingsHaveUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) verifyAuthentication();
});

if (!supabase) {
  setAuthUiState('error', {
    title: 'Configuração em falta',
    message: 'Configure config.js com SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.',
  });
} else {
  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === 'INITIAL_SESSION') return;
    setTimeout(async () => {
      if (event === 'SIGNED_OUT') {
        clearAdminState();
        if (els.login.hidden) showLogin(pendingLoginNotice);
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        recoveryMode = true;
        await showApp(nextSession);
        settingsSection = 'account';
        setView('settings');
        setInlineMessage(els.passwordMessage, 'Defina agora uma nova palavra-passe para recuperar a conta.', 'success');
        els.passwordForm.elements.newPassword.focus({ preventScroll: true });
        return;
      }
      if (nextSession && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        session = nextSession;
        if (event === 'USER_UPDATED') await refreshProfileUI({ refreshAvatar: true });
        else await showApp(nextSession);
      }
    }, 0);
  });
  await verifyAuthentication();
}
