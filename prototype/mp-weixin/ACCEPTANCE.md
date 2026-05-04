# 小程序方案 B 验收说明（对照 `develop2.md` 附录 A · 阶段 B 表 B1～B6）

本页描述 **`prototype/mp-weixin`** 与 **`prototype/client`**（`App.vue`）在 **阶段流、接口、存储键** 上的对齐程度，并映射 **`develop2.md`** 阶段 B 产品表 **B1～B6** 的验收状态。

**事实源**：`prototype/client/src/App.vue`（`landing` → `tags` → `browse`；详情为独立页 `detail`）。**工程步骤**仍以 [README.md](./README.md)「小程序开发步骤（明确版）」阶段一为准。

---

## 1. 与 client 对齐（方案 B）

| 维度 | 小程序实现 |
|------|------------|
| **阶段** | `landing` → `tags` → `browse`；详情 `pages/detail`（`wx.navigateTo`） |
| **存储键** | `zhili_vid`、`zhili_group`、`zhili_profile`（画像为 **JSON 字符串**，与 H5 `localStorage` 一致） |
| **列表** | A：`GET /api/hot?occasion&budget&style&offset&limit`；B：`POST /api/personalized`，Body 含画像字段 + **`shelf`** + **`offset`/`limit`**（`utils/fetchList.js`） |
| **详情** | `GET /api/product/:id?profile=<encodeURIComponent(JSON)>`（与 B5 / client 一致） |
| **相关** | `GET /api/related/:id?profile=...` |
| **埋点** | `POST /api/collect`（`utils/track.js`，字段：`event`、`user_id`、`group`、`page_name`、`timestamp` 及扩展字段） |
| **筛选** | 列表页顶筛 **500ms debounce** 后整表重拉；**下拉刷新**（`onPullDownRefresh` + `pull_refresh`）；**触底**分页（`onReachBottom`，`PAGE_SIZE=20`） |
| **画像表单** | 与 client 枚举一致：`relation` / `ageBand` / `gender` / `occasion` / `budget` / `style` / `interests`（≤3）/ `taboos` |

---

## 2. 阶段 B 表（B1～B6）映射

| 项 | develop2 含义（摘要） | 本小程序当前状态 |
|---|----------------------|------------------|
| **B1** | 微信登录、`POST /api/user/login`、`Bearer` | **未接线**：仍匿名 **`zhili_vid`**；未调用 `wx.login` 存 `token`。 |
| **B2** | 画像 CRUD、`/api/profile*`、登录隔离 | **仅本地**：`zhili_profile` 写 `Storage`，**未**同步 **`/api/profile*`**。 |
| **B3** | 登录后默认画像驱动推荐（`GET /api/user/recommend` 等） | **未使用**：列表仍走 **匿名** `hot` / `personalized`（与 client 匿名路径一致）。 |
| **B4** | `GET /api/recommend`、Redis 网关 | **未使用**。 |
| **B5** | `GET /api/product/:id`、`profile` Query、读模型一致 | **已接线**：详情页 **`GET /api/product/:id?profile=...`**；多图 swiper、理由行、相关推荐入口。 |
| **B6** | `POST/DELETE /api/favorite`、`GET /api/favorite/list` | **未接线**：「收录礼遇单」仅 **`collect` 事件 `collect`** + Toast，**未**调 favorite API。 |

**B7（埋点入库）**：小程序发 **`POST /api/collect`**；是否落 **`event` 表** 取决于服务端 **`EVENT_DB_DUAL_WRITE`** 等配置，见 `develop2` §9.8。

---

## 3. 阶段一（README 步骤 12）操作建议

1. 启动 **`prototype/server`**，配置 **`app.js`** 的 **`globalData.apiBase`**。  
2. 模拟器：**首页** → **探索商品** → **偏好与场景** 提交 → **礼遇名录**；点卡片进 **详情**。  
3. **Storage** 中应出现 **`zhili_vid`**、**`zhili_group`**、**`zhili_profile`**（字符串）。

---

## 4. 后续 PRD 扩展（与 README 阶段三一致）

优先顺序仍建议：**B1 登录** → **B6 收藏 API** → **B2 画像同步**；若产品要求列表走网关，再接 **B4 `GET /api/recommend`**。
