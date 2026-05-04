# 知礼 · 前置验证（最小 H5）

实现说明与接口、埋点、页面阶段以仓库根目录 **[`prototype-spec.md`](../prototype-spec.md)** 为准；Vue 单文件结构说明见 **[`prototype-client-App-vue.md`](../prototype-client-App-vue.md)**。**当前做到哪一步**（已具备 / 未开工）：[`develop2.md`](../develop2.md) 篇首「当前开发状态」。

**界面方向**：推荐流按 PRD **F2**（双列、图片/标题/价格/理由、顶部场合·预算·风格筛选、骨架屏、Toast、懒加载、`500ms` 防抖）组织。本 H5 为验证传播与 A/B，采用 **深色礼遇艺廊** 视觉（金色点缀）；**正式微信小程序视觉以 PRD §5.2 为准**（主色 `#FF6B6B`、浅底等）。

**页面流程**：`landing`（可选品牌首屏）→ `tags`（画像与标签）→ `browse`（推荐列表）→ 详情抽屉。与 [`plan0.md`](../plan0.md) 最小三屏的对应关系见 `prototype-spec.md` §2。

## 本机 Docker（MySQL + Redis，一键建库）

需已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（或 Docker Engine + Compose v2）。**默认占用本机 3306、6379**；若与本机已有 MySQL/Redis 冲突，请先停掉本机服务或改 `docker-compose.yml` 中的端口映射。

在 **`prototype` 目录**执行（**一条命令**：起容器 → 等 MySQL 就绪 → 若无 `server/.env` 则从模板创建 → `migrate` + `seed`）：

```bash
cd prototype
npm run dev:db
```

- 仅起容器（不跑迁移）：`npm run docker:up`
- 查看日志：`npm run docker:logs`
- 停止并移除容器（**数据卷默认保留**，MySQL 数据仍在）：`npm run docker:down`

**若首次 `docker compose up` 拉取 `mysql`/`redis` 镜像失败（连接 `registry-1.docker.io` 超时）**：打开 Docker Desktop → **Settings → Docker Engine**，在 JSON 中增加或合并 `registry-mirrors`（地址以你环境可用的镜像服务为准），例如：

```json
{
  "registry-mirrors": ["https://docker.m.daocloud.io"]
}
```

点击 **Apply & restart**，再在 `prototype` 目录执行 `docker compose pull` 或 `npm run docker:up`。

Docker 内 MySQL `root` 密码为 **`123456`**（与 `server/.env.docker.example` 一致）。若你已有手写 `server/.env`，脚本不会覆盖；请自行保证 `DB_PASSWORD` 与 compose 中一致。

### 升级 WSL（Docker 提示 *WSL needs updating* 时）

Docker Desktop 使用 **WSL 2** 时，内核过旧会无法启动 Linux 引擎。请 **右键「以管理员身份运行」PowerShell**，执行：

```powershell
wsl --update
```

若微软商店受限或上述失败，可改为：

```powershell
wsl --update --web-download
```

完成后 **重启 Windows**，再打开 Docker Desktop。仍有问题时：先做 **Windows 更新**，并参阅 [安装 WSL](https://learn.microsoft.com/zh-cn/windows/wsl/install) 与 [手动安装步骤中的内核更新包](https://learn.microsoft.com/zh-cn/windows/wsl/install-manual#step-4---download-the-linux-kernel-update-package)。可用 `wsl -l -v` 查看发行版是否为 **VERSION 2**。

### 安装 Docker Desktop（Windows）

**若安装报 `C:\ProgramData\DockerDesktop must be owned by an elevated account`：** 请 **以管理员身份打开 PowerShell**，任选其一后重装 Docker Desktop（安装程序也务必「以管理员身份运行」）：

```powershell
# 方式 A：删除残留目录（无在用 Docker 时）
Remove-Item -LiteralPath 'C:\ProgramData\DockerDesktop' -Recurse -Force -ErrorAction SilentlyContinue

# 方式 B：不删目录，把所有权交给管理员组（方式 A 失败时再试）
takeown /f 'C:\ProgramData\DockerDesktop' /r /d y 2>$null
icacls 'C:\ProgramData\DockerDesktop' /grant Administrators:F /t 2>$null
```

1. **推荐（winget）**（需 Windows 10/11 且已装 [应用安装程序](https://aka.ms/getwinget)）：

   ```powershell
   winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
   ```

   出现 **「是否允许此应用对你的设备进行更改？」** 时选 **是**；若安装程序还要求勾选组件，按默认完成即可。安装结束后建议 **注销或重启一次**，再打开 **开始菜单 → Docker Desktop**。

2. **或官网安装**：打开 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) 下载安装包，同样需管理员权限；首次启动若提示启用 **WSL 2** 或安装 Linux 子系统，按向导执行（可能需重启）。

3. **确认引擎已就绪**：任务栏鲸鱼图标为 **Running**（非 “Docker Desktop starting…”）。在 **新开** 的 PowerShell 中执行：

   ```powershell
   docker version
   docker compose version
   docker run --rm hello-world
   ```

   若仍提示找不到 `docker`：先完全退出并重新打开 Docker Desktop，或 **重启电脑**；仍不行则在「设置 → 应用 → Docker Desktop → 修复」或检查是否安装到默认路径 `C:\Program Files\Docker\Docker\`。

### 与本项目联调

1. **先打开 Docker Desktop**，等托盘图标为运行状态；在 PowerShell 执行 `docker info` 无报错再继续（若报 `docker_engine` / pipe 错误说明引擎未起）。
2. **`docker` 命令找不到**：把 `C:\Program Files\Docker\Docker\resources\bin` 加入**用户**环境变量 `Path`，**关闭并重新打开**终端；或临时执行  
   `$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH`  
   （本仓库的 `npm run dev:db` 脚本在 Windows 上会尝试自动 prepend 该目录，但仍需 daemon 已运行。）
3. `cd prototype\server` 执行 **`npm install`**（`npm run dev:db` 会调用其中的 `migrate`/`seed`）。
4. `cd prototype` 执行 **`npm run dev:db`**（内含 **`migrate`**：若库里 **`user_profile`** 仍为旧列 **`age_range`/`circles`**，会自动执行 **`server/migrations/002_user_profile_scoring_align.sql`** 对齐 **`personalized`/scoring**，见 develop2 §9.3）。
5. `cd prototype\server` 执行 **`npm start`**，浏览器访问 `http://127.0.0.1:实际端口/api/health`，应看到 `database: "connected"`、`db_product_count: 200`（首次 seed 成功后）。

### 排错摘要

| 现象 | 处理 |
|------|------|
| `docker` 不是内部或外部命令 | 安装完成后**新开终端**或重启；确认 Docker Desktop 已启动。 |
| `Cannot connect to the Docker daemon` | 启动 Docker Desktop，等托盘图标就绪后再执行命令。 |
| `port is already allocated`（3306/6379） | 关闭本机其它 MySQL/Redis，或改 `docker-compose.yml` 里 `ports` 左侧宿主机端口，并同步改 `server/.env` 中 `DB_PORT`/`REDIS_PORT`。 |
| `npm run dev:db` 里 MySQL 一直不健康 | `docker compose logs mysql` 看报错；常见为首次拉镜像慢，多等 1～2 分钟再试。 |
| WSL / 虚拟化相关报错 | BIOS 中开启 **虚拟化（Intel VT-x / AMD-V）**；Windows 功能中启用 **虚拟机平台**、**适用于 Linux 的 Windows 子系统**（Docker 文档有逐步说明）。 |
| Docker 提示 **「WSL needs updating」/ WSL 版本过旧** | 见本文 **「本机 Docker → 升级 WSL」** 小节。 |
| **winget** 报「安装程序失败」、退出码 **4294967291**（或类似） | 多为 **未在 UAC 弹窗点「是」**、关闭了安装向导，或 **非交互环境** 无法点按钮。请在本机 **以管理员打开 PowerShell** 再执行一次 `winget install …`，或直接运行官网下载的 `Docker Desktop Installer.exe` 完成图形界面安装。 |
| 提示 **`C:\ProgramData\DockerDesktop must be owned by an elevated account`** | 该目录权限/所有者不对（常见于曾用非管理员安装或残留目录）。**以管理员打开 PowerShell**，执行下面「修复 ProgramData\DockerDesktop」中的命令后，再 **右键「以管理员身份运行」** 安装包或重新 `winget install`。 |
| `docker compose up` 报 **`registry-1.docker.io` 超时 / failed to resolve / connectex`** | 本机访问 Docker Hub 失败（网络、IPv6、地区策略等）。在 **Docker Desktop → Settings → Docker Engine** 中为 `registry-mirrors` 配置可用镜像（以你单位/云厂商文档为准），**Apply & Restart** 后重试 `docker compose pull`；或换网络/VPN 后再拉取。 |
| **`Access denied for user 'root'@'172.18.0.1' (using password: YES)`** 且 `.env` 里密码已与 `docker-compose.yml` 中 `MYSQL_ROOT_PASSWORD` 一致 | 数据卷 **`zhili_mysql_data` 在首次启动时已写入旧 root 密码**；之后只改 compose / `.env` 不会改库内密码。在 **`prototype` 目录**执行 **`npm run docker:mysql-fresh`**（会 **`docker compose down -v` 删除 MySQL 卷**，数据清空），再 **`npm run dev:db`** 重建表并种子；或保留数据时在容器内用旧密码登录后 `ALTER USER`。 |

## B1 微信登录（MVP API）

需 **MySQL 已连接**（`GET /api/health` 中 `database` 为 `connected`）。环境变量见 **`server/.env.example`**。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/user/login` | Body：`{ "code": "<wx.login 临时码>", "anon_id"?: "<可选 zhili_vid>" }`。返回 `{ token, expires_in, user }`。 |
| `GET` | `/api/user/me` | Header：`Authorization: Bearer <token>`。返回当前用户行。 |

- **真机/联调**：配置 `WECHAT_APPID`、`WECHAT_SECRET`，并设置 **`JWT_SECRET`**（勿用默认值）。  
- **本地无小程序密钥**：在 `server/.env` 中设 **`WECHAT_MOCK=1`**，任意长度足够的 `code` 会得到稳定 **`mock_*` openid**（不调微信接口）。

`GET /api/health` 中会多 **`auth_configured`**（微信或 mock 已配置）、**`jwt_strong_secret`**（是否已换默认 JWT 密钥）。

## B2 画像 CRUD（需登录）

Header：`Authorization: Bearer <token>`（与 B1 相同）。Body 字段与 **`POST /api/personalized`** 画像段一致，详见仓库根目录 **[api.md](../api.md) §4.3**。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/profile` | 列表 `{ list, total }`；`offset`/`limit`（默认 20、最大 50） |
| `POST` | `/api/profile` | 创建；首条强制默认；`interests` 最多 3 项 |
| `GET` | `/api/profile/default` | 当前默认画像；无则 **404** |
| `GET` | `/api/profile/:id` | 详情；非本人 **404** |
| `PUT` | `/api/profile/:id` | 全量更新 |
| `PUT` | `/api/profile/:id/default` | 设为默认 |
| `DELETE` | `/api/profile/:id` | 删除；删默认后自动升一条；仅剩一条 **409** |

**自测顺序**：`POST /api/user/login` → 带 Bearer 调 `GET /api/profile` → `POST /api/profile`（可建第二条）→ `PUT .../default` → `GET /api/profile/default`。Postman 见 **`postman/zhili-prototype.postman_collection.json`**（B2 请求在 `/me` 之后）。

## B3 登录态推荐（默认画像 + 与 hot/personalized 同源）

需 **Bearer** 且 MySQL 中已有 **默认画像**（可先完成 **B2** 创建一条）。详见仓库根目录 **[api.md](../api.md) §4.2.1**。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/user/recommend` | Query：`occasion`、`budget`、`style`、`offset`、`limit`；**`zhili_group` 或 `group`**：`A`→热门 **`mode:"hot"`**，`B`/缺省→个性化 **`mode:"personalized"`**（画像来自 DB 默认行）。无默认画像 **404**。 |

**自测**：`login` → `POST /api/profile`（若尚无画像）→ **`GET /api/user/recommend?zhili_group=B&...`** → 改 **`zhili_group=A`** 对照热门列表。

## B4 推荐网关（`page`/`size` + Redis 可降级）

需 **Bearer**、**默认画像**，与 B3 共用 **`recommendCore`**；对外主路径为 **`page`/`size`** 分页（内部再映射 `offset`/`limit`）。详见仓库根目录 **[api.md](../api.md) §4.2.2**。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/recommend` | Query：顶筛 + **`zhili_group`/`group`** + **`page`≥1**、**`size`**（默认 20、最大 50）；可选 **`profile_id`**（缺省=默认画像）。**Redis** 缓存约 600s；无 Redis 或读写失败时仍返回 **200**。写画像（B2）后会 **失效** 该用户推荐缓存。 |

**自测**：完成 B3 自测链路后 → **`GET /api/recommend?page=1&size=10&...`** 连发两次（起 Redis 时第二次更易命中缓存）→ **`PUT /api/profile/:id`** 后再 GET，列表应随新画像更新。

**Windows PowerShell 自测登录（勿在双引号里用 `\\\"`，会传坏 JSON）**：

```powershell
# 推荐：JSON 放在单引号里，内部双引号无需转义
curl.exe -s -X POST http://127.0.0.1:3000/api/user/login -H "Content-Type: application/json" -d '{"code":"test-code-123456"}'
```

或不用 curl：

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/user/login' -Method Post -ContentType 'application/json' -Body '{"code":"test-code-123456"}'
```

## 启动（务必先 API，再前端）

终端 1（API，默认从 3000 起占用；若被占用会自动顺延，并写入 `server/.listen-port`）：

```bash
cd prototype/server
npm install
npm start
```

终端 2（**必须在 `prototype/client` 目录**，Vite 默认 5173；`/api` 会代理到 `VITE_API_TARGET`，若无则读取 `../server/.listen-port`）：

```bash
cd prototype/client
npm install
npm run dev
```

浏览器打开终端提示的本地地址（如 `http://localhost:5173`）。

### 常见踩坑

1. **在 `server` 里执行 `npm run dev`**：会再次启动 `node index.js`（API），不是前端。前端请 **`cd prototype/client`** 再 `npm run dev`。
2. **PowerShell 设置带 URL 的环境变量必须加引号**，否则 `http://` 会被误解析：

   ```powershell
   $env:VITE_API_TARGET = 'http://127.0.0.1:3003'
   ```

   推荐：先启动 API（会写 `.listen-port`），再在 `client` 里直接 `npm run dev`，通常无需手设变量。

## `npm start` 报 EADDRINUSE

表示期望端口被占用。默认行为：从 `PORT`（未设则 **3000**）起**自动顺延**最多 **40** 个端口（可用 `PORT_RANGE` 调整，最大 200），直到绑定成功；终端会打印实际地址；若顺延了端口，请按提示设置 `VITE_API_TARGET` 再开前端。

- **固定端口失败即退出**：`$env:STRICT_PORT=1; npm start`
- **扩大扫描范围**：`$env:PORT_RANGE=80; npm start`
- **手动指定**：仍可先释放占用进程，再默认 `npm start`（3000）。

## 埋点

事件写入 `server/data/events.jsonl`（每行一条 JSON）。事件表见 `prototype-spec.md` §5；分析流程见根目录 [`plan0.md`](../plan0.md)。

## A/B 说明

- **A 组**：`GET /api/hot`，按 `hotRank` 稳定排序。
- **B 组**：`POST /api/personalized`，PRD 4.3 加权打分 + 4.4 理由。

分组保存在浏览器 `localStorage.zhili_group`。

## 商品池生成

默认已含 **200** 条打标数据（可用脚本改数量）。若需重生成：

```bash
cd prototype
npm run gen:products
```

（数量可改：`node scripts/generate-products.mjs 160`）

## 埋点导出与分析

- 浏览器或 curl 下载：`GET /api/export/events.csv`
- Python：`pip install -r analysis/requirements.txt` 后执行 `python analysis/analyze_events.py`
- 实验流程见 [`docs/EXPERIMENT_RUNBOOK.md`](docs/EXPERIMENT_RUNBOOK.md)

## 微信小程序骨架（v1 预览）

见 [`mp-weixin/README.md`](mp-weixin/README.md)（含与 **`prototype-spec.md`**、PRD §5.2 的对照说明），与 H5 共用同一套 API 契约。
