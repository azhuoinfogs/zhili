const app = getApp();

function pickGroup() {
  let g = wx.getStorageSync('zhili_group');
  if (g !== 'A' && g !== 'B') {
    g = Math.random() < 0.5 ? 'A' : 'B';
    wx.setStorageSync('zhili_group', g);
  }
  return g;
}

Page({
  data: { products: [], loading: true },
  onLoad() {
    const group = pickGroup();
    const profile = wx.getStorageSync('zhili_profile') || {
      ageBand: '26-35',
      occasion: 'birthday',
      budget: '100-300',
      interests: [],
      gender: 'unknown',
      style: 'practical',
      taboos: [],
      relation: 'friend'
    };
    const base = app.globalData.apiBase;
    this.setData({ loading: true });
    if (group === 'A') {
      wx.request({
        url: base + '/api/hot',
        success: (res) => this.setData({ products: res.data || [], loading: false }),
        fail: () => {
          wx.showToast({ title: '网络错误', icon: 'none' });
          this.setData({ loading: false });
        }
      });
    } else {
      wx.request({
        url: base + '/api/personalized',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: profile,
        success: (res) => this.setData({ products: res.data || [], loading: false }),
        fail: () => {
          wx.showToast({ title: '网络错误', icon: 'none' });
          this.setData({ loading: false });
        }
      });
    }
  },
  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  }
});
