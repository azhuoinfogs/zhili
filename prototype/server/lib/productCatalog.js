/**
 * 推荐 / 热门 / 关联：在 MySQL 可用时以 **已上架** `product` 行为准，与后台删除/下架一致。
 */
import { getPool, query } from '../db.js';
import { rowToKernelProduct } from './productMapper.js';

const LISTED_ROWS_SQL = `SELECT product_id, name, price, sell_point, occasion_keyword,
                images, styles, occasions, interests, gender, age_bands, taboos_avoid, hot_rank, affiliate_url,
                COALESCE(listed, 1) AS listed
         FROM product WHERE COALESCE(listed, 1) = 1`;

/**
 * @param {unknown[]} productsDataFallback DB 不可用时使用（与历史行为一致）
 * @returns {Promise<unknown[]>}
 */
export async function getListedProductPool(productsDataFallback) {
  if (!getPool()) return productsDataFallback;
  try {
    const rows = await query(LISTED_ROWS_SQL, []);
    return rows.map((row) => rowToKernelProduct(row));
  } catch (e) {
    console.warn('[知礼] getListedProductPool DB 失败，回退 JSON:', e.message);
    return productsDataFallback;
  }
}
