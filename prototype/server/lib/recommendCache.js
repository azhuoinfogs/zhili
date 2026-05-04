/**
 * B4：推荐列表 Redis 缓存 key、TTL、按用户失效（develop2 §8.3、§9.5）
 */
import crypto from 'crypto';

export const RECOMMEND_CACHE_TTL_SEC = 600;

/** @param {Record<string, unknown>} shelf */
export function filterHash(shelf, zhiliGroup) {
  const occ = String(shelf?.occasion ?? '');
  const bud = String(shelf?.budget ?? '');
  const sty = String(shelf?.style ?? '');
  const grp = String(zhiliGroup ?? 'B').trim().toUpperCase() || 'B';
  const raw = `${occ}|${bud}|${sty}|${grp}`;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 12);
}

export function recommendListCacheKey(userId, profileId, shelf, zhiliGroup) {
  const h = filterHash(shelf, zhiliGroup);
  return `recommend:${userId}:${profileId}:${h}`;
}

/**
 * 删除某用户全部推荐缓存（画像变更后调用）
 * @param {import('redis').RedisClientType | null} redis
 * @param {string | number} userId
 */
export async function invalidateUserRecommendations(redis, userId) {
  if (!redis) return;
  const pattern = `recommend:${userId}:*`;
  try {
    const keys = await redis.keys(pattern);
    if (keys && keys.length) await redis.del(keys);
  } catch (e) {
    console.warn('[知礼] recommend 缓存失效失败:', e.message);
  }
}

/** 商品增删改后清空全部用户推荐列表缓存（避免仍含已删商品） */
export async function invalidateAllRecommendations(redis) {
  if (!redis) return;
  try {
    const keys = await redis.keys('recommend:*');
    if (keys && keys.length) await redis.del(keys);
  } catch (e) {
    console.warn('[知礼] recommend 全量缓存失效失败:', e.message);
  }
}
