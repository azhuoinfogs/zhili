/**
 * 微信小程序 jscode2session（B1）
 * WECHAT_MOCK=1 时不调微信接口，便于无 AppSecret 的本地联调。
 */

export function wechatAuthConfigured() {
  if (String(process.env.WECHAT_MOCK || '') === '1') return true;
  return Boolean(process.env.WECHAT_APPID && process.env.WECHAT_SECRET);
}

export async function exchangeJsCode(code) {
  if (!code || typeof code !== 'string' || code.length < 4) {
    const e = new Error('INVALID_CODE');
    e.status = 400;
    throw e;
  }

  if (String(process.env.WECHAT_MOCK || '') === '1') {
    const openid = `mock_${Buffer.from(code.slice(0, 32), 'utf8').toString('hex').slice(0, 28)}`;
    return { openid, unionid: null };
  }

  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
  if (!appid || !secret) {
    const e = new Error('WECHAT_NOT_CONFIGURED');
    e.status = 503;
    throw e;
  }

  const url =
    'https://api.weixin.qq.com/sns/jscode2session?' +
    new URLSearchParams({
      appid,
      secret,
      js_code: code,
      grant_type: 'authorization_code',
    }).toString();

  const res = await fetch(url);
  const data = await res.json();

  if (data.errcode) {
    const e = new Error(data.errmsg || 'WECHAT_API_ERROR');
    e.status = data.errcode === 40029 ? 400 : 502;
    e.errcode = data.errcode;
    throw e;
  }

  if (!data.openid) {
    const e = new Error('WECHAT_NO_OPENID');
    e.status = 502;
    throw e;
  }

  return { openid: data.openid, unionid: data.unionid || null };
}
