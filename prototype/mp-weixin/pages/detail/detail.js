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
    console.log('[调试] detail onLoad - 接收参数:', q);
    
    const id = q.id ? decodeURIComponent(q.id) : '';
    console.log('[调试] detail onLoad - 商品ID:', id);
    
    if (!id) {
      console.error('[调试] detail onLoad - 缺少商品ID');
      this.setData({ product: null });
      return;
    }
    
    this._loadProduct(id);
    this._loadRelated(id);
    this._loadCollectionStatus(id);
  },
  
  async _loadProduct(productId) {
    console.log('[调试] _loadProduct - 开始加载商品详情:', productId);
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: { action: 'detail', productId }
      });
      
      console.log('[调试] _loadProduct - 云函数返回:', result);
      
      if (result.result?.success) {
        const p = result.result.data;
        const imageUrls = Array.isArray(p.images) && p.images.length ? p.images : p.image ? [p.image] : [];
        this.setData({ product: p, imageUrls, swiperIndex: 0 });
        console.log('[调试] _loadProduct - 商品加载成功:', p.name);
      } else {
        console.error('[调试] _loadProduct - 获取商品失败:', result.result?.error);
        this.setData({ product: null, imageUrls: [] });
      }
    } catch (err) {
      console.error('[调试] _loadProduct - 云函数调用失败:', err);
      this.setData({ product: null, imageUrls: [] });
    }
  },
  
  async _loadRelated(productId) {
    console.log('[调试] _loadRelated - 开始加载相关商品:', productId);
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'product',
        data: { action: 'related', productId }
      });
      
      console.log('[调试] _loadRelated - 云函数返回:', result);
      
      if (result.result?.success) {
        this.setData({ related: result.result.data || [] });
        console.log('[调试] _loadRelated - 相关商品加载成功，数量:', result.result.data?.length);
      } else {
        console.error('[调试] _loadRelated - 获取失败:', result.result?.error);
        this.setData({ related: [] });
      }
    } catch (err) {
      console.error('[调试] _loadRelated - 云函数调用失败:', err);
      this.setData({ related: [] });
    }
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
      const result = await toggleFavorite(p.id, isCollected, {
        name: p.name || p.title,
        price: p.price,
        image: p.image || (p.images && p.images[0])
      });
      
      if (result.success) {
        this.setData({ isCollected: result.isCollected });
        
        let message = result.isCollected ? '已收录至礼遇单' : '已取消收藏';
        if (result.message) {
          message = result.message === '已收藏' ? '已在礼遇单中' : '未收藏该商品';
        }
        
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
