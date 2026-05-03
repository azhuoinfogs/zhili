# 最小验证实验运行手册（对齐 plan0）

## 1. 目标与指标

- **主指标**：CTR = 点击商品次数 / 曝光商品次数（`click` / `impression`）。
- **次指标**：`purchase_click` / `click`（详情→去购买代理）；可选问卷（理由合理性）。

## 2. 部署（H5 + API）

1. 同时运行 API 与 Vite（见根目录 [`README.md`](../README.md)）。
2. 将 `client` 执行 `npm run build` 后的 `dist/` 部署到任意静态托管（如 Nginx、对象存储 + CDN）；**同源**部署时把 `/api` 反代到 Node 服务地址。
3. 若前后端不同域：为 API 开启 CORS（已用 `cors` 全开，生产请收紧来源），并在小程序/H5 配置合法请求域名。

## 3. 数据导出

- 原始：`prototype/server/data/events.jsonl`（NDJSON）。
- 扁平：`prototype/server/data/events.csv`（与 jsonl 同步追加）。
- 浏览器下载：`GET /api/export/events.csv`（仅内网实验使用，公网需鉴权）。

## 4. 样本与周期（plan0）

- 目标：每组有效用户（提交画像 + 曝光≥10 商品）≥ **80**；总招募约 **200** 人；实验 **≥3 天**。

## 5. 分析

```bash
py -3 -m pip install -r prototype/analysis/requirements.txt
py -3 prototype/analysis/analyze_events.py prototype/server/data/events.jsonl
```

（若已配置 `pip`/`python` 命令，可直接使用。）

输出含分组 CTR 与卡方 **p 值**（A=热门对照，B=个性化）。

## 6. 交付物

- 原始 `events.jsonl` / `events.csv`
- 分析命令输出或截图
- Markdown 实验结论（是否进入小程序 MVP）

## 7. 合规

页脚已声明匿名用途；问卷与推送遵守 PRD 9.1，不采集姓名电话。
