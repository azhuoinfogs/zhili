import { Router } from 'express';
import { getPool, query, getRedis } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { rowToApiProfile } from '../lib/profileSchema.js';
import { productsData } from '../productsData.js';
import {
  shelfFromQuery,
  pickHotOrPersonalized,
  apiProfileToScoringProfile,
  runHotList,
  runPersonalizedList,
} from '../lib/recommendCore.js';
import {
  recommendListCacheKey,
  RECOMMEND_CACHE_TTL_SEC,
} from '../lib/recommendCache.js';
import { getListedProductPool } from '../lib/productCatalog.js';

const router = Router();

/** develop1 / B4：`page`≥1，`size` 默认 20、最大 50 → `offset`/`limit` */
export function parsePageSize(q) {
  const page = Math.max(1, parseInt(String(q?.page ?? '1'), 10) || 1);
  const size = Math.min(50, Math.max(1, parseInt(String(q?.size ?? '20'), 10) || 20));
  const offset = (page - 1) * size;
  const limit = size;
  return { page, size, offset, limit };
}

function parseProfileIdQuery(q) {
  const raw = q?.profile_id ?? q?.profileId;
  if (raw == null || raw === '') return null;
  const id = parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

router.get('/', requireAuth, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const q = req.query || {};
  const { page, size, offset, limit } = parsePageSize(q);
  const shelf = shelfFromQuery(q);
  const group = q.zhili_group ?? q.group ?? 'B';
  const mode = pickHotOrPersonalized(group);
  const wantId = parseProfileIdQuery(q);

  try {
    let rows;
    if (wantId != null) {
      rows = await query(
        `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
         FROM user_profile WHERE id = ? AND user_id = ? LIMIT 1`,
        [wantId, req.userId]
      );
      if (!rows.length) {
        res.status(404).json({ error: 'NOT_FOUND', message: '画像不存在' });
        return;
      }
    } else {
      rows = await query(
        `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
         FROM user_profile WHERE user_id = ? AND is_default = 1 ORDER BY id ASC LIMIT 1`,
        [req.userId]
      );
      if (!rows.length) {
        res.status(404).json({ error: 'NO_DEFAULT_PROFILE', message: '请先创建画像并设为默认' });
        return;
      }
    }

    const profileRow = rows[0];
    const profileId = Number(profileRow.id);
    const cacheKey = recommendListCacheKey(req.userId, profileId, shelf, group);
    const redis = getRedis();

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const body = JSON.parse(cached);
          return res.json(body);
        }
      } catch (e) {
        console.warn('[知礼] recommend Redis GET 降级:', e.message);
      }
    }

    const productPool = await getListedProductPool(productsData);
    let list;
    if (mode === 'hot') {
      list = runHotList(productPool, shelf, offset, limit);
    } else {
      const api = rowToApiProfile(profileRow);
      const profile = apiProfileToScoringProfile(api);
      list = runPersonalizedList(productPool, profile, shelf, offset, limit);
    }

    const body = { list, page, size, mode };

    if (redis) {
      try {
        await redis.setEx(cacheKey, RECOMMEND_CACHE_TTL_SEC, JSON.stringify(body));
      } catch (e) {
        console.warn('[知礼] recommend Redis SET 跳过:', e.message);
      }
    }

    res.json(body);
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

export default router;
