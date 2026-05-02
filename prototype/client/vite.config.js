import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 优先环境变量；否则读 API 启动时写入的 ../server/.listen-port；最后默认 3000 */
function resolveApiTarget(env) {
  const fromEnv = env.VITE_API_TARGET?.trim();
  if (fromEnv) return fromEnv;
  const portFile = path.resolve(__dirname, '../server/.listen-port');
  try {
    const p = fs.readFileSync(portFile, 'utf8').trim();
    if (/^\d+$/.test(p)) return `http://127.0.0.1:${p}`;
  } catch {
    /* 文件不存在：API 未启动或尚未写入 */
  }
  return 'http://127.0.0.1:3000';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = resolveApiTarget(env);
  return {
    plugins: [vue()],
    server: {
      proxy: { '/api': { target: apiTarget, changeOrigin: true } }
    }
  };
});
