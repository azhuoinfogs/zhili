/**
 * B10.5：输入校验工具函数
 */

export const VALID_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^1[3-9]\d{9}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  PRODUCT_ID: /^[a-zA-Z0-9_-]{1,64}$/,
  USER_ID: /^\d{1,10}$/,
  URL: /^https?:\/\/[^\s]+$/,
};

export function validateEmail(email) {
  return typeof email === 'string' && VALID_PATTERNS.EMAIL.test(email);
}

export function validatePhone(phone) {
  return typeof phone === 'string' && VALID_PATTERNS.PHONE.test(phone);
}

export function validateProductId(id) {
  return typeof id === 'string' && VALID_PATTERNS.PRODUCT_ID.test(id);
}

export function validateUserId(id) {
  return typeof id === 'string' && VALID_PATTERNS.USER_ID.test(id);
}

export function validateUrl(url) {
  return typeof url === 'string' && VALID_PATTERNS.URL.test(url);
}

export function validateString(value, minLength = 1, maxLength = 255) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
}

export function validateNumber(value, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return value >= min && value <= max;
}

export function validateArray(value, minLength = 0, maxLength = 100) {
  if (!Array.isArray(value)) return false;
  return value.length >= minLength && value.length <= maxLength;
}

export function validateObject(value, requiredKeys = []) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (requiredKeys.length > 0) {
    return requiredKeys.every(key => key in value);
  }
  return true;
}

export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => typeof item === 'string' ? sanitizeString(item) : item);
}

export function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const result = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = sanitizeArray(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}