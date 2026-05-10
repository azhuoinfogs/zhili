const { getOrCreateZhiliVid } = require('./storage.js');
const { post } = require('./request.js');

const TOKEN_KEY = 'zhili_token';
const USER_KEY = 'zhili_user';

function getToken() {
  try {
    return wx.getStorageSync(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

function setToken(token) {
  try {
    wx.setStorageSync(TOKEN_KEY, token);
  } catch (e) {
    console.warn('setToken error:', e);
  }
}

function getUser() {
  try {
    const data = wx.getStorageSync(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function setUser(user) {
  try {
    wx.setStorageSync(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('setUser error:', e);
  }
}

function isLoggedIn() {
  return !!getToken();
}

async function wechatLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (res) => {
        if (!res.code) {
          reject(new Error('获取登录码失败'));
          return;
        }
        
        try {
          const anon_id = getOrCreateZhiliVid();
          const result = await post('/api/user/login', {
            code: res.code,
            anon_id,
            platform: 'wechat_mini'
          }, { needAuth: false });
          
          if (result && result.success) {
            const { data } = result;
            setToken(data.token);
            setUser(data);
            resolve(data);
          } else {
            reject(new Error(result?.error || '登录失败'));
          }
        } catch (err) {
          reject(err);
        }
      },
      fail: (err) => reject(err)
    });
  });
}

module.exports = {
  getToken,
  setToken,
  getUser,
  setUser,
  isLoggedIn,
  wechatLogin
};
