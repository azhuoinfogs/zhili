import { Router } from 'express';
import { getPool, query, getRedis } from '../db.js';
import { invalidateUserRecommendations } from '../lib/recommendCache.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  validateProfileBody,
  normalizeProfilePayload,
  rowToApiProfile,
} from '../lib/profileSchema.js';

const router = Router();
router.use(requireAuth);

function parsePaging(q) {
  const limit = Math.min(50, Math.max(1, parseInt(String(q?.limit ?? '20'), 10) || 20));
  const offset = Math.max(0, parseInt(String(q?.offset ?? '0'), 10) || 0);
  return { limit, offset };
}

function parseId(param) {
  const id = parseInt(String(param), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

router.get('/default', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const rows = await query(
      `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
       FROM user_profile WHERE user_id = ? AND is_default = 1 ORDER BY id ASC LIMIT 1`,
      [req.userId]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'NO_DEFAULT_PROFILE', message: '请先创建画像并设为默认' });
      return;
    }
    res.json({ profile: rowToApiProfile(rows[0]) });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.get('/', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const { limit, offset } = parsePaging(req.query);
  // LIMIT/OFFSET 勿用预编译占位符：部分 MySQL 会报 Incorrect arguments to mysqld_stmt_execute
  const lim = Math.trunc(limit);
  const off = Math.trunc(offset);
  try {
    const countRows = await query('SELECT COUNT(*) AS c FROM user_profile WHERE user_id = ?', [req.userId]);
    const total = Number(countRows[0]?.c ?? 0);
    const rows = await query(
      `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
       FROM user_profile WHERE user_id = ? ORDER BY is_default DESC, id ASC LIMIT ${lim} OFFSET ${off}`,
      [req.userId]
    );
    res.json({ list: rows.map(rowToApiProfile), total });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.post('/', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const v = validateProfileBody(req.body, { partial: false });
  if (!v.ok) {
    res.status(400).json({ error: v.error, message: v.message });
    return;
  }
  const p = normalizeProfilePayload(req.body);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cntRows] = await conn.query('SELECT COUNT(*) AS c FROM user_profile WHERE user_id = ? FOR UPDATE', [
      req.userId,
    ]);
    const cnt = Number(cntRows[0]?.c ?? 0);
    let isDefault = p.is_default;
    if (cnt === 0) isDefault = true;
    if (isDefault) {
      await conn.execute('UPDATE user_profile SET is_default = 0 WHERE user_id = ?', [req.userId]);
    }
    const [ins] = await conn.execute(
      `INSERT INTO user_profile (user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.userId,
        p.name,
        p.relation,
        p.gender,
        p.age_band,
        p.budget,
        p.occasion,
        p.style,
        JSON.stringify(p.interests),
        JSON.stringify(p.taboos),
        isDefault ? 1 : 0,
      ]
    );
    await conn.commit();
    await invalidateUserRecommendations(getRedis(), req.userId);
    const id = ins.insertId;
    const rows = await query(
      `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
       FROM user_profile WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, req.userId]
    );
    res.status(201).json({ profile: rowToApiProfile(rows[0]) });
  } catch (e) {
    await conn.rollback();
    console.error('[知礼] 创建画像失败:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  } finally {
    conn.release();
  }
});

router.put('/:id/default', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法画像 id' });
    return;
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [own] = await conn.query('SELECT id FROM user_profile WHERE id = ? AND user_id = ? FOR UPDATE', [
      id,
      req.userId,
    ]);
    if (!own.length) {
      await conn.rollback();
      res.status(404).json({ error: 'NOT_FOUND', message: '画像不存在' });
      return;
    }
    await conn.execute('UPDATE user_profile SET is_default = 0 WHERE user_id = ?', [req.userId]);
    await conn.execute('UPDATE user_profile SET is_default = 1 WHERE id = ? AND user_id = ?', [id, req.userId]);
    await conn.commit();
    await invalidateUserRecommendations(getRedis(), req.userId);
    const rows = await query(
      `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
       FROM user_profile WHERE id = ? LIMIT 1`,
      [id]
    );
    res.json({ profile: rowToApiProfile(rows[0]) });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  } finally {
    conn.release();
  }
});

router.get('/:id', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法画像 id' });
    return;
  }
  try {
    const rows = await query(
      `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
       FROM user_profile WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, req.userId]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: '画像不存在' });
      return;
    }
    res.json({ profile: rowToApiProfile(rows[0]) });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.put('/:id', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法画像 id' });
    return;
  }
  const v = validateProfileBody(req.body, { partial: false });
  if (!v.ok) {
    res.status(400).json({ error: v.error, message: v.message });
    return;
  }
  const p = normalizeProfilePayload(req.body);
  const cntRows = await query('SELECT COUNT(*) AS c FROM user_profile WHERE user_id = ?', [req.userId]);
  if (Number(cntRows[0]?.c ?? 0) === 1) p.is_default = true;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [own] = await conn.query('SELECT id, is_default FROM user_profile WHERE id = ? AND user_id = ? FOR UPDATE', [
      id,
      req.userId,
    ]);
    if (!own.length) {
      await conn.rollback();
      res.status(404).json({ error: 'NOT_FOUND', message: '画像不存在' });
      return;
    }
    const wasDefault = Boolean(own[0].is_default);
    if (p.is_default) {
      await conn.execute('UPDATE user_profile SET is_default = 0 WHERE user_id = ?', [req.userId]);
    } else if (wasDefault) {
      const [cntArr] = await conn.query('SELECT COUNT(*) AS c FROM user_profile WHERE user_id = ?', [req.userId]);
      const c = Number(cntArr[0]?.c ?? 0);
      if (c > 1) {
        await conn.rollback();
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: '默认画像不能直接取消默认，请先为其他画像设置默认',
        });
        return;
      }
    }
    await conn.execute(
      `UPDATE user_profile SET name = ?, relation = ?, gender = ?, age_band = ?, budget = ?, occasion = ?, style = ?,
       interests = ?, taboos = ?, is_default = ? WHERE id = ? AND user_id = ?`,
      [
        p.name,
        p.relation,
        p.gender,
        p.age_band,
        p.budget,
        p.occasion,
        p.style,
        JSON.stringify(p.interests),
        JSON.stringify(p.taboos),
        p.is_default ? 1 : 0,
        id,
        req.userId,
      ]
    );
    await conn.commit();
    await invalidateUserRecommendations(getRedis(), req.userId);
    const rows = await query(
      `SELECT id, user_id, name, relation, gender, age_band, budget, occasion, style, interests, taboos, is_default, created_at, updated_at
       FROM user_profile WHERE id = ? LIMIT 1`,
      [id]
    );
    res.json({ profile: rowToApiProfile(rows[0]) });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '非法画像 id' });
    return;
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id, is_default FROM user_profile WHERE user_id = ? FOR UPDATE',
      [req.userId]
    );
    if (rows.length <= 1) {
      await conn.rollback();
      res.status(409).json({ error: 'CONFLICT', message: '至少保留一条画像' });
      return;
    }
    const target = rows.find((r) => Number(r.id) === id);
    if (!target) {
      await conn.rollback();
      res.status(404).json({ error: 'NOT_FOUND', message: '画像不存在' });
      return;
    }
    const wasDefault = Boolean(target.is_default);
    await conn.execute('DELETE FROM user_profile WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (wasDefault) {
      const [rest] = await conn.query(
        'SELECT id FROM user_profile WHERE user_id = ? ORDER BY id ASC LIMIT 1',
        [req.userId]
      );
      if (rest.length) {
        await conn.execute('UPDATE user_profile SET is_default = 0 WHERE user_id = ?', [req.userId]);
        await conn.execute('UPDATE user_profile SET is_default = 1 WHERE id = ?', [rest[0].id]);
      }
    }
    await conn.commit();
    await invalidateUserRecommendations(getRedis(), req.userId);
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  } finally {
    conn.release();
  }
});

export default router;
