import { test } from 'node:test';
import assert from 'node:assert';

test('JWT 签发与校验（B1）', async () => {
  process.env.JWT_SECRET = 'unit_test_secret_zhili_b1';
  process.env.JWT_EXPIRES_IN = '1h';
  const { signUserToken, verifyUserToken } = await import('./lib/jwt.js');
  const token = signUserToken(42, 'o-test-openid');
  const payload = verifyUserToken(token);
  assert.strictEqual(payload.sub, '42');
  assert.strictEqual(payload.openid, 'o-test-openid');
});
