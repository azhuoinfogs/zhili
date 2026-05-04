import { Router } from 'express';
import { getPool, query, execute } from '../db.js';
import { exchangeJsCode } from '../lib/wechat.js';
import { signUserToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { rowToApiProfile } from '../lib/profileSchema.js';
import { productsData } from '../productsData.js';
import { getListedProductPool } from '../lib/productCatalog.js';
import {
  parsePaging,
  shelfFromQuery,
  pickHotOrPersonalized,
  apiProfileToScoringProfile,
  runHotList,
  runPersonalizedList,
} from '../lib/recommendCore.js';

const router = Router();

/** 简单按 IP 分桶限流（B1.6） */
const loginBuckets = new Map();
const LOGIN_LIMIT = 40;
const BUCKET_MS = 60_000;

function loginRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const bucket = Math.floor(Date.now() / BUCKET_MS);
  const key = `${ip}:${bucket}`;
  const n = (loginBuckets.get(key) || 0) + 1;
  loginBuckets.set(key, n);
  if (n > LOGIN_LIMIT) {
    res.status(429).json({ error: 'RATE_LIMIT', message: '登录请求过于频繁，请稍后再试' });
    return;
  }
  if (loginBuckets.size > 5000) {
    const old = bucket - 2;
    for (const k of loginBuckets.keys()) {
      if (k.endsWith(`:${old}`)) loginBuckets.delete(k);
    }
  }
  next();
}

async function upsertUser(openid, anonId) {
  const anon = anonId && String(anonId).trim() ? String(anonId).trim() : null;
  await execute(
    `INSERT INTO user (openid, anon_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       updated_at = CURRENT_TIMESTAMP,
       anon_id = IF(
         (anon_id IS NULL OR TRIM(anon_id) = '')
         AND VALUES(anon_id) IS NOT NULL
         AND TRIM(VALUES(anon_id)) != '',
         VALUES(anon_id),
         anon_id
       )`,
    [openid, anon]
  );
  const rows = await query('SELECT id, openid, anon_id FROM user WHERE openid = ? LIMIT 1', [openid]);
  return rows[0];
}

router.post('/login', loginRateLimit, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接，无法登录' });
    return;
  }

  const code = req.body?.code;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'BAD_REQUEST', message: '缺少 body.code（wx.login 返回的临时码）' });
    return;
  }

  const anonFromBody = req.body?.anon_id ?? req.body?.zhili_vid;

  try {
    const { openid } = await exchangeJsCode(code);
    const row = await upsertUser(openid, anonFromBody);
    const token = signUserToken(row.id, row.openid);
    const expiresIn = parseExpiresSeconds(process.env.JWT_EXPIRES_IN || '7d');
    res.json({
      token,
      expires_in: expiresIn,
      user: { id: row.id, openid: row.openid, anon_id: row.anon_id || null },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[知礼] 登录失败:', err.message);
    const code =
      err.message === 'INVALID_CODE'
        ? 'INVALID_CODE'
        : err.message === 'WECHAT_NOT_CONFIGURED'
          ? 'WECHAT_NOT_CONFIGURED'
          : err.message === 'WECHAT_API_ERROR' || err.errcode != null
            ? 'WECHAT_API_ERROR'
            : 'LOGIN_FAILED';
    const body = { error: code, message: status === 502 ? '微信接口异常' : err.message };
    if (err.errcode != null) body.wechat_errcode = err.errcode;
    res.status(status).json(body);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const rows = await query('SELECT id, openid, anon_id, created_at FROM user WHERE id = ? LIMIT 1', [req.userId]);
    if (!rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: '用户不存在' });
      return;
    }
    res.json({ user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

/** B3：登录用户用默认画像 + 顶筛 + 实验组，走与 hot/personalized 同一内核 */
router.get('/recommend', requireAuth, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const q = req.query || {};
  const { limit, offset } = parsePaging(q);
  const shelf = shelfFromQuery(q);
  const mode = pickHotOrPersonalized(q.zhili_group ?? q.group);
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
    const apiProfile = rowToApiProfile(rows[0]);
    const productPool = await getListedProductPool(productsData);
    if (mode === 'hot') {
      res.json({
        mode: 'hot',
        list: runHotList(productPool, shelf, offset, limit),
      });
      return;
    }
    const profile = apiProfileToScoringProfile(apiProfile);
    res.json({
      mode: 'personalized',
      list: runPersonalizedList(productPool, profile, shelf, offset, limit),
    });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

function parseExpiresSeconds(exp) {
  const m = /^(\d+)([dhms])$/i.exec(String(exp).trim());
  if (!m) return 604800;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u === 'd') return n * 86400;
  if (u === 'h') return n * 3600;
  if (u === 'm') return n * 60;
  if (u === 's') return n;
  return 604800;
}

export default router;
