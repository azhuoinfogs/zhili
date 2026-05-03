const AGE_KEYS = ['18-25', '26-35', '36-45'];
const OCC_KEYS = ['birthday', 'festival', 'thanks'];
const BUD_KEYS = ['lt100', '100-300', '300-500'];

Page({
  data: {
    ageLabels: ['18–25', '26–35', '36–45'],
    ageIndex: 1,
    occLabels: ['生日', '节日', '感谢'],
    occIndex: 0,
    budLabels: ['<100', '100–300', '300–500'],
    budIndex: 1
  },
  onAge(e) {
    this.setData({ ageIndex: Number(e.detail.value) });
  },
  onOcc(e) {
    this.setData({ occIndex: Number(e.detail.value) });
  },
  onBud(e) {
    this.setData({ budIndex: Number(e.detail.value) });
  },
  goIndex() {
    const profile = {
      ageBand: AGE_KEYS[this.data.ageIndex],
      occasion: OCC_KEYS[this.data.occIndex],
      budget: BUD_KEYS[this.data.budIndex],
      interests: [],
      gender: 'unknown',
      style: 'practical',
      taboos: [],
      relation: 'friend'
    };
    wx.setStorageSync('zhili_profile', profile);
    wx.navigateTo({ url: '/pages/index/index' });
  }
});
