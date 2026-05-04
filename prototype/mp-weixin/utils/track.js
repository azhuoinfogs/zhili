const { STORAGE_KEYS } = require('./storage.js');

/**
 * 与 client `track()` 一致：POST /api/collect
 * @param {WechatMiniprogram.App.Instance<{ apiBase: string }>} app
 * @param {string} event
 * @param {Record<string, unknown>} [extra]
 */
function track(app, event, extra) {
  extra = extra || {};
  const base = app.globalData.apiBase;
  if (!base) return;
  const userId = wx.getStorageSync(STORAGE_KEYS.uid) || '';
  const group = wx.getStorageSync(STORAGE_KEYS.group) || '';
  const body = {
    event: event,
    user_id: userId,
    group: group,
    page_name: 'zhili_luxury',
    timestamp: Date.now(),
  };
  Object.assign(body, extra);
  wx.request({
    url: base + '/api/collect',
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: body,
    fail: function () {},
  });
}

module.exports = { track };
