# 知礼微信小程序骨架（PRD v1.0 预览）

三页：`profile`（画像简版）→ `index`（双列推荐，A/B 与 H5 一致）→ `detail`（详情占位）。

## 使用

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 导入本项目目录 `prototype/mp-weixin`。
3. 在 `app.js` 将 `apiBase` 改为你的验证 API 地址（需 HTTPS 真机；本地可在工具内勾选「不校验合法域名」并填 `http://127.0.0.1:端口`）。
4. `project.config.json` 中 `appid` 请替换为你的测试号。

## 与 H5 对齐

- 画像字段子集与 `/api/personalized` 契约一致。
- A/B：`zhili_group` 存 `wx.storage`。

后续可接：微信登录、收藏同步、订阅消息、WebView 购买跳转（PRD F3/F4/F5）。
