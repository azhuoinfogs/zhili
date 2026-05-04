import { Router } from 'express';
import { getPool, query, getRedis } from '../db.js';
import { productsData } from '../productsData.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { resolveProductById } from '../lib/productResolve.js';
import { enrich, apiProfileToScoringProfile } from '../lib/recommendCore.js';
import { rowToApiProfile } from '../lib/profileSchema.js';
import {
  productDetailCacheKey,
  PRODUCT_DETAIL_CACHE_TTL_SEC,
  profileVariantKey,
} from '../lib/productDetailCache.js';

const router = Router();

const PRODUCT_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;

/** @param {import('express').Request['query']} q */
export function parseProfileFromQuery(q) {
  const raw = q?.profile;
  if (raw == null || String(raw).trim() === '') return null;
  try {
    const p = JSON.parse(String(raw));
    if (p && typeof p === 'object' && !Array.isArray(p)) return p;
  } catch {
    return null;
  }
  return null;
}

/**
 * 画像用于 `enrich` / `buildReasonLines`：**Query `profile` 优先**；否则 Bearer + 默认画像。
 * @returns {Promise<{ profile: Record<string, unknown> | null, cacheVariant: string }>}
 */
export async function resolveScoringProfileForProduct(req) {
  const fromQuery = parseProfileFromQuery(req.query);
  if (fromQuery) {
    return { profile: fromQuery, cacheVariant: `q:${profileVariantKey(fromQuery)}` };
  }
  if (req.userId && getPool()) {
    try {
      const rows = await query(
        `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
         FROM user_profile WHERE user_id = ? AND is_default = 1 ORDER BY id ASC LIMIT 1`,
        [req.userId]
      );
      if (rows.length) {
        const profile = apiProfileToScoringProfile(rowToApiProfile(rows[0]));
        return { profile, cacheVariant: `u:${req.userId}` };
      }
    } catch (e) {
      console.warn('[知礼] GET /api/product 取默认画像失败:', e.message);
    }
  }
  return { profile: null, cacheVariant: 'none' };
}

/** @param {Record<string, unknown>} kernel @param {Record<string, unknown> | null} profile */
export function buildProductDetail(kernel, profile) {
  const card = enrich(kernel, profile);
  return {
    ...card,
    occasions: kernel.occasions,
    styles: kernel.styles,
    interests: kernel.interests,
    gender: kernel.gender,
    ageBands: kernel.ageBands,
    taboosAvoid: kernel.taboosAvoid,
    hotRank: kernel.hotRank,
    occasionKeyword: kernel.occasionKeyword ?? null,
    affiliateUrl: kernel.affiliateUrl ?? null,
  };
}

router.get('/:id', optionalAuth, async (req, res) => {
  const id = req.params.id;
  if (!PRODUCT_ID_RE.test(id)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法商品 id' });
    return;
  }

  const { profile, cacheVariant } = await resolveScoringProfileForProduct(req);
  const redis = getRedis();
  const cacheKey = productDetailCacheKey(id, cacheVariant);

  if (redis) {
    try {
      const hit = await redis.get(cacheKey);
      if (hit) {
        res.type('json').send(hit);
        return;
      }
    } catch (e) {
      console.warn('[知礼] product detail Redis GET 跳过:', e.message);
    }
  }

  const resolved = await resolveProductById(id, productsData);
  if (!resolved) {
    res.status(404).json({ error: 'NOT_FOUND', message: '商品不存在' });
    return;
  }

  const body = buildProductDetail(resolved.product, profile);
  const json = JSON.stringify(body);

  if (redis) {
    try {
      await redis.setEx(cacheKey, PRODUCT_DETAIL_CACHE_TTL_SEC, json);
    } catch (e) {
      console.warn('[知礼] product detail Redis SET 跳过:', e.message);
    }
  }

  res.type('json').send(json);
});

export default router;
