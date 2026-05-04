/** 与 client fetchRecommendations 请求形状一致 */
const PAGE_SIZE = 20;

function shelfQueryFromFilters(f) {
  const q = [];
  if (f.occasion) q.push('occasion=' + encodeURIComponent(f.occasion));
  if (f.budget) q.push('budget=' + encodeURIComponent(f.budget));
  if (f.style) q.push('style=' + encodeURIComponent(f.style));
  return q.length ? '&' + q.join('&') : '';
}

function fetchRecommendChunk(opts) {
  const base = opts.base;
  const group = opts.group;
  const profile = opts.profile;
  const listFilters = opts.listFilters;
  const offset = opts.offset;
  const shelf = {
    occasion: listFilters.occasion || '',
    budget: listFilters.budget || '',
    style: listFilters.style || '',
  };
  return new Promise(function (resolve, reject) {
    if (group === 'A') {
      const qs = 'offset=' + offset + '&limit=' + PAGE_SIZE + shelfQueryFromFilters(listFilters);
      wx.request({
        url: base + '/api/hot?' + qs,
        success: function (res) {
          resolve(Array.isArray(res.data) ? res.data : []);
        },
        fail: reject,
      });
    } else {
      const data = Object.assign({}, profile, {
        shelf: shelf,
        offset: offset,
        limit: PAGE_SIZE,
      });
      wx.request({
        url: base + '/api/personalized',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: data,
        success: function (res) {
          resolve(Array.isArray(res.data) ? res.data : []);
        },
        fail: reject,
      });
    }
  });
}

module.exports = {
  fetchRecommendChunk: fetchRecommendChunk,
  PAGE_SIZE: PAGE_SIZE,
};
