const { getOrCreateGroup, getProfile } = require('../../utils/storage.js');
const { track } = require('../../utils/track.js');
const { fetchRecommendChunk, PAGE_SIZE } = require('../../utils/fetchList.js');

const app = getApp();

const OCC_LABELS = ['全部', '生日', '纪念日', '节日', '感谢', '道歉', '无理由'];
const OCC_VALUES = ['', 'birthday', 'anniversary', 'festival', 'thanks', 'apology', 'casual'];

const BUD_LABELS = ['全部', '<100', '100–300', '300–500', '500–1000', '1000+'];
const BUD_VALUES = ['', 'lt100', '100-300', '300-500', '500-1000', '1000+'];

const STYLE_LABELS = ['全部', '实用', '仪式', '搞怪', '温情'];
const STYLE_VALUES = ['', 'practical', 'ritual', 'quirky', 'warm'];

Page({
  data: {
    group: 'B',
    groupMeta: '个性化策展序列',
    products: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    listFilters: { occasion: '', budget: '', style: '' },
    profile: null,
    OCC_LABELS,
    occFIndex: 0,
    BUD_LABELS,
    budFIndex: 0,
    STYLE_LABELS,
    styleFIndex: 0,
  },
  _debounceTimer: null,
  _loadMoreLock: false,

  onLoad() {
    const profile = getProfile();
    if (!profile || typeof profile !== 'object') {
      this.setData({ loading: false });
      wx.showToast({ title: '请先完成偏好', icon: 'none' });
      setTimeout(() => wx.redirectTo({ url: '/pages/tags/tags' }), 400);
      return;
    }
    const g = getOrCreateGroup();
    const lf = {
      occasion: profile.occasion || '',
      budget: profile.budget || '',
      style: profile.style || '',
    };
    this.setData({
      group: g,
      groupMeta: g === 'A' ? '典藏热门序列' : '个性化策展序列',
      listFilters: lf,
      profile,
      occFIndex: Math.max(0, OCC_VALUES.indexOf(lf.occasion)),
      budFIndex: Math.max(0, BUD_VALUES.indexOf(lf.budget)),
      styleFIndex: Math.max(0, STYLE_VALUES.indexOf(lf.style)),
    });
    this._fetchRecommendations(true);
  },

  onUnload() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  },

  backToTags() {
    wx.navigateTo({ url: '/pages/tags/tags' });
  },

  onOccFilter(e) {
    const i = Number(e.detail.value);
    const occasion = OCC_VALUES[i] || '';
    this.setData({
      listFilters: { ...this.data.listFilters, occasion },
      occFIndex: i,
    });
    this._scheduleRefetch();
  },
  onBudFilter(e) {
    const i = Number(e.detail.value);
    const budget = BUD_VALUES[i] || '';
    this.setData({
      listFilters: { ...this.data.listFilters, budget },
      budFIndex: i,
    });
    this._scheduleRefetch();
  },
  onStyleFilter(e) {
    const i = Number(e.detail.value);
    const style = STYLE_VALUES[i] || '';
    this.setData({
      listFilters: { ...this.data.listFilters, style },
      styleFIndex: i,
    });
    this._scheduleRefetch();
  },

  clearListFilters() {
    this.setData({
      listFilters: { occasion: '', budget: '', style: '' },
      occFIndex: 0,
      budFIndex: 0,
      styleFIndex: 0,
    });
    this._scheduleRefetch();
  },

  _scheduleRefetch() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._fetchRecommendations(true);
    }, 500);
  },

  _fetchRecommendations(reset) {
    const { group, profile, listFilters, products, loading, loadingMore, hasMore } = this.data;
    if (!profile || !listFilters) return Promise.resolve();

    if (reset) {
      this.setData({ loading: true, hasMore: true, products: [] });
    } else {
      if (!hasMore || loadingMore || loading) return Promise.resolve();
      this.setData({ loadingMore: true });
    }

    const offset = reset ? 0 : products.length;
    const base = app.globalData.apiBase;

    return fetchRecommendChunk({ base, group, profile, listFilters, offset })
      .then((chunk) => {
        const next = reset ? chunk : this.data.products.concat(chunk);
        this.setData({
          products: next,
          hasMore: chunk.length >= PAGE_SIZE,
          loading: false,
          loadingMore: false,
        });
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
        this.setData({ loading: false, loadingMore: false });
      })
      .then(function () {
        if (reset) wx.stopPullDownRefresh();
      });
  },

  onPullDownRefresh() {
    track(app, 'pull_refresh', {});
    this._fetchRecommendations(true);
  },

  onReachBottom() {
    this._loadMore();
  },

  async _loadMore() {
    if (this._loadMoreLock) return;
    const { hasMore, loadingMore, loading } = this.data;
    if (!hasMore || loadingMore || loading) return;
    this._loadMoreLock = true;
    try {
      await this._fetchRecommendations(false);
    } finally {
      this._loadMoreLock = false;
    }
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const pos = e.currentTarget.dataset.pos;
    track(app, 'click', { product_id: id, position: Number(pos) });
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(id)}` });
  },
});
