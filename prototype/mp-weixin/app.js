App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d5g4riq00201609a1'
      });
      console.log('云开发初始化成功');
    }
  },
  globalData: {
    apiBase: 'http://127.0.0.1:3000'
  }
});
