import mysql from 'mysql2/promise';
import redis from 'redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

let pool = null;
let redisClient = null;

export async function initDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'zhili_mvp',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    });

    const connection = await pool.getConnection();
    await connection.release();
    console.log('[知礼 DB] MySQL 连接池初始化成功');
  } catch (error) {
    if (pool) {
      try {
        await pool.end();
      } catch {
        /* ignore */
      }
      pool = null;
    }
    console.error('[知礼 DB] MySQL 连接初始化失败:', error.message);
    throw error;
  }
}

export async function initRedis() {
  try {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    redisClient = redis.createClient({
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        host,
        port,
        connectTimeout: 5000,
      },
    });

    redisClient.on('error', (err) => {
      console.error('[知礼 Redis] 客户端错误:', err.message);
    });

    await redisClient.connect();
    console.log('[知礼 Redis] 连接成功');
  } catch (error) {
    console.warn('[知礼 Redis] 连接失败（将使用内存缓存降级）:', error.message);
    redisClient = null;
  }
}

export function getPool() {
  return pool;
}

export function getRedis() {
  return redisClient;
}

export async function query(sql, params = []) {
  if (!pool) {
    throw new Error('数据库连接池未初始化');
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function execute(sql, params = []) {
  if (!pool) {
    throw new Error('数据库连接池未初始化');
  }
  const [result] = await pool.execute(sql, params);
  return result;
}