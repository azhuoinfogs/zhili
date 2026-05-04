import { verifyUserToken } from '../lib/jwt.js';

/**
 * 校验 Authorization: Bearer <JWT>，写入 req.userId、req.openid
 */
export function requireAuth(req, res, next) {
  const raw = req.headers.authorization || '';
  const m = /^Bearer\s+(\S+)$/i.exec(raw);
  if (!m) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: '缺少 Authorization: Bearer token' });
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
