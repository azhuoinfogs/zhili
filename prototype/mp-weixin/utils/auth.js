/** 微信登录工具函数 */

const { getToken, setToken, setUserId, getUserId, removeToken, getOrCreateZhiliVid } = require('./storage.js');

const app = getApp();

/**
 * 执行微信登录
 * @returns {Promise<{success: boolean, token?: string, userId?: number}>}
 */
function wechatLogin() {
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (loginRes) {
        if (!loginRes.code) {
          reject(new Error('获取登录码失败'));
          return;
        }
        
        const anonId = getOrCreateZhiliVid();
        
        wx.request({
          url: app.globalData.apiBase + '/api/user/login',
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: {
            code: loginRes.code,
            anon_id: anonId,
          },
          success: function (res) {
            if (res.statusCode === 200 && res.data.token) {
              setToken(res.data.token, res.data.expires_in);
              setUserId(res.data.user.id);
              resolve({
                success: true,
                token: res.data.token,
                userId: res.data.user.id,
              });
            } else {
              reject(new Error(res.data?.message || '登录失败'));
            }
          },
          fail: function (err) {
            reject(new Error('网络请求失败: ' + err.errMsg));
          },
        });
      },
      fail: function (err) {
        reject(new Error('微信登录失败: ' + err.errMsg));
      },
    });
  });
}

/**
 * 检查是否已登录（token 是否有效）
 * @returns {boolean}
 */
function isLoggedIn() {
  return !!getToken();
}

/**
 * 获取请求头（包含 Authorization）
 * @returns {Record<string, string>}
 */
function getAuthHeader() {
  const token = getToken();
  const headers = { 'content-type': 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  return headers;
}

/**
 * 登出
 */
function logout() {
  removeToken();
}

module.exports = {
  wechatLogin,
  isLoggedIn,
  getAuthHeader,
  getUserId,
  logout,
};