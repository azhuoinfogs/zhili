const { STORAGE_KEYS } = require('./storage.js');
const { post } = require('./request.js');

/**
 * 与 client `track()` 一致：POST /api/event
 * @param {WechatMiniprogram.App.Instance<{ apiBase: string }>} app
 * @param {string} event
 * @param {Record<string, unknown>} [extra]
 */
function track(app, event, extra) {
  extra = extra || {};
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
  
  post('/api/event', body, { needAuth: false }).catch(() => {
    // 埋点上报失败不影响业务流程
  });
}

module.exports = { track };
