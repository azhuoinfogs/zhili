import { getPool, execute } from '../db.js';

/**
 * @param {{ event_type: string; user_id: number | null; product_id: string | null; page_name: string | null; position: number | null; extra: Record<string, unknown> }} row
 * @returns {Promise<number>} insertId
 */
export async function insertNormalizedEvent(row) {
  if (!getPool()) {
    throw new Error('DB_UNAVAILABLE');
  }
  const extraJson = JSON.stringify(row.extra ?? {});
  const result = await execute(
    `INSERT INTO event (event_type, user_id, product_id, page_name, position, extra) VALUES (?,?,?,?,?,?)`,
    [row.event_type, row.user_id, row.product_id, row.page_name, row.position, extraJson]
  );
  const id = result.insertId;
  if (!Number.isFinite(Number(id))) {
    throw new Error('INSERT 未返回 insertId');
  }
  return Number(id);
}
