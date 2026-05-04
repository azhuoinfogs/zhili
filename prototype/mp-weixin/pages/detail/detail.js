const { getProfile } = require('../../utils/storage.js');
const { track } = require('../../utils/track.js');

const app = getApp();

Page({
  data: {
    product: null,
    related: [],
    imageUrls: [],
    swiperIndex: 0,
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
    wx.request({
      url: `${base}/api/related/${encodeURIComponent(id)}?profile=${profileQ}`,
      success: (res) => {
        const list = res.statusCode === 200 && Array.isArray(res.data) ? res.data : [];
        this.setData({ related: list });
      },
      fail: () => this.setData({ related: [] }),
    });
  },
  onSwiperChange(e) {
    this.setData({ swiperIndex: e.detail.current });
  },
  onCollect() {
    const p = this.data.product;
    if (!p) return;
    track(app, 'collect', { product_id: p.id });
    wx.showToast({ title: '已收录至礼遇单', icon: 'none' });
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
