const { getOrCreateZhiliVid, getOrCreateGroup } = require('../../utils/storage.js');
const { track } = require('../../utils/track.js');
const { wechatLogin, isLoggedIn } = require('../../utils/auth.js');

const app = getApp();

Page({
  data: {
    groupLabel: 'ATELIER B',
    refSuffix: '--------',
    loggingIn: false,
  },
  onShow() {
    const uid = getOrCreateZhiliVid();
    const g = getOrCreateGroup();
    this.setData({
      groupLabel: g === 'A' ? 'COLLECTION A' : 'ATELIER B',
      refSuffix: String(uid).slice(-8),
    });
    track(app, 'page_view', { phase: 'landing' });
  },
  async onExplore() {
    track(app, 'explore_click', {});
    
    if (isLoggedIn()) {
      wx.navigateTo({ url: '/pages/tags/tags' });
      return;
    }
    
    this.setData({ loggingIn: true });
    try {
      await wechatLogin();
      track(app, 'login_success', {});
      wx.navigateTo({ url: '/pages/tags/tags' });
    } catch (err) {
      track(app, 'login_failure', { error: err.message });
      wx.showToast({
        title: '登录失败，将以游客身份浏览',
        icon: 'none',
        duration: 2000,
      });
      wx.navigateTo({ url: '/pages/tags/tags' });
    } finally {
      this.setData({ loggingIn: false });
    }
  },
});
