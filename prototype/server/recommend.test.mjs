import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHash, recommendListCacheKey, invalidateUserRecommendations, invalidateAllRecommendations } from './lib/recommendCache.js';
import { parsePageSize } from './routes/recommend.js';

test('parsePageSize：page≥1，size 1～50', () => {
  assert.deepEqual(parsePageSize({ page: '1', size: '10' }), { page: 1, size: 10, offset: 0, limit: 10 });
  assert.deepEqual(parsePageSize({ page: '3', size: '20' }), { page: 3, size: 20, offset: 40, limit: 20 });
  const x = parsePageSize({ page: '0', size: '200' });
  assert.equal(x.page, 1);
  assert.equal(x.size, 50);
});

test('filterHash 稳定、recommendListCacheKey 格式', () => {
  const shelf = { occasion: 'birthday', budget: '100-300', style: 'practical' };
  const h = filterHash(shelf, 'B');
  assert.equal(h.length, 12);
  assert.equal(h, filterHash(shelf, 'B'));
  const k = recommendListCacheKey(7, 42, shelf, 'A');
  assert.match(k, /^recommend:7:42:[0-9a-f]{12}$/);
});

test('filterHash 空值处理', () => {
  const h1 = filterHash(null, 'A');
  assert.equal(h1.length, 12);
  const h2 = filterHash({}, 'B');
  assert.equal(h2.length, 12);
  const h3 = filterHash({ occasion: '', budget: '', style: '' }, '');
  assert.equal(h3.length, 12);
  assert.equal(filterHash({}, 'b'), filterHash({}, 'B'));
});

test('recommendListCacheKey 边界情况', () => {
  const k1 = recommendListCacheKey(1, 1, {}, 'A');
  assert.match(k1, /^recommend:1:1:[0-9a-f]{12}$/);
  const k2 = recommendListCacheKey(99999, 99999, { occasion: 'test' }, 'B');
  assert.match(k2, /^recommend:99999:99999:[0-9a-f]{12}$/);
});

test('invalidateUserRecommendations 降级处理 - redis 为 null', async () => {
  await invalidateUserRecommendations(null, 1);
});

test('invalidateAllRecommendations 降级处理 - redis 为 null', async () => {
  await invalidateAllRecommendations(null);
});
