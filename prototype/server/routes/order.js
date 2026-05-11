import { Router } from 'express';
import { query, execute } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    const result = [];
    for (const order of orders) {
      const items = await query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      result.push({
        ...order,
        items
      });
    }
    
    res.json({ success: true, list: result });
  } catch (err) {
    console.error('[知礼] 获取订单列表失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '获取订单列表失败' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const orders = await query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (orders.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: '订单不存在' });
      return;
    }
    
    const order = orders[0];
    const items = await query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [order.id]
    );
    
    res.json({ success: true, order: { ...order, items } });
  } catch (err) {
    console.error('[知礼] 获取订单详情失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '获取订单详情失败' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, total, address_id, remark } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'BAD_REQUEST', message: '请选择商品' });
      return;
    }
    
    const orderId = `ORD${Date.now()}${Math.random().toString(36).slice(-4).toUpperCase()}`;
    
    await execute('BEGIN');
    
    const orderResult = await execute(
      'INSERT INTO orders (id, user_id, total, status, address_id, remark) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, userId, total, 'pending', address_id || null, remark || '']
    );
    
    for (const item of items) {
      await execute(
        'INSERT INTO order_items (order_id, product_id, name, price, quantity, image) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.name, item.price, item.quantity, item.image || '']
      );
    }
    
    await execute('COMMIT');
    
    res.json({ success: true, orderId });
  } catch (err) {
    await execute('ROLLBACK');
    console.error('[知礼] 创建订单失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '创建订单失败' });
  }
});

router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: '无效的订单状态' });
      return;
    }
    
    const result = await execute(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [status, id, userId]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: '订单不存在' });
      return;
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('[知礼] 更新订单状态失败:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '更新订单状态失败' });
  }
});

export default router;
