/**
 * B3：推荐内核与 hot/personalized 共用逻辑（单一事实源，供 index 与需登录的 feed 复用）
 * 包含：热门列表、个性化推荐、相关商品推荐
 */
import { computeScore, buildReasonLines } from '../scoring.js';

/**
 * 计算两个商品的相似度分数
 * @param {Record<string, unknown>} a 基准商品
 * @param {Record<string, unknown>} b 对比商品
 */
export function overlapScore(a, b) {
  let s = 0;
  const oa = new Set(a.occasions || []);
  for (const o of b.occasions || []) {
    if (oa.has(o)) s += 3;
  }
  const ia = new Set(a.interests || []);
  for (const i of b.interests || []) {
    if (ia.has(i)) s += 2;
  }
  const sa = new Set(a.styles || []);
  for (const st of b.styles || []) {
    if (sa.has(st)) s += 2;
  }
  s += (300 - Math.min(b.hotRank ?? 300, 300)) * 0.01;
  return s;
}

export const BUDGET_RANGE = {
  lt100: [0, 100],
  '100-300': [100, 300],
  '300-500': [300, 500],
  '500-1000': [500, 1000],
  '1000+': [1000, 1e9],
};

export function priceInBudget(price, budgetKey) {
  if (!budgetKey) return true;
  const [lo, hi] = BUDGET_RANGE[budgetKey] || [0, 1e9];
  const p = Number(price) || 0;
  return p >= lo && p <= hi;
}

export function filterShelf(list, q) {
  const occasion = q.occasion || '';
  const budget = q.budget || '';
  const style = q.style || '';
  return list.filter((p) => {
    if (occasion) {
      const oc = p.occasions || [];
      if (!oc.includes(occasion) && !oc.includes('universal')) return false;
    }
    if (budget && !priceInBudget(p.price, budget)) return false;
    if (style) {
      const st = p.styles || [];
      if (!st.includes(style)) return false;
    }
    return true;
  });
}

export function sortHot(a, b) {
  return (a.hotRank ?? 999) - (b.hotRank ?? 999) || String(a.id).localeCompare(String(b.id));
}

/** Query 或 body 片段上的分页（与 index 原 `/api/hot` 一致） */
export function parsePaging(q) {
  const limit = Math.min(50, Math.max(1, parseInt(String(q?.limit ?? '20'), 10) || 20));
  const offset = Math.max(0, parseInt(String(q?.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

/** `POST /api/personalized` body 内 offset/limit */
export function parsePagingFromBody(body) {
  const limit = Math.min(50, Math.max(1, parseInt(String(body?.limit ?? 20), 10) || 20));
  const offset = Math.max(0, parseInt(String(body?.offset ?? 0), 10) || 0);
  return { limit, offset };
}

export function shelfFromQuery(q) {
  return { occasion: q?.occasion || '', budget: q?.budget || '', style: q?.style || '' };
}

/**
 * H5 / 埋点：`zhili_group` **A**→热门对照，**B**→个性化（与 prototype/client 一致）
 * @param {string | undefined} zhiliGroup
 * @returns {'hot' | 'personalized'}
 */
export function pickHotOrPersonalized(zhiliGroup) {
  const g = String(zhiliGroup ?? 'B').trim().toUpperCase();
  if (g === 'A') return 'hot';
  return 'personalized';
}

/**
 * 去掉 B2 API 画像上的元字段，得到与 `POST /api/personalized` 画像段一致的对象
 * @param {Record<string, unknown>} apiProfile `rowToApiProfile` 结果
 */
export function apiProfileToScoringProfile(apiProfile) {
  const {
    id: _id,
    name: _name,
    is_default: _d,
    created_at: _c,
    updated_at: _u,
    ...rest
  } = apiProfile;
  return rest;
}

/**
 * 组装与 `POST /api/personalized` 等价的 body（用于文档/客户端对齐；服务端可直接调 `runPersonalizedList`）
 */
export function buildPersonalizedPayload(apiProfile, shelf, offset, limit) {
  const profile = apiProfileToScoringProfile(apiProfile);
  return {
    ...profile,
    shelf: shelf && typeof shelf === 'object' ? shelf : {},
    offset,
    limit,
  };
}

export function productImages(p) {
  const base = p.image || `https://picsum.photos/seed/${encodeURIComponent(p.id)}/400/400`;
  if (Array.isArray(p.images) && p.images.length) return p.images.slice(0, 6).map(String);
  return [
    base,
    `https://picsum.photos/seed/${encodeURIComponent(p.id)}a/400/400`,
    `https://picsum.photos/seed/${encodeURIComponent(p.id)}b/400/400`,
  ];
}

export function enrich(p, profile) {
  const reasons = profile ? buildReasonLines(p, profile) : [{ icon: '🎁', text: p.sellPoint || '热门精选' }];
  const images = productImages(p);
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    image: images[0],
    images,
    sellPoint: p.sellPoint,
    reasons,
  };
}

/** @param {unknown[]} products */
export function runHotList(products, shelf, offset, limit) {
  let pool = filterShelf(products, shelf);
  if (!pool.length) pool = products;
  const sorted = [...pool].sort(sortHot);
  return sorted.slice(offset, offset + limit).map((p) => enrich(p, null));
}

/**
 * @param {unknown[]} products
 * @param {Record<string, unknown>} profile 画像段（无 shelf）
 */
export function runPersonalizedList(products, profile, shelf, offset, limit) {
  const shelfQ = shelf && typeof shelf === 'object' ? shelf : {};
  let pool = filterShelf(products, shelfQ);
  if (!pool.length) pool = products;

  let rows = pool
    .map((p) => ({
      item: { ...enrich(p, profile), score: computeScore(p, profile) },
      hotRank: p.hotRank ?? 999,
      id: p.id,
    }))
    .sort((a, b) => b.item.score - a.item.score || a.hotRank - b.hotRank);

  if (offset === 0 && rows.length < limit) {
    const used = new Set(rows.map((x) => x.id));
    const filler = [...products]
      .sort(sortHot)
      .filter((p) => !used.has(p.id))
      .slice(0, Math.max(0, limit - rows.length))
      .map((p) => ({
        item: { ...enrich(p, profile), score: computeScore(p, profile) },
        hotRank: p.hotRank ?? 999,
        id: p.id,
      }));
    rows = rows.concat(filler);
  }

  return rows.slice(offset, offset + limit).map((x) => x.item);
}

/**
 * B3.4：相关商品推荐（原 relatedCore.js 逻辑迁移至此）
 * @param {unknown[]} productsData 全量列表
 * @param {Record<string, unknown>} selfKernel 基准商品
 * @param {Record<string, unknown> | null} profile 画像
 */
export function runRelatedList(productsData, selfKernel, profile) {
  const id = selfKernel.id;
  return productsData
    .filter((p) => p.id !== id)
    .map((p) => ({ p, s: overlapScore(selfKernel, p) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => enrich(x.p, profile));
}
