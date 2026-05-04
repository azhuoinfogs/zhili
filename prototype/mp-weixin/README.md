# 知礼微信小程序骨架（PRD v1.0 预览）

三页：`profile`（画像简版）→ `index`（双列推荐，A/B 与 H5 一致）→ `detail`（详情占位）。**样式与 `prototype/client`（深色礼遇艺廊 + 金色强调）对齐**，见 **`app.wxss`** 与各页 **`*.wxss`**。

**契约**：接口与埋点以仓库根 [**`prototype-spec.md`**](../../prototype-spec.md) 为准；HTTP 以 [**`api.md`**](../../api.md) 为准。本文只回答两件事：**① 按什么顺序做能跑通骨架**；**② 卡住时查哪一节**。

---

## 小程序开发步骤（明确版）

### 总览：三个阶段

| 阶段 | 目标 | 谁需要 |
|------|------|--------|
| **一、环境与本机联调** | 微信开发者工具**模拟器**里：`profile` → `index` 能拉出推荐列表 | **所有人，先做** |
| **二、真机与域名校验** | 手机预览/体验版能访问 API（多为 HTTPS + 合法域名） | 真机联调、提审前 |
| **三、PRD 功能扩展** | 登录、详情 B5、收藏、埋点、购买链路等 | 产品里程碑；任务表见 [**`develop2.md`**](../../develop2.md) **附录 A §三 阶段 B** |

下面 **阶段一** 为**固定顺序**步骤；阶段二、三为要点索引。

---

### 阶段一：环境与本机联调（按步骤 1→12 顺序执行）

| 步骤 | 做什么 | 产出 / 注意 |
|:----:|--------|-------------|
| **1** | 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版） | 能新建/导入项目 |
| **2** | 打开本仓库目录 **`prototype/mp-weixin`**，确认存在 **`app.json`**、**`app.js`** | 导入路径不要选错到上级 |
| **3** | 另开终端：进入 **`prototype/server`**，首次执行 **`npm install`** | `node_modules` 就绪 |
| **4** | 配置 **`prototype/server/.env`**（本地至少 **`JWT_SECRET`**；用微信 mock 时 **`WECHAT_MOCK=1`**；用库时 **`DB_*`** 与 **`npm run migrate` + `npm run seed`**，见 [**`prototype/README.md`**](../README.md)） | API 可启动 |
| **5** | 在 **`prototype/server`** 执行 **`npm start`**，看终端打印的 **实际端口**（若 3000 占用会顺延，并可能写入 **`.listen-port`**） | 记下根地址，例如 **`http://127.0.0.1:3003`** |
| **6** | 浏览器访问 **`http://127.0.0.1:<端口>/api/health`**，确认返回 JSON | 确认 API 已监听 |
| **7** | 编辑本目录 **`app.js`**： **`globalData.apiBase`** = 步骤 5 的根地址（**无**末尾 `/`，**无** `/api`；代码里是 **`apiBase + '/api/hot'`**） | 端口必须与步骤 5 **一致** |
| **8** | 编辑 **`project.config.json`**：将 **`appid`** 从占位改为你的**小程序 AppID** | 否则无法真机/部分能力受限 |
| **9** | 微信开发者工具 → **导入项目** → 目录选 **`prototype/mp-weixin`** → AppID 与步骤 8 一致 → **编译** | 无红错编译通过 |
| **10** | 工具栏 **详情 → 本地设置** → 勾选 **「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」** | 否则 **`http://127.0.0.1`** 请求会被拦 |
| **11** | **清缓存**（工具 **清缓存**）后再次 **编译**，避免旧配置 | 保证步骤 7 生效 |
| **12** | 模拟器操作：**`profile`** 页选年龄/场合/预算 → 进入 **`index`** → 应出现双列卡片；点进 **`detail`** | 若列表空白或 Toast「网络错误」→ 见下文 **「阶段一常见失败」** |

**当前骨架请求逻辑（便于对照 Network）**

- 读 **`wx.getStorageSync('zhili_group')`**，无则随机 **A/B** 并写入。
- **A 组**：`GET {apiBase}/api/hot`
- **B 组**：`POST {apiBase}/api/personalized`，`Content-Type: application/json`，Body 为 **`zhili_profile`**（**`profile` 页写入**或代码默认对象）

---

### 阶段一常见失败

| 现象 | 优先检查 |
|------|-----------|
| Toast「网络错误」 | 步骤 **5 与 7** 端口是否一致；步骤 **10** 是否勾选；**Network** 里 URL 是否多写了 **`/api` 在 apiBase 里** |
| 列表为 `[]` | DB 已连但 **`product` 表空** → 在 **`server`** 执行 **`npm run seed`**；或切 **A 组** 看 **`/api/hot`** 是否有数据 |
| `personalized` 4xx/5xx | Body 字段与 **`prototype-spec.md`** / **`api.md`** 是否一致（骨架为简化画像字段） |
| 改 **`app.js`** 无效 | 步骤 **11** 清缓存；确认改的是**当前导入**的目录下的文件 |

---

### 阶段一：开发者工具面板（排错时用）

| 面板 | 用途 |
|------|------|
| **Network** | 看 **`/api/hot`** 或 **`/api/personalized`** 的状态码与响应体（应为数组） |
| **Storage** | 看 **`zhili_group`**、**`zhili_profile`**；异常时可删键重测 |
| **Console** | 运行期报错 |
| **Sources** | 对 **`.js`** 打断点 |

---

### 阶段二：真机预览 / 体验版（要点）

| 项 | 说明 |
|----|------|
| **域名校验** | 真机通常要求 **HTTPS** + 小程序后台配置 **request 合法域名**；纯 **`http://127.0.0.1`** 一般**仅模拟器**可用 |
| **`apiBase` 改局域网 IP** | 手机访问电脑 API 时，常改为 **`http://<电脑局域网IP>:<端口>`**；须与手机**同一网络**且电脑防火墙放行 |
| **长期方案** | 内网穿透 / 部署测试 HTTPS 域名，与微信后台白名单一致 |

---

### 阶段三：按 PRD 扩展（与 `develop2` 阶段 B 对齐）

在阶段一已跑通后，按产品排期实现下列能力（**顺序可按依赖调整**；完整验收表见 **`develop2.md` 附录 A §三**）：

| 建议顺序 | 开发项 | 主要依赖 |
|:--------:|--------|----------|
| 1 | **微信登录**：`wx.login` → **`POST /api/user/login`** → 存 **`token`** → 后续 **`Authorization: Bearer`** | **`api.md`** B1；服务端已具备 |
| 2 | **详情**：`GET /api/product/:id`（与 H5 字段一致） | **`api.md`** B5 |
| 3 | **推荐网关（登录态）**：`GET /api/recommend`（分页 `page`/`size`） | **`api.md`** B4；需默认画像等 |
| 4 | **收藏**：`POST/DELETE /api/favorite`、`GET /api/favorite/list` | **`api.md`** B6；需登录 |
| 5 | **埋点**：生成并持久化 **`zhili_vid`**，**`POST /api/collect`** 与 H5 事件名对齐 | **`prototype-spec.md`** §5 |
| 6 | **视觉 §5.2**、筛选防抖、分页、购买 WebView 等 | PRD **`prd_v0.md`**；**`develop2.md`** 阶段 B 表 B1～B6 |

---

### 提交 / 协作前检查清单

- [ ] **`app.js`** 的 **`apiBase`** 无笔误、**未**把 **`/api`** 写进 **`apiBase`**
- [ ] **`project.config.json`** 的 **`appid`** 非占位 **`wxYourTestAppId`**
- [ ] **阶段一 步骤 12** 在模拟器可走通
- [ ] 未把 **服务端密钥、`.env`** 写进小程序仓库或客户端明文

---

## 与 H5、文档对齐（摘要）

| 项 | 说明 |
|----|------|
| API | `GET /api/hot`、`POST /api/personalized` 与 **prototype-spec §3**、**api.md** 一致 |
| 本地存储 | **`zhili_group`**、**`zhili_profile`** 与 H5 **`localStorage`** 键名一致 |
| 匿名 id | 骨架未强制 **`zhili_vid`**；接 **`collect`** 时与 H5 字段对齐 |
| 视觉 | **与 `prototype/client` 验证端一致**：深色底、玻璃卡、金色价签（见 **`client/src/style.css`**、`App.vue`）；若发版改 **PRD §5.2** 浅色系，可集中改 **`app.wxss`** 变量与 **`app.json`** `window` |

H5 说明：[**`prototype-client-App-vue.md`**](../../prototype-client-App-vue.md)；产品清单：[**`prd_v0.md`**](../../prd_v0.md)。

---

## 后续可接（PRD）

微信登录、收藏同步、订阅消息、WebView 购买跳转（F3 / F4 / F5）、与 H5 一致的完整埋点链路。
