import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, execute, query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 与 index.js enrich / API 一致：无 images 时由单图派生 3 张 */
function productImagesJson(p) {
  const base = p.image || `https://picsum.photos/seed/${encodeURIComponent(p.id)}/400/400`;
  if (Array.isArray(p.images) && p.images.length) {
    return JSON.stringify(p.images.slice(0, 6).map(String));
  }
  return JSON.stringify([
    base,
    `https://picsum.photos/seed/${encodeURIComponent(p.id)}a/400/400`,
    `https://picsum.photos/seed/${encodeURIComponent(p.id)}b/400/400`,
  ]);
}

/** develop2 §6.2：JSON 中 any → unknown */
function normalizeProductGender(g) {
  if (!g || g === 'any') return 'unknown';
  if (g === 'male' || g === 'female' || g === 'unknown') return g;
  return 'unknown';
}

async function seedProducts() {
  try {
    await initDatabase();

    const productsPath = path.join(__dirname, 'products.json');
    const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

    console.log(`[知礼 Seed] 读取到 ${productsData.length} 条商品数据`);

    let inserted = 0;
    let updated = 0;

    for (const product of productsData) {
      const imagesJson = productImagesJson(product);
      const genderDb = normalizeProductGender(product.gender);

      const existing = await query('SELECT product_id FROM product WHERE product_id = ?', [product.id]);

      if (existing.length > 0) {
        await execute(
          `UPDATE product SET 
            name = ?, price = ?, sell_point = ?, occasion_keyword = ?,
            images = ?, styles = ?, occasions = ?, interests = ?,
            gender = ?, age_bands = ?, taboos_avoid = ?, hot_rank = ?
          WHERE product_id = ?`,
          [
            product.title,
            product.price,
            product.sellPoint,
            product.occasionKeyword,
            imagesJson,
            JSON.stringify(product.styles || []),
            JSON.stringify(product.occasions || []),
            JSON.stringify(product.interests || []),
            genderDb,
            JSON.stringify(product.ageBands || []),
            JSON.stringify(product.taboosAvoid || []),
            product.hotRank || 999,
            product.id,
          ]
        );
        updated++;
      } else {
        await execute(
          `INSERT INTO product (
            product_id, name, price, sell_point, occasion_keyword,
            images, styles, occasions, interests, gender,
            age_bands, taboos_avoid, hot_rank
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            product.title,
            product.price,
            product.sellPoint,
            product.occasionKeyword,
            imagesJson,
            JSON.stringify(product.styles || []),
            JSON.stringify(product.occasions || []),
            JSON.stringify(product.interests || []),
            genderDb,
            JSON.stringify(product.ageBands || []),
            JSON.stringify(product.taboosAvoid || []),
            product.hotRank || 999,
          ]
        );
        inserted++;
      }
    }

    console.log(`[知礼 Seed] 商品数据初始化完成: 新增 ${inserted} 条, 更新 ${updated} 条`);
    process.exit(0);
  } catch (error) {
    console.error('[知礼 Seed] 初始化商品数据失败:', error.message);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  seedProducts();
}

export { seedProducts, productImagesJson, normalizeProductGender };
