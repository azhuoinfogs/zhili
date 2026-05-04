/**
 * B5.9：商品详情短缓存（Redis 可选；异常或无 Redis 则跳过）
 */
import crypto from 'crypto';

export const PRODUCT_DETAIL_CACHE_TTL_SEC = Number(process.env.PRODUCT_DETAIL_CACHE_TTL_SEC) || 180;

/**
 * @param {string} productId
 * @param {string} variantKey 由路由层生成，区分画像/用户
 */
export function productDetailCacheKey(productId, variantKey) {
  return `product:detail:v1:${productId}:${variantKey}`;
}

/** @param {Record<string, unknown> | null} profile */
export function profileVariantKey(profile) {
  if (!profile || typeof profile !== 'object') return 'none';
  const raw = JSON.stringify(profile);
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);
}

/**
 * B9 写商品后可 `KEYS product:detail:v1:{id}:*` + DEL（验证端可接受）
 * @param {import('redis').RedisClientType | null} redis
 * @param {string} productId
 */
export async function invalidateProductDetailById(redis, productId) {
  if (!redis) return;
  const pattern = `product:detail:v1:${productId}:*`;
  try {
    const keys = await redis.keys(pattern);
    if (keys && keys.length) await redis.del(keys);
  } catch (e) {
    console.warn('[知礼] product detail 缓存失效失败:', e.message);
  }
}
