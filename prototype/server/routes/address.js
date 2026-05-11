import { Router } from 'express';
import { query, execute } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const addresses = await query(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );
    res.json({ success: true, list: addresses });
  } catch (err) {
    console.error('[知礼] 获取收货地址失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '获取收货地址失败' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const addresses = await query(
      'SELECT * FROM addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (addresses.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: '地址不存在' });
      return;
    }
    
    res.json({ success: true, address: addresses[0] });
  } catch (err) {
    console.error('[知礼] 获取收货地址失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '获取收货地址失败' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, province, city, district, detail, is_default } = req.body;
    
    if (!name || !phone || !detail) {
      res.status(400).json({ error: 'BAD_REQUEST', message: '请填写完整信息' });
      return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      res.status(400).json({ error: 'INVALID_PHONE', message: '手机号格式不正确' });
      return;
    }
    
    if (is_default) {
      await execute(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
        [userId]
      );
    }
    
    const result = await execute(
      'INSERT INTO addresses (user_id, name, phone, province, city, district, detail, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, name, phone, province || '', city || '', district || '', detail, is_default ? 1 : 0]
    );
    
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[知礼] 添加收货地址失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '添加收货地址失败' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, phone, province, city, district, detail, is_default } = req.body;
    
    if (!name || !phone || !detail) {
      res.status(400).json({ error: 'BAD_REQUEST', message: '请填写完整信息' });
      return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      res.status(400).json({ error: 'INVALID_PHONE', message: '手机号格式不正确' });
      return;
    }
    
    const check = await query(
      'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (check.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: '地址不存在' });
      return;
    }
    
    if (is_default) {
      await execute(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ? AND id != ?',
        [userId, id]
      );
    }
    
    await execute(
      'UPDATE addresses SET name = ?, phone = ?, province = ?, city = ?, district = ?, detail = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, phone, province || '', city || '', district || '', detail, is_default ? 1 : 0, id]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('[知礼] 更新收货地址失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '更新收货地址失败' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const check = await query(
      'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (check.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: '地址不存在' });
      return;
    }
    
    await execute(
      'DELETE FROM addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('[知礼] 删除收货地址失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '删除收货地址失败' });
  }
});

export default router;
