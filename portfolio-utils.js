export const PORTFOLIO_MAX_FILE_BYTES = 30 * 1024 * 1024;
export const PORTFOLIO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validatePortfolioFile(file) {
  if (!file || !PORTFOLIO_ALLOWED_TYPES.has(file.type)) return { valid: false, error: 'Use apenas JPEG, PNG ou WebP.' };
  if (file.size > PORTFOLIO_MAX_FILE_BYTES) return { valid: false, error: 'O ficheiro excede o limite de 30 MB.' };
  return { valid: true, error: '' };
}

export function portfolioMimeFromBytes(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return 'image/png';
  if (data.length >= 12 && String.fromCharCode(...data.slice(0, 4)) === 'RIFF' && String.fromCharCode(...data.slice(8, 12)) === 'WEBP') return 'image/webp';
  return '';
}

export async function validatePortfolioFileContent(file) {
  const basic = validatePortfolioFile(file);
  if (!basic.valid) return basic;
  const actualType = portfolioMimeFromBytes(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!actualType) return { valid: false, error: 'O ficheiro não contém uma imagem JPEG, PNG ou WebP válida.' };
  if (file.type && file.type !== actualType) return { valid: false, error: 'O conteúdo do ficheiro não corresponde ao formato indicado.' };
  return basic;
}

export function reorderPortfolioItems(items, sourceId, targetId) {
  const next = [...items];
  const from = next.findIndex((item) => item.id === sourceId);
  const to = next.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function publicPortfolioQuery(limit = 8) {
  const safe = Math.min(24, Math.max(1, Number(limit) || 8));
  return { published: true, order: 'sort_order', ascending: true, limit: safe };
}

export function clampFocalPoint(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}
