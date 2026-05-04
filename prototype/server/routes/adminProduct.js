import { Router } from 'express';
import { getPool, query, execute, getRedis } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { invalidateProductDetailById } from '../lib/productDetailCache.js';
import {
  ADMIN_PRODUCT_ID_RE,
  validateCreateProductBody,
  validateUpdateProductBody,
  rowToAdminProduct,
} from '../lib/productWriteSchema.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

function parsePaging(q) {
  const limit = Math.min(50, Math.max(1, parseInt(String(q?.limit ?? '20'), 10) || 20));
  const offset = Math.max(0, parseInt(String(q?.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

function isDupKeyError(e) {
  return e && (e.code === 'ER_DUP_ENTRY' || Number(e.errno) === 1062);
}

router.get('/', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const { limit, offset } = parsePaging(req.query);
  const lim = Math.trunc(limit);
  const off = Math.trunc(offset);
  try {
    const countRows = await query('SELECT COUNT(*) AS c FROM product');
    const total = Number(countRows[0]?.c ?? 0);
    const rows = await query(
      `SELECT product_id, name, price, sell_point, occasion_keyword, images, styles, occasions, interests,
              gender, age_bands, taboos_avoid, hot_rank, click_count, affiliate_url, created_at, updated_at
       FROM product ORDER BY hot_rank ASC, product_id ASC LIMIT ${lim} OFFSET ${off}`
    );
    res.json({ list: rows.map(rowToAdminProduct), total });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.get('/:productId', async (req, res) => {
  const productId = req.params.productId;
  if (!ADMIN_PRODUCT_ID_RE.test(productId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法商品 id' });
    return;
  }
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const rows = await query(
      `SELECT product_id, name, price, sell_point, occasion_keyword, images, styles, occasions, interests,
              gender, age_bands, taboos_avoid, hot_rank, click_count, affiliate_url, created_at, updated_at
       FROM product WHERE product_id = ? LIMIT 1`,
      [productId]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: '商品不存在' });
      return;
    }
    res.json({ product: rowToAdminProduct(rows[0]) });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.post('/', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const v = validateCreateProductBody(req.body);
  if (!v.ok) {
    res.status(400).json({ error: v.error, message: v.message });
    return;
  }
  const d = v.data;
  try {
    await execute(
      `INSERT INTO product (
        product_id, name, price, sell_point, occasion_keyword,
        images, styles, occasions, interests, gender, age_bands, taboos_avoid,
        hot_rank, click_count, affiliate_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.productId,
        d.name,
        d.price,
        d.sellPoint,
        d.occasionKeyword,
        d.imagesJson,
        d.stylesJson,
        d.occasionsJson,
        d.interestsJson,
        d.genderDb,
        d.ageBandsJson,
        d.taboosJson,
        d.hotRank,
        d.clickCount,
        d.affiliateUrl,
      ]
    );
    const rows = await query(
      `SELECT product_id, name, price, sell_point, occasion_keyword, images, styles, occasions, interests,
              gender, age_bands, taboos_avoid, hot_rank, click_count, affiliate_url, created_at, updated_at
       FROM product WHERE product_id = ? LIMIT 1`,
      [d.productId]
    );
    res.status(201).json({ product: rowToAdminProduct(rows[0]) });
  } catch (e) {
    if (isDupKeyError(e)) {
      res.status(409).json({ error: 'CONFLICT', message: 'product_id 已存在' });
      return;
    }
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.put('/:productId', async (req, res) => {
  const productId = req.params.productId;
  if (!ADMIN_PRODUCT_ID_RE.test(productId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法商品 id' });
    return;
  }
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const rows = await query(
      `SELECT product_id, name, price, sell_point, occasion_keyword, images, styles, occasions, interests,
              gender, age_bands, taboos_avoid, hot_rank, click_count, affiliate_url, created_at, updated_at
       FROM product WHERE product_id = ? LIMIT 1`,
      [productId]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: '商品不存在' });
      return;
    }
    const v = validateUpdateProductBody(rows[0], req.body);
    if (!v.ok) {
      res.status(400).json({ error: v.error, message: v.message });
      return;
    }
    const d = v.data;
    await execute(
      `UPDATE product SET
        name = ?, price = ?, sell_point = ?, occasion_keyword = ?,
        images = ?, styles = ?, occasions = ?, interests = ?,
        gender = ?, age_bands = ?, taboos_avoid = ?, hot_rank = ?,
        click_count = ?, affiliate_url = ?
      WHERE product_id = ?`,
      [
        d.name,
        d.price,
        d.sellPoint,
        d.occasionKeyword,
        d.imagesJson,
        d.stylesJson,
        d.occasionsJson,
        d.interestsJson,
        d.genderDb,
        d.ageBandsJson,
        d.taboosJson,
        d.hotRank,
        d.clickCount,
        d.affiliateUrl,
        d.productId,
      ]
    );
    await invalidateProductDetailById(getRedis(), productId);
    const out = await query(
      `SELECT product_id, name, price, sell_point, occasion_keyword, images, styles, occasions, interests,
              gender, age_bands, taboos_avoid, hot_rank, click_count, affiliate_url, created_at, updated_at
       FROM product WHERE product_id = ? LIMIT 1`,
      [productId]
    );
    res.json({ product: rowToAdminProduct(out[0]) });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.delete('/:productId', async (req, res) => {
  const productId = req.params.productId;
  if (!ADMIN_PRODUCT_ID_RE.test(productId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法商品 id' });
    return;
  }
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const r = await execute('DELETE FROM product WHERE product_id = ?', [productId]);
    if (!r.affectedRows) {
      res.status(404).json({ error: 'NOT_FOUND', message: '商品不存在' });
      return;
    }
    await invalidateProductDetailById(getRedis(), productId);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

export default router;
