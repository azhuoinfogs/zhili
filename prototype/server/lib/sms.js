/**
 * 短信验证码服务（阿里云号码认证服务实现）
 * 使用阿里云 Dypnsapi 发送验证码
 */

import Dypnsapi20170525 from '@alicloud/dypnsapi20170525';
import OpenApi from '@alicloud/openapi-client';
import Util from '@alicloud/tea-util';
import Credential from '@alicloud/credentials';

// 内存存储验证码 { phone: { code, expiresAt, requestId } }
const codeStore = new Map();

// 验证码有效期（分钟）
const CODE_EXPIRE_MINUTES = 5;

// 发送间隔限制（秒）
const SEND_INTERVAL_SECONDS = 60;

// 是否启用阿里云服务（默认启用，可通过环境变量关闭）
const USE_ALIYUN = process.env.USE_ALIYUN_SMS !== 'false';

// 阿里云短信签名名称（需要在阿里云控制台配置）
const SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME || '';

// 阿里云短信模板代码（需要在阿里云控制台配置）
const TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE || '';

/**
 * 创建阿里云客户端
 */
function createClient() {
  const credential = new Credential.default();
  const config = new OpenApi.Config({
    credential: credential,
  });
  config.endpoint = 'dypnsapi.aliyuncs.com';
  return new Dypnsapi20170525.default(config);
}

/**
 * 生成6位数字验证码（用于Mock模式）
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 通过阿里云发送验证码
 * @param {string} phone - 手机号
 * @returns {Promise<{ success: boolean, message: string, code?: string, requestId?: string }>}
 */
async function sendViaAliyun(phone) {
  const client = createClient();
  // 生成6位验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const sendSmsVerifyCodeRequest = new Dypnsapi20170525.SendSmsVerifyCodeRequest({
    phoneNumber: phone,
    signName: SIGN_NAME,
    templateCode: TEMPLATE_CODE,
    templateParam: `{"code":"${code}","min":"5"}`
  });
  const runtime = new Util.RuntimeOptions({});
  
  try {
    const resp = await client.sendSmsVerifyCodeWithOptions(sendSmsVerifyCodeRequest, runtime);
    const body = resp.body;
    
    console.log('[阿里云短信] 发送结果:', JSON.stringify(body, null, 2));
    
    if (body.code === 'OK') {
      return {
        success: true,
        message: '验证码已发送',
        code: code,
        requestId: body.requestId
      };
    } else {
      return {
        success: false,
        message: body.message || '发送失败',
        requestId: body.requestId
      };
    }
  } catch (error) {
    console.error('[阿里云短信] 发送失败:', error.message);
    console.error('[阿里云短信] 诊断建议:', error.data?.Recommend);
    return {
      success: false,
      message: error.message || '发送失败，请稍后重试',
      recommend: error.data?.Recommend
    };
  }
}

/**
 * 通过阿里云验证验证码（使用 CheckSmsVerifyCode API）
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
async function verifyViaAliyun(phone, code) {
  const client = createClient();
  const checkSmsVerifyCodeRequest = new Dypnsapi20170525.CheckSmsVerifyCodeRequest({
    phoneNumber: phone,
    verifyCode: code
  });
  const runtime = new Util.RuntimeOptions({});
  
  try {
    const resp = await client.checkSmsVerifyCodeWithOptions(checkSmsVerifyCodeRequest, runtime);
    const body = resp.body;
    
    console.log('[阿里云短信] 验证结果:', JSON.stringify(body, null, 2));
    
    if (body.Code === 'OK' && body.Model?.VerifyResult === 'PASS') {
      return { success: true };
    } else {
      return {
        success: false,
        message: body.Message || '验证码验证失败'
      };
    }
  } catch (error) {
    console.error('[阿里云短信] 验证失败:', error.message);
    console.error('[阿里云短信] 诊断建议:', error.data?.Recommend);
    return {
      success: false,
      message: error.message || '验证失败',
      recommend: error.data?.Recommend
    };
  }
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

  let result;
  
  if (USE_ALIYUN) {
    // 使用阿里云发送
    result = await sendViaAliyun(phone);
  } else {
    // Mock模式：生成验证码并打印到控制台
    const code = generateCode();
    console.log(`[知礼 短信] Mock模式 - 发送验证码 ${code} 到 ${phone}，有效期 ${CODE_EXPIRE_MINUTES} 分钟`);
    result = {
      success: true,
      message: '验证码已发送',
      code: code
    };
  }

  if (result.success) {
    // 存储验证码
    codeStore.set(phone, {
      code: result.code,
      expiresAt: Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000,
      sentAt: Date.now(),
      requestId: result.requestId
    });
    cleanupExpiredCodes();
  }

  return {
    success: result.success,
    message: result.message
  };
}

/**
 * 验证验证码
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @returns {Promise<boolean>}
 */
export async function verifyCode(phone, code) {
  if (!phone || !code) {
    return false;
  }

  if (USE_ALIYUN) {
    // 使用阿里云验证
    const result = await verifyViaAliyun(phone, code);
    return result.success;
  }

  // Mock模式：本地验证
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