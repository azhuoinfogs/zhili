# 知礼 · 前置验证（最小 H5）

源码请按 [prototype-spec.md](prototype-spec.md) 生成 `prototype/server` 与 `prototype/client`；Vue 单文件完整示例见 [prototype-client-App-vue.md](prototype-client-App-vue.md)。

## 快速开始（生成文件后）

1. 终端一：`cd prototype/server && npm install && npm start`
2. 终端二：`cd prototype/client && npm install && npm run dev`
3. 浏览器打开 Vite 提示的本地地址（一般为 `http://localhost:5173`）

## 产物

- 埋点：`prototype/server/data/events.jsonl`（逐行 JSON）
- 实验分析：用 Python/pandas 按 `plan0.md` 清洗与卡方检验即可

## 若无法写盘

在 Cursor 切换到 **Agent 模式**，发送：「根据仓库根目录三个 `prototype*.md` 文件创建完整 `prototype/` 工程」。
