/**
 * B4.8：推荐接口限流中间件
 * - IP 维度限流：每分钟最多 60 次
 * - 用户维度限流：每分钟最多 30 次
 */

import { getRedis } from '../db.js';

const IP_RATE_LIMIT = 60; // 每分钟最多请求数
const USER_RATE_LIMIT = 30; // 每分钟最多请求数
const WINDOW_SECONDS = 60;

function getRateLimitKey(prefix, identifier) {
  return `rate_limit:${prefix}:${identifier}`;
}

async function checkAndIncrementLimit(redis, key, limit) {
  if (!redis) return { allowed: true, remaining: limit };
  
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    const remaining = Math.max(0, limit - current);
    return { allowed: current <= limit, remaining };
  } catch (e) {
    console.warn('[知礼] 限流检查失败（降级放行）:', e.message);
    return { allowed: true, remaining: limit };
  }
}

export async function rateLimit(req, res, next) {
  const redis = getRedis();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = req.userId || 'anonymous';
  
  const [ipResult, userResult] = await Promise.all([
    checkAndIncrementLimit(redis, getRateLimitKey('ip', ip), IP_RATE_LIMIT),
    checkAndIncrementLimit(redis, getRateLimitKey('user', userId), USER_RATE_LIMIT),
  ]);
  
  res.setHeader('X-RateLimit-Remaining-IP', ipResult.remaining);
  res.setHeader('X-RateLimit-Remaining-User', userResult.remaining);
  
  if (!ipResult.allowed) {
    console.warn(`[知礼] IP 限流触发: ${ip}`);
    res.status(429).json({ error: 'RATE_LIMITED', message: 'IP 请求过于频繁，请稍后重试' });
    return;
  }
  
  if (!userResult.allowed) {
    console.warn(`[知礼] 用户限流触发: ${userId}`);
    res.status(429).json({ error: 'RATE_LIMITED', message: '用户请求过于频繁，请稍后重试' });
    return;
  }
  
  next();
}