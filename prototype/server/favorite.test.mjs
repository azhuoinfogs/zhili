import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAVORITE_PRODUCT_ID_RE,
  parseFavoriteListPaging,
  pickFavoriteProductId,
  rowToFavoriteListItem,
} from './lib/favoriteHelpers.js';

test('FAVORITE_PRODUCT_ID_RE', () => {
  assert.equal(FAVORITE_PRODUCT_ID_RE.test('p001'), true);
  assert.equal(FAVORITE_PRODUCT_ID_RE.test('a-b_1'), true);
  assert.equal(FAVORITE_PRODUCT_ID_RE.test(''), false);
  assert.equal(FAVORITE_PRODUCT_ID_RE.test('x'.repeat(33)), false);
  assert.equal(FAVORITE_PRODUCT_ID_RE.test('bad id'), false);
});

test('parseFavoriteListPaging 默认与上限', () => {
  assert.deepEqual(parseFavoriteListPaging({}), { limit: 20, offset: 0 });
  assert.deepEqual(parseFavoriteListPaging({ limit: '99', offset: '-1' }), { limit: 50, offset: 0 });
  assert.deepEqual(parseFavoriteListPaging({ limit: '5', offset: '10' }), { limit: 5, offset: 10 });
});

test('pickFavoriteProductId camelCase 优先', () => {
  assert.equal(pickFavoriteProductId({ productId: ' p001 ' }), 'p001');
  assert.equal(pickFavoriteProductId({ product_id: 'p002' }), 'p002');
  assert.equal(pickFavoriteProductId({ productId: 'a', product_id: 'b' }), 'a');
  assert.equal(pickFavoriteProductId({}), null);
  assert.equal(pickFavoriteProductId(null), null);
});

test('rowToFavoriteListItem', () => {
  const d = new Date('2026-03-01T08:00:00.000Z');
  const item = rowToFavoriteListItem({ product_id: 'p007', created_at: d });
  assert.equal(item.productId, 'p007');
  assert.equal(item.createdAt, '2026-03-01T08:00:00.000Z');
});
