# 知礼 · 前置验证（最小 H5）

基于根目录 `prototype-spec.md` 与 `prototype-client-App-vue.md` 落地。

**界面方向（PRD 5.2 + UI/UX Pro Max）**：礼品场景按 *E-commerce* 类「清晰层级 + 双列 feed + 块状筛选」组织；品牌色固定为文档中的 `#FF6B6B` / `#FFA500`，辅以骨架屏、Toast、懒加载与可见焦点，贴近微信小程序心智的轻量移动页。

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

事件写入 `server/data/events.jsonl`（每行一条 JSON）。分析流程见根目录 `plan0.md`。

## A/B 说明

- **A 组**：`GET /api/hot`，按 `hotRank` 稳定排序。
- **B 组**：`POST /api/personalized`，PRD 4.3 加权打分 + 4.4 理由。

分组保存在浏览器 `localStorage.zhili_group`。

## 商品池生成

默认已含 **120** 条打标数据。若需重生成：

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

见 [`mp-weixin/README.md`](mp-weixin/README.md)，与 H5 共用同一套 API 契约。
