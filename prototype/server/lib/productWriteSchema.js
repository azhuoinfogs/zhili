/**
 * B9：商品写 Body 校验与 DB 列归一（与 `seed.js` / `rowToKernelProduct` 对齐）
 */

import { rowToKernelProduct } from './productMapper.js';

export const ADMIN_PRODUCT_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;

const GENDER_API = new Set(['male', 'female', 'any', 'unknown']);

const MAX = {
  title: 255,
  sellPoint: 512,
  occasionKeyword: 128,
  affiliateUrl: 512,
  arr: 24,
  images: 6,
};

/** @param {unknown} g */
export function genderApiToDb(g) {
  const s = String(g || '').toLowerCase();
  if (!s || s === 'any' || s === 'unknown') return 'unknown';
  if (s === 'male' || s === 'female') return s;
  return 'unknown';
}

/** @param {unknown} val */
function stringArray(val, maxLen) {
  if (!Array.isArray(val)) return { ok: false, message: '须为数组' };
  if (val.length > maxLen) return { ok: false, message: `数组长度不得超过 ${maxLen}` };
  const out = [];
  for (const x of val) {
    if (typeof x !== 'string') return { ok: false, message: '数组项须为字符串' };
    if (x.length > 512) return { ok: false, message: '标签过长' };
    out.push(x);
  }
  return { ok: true, value: out };
}

/** @param {unknown} v */
function finitePrice(v) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return { ok: false, message: 'price 须为非负有限数' };
  if (n > 1e9) return { ok: false, message: 'price 超出上限' };
  return { ok: true, value: n };
}

/** @param {unknown} v */
function nonNegInt(v, field) {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 0 || String(n).includes('.')) {
    return { ok: false, message: `${field} 须为非负整数` };
  }
  return { ok: true, value: n };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, data: Record<string, unknown> } | { ok: false, error: string, message: string }}
 */
export function validateCreateProductBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'BAD_REQUEST', message: 'Body 须为 JSON 对象' };
  }
  const id = body.id != null ? String(body.id).trim() : body.productId != null ? String(body.productId).trim() : '';
  if (!id || !ADMIN_PRODUCT_ID_RE.test(id)) {
    return { ok: false, error: 'BAD_REQUEST', message: '缺少合法 id / productId（与 B5 白名单一致）' };
  }
  if (typeof body.title !== 'string' || !body.title.trim()) {
    return { ok: false, error: 'BAD_REQUEST', message: 'title 必填' };
  }
  const title = body.title.trim();
  if (title.length > MAX.title) return { ok: false, error: 'BAD_REQUEST', message: 'title 过长' };

  const pv = finitePrice(body.price);
  if (!pv.ok) return { ok: false, error: 'BAD_REQUEST', message: pv.message };

  const genderRaw = body.gender != null ? String(body.gender).toLowerCase() : 'any';
  if (!GENDER_API.has(genderRaw)) {
    return { ok: false, error: 'INVALID_ENUM', message: 'gender 须为 male / female / any / unknown' };
  }

  const sellPoint = typeof body.sellPoint === 'string' ? body.sellPoint : '';
  if (sellPoint.length > MAX.sellPoint) return { ok: false, error: 'BAD_REQUEST', message: 'sellPoint 过长' };
  const occasionKeyword =
    typeof body.occasionKeyword === 'string' ? body.occasionKeyword : body.occasion_keyword != null ? String(body.occasion_keyword) : '';
  if (occasionKeyword.length > MAX.occasionKeyword) {
    return { ok: false, error: 'BAD_REQUEST', message: 'occasionKeyword 过长' };
  }

  const img = body.images != null ? stringArray(body.images, MAX.images) : { ok: true, value: [] };
  if (!img.ok) return { ok: false, error: 'BAD_REQUEST', message: img.message };
  const st = body.styles != null ? stringArray(body.styles, MAX.arr) : { ok: true, value: [] };
  if (!st.ok) return { ok: false, error: 'BAD_REQUEST', message: st.message };
  const oc = body.occasions != null ? stringArray(body.occasions, MAX.arr) : { ok: true, value: [] };
  if (!oc.ok) return { ok: false, error: 'BAD_REQUEST', message: oc.message };
  const intr = body.interests != null ? stringArray(body.interests, MAX.arr) : { ok: true, value: [] };
  if (!intr.ok) return { ok: false, error: 'BAD_REQUEST', message: intr.message };
  const ab = body.ageBands != null ? stringArray(body.ageBands, MAX.arr) : { ok: true, value: [] };
  if (!ab.ok) return { ok: false, error: 'BAD_REQUEST', message: ab.message };
  const tab = body.taboosAvoid != null ? stringArray(body.taboosAvoid, MAX.arr) : { ok: true, value: [] };
  if (!tab.ok) return { ok: false, error: 'BAD_REQUEST', message: tab.message };

  let hotRank = 999;
  if (body.hotRank != null) {
    const hr = nonNegInt(body.hotRank, 'hotRank');
    if (!hr.ok) return { ok: false, error: 'BAD_REQUEST', message: hr.message };
    hotRank = hr.value > 1e6 ? 1e6 : hr.value;
  }

  let clickCount = 0;
  if (body.clickCount != null) {
    const cc = nonNegInt(body.clickCount, 'clickCount');
    if (!cc.ok) return { ok: false, error: 'BAD_REQUEST', message: cc.message };
    clickCount = cc.value;
  }

  let affiliateUrl = null;
  if (body.affiliateUrl != null && String(body.affiliateUrl).trim() !== '') {
    const u = String(body.affiliateUrl).trim();
    if (u.length > MAX.affiliateUrl) return { ok: false, error: 'BAD_REQUEST', message: 'affiliateUrl 过长' };
    affiliateUrl = u;
  }

  return {
    ok: true,
    data: {
      productId: id,
      name: title,
      price: pv.value,
      sellPoint,
      occasionKeyword,
      imagesJson: JSON.stringify(img.value),
      stylesJson: JSON.stringify(st.value),
      occasionsJson: JSON.stringify(oc.value),
      interestsJson: JSON.stringify(intr.value),
      genderDb: genderApiToDb(genderRaw),
      ageBandsJson: JSON.stringify(ab.value),
      taboosJson: JSON.stringify(tab.value),
      hotRank,
      clickCount,
      affiliateUrl,
    },
  };
}

/**
 * @param {Record<string, unknown>} row mysql 行
 * @param {unknown} body
 */
export function validateUpdateProductBody(row, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'BAD_REQUEST', message: 'Body 须为 JSON 对象' };
  }
  const base = rowToAdminProduct(row);
  /** @type {Record<string, unknown>} */
  const merged = { ...base };
  const keys = [
    'title',
    'price',
    'sellPoint',
    'occasionKeyword',
    'images',
    'styles',
    'occasions',
    'interests',
    'gender',
    'ageBands',
    'taboosAvoid',
    'hotRank',
    'affiliateUrl',
    'clickCount',
  ];
  let touched = false;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined) {
      merged[k] = body[k];
      touched = true;
    }
  }
  if (!touched) {
    return { ok: false, error: 'BAD_REQUEST', message: '无有效更新字段' };
  }

  if (typeof merged.title !== 'string' || !String(merged.title).trim()) {
    return { ok: false, error: 'BAD_REQUEST', message: 'title 不能为空' };
  }
  const title = String(merged.title).trim();
  if (title.length > MAX.title) return { ok: false, error: 'BAD_REQUEST', message: 'title 过长' };

  const pv = finitePrice(merged.price);
  if (!pv.ok) return { ok: false, error: 'BAD_REQUEST', message: pv.message };

  const genderRaw = String(merged.gender || 'any').toLowerCase();
  if (!GENDER_API.has(genderRaw)) {
    return { ok: false, error: 'INVALID_ENUM', message: 'gender 须为 male / female / any / unknown' };
  }

  const sellPoint = typeof merged.sellPoint === 'string' ? merged.sellPoint : '';
  if (sellPoint.length > MAX.sellPoint) return { ok: false, error: 'BAD_REQUEST', message: 'sellPoint 过长' };
  const occasionKeyword = typeof merged.occasionKeyword === 'string' ? merged.occasionKeyword : '';
  if (occasionKeyword.length > MAX.occasionKeyword) {
    return { ok: false, error: 'BAD_REQUEST', message: 'occasionKeyword 过长' };
  }

  const img = stringArray(merged.images, MAX.images);
  if (!img.ok) return { ok: false, error: 'BAD_REQUEST', message: img.message };
  const st = stringArray(merged.styles, MAX.arr);
  if (!st.ok) return { ok: false, error: 'BAD_REQUEST', message: st.message };
  const oc = stringArray(merged.occasions, MAX.arr);
  if (!oc.ok) return { ok: false, error: 'BAD_REQUEST', message: oc.message };
  const intr = stringArray(merged.interests, MAX.arr);
  if (!intr.ok) return { ok: false, error: 'BAD_REQUEST', message: intr.message };
  const ab = stringArray(merged.ageBands, MAX.arr);
  if (!ab.ok) return { ok: false, error: 'BAD_REQUEST', message: ab.message };
  const tab = stringArray(merged.taboosAvoid, MAX.arr);
  if (!tab.ok) return { ok: false, error: 'BAD_REQUEST', message: tab.message };

  const hr = nonNegInt(merged.hotRank, 'hotRank');
  if (!hr.ok) return { ok: false, error: 'BAD_REQUEST', message: hr.message };
  const hotRank = hr.value > 1e6 ? 1e6 : hr.value;

  const cc = nonNegInt(merged.clickCount, 'clickCount');
  if (!cc.ok) return { ok: false, error: 'BAD_REQUEST', message: cc.message };

  let affiliateUrl = null;
  if (merged.affiliateUrl != null && String(merged.affiliateUrl).trim() !== '') {
    const u = String(merged.affiliateUrl).trim();
    if (u.length > MAX.affiliateUrl) return { ok: false, error: 'BAD_REQUEST', message: 'affiliateUrl 过长' };
    affiliateUrl = u;
  }

  return {
    ok: true,
    data: {
      productId: String(row.product_id),
      name: title,
      price: pv.value,
      sellPoint,
      occasionKeyword,
      imagesJson: JSON.stringify(img.value),
      stylesJson: JSON.stringify(st.value),
      occasionsJson: JSON.stringify(oc.value),
      interestsJson: JSON.stringify(intr.value),
      genderDb: genderApiToDb(genderRaw),
      ageBandsJson: JSON.stringify(ab.value),
      taboosJson: JSON.stringify(tab.value),
      hotRank,
      clickCount: cc.value,
      affiliateUrl,
    },
  };
}

/**
 * @param {Record<string, unknown>} row
 */
export function rowToAdminProduct(row) {
  const k = rowToKernelProduct(row);
  return {
    productId: k.id,
    title: k.title,
    price: k.price,
    sellPoint: k.sellPoint,
    occasionKeyword: k.occasionKeyword,
    images: k.images,
    styles: k.styles,
    occasions: k.occasions,
    interests: k.interests,
    gender: k.gender,
    ageBands: k.ageBands,
    taboosAvoid: k.taboosAvoid,
    hotRank: k.hotRank,
    affiliateUrl: k.affiliateUrl,
    clickCount: Number(row.click_count) || 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}
