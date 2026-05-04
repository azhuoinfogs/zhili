import { Router } from 'express';
import { getPool, query } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

/** 与看板 SQL 一致：匿名用 `extra.zhili_vid`，否则 `user_id` */
function visitorKeyExpr() {
  return `CASE
    WHEN user_id IS NOT NULL THEN CONCAT('u:', user_id)
    ELSE CONCAT('a:', COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(extra, '$.zhili_vid')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(extra, '$.user_id')), ''),
      CONCAT('row:', id)
    ))
  END`;
}

router.get('/today', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const dayRows = await query(`SELECT CURDATE() AS d`);
    const day = dayRows[0]?.d ? String(dayRows[0].d).slice(0, 10) : new Date().toISOString().slice(0, 10);

    const cnt = await query(
      `SELECT COUNT(*) AS c FROM event WHERE DATE(created_at) = CURDATE()`
    );
    const eventCount = Number(cnt[0]?.c ?? 0);

    const dauRows = await query(
      `SELECT COUNT(DISTINCT ${visitorKeyExpr()}) AS c FROM event WHERE DATE(created_at) = CURDATE()`
    );
    const dau = Number(dauRows[0]?.c ?? 0);

    const imp = await query(
      `SELECT COUNT(*) AS c FROM event WHERE DATE(created_at) = CURDATE() AND event_type = 'impression'`
    );
    const impressions = Number(imp[0]?.c ?? 0);

    const clk = await query(
      `SELECT COUNT(*) AS c FROM event WHERE DATE(created_at) = CURDATE() AND event_type IN ('click','purchase_click')`
    );
    const clicks = Number(clk[0]?.c ?? 0);

    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 10000 : null;

    res.json({
      date: day,
      eventCount,
      dau,
      impressions,
      clicks,
      ctr,
    });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.get('/trend7d', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  try {
    const dauRows = await query(
      `SELECT DATE(created_at) AS day, COUNT(DISTINCT ${visitorKeyExpr()}) AS dau
       FROM event
       WHERE created_at >= CURDATE() - INTERVAL 6 DAY
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    );

    const ctrRows = await query(
      `SELECT DATE(created_at) AS day,
              SUM(event_type = 'impression') AS impressions,
              SUM(event_type IN ('click','purchase_click')) AS clicks
       FROM event
       WHERE created_at >= CURDATE() - INTERVAL 6 DAY
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    );

    const byDay = new Map();
    for (const r of dauRows) {
      const d = r.day ? String(r.day).slice(0, 10) : '';
      byDay.set(d, { date: d, dau: Number(r.dau ?? 0), impressions: 0, clicks: 0, ctr: null });
    }
    for (const r of ctrRows) {
      const d = r.day ? String(r.day).slice(0, 10) : '';
      let o = byDay.get(d);
      if (!o) {
        o = { date: d, dau: 0, impressions: 0, clicks: 0, ctr: null };
        byDay.set(d, o);
      }
      o.impressions = Number(r.impressions ?? 0);
      o.clicks = Number(r.clicks ?? 0);
      o.ctr = o.impressions > 0 ? Math.round((o.clicks / o.impressions) * 10000) / 10000 : null;
    }

    const days = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
    res.json({ days });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

export default router;
