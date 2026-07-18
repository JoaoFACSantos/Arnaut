export function startOfLocalDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dayDifference(value) {
  if (!value) return null;
  const target = startOfLocalDay(value);
  const today = startOfLocalDay();
  if (!target || !today) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function formatExpirationStatus(expiresAt) {
  const diff = dayDifference(expiresAt);
  if (diff === null) return 'Sem expiração';
  const abs = Math.abs(diff);
  const unit = abs === 1 ? 'dia' : 'dias';
  if (diff === 0) return 'expira hoje';
  if (diff > 0) return `expira em ${diff} ${diff === 1 ? 'dia' : 'dias'}`;
  return `expirou há ${abs} ${unit}`;
}
