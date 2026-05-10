import jwt from 'jsonwebtoken';

const SECRET = () => process.env.JWT_SECRET || 'zhili_dev_change_me';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

/**
 * @param {number | string} userId
 * @param {string | null} openid
 * @param {Record<string, unknown>} [extraClaims] 如 `{ role: 'admin' }`（B9 运营 JWT）
 */
export function signUserToken(userId, openid, extraClaims = {}) {
  const sub = String(userId);
  return jwt.sign({ sub, openid: openid || null, ...extraClaims }, SECRET(), { expiresIn: EXPIRES });
}

export function verifyUserToken(token) {
  return jwt.verify(token, SECRET());
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET());
  } catch {
    return null;
  }
}

export function jwtConfigured() {
  return Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== 'zhili_dev_change_me');
}
