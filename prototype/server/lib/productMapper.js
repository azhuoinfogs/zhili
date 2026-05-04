/**
 * B5：`product` 表行 → 与 `products.json` / `productsData` 单项同构的内核对象（供 `enrich` / `computeScore`）
 */

/** @param {unknown} val */
function parseStringArray(val) {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const j = JSON.parse(val);
      return Array.isArray(j) ? j.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** DB `gender` 存 `unknown` 表示 JSON 里的 `any`，与 `scoring.genderSub` 对齐 */
function kernelGender(dbGender) {
  const g = String(dbGender || '').toLowerCase();
  if (g === 'unknown' || g === '') return 'any';
  return g;
}

/**
 * @param {Record<string, unknown>} row mysql2 行
 * @returns {Record<string, unknown>}
 */
function rowListed(row) {
  if (row.listed === undefined || row.listed === null) return true;
  const n = Number(row.listed);
  if (Number.isFinite(n)) return n !== 0;
  return String(row.listed) !== '0';
}

export function rowToKernelProduct(row) {
  const price = Number(row.price);
  return {
    id: String(row.product_id),
    title: String(row.name ?? ''),
    price: Number.isFinite(price) ? price : 0,
    sellPoint: row.sell_point != null ? String(row.sell_point) : '',
    occasionKeyword: row.occasion_keyword != null ? String(row.occasion_keyword) : '',
    images: parseStringArray(row.images),
    styles: parseStringArray(row.styles),
    occasions: parseStringArray(row.occasions),
    interests: parseStringArray(row.interests),
    gender: kernelGender(row.gender),
    ageBands: parseStringArray(row.age_bands),
    taboosAvoid: parseStringArray(row.taboos_avoid),
    hotRank: Number(row.hot_rank) || 999,
    affiliateUrl:
      row.affiliate_url != null && String(row.affiliate_url).trim() !== ''
        ? String(row.affiliate_url)
        : null,
    listed: rowListed(row),
  };
}
