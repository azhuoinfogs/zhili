import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowToKernelProduct } from './lib/productMapper.js';
import { parseProfileFromQuery, buildProductDetail } from './routes/product.js';
import { profileVariantKey } from './lib/productDetailCache.js';

test('parseProfileFromQuery 合法 JSON', () => {
  const p = parseProfileFromQuery({
    profile: JSON.stringify({ relation: 'friend', occasion: 'birthday', gender: 'male' }),
  });
  assert.equal(p.relation, 'friend');
});

test('parseProfileFromQuery 非法或空', () => {
  assert.equal(parseProfileFromQuery({}), null);
  assert.equal(parseProfileFromQuery({ profile: '' }), null);
  assert.equal(parseProfileFromQuery({ profile: 'not-json' }), null);
  assert.equal(parseProfileFromQuery({ profile: '[1,2]' }), null);
});

test('rowToKernelProduct 列映射与 gender unknown→any', () => {
  const k = rowToKernelProduct({
    product_id: 'p001',
    name: '测试',
    price: '12.50',
    sell_point: '卖点',
    occasion_keyword: 'kw',
    images: JSON.stringify(['https://a/1.jpg']),
    styles: JSON.stringify(['practical']),
    occasions: JSON.stringify(['birthday']),
    interests: JSON.stringify(['tech']),
    gender: 'unknown',
    age_bands: JSON.stringify(['26-35']),
    taboos_avoid: JSON.stringify(['smell']),
    hot_rank: 3,
    affiliate_url: 'https://example.com/go',
  });
  assert.equal(k.id, 'p001');
  assert.equal(k.title, '测试');
  assert.equal(k.price, 12.5);
  assert.equal(k.gender, 'any');
  assert.deepEqual(k.images, ['https://a/1.jpg']);
  assert.equal(k.affiliateUrl, 'https://example.com/go');
});

test('buildProductDetail 含 ProductCard 与扩展标签', () => {
  const kernel = {
    id: 'p001',
    title: 'T',
    price: 100,
    sellPoint: 'S',
    occasions: ['birthday'],
    styles: ['practical'],
    interests: ['tech'],
    gender: 'any',
    ageBands: ['26-35'],
    taboosAvoid: [],
    hotRank: 1,
    occasionKeyword: 'k',
    images: ['https://x/1.jpg'],
    affiliateUrl: null,
  };
  const profile = {
    relation: 'friend',
    ageBand: '26-35',
    interests: ['tech'],
    occasion: 'birthday',
    budget: '100-300',
    gender: 'male',
    style: 'practical',
    taboos: [],
  };
  const d = buildProductDetail(kernel, profile);
  assert.ok(Array.isArray(d.reasons));
  assert.ok(Array.isArray(d.images));
  assert.equal(d.id, 'p001');
  assert.deepEqual(d.occasions, ['birthday']);
  assert.equal(d.hotRank, 1);
});

test('profileVariantKey 稳定', () => {
  const a = profileVariantKey({ x: 1 });
  const b = profileVariantKey({ x: 1 });
  assert.equal(a, b);
  assert.equal(a.length, 16);
});
