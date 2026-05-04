/**
 * 一键：启动 Docker 中的 MySQL + Redis → 等待就绪 → 建表并导入商品种子
 * 在 prototype 目录执行：npm run dev:db
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as delay } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_ROOT = path.resolve(__dirname, '..');
const SERVER_ROOT = path.join(PROTOTYPE_ROOT, 'server');
const DOCKER_ENV_EXAMPLE = path.join(SERVER_ROOT, '.env.docker.example');
const SERVER_ENV = path.join(SERVER_ROOT, '.env');

/** 须与 prototype/docker-compose.yml 中 MYSQL_ROOT_PASSWORD 一致 */
const MYSQL_ROOT_PASSWORD = process.env.ZHILI_MYSQL_ROOT_PASSWORD || '123456';

/** Windows 上 Docker Desktop 默认不把 CLI 写入 PATH 时，补全以便 npm 脚本内可调用 */
function prependDockerWindowsBin() {
  if (process.platform !== 'win32') return;
  const base = process.env.ProgramFiles || 'C:\\Program Files';
  const dir = path.join(base, 'Docker', 'Docker', 'resources', 'bin');
  const exe = path.join(dir, 'docker.exe');
  if (!fs.existsSync(exe)) return;
  const sep = path.delimiter;
  const p = process.env.PATH || '';
  if (!p.toLowerCase().includes(dir.toLowerCase())) {
    process.env.PATH = `${dir}${sep}${p}`;
  }
}

function assertDockerDaemon() {
  const r = spawnSync('docker', ['info'], {
    cwd: PROTOTYPE_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status === 0) return;
  console.error('[知礼] 无法连接 Docker 引擎（daemon 未运行或未就绪）。');
  console.error('[知礼] 请从「开始」菜单打开 Docker Desktop，等托盘鲸鱼图标就绪后再执行: npm run dev:db');
  if (process.platform === 'win32') {
    console.error('[知礼] 若仍提示找不到 docker，请把目录加入用户 PATH 后重开终端：');
    console.error('     C:\\Program Files\\Docker\\Docker\\resources\\bin');
  }
  process.exit(1);
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: PROTOTYPE_ROOT,
    shell: false,
    ...opts,
  });
  if (r.error) {
    console.error('[知礼]', r.error.message);
    console.error('[知礼] 请确认已安装 Docker 且可执行 docker compose。');
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function dockerInspectHealth(name) {
  const r = spawnSync(
    'docker',
    ['inspect', '--format={{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Running}}{{end}}', name],
    { encoding: 'utf8', cwd: PROTOTYPE_ROOT }
  );
  if (r.error) return null;
  const s = (r.stdout || '').trim();
  if (s === 'true') return 'running-no-healthcheck';
  return s || null;
}

prependDockerWindowsBin();
assertDockerDaemon();

console.log('[知礼] 启动 MySQL / Redis 容器（prototype/docker-compose.yml）…');
sh('docker', ['compose', 'up', '-d']);

console.log('[知礼] 等待 MySQL 健康检查…');
for (let i = 0; i < 90; i++) {
  const st = dockerInspectHealth('zhili-mysql');
  if (st === 'healthy') break;
  if (i === 89) {
    console.error('[知礼] MySQL 未在预期时间内就绪，请执行: docker compose logs mysql');
    process.exit(1);
  }
  await delay(1000);
}

if (!fs.existsSync(SERVER_ENV) && fs.existsSync(DOCKER_ENV_EXAMPLE)) {
  fs.copyFileSync(DOCKER_ENV_EXAMPLE, SERVER_ENV);
  console.log('[知礼] 已创建 server/.env（来自 .env.docker.example，密码与 Docker MySQL 一致）');
}

/** 已有 .env 但 DB_PASSWORD 为空时，MySQL 会报 using password: NO */
function ensureEnvMysqlPassword() {
  if (!fs.existsSync(SERVER_ENV)) return;
  const raw = fs.readFileSync(SERVER_ENV, 'utf8');
  const m = raw.match(/^DB_PASSWORD=(.*)$/m);
  const val = m ? String(m[1]).replace(/^['"]|['"]$/g, '').trim() : null;
  if (val !== null && val !== '') return;
  const line = `DB_PASSWORD=${MYSQL_ROOT_PASSWORD}`;
  const next = /^DB_PASSWORD=/m.test(raw)
    ? raw.replace(/^DB_PASSWORD=.*$/m, line)
    : `${raw.replace(/\s+$/, '')}\n${line}\n`;
  fs.writeFileSync(SERVER_ENV, next, 'utf8');
  console.log('[知礼] 已补全 server/.env 中的 DB_PASSWORD（与 Docker MySQL 一致）');
}

ensureEnvMysqlPassword();

const dbEnv = {
  ...process.env,
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASSWORD: MYSQL_ROOT_PASSWORD,
  DB_NAME: 'zhili_mvp',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '6379',
};

/** 直接 node 子进程，避免 Windows 上 `npm run init-db` 偶发非零退出码 */
function runNodeScript(filename) {
  const script = path.join(SERVER_ROOT, filename);
  const r = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    cwd: SERVER_ROOT,
    env: dbEnv,
  });
  if (r.error) {
    console.error('[知礼]', r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('[知礼] 执行 migrate + seed…');
runNodeScript('migrate.js');
runNodeScript('seed.js');

console.log('');
console.log('[知礼] 完成。下一步：cd prototype/server && npm start（或另开终端启动 client）');
console.log('[知礼] 关闭容器：在 prototype 目录执行 npm run docker:down');
