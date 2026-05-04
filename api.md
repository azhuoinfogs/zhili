# 知礼 · 接口开发文档（`prototype/server`）

**依据**：[develop2.md](develop2.md)（整合计划 §6～§9、§7.1 路径约定）与仓库当前实现。  
**范围**：验证端 **已落地** 的 HTTP 接口；MVP 后续端点见文末「规划中」。

---

## 1. 通用约定

| 项 | 说明 |
|----|------|
| **Base URL** | 默认 `http://127.0.0.1:3000`；`PORT` 未占用则顺延，实际端口见 `prototype/server/.listen-port`（详见 [prototype/README.md](prototype/README.md)） |
| **前缀** | 除导出 CSV 外，业务接口均在 **`/api`** 下 |
| **JSON** | `Content-Type: application/json`；请求体上限约 **256KB** |
| **CORS** | 开发态已开启，跨域按部署环境自行收紧 |
| **鉴权** | 仅 **`GET /api/user/me`** 要求 **`Authorization: Bearer <JWT>`**；其余当前路由不要求登录 |

### 1.1 重要：埋点与收藏路径（develop2 §7.1）

| 路径 | 用途 |
|------|------|
| **`POST /api/collect`** | **仅埋点**上报，写入 `events.jsonl` / 同步 CSV |
| **业务收藏** | **未实现**；MVP 约定为 **`POST/DELETE /api/favorite`、`GET /api/favorite/list`**，**禁止**占用 `/api/collect` |

---

## 2. 端点一览（已实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查（商品数、DB/Redis、`auth_configured`、`jwt_strong_secret`） |
| `POST` | `/api/user/login` | B1：微信 `code` 换会话；需 MySQL |
| `GET` | `/api/user/me` | B1：当前登录用户；Bearer JWT |
| `GET` | `/api/hot` | 对照组热门列表 + 顶筛 + 分页 |
| `POST` | `/api/personalized` | 实验组个性化列表 + 顶筛 + 分页 |
| `GET` | `/api/related/:id` | 类似推荐（最多 8 条） |
| `POST` | `/api/collect` | 埋点上报 |
| `GET` | `/api/export/events.csv` | 导出埋点 CSV |

---

## 3. `GET /api/health`

**说明**：探活与运维观测；**不**返回任何密钥明文。

**响应**（JSON 示例字段）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | DB 连接失败时为 `false` |
| `products` | number | `products.json` 商品条数 |
| `database` | string | `not_connected` \| `connected` \| `error` |
| `redis` | string | `not_connected` \| `connected` \| `error` |
| `db_product_count` | number \| null | MySQL `product` 表行数；无表/失败为 `null` |
| `auth_configured` | boolean | `WECHAT_MOCK=1` 或已配置 `WECHAT_APPID`+`WECHAT_SECRET` |
| `jwt_strong_secret` | boolean | 已设置 `JWT_SECRET` 且不等于默认占位 `zhili_dev_change_me` |

---

## 4. 用户与鉴权（B1）

### 4.1 `POST /api/user/login`

**说明**：`wx.login` 拿到的 **`code`** 换 `openid`，`user` 表 upsert，签发 JWT。

**前置**：MySQL 已连接（否则 **503** `DB_UNAVAILABLE`）。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | `wx.login` 临时码；mock 模式下长度仍须 ≥4 |
| `anon_id` | string | 否 | 与 `zhili_vid` 二选一语义：匿名 ID，**仅在 `user.anon_id` 仍为空时**写入 |
| `zhili_vid` | string | 否 | 与 `anon_id` 等价别名（服务端取其一作为匿名关联） |

**成功 200**：

```json
{
  "token": "<JWT>",
  "expires_in": 604800,
  "user": { "id": 1, "openid": "oXXX", "anon_id": "user_xxx或null" }
}
```

`expires_in` 为秒数，默认来自 `JWT_EXPIRES_IN`（如 `7d` → 604800）。

**限流**：每 IP 每约 **60s** 桶内 **`/api/user/login`** 超过 **40** 次 → **429**，`{ "error": "RATE_LIMIT", "message": "..." }`。

**错误体**（常见 `error` 码）：

| HTTP | `error` | 说明 |
|------|---------|------|
| 400 | `BAD_REQUEST` | 缺少或非法 `code` |
| 400 | `INVALID_CODE` | code 过短或无效（含微信 `40029` 映射） |
| 429 | `RATE_LIMIT` | 登录过频 |
| 503 | `DB_UNAVAILABLE` | 无数据库连接 |
| 503 | `WECHAT_NOT_CONFIGURED` | 未 mock 且未配 AppId/Secret |
| 502 / 其他 | `WECHAT_API_ERROR` / `LOGIN_FAILED` 等 | 微信侧或内部错误；可能带 `wechat_errcode` |

**本地联调**：环境变量 **`WECHAT_MOCK=1`** 时不请求微信，根据 `code` 生成稳定 **`mock_*` openid**。详见 `server/.env.example`。

### 4.2 `GET /api/user/me`

**请求头**：`Authorization: Bearer <token>`（大小写不敏感；须为 **Bearer** 后单一 token 串）。

**成功 200**：

```json
{
  "user": {
    "id": 1,
    "openid": "oXXX",
    "anon_id": null,
    "created_at": "..."
  }
}
```

| HTTP | `error` | 说明 |
|------|---------|------|
| 401 | `UNAUTHORIZED` | 缺头、格式错、JWT 无效/过期、`sub` 非法 |
| 404 | `NOT_FOUND` | JWT 合法但用户行不存在 |
| 503 | `DB_UNAVAILABLE` | 数据库未连接 |

---

## 5. 推荐与商品列表

### 5.1 分页与顶筛（`hot` / `personalized` 共用语义）

| Query / Body 字段 | 默认 | 约束 | 说明 |
|-------------------|------|------|------|
| `offset` | `0` | ≥0 | 偏移 |
| `limit` | `20` | 1～50 | 条数 |

**货架筛选**（`GET /api/hot` 为 Query；`POST /api/personalized` 为 body 内 **`shelf` 对象**）：

| 字段 | 说明 |
|------|------|
| `occasion` | 场合，需命中商品 `occasions` 或 `universal` |
| `budget` | 预算档位：`lt100`、`100-300`、`300-500`、`500-1000`、`1000+` |
| `style` | 风格，需命中商品 `styles` |

筛选后若无结果，服务端会 **回退到全量池** 再排序/分页（避免空列表硬断）。

### 5.2 `GET /api/hot`

**Query**：`occasion`、`budget`、`style`、`offset`、`limit`。

**响应**：`ProductCard[]`（JSON 数组，见 §7）。

**排序**：按商品 **`hotRank` 升序**，再按 `id` 字符串稳定次序。

### 5.3 `POST /api/personalized`

**Body**：除 **`shelf`**、**`offset`**、**`limit`** 外，其余字段作为 **画像** 传入 `scoring.js`（与 H5 `zhili_profile` 英文键一致，develop2 §6.2）。

**推荐画像字段**（与 `prototype/client` 提交一致）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `relation` | string | 如 `friend`、`partner`、`family`… |
| `ageBand` | string | `under18`、`18-25`、`26-35`、`36-45`、`46plus` |
| `interests` | string[] | 最多 3 个兴趣 key |
| `occasion` | string | 与顶筛场合一致 |
| `budget` | string | 档位，同 §5.1 |
| `gender` | string | `male` / `female` / `unknown` |
| `style` | string | 如 `practical`、`warm`、`ritual`、`quirky` |
| `taboos` | string[] | 禁忌标签，参与理由与加分 |

**响应**：`ProductCard[]`。  
**首屏补足**：仅当 **`offset === 0`** 且打分结果不足 `limit` 时，用热门序 **补齐** 未出现的商品（与 `index.js` 实现一致）。

### 5.4 `GET /api/related/:id`

**路径**：`:id` 为商品 `id`。

**Query**（可选）：

| 参数 | 说明 |
|------|------|
| `profile` | JSON **字符串**（需 URL 编码）；结构与 **`personalized` 画像** 一致时，返回卡片带 **个性化理由** |

**响应**：`ProductCard[]`，最多 **8** 条；商品不存在时为 **404** 与 **`[]`**（当前实现为 `404` + 空数组体，客户端宜按状态码处理）。

---

## 6. 埋点与导出

### 6.1 `POST /api/collect`

**Body**：单行事件 JSON，常见字段与 [prototype-spec.md](prototype-spec.md) §5 一致，例如：

- `event`：如 `page_view`、`form_submit`、`impression`、`click`、`collect`、`purchase_click`、`pull_refresh`、`explore_click`
- `user_id`、`group`、`page_name`、`timestamp`、`product_id`、`position` 等

服务端会附加 **`serverTs`**，并追加写入 **`prototype/server/data/events.jsonl`**，同时镜像到 **`events.csv`**（带表头）。

**响应**：`{ "ok": true }`

### 6.2 `GET /api/export/events.csv`

**说明**：下载 **`events.csv`**。

**404**：尚无 CSV 文件时，纯文本提示「请先产生埋点」。

---

## 7. 商品卡片对象 `ProductCard`

列表与类似推荐中每条商品经 `enrich` 后形状如下（字段名与前端契约一致）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 商品 ID |
| `title` | string | 标题 |
| `price` | number | 价格 |
| `image` | string | 首图 URL |
| `images` | string[] | 多图（无则服务端派生至少 3 张） |
| `sellPoint` | string | 卖点摘要 |
| `reasons` | `{ icon, text }[]` | 推荐理由；无画像时为默认「热门」类文案 |

打分与理由逻辑见 PRD §4.3/4.4 与 **`prototype/server/scoring.js`**（develop2 §8）。

---

## 8. 规划中接口（未在验证端实现）

与 develop2 **§7.2、§9.1** 对齐，供网关 / MVP 排期引用：

| MVP 规划目标（develop2 §9） | 说明 |
|---------------------|------|
| `POST/GET/PUT` 画像系列 | **B2**；Body 英文键与 **`personalized` 画像** 一致 |
| `GET /api/recommend` | **B4**；`page`/`size` → `offset`/`limit`，内调 hot/personalized |
| `GET /api/product/:id` | **B5** |
| `POST/DELETE /api/favorite`、`GET /api/favorite/list` | **B6** |
| `GET /api/purchase/url` | **B8** 联盟转链 |
| `POST /api/event` | **B7** 可选入库 |
| 商品 CRUD | **B9** 极简后台 |

---

## 9. 相关文件

| 路径 | 内容 |
|------|------|
| `prototype/server/index.js` | 除用户路由外的 Express 挂载 |
| `prototype/server/routes/user.js` | 登录、限流、`/me` |
| `prototype/server/middleware/requireAuth.js` | Bearer JWT |
| `prototype/server/lib/jwt.js` / `lib/wechat.js` | JWT 与微信 / mock |
| `prototype/server/scoring.js` | 打分与理由 |

---

## 10. Postman 验证（B1 与其余 API）

### 10.1 前置条件

1. **MySQL**：B1 依赖库连接。在 `prototype` 目录执行 **`npm run dev:db`**（或本机已有 MySQL 且 `server/.env` 中 **`DB_*`** 正确），再 **`cd prototype/server && npm start`**。  
2. **确认端口**：默认 `3000`；若顺延，读 **`prototype/server/.listen-port`**，Postman 里 **`{{base_url}}`** 与之对齐。  
3. **本地登录（无微信密钥）**：在 **`prototype/server/.env`** 中设置 **`WECHAT_MOCK=1`**，否则 `POST /api/user/login` 会返回 **`WECHAT_NOT_CONFIGURED`**（503）。  
4. **可选**：设置 **`JWT_SECRET`** 为随机长串，便于 `GET /api/health` 里 **`jwt_strong_secret`** 为 `true`（与生产习惯一致）。

### 10.2 Postman 环境变量

新建 **Environment**（例如 `Zhili local`），至少：

| 变量 | 初值 | 说明 |
|------|------|------|
| `base_url` | `http://127.0.0.1:3000` | 与 `.listen-port` 一致 |
| `token` | （空） | 由「Login」请求的 **Tests** 自动写入，见下 |

每个请求的 URL 使用 **`{{base_url}}/api/...`**，并在右上角选中该 Environment。

### 10.3 推荐请求顺序与配置

| 顺序 | 方法 | URL | Auth / Body |
|------|------|-----|-------------|
| 1 | `GET` | `{{base_url}}/api/health` | 无 |
| 2 | `POST` | `{{base_url}}/api/user/login` | Body **raw JSON**，见下表；**Tests** 脚本保存 `token` |
| 3 | `GET` | `{{base_url}}/api/user/me` | **Authorization → Type: Bearer Token**，Token 填 **`{{token}}`**（勿手写 `Bearer` 前缀，Postman 会自动加） |
| 4 | `GET` | `{{base_url}}/api/hot?occasion=birthday&budget=100-300&style=practical&offset=0&limit=5` | 无 |
| 5 | `POST` | `{{base_url}}/api/personalized` | Body **raw JSON**，见 §10.4 |
| 6 | `GET` | `{{base_url}}/api/related/p001` | 无；或加 Query **`profile`**（JSON 字符串，见 §10.5） |
| 7 | `POST` | `{{base_url}}/api/collect` | Body **raw JSON**，见 §10.6 |
| 8 | `GET` | `{{base_url}}/api/export/events.csv` | 无；**Send and Download** 便于存文件 |

**Login 的 Body 示例**（mock）：

```json
{
  "code": "postman-mock-login-001",
  "zhili_vid": "postman_anon_001"
}
```

**Login → Tests**（`POST` 成功后把 `token` 写入环境变量）：

```javascript
if (pm.response.code === 200) {
  const j = pm.response.json();
  if (j.token) pm.environment.set("token", j.token);
}
```

若你使用 **Collection Variables** 存 `token`，把最后一行改为：`pm.collectionVariables.set("token", j.token);`

**常见错误**：`/api/user/me` 只填了 `token` 字符串、未选 **Bearer** 类型，或手写 Header 时写成了 `Bearer:` 缺空格 → 会 **401**。正确整头为：`Authorization: Bearer eyJ...`

### 10.4 `POST /api/personalized` 示例 Body

```json
{
  "relation": "friend",
  "ageBand": "26-35",
  "interests": ["tech", "home"],
  "occasion": "birthday",
  "budget": "100-300",
  "gender": "male",
  "style": "practical",
  "taboos": [],
  "shelf": {
    "occasion": "birthday",
    "budget": "100-300",
    "style": "practical"
  },
  "offset": 0,
  "limit": 10
}
```

### 10.5 `GET /api/related/:id` 与 Query `profile`

在 Postman **Params** 里增加键 **`profile`**，值为 **一行 JSON 字符串**（与上表画像字段一致，不要换行），Postman 会自动 URL 编码。商品 id 可先 **`GET /api/hot?limit=1`** 从返回数组 `[0].id` 复制。

### 10.6 `POST /api/collect` 示例 Body

```json
{
  "event": "page_view",
  "user_id": "postman_test_user",
  "group": "B",
  "page_name": "browse",
  "timestamp": 1710000000000
}
```

发送后再调 **`GET .../api/export/events.csv`**，应能下载（若仍为 404，确认 `prototype/server/data/` 下是否已生成 `events.csv`）。

### 10.7 一键导入 Collection

仓库内提供 **`prototype/postman/zhili-prototype.postman_collection.json`**：Postman **Import** → 选该文件；导入后编辑 Collection **Variables**，将 **`base_url`** 改为实际端口（与 `server/.listen-port` 一致）。**Login** 成功后会自动写入 Collection 变量 **`token`**，`GET /api/user/me` 的 Bearer 已绑定 **`{{token}}`**。若你在 Environment 里也定义了同名 **`token`**，Postman 会优先用环境值——请保持为空或删除该环境键，以免覆盖刚登录得到的 token。

---

**文档版本**：与 develop2 **v2.8** 快照一致（B0+B1 已具备，B2+ 未开工；`develop.md` / `develop1.md` 已废止）。
