import { Router } from 'express';
import { getPool, query, execute } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

const SELECT_ROW = `SELECT id, phone, nickname, avatar, openid, device_id, anon_id, created_at, updated_at`;

function parsePaging(q) {
  const limit = Math.min(100, Math.max(1, parseInt(String(q?.limit ?? '20'), 10) || 20));
  const offset = Math.max(0, parseInt(String(q?.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

function listFilter(q) {
  const conds = [];
  const params = [];
  
  const kw = q?.keyword != null ? String(q.keyword).trim() : '';
  const safeKw = kw.replace(/[%_\\]/g, '');
  if (safeKw) {
    conds.push('(id LIKE ? OR phone LIKE ? OR nickname LIKE ? OR openid LIKE ? OR anon_id LIKE ?)');
    params.push(`%${safeKw}%`, `%${safeKw}%`, `%${safeKw}%`, `%${safeKw}%`, `%${safeKw}%`);
  }
  
  if (q?.hasPhone != null) {
    const hasPhone = String(q.hasPhone).toLowerCase() === 'true';
    if (hasPhone) {
      conds.push('phone IS NOT NULL AND TRIM(phone) != ""');
    } else {
      conds.push('phone IS NULL OR TRIM(phone) = ""');
    }
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
    
    const orderRows = await query(
      `SELECT id, order_no, status, total_amount, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    
    const addressRows = await query(
      `SELECT id, name, phone, province, city, district, detail, is_default, created_at FROM user_address WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    
    res.json({ 
      user: rows[0],
      profiles: profileRows,
      orders: orderRows,
      addresses: addressRows
    });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const userId = parseInt(String(req.params.id), 10);
  if (isNaN(userId) || userId <= 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法用户 id' });
    return;
  }
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  
  const { nickname, avatar } = req.body;
  const updates = [];
  const params = [];
  
  if (nickname != null) {
    updates.push('nickname = ?');
    params.push(String(nickname).trim());
  }
  if (avatar != null) {
    updates.push('avatar = ?');
    params.push(String(avatar));
  }
  
  if (updates.length === 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '没有需要更新的字段' });
    return;
  }
  
  params.push(userId);
  
  try {
    const r = await execute(`UPDATE user SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    if (!r.affectedRows) {
      res.status(404).json({ error: 'NOT_FOUND', message: '用户不存在' });
      return;
    }
    
    const rows = await query(`${SELECT_ROW} FROM user WHERE id = ? LIMIT 1`, [userId]);
    res.json({ success: true, user: rows[0] });
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

router.get('/stats/overview', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const [total, withPhone, today, week, month] = await Promise.all([
      query('SELECT COUNT(*) AS c FROM user'),
      query('SELECT COUNT(*) AS c FROM user WHERE phone IS NOT NULL AND TRIM(phone) != ""'),
      query(`SELECT COUNT(*) AS c FROM user WHERE DATE(created_at) = CURDATE()`),
      query(`SELECT COUNT(*) AS c FROM user WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`),
      query(`SELECT COUNT(*) AS c FROM user WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`),
    ]);
    
    res.json({
      total: Number(total[0]?.c ?? 0),
      withPhone: Number(withPhone[0]?.c ?? 0),
      today: Number(today[0]?.c ?? 0),
      week: Number(week[0]?.c ?? 0),
      month: Number(month[0]?.c ?? 0),
    });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.get('/stats/gender', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const rows = await query(`
      SELECT gender, COUNT(*) AS count 
      FROM user_profile 
      GROUP BY gender 
      ORDER BY count DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.get('/stats/age', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const rows = await query(`
      SELECT age_band, COUNT(*) AS count 
      FROM user_profile 
      GROUP BY age_band 
      ORDER BY FIELD(age_band, 'under18', '18-25', '26-35', '36-45', '46plus')
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.delete('/batch', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '请提供要删除的用户ID列表' });
    return;
  }
  
  const validIds = ids.filter(id => {
    const num = parseInt(String(id), 10);
    return !isNaN(num) && num > 0;
  });
  
  if (validIds.length === 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '没有有效的用户ID' });
    return;
  }
  
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  
  try {
    const placeholders = validIds.map(() => '?').join(',');
    const r = await execute(`DELETE FROM user WHERE id IN (${placeholders})`, validIds);
    res.json({ success: true, deleted: r.affectedRows });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

export default router;