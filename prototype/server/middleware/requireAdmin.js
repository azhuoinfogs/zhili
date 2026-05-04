import { isZhiliAdmin } from '../lib/adminAccess.js';

/**
 * 须在 `requireAuth` 之后挂载；依赖 `req.userId`、`req.authPayload`。
 */
export function requireAdmin(req, res, next) {
  if (!isZhiliAdmin(req.userId, req.authPayload)) {
    res.status(403).json({ error: 'FORBIDDEN', message: '无运营权限' });
    return;
  }
  next();
}
