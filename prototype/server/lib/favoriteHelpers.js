/** B6：与 `GET /api/product/:id` 路径参数同一白名单（develop2 §9.7） */
export const FAVORITE_PRODUCT_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;

/** @param {import('express').Request['query']} q */
export function parseFavoriteListPaging(q) {
  const limit = Math.min(50, Math.max(1, parseInt(String(q?.limit ?? '20'), 10) || 20));
  const offset = Math.max(0, parseInt(String(q?.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

/** @param {unknown} body */
export function pickFavoriteProductId(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  if (b.productId != null && String(b.productId).trim() !== '') return String(b.productId).trim();
  if (b.product_id != null && String(b.product_id).trim() !== '') return String(b.product_id).trim();
  return null;
}

/** @param {{ product_id: string; created_at: Date | string }} row */
export function rowToFavoriteListItem(row) {
  const c = row.created_at;
  const createdAt = c instanceof Date ? c.toISOString() : String(c);
  return { productId: row.product_id, createdAt };
}
