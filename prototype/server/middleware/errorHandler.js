/**
 * B10.2：统一错误处理中间件
 * 确保所有错误返回统一格式
 */

export const ERROR_CODES = {
  SUCCESS: 'SUCCESS',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  SERVER_ERROR: 'SERVER_ERROR',
};

export const ERROR_MESSAGES = {
  [ERROR_CODES.BAD_REQUEST]: '请求参数错误',
  [ERROR_CODES.UNAUTHORIZED]: '未授权，请先登录',
  [ERROR_CODES.FORBIDDEN]: '无权限访问',
  [ERROR_CODES.NOT_FOUND]: '资源不存在',
  [ERROR_CODES.RATE_LIMITED]: '请求过于频繁，请稍后重试',
  [ERROR_CODES.DB_UNAVAILABLE]: '数据库暂时不可用',
  [ERROR_CODES.SERVER_ERROR]: '服务器内部错误',
};

export const STATUS_CODES = {
  [ERROR_CODES.BAD_REQUEST]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.DB_UNAVAILABLE]: 503,
  [ERROR_CODES.SERVER_ERROR]: 500,
};

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  
  const code = err.code || ERROR_CODES.SERVER_ERROR;
  const status = STATUS_CODES[code] || 500;
  const message = err.message || ERROR_MESSAGES[code] || '未知错误';
  
  const response = {
    error: code,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
  };
  
  if (err.details) {
    response.details = err.details;
  }
  
  console.error(`[知礼错误] ${code} | ${req.method} ${req.path} | ${message}`);
  
  res.status(status).json(response);
}

export function createError(code, message, details) {
  const err = new Error(message || ERROR_MESSAGES[code]);
  err.code = code;
  if (details) {
    err.details = details;
  }
  return err;
}

export function wrapAsync(fn) {
  return function(req, res, next) {
    fn(req, res, next).catch(next);
  };
}