/** 收藏持久化工具函数 */

const { getAuthHeader } = require('./auth.js');

const app = getApp();

/**
 * 获取用户收藏列表
 * @returns {Promise<{list: Array, total: number}>}
 */
function getFavoriteList() {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: app.globalData.apiBase + '/api/favorite/list',
      header: getAuthHeader(),
      success: function (res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(new Error(res.data?.message || '获取收藏列表失败'));
        }
      },
      fail: function (err) {
        reject(new Error('网络请求失败: ' + err.errMsg));
      },
    });
  });
}

/**
 * 添加收藏
 * @param {string} productId 商品ID
 * @returns {Promise<{success: boolean, already?: boolean}>}
 */
function addFavorite(productId) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: app.globalData.apiBase + '/api/favorite',
      method: 'POST',
      header: getAuthHeader(),
      data: { productId: productId },
      success: function (res) {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({
            success: true,
            already: !!res.data.already,
          });
        } else {
          reject(new Error(res.data?.message || '收藏失败'));
        }
      },
      fail: function (err) {
        reject(new Error('网络请求失败: ' + err.errMsg));
      },
    });
  });
}

/**
 * 取消收藏
 * @param {string} productId 商品ID
 * @returns {Promise<{success: boolean}>}
 */
function removeFavorite(productId) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: app.globalData.apiBase + '/api/favorite/' + encodeURIComponent(productId),
      method: 'DELETE',
      header: getAuthHeader(),
      success: function (res) {
        if (res.statusCode === 204) {
          resolve({ success: true });
        } else {
          reject(new Error(res.data?.message || '取消收藏失败'));
        }
      },
      fail: function (err) {
        reject(new Error('网络请求失败: ' + err.errMsg));
      },
    });
  });
}

/**
 * 切换收藏状态
 * @param {string} productId 商品ID
 * @param {boolean} isCollected 当前是否已收藏
 * @returns {Promise<{success: boolean, isCollected: boolean}>}
 */
function toggleFavorite(productId, isCollected) {
  if (isCollected) {
    return removeFavorite(productId).then(function () {
      return { success: true, isCollected: false };
    });
  } else {
    return addFavorite(productId).then(function () {
      return { success: true, isCollected: true };
    });
  }
}

module.exports = {
  getFavoriteList,
  addFavorite,
  removeFavorite,
  toggleFavorite,
};