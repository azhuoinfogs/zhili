/**
 * B5：按 develop2 §9.6.3 — DB 优先，失败或未命中回退 `productsData`
 */
import { getPool, query } from '../db.js';
import { rowToKernelProduct } from './productMapper.js';

/**
 * @param {string} id
 * @param {unknown[]} productsData
 * @returns {Promise<{ product: Record<string, unknown>, source: 'db' | 'memory' } | null>}
 */
export async function resolveProductById(id, productsData) {
  const pool = getPool();
  if (pool) {
    try {
      const rows = await query(
        `SELECT product_id, name, price, sell_point, occasion_keyword,
                images, styles, occasions, interests, gender, age_bands, taboos_avoid, hot_rank, affiliate_url,
                COALESCE(listed, 1) AS listed
         FROM product WHERE product_id = ? AND COALESCE(listed, 1) = 1 LIMIT 1`,
        [id]
      );
      if (rows.length) {
        return { product: rowToKernelProduct(rows[0]), source: 'db' };
      }
    } catch (e) {
      console.warn('[知礼] resolveProductById DB 失败，回退 JSON:', e.message);
    }
  }
  const mem = productsData.find((p) => p.id === id);
  if (mem) {
    return { product: { ...mem }, source: 'memory' };
  }
  return null;
}
