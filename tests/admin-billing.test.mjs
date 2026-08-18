import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildBillingSummary, netReceivedCents } from '../supabase/functions/_shared/billing.js';

test('keeps all financial calculations in integer cents and subtracts refunds', () => {
  assert.equal(netReceivedCents({ status: 'paid', total_cents: 1250, refunded_cents: 0 }), 1250);
  assert.equal(netReceivedCents({ status: 'partially_refunded', total_cents: 1250, refunded_cents: 250 }), 1000);
  assert.equal(netReceivedCents({ status: 'refunded', total_cents: 1250, refunded_cents: 1250 }), 0);
  assert.equal(netReceivedCents({ status: 'pending', total_cents: 1250, refunded_cents: 0 }), 0);
});

test('builds the billing dashboard only from real order states', () => {
  const summary = buildBillingSummary([
    { status: 'paid', total_cents: 10000, refunded_cents: 0, paid_at: '2026-08-03T12:00:00Z', created_at: '2026-08-03T11:00:00Z' },
    { status: 'partially_refunded', total_cents: 8000, refunded_cents: 2000, paid_at: '2026-08-04T12:00:00Z', created_at: '2026-08-04T11:00:00Z' },
    { status: 'refunded', total_cents: 4000, refunded_cents: 4000, paid_at: '2026-08-05T12:00:00Z', created_at: '2026-08-05T11:00:00Z' },
    { status: 'failed', total_cents: 9000, refunded_cents: 0, paid_at: null, created_at: '2026-08-06T11:00:00Z' },
    { status: 'pending', total_cents: 5000, refunded_cents: 0, paid_at: null, created_at: '2026-08-07T11:00:00Z' },
    { status: 'paid', total_cents: 5000, refunded_cents: 0, paid_at: '2026-07-03T12:00:00Z', created_at: '2026-07-03T11:00:00Z' },
  ], new Date('2026-08-10T10:00:00Z'), 3);

  assert.equal(summary.currentMonthCents, 16000);
  assert.equal(summary.previousMonthCents, 5000);
  assert.equal(summary.receivedCents, 21000);
  assert.equal(summary.receivedPayments, 3);
  assert.equal(summary.pendingCents, 5000);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.invoiceCount, 0);
  assert.equal(summary.invoicesConfigured, false);
  assert.deepEqual(summary.series.map((point) => point.month), ['2026-06', '2026-07', '2026-08']);
});

test('places Billing immediately above Settings in the main sidebar', async () => {
  const html = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
  const sidebar = html.match(/<nav class="admin-side__nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const labels = [...sidebar.matchAll(/<em>([^<]+)<\/em>/g)].map((match) => match[1]);
  assert.deepEqual(labels, ['Visão geral', 'Galerias', 'Encomendas', 'Nova galeria', 'Faturação', 'Portefólio', 'Definições']);
});

test('does not ship the sample billing identities from the visual mockup', async () => {
  const files = await Promise.all([
    readFile(new URL('../admin.html', import.meta.url), 'utf8'),
    readFile(new URL('../admin.js', import.meta.url), 'utf8'),
  ]);
  const source = files.join('\n');
  for (const sample of ['Maria Silva', 'João Rodrigues', 'Rua das Flores', '514 123 456', '4242']) {
    assert.equal(source.includes(sample), false, `mock value found: ${sample}`);
  }
});

test('uses the supplied SVG assets for every billing metric', async () => {
  const [source, css] = await Promise.all([
    readFile(new URL('../admin.js', import.meta.url), 'utf8'),
    readFile(new URL('../admin-billing.css', import.meta.url), 'utf8'),
  ]);
  for (const icon of ['icon_faturado.svg', 'icon_pagamentos_recebidos.svg', 'icon_faturas_emitidas.svg', 'icon_pagamentos_pendentes.svg']) {
    assert.equal(css.includes(icon), true, `missing billing icon: ${icon}`);
  }
  for (const oldIcon of ["billingMetric('€'", "billingMetric('✓'", "billingMetric('#'", "billingMetric('!'"]) {
    assert.equal(source.includes(oldIcon), false, `old decorative symbol found: ${oldIcon}`);
  }
});

test('centres every billing SVG in a fixed circular wrapper', async () => {
  const css = await readFile(new URL('../admin-billing.css', import.meta.url), 'utf8');
  const wrapper = css.match(/body\.admin-v2 \.admin-billing-metric__icon\s*\{([\s\S]*?)\}/)?.[1] || '';
  const glyph = css.match(/body\.admin-v2 \.admin-billing-metric__glyph\s*\{([\s\S]*?)\}/)?.[1] || '';

  assert.match(wrapper, /width:\s*44px/);
  assert.match(wrapper, /height:\s*44px/);
  assert.match(wrapper, /display:\s*flex/);
  assert.match(wrapper, /align-items:\s*center/);
  assert.match(wrapper, /justify-content:\s*center/);
  assert.match(wrapper, /line-height:\s*0/);
  assert.match(glyph, /width:\s*22px/);
  assert.match(glyph, /height:\s*22px/);
  assert.match(glyph, /mask:\s*var\(--billing-icon\) 50% 50% \/ 22px 22px no-repeat/);
  assert.match(glyph, /transform:\s*none/);
  assert.equal(css.includes('.admin-billing-metric span {'), false, 'generic span rule must not override the flex icon wrapper');
});

test('offers every requested photo-chart period without reloading the page', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('../admin.html', import.meta.url), 'utf8'),
    readFile(new URL('../admin.js', import.meta.url), 'utf8'),
  ]);
  for (const value of ['7d', '30d', '3m', '1y']) assert.match(html, new RegExp(`value="${value}"`));
  assert.match(source, /chartRange\.addEventListener\('change', renderChart\)/);
  assert.match(source, /face ao \$\{comparisonLabel\}/);
});
