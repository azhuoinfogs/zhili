# 知礼 · 前置验证工程规格（prototype）

本文档与 [`plan0.md`](plan0.md)（验证流程）、[`prd_v0.md`](prd_v0.md)（产品需求）对齐，描述本仓库 **`prototype/`** 目录下的可运行实现。PRD 中小程序正式稿的视觉以 **PRD §5.2**（浅色、主色 `#FF6B6B` 等）为准；本 H5 验证端为便于传播与 A/B 实验，采用 **深色「礼遇艺廊」主题**（参考 UI/UX Pro Max 奢侈品电商方向），字段与接口与 PRD 一致。

**与仓库同步（快照）**：2026-05-04 — H5/API/算法/埋点路径与下文一致；**`products.json` 商品条数：200**；列表支持 **下拉刷新、触底分页**；详情 **多图 + 类似推荐** 见 API。**MVP B1**：`POST /api/user/login`、`GET /api/user/me`（JWT）；详见 **`server/.env.example`** 与 [prototype/README.md](prototype/README.md)「B1」。**B2 进度**：**`user_profile` 表**已与 **`personalized`/scoring** 列对齐（**策略 A**，`migrations/001`+`002`，`npm run migrate` 自动升级旧库）。**`/api/profile*`** REST 规格见 **[develop2.md](develop2.md) §9.3** 与 **[api.md](../api.md) §8.1**，**尚未在 §3 表实现**。整体排期与 PRD 分项见 **[develop2.md](develop2.md)**（篇首「当前开发状态」+ **附录 A**）。

---

## 1. 目录结构

| 路径 | 说明 |
|------|------|
| `prototype/server/` | Node + Express：商品池、`/api`、埋点落盘、打分（`scoring.js`） |
| `prototype/client/` | Vue 3 + Vite：首屏 / 画像 / 推荐流 / 详情 |
| `prototype/scripts/` | 商品池生成脚本等 |
| `prototype/docs/` | 实验跑数说明等 |

---

## 2. 页面与状态（H5）

| 阶段 `phase` | 用户任务 | 与 plan0 的对应 |
|--------------|----------|------------------|
| `landing` | 品牌首屏，点击「探索商品」 | 验证用增步；plan0 最小三屏可从画像起，本仓库增加落地引导 |
| `tags` | 收礼人画像与标签（关系、年龄、性别、场合、预算、风格、兴趣≤3、禁忌） | 对应 plan0 **第一屏·画像表单** |
| `browse` | 双列推荐流 + 顶部筛选（防抖 500ms） | 对应 plan0 **第二屏·推荐列表** |
| 详情 | 底部抽屉：理由、收藏、去购买 | 对应 plan0 **第三屏·详情** |

A/B：`localStorage.zhili_group` 为 `A`（热门 `GET /api/hot`）或 `B`（个性化 `POST /api/personalized`）。

用户标识：`localStorage.zhili_vid`。画像缓存：`localStorage.zhili_profile`（提交后写入）。

---

## 3. HTTP API（`prototype/server`）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查；含 **`database`** / **`redis`** / **`db_product_count`**；**`auth_configured`**（微信或 `WECHAT_MOCK`）、**`jwt_strong_secret`**（是否已换默认 JWT 密钥） |
| `POST` | `/api/user/login` | **B1** 微信登录；Body：`{ "code", "anon_id"?, "zhili_vid"? }`；返回 `token`、`expires_in`、`user`；需 MySQL；本地可 **`WECHAT_MOCK=1`** |
| `GET` | `/api/user/me` | **B1** 当前用户；Header：`Authorization: Bearer <token>` |
| `GET` | `/api/hot` | 对照组；Query：`occasion`、`budget`、`style`；**`offset`（默认 0）、`limit`（默认 20，最大 50）** 分页 |
| `POST` | `/api/personalized` | 实验组；Body：画像字段 + `shelf` + **`offset` / `limit`**（同上） |
| `GET` | `/api/related/:id` | 类似推荐；Query：可选 **`profile`**（JSON 字符串，与 `personalized` 画像一致时理由更准） |
| `POST` | `/api/collect` | 埋点上报（JSON 单行事件） |
| `GET` | `/api/export/events.csv` | 导出事件 |

**规划中（B2）**：`POST`/`GET`/`PUT` **`/api/profile`** 等路由见 [develop2.md](../develop2.md) **§9.3**、[api.md](../api.md) **§8.1**；上线前 H5 画像仍以 **`localStorage.zhili_profile`** 提交 **`/api/personalized`**。

打分与理由模板见 PRD **§4.3 / §4.4**，实现见 `prototype/server/scoring.js`。列表/详情商品对象含 **`image`**（首图）与 **`images`**（多图 URL 数组，至少 3 张由服务端生成）。

---

## 4. 前端代理与端口

- API 默认从 `PORT`（未设置则为 **3000**）起监听；若占用则顺延（见 `prototype/README.md`），并将实际端口写入 **`prototype/server/.listen-port`**。
- Vite 开发服务器默认 **5173**，将 `/api` 代理到 **`VITE_API_TARGET`**；未设置时读取 `../server/.listen-port`，否则 `http://127.0.0.1:3000`。详见 `prototype/client/vite.config.js`。

---

## 5. 埋点事件（与实现对齐）

| 事件 | 时机 | 主要字段 |
|------|------|----------|
| `page_view` | 应用挂载 | `user_id`, `group`, `page_name`, `timestamp` |
| `explore_click` | 首屏点击「探索商品」 | 同上 |
| `pull_refresh` | 列表页顶部下拉松手刷新 | 同上 |
| `form_submit` | 提交画像并进入推荐流 | 画像字段 |
| `impression` | 卡片约 40% 可见 | `product_id`, `position` |
| `click` | 打开详情 | `product_id`, `position` |
| `collect` | 收藏 | `product_id` |
| `purchase_click` | 去购买 | `product_id` |

持久化：`prototype/server/data/events.jsonl`（每行一条 JSON）。

---

## 6. 相关文档

- **整合开发计划（推荐）**：**[`develop2.md`](develop2.md)**（含 **附录 A**：PRD 分项与 H5 阶段 A–E；原 develop.md / develop1 已废止）
- 接口契约详表：**[`api.md`](../api.md)**
- 启动与踩坑：**[`prototype/README.md`](prototype/README.md)**
- 验证阶段与指标：**[`plan0.md`](plan0.md)**
- 产品功能与正式端视觉：**[`prd_v0.md`](prd_v0.md)**
- Vue 单文件说明：**[`prototype-client-App-vue.md`](prototype-client-App-vue.md)**
- 微信小程序骨架（与 H5 共用 API 契约）：**[`prototype/mp-weixin/README.md`](prototype/mp-weixin/README.md)**
