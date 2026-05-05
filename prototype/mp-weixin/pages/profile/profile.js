const { getProfile, getOrCreateZhiliVid, getOrCreateGroup } = require('../../utils/storage.js');
const { track } = require('../../utils/track.js');
const { getFavoriteList, removeFavorite } = require('../../utils/favorite.js');

const app = getApp();

const relationLabels = {
  partner: '伴侣',
  family: '家人',
  friend: '朋友',
  colleague: '同事',
  elder: '长辈',
  teacher: '老师',
  client: '客户',
  other: '其他'
};

const occasionLabels = {
  birthday: '生日',
  anniversary: '纪念日',
  festival: '节日',
  thanks: '感谢',
  apology: '道歉',
  casual: '无理由'
};

const budgetLabels = {
  lt100: '<100',
  '100-300': '100-300',
  '300-500': '300-500',
  '500-1000': '500-1000',
  '1000+': '1000+'
};

const styleLabels = {
  practical: '实用',
  ritual: '仪式',
  quirky: '搞怪',
  warm: '温情'
};

const interestOptions = [
  { v: 'tech', l: '科技数码' },
  { v: 'art', l: '文艺生活' },
  { v: 'outdoor', l: '户外运动' },
  { v: 'beauty', l: '美妆护肤' },
  { v: 'home', l: '居家宅人' },
  { v: 'fashion', l: '时尚穿搭' },
  { v: 'food', l: '美食美酒' },
  { v: 'health', l: '健康养生' },
  { v: 'office', l: '职场办公' },
  { v: 'parent', l: '母婴亲子' }
];

Page({
  data: {
    userId: '',
    group: '',
    groupLabel: '',
    favorites: [],
    favoritesLoading: false,
    profile: null,
    activeTab: 'favorites',
    relationLabels,
    occasionLabels,
    budgetLabels,
    styleLabels,
    interestOptions
  },

  onLoad() {
    const uid = getOrCreateZhiliVid();
    const g = getOrCreateGroup();
    const profile = getProfile();
    this.setData({
      userId: uid,
      group: g,
      groupLabel: g === 'A' ? 'COLLECTION A' : 'ATELIER B',
      profile
    });
    track(app, 'page_view', { phase: 'profile' });
    this.fetchFavorites();
  },

  onShow() {
    this.fetchFavorites();
  },

  async fetchFavorites() {
    this.setData({ favoritesLoading: true });
    try {
      const { list } = await getFavoriteList();
      this.setData({ favorites: list || [] });
    } catch (err) {
      console.warn('获取收藏失败:', err.message);
      this.setData({ favorites: [] });
    } finally {
      this.setData({ favoritesLoading: false });
    }
  },

  async removeFavoriteItem(e) {
    const productId = e.currentTarget.dataset.productId;
    try {
      await removeFavorite(productId);
      await this.fetchFavorites();
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  goToBrowse() {
    wx.switchTab({ url: '/pages/browse/browse' });
  },

  goToTags() {
    wx.navigateTo({ url: '/pages/tags/tags' });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(id)}` });
  },

  getInterestLabels(interests) {
    if (!interests || !interests.length) return '未设置';
    return interests.map(i => {
      const opt = interestOptions.find(o => o.v === i);
      return opt ? opt.l : i;
    }).join(', ');
  },

  getGenderLabel(gender) {
    if (gender === 'female') return '女';
    if (gender === 'male') return '男';
    return '未知/通用';
  }
});
