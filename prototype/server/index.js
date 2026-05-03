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
const csvFile = path.join(dataDir, 'events.csv');

const BUDGET_RANGE = {
  lt100: [0, 100],
  '100-300': [100, 300],
  '300-500': [300, 500],
  '500-1000': [500, 1000],
  '1000+': [1000, 1e9]
};

app.use(cors());
app.use(express.json({ limit: '256kb' }));

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function priceInBudget(price, budgetKey) {
  if (!budgetKey) return true;
  const [lo, hi] = BUDGET_RANGE[budgetKey] || [0, 1e9];
  const p = Number(price) || 0;
  return p >= lo && p <= hi;
}

/** 列表筛选（PRD F2：场合 / 预算 / 风格） */
function filterShelf(list, q) {
  const occasion = q.occasion || '';
  const budget = q.budget || '';
  const style = q.style || '';
  return list.filter((p) => {
    if (occasion) {
      const oc = p.occasions || [];
      if (!oc.includes(occasion) && !oc.includes('universal')) return false;
    }
    if (budget && !priceInBudget(p.price, budget)) return false;
    if (style) {
      const st = p.styles || [];
      if (!st.includes(style)) return false;
    }
    return true;
  });
}

function sortHot(a, b) {
  return (a.hotRank ?? 999) - (b.hotRank ?? 999) || String(a.id).localeCompare(String(b.id));
}

/** 稳定热门：按 hotRank；支持筛选；无结果时回退全池 */
app.get('/api/hot', (req, res) => {
  const q = req.query || {};
  const shelf = { occasion: q.occasion, budget: q.budget, style: q.style };
  let pool = filterShelf(productsData, shelf);
  if (!pool.length) pool = productsData;
  const list = [...pool].sort(sortHot).slice(0, 20).map((p) => enrich(p));
  res.json(list);
});

app.post('/api/personalized', (req, res) => {
  const body = req.body || {};
  const { shelf, ...profile } = body;
  const shelfQ = shelf && typeof shelf === 'object' ? shelf : {};
  let pool = filterShelf(productsData, shelfQ);
  if (!pool.length) pool = productsData;

  const scored = pool
    .map((p) => ({
      item: { ...enrich(p, profile), score: computeScore(p, profile) },
      hotRank: p.hotRank ?? 999,
      id: p.id
    }))
    .sort((a, b) => b.item.score - a.item.score || a.hotRank - b.hotRank);

  let top = scored.slice(0, 20);
  if (top.length < 20) {
    const used = new Set(top.map((x) => x.id));
    const filler = [...productsData]
      .sort(sortHot)
      .filter((p) => !used.has(p.id))
      .slice(0, 20 - top.length)
      .map((p) => ({
        item: { ...enrich(p, profile), score: computeScore(p, profile) },
        hotRank: p.hotRank ?? 999,
        id: p.id
      }));
    top = top.concat(filler);
  }
  res.json(top.map((x) => x.item));
});

function ensureCsvHeader() {
  if (!fs.existsSync(csvFile)) {
    fs.writeFileSync(
      csvFile,
      'server_ts,event,user_id,group,page_name,client_ts,product_id,position,payload_json\n',
      'utf8'
    );
  }
}

function csvEscape(v) {
  if (v == null || v === '') return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

app.post('/api/collect', (req, res) => {
  const body = { ...req.body, serverTs: Date.now() };
  const line = JSON.stringify(body) + '\n';
  fs.appendFile(logFile, line, () => {});
  ensureCsvHeader();
  const pj = JSON.stringify(body);
  const row =
    [
      csvEscape(body.serverTs),
      csvEscape(body.event),
      csvEscape(body.user_id),
      csvEscape(body.group),
      csvEscape(body.page_name),
      csvEscape(body.timestamp),
      csvEscape(body.product_id),
      csvEscape(body.position),
      csvEscape(pj)
    ].join(',') + '\n';
  fs.appendFile(csvFile, row, () => {});
  res.json({ ok: true });
});

app.get('/api/export/events.csv', (req, res) => {
  if (!fs.existsSync(csvFile)) {
    res.status(404).type('text/plain').send('暂无 events.csv，请先产生埋点');
    return;
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="zhili_events.csv"');
  fs.createReadStream(csvFile).pipe(res);
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, products: productsData.length });
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
