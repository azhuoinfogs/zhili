const { getToken } = require('./auth.js');

const FAVORITE_KEY = 'zhili_favorites';

function getLocalFavorites() {
  try {
    const data = wx.getStorageSync(FAVORITE_KEY);
    return data ? JSON.parse(data) : { list: [], updatedAt: 0 };
  } catch (e) {
    return { list: [], updatedAt: 0 };
  }
}

function setLocalFavorites(list) {
  try {
    wx.setStorageSync(FAVORITE_KEY, JSON.stringify({
      list,
      updatedAt: Date.now()
    }));
  } catch (e) {
    console.warn('setLocalFavorites error:', e);
  }
}

async function toggleFavorite(productId, isCollected, productInfo = {}) {
  if (!getToken()) {
    const local = getLocalFavorites();
    let list = [...local.list];
    const index = list.findIndex(item => item.product_id === productId);
    
    if (isCollected) {
      if (index >= 0) {
        list.splice(index, 1);
      }
    } else {
      if (index < 0) {
        list.push({
          product_id: productId,
          ...productInfo,
          addedAt: Date.now()
        });
      }
    }
    
    setLocalFavorites(list);
    return { success: true, isCollected: !isCollected };
  }
  
  try {
    const action = isCollected ? 'remove' : 'add';
    const result = await wx.cloud.callFunction({
      name: 'favorite',
      data: {
        action,
        productId,
        productInfo: !isCollected ? productInfo : undefined
      }
    });
    
    if (result.result && result.result.success) {
      const local = getLocalFavorites();
      let list = [...local.list];
      const index = list.findIndex(item => item.product_id === productId);
      
      if (isCollected) {
        if (index >= 0) list.splice(index, 1);
      } else {
        if (index < 0) list.push({ product_id: productId, ...productInfo });
      }
      setLocalFavorites(list);
      
      return { success: true, isCollected: result.result.isCollected };
    } else {
      const errorMsg = result.result?.error || '操作失败';
      // 如果是"已收藏"或"未收藏"，视为成功但状态不变
      if (errorMsg === '已收藏' || errorMsg === '未收藏') {
        return { success: true, isCollected: !isCollected, message: errorMsg };
      }
      throw new Error(errorMsg);
    }
  } catch (err) {
    console.error('toggleFavorite error:', err);
    throw err;
  }
}

async function getFavoriteList() {
  if (!getToken()) {
    return getLocalFavorites();
  }
  
  try {
    const result = await wx.cloud.callFunction({
      name: 'favorite',
      data: { action: 'list' }
    });
    
    if (result.result && result.result.success) {
      const cloudList = result.result.data.map(item => ({
        product_id: item.productId || item.product_id,
        name: item.name || item.productName || '未知商品',
        price: item.price || item.productPrice || 0,
        image: item.image || item.productImage || 'https://picsum.photos/seed/default/200/200',
        addedAt: item.created_at?.getTime() || Date.now()
      }));
      setLocalFavorites(cloudList);
      return { list: cloudList };
    } else {
      return getLocalFavorites();
    }
  } catch (err) {
    console.warn('getFavoriteList error:', err);
    return getLocalFavorites();
  }
}

async function removeFavorite(productId) {
  return toggleFavorite(productId, true);
}

module.exports = {
  toggleFavorite,
  getFavoriteList,
  removeFavorite
};
