const { setProfile } = require('../../utils/storage.js');
const { track } = require('../../utils/track.js');

const app = getApp();

const REL_KEYS = ['partner', 'family', 'friend', 'colleague', 'elder', 'teacher', 'client', 'other'];
const REL_LABELS = ['伴侣', '家人', '朋友', '同事', '长辈', '老师', '客户', '其他'];

const AGE_KEYS = ['under18', '18-25', '26-35', '36-45', '46plus'];
const AGE_LABELS = ['<18', '18–25', '26–35', '36–45', '46+'];

const GENDER_KEYS = ['unknown', 'female', 'male'];
const GENDER_LABELS = ['未知 / 通用', '女', '男'];

const OCC_KEYS = ['birthday', 'anniversary', 'festival', 'thanks', 'apology', 'casual'];
const OCC_LABELS = ['生日', '纪念日', '节日', '感谢', '道歉', '无理由'];

const BUD_KEYS = ['lt100', '100-300', '300-500', '500-1000', '1000+'];
const BUD_LABELS = ['<100', '100–300', '300–500', '500–1000', '1000+'];

const STYLE_KEYS = ['practical', 'ritual', 'quirky', 'warm'];
const STYLE_LABELS = ['实用', '仪式', '搞怪', '温情'];

const INTEREST_OPTIONS = [
  { v: 'tech', l: '科技数码' },
  { v: 'art', l: '文艺生活' },
  { v: 'outdoor', l: '户外运动' },
  { v: 'beauty', l: '美妆护肤' },
  { v: 'home', l: '居家宅人' },
  { v: 'fashion', l: '时尚穿搭' },
  { v: 'food', l: '美食美酒' },
  { v: 'health', l: '健康养生' },
  { v: 'office', l: '职场办公' },
  { v: 'parent', l: '母婴亲子' },
];

function profilePayloadFromForm(d) {
  const interests = d.interests || [];
  const taboos = d.taboos || [];
  return {
    relation: REL_KEYS[d.relIndex] || 'friend',
    ageBand: AGE_KEYS[d.ageIndex] || '26-35',
    interests: [...interests],
    occasion: OCC_KEYS[d.occIndex] || 'birthday',
    budget: BUD_KEYS[d.budIndex] || '100-300',
    gender: GENDER_KEYS[d.genderIndex] || 'unknown',
    style: STYLE_KEYS[d.styleIndex] || 'practical',
    taboos: taboos.length ? [...taboos] : [],
  };
}

Page({
  data: {
    REL_LABELS,
    relIndex: 2,
    AGE_LABELS,
    ageIndex: 2,
    GENDER_LABELS,
    genderIndex: 0,
    OCC_LABELS,
    occIndex: 0,
    BUD_LABELS,
    budIndex: 1,
    STYLE_LABELS,
    styleIndex: 0,
    INTEREST_OPTIONS,
    interests: [],
    taboos: [],
  },
  onRel(e) {
    this.setData({ relIndex: Number(e.detail.value) });
  },
  onAge(e) {
    this.setData({ ageIndex: Number(e.detail.value) });
  },
  onGender(e) {
    this.setData({ genderIndex: Number(e.detail.value) });
  },
  onOcc(e) {
    this.setData({ occIndex: Number(e.detail.value) });
  },
  onBud(e) {
    this.setData({ budIndex: Number(e.detail.value) });
  },
  onStyle(e) {
    this.setData({ styleIndex: Number(e.detail.value) });
  },
  toggleInterest(e) {
    const v = e.currentTarget.dataset.v;
    const interests = [...this.data.interests];
    const i = interests.indexOf(v);
    if (i >= 0) interests.splice(i, 1);
    else if (interests.length < 3) interests.push(v);
    else {
      wx.showToast({ title: '兴趣最多选 3 个', icon: 'none' });
      return;
    }
    this.setData({ interests });
  },
  toggleTaboo(e) {
    const v = e.currentTarget.dataset.code;
    const taboos = [...this.data.taboos];
    const i = taboos.indexOf(v);
    if (i >= 0) taboos.splice(i, 1);
    else taboos.push(v);
    this.setData({ taboos });
  },
  backToHome() {
    wx.navigateBack();
  },
  submitTags() {
    const payload = profilePayloadFromForm(this.data);
    track(app, 'form_submit', { ...payload });
    setProfile(payload);
    wx.switchTab({ url: '/pages/browse/browse' });
  },
});
