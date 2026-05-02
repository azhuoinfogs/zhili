import http from 'http';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeScore, buildReasonLines } from './scoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.join(__dirname, 'products.json');
let productsData;
try {
  productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
} catch (e) {
  console.error('无法读取 products.json:', productsPath, e.message);
  process.exit(1);
}

const portFile = path.join(__dirname, '.listen-port');
function writeListenPort(p) {
  try {
    fs.writeFileSync(portFile, String(p), 'utf8');
  } catch (e) {
    console.warn('[知礼] 无法写入 .listen-port（前端可能需手动 VITE_API_TARGET）:', e.message);
  }
}
function clearListenPort() {
  try {
    if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
  } catch {
    /* ignore */
  }
}
process.once('SIGINT', () => {
  clearListenPort();
  process.exit(0);
});
process.once('SIGTERM', () => {
  clearListenPort();
  process.exit(0);
});

const app = express();
/** 期望起始端口；若被占用则顺延（除非 STRICT_PORT=1） */
const BASE_PORT = Number(process.env.PORT) || 3000;
const PORT_RANGE = Math.min(Math.max(Number(process.env.PORT_RANGE) || 40, 1), 200);
const STRICT_PORT = String(process.env.STRICT_PORT || '') === '1';
const dataDir = path.join(__dirname, 'data');
const logFile = path.join(dataDir, 'events.jsonl');

app.use(cors());
app.use(express.json({ limit: '256kb' }));

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

/** 稳定热门：按 hotRank 升序，同 rank 按 id */
app.get('/api/hot', (req, res) => {
  const list = [...productsData]
    .sort((a, b) => (a.hotRank ?? 999) - (b.hotRank ?? 999) || String(a.id).localeCompare(String(b.id)))
    .slice(0, 20)
    .map((p) => enrich(p));
  res.json(list);
});

app.post('/api/personalized', (req, res) => {
  const profile = req.body || {};
  const scored = productsData
    .map((p) => ({
      item: { ...enrich(p, profile), score: computeScore(p, profile) },
      hotRank: p.hotRank ?? 999
    }))
    .sort((a, b) => b.item.score - a.item.score || a.hotRank - b.hotRank)
    .slice(0, 20)
    .map((x) => x.item);
  res.json(scored);
});

app.post('/api/collect', (req, res) => {
  const line = JSON.stringify({ ...req.body, serverTs: Date.now() }) + '\n';
  fs.appendFile(logFile, line, () => {});
  res.json({ ok: true });
});

function enrich(p, profile) {
  const reasons = profile ? buildReasonLines(p, profile) : [{ icon: '🎁', text: p.sellPoint || '热门精选' }];
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    image: p.image,
    sellPoint: p.sellPoint,
    reasons
  };
}

function tryListen(port) {
  const endExclusive = BASE_PORT + PORT_RANGE;
  if (port >= endExclusive) {
    console.error(
      `[知礼 validate] 在端口 ${BASE_PORT}–${endExclusive - 1} 内未找到空闲端口。\n` +
        `请结束占用端口的进程，或增大范围：$env:PORT_RANGE=80; npm start\n` +
        `若必须固定单端口失败即退出：$env:STRICT_PORT=1; npm start`
    );
    process.exit(1);
  }

  const server = http.createServer(app);
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (STRICT_PORT) {
        console.error(
          `[知礼 validate] 端口 ${port} 已被占用 (EADDRINUSE)，且 STRICT_PORT=1 未启用顺延。\n` +
            `去掉 STRICT_PORT 或换端口：$env:PORT=3020; npm start`
        );
        process.exit(1);
      }
      console.warn(`[知礼 validate] 端口 ${port} 占用，尝试 ${port + 1}…`);
      server.close(() => tryListen(port + 1));
      return;
    }
    console.error('[知礼 validate] 服务启动失败:', err.message);
    process.exit(1);
  });

  server.listen(port, () => {
    const addr = server.address();
    const actual = typeof addr === 'object' && addr ? addr.port : port;
    writeListenPort(actual);
    console.log(`validate server http://127.0.0.1:${actual}`);
    console.log(
      `[知礼] 已在 server/.listen-port 写入端口；请在目录 prototype/client 执行 npm run dev（Vite 会自动代理到该端口）。`
    );
    if (actual !== BASE_PORT) {
      console.warn(
        `[知礼] 已从期望端口 ${BASE_PORT} 顺延到 ${actual}。若未用 Vite 自动读取，可手动设置（PowerShell 注意加引号）：\n` +
          `  $env:VITE_API_TARGET = 'http://127.0.0.1:${actual}'`
      );
    }
  });
}

tryListen(BASE_PORT);
