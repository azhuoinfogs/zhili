import { Router } from 'express';
import { signUserToken } from '../lib/jwt.js';

const router = Router();

/**
 * 运营后台专用：密码登录后签发 **JWT `role: admin`**（与 `requireAdmin` 一致）。
 * 配置 **`ZHILI_ADMIN_CONSOLE_PASSWORD`**（必填）；可选 **`ZHILI_ADMIN_CONSOLE_USER_ID`**（写入 JWT `sub`，默认 900000001）。
 */
router.post('/login', (req, res) => {
  const configured = process.env.ZHILI_ADMIN_CONSOLE_PASSWORD;
  if (!configured || !String(configured).trim()) {
    res.status(503).json({
      error: 'ADMIN_LOGIN_DISABLED',
      message: '未配置 ZHILI_ADMIN_CONSOLE_PASSWORD，后台密码登录不可用',
    });
    return;
  }
  const given = req.body?.password != null ? String(req.body.password) : '';
  if (given !== configured) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: '密码错误' });
    return;
  }
  let sub = Number(process.env.ZHILI_ADMIN_CONSOLE_USER_ID) || 900000001;
  if (!Number.isFinite(sub) || sub <= 0) sub = 900000001;
  sub = Math.min(Math.floor(sub), 2147483647);
  const token = signUserToken(sub, null, { role: 'admin' });
  const expiresIn = parseExpiresSeconds(process.env.JWT_EXPIRES_IN || '7d');
  res.json({
    token,
    expires_in: expiresIn,
    admin: { role: 'admin', userId: sub },
  });
});

function parseExpiresSeconds(spec) {
  const m = /^(\d+)([dhms])$/i.exec(String(spec).trim());
  if (!m) return 604800;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const mult = u === 'd' ? 86400 : u === 'h' ? 3600 : u === 'm' ? 60 : 1;
  return n * mult;
}

export default router;
