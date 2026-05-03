# 知礼 · 前置验证（最小 H5）

工程规格与 API、埋点、页面阶段见 **[prototype-spec.md](prototype-spec.md)**；Vue 实现说明见 **[prototype-client-App-vue.md](prototype-client-App-vue.md)**。整合开发计划见 **[develop2.md](develop2.md)**；PRD 细对照见 **[develop.md](develop.md)**。启动与目录说明见 **[prototype/README.md](prototype/README.md)**。

## 快速开始

1. 终端一：`cd prototype/server && npm install && npm start`
2. 终端二：`cd prototype/client && npm install && npm run dev`
3. 浏览器打开 Vite 提示的本地地址（一般为 `http://localhost:5173`）

## 产物

- 埋点：`prototype/server/data/events.jsonl`（逐行 JSON）
- 实验分析：用 Python/pandas 按 `plan0.md` 清洗与卡方检验即可

## 若无法写盘

在 Cursor 切换到 **Agent 模式**，发送：「根据仓库根目录三个 `prototype*.md` 文件创建完整 `prototype/` 工程」。
