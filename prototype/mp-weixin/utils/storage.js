/** 与 prototype/client/src/App.vue STORAGE_KEYS 一致 */
const STORAGE_KEYS = {
  uid: 'zhili_vid',
  group: 'zhili_group',
  profile: 'zhili_profile',
};

function getOrCreateZhiliVid() {
  let id = wx.getStorageSync(STORAGE_KEYS.uid);
  if (!id || typeof id !== 'string') {
    id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    wx.setStorageSync(STORAGE_KEYS.uid, id);
  }
  return id;
}

function getOrCreateGroup() {
  let g = wx.getStorageSync(STORAGE_KEYS.group);
  if (g !== 'A' && g !== 'B') {
    g = Math.random() < 0.5 ? 'A' : 'B';
    wx.setStorageSync(STORAGE_KEYS.group, g);
  }
  return g;
}

function getProfile() {
  const raw = wx.getStorageSync(STORAGE_KEYS.profile);
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? raw : null;
}

function setProfile(obj) {
  wx.setStorageSync(STORAGE_KEYS.profile, JSON.stringify(obj));
}

module.exports = {
  STORAGE_KEYS,
  getOrCreateZhiliVid,
  getOrCreateGroup,
  getProfile,
  setProfile,
};
