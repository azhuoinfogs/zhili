/**
 * B9：运营鉴权（develop2 §9.9.5）
 * — JWT `role: admin`
 * — 或 `ZHILI_ADMIN_USER_IDS`（逗号分隔 user.id）
 * — 或 **仅本地** `ZHILI_DEV_ADMIN_ANY_USER=1`（凡登录用户可写，禁止上生产）
 */

let devBypassWarned = false;

/**
 * @param {number} userId
 * @param {import('jsonwebtoken').JwtPayload | Record<string, unknown> | null | undefined} authPayload
 */
export function isZhiliAdmin(userId, authPayload) {
  const role = authPayload && typeof authPayload === 'object' ? authPayload.role : null;
  if (role === 'admin') return true;

  const raw = process.env.ZHILI_ADMIN_USER_IDS || '';
  const ids = new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0)
  );
  if (ids.has(Number(userId))) return true;

  if (String(process.env.ZHILI_DEV_ADMIN_ANY_USER || '') === '1') {
    if (!devBypassWarned) {
      devBypassWarned = true;
      console.warn(
        '[知礼] ZHILI_DEV_ADMIN_ANY_USER=1：任意登录用户可写 /api/admin/products，请勿用于生产'
      );
    }
    return true;
  }

  return false;
}
