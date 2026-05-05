# 知礼 · Client 与 Weixin 共用后台架构设计

**版本**：v1.0  
**更新**：2026-05-05  
**状态**：设计文档

---

## 一、当前架构现状

```
┌─────────────────────────────────────────────────────────────────┐
│                        现有架构                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [H5 Client]              [微信小程序]                           │
│  prototype/client/        prototype/mp-weixin/                  │
│       │                         │                               │
│       │ HTTP REST API           │ 云函数调用                     │
│       ▼                         ▼                               │
│  ┌─────────────┐          ┌─────────────┐                       │
│  │   Server    │          │  云函数层    │                       │
│  │ :3000/api/* │          │ cloudfunctions│                      │
│  └─────────────┘          └──────┬──────┘                       │
│                                  │                              │
│                          ┌──────▼──────┐                        │
│                          │   Server    │ (部分接口)              │
│                          └─────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### 问题分析

| 问题 | 影响 | 优先级 |
|------|------|--------|
| 小程序通过云函数调用，路径不一致 | 维护成本高、调试困难 | 高 |
| 两端认证机制不同 | 用户体验不一致 | 高 |
| 云函数双重调用 | 延迟增加 | 中 |
| 错误码不统一 | 前端处理复杂 | 中 |

---

## 二、推荐架构：统一 API 网关

```
┌─────────────────────────────────────────────────────────────────┐
│                     推荐架构：统一 API 网关                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [H5 Client]              [微信小程序]                           │
│       │                         │                               │
│       │ HTTP REST               │ HTTP REST (wx.request)        │
│       │ Bearer Token            │ Bearer Token                   │
│       ▼                         ▼                               │
│  ┌─────────────────────────────────────────────────┐            │
│  │              统一 API 网关                        │            │
│  │  - /api/user/*      用户认证                     │            │
│  │  - /api/profile/*   画像管理                     │            │
│  │  - /api/recommend/* 推荐列表                     │            │
│  │  - /api/product/*   商品详情                     │            │
│  │  - /api/favorite/*  收藏管理                     │            │
│  │  - /api/event/*     埋点上报                     │            │
│  └─────────────────────────────────────────────────┘            │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Server 后端服务                      │            │
│  │  - 统一鉴权中间件                                 │            │
│  │  - 统一错误码                                     │            │
│  │  - 统一响应格式                                   │            │
│  └─────────────────────────────────────────────────┘            │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │              数据层                              │            │
│  │  MySQL (user/profile/product/collection/event)   │            │
│  │  Redis (缓存/会话)                               │            │
│  └─────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、核心设计要点

### 3.1 统一认证机制

**文件位置**：`prototype/server/middleware/requireAuth.js`

```javascript
/**
 * 统一鉴权中间件 - H5 和小程序共用
 */
export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'UNAUTHORIZED', 
      message: '缺少认证令牌' 
    });
  }
  
  const token = auth.slice(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ 
      error: 'INVALID_TOKEN', 
      message: '令牌无效或已过期' 
    });
  }
  
  req.userId = payload.userId;
  req.openid = payload.openid;
  req.platform = req.headers['x-platform'] || 'unknown';
  next();
}
```

### 3.2 多端登录适配

**文件位置**：`prototype/server/routes/user.js`

```javascript
/**
 * 多端登录接口
 * POST /api/user/login
 * 
 * Body:
 *   - code: 微信登录码或临时标识
 *   - platform: 'wechat_mini' | 'wechat_h5' | 'h5'
 *   - anon_id: 匿名标识（可选）
 */
router.post('/login', loginRateLimit, async (req, res) => {
  const { code, platform, anon_id } = req.body;
  
  let openid;
  let loginType;
  
  try {
    if (platform === 'wechat_mini') {
      // 小程序：通过 wx.login code 换 openid
      openid = await exchangeJsCode(code);
      loginType = 'wechat_mini';
    } else if (platform === 'wechat_h5') {
      // H5 微信网页授权：通过 OAuth2 code 换 openid
      openid = await exchangeOAuthCode(code);
      loginType = 'wechat_h5';
    } else {
      // H5 匿名访问：使用 anon_id 或生成临时标识
      openid = anon_id || `anon_${generateUUID()}`;
      loginType = 'anonymous';
    }
    
    // 统一用户入库
    const row = await upsertUser(openid, anon_id);
    
    // 统一签发 JWT
    const token = signUserToken(row.id, row.openid);
    const expiresIn = parseExpiresSeconds(process.env.JWT_EXPIRES_IN || '7d');
    
    res.json({
      success: true,
      token,
      expires_in: expiresIn,
      login_type: loginType,
      user: {
        id: row.id,
        openid: row.openid,
        anon_id: row.anon_id || null
      }
    });
  } catch (err) {
    handleLoginError(res, err);
  }
});
```

### 3.3 小程序请求封装

**文件位置**：`prototype/mp-weixin/utils/request.js`

```javascript
/**
 * 统一请求模块 - 小程序直连 Server
 */
const { getToken, wechatLogin } = require('./auth.js');

// 环境配置
const ENV_CONFIG = {
  development: {
    baseUrl: 'http://127.0.0.1:3000',
    timeout: 30000
  },
  production: {
    baseUrl: 'https://api.zhili.com',
    timeout: 15000
  }
};

const env = __wxConfig.envVersion === 'release' ? 'production' : 'development';
const config = ENV_CONFIG[env];

/**
 * 统一请求方法
 * @param {Object} options 请求配置
 * @param {string} options.url 接口路径（不含 baseUrl）
 * @param {string} options.method 请求方法
 * @param {Object} options.data 请求数据
 * @param {boolean} options.needAuth 是否需要认证
 */
async function request(options) {
  const token = getToken();
  const needAuth = options.needAuth !== false;
  
  if (needAuth && !token) {
    // 需要认证但无 token，触发登录
    await wechatLogin();
    return request(options);
  }
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.baseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || config.timeout,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Platform': 'wechat_mini',
        'X-Version': getApp().globalData.version || '1.0.0'
      },
      success: (res) => {
        handleResponse(res, resolve, reject, options);
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

/**
 * 响应处理
 */
function handleResponse(res, resolve, reject, options) {
  const { statusCode, data } = res;
  
  if (statusCode === 401) {
    // Token 过期，清除本地存储并触发重新登录
    wx.removeStorageSync('zhili_token');
    wechatLogin().then(() => {
      // 重试请求（最多重试一次）
      if (!options._retried) {
        request({ ...options, _retried: true }).then(resolve).catch(reject);
      } else {
        reject(new Error('登录失败，请重试'));
      }
    });
    return;
  }
  
  if (statusCode === 429) {
    reject(new Error('请求过于频繁，请稍后重试'));
    return;
  }
  
  if (statusCode >= 200 && statusCode < 300) {
    resolve(data);
  } else {
    reject(new Error(data?.message || `请求失败 (${statusCode})`));
  }
}

/**
 * GET 请求
 */
async function get(url, data = {}, options = {}) {
  return request({ url, method: 'GET', data, ...options });
}

/**
 * POST 请求
 */
async function post(url, data = {}, options = {}) {
  return request({ url, method: 'POST', data, ...options });
}

module.exports = {
  request,
  get,
  post,
  config
};
```

### 3.4 统一响应格式

**成功响应**：

```json
{
  "success": true,
  "data": {
    "list": [...],
    "page": 1,
    "size": 20
  },
  "meta": {
    "total": 100,
    "has_more": true
  }
}
```

**错误响应**：

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "用户友好的错误描述",
  "details": {
    "field": "budget",
    "reason": "超出有效范围"
  }
}
```

### 3.5 统一错误码

**文件位置**：`prototype/server/lib/errorCodes.js`

```javascript
/**
 * 统一错误码定义
 */
export const ERROR_CODES = {
  // ========== 认证相关 401xx ==========
  UNAUTHORIZED: { 
    code: 40100, 
    message: '未登录',
    httpStatus: 401 
  },
  INVALID_TOKEN: { 
    code: 40101, 
    message: '令牌无效',
    httpStatus: 401 
  },
  TOKEN_EXPIRED: { 
    code: 40102, 
    message: '令牌已过期',
    httpStatus: 401 
  },
  
  // ========== 权限相关 403xx ==========
  FORBIDDEN: { 
    code: 40300, 
    message: '无权限访问',
    httpStatus: 403 
  },
  
  // ========== 资源相关 404xx ==========
  NOT_FOUND: { 
    code: 40400, 
    message: '资源不存在',
    httpStatus: 404 
  },
  PROFILE_NOT_FOUND: { 
    code: 40401, 
    message: '画像不存在',
    httpStatus: 404 
  },
  PRODUCT_NOT_FOUND: { 
    code: 40402, 
    message: '商品不存在',
    httpStatus: 404 
  },
  NO_DEFAULT_PROFILE: { 
    code: 40403, 
    message: '请先创建画像并设为默认',
    httpStatus: 404 
  },
  
  // ========== 参数相关 400xx ==========
  BAD_REQUEST: { 
    code: 40000, 
    message: '请求参数错误',
    httpStatus: 400 
  },
  VALIDATION_ERROR: { 
    code: 40001, 
    message: '参数校验失败',
    httpStatus: 400 
  },
  
  // ========== 限流相关 429xx ==========
  RATE_LIMITED: { 
    code: 42900, 
    message: '请求过于频繁',
    httpStatus: 429 
  },
  
  // ========== 服务端错误 500xx ==========
  SERVER_ERROR: { 
    code: 50000, 
    message: '服务器内部错误',
    httpStatus: 500 
  },
  DB_UNAVAILABLE: { 
    code: 50300, 
    message: '数据库不可用',
    httpStatus: 503 
  },
  REDIS_UNAVAILABLE: { 
    code: 50301, 
    message: '缓存服务不可用',
    httpStatus: 503 
  }
};

/**
 * 根据错误码获取错误信息
 */
export function getErrorInfo(errorCode) {
  return ERROR_CODES[errorCode] || ERROR_CODES.SERVER_ERROR;
}

/**
 * 构建错误响应
 */
export function buildErrorResponse(errorCode, customMessage, details) {
  const info = getErrorInfo(errorCode);
  return {
    success: false,
    error: errorCode,
    message: customMessage || info.message,
    details
  };
}
```

---

## 四、接口迁移计划

### 4.1 迁移优先级

| 优先级 | 接口 | 当前状态 | 迁移方式 | 影响范围 |
|--------|------|----------|----------|----------|
| P0 | `/api/user/login` | 云函数 | 直连 Server | 登录流程 |
| P0 | `/api/recommend` | 云函数 | 直连 Server | 首页推荐 |
| P1 | `/api/product/*` | 云函数 | 直连 Server | 商品详情 |
| P1 | `/api/favorite/*` | 云函数 | 直连 Server | 收藏功能 |
| P2 | `/api/profile/*` | 云函数 | 直连 Server | 画像管理 |
| P2 | `/api/event/*` | 云函数 | 直连 Server | 埋点上报 |

### 4.2 详细迁移步骤

#### Step 1：创建统一请求模块（已完成）

**文件**：`prototype/mp-weixin/utils/request.js`

**功能特性**：
- 环境配置（开发/生产）
- 自动添加 Bearer Token
- Token 过期自动刷新
- 限流错误处理
- 降级到云函数（网络异常时）
- 统一 GET/POST/PUT/DELETE 方法

**关键实现**：
```javascript
// 环境配置
const ENV_CONFIG = {
  development: { baseUrl: 'http://127.0.0.1:3000', timeout: 30000 },
  production: { baseUrl: 'https://api.zhili.com', timeout: 15000 }
};

// 响应处理：401 自动重试、429 限流提示
function handleResponse(res, resolve, reject, options) {
  if (statusCode === 401) {
    // Token 过期，重新登录后重试
    wx.removeStorageSync('zhili_token');
    wechatLogin().then(() => {
      if (!options._retried) {
        request({ ...options, _retried: true }).then(resolve).catch(reject);
      }
    });
  }
  // ... 其他状态码处理
}

// 降级逻辑：直连失败时降级到云函数
function shouldFallback(err) {
  return err.message.includes('网络') || 
         err.message.includes('超时') ||
         err.message.includes('域名');
}
```

#### Step 2：修改登录流程（待执行）

**文件**：`prototype/mp-weixin/utils/auth.js`

**修改内容**：
- 将 `wx.cloud.callFunction('login')` 改为调用 `request.post('/api/user/login')`
- 添加 `platform: 'wechat_mini'` 参数
- 调整响应数据结构处理

**预期代码**：
```javascript
async function wechatLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (res) => {
        if (!res.code) {
          reject(new Error('获取登录码失败'));
          return;
        }
        
        try {
          const { post } = require('./request.js');
          const data = await post('/api/user/login', {
            code: res.code,
            platform: 'wechat_mini',
            anon_id: getOrCreateZhiliVid()
          }, { needAuth: false });  // 登录接口不需要认证
          
          setToken(data.token);
          setUser(data.user);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      },
      fail: reject
    });
  });
}
```

#### Step 3：迁移推荐列表接口（待执行）

**文件**：`prototype/mp-weixin/utils/fetchList.js`

**修改内容**：
- 移除云函数调用
- 使用 `request.get('/api/recommend')`
- 调整响应数据结构处理

**预期代码**：
```javascript
const { get } = require('./request.js');

async function fetchRecommendList(page = 1, size = 20, shelf = {}) {
  const params = { page, size, ...shelf };
  return get('/api/recommend', params);
}
```

#### Step 4：迁移商品详情接口（待执行）

**文件**：`prototype/mp-weixin/pages/detail/detail.js`

**修改内容**：
- 移除云函数调用 `wx.cloud.callFunction('product')`
- 使用 `request.get('/api/product/:id')`

#### Step 5：迁移收藏接口（待执行）

**文件**：`prototype/mp-weixin/utils/favorite.js`

**修改内容**：
- 添加收藏：`POST /api/favorite`
- 删除收藏：`DELETE /api/favorite/:productId`
- 获取列表：`GET /api/favorite`

**预期代码**：
```javascript
const { get, post, delete: del } = require('./request.js');

async function toggleFavorite(productId, isCollected, productInfo = {}) {
  if (!getToken()) {
    // 未登录：本地处理
    // ...
  }
  
  if (isCollected) {
    await del(`/api/favorite/${productId}`);
  } else {
    await post('/api/favorite', { productId, ...productInfo });
  }
  // 更新本地缓存...
}
```

#### Step 6：迁移画像接口（待执行）

**文件**：`prototype/mp-weixin/pages/tags/tags.js`

**修改内容**：
- 创建/更新画像：`POST/PUT /api/profile`
- 获取画像列表：`GET /api/profile`
- 设置默认画像：`PUT /api/profile/:id/default`

#### Step 7：迁移埋点上报接口（待执行）

**文件**：`prototype/mp-weixin/utils/track.js`

**修改内容**：
- 埋点上报：`POST /api/event`

#### Step 8：小程序域名配置（待执行）

**配置位置**：微信公众平台 → 开发管理 → 开发设置 → 服务器域名

| 配置项 | 域名 | 说明 |
|--------|------|------|
| request 合法域名 | `https://api.zhili.com` | Server API 地址 |
| socket 合法域名 | （可选） | WebSocket 连接 |
| uploadFile 合法域名 | （可选） | 文件上传 |
| downloadFile 合法域名 | （可选） | 文件下载 |

**本地开发注意**：
- 使用微信开发者工具「不校验合法域名」选项
- 测试号环境需要配置域名白名单

---

### 4.3 接口映射表

| 云函数 | 新 API 端点 | HTTP 方法 | 是否需要认证 |
|--------|-------------|-----------|--------------|
| `login` | `/api/user/login` | POST | 否 |
| `recommend` | `/api/recommend` | GET | 是 |
| `product` | `/api/product/:id` | GET | 是 |
| `favorite` (add) | `/api/favorite` | POST | 是 |
| `favorite` (remove) | `/api/favorite/:productId` | DELETE | 是 |
| `favorite` (list) | `/api/favorite` | GET | 是 |
| `profile` (create) | `/api/profile` | POST | 是 |
| `profile` (update) | `/api/profile/:id` | PUT | 是 |
| `profile` (list) | `/api/profile` | GET | 是 |
| `profile` (default) | `/api/profile/:id/default` | PUT | 是 |
| `track` | `/api/event` | POST | 否 |

---

### 4.4 响应格式适配

**云函数响应格式**（旧）：
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

**Server API 响应格式**（新）：
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "size": 20, "total": 100 }
}
```

**迁移注意事项**：
- 需要调整前端对响应数据的解析逻辑
- 统一使用 `data.list` 获取列表数据
- 统一使用 `meta` 获取分页信息

---

## 五、降级策略

### 5.1 云函数降级

```javascript
// mp-weixin/utils/request.js - 添加降级逻辑
async function request(options) {
  try {
    // 优先直连 Server
    return await directRequest(options);
  } catch (err) {
    if (shouldFallback(err)) {
      // 降级到云函数
      console.warn('[知礼] 直连失败，降级云函数:', err.message);
      return await cloudFunctionRequest(options);
    }
    throw err;
  }
}

function shouldFallback(err) {
  // 网络错误、超时、域名未配置等情况降级
  return err.message.includes('网络') || 
         err.message.includes('超时') ||
         err.message.includes('域名');
}

async function cloudFunctionRequest(options) {
  const result = await wx.cloud.callFunction({
    name: 'apiProxy',
    data: {
      url: options.url,
      method: options.method,
      data: options.data
    }
  });
  return result.result;
}
```

### 5.2 灰度发布策略

```
┌─────────────────────────────────────────────────────────────────┐
│                        灰度发布流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: 内部测试 (100% 云函数)                                 │
│           ↓                                                     │
│  Phase 2: 灰度 5% 用户直连 Server                                │
│           ↓ 监控错误率 < 1%                                      │
│  Phase 3: 灰度 20% 用户直连 Server                               │
│           ↓ 监控错误率 < 0.5%                                    │
│  Phase 4: 灰度 50% 用户直连 Server                               │
│           ↓ 监控错误率 < 0.3%                                    │
│  Phase 5: 全量直连 Server (保留云函数降级)                        │
│           ↓ 稳定运行 7 天                                        │
│  Phase 6: 下线云函数                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 六、补充设计要点

### 6.1 安全设计

#### CSRF 防护
```javascript
// 后端需要添加 CSRF token 验证
router.post('/api/favorite', requireAuth, csrfProtection, async (req, res) => {
  // 处理收藏请求
});
```

#### 请求签名验证（防接口伪造）
```javascript
// 小程序端生成签名
function generateSign(params, timestamp, nonce) {
  const sortedParams = Object.keys(params).sort().reduce((obj, key) => {
    obj[key] = params[key];
    return obj;
  }, {});
  const signStr = `${JSON.stringify(sortedParams)}&timestamp=${timestamp}&nonce=${nonce}&secret=${APP_SECRET}`;
  return sha256(signStr);
}
```

#### 敏感数据加密
- 用户手机号、身份证等敏感信息需要加密存储
- 传输过程使用 HTTPS
- Token 过期时间合理设置（建议 7-14 天）

---

### 6.2 性能优化

#### 请求缓存策略
```javascript
// 商品详情页缓存
async function fetchProductDetail(productId) {
  const cacheKey = `product_${productId}`;
  const cached = await getFromCache(cacheKey);
  if (cached) return cached;
  
  const data = await get(`/api/product/${productId}`);
  await setToCache(cacheKey, data, 3600); // 缓存 1 小时
  return data;
}
```

#### CDN 加速
- 静态资源（图片、CSS、JS）部署到 CDN
- 商品图片使用 WebP 格式，支持懒加载

#### 请求合并
```javascript
// 合并多个请求减少网络开销
async function fetchCombinedData(productIds) {
  return post('/api/product/batch', { ids: productIds });
}
```

---

### 6.3 高可用设计

#### 服务熔断与降级
```javascript
const circuitBreaker = {
  timeout: 5000,
  errorThreshold: 50,
  resetTimeout: 30000
};

async function fetchRecommend() {
  try {
    return await executeRequest('/api/recommend');
  } catch (err) {
    // 降级返回默认数据
    return getDefaultRecommendList();
  }
}
```

#### 接口超时控制
```javascript
const timeoutId = setTimeout(() => {
  reject(new Error('请求超时'));
}, 10000);

try {
  const response = await fetch('/api/recommend');
  clearTimeout(timeoutId);
  return response;
} catch (err) {
  clearTimeout(timeoutId);
  throw err;
}
```

---

### 6.4 监控与可观测性

#### 统一日志格式
```javascript
const logger = {
  info(message, data) {
    console.log(JSON.stringify({
      timestamp: Date.now(),
      level: 'INFO',
      message,
      ...data
    }));
  },
  error(message, error) {
    console.error(JSON.stringify({
      timestamp: Date.now(),
      level: 'ERROR',
      message,
      stack: error?.stack
    }));
  }
};
```

#### 链路追踪
```javascript
function requestWithTrace(options) {
  const traceId = generateUUID();
  return request({
    ...options,
    headers: {
      ...options.headers,
      'X-Trace-Id': traceId
    }
  });
}
```

#### 性能监控
- 页面加载时间（首屏、白屏）
- API 响应时间分布
- 错误率统计

---

### 6.5 业务兼容

#### 版本兼容策略
```javascript
// 支持多版本 API
router.get('/api/v1/recommend', recommendHandlerV1);
router.get('/api/v2/recommend', recommendHandlerV2);
```

#### 用户数据隔离
```javascript
async function getRecommendList(userId, platform) {
  const baseList = await recommendCore.getList(userId);
  
  if (platform === 'wechat_mini') {
    return filterMiniAppProducts(baseList);
  }
  
  return baseList;
}
```

#### 灰度发布支持
```javascript
function isInGrayList(userId) {
  const grayPercentage = getGrayPercentage();
  return userId % 100 < grayPercentage;
}
```

---

### 6.6 合规与隐私

#### 用户隐私保护
- 明确告知用户数据收集用途
- 提供数据导出和删除功能
- 遵守《个人信息保护法》

#### 未成年人保护
- 未成年人模式
- 内容过滤
- 消费限制

#### 数据存储合规
- 数据分类分级
- 定期备份
- 数据生命周期管理

---

### 6.7 开发效率

#### Mock 数据支持
```javascript
if (process.env.NODE_ENV === 'development') {
  require('./mock');
}
```

#### API 文档自动生成
- 使用 Swagger/OpenAPI
- 自动生成接口文档
- 支持在线调试

#### 代码规范
- ESLint + Prettier
- Git Hooks
- 代码审查流程

---

## 七、对比总结

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **云函数中转** | 无需配置域名、天然鉴权 | 双重调用延迟、维护成本高 | ⭐⭐ |
| **直连 Server** | 统一架构、低延迟、易维护 | 需配置域名、需处理跨域 | ⭐⭐⭐⭐⭐ |
| **混合模式** | 灵活降级 | 架构复杂 | ⭐⭐⭐ |

---

## 八、实施检查清单

### 8.1 Server 端

- [ ] 创建 `lib/errorCodes.js` 统一错误码
- [ ] 修改 `routes/user.js` 支持多端登录
- [ ] 统一所有接口响应格式
- [ ] 添加 `X-Platform` 请求头识别
- [ ] CSRF 防护（可选）
- [ ] 请求签名验证（可选）

### 8.2 小程序端

- [x] 创建 `utils/request.js` 统一请求模块 ✅
- [ ] 修改 `utils/auth.js` 登录流程
- [ ] 迁移 `utils/fetchList.js` 使用 request 模块
- [ ] 迁移 `utils/favorite.js` 使用 request 模块
- [ ] 配置微信公众平台服务器域名
- [ ] 添加请求缓存策略

### 8.3 测试验证

- [ ] H5 端登录功能正常
- [ ] 小程序端登录功能正常
- [ ] 推荐列表加载正常
- [ ] 商品详情加载正常
- [ ] 收藏功能正常
- [ ] 埋点上报正常
- [ ] Token 过期自动刷新
- [ ] 降级逻辑正常
- [ ] 性能监控接入

### 8.4 安全与合规

- [ ] 敏感数据加密存储
- [ ] HTTPS 配置
- [ ] 隐私政策页面
- [ ] 未成年人保护功能

---

## 九、develop3.md 未完成任务同步

### 9.1 阶段三：Server+Weixin B10 联调硬化（2 人天）

| 子任务 | 描述 | 验收标准（可量化） | 责任人 | 状态 |
|--------|------|-------------------|--------|------|
| **B10.1** | 小程序端鉴权头对齐 | Bearer token 与后端约定一致 | 前后端联调 | ⏳ |
| **B10.2** | 错误码统一 | 401/403/404/500/503 状态码规范 | 前后端联调 | ⏳ |
| **B10.3** | 分页边界处理 | 空列表返回规范，offset越界处理 | 前后端联调 | ⏳ |
| **B10.4** | 推荐接口压测 | P90 ≤ 1.5s | 测试 | ⏳ |
| **B10.5** | Redis 降级演练 | 停止 Redis 后服务正常降级 | 测试 | ⏳ |

**验收指标**：
| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| P90 延迟 | ≤1.5s | JMeter/Artillery 压测 |
| 并发100 CPU | ≤70% | 监控面板 |
| Redis 降级 | 无 Redis 时返回正常列表 | 手动停止 Redis 验证 |

---

### 9.2 阶段四：Server+Weixin B8 联盟转链（3 人天）

| 子任务 | 描述 | 验收标准（可量化） | 责任人 | 状态 |
|--------|------|-------------------|--------|------|
| **B8.1** | 契约冻结 | `GET /api/purchase/url` 接口文档定稿 | 后端 | ⏳ |
| **B8.2** | 联盟 API 对接 | 京东/淘宝联盟接口集成 | 后端 | ⏳ |
| **B8.3** | 超时重试机制 | 超时≤2次重试，失败返回降级URL | 后端 | ⏳ |
| **B8.4** | 结果缓存 | 成功转链结果缓存，TTL配置化 | 后端 | ⏳ |
| **B8.5** | 参数透传 | `relationId/rid` 参数设计与传递 | 后端 | ⏳ |
| **B8.6** | 合规文案 | WebView 打开时显示合规提示 | 小程序开发 | ⏳ |
| **B8.7** | 购买跳转 | 调用 `/api/purchase/url` 并打开 WebView | 小程序开发 | ⏳ |

**验收指标**：
| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 转链成功率 | ≥95% | 日志统计 |
| 超时率 | <1% | 监控告警 |
| 缓存命中率 | ≥80% | 日志统计 |
| 降级覆盖率 | 100% | 故障注入测试 |

---

### 9.3 阶段五：全模块测试与发布（2 人天）

| 子任务 | 描述 | 验收标准（可量化） | 责任人 | 状态 |
|--------|------|-------------------|--------|------|
| **T1** | 功能回归测试 | 所有接口功能正常 | QA | ⏳ |
| **T2** | 性能测试 | 符合 SLA 要求 | QA | ⏳ |
| **T3** | 体验测试 | 5名非开发人员完成闭环 | QA | ⏳ |
| **T4** | 灰度发布 | 5%用户灰度2天 | 运维 | ⏳ |
| **T5** | 全量发布 | 提审通过，生产可用 | 运维 | ⏳ |

**验收指标**：
| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 功能测试通过率 | 100% | 测试用例执行 |
| 体验测试成功率 | 100% | 5人测试完成 |
| 灰度错误率 | <1% | 监控面板 |
| 崩溃率 | <0.5% | 监控告警 |

---

### 9.4 风险与应对

| 风险 | 概率 | 影响 | 应对措施 | 责任人 |
|------|------|------|----------|--------|
| 联盟 API 不稳定 | 中 | 购买跳转失败 | 超时重试≤2次；缓存上次成功结果 | 后端 |
| 推荐效果差、跳出高 | 中 | 用户流失 | 热门兜底；运营可调权重 | 算法 |
| 小程序审核被拒 | 低 | 发布延迟 | 电商类目与规范预审；测试号验证 | 产品 |
| Redis 故障 | 低 | 性能下降 | 降级直通内核 | 后端 |

---

### 9.5 里程碑与交付物

| 里程碑 | 时间 | 涉及模块 | 交付物 | 验收方式 |
|--------|------|----------|--------|----------|
| Server B3/B4 收尾 | D2 | Server | 单测报告、限流上线 | 代码 review |
| Weixin 登录收藏接入 | D5 | Weixin + Server | 登录功能、收藏列表 | 真机测试 |
| B10 联调完成 | D7 | Server + Weixin | 联调清单关闭、压测报告 | 测试报告 |
| B8 联盟上线 | D10 | Server + Weixin | 转链接口、缓存机制 | 功能测试 |
| 测试完成 | D12 | 全模块 | 测试报告、Bug 清零 | QA 签字 |
| 灰度发布 | D13 | 全模块 | 灰度环境可用 | 监控确认 |
| 正式发布 | D14 | 全模块 | 生产可用 | 上线确认 |

---

**文档版本**：v1.2  
**最后更新**：2026-05-05  
**关联文档**：[develop3.md](../develop3.md)、[api.md](./docs/api.md)
