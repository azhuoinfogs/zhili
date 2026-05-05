import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getPool, query, execute } from '../db.js';
import { getRedis } from '../db.js';
import { invalidateAllRecommendations } from '../lib/recommendCache.js';
import { ADMIN_PRODUCT_ID_RE } from '../lib/productWriteSchema.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

async function extractProductIdFromUrl(url, platform) {
  try {
    const parsed = new URL(url);
    let productId = '';
    
    if (platform === 'jd') {
      if (parsed.searchParams.has('sku')) {
        productId = parsed.searchParams.get('sku');
      } else if (parsed.searchParams.has('id')) {
        productId = parsed.searchParams.get('id');
      } else if (parsed.searchParams.has('p')) {
        const p = parsed.searchParams.get('p');
        try {
          const decoded = Buffer.from(p, 'base64').toString('utf8');
          const match = decoded.match(/(\d{6,16})/);
          if (match) productId = match[1];
        } catch {
          const hash = await generateHashId(url);
          productId = `jd_${hash}`;
        }
      } else {
        const pathMatch = parsed.pathname.match(/\/(\d+)\.html/);
        if (pathMatch) {
          productId = pathMatch[1];
        } else {
          const match = url.match(/(\d{6,16})/);
          if (match) productId = match[1];
          else {
            const hash = await generateHashId(url);
            productId = `jd_${hash}`;
          }
        }
      }
    } else if (platform === 'taobao' || platform === 'tmall') {
      if (parsed.searchParams.has('id')) {
        productId = parsed.searchParams.get('id');
      } else if (parsed.searchParams.has('itemId')) {
        productId = parsed.searchParams.get('itemId');
      } else if (parsed.pathname.match(/\/item\.htm/)) {
        const match = url.match(/id=(\d+)/);
        if (match) productId = match[1];
      } else {
        const hash = await generateHashId(url);
        productId = `${platform}_${hash}`;
      }
    }
    
    if (!productId) {
      const hash = await generateHashId(url);
      productId = `${platform}_${hash}`;
    }
    
    return productId;
  } catch {
    const hash = await generateHashId(url);
    return `${platform}_${hash}`;
  }
}

async function generateHashId(url) {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hash = await crypto.subtle.digest('SHA-1', data);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 16);
}

async function createImportHistory(sourceUrl, platform, productId, status, message) {
  if (!getPool()) return;
  try {
    await execute(
      'INSERT INTO import_history (source_url, platform, product_id, status, message) VALUES (?, ?, ?, ?, ?)',
      [sourceUrl, platform, productId, status, message]
    );
  } catch (e) {
    console.warn('[知礼] 创建导入历史失败:', e.message);
  }
}

function generateProductImages(productId, platform) {
  const images = [];
  if (platform === 'jd') {
    images.push(`https://img14.360buyimg.com/n1/jfs/t1/1/${productId}/0.jpg`);
    images.push(`https://img14.360buyimg.com/n1/jfs/t1/1/${productId}/1.jpg`);
    images.push(`https://img14.360buyimg.com/n1/jfs/t1/1/${productId}/2.jpg`);
  } else if (platform === 'taobao' || platform === 'tmall') {
    images.push(`https://img.alicdn.com/imgextra/i1/${productId}/O1CN01/${productId}_1.jpg`);
    images.push(`https://img.alicdn.com/imgextra/i2/${productId}/O1CN01/${productId}_2.jpg`);
  }
  return images;
}

router.post('/product', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ success: false, message: '数据库未连接' });
    return;
  }
  
  const { url, platform = 'jd' } = req.body;
  
  if (!url || typeof url !== 'string') {
    res.status(400).json({ success: false, message: '缺少联盟链接' });
    return;
  }
  
  try {
    const productId = await extractProductIdFromUrl(url, platform);
    
    if (!ADMIN_PRODUCT_ID_RE.test(productId)) {
      await createImportHistory(url, platform, null, 'failed', '无法从链接中提取商品ID');
      res.json({ success: false, message: '无法从链接中提取商品ID' });
      return;
    }
    
    const images = generateProductImages(productId, platform);
    const existing = await query('SELECT product_id FROM product WHERE product_id = ? LIMIT 1', [productId]);
    
    if (existing.length > 0) {
      await execute('UPDATE product SET affiliate_url = ?, images = ?, updated_at = NOW() WHERE product_id = ?', [url, JSON.stringify(images), productId]);
      await createImportHistory(url, platform, productId, 'success', '商品已更新');
      await invalidateAllRecommendations(getRedis());
      res.json({ success: true, message: '商品已更新', productId });
    } else {
      await execute(
        'INSERT INTO product (product_id, name, price, sell_point, images, affiliate_url, listed) VALUES (?, ?, 0, ?, ?, ?, 1)',
        [productId, `未解析商品-${productId}`, '待解析联盟商品', JSON.stringify(images), url]
      );
      await createImportHistory(url, platform, productId, 'success', '商品已创建');
      await invalidateAllRecommendations(getRedis());
      res.json({ success: true, message: '商品已创建', productId });
    }
  } catch (e) {
    console.error('[知礼] 商品导入失败:', e.message);
    await createImportHistory(url, platform, null, 'failed', e.message);
    res.json({ success: false, message: '导入失败: ' + e.message });
  }
});

router.post('/products', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ success: false, message: '数据库未连接' });
    return;
  }
  
  const { urls, platform = 'jd' } = req.body;
  
  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ success: false, message: '缺少链接列表' });
    return;
  }
  
  const result = { created: 0, updated: 0, failed: 0 };
  
  for (const url of urls) {
    try {
      if (!url || typeof url !== 'string') {
        result.failed++;
        continue;
      }
      
      const productId = await extractProductIdFromUrl(url, platform);
      const images = generateProductImages(productId, platform);
      
      if (!ADMIN_PRODUCT_ID_RE.test(productId)) {
        await createImportHistory(url, platform, null, 'failed', '无法从链接中提取商品ID');
        result.failed++;
        continue;
      }
      
      const existing = await query('SELECT product_id FROM product WHERE product_id = ? LIMIT 1', [productId]);
      
      if (existing.length > 0) {
        await execute('UPDATE product SET affiliate_url = ?, images = ?, updated_at = NOW() WHERE product_id = ?', [url, JSON.stringify(images), productId]);
        await createImportHistory(url, platform, productId, 'success', '商品已更新');
        result.updated++;
      } else {
        await execute(
          'INSERT INTO product (product_id, name, price, sell_point, images, affiliate_url, listed) VALUES (?, ?, 0, ?, ?, ?, 1)',
          [productId, `未解析商品-${productId}`, '待解析联盟商品', JSON.stringify(images), url]
        );
        await createImportHistory(url, platform, productId, 'success', '商品已创建');
        result.created++;
      }
    } catch (e) {
      console.error('[知礼] 批量导入失败:', e.message);
      await createImportHistory(url, platform, null, 'failed', e.message);
      result.failed++;
    }
  }
  
  await invalidateAllRecommendations(getRedis());
  res.json({ success: true, ...result });
});

router.get('/history', async (req, res) => {
  if (!getPool()) {
    res.status(503).json({ error: 'DB_UNAVAILABLE', message: '数据库未连接' });
    return;
  }
  
  try {
    const rows = await query(
      'SELECT id, source_url, platform, product_id, status, message, created_at FROM import_history ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ data: rows });
  } catch (e) {
    console.error('[知礼] 获取导入历史失败:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

export default router;
