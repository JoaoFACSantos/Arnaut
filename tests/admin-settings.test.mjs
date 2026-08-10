import assert from 'node:assert/strict';
import test from 'node:test';

import {
  avatarMimeFromBytes,
  formatInternationalPhone,
  galleryExpiryValue,
  normalizeAdminProfile,
  normalizeUserPreferences,
  passwordStrength,
  serializeForm,
  settingsSectionFromHash,
  validateAvatarFile,
} from '../admin-settings.js';

test('normaliza o perfil e limita a biografia', () => {
  const profile = normalizeAdminProfile({
    full_name: '  Beatriz Arnaut  ',
    role_label: '',
    bio: 'a'.repeat(300),
    locale: 'en-US',
  });
  assert.equal(profile.full_name, 'Beatriz Arnaut');
  assert.equal(profile.role_label, 'Administradora');
  assert.equal(profile.bio.length, 280);
  assert.equal(profile.locale, 'pt-PT');
});

test('normaliza preferências para os limites suportados', () => {
  const preferences = normalizeUserPreferences({
    default_gallery_expiry_days: 800,
    default_downloads_enabled: false,
    default_watermark_enabled: false,
    default_sales_enabled: true,
    default_currency: 'USD',
  });
  assert.equal(preferences.default_gallery_expiry_days, 365);
  assert.equal(preferences.default_downloads_enabled, false);
  assert.equal(preferences.default_watermark_enabled, false);
  assert.equal(preferences.default_sales_enabled, true);
  assert.equal(preferences.default_currency, 'EUR');
});

test('serializa apenas os campos editáveis relevantes', () => {
  const form = {
    elements: [
      { name: 'name', value: 'Beatriz', type: 'text', disabled: false },
      { name: 'active', checked: true, type: 'checkbox', disabled: false },
      { name: 'avatar', value: 'x', type: 'file', disabled: false },
      { name: 'readonly', value: 'x', type: 'text', disabled: true },
    ],
  };
  assert.equal(serializeForm(form), JSON.stringify({ name: 'Beatriz', active: true }));
});

test('avalia os requisitos mínimos da palavra-passe', () => {
  assert.equal(passwordStrength('curta').valid, false);
  assert.equal(passwordStrength('Segura12345').valid, true);
  assert.equal(passwordStrength('Muito-Segura-12345').label, 'Forte');
});

test('calcula expiração sem alterar galerias existentes', () => {
  const now = new Date('2026-08-04T10:00:00Z');
  assert.match(galleryExpiryValue(30, now), /^2026-09-03T23:59$/);
  assert.equal(galleryExpiryValue(null, now), '');
});

test('resolve apenas rotas conhecidas das definições', () => {
  assert.equal(settingsSectionFromHash('#definicoes/storage'), 'storage');
  assert.equal(settingsSectionFromHash('#definicoes/desconhecida'), 'profile');
  assert.equal(settingsSectionFromHash('#outra'), 'profile');
});

test('deteta formatos de imagem pelos bytes reais', () => {
  assert.equal(avatarMimeFromBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(avatarMimeFromBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(avatarMimeFromBytes(new TextEncoder().encode('RIFF0000WEBP')), 'image/webp');
  assert.equal(avatarMimeFromBytes(Uint8Array.from([0x00, 0x01])), '');
});

test('recusa avatar cujo MIME não corresponde aos bytes', async () => {
  const blob = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], { type: 'image/png' });
  await assert.rejects(() => validateAvatarFile(blob), /não corresponde/i);
});

test('aceita avatar válido e higieniza o telefone', async () => {
  const blob = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], { type: 'image/jpeg' });
  assert.equal(await validateAvatarFile(blob), 'image/jpeg');
  assert.equal(formatInternationalPhone(' +351 912 345 678<script> '), '+351 912 345 678');
});
