# 小程序方案 B 验收说明（`develop2.md` 对齐）

本文说明 **`prototype/mp-weixin`** 与 **`prototype/client`**（`App.vue`）在 **阶段流、接口、存储键** 上的对齐程度。

**重要**：**`develop2.md` 中有两套「B1～B6」**——**§9.1 后端里程碑**（微信登录、画像 CRUD、`/api/product`、`/api/favorite` 等）与 **附录 A §三「阶段 B」PRD 分项表**（视觉、F1、F2…）。**勿混用**。下文 **§2** 为 **§9.1**；**§3** 为 **附录 A PRD 阶段 B**。

**事实源**：`prototype/client/src/App.vue`（`landing` → `tags` → `browse`；详情为独立页 `detail`）。**工程步骤**见 [README.md](./README.md)「小程序开发步骤（明确版）」阶段一。

---

## 1. 与 client 对齐（方案 B）

| 维度 | 小程序实现 |
|------|------------|
| **阶段** | `landing` → `tags` → `browse`；详情 `pages/detail`（`wx.navigateTo`） |
| **存储键** | `zhili_vid`、`zhili_group`、`zhili_profile`（画像为 **JSON 字符串**，与 H5 `localStorage` 一致） |
| **列表** | A：`GET /api/hot?occasion&budget&style&offset&limit`；B：`POST /api/personalized`，Body 含画像字段 + **`shelf`** + **`offset`/`limit`**（`utils/fetchList.js`） |
| **详情** | `GET /api/product/:id?profile=<encodeURIComponent(JSON)>`（与 **§9.1 后端 B5** / client 一致） |
| **相关** | `GET /api/related/:id?profile=...` |
| **埋点** | `POST /api/collect`（`utils/track.js`，字段：`event`、`user_id`、`group`、`page_name`、`timestamp` 及扩展字段） |
| **筛选** | 列表页顶筛 **500ms debounce** 后整表重拉；**下拉刷新**（`onPullDownRefresh` + `pull_refresh`）；**触底**分页（`onReachBottom`，`PAGE_SIZE=20`） |
| **画像表单** | 与 client 枚举一致：`relation` / `ageBand` / `gender` / `occasion` / `budget` / `style` / `interests`（≤3）/ `taboos` |

---

## 2. `develop2.md` §9.1 后端里程碑（B1～B6）与小程序

| 项 | develop2 / api.md 含义（摘要） | 本小程序当前状态 |
|---|----------------------|------------------|
| **B1** | 微信登录、`POST /api/user/login`、`Bearer` | **未接线**：仍匿名 **`zhili_vid`**；未调用 `wx.login` 存 `token`。 |
| **B2** | 画像 CRUD、`/api/profile*`、登录隔离 | **仅本地**：`zhili_profile` 写 `Storage`，**未**同步 **`/api/profile*`**。 |
| **B3** | 登录后默认画像驱动推荐（`GET /api/user/recommend` 等） | **未使用**：列表仍走 **匿名** `hot` / `personalized`（与 client 匿名路径一致）。 |
| **B4** | `GET /api/recommend`、Redis 网关 | **未使用**。 |
| **B5** | `GET /api/product/:id`、`profile` Query、读模型一致 | **已接线**：详情页 **`GET /api/product/:id?profile=...`**；多图 swiper、理由行、相关推荐入口。 |
| **B6** | `POST/DELETE /api/favorite`、`GET /api/favorite/list` | **未接线**：「收录礼遇单」仅 **`collect` 事件 `collect`** + Toast，**未**调 favorite API。 |

**B7（埋点入库）**：小程序发 **`POST /api/collect`**；是否落 **`event` 表** 取决于服务端 **`EVENT_DB_DUAL_WRITE`** 等配置，见 `develop2` §9.8。

---

## 3. `develop2.md` 附录 A §三「阶段 B」（PRD 分项 B1～B6）与小程序

下表对应 **附录 A** 阶段 B 产品表（**非 §9.1**）。

| 附录 A B# | 任务（develop2 原文摘要） | 本小程序 |
|-----------|---------------------------|----------|
| **B1** | 视觉规范 §5.2（色板、间距、主按钮等） | **部分**：深色顶栏 + 与 H5 验证端一致的礼遇色板（`app.wxss`）；**未**做 PRD §5.2 **浅色正式稿**与完整设计走查。 |
| **B2** | F1 与 H5 字段一致 + 可选多画像（`wx.storage`） | **F1 单路径**：`tags` 与 H5 枚举一致；**无**多画像列表/切换。 |
| **B3** | F2 双列 + 筛选防抖 + 刷新/分页 | **已对齐**：双列、顶筛、**500ms debounce**、**下拉刷新**、**触底分页**、与 **hot/personalized** 契约一致。 |
| **B4** | F3 轮播、理由、底部收藏+去购买、合规文案 | **大部分**：多图轮播、理由、相关推荐、**收录/购买**占位 + **`collect`**；**收藏未走 `/api/favorite*`**；**未**单独做「离开提示」等合规长文案页。 |
| **B5** | F6 登录 + 游客 | **仅游客路径**：`zhili_vid` / `group`；**未**接登录。 |
| **B6** | `zhili_vid` + `/api/collect` 全链路 | **`zhili_vid`** 已生成并写入 **`collect`** 的 **`user_id`**；事件名与 client 对齐（如 **`page_view`**、**`pull_refresh`**、**`click`** 等）。 |

---

## 4. 阶段一（README 步骤 12）操作建议

1. 启动 **`prototype/server`**，配置 **`app.js`** 的 **`globalData.apiBase`**。  
2. 模拟器：**首页** → **探索商品** → **偏好与场景** 提交 → **礼遇名录**；点卡片进 **详情**。  
3. **Storage** 中应出现 **`zhili_vid`**、**`zhili_group`**、**`zhili_profile`**（字符串）。

---

## 5. 后续 PRD 扩展（与 README 阶段三一致）

优先顺序仍建议：**§9.1 B1 登录** → **§9.1 B6 收藏 API** → **§9.1 B2 画像同步**；若产品要求列表走网关，再接 **§9.1 B4 `GET /api/recommend`**。
