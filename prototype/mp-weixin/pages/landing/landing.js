const { getOrCreateZhiliVid, getOrCreateGroup } = require('../../utils/storage.js');
const { track } = require('../../utils/track.js');

const app = getApp();

Page({
  data: {
    groupLabel: 'ATELIER B',
    refSuffix: '--------',
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
  onExplore() {
    track(app, 'explore_click', {});
    wx.navigateTo({ url: '/pages/tags/tags' });
  },
});
