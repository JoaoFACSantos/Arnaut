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
  assert.deepEqual(labels, ['Visão geral', 'Galerias', 'Encomendas', 'Nova galeria', 'Faturação', 'Definições']);
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

