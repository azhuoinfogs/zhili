/**
 * B5.5：`GET /api/related/:id` 与详情共用 `resolveProductById` 后的相似品排序（原 index.js 逻辑）
 */
import { enrich } from './recommendCore.js';

function overlapScore(a, b) {
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

/**
 * @param {unknown[]} productsData 全量列表
 * @param {Record<string, unknown>} selfKernel `resolveProductById` 结果中的 `product`
 * @param {Record<string, unknown> | null} profile 画像（与 `GET /api/related?profile=` 一致）
 */
export function relatedProductCards(productsData, selfKernel, profile) {
  const id = selfKernel.id;
  return productsData
    .filter((p) => p.id !== id)
    .map((p) => ({ p, s: overlapScore(selfKernel, p) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => enrich(x.p, profile));
}
