import jwt from 'jsonwebtoken';

const SECRET = () => process.env.JWT_SECRET || 'zhili_dev_change_me';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

export function signUserToken(userId, openid) {
  const sub = String(userId);
  return jwt.sign({ sub, openid: openid || null }, SECRET(), { expiresIn: EXPIRES });
}

export function verifyUserToken(token) {
  return jwt.verify(token, SECRET());
}

export function jwtConfigured() {
  return Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== 'zhili_dev_change_me');
}
