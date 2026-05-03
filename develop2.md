# 知礼 · 整合开发计划（develop2）

**版本**：v2.4  
**更新**：2026-05-02  
**状态**：待评审  

本文档在通读 **[develop1.md](develop1.md)**（送礼 AI / 知礼 MVP 完整开发说明 v2.0）全文基础上重写，并与仓库 **`prototype/`**、[prototype-spec.md](prototype-spec.md)、[plan0.md](plan0.md)、[prd_v0.md](prd_v0.md) 对齐。**PRD 细项对照长表**仍见 [develop.md](develop.md)。

---

## 当前开发状态（仓库快照 · 与代码同步）

> 以下与 `prototype/` 当前提交一致；**未在仓库内自动探测**的项（如是否已跑满实验、是否已出报告）标为 **外部依赖**。

| 域 | 状态 | 说明 |
|----|------|------|
| **H5 验证端** | **已具备** | `prototype/client`：`landing` → `tags` → `browse`；双列推荐；场合/预算/风格筛选 **500ms 防抖**；**下拉刷新**（触顶下拉 + `pull_refresh` 埋点）、**触底加载更多**；骨架屏、Toast、详情抽屉；**空状态 SVG 插画**；A/B、`zhili_vid` / `zhili_group` / `zhili_profile` |
| **API** | **已具备** | `GET /api/hot`、`POST /api/personalized`（均支持 **`offset`/`limit`** 分页，默认 20、最大 50）、**`GET /api/related/:id`**（类似推荐）、`POST /api/collect`、`GET /api/export/events.csv`、`GET /api/health`；列表项含 **`images` 数组**（3 图，无则服务端派生） |
| **算法与数据** | **已具备** | `scoring.js` 对齐 PRD 4.3/4.4；**`products.json` 共 200 条** |
| **埋点落盘** | **已具备** | `prototype/server/data/events.jsonl`（无事件时目录或文件可能尚未生成，属正常） |
| **小程序骨架** | **已具备** | `prototype/mp-weixin`：`profile` → `index` → `detail`；`app.json` 导航栏已用 PRD §5.2 主色占位 |
| **develop.md 阶段 A** | **已在 H5 落地** | 下拉刷新、触底分页、详情多图轮播、详情内横向类似推荐、空状态插画、商品池 **200**；小程序端仍待对齐 |
| **develop1 MVP 后端** | **未开工** | MySQL / Redis / 微信登录 / 收藏 CRUD / 联盟转链 |
| **实验与决策门** | **外部依赖** | 部署、招募、样本量、CTR 报告是否完成：**以团队实际为准**；门槛仍按 §3 |

**本地运行**：[prototype/README.md](prototype/README.md)（先 `server` 再 `client`）。

---

## 0. 文档关系

| 文档 | 用途 |
|------|------|
| **develop2.md（本文）** | 整合：验证门 + develop1 全量结构（范围/技术/库表/API/任务/验收/灰度/风险）+ `prototype` 勘误与映射 |
| [develop1.md](develop1.md) | 原始 MVP 规格全文（SQL、接口表、人天分解）；与实现冲突时以本文 **§1** 为准 |
| [develop.md](develop.md) | PRD F1–F6 与 H5 逐项对照 + 阶段 A–E（H5 增强） |
| [prototype-spec.md](prototype-spec.md) | 当前验证端工程与埋点事实 |

---

## 1. develop1 与当前仓库（prototype）勘误

| develop1 表述 | 仓库事实 |
|---------------|----------|
| 前端 Vue3 CDN + Vant，部署 Vercel/Netlify | **Vue 3 + Vite**，`prototype/client`；本地/自建部署为主 |
| A 组「随机排序」/ 随机 | **`GET /api/hot` 按 `hotRank` 稳定排序** |
| B 组「前端打分」 | **`prototype/server/scoring.js`** + **`POST /api/personalized`** |
| sendBeacon / Google 表单 | **`fetch` → `POST /api/collect`** → `server/data/events.jsonl` |
| 匿名 `user_id` | **`zhili_vid`**；分组 **`zhili_group`**；画像 **`zhili_profile`** |
| 埋点事件 6 类 | 另含 **`explore_click`**；字段名见 prototype-spec §5 |
| 后端 Nest.js + TS | 验证端为 **Express + JS**；MVP 可按 develop1 升级为 Nest |
| `user_profile.budget_max` decimal | 验证端为 **预算档位枚举**（如 `100-300`），与 PRD / `personalized` body 一致 |
| `relation` 等中文 enum | `products.json` / API 使用 **英文 key**（如 `friend`），上线迁移需对照表 |
| 验证「2–3 天」总成本 | develop1 §0.2 阶段表含 **招募 2–3 天**；总周期以 **表内合计** 为准，勿压缩样本 |

---

## 2. 能力与缺口明细（对照 §「当前开发状态」）

| 模块 | 已实现 | 仍为缺口 |
|------|--------|----------|
| H5 | 同快照表 | 多画像、微信登录、收藏列表持久化 |
| API | 同快照表 | develop1 风格登录/画像/收藏/转链 REST |
| 数据 | **200** 条商品 JSON；API 返回 `images[]` | 联盟字段、运营后台 |
| 小程序 | 三页 + PRD 色顶栏 | WeUI 全量、登录、与 H5 同等交互、埋点全量 |
| 后台 / 联盟 | — | develop1 §3.2、CPS、MySQL/Redis |

---

## 3. 前置验证（develop1 §0 + plan0 门控）

### 3.1 目的与决策门

- **目的**：最小成本验证「个性化是否显著优于热门」。  
- **develop1 通过条件**：B 组 CTR > A 组且相对提升 **≥10%**，**p < 0.05**；理由评分 **≥4 分占比 >70%**。  
- **plan0 主门槛**（不替代 develop1 的 p 值，样本与卡方以 plan0 为准）：有效用户每组 **≥80**；B vs A CTR **p < 0.05**；可选问卷 **≥3.5**。  
- **结论**：未通过则调算法/交互后复验，**不启动** develop1 第 1 章起完整 MVP 排期。

### 3.2 阶段与时间（develop1 §0.2）

| 阶段 | 时间 | 产出 | 负责人 |
|------|------|------|--------|
| 准备（原型/埋点/分流） | 0.5 天 | 原型、埋点方案 | 产品+前端 |
| 前端页面开发 | 1.5 天 | 可运行 H5（画像+流+埋点） | 前端 |
| 轻量后端 | 0.5 天 | Node API | 后端 |
| 用户招募与实验 | 2–3 天 | ≥200 行为样本 | 运营+产品 |
| 数据分析与报告 | 0.5 天 | 实验报告 + 显著性检验 | 数据分析 |

### 3.3 验证期技术事实（替换 develop1 §0.3 中过时句）

- 前端：**Vue 3 + Vite** + `fetch`；存储 **`zhili_*`**。  
- 分流：首次随机 A/B，写入 **`zhili_group`**。  
- 商品：**`products.json`**（50–200 条策略仍适用）。  
- 埋点：**§1** 已述。  
- 分析：Python 脚本见 `prototype/analysis` 与 plan0。

---

## 4. 项目范围（develop1 §1）

### 4.1 核心目标

微信小程序闭环：**创建收礼人画像 → 个性化推荐 → 收藏 → 跳转购买**（前提：前置验证通过）。

### 4.2 v1.0 包含 / 不包含

**包含**：微信授权登录（含静默 openId）、画像创建与管理（**多画像** develop1 标为能力目标）、双列推荐 + 顶筛、详情（轮播+理由）、收藏云端、联盟购买跳转、基础埋点。

**不包含（后续迭代）**：订阅提醒、送礼记录、AB 平台、负反馈、分享裂变、自营/会员（与 develop1 §1.2 一致）。

### 4.3 功能清单与优先级（develop1 §3）

**小程序（§3.1）**：登录 P0；画像创建 P0；**多画像管理 P1**；推荐首页 P0；详情 P0；收藏 P0；购买跳转 P0；我的 P0。

**极简后台（§3.2）**：商品 CRUD + 标签 P0；数据看板 P1；画像匿名统计 P1。

---

## 5. 技术选型（develop1 §2 + 验证期对照）

| 层 | develop1（MVP 目标） | 当前验证端 |
|----|----------------------|-------------|
| 小程序 | 原生 + WeUI | `mp-weixin` 骨架 |
| 后端 | Node **Nest.js** + TypeScript | **Express** + JS |
| 数据 | MySQL 8 + Redis 7 | **JSON 文件 + JSONL** |
| 电商 | 京东联盟主、淘宝备用 | 未接 |
| 部署 | 腾讯云 CVM + CDN | 本地 / 任意 Node 托管 |
| 埋点 | 自定义 + 微信分析 | **自建 collect** |

---

## 6. 数据库设计（develop1 §4 → MVP 目标态）

上线建表草案以 **develop1.md 第 4 节 SQL** 为准，含：`user`、`user_profile`、`product`、`collection`、`event`。

**与 prototype 映射**

| develop1 | prototype 现阶段 |
|------------|-------------------|
| `product` 行 | `products.json` 单条；需补 **`images` 数组**、联盟字段 |
| `event` 行 | `events.jsonl` 一行一 JSON；迁移时做字段映射 |
| `user` / `user_profile` | 无；小程序登录后创建 |

---

## 7. API 设计（develop1 §5）与 prototype 对照

develop1 规划 REST 如下（节选）；验证已实现列右侧。

| develop1 端点 | 方法 | 说明 | prototype 现状 |
|-----------------|------|------|------------------|
| `/api/user/login` | POST | 微信 code | **无** |
| `/api/profile` | POST | 创建/更新画像 | 画像在客户端 + **`POST /api/personalized`** body |
| `/api/profile/list` | GET | 画像列表 | **无** |
| `/api/profile/current` | PUT | 默认画像 | **无** |
| `/api/recommend` | GET | 分页推荐 | **`/api/hot`** / **`/api/personalized`**（无统一 recommend 名） |
| `/api/product/:id` | GET | 详情 | **无**独立详情接口，商品在列表 JSON 内 |
| `/api/collect` | POST/DELETE | 收藏 | **无**；仅有埋点 `collect` |
| `/api/collect/list` | GET | 收藏列表 | **无** |
| `/api/event` | POST | 上报 | **`POST /api/collect`** |
| `/api/purchase/url` | GET | 转链 | **无** |

MVP 实施时可：**保留** `/api/hot`·`/api/personalized` 为推荐内核，在其外包一层 develop1 风格网关（登录、画像 id、分页、收藏）。

---

## 8. 推荐算法与缓存（develop1 §6）

- **得分公式**与 develop1 §6.1 子项表一致，与 PRD 4.3 及 **`scoring.js`** 对齐。  
- **理由模板**：develop1 §6.2 与 PRD 4.4；实现以 **`buildReasonLines`** 为准（含禁忌因子等）。  
- **Redis**（develop1 §6.3）：`recommend:{user_id}:{profile_id}:{filter_hash}`，TTL 10 分钟；改画像删缓存；故障降级热门（可与 `hotRank`/点击量对齐）。**prototype 无 Redis**。

---

## 9. 开发任务分解（develop1 §7）

**前提**：验证通过且商品打标完成。develop1 表内人天合计 **38**（后端 14 + 前端 16 + 后台 4 + 测试部署 4）；日历仍可按 **约 4 周、2 人并行** 排期。

| 模块 | 任务 | 人天 | 负责人 |
|------|------|------|--------|
| 后端 | 数据库设计与初始化 | 1 | 后端 |
| 后端 | 用户登录（微信） | 1 | 后端 |
| 后端 | 画像 CRUD API | 2 | 后端 |
| 后端 | 推荐打分函数实现 | 2 | 后端 |
| 后端 | Redis 缓存集成 | 1 | 后端 |
| 后端 | 推荐 API 开发 | 2 | 后端 |
| 后端 | 商品 CRUD API | 1 | 后端 |
| 后端 | 电商联盟对接 | 2 | 后端 |
| 后端 | 收藏 API & 事件 API | 2 | 后端 |
| **后端合计** | | **14** | |
| 前端 | 小程序搭建、登录页 | 1 | 前端 |
| 前端 | 画像创建/编辑 | 3 | 前端 |
| 前端 | 多画像管理页 | 2 | 前端 |
| 前端 | 推荐首页（瀑布流+筛选） | 4 | 前端 |
| 前端 | 商品详情页 | 2 | 前端 |
| 前端 | 收藏列表页 | 2 | 前端 |
| 前端 | 我的页面 | 1 | 前端 |
| 前端 | 埋点上报集成 | 1 | 前端 |
| **前端合计** | | **16** | |
| 后台 | 商品管理页 | 2 | 全栈 |
| 后台 | 简易数据看板 | 2 | 全栈 |
| **后台合计** | | **4** | |
| 测试与部署 | 功能/性能测试 | 3 | QA |
| 测试与部署 | 小程序提审与发布 | 1 | 产品 |
| **总计** | | **38** | |

---

## 10. 商品打标与初始化（develop1 §8）

1. 联盟抓取目标 **200** 品（develop1）；验证期可 **脚本生成 + 抽检**，与 PRD 商品池策略一致。  
2. 自动预打标 → 人工精标（develop1：约 2 分钟/品）→ 抽检 20%、准确率 **≥90%** → 入库。  
3. **标签体系**见 develop1 §8.2 表（基础/兴趣/情境/禁忌）；与 `products.json` 字段设计对齐扩展即可。

---

## 11. 验收标准（develop1 §9）

### 11.1 功能场景

| 场景 | 验收点 |
|------|--------|
| 登录 | 授权后正常进入 |
| 画像 | 字段可保存修改；圈层 ≤3；预算合法 |
| 多画像 | 默认切换、删除后回退 |
| 推荐 | 切换画像/筛选 **≤1s** 级刷新；下拉更多；空状态 |
| 详情 | 轮播；理由与画像匹配 |
| 收藏 | 详情与列表状态一致；列表可删 |
| 购买 | 打开京东/淘宝小程序或 H5；返回无异常 |
| 埋点 | 事件上报成功 |

### 11.2 性能（develop1 §9.2）

推荐接口 P90 **≤1.5s**；首页首屏 4G **≤2s**；并发 100 CPU **≤70%**；主包 **≤2MB**。

### 11.3 体验测试

5 名非开发人员：**创建画像 → 筛选 → 收藏 → 跳转购买**，成功率 **100%**，平均 **≤3 分钟**（无引导，作内部目标）。

---

## 12. 发布与灰度（develop1 §10）

| 环境 | 用途 | develop1 示例域名 |
|------|------|---------------------|
| 开发 | 本地/Dev | dev.giftai.com（占位，实施时替换） |
| 测试 | 内测 | test.giftai.com |
| 生产 | 线上小程序 | api.giftai.com |

**流程**：合并 release → 构建上传开发版 → 内测约 **20 人/1 天** → **5% 灰度/2 天**（错误率 **<1%**）→ 提审全量 → 监控 24h。

**回滚**：崩溃率 **>0.5%**；推荐接口成功率 **<95%**；隐私投诉 **立即下线**。

---

## 13. 风险与应对（develop1 §11）

| 风险 | 概率 | 应对 |
|------|------|------|
| 联盟 API 不稳定 | 中 | 超时重试≤2；缓存上次成功结果 |
| 推荐效果差、跳出高 | 中 | 热门兜底；运营可调权重（PRD B3） |
| 小程序审核被拒 | 低 | 电商类目与规范预审；测试号 |
| 商品池不足 200 | 低 | 先 **50 精品** 上线再扩充 |
| 画像完成率低 | 中 | 简化表单、默认示例（与 PRD 一致） |

---

## 14. 里程碑与交付物（develop1 §12）

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| 前置验证完成 | W0 | 实验报告 + 分析脚本 |
| 数据库设计评审 | W1D1 | ER 图、建表 SQL |
| 后端核心 API | W1D5 | Swagger、Postman 集 |
| 前端 UI 完成 | W2D5 | 体验版二维码 |
| 联调测试完成 | W3D3 | 测试报告、Bug 清单 |
| 小程序提审 | W3D5 | 上线版代码 |
| 正式发布 | W4D1 | 生产可用 |

---

## 15. H5 验证端增强（来自 develop.md，与 develop1 并行策略）

在不影响验证门统计口径前提下，可排 **阶段 A**：下拉刷新、触底分页、详情多图/类似推荐、空状态品牌图、商品池 **~200**。通过后再全力投入 **§9** 小程序与后端人天。

---

## 16. develop1 附录索引（§13）

- A 打标 Excel 模板 · B `auto_tag.py` · C `csv_to_mysql.py` · D `analyze_experiment.py` · E 缓存详设 · F 索引优化 —— 独立文件占位见 develop1 原文。

---

## 17. 文档索引

[prd_v0.md](prd_v0.md) · [plan0.md](plan0.md) · [prototype-spec.md](prototype-spec.md) · [develop.md](develop.md) · [develop1.md](develop1.md) · [prototype/README.md](prototype/README.md)

**维护约定**：**代码或数据有发布级变更时**，先更新本文 **「当前开发状态」** 与 [prototype-spec.md](prototype-spec.md) 同步段，再视情况改 develop1 勘误表。develop1 增删章节后，同步本文 **§1 勘误、§7 映射、§9 人天表**；PRD 逐项矩阵仍以 **develop.md** 为主表。
