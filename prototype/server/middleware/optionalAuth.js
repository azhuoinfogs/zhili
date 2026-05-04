import { verifyUserToken } from '../lib/jwt.js';

/**
 * 若存在合法 `Authorization: Bearer`，写入 `req.userId`、`req.openid`；否则继续且无 `userId`。
 * 若 Header 形如 Bearer 但 token 无效 → **401**（与误传坏 token 的语义一致）。
 */
export function optionalAuth(req, res, next) {
  req.userId = null;
  req.openid = null;
  const raw = req.headers.authorization || '';
  const m = /^Bearer\s+(\S+)$/i.exec(raw);
  if (!m) {
    next();
    return;
  }
  try {
    const payload = verifyUserToken(m[1]);
    const id = Number(payload.sub);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: '令牌主体无效' });
      return;
    }
    req.userId = id;
    req.openid = payload.openid || null;
    next();
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED', message: '令牌无效或已过期' });
  }
}
