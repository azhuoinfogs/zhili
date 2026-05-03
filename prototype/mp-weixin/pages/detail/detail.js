const app = getApp();

Page({
  data: { product: null },
  onLoad(q) {
    const id = q.id;
    const profile = wx.getStorageSync('zhili_profile') || {};
    const base = app.globalData.apiBase;
    wx.request({
      url: base + '/api/personalized',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: profile,
      success: (res) => {
        const list = res.data || [];
        const p = list.find((x) => x.id === id) || null;
        this.setData({ product: p });
      }
    });
  },
  onBuy() {
    wx.showToast({ title: '已记录（占位）', icon: 'none' });
  }
});
