import { Router } from 'express';
import { getPool } from '../db.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { validateAndNormalizeEventBody } from '../lib/eventPayload.js';
import { insertNormalizedEvent } from '../lib/eventDb.js';

const router = Router();

router.post('/', optionalAuth, async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  const userIdFromJwt = req.userId != null ? Number(req.userId) : null;
  const norm = validateAndNormalizeEventBody(req.body, { userIdFromJwt });
  if (!norm.ok) {
    res.status(400).json({ error: norm.error, message: norm.message });
    return;
  }
  try {
    const id = await insertNormalizedEvent(norm.row);
    res.status(201).json({ id, ok: true });
  } catch (e) {
    console.error('[知礼] POST /api/event', e);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

export default router;
