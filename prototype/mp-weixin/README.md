# 知礼微信小程序骨架（PRD v1.0 预览）

三页：`profile`（画像简版）→ `index`（双列推荐，A/B 与 H5 一致）→ `detail`（详情占位）。

**工程级契约（接口、筛选参数、埋点事件名、与 H5 差异）以仓库根目录 [`prototype-spec.md`](../../prototype-spec.md) 为准**；本文件侧重小程序侧导入与开发习惯。

---

## 使用

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 导入本项目目录 **`prototype/mp-weixin`**。
3. 在 `app.js` 将 `globalData.apiBase` 改为你的验证 API 根地址（**不含**路径后缀；需 HTTPS 真机调试。本地可在工具 **详情 → 本地设置** 勾选「不校验合法域名」并填 `http://127.0.0.1:端口`）。
4. `project.config.json` 中 `appid` 请替换为你的测试号。

---

## 与 H5、文档对齐

| 项 | 说明 |
|----|------|
| API | 与 `prototype/server` 一致：`GET /api/hot`、`POST /api/personalized`（Query / Body 中的 `occasion`、`budget`、`style` 与 **prototype-spec §3** 一致） |
| 本地存储 | `zhili_group`（A/B）、`zhili_profile`（画像 JSON），与 H5 `localStorage` 键名一致，便于同一用户在两端的实验说明（实际是否同设备需自行约定） |
| 匿名用户 id | H5 使用 `zhili_vid` 并随埋点上报；小程序骨架当前未强制写入，接入 **`POST /api/collect`** 时建议生成并持久化 `zhili_vid`，字段名与 H5 一致 |
| 视觉 | **正式小程序遵循 PRD §5.2**（主色 `#FF6B6B`、浅底、圆角等）；本骨架样式为占位，与验证 H5 深色主题无强制一致 |

H5 实现说明见 [**`prototype-client-App-vue.md`**](../../prototype-client-App-vue.md)；产品功能清单见 [**`prd_v0.md`**](../../prd_v0.md)。

---

## 后续可接（PRD）

微信登录、收藏同步、订阅消息、WebView 购买跳转（PRD F3 / F4 / F5）、与 H5 一致的完整埋点链路。
