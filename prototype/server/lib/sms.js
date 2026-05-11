/**
 * 短信验证码服务（Mock实现）
 * 生产环境应接入阿里云/腾讯云短信服务
 */

// 内存存储验证码 { phone: { code, expiresAt } }
const codeStore = new Map();

// 验证码有效期（分钟）
const CODE_EXPIRE_MINUTES = 5;

// 发送间隔限制（秒）
const SEND_INTERVAL_SECONDS = 60;

/**
 * 生成6位数字验证码
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 发送验证码
 * @param {string} phone - 手机号
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function sendVerificationCode(phone) {
  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, message: '手机号格式不正确' };
  }

  // 检查发送间隔
  const existing = codeStore.get(phone);
  if (existing && Date.now() < existing.sentAt + SEND_INTERVAL_SECONDS * 1000) {
    const remaining = Math.ceil((existing.sentAt + SEND_INTERVAL_SECONDS * 1000 - Date.now()) / 1000);
    return { success: false, message: `请${remaining}秒后再试` };
  }

  // 生成验证码
  const code = generateCode();
  const expiresAt = Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000;

  // 存储验证码
  codeStore.set(phone, {
    code,
    expiresAt,
    sentAt: Date.now()
  });

  // Mock发送：打印到控制台
  console.log(`[知礼 短信] 发送验证码 ${code} 到 ${phone}，有效期 ${CODE_EXPIRE_MINUTES} 分钟`);

  // 清理过期验证码
  cleanupExpiredCodes();

  return { success: true, message: '验证码已发送' };
}

/**
 * 验证验证码
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @returns {boolean}
 */
export function verifyCode(phone, code) {
  const stored = codeStore.get(phone);
  
  if (!stored) {
    return false;
  }

  if (Date.now() > stored.expiresAt) {
    codeStore.delete(phone);
    return false;
  }

  if (stored.code !== code) {
    return false;
  }

  // 验证成功后删除验证码（一次性使用）
  codeStore.delete(phone);
  return true;
}

/**
 * 清理过期验证码
 */
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [phone, data] of codeStore.entries()) {
    if (now > data.expiresAt) {
      codeStore.delete(phone);
    }
  }
}

// 定时清理过期验证码
setInterval(cleanupExpiredCodes, 60000);

export default {
  sendVerificationCode,
  verifyCode
};
