import http from 'http';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, initRedis, getPool, getRedis, query } from './db.js';
import userRouter from './routes/user.js';
import profileRouter from './routes/profile.js';
import recommendRouter from './routes/recommend.js';
import productRouter from './routes/product.js';
import favoriteRouter from './routes/favorite.js';
import eventRouter from './routes/event.js';
import adminProductRouter from './routes/adminProduct.js';
import adminAuthRouter from './routes/adminAuth.js';
import adminStatsRouter from './routes/adminStats.js';
import adminUploadRouter from './routes/adminUpload.js';
import { tryDualWriteCollectToEvent } from './lib/eventDualWrite.js';
import { productsData } from './productsData.js';
import { resolveProductById } from './lib/productResolve.js';
import { getListedProductPool } from './lib/productCatalog.js';
import { relatedProductCards } from './lib/relatedCore.js';
import { parseProfileFromQuery } from './routes/product.js';
import {
  parsePaging,
  shelfFromQuery,
  runHotList,
  runPersonalizedList,
  parsePagingFromBody,
} from './lib/recommendCore.js';
import { wechatAuthConfigured } from './lib/wechat.js';
import { jwtConfigured } from './lib/jwt.js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

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
const BASE_PORT = Number(process.env.PORT) || 3000;
const PORT_RANGE = Math.min(Math.max(Number(process.env.PORT_RANGE) || 40, 1), 200);
const STRICT_PORT = String(process.env.STRICT_PORT || '') === '1';
const dataDir = path.join(__dirname, 'data');
const logFile = path.join(dataDir, 'events.jsonl');
const csvFile = path.join(dataDir, 'events.csv');

app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin/stats', adminStatsRouter);
app.use('/api/admin/upload', adminUploadRouter);

app.use('/api/user', userRouter);
app.use('/api/profile', profileRouter);
app.use('/api/recommend', recommendRouter);
app.use('/api/product', productRouter);
app.use('/api/favorite', favoriteRouter);
app.use('/api/event', eventRouter);
app.use('/api/admin/products', adminProductRouter);

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/hot', async (req, res) => {
  const q = req.query || {};
  const { limit, offset } = parsePaging(q);
  const shelf = shelfFromQuery(q);
  try {
    const pool = await getListedProductPool(productsData);
    res.json(runHotList(pool, shelf, offset, limit));
  } catch (e) {
    console.error('[知礼] /api/hot 失败:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

app.post('/api/personalized', async (req, res) => {
  const body = req.body || {};
  const { shelf, ...profile } = body;
  const { limit, offset } = parsePagingFromBody(body);
  const shelfQ = shelf && typeof shelf === 'object' ? shelf : {};
  try {
    const pool = await getListedProductPool(productsData);
    res.json(runPersonalizedList(pool, profile, shelfQ, offset, limit));
  } catch (e) {
    console.error('[知礼] /api/personalized 失败:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

app.get('/api/related/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const resolved = await resolveProductById(id, productsData);
    if (!resolved) {
      res.status(404).json([]);
      return;
    }
    const profile = parseProfileFromQuery(req.query);
    const pool = await getListedProductPool(productsData);
    res.json(relatedProductCards(pool, resolved.product, profile));
  } catch (e) {
    console.error('[知礼] /api/related 失败:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
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

app.post('/api/collect', async (req, res) => {
  const body = { ...req.body, serverTs: Date.now() };
  const line = JSON.stringify(body) + '\n';
  try {
    await fs.promises.appendFile(logFile, line);
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
    await fs.promises.appendFile(csvFile, row);
  } catch (e) {
    console.error('[知礼] collect 落盘失败:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: '埋点落盘失败' });
    return;
  }
  await tryDualWriteCollectToEvent(body);
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

app.get('/api/health', async (req, res) => {
  const status = {
    ok: true,
    products: productsData.length,
    database: 'not_connected',
    redis: 'not_connected',
    db_product_count: null,
    auth_configured: wechatAuthConfigured(),
    jwt_strong_secret: jwtConfigured(),
  };

  if (getPool()) {
    try {
      await query('SELECT 1');
      status.database = 'connected';
      try {
        const rows = await query('SELECT COUNT(*) AS c FROM product');
        status.db_product_count = Number(rows[0]?.c ?? 0);
      } catch {
        status.db_product_count = null;
      }
    } catch {
      status.database = 'error';
      status.ok = false;
    }
  }

  if (getRedis()) {
    try {
      await getRedis().ping();
      status.redis = 'connected';
    } catch {
      status.redis = 'error';
    }
  }

  res.json(status);
});

async function tryListen(port) {
  const endExclusive = BASE_PORT + PORT_RANGE;
  if (port >= endExclusive) {
    console.error(
      `[知礼] 在端口 ${BASE_PORT}–${endExclusive - 1} 内未找到空闲端口。\n` +
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
          `[知礼] 端口 ${port} 已被占用 (EADDRINUSE)，且 STRICT_PORT=1 未启用顺延。\n` +
            `去掉 STRICT_PORT 或换端口：$env:PORT=3020; npm start`
        );
        process.exit(1);
      }
      console.warn(`[知礼] 端口 ${port} 占用，尝试 ${port + 1}…`);
      server.close(() => tryListen(port + 1));
      return;
    }
    console.error('[知礼] 服务启动失败:', err.message);
    process.exit(1);
  });

  server.listen(port, () => {
    const addr = server.address();
    const actual = typeof addr === 'object' && addr ? addr.port : port;
    writeListenPort(actual);
    console.log(`[知礼 MVP] 服务已启动 http://127.0.0.1:${actual}`);
    console.log(
      `[知礼] 已在 server/.listen-port 写入端口；请在目录 prototype/client 执行 npm run dev。`
    );
    if (actual !== BASE_PORT) {
      console.warn(
        `[知礼] 已从期望端口 ${BASE_PORT} 顺延到 ${actual}。`
      );
    }
  });
}

async function startServer() {
  console.log('[知礼 MVP] 初始化数据库连接...');
  try {
    await initDatabase();
  } catch (error) {
    console.warn('[知礼 MVP] MySQL 连接失败，将使用 JSON 文件作为数据源:', error.message);
  }

  console.log('[知礼 MVP] 初始化 Redis 连接...');
  try {
    await initRedis();
  } catch (error) {
    console.warn('[知礼 MVP] Redis 连接失败，将使用内存缓存降级:', error.message);
  }

  if (!String(process.env.ZHILI_ADMIN_CONSOLE_PASSWORD || '').trim()) {
    console.warn(
      '[知礼] 未设置 ZHILI_ADMIN_CONSOLE_PASSWORD，运营后台密码登录不可用（503）。' +
        '请在 prototype/server/.env 中配置后重启（参考 .env.example）。'
    );
  }

  console.log('[知礼 MVP] 启动服务...');
  tryListen(BASE_PORT);
}

startServer();