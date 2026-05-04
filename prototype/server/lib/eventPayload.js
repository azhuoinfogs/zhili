/**
 * B7：`POST /api/collect` / `POST /api/event` 与 MySQL `event` 表映射（develop2 §9.8.3）
 * `user_id` 列仅来自 JWT（`userIdFromJwt`），**禁止**使用 Body 的 `user_id` 作为 FK。
 */

/** 与 [api.md](../api.md) §6.1 `collect` 事件名一致 */
export const ALLOWED_EVENT_TYPES = new Set([
  'page_view',
  'form_submit',
  'impression',
  'click',
  'collect',
  'purchase_click',
  'pull_refresh',
  'explore_click',
]);

const PRODUCT_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;

/** 不落库、不进 `extra` 的敏感键（develop2 §9.8.3 / B7.10） */
const STRIP_FROM_EXTRA = new Set([
  'token',
  'password',
  'session_key',
  'access_token',
  'refresh_token',
  'authorization',
  'openid',
  'unionid',
  'code',
]);

/**
 * @param {unknown} body
 * @param {{ userIdFromJwt: number | null }} opts
 * @returns {{ ok: true, row: { event_type: string, user_id: number | null, product_id: string | null, page_name: string | null, position: number | null, extra: Record<string, unknown> } } | { ok: false, error: string, message: string }}
 */
export function validateAndNormalizeEventBody(body, opts) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const ev = b.event;
  if (ev == null || String(ev).trim() === '') {
    return { ok: false, error: 'BAD_REQUEST', message: '缺少 event 字段' };
  }
  const event_type = String(ev).trim();
  if (!ALLOWED_EVENT_TYPES.has(event_type)) {
    return { ok: false, error: 'BAD_REQUEST', message: `不支持的 event 类型: ${event_type}` };
  }

  let product_id = null;
  if (b.product_id != null && String(b.product_id).trim() !== '') {
    const pid = String(b.product_id).trim();
    if (!PRODUCT_ID_RE.test(pid)) {
      return { ok: false, error: 'BAD_REQUEST', message: 'product_id 格式非法' };
    }
    product_id = pid;
  }

  let page_name = null;
  if (b.page_name != null && String(b.page_name).trim() !== '') {
    page_name = String(b.page_name).trim().slice(0, 64);
  }

  let position = null;
  if (b.position != null && b.position !== '') {
    const n = Number(b.position);
    if (Number.isFinite(n)) position = Math.trunc(n);
  }

  const user_id =
    opts.userIdFromJwt != null && Number.isFinite(opts.userIdFromJwt) && opts.userIdFromJwt > 0
      ? opts.userIdFromJwt
      : null;

  const extra = { ...b };
  delete extra.event;
  delete extra.product_id;
  delete extra.page_name;
  delete extra.position;
  for (const k of STRIP_FROM_EXTRA) delete extra[k];

  return {
    ok: true,
    row: {
      event_type,
      user_id,
      product_id,
      page_name,
      position,
      extra,
    },
  };
}
