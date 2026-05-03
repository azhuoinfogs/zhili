# 知礼 H5 验证端 · Vue 实现说明

完整界面与交互集中在单文件：

**[`prototype/client/src/App.vue`](prototype/client/src/App.vue)**

（`plan0.md` 中曾示例「Form / RecommendList / DetailModal」拆分；本仓库为最小迭代，合并为同一 SFC，便于改样式与实验。）

---

## 1. 技术栈

- Vue 3（`<script setup>`）+ Vite 5  
- 全局样式：`prototype/client/src/style.css`  
- 入口：`prototype/client/src/main.js`、`index.html`（含展示字体）

与 `plan0.md` 阶段 2 中「CDN + Vant」的轻量方案不同：本工程使用 **构建型 Vue**，便于组件化演进与代理配置。

---

## 2. 核心状态

| 名称 | 作用 |
|------|------|
| `phase` | `'landing' \| 'tags' \| 'browse'` 控制三屏 |
| `form` | 画像表单（关系、年龄、性别、场合、预算、风格、兴趣、禁忌） |
| `listFilters` | 列表页场合 / 预算 / 风格（`watch` + 500ms 防抖请求） |
| `group` / `userId` | A/B 与匿名用户 id（localStorage） |
| `products` / `loading` | 推荐列表数据 |
| `modalProduct` | 当前详情抽屉商品 |

推荐请求：`group === 'A'` → `GET /api/hot`；否则 `POST /api/personalized`（body 含 `shelf` 与画像）。

---

## 3. 埋点

统一函数 `track(event, extra)` → `POST /api/collect`。`page_name` 固定为 `zhili_luxury`。

事件清单见 **[`prototype-spec.md`](prototype-spec.md) §5**。

---

## 4. 与 PRD 的差异（已知）

| PRD 项 | 本 H5 验证端 |
|--------|----------------|
| §5.2 浅色品牌色、8px/16px 圆角 | 深色「艺廊」主题、直角/小圆角为主 |
| F2 首页即推荐流 | 增加 `landing`，再进入画像与列表 |
| F3 多图轮播 | 单主图 + 理由卡片 |
| 下拉刷新 / 上拉更多 | 未实现（可按 plan0 后续加） |

正式微信小程序开发时，应以 **PRD §5.2 / F1–F3** 为准；算法与字段与本 prototype 对齐即可。

小程序骨架导入与存储键说明：**[`prototype/mp-weixin/README.md`](prototype/mp-weixin/README.md)**。
