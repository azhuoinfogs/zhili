import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHash, recommendListCacheKey } from './lib/recommendCache.js';
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
