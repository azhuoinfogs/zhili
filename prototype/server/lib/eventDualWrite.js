import { getPool } from '../db.js';
import { validateAndNormalizeEventBody } from './eventPayload.js';
import { insertNormalizedEvent } from './eventDb.js';

/** develop2 §9.8.4 模式 B：`collect` 成功后双写 `event`（不影响 `{ ok: true }`） */
export function isEventDbDualWriteEnabled() {
  return String(process.env.EVENT_DB_DUAL_WRITE || '') === '1';
}

/**
 * @param {Record<string, unknown>} body 已与 collect 一致含 `serverTs` 等
 */
export async function tryDualWriteCollectToEvent(body) {
  if (!isEventDbDualWriteEnabled() || !getPool()) return;
  const norm = validateAndNormalizeEventBody(body, { userIdFromJwt: null });
  if (!norm.ok) {
    console.warn('[知礼] collect→event 双写跳过:', norm.message);
    return;
  }
  try {
    await insertNormalizedEvent(norm.row);
  } catch (e) {
    console.warn('[知礼] collect→event 双写失败:', e.message);
  }
}
