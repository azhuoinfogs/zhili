import { Router } from 'express';
import { getPool, query, execute } from '../db.js';
import {
  FAVORITE_PRODUCT_ID_RE,
  parseFavoriteListPaging,
  pickFavoriteProductId,
  rowToFavoriteListItem,
} from '../lib/favoriteHelpers.js';

const router = Router();

function extractUserId(req) {
  if (req.userId) return req.userId;
  if (req.body && typeof req.body.user_id === 'number') return req.body.user_id;
  if (req.body && typeof req.body.user_id === 'string') {
    const id = Number(req.body.user_id);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

router.get('/list', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const userId = extractUserId(req) || Number(req.query.user_id);
  if (!userId || userId <= 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '缺少 user_id' });
    return;
  }
  const { limit, offset } = parseFavoriteListPaging(req.query);
  const lim = Math.trunc(limit);
  const off = Math.trunc(offset);
  try {
    const countRows = await query('SELECT COUNT(*) AS c FROM collection WHERE user_id = ?', [userId]);
    const total = Number(countRows[0]?.c ?? 0);
    const rows = await query(
      `SELECT product_id, created_at FROM collection WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ${lim} OFFSET ${off}`,
      [userId]
    );
    res.json({ list: rows.map(rowToFavoriteListItem), total });
  } catch (e) {
    console.error('[知礼] GET /api/favorite/list', e);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.post('/', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const userId = extractUserId(req);
  if (!userId || userId <= 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '缺少 user_id' });
    return;
  }
  const productId = pickFavoriteProductId(req.body);
  if (!productId || !FAVORITE_PRODUCT_ID_RE.test(productId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '缺少或非法的 productId（可与 product_id 二选一）' });
    return;
  }
  try {
    const exists = await query('SELECT 1 FROM product WHERE product_id = ? LIMIT 1', [productId]);
    if (!exists.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: '商品不存在' });
      return;
    }
    try {
      await execute('INSERT INTO collection (user_id, product_id) VALUES (?, ?)', [userId, productId]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
        const rows = await query(
          'SELECT product_id, created_at FROM collection WHERE user_id = ? AND product_id = ? LIMIT 1',
          [userId, productId]
        );
        if (!rows.length) {
          res.status(500).json({ error: 'SERVER_ERROR', message: '重复键后未读到收藏行' });
          return;
        }
        const item = rowToFavoriteListItem(rows[0]);
        res.status(200).json({ ...item, already: true });
        return;
      }
      throw e;
    }
    const rows = await query(
      'SELECT product_id, created_at FROM collection WHERE user_id = ? AND product_id = ? LIMIT 1',
      [userId, productId]
    );
    const item = rowToFavoriteListItem(rows[0]);
    res.status(201).json(item);
  } catch (e) {
    console.error('[知礼] POST /api/favorite', e);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.delete('/:productId', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const userId = extractUserId(req);
  if (!userId || userId <= 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '缺少 user_id' });
    return;
  }
  const productId = String(req.params.productId || '');
  if (productId === 'list') {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: '路径保留：收藏列表请用 GET /api/favorite/list；取消收藏请用 DELETE /api/favorite/:productId',
    });
    return;
  }
  if (!FAVORITE_PRODUCT_ID_RE.test(productId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '路径参数 productId 非法' });
    return;
  }
  try {
    const result = await execute('DELETE FROM collection WHERE user_id = ? AND product_id = ?', [
      userId,
      productId,
    ]);
    const affected = typeof result.affectedRows === 'number' ? result.affectedRows : 0;
    if (affected === 0) {
      res.status(404).json({ error: 'NOT_IN_COLLECTION', message: '未收藏该商品' });
      return;
    }
    res.status(204).send();
  } catch (e) {
    console.error('[知礼] DELETE /api/favorite/:productId', e);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

export default router;
