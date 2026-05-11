import { Router } from 'express';
import crypto from 'crypto';
import { getPool, query, execute } from '../db.js';
import { exchangeJsCode } from '../lib/wechat.js';
import { signUserToken, verifyToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { rowToApiProfile } from '../lib/profileSchema.js';
import { productsData } from '../productsData.js';
import {
  parsePaging,
  shelfFromQuery,
  pickHotOrPersonalized,
  apiProfileToScoringProfile,
  runHotList,
  runPersonalizedList,
} from '../lib/recommendCore.js';
import { sendVerificationCode, verifyCode } from '../lib/sms.js';

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

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + process.env.PASSWORD_SALT).digest('hex');
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

/**
 * 发送验证码接口
 * POST /api/user/send-code
 */
router.post('/send-code', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '手机号不能为空' });
    return;
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    res.status(400).json({ error: 'INVALID_PHONE', message: '手机号格式不正确' });
    return;
  }

  try {
    const result = await sendVerificationCode(phone);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: 'SEND_FAILED', message: result.message });
    }
  } catch (err) {
    console.error('[知礼] 发送验证码失败:', err.message);
    res.status(500).json({ error: 'SEND_FAILED', message: '发送失败，请稍后重试' });
  }
});

/**
 * 用户注册接口（手机号 + 密码 + 验证码）
 * POST /api/user/register
 */
router.post('/register', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接，无法注册' });
    return;
  }

  const { phone, password, nickname, code } = req.body;

  if (!phone || !password) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '手机号和密码不能为空' });
    return;
  }

  if (!code || code.length !== 6) {
    res.status(400).json({ error: 'INVALID_CODE', message: '验证码格式错误' });
    return;
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    res.status(400).json({ error: 'INVALID_PHONE', message: '手机号格式不正确' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'INVALID_PASSWORD', message: '密码长度不能少于6位' });
    return;
  }

  try {
    // 验证验证码
    if (!verifyCode(phone, code)) {
      res.status(400).json({ error: 'INVALID_CODE', message: '验证码错误或已过期' });
      return;
    }

    const existing = await query('SELECT id FROM user WHERE phone = ? LIMIT 1', [phone]);
    if (existing.length > 0) {
      res.status(409).json({ error: 'PHONE_EXISTS', message: '该手机号已被注册' });
      return;
    }

    const hashedPassword = hashPassword(password);
    const defaultNickname = nickname || '用户' + phone.slice(-4);
    await execute(
      `INSERT INTO user (phone, password, nickname, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [phone, hashedPassword, defaultNickname]
    );

    const rows = await query('SELECT id, phone, nickname, created_at FROM user WHERE phone = ? LIMIT 1', [phone]);
    const user = rows[0];
    const token = signUserToken(user.id, user.phone);
    const expiresIn = parseExpiresSeconds(process.env.JWT_EXPIRES_IN || '7d');

    res.json({
      success: true,
      token,
      expires_in: expiresIn,
      user: { id: user.id, phone: user.phone, nickname: user.nickname }
    });
  } catch (err) {
    console.error('[知礼] 注册失败:', err.message);
    res.status(500).json({ error: 'REGISTER_FAILED', message: '注册失败，请稍后重试' });
  }
});

/**
 * 用户登录接口（手机号 + 密码）
 * POST /api/user/login
 */
router.post('/login', loginRateLimit, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接，无法登录' });
    return;
  }

  const { phone, password, code } = req.body;

  if (code) {
    return handleWechatLogin(req, res);
  }

  if (!phone || !password) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '手机号和密码不能为空' });
    return;
  }

  try {
    const rows = await query('SELECT id, phone, password, nickname FROM user WHERE phone = ? LIMIT 1', [phone]);
    if (!rows.length) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '手机号或密码错误' });
      return;
    }

    const user = rows[0];
    const hashedPassword = hashPassword(password);

    if (user.password !== hashedPassword) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '手机号或密码错误' });
      return;
    }

    const token = signUserToken(user.id, user.phone);
    const expiresIn = parseExpiresSeconds(process.env.JWT_EXPIRES_IN || '7d');

    res.json({
      success: true,
      token,
      expires_in: expiresIn,
      user: { id: user.id, phone: user.phone, nickname: user.nickname }
    });
  } catch (err) {
    console.error('[知礼] 登录失败:', err.message);
    res.status(500).json({ error: 'LOGIN_FAILED', message: '登录失败，请稍后重试' });
  }
});

async function handleWechatLogin(req, res) {
  const code = req.body.code;
  const anonFromBody = req.body?.anon_id ?? req.body?.zhili_vid;

  try {
    const { openid } = await exchangeJsCode(code);
    const row = await upsertUser(openid, anonFromBody);
    const token = signUserToken(row.id, row.openid);
    const expiresIn = parseExpiresSeconds(process.env.JWT_EXPIRES_IN || '7d');
    res.json({
      success: true,
      token,
      expires_in: expiresIn,
      user: { id: row.id, openid: row.openid, anon_id: row.anon_id || null },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[知礼] 微信登录失败:', err.message);
    const errorCode =
      err.message === 'INVALID_CODE'
        ? 'INVALID_CODE'
        : err.message === 'WECHAT_NOT_CONFIGURED'
          ? 'WECHAT_NOT_CONFIGURED'
          : err.message === 'WECHAT_API_ERROR' || err.errcode != null
            ? 'WECHAT_API_ERROR'
            : 'LOGIN_FAILED';
    const body = { error: errorCode, message: status === 502 ? '微信接口异常' : err.message };
    if (err.errcode != null) body.wechat_errcode = err.errcode;
    res.status(status).json(body);
  }
}

/**
 * 获取用户信息
 * GET /api/user/me
 */
router.get('/me', requireAuth, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const rows = await query('SELECT id, phone, nickname, avatar, created_at, updated_at FROM user WHERE id = ? LIMIT 1', [req.userId]);
    if (!rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: '用户不存在' });
      return;
    }
    res.json({ success: true, user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

/**
 * 更新用户信息
 * PUT /api/user/me
 */
router.put('/me', requireAuth, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }

  const { nickname, avatar } = req.body;

  try {
    await execute(
      `UPDATE user SET nickname = COALESCE(?, nickname), avatar = COALESCE(?, avatar), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [nickname, avatar, req.userId]
    );

    const rows = await query('SELECT id, phone, nickname, avatar, created_at, updated_at FROM user WHERE id = ? LIMIT 1', [req.userId]);
    res.json({ success: true, user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

/**
 * 修改密码
 * PUT /api/user/password
 */
router.put('/password', requireAuth, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }

  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '旧密码和新密码不能为空' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'INVALID_PASSWORD', message: '新密码长度不能少于6位' });
    return;
  }

  try {
    const rows = await query('SELECT password FROM user WHERE id = ? LIMIT 1', [req.userId]);
    if (!rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: '用户不存在' });
      return;
    }

    const hashedOldPassword = hashPassword(oldPassword);
    if (rows[0].password !== hashedOldPassword) {
      res.status(401).json({ error: 'INVALID_PASSWORD', message: '旧密码不正确' });
      return;
    }

    const hashedNewPassword = hashPassword(newPassword);
    await execute('UPDATE user SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedNewPassword, req.userId]);

    res.json({ success: true, message: '密码修改成功' });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

/**
 * 刷新 Token
 * POST /api/user/refresh
 */
router.post('/refresh', async (req, res) => {
  const token = req.body?.token;
  if (!token) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '缺少 token' });
    return;
  }

  try {
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'INVALID_TOKEN', message: '无效的 token' });
      return;
    }

    const newToken = signUserToken(payload.userId, payload.openid);
    const expiresIn = parseExpiresSeconds(process.env.JWT_EXPIRES_IN || '7d');

    res.json({ success: true, token: newToken, expires_in: expiresIn });
  } catch (e) {
    res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'token 已过期' });
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
