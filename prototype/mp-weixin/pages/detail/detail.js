const { getProfile } = require('../../utils/storage.js');
const { track } = require('../../utils/track.js');
const { toggleFavorite, getFavoriteList } = require('../../utils/favorite.js');

const app = getApp();

Page({
  data: {
    product: null,
    related: [],
    imageUrls: [],
    swiperIndex: 0,
    isCollected: false,
  },
  onLoad(q) {
    const id = q.id ? decodeURIComponent(q.id) : '';
    if (!id) {
      this.setData({ product: null });
      return;
    }
    const profile = getProfile() || {};
    const base = app.globalData.apiBase;
    const profileQ = encodeURIComponent(JSON.stringify(profile));
    
    this._loadProduct(id, profileQ, base);
    this._loadRelated(id, profileQ, base);
    this._loadCollectionStatus(id);
  },
  
  _loadProduct(id, profileQ, base) {
    wx.request({
      url: `${base}/api/product/${encodeURIComponent(id)}?profile=${profileQ}`,
      success: (res) => {
        if (res.statusCode !== 200 || !res.data || res.data.error) {
          this.setData({ product: null, imageUrls: [] });
          return;
        }
        const p = res.data;
        const imageUrls =
          Array.isArray(p.images) && p.images.length ? p.images : p.image ? [p.image] : [];
        this.setData({ product: p, imageUrls, swiperIndex: 0 });
      },
      fail: () => this.setData({ product: null, imageUrls: [] }),
    });
  },
  
  _loadRelated(id, profileQ, base) {
    wx.request({
      url: `${base}/api/related/${encodeURIComponent(id)}?profile=${profileQ}`,
      success: (res) => {
        const list = res.statusCode === 200 && Array.isArray(res.data) ? res.data : [];
        this.setData({ related: list });
      },
      fail: () => this.setData({ related: [] }),
    });
  },
  
  async _loadCollectionStatus(productId) {
    try {
      const { list } = await getFavoriteList();
      const collectedIds = new Set(list.map(item => item.product_id));
      this.setData({ isCollected: collectedIds.has(productId) });
    } catch (err) {
      console.warn('获取收藏状态失败:', err.message);
      this.setData({ isCollected: false });
    }
  },
  
  onSwiperChange(e) {
    this.setData({ swiperIndex: e.detail.current });
  },
  
  async onCollect() {
    const p = this.data.product;
    if (!p) return;
    
    const { isCollected } = this.data;
    
    try {
      const result = await toggleFavorite(p.id, isCollected);
      if (result.success) {
        this.setData({ isCollected: result.isCollected });
        const message = result.isCollected ? '已收录至礼遇单' : '已取消收藏';
        wx.showToast({ title: message, icon: 'none' });
        track(app, 'collect', { product_id: p.id, action: result.isCollected ? 'add' : 'remove' });
      }
    } catch (err) {
      console.error('收藏操作失败:', err.message);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },
  
  onBuy() {
    const p = this.data.product;
    if (!p) return;
    track(app, 'purchase_click', { product_id: p.id });
    wx.showToast({ title: '已记录礼遇意向', icon: 'none' });
  },
  
  openRelated(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(id)}` });
  },
});
