/**
 * B5：DB 可用且查询成功时 **仅以 DB 为准**（删除/下架后不回退 JSON）；仅无连接或查询异常时回退 `productsData`。
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
      return null;
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
