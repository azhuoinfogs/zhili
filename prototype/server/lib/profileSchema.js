/**
 * B2 画像字段：与 POST /api/personalized、prototype/client 表单、scoring.js 对齐
 */

export const RELATIONS = ['partner', 'family', 'friend', 'colleague', 'elder', 'teacher', 'client', 'other'];

export const AGE_BANDS = ['under18', '18-25', '26-35', '36-45', '46plus'];

export const BUDGETS = ['lt100', '100-300', '300-500', '500-1000', '1000+'];

export const OCCASIONS = ['birthday', 'anniversary', 'festival', 'thanks', 'apology', 'casual'];

export const GENDERS = ['male', 'female', 'unknown'];

export const STYLES = ['practical', 'ritual', 'quirky', 'warm'];

export const INTERESTS = [
  'tech',
  'art',
  'outdoor',
  'beauty',
  'home',
  'fashion',
  'food',
  'health',
  'office',
  'parent',
];

export const TABOOS = ['smell', 'religion'];

function inSet(val, set) {
  return set.includes(val);
}

/**
 * @param {object} body
 * @param {{ partial?: boolean }} opts partial=true 时仅校验出现的字段（用于 PATCH 式扩展预留；当前路由用 full）
 */
export function validateProfileBody(body, opts = {}) {
  const partial = Boolean(opts.partial);
  const b = body && typeof body === 'object' ? body : {};

  const need = (key, cond, err) => {
    if (partial && !(key in b)) return null;
    if (!cond) return err;
    return null;
  };

  const err = (code, message) => ({ ok: false, error: code, message });
  const ok = () => ({ ok: true });

  if (!partial) {
    const req = ['relation', 'ageBand', 'occasion', 'budget'];
    for (const k of req) {
      if (b[k] === undefined || b[k] === null || b[k] === '') {
        return err('BAD_REQUEST', `缺少必填字段 ${k}`);
      }
    }
  }

  if ('relation' in b || !partial) {
    const v = b.relation;
    if (!partial && (v === undefined || v === '')) return err('BAD_REQUEST', '缺少 relation');
    if (v !== undefined && v !== null && v !== '' && !inSet(String(v), RELATIONS)) {
      return err('INVALID_ENUM', `relation 非法: ${v}`);
    }
  }
  if ('ageBand' in b || !partial) {
    const v = b.ageBand;
    if (!partial && (v === undefined || v === '')) return err('BAD_REQUEST', '缺少 ageBand');
    if (v !== undefined && v !== null && v !== '' && !inSet(String(v), AGE_BANDS)) {
      return err('INVALID_ENUM', `ageBand 非法: ${v}`);
    }
  }
  if ('occasion' in b || !partial) {
    const v = b.occasion;
    if (!partial && (v === undefined || v === '')) return err('BAD_REQUEST', '缺少 occasion');
    if (v !== undefined && v !== null && v !== '' && !inSet(String(v), OCCASIONS)) {
      return err('INVALID_ENUM', `occasion 非法: ${v}`);
    }
  }
  if ('budget' in b || !partial) {
    const v = b.budget;
    if (!partial && (v === undefined || v === '')) return err('BAD_REQUEST', '缺少 budget');
    if (v !== undefined && v !== null && v !== '' && !inSet(String(v), BUDGETS)) {
      return err('INVALID_ENUM', `budget 非法: ${v}`);
    }
  }

  if ('gender' in b && b.gender !== undefined && b.gender !== null && b.gender !== '') {
    if (!inSet(String(b.gender), GENDERS)) return err('INVALID_ENUM', `gender 非法: ${b.gender}`);
  }
  if (!partial && (b.gender === undefined || b.gender === null || b.gender === '')) {
    /* gender 允许默认 unknown */
  }

  if ('style' in b && b.style !== undefined && b.style !== null && b.style !== '') {
    if (!inSet(String(b.style), STYLES)) return err('INVALID_ENUM', `style 非法: ${b.style}`);
  }

  if ('interests' in b) {
    if (!Array.isArray(b.interests)) return err('BAD_REQUEST', 'interests 须为数组');
    if (b.interests.length > 3) return err('BAD_REQUEST', 'interests 最多 3 项');
    for (const x of b.interests) {
      if (!inSet(String(x), INTERESTS)) return err('INVALID_ENUM', `interests 含非法值: ${x}`);
    }
  } else if (!partial) {
    /* interests 可选空数组 */
  }

  if ('taboos' in b) {
    if (!Array.isArray(b.taboos)) return err('BAD_REQUEST', 'taboos 须为数组');
    for (const x of b.taboos) {
      if (!inSet(String(x), TABOOS)) return err('INVALID_ENUM', `taboos 含非法值: ${x}`);
    }
  }

  if ('name' in b && b.name != null) {
    const s = String(b.name);
    if (s.length > 64) return err('BAD_REQUEST', 'name 最长 64 字符');
  }

  if ('is_default' in b && b.is_default !== undefined && typeof b.is_default !== 'boolean') {
    return err('BAD_REQUEST', 'is_default 须为布尔');
  }

  return ok();
}

/** 归一化写入 DB 的画像字段（不含 id/user_id） */
export function normalizeProfilePayload(body) {
  const b = body && typeof body === 'object' ? body : {};
  const interests = Array.isArray(b.interests) ? [...b.interests] : [];
  const taboos = Array.isArray(b.taboos) ? [...b.taboos] : [];
  return {
    name: b.name != null && String(b.name).trim() !== '' ? String(b.name).trim().slice(0, 64) : null,
    relation: String(b.relation),
    gender: b.gender && String(b.gender) ? String(b.gender) : 'unknown',
    age_band: String(b.ageBand),
    budget: String(b.budget),
    occasion: String(b.occasion),
    style: b.style && String(b.style) ? String(b.style) : null,
    interests,
    taboos,
    is_default: Boolean(b.is_default),
  };
}

export function rowToApiProfile(row) {
  let interests = row.interests;
  if (typeof interests === 'string') {
    try {
      interests = JSON.parse(interests);
    } catch {
      interests = [];
    }
  }
  if (!Array.isArray(interests)) interests = [];
  let taboos = row.taboos;
  if (typeof taboos === 'string') {
    try {
      taboos = JSON.parse(taboos);
    } catch {
      taboos = [];
    }
  }
  if (!Array.isArray(taboos)) taboos = [];
  const out = {
    id: Number(row.id),
    name: row.name || null,
    relation: row.relation,
    gender: row.gender || 'unknown',
    ageBand: row.age_band,
    budget: row.budget,
    occasion: row.occasion,
    interests,
    taboos,
    is_default: Boolean(row.is_default),
  };
  if (row.style) out.style = row.style;
  if (row.created_at) out.created_at = row.created_at;
  if (row.updated_at) out.updated_at = row.updated_at;
  return out;
}
