const CONFIRMED_STATUSES = new Set(['paid', 'partially_refunded', 'refunded']);

export function netReceivedCents(order) {
  if (!CONFIRMED_STATUSES.has(String(order?.status || ''))) return 0;
  return Math.max(0, Number(order?.total_cents || 0) - Number(order?.refunded_cents || 0));
}

export function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function startOfUtcMonth(value, monthOffset = 0) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1));
}

export function buildBillingSummary(orders, nowValue = new Date(), months = 6) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const safeMonths = Math.min(12, Math.max(1, Number(months || 6)));
  const currentStart = startOfUtcMonth(now);
  const nextStart = startOfUtcMonth(now, 1);
  const previousStart = startOfUtcMonth(now, -1);
  const rangeStart = startOfUtcMonth(now, -(safeMonths - 1));
  const series = [];
  const seriesByMonth = new Map();

  for (let index = 0; index < safeMonths; index += 1) {
    const date = startOfUtcMonth(rangeStart, index);
    const item = { month: monthKey(date), totalCents: 0, payments: 0 };
    series.push(item);
    seriesByMonth.set(item.month, item);
  }

  let currentMonthCents = 0;
  let previousMonthCents = 0;
  let receivedCents = 0;
  let receivedPayments = 0;
  let pendingCents = 0;
  let pendingCount = 0;

  for (const order of orders || []) {
    const totalCents = Math.max(0, Number(order?.total_cents || 0));
    const createdAt = new Date(order?.created_at || 0);
    if (String(order?.status || '') === 'pending') {
      pendingCents += totalCents;
      pendingCount += 1;
    }

    const paidAt = new Date(order?.paid_at || 0);
    if (Number.isNaN(paidAt.getTime())) continue;
    const netCents = netReceivedCents(order);
    if (paidAt >= currentStart && paidAt < nextStart) currentMonthCents += netCents;
    if (paidAt >= previousStart && paidAt < currentStart) previousMonthCents += netCents;
    if (paidAt >= rangeStart && paidAt < nextStart) {
      receivedCents += netCents;
      if (netCents > 0) receivedPayments += 1;
      const point = seriesByMonth.get(monthKey(paidAt));
      if (point) {
        point.totalCents += netCents;
        if (netCents > 0) point.payments += 1;
      }
    }
  }

  const comparisonPercent = previousMonthCents > 0
    ? Math.round(((currentMonthCents - previousMonthCents) / previousMonthCents) * 1000) / 10
    : null;

  return {
    currentMonthCents,
    previousMonthCents,
    comparisonPercent,
    receivedCents,
    receivedPayments,
    invoiceCount: 0,
    invoicesConfigured: false,
    pendingCents,
    pendingCount,
    series,
  };
}

