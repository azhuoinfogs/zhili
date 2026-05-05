import { Router } from 'express';
import { getPool, query, execute } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

const SELECT_ROW = `SELECT id, openid, device_id, anon_id, created_at, updated_at`;

function parsePaging(q) {
  const limit = Math.min(50, Math.max(1, parseInt(String(q?.limit ?? '20'), 10) || 20));
  const offset = Math.max(0, parseInt(String(q?.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

function listFilter(q) {
  const conds = [];
  const params = [];
  const kw = q?.keyword != null ? String(q.keyword).trim() : '';
  const safeKw = kw.replace(/[%_\\]/g, '');
  if (safeKw) {
    conds.push('(id LIKE ? OR openid LIKE ? OR anon_id LIKE ?)');
    params.push(`%${safeKw}%`, `%${safeKw}%`, `%${safeKw}%`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return { where, params };
}

router.get('/', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const { limit, offset } = parsePaging(req.query);
  const lim = Math.trunc(limit);
  const off = Math.trunc(offset);
  const { where, params } = listFilter(req.query);
  try {
    const countRows = await query(`SELECT COUNT(*) AS c FROM user ${where}`, params);
    const total = Number(countRows[0]?.c ?? 0);
    const rows = await query(
      `${SELECT_ROW} FROM user ${where} ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}`,
      params
    );
    res.json({ list: rows, total });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const userId = parseInt(String(req.params.id), 10);
  if (isNaN(userId) || userId <= 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法用户 id' });
    return;
  }
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const rows = await query(`${SELECT_ROW} FROM user WHERE id = ? LIMIT 1`, [userId]);
    if (!rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: '用户不存在' });
      return;
    }
    
    const profileRows = await query(
      `SELECT id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
       FROM user_profile WHERE user_id = ? ORDER BY is_default DESC, created_at ASC`,
      [userId]
    );
    
    res.json({ 
      user: rows[0],
      profiles: profileRows 
    });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = parseInt(String(req.params.id), 10);
  if (isNaN(userId) || userId <= 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法用户 id' });
    return;
  }
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const r = await execute('DELETE FROM user WHERE id = ?', [userId]);
    if (!r.affectedRows) {
      res.status(404).json({ error: 'NOT_FOUND', message: '用户不存在' });
      return;
    }
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

export default router;