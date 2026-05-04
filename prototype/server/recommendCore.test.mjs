import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickHotOrPersonalized,
  apiProfileToScoringProfile,
  buildPersonalizedPayload,
  parsePaging,
  runHotList,
  runPersonalizedList,
  overlapScore,
  runRelatedList,
  filterShelf,
} from './lib/recommendCore.js';
import { productsData } from './productsData.js';

test('pickHotOrPersonalized：A→hot，B/缺省→personalized', () => {
  assert.equal(pickHotOrPersonalized('A'), 'hot');
  assert.equal(pickHotOrPersonalized('a'), 'hot');
  assert.equal(pickHotOrPersonalized('B'), 'personalized');
  assert.equal(pickHotOrPersonalized(undefined), 'personalized');
});

test('apiProfileToScoringProfile 去掉元字段', () => {
  const api = {
    id: 1,
    name: 'x',
    is_default: true,
    created_at: 't',
    relation: 'friend',
    ageBand: '26-35',
    interests: [],
    occasion: 'birthday',
    budget: '100-300',
    gender: 'male',
    style: 'practical',
    taboos: [],
  };
  const s = apiProfileToScoringProfile(api);
  assert.equal('id' in s, false);
  assert.equal(s.relation, 'friend');
  assert.equal(s.ageBand, '26-35');
});

test('buildPersonalizedPayload 含 shelf/offset/limit', () => {
  const body = buildPersonalizedPayload(
    { id: 2, relation: 'friend', ageBand: '26-35', interests: [], occasion: 'birthday', budget: '100-300', gender: 'male', style: 'practical', taboos: [] },
    { occasion: 'birthday', budget: '100-300', style: 'practical' },
    0,
    10
  );
  assert.equal(body.offset, 0);
  assert.equal(body.limit, 10);
  assert.equal(body.shelf.occasion, 'birthday');
  assert.equal(body.relation, 'friend');
});

test('runHotList 与 parsePaging 边界', () => {
  const { limit, offset } = parsePaging({ limit: '200', offset: '-1' });
  assert.equal(limit, 50);
  assert.equal(offset, 0);
  const list = runHotList(productsData, {}, 0, 3);
  assert.equal(list.length, 3);
  assert.ok(list[0].id);
});

test('filterShelf 分流逻辑：场合、预算、风格筛选', () => {
  const testProducts = [
    { id: 'p1', occasions: ['birthday', 'universal'], price: 200, styles: ['classic'] },
    { id: 'p2', occasions: ['wedding'], price: 400, styles: ['luxury'] },
    { id: 'p3', occasions: ['birthday'], price: 150, styles: ['classic'] },
  ];
  
  let filtered = filterShelf(testProducts, { occasion: 'birthday' });
  assert.equal(filtered.length, 2);
  assert.ok(filtered.some(p => p.id === 'p1'));
  assert.ok(filtered.some(p => p.id === 'p3'));
  
  filtered = filterShelf(testProducts, { budget: '100-300' });
  assert.equal(filtered.length, 2);
  assert.ok(filtered.some(p => p.id === 'p1'));
  assert.ok(filtered.some(p => p.id === 'p3'));
  
  filtered = filterShelf(testProducts, { style: 'luxury' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'p2');
});

test('runPersonalizedList：Body拼装与列表长度', () => {
  const profile = { relation: 'friend', ageBand: '26-35', interests: ['sports'], occasion: 'birthday', budget: '100-300', gender: 'male', style: 'practical' };
  const list = runPersonalizedList(productsData, profile, {}, 0, 10);
  
  assert.equal(list.length, 10);
  assert.ok(list.every(item => item.id && item.title && item.price));
  assert.ok(list.every(item => Array.isArray(item.reasons)));
  assert.ok(list.every(item => item.reasons.length > 0));
});

test('runPersonalizedList：offset/limit 分页边界', () => {
  const profile = { relation: 'friend', interests: [] };
  const list1 = runPersonalizedList(productsData, profile, {}, 0, 5);
  const list2 = runPersonalizedList(productsData, profile, {}, 5, 5);
  
  assert.equal(list1.length, 5);
  assert.equal(list2.length, 5);
  
  const ids1 = new Set(list1.map(p => p.id));
  const ids2 = new Set(list2.map(p => p.id));
  const intersection = [...ids1].filter(id => ids2.has(id));
  assert.equal(intersection.length, 0);
});

test('overlapScore 相似度计算', () => {
  const a = { occasions: ['birthday', 'wedding'], interests: ['sports'], styles: ['classic'], hotRank: 10 };
  const b1 = { occasions: ['birthday'], interests: ['sports'], styles: ['classic'], hotRank: 20 };
  const b2 = { occasions: ['anniversary'], interests: ['music'], styles: ['modern'], hotRank: 100 };
  
  const score1 = overlapScore(a, b1);
  const score2 = overlapScore(a, b2);
  
  assert.ok(score1 > score2);
  assert.ok(score1 > 0);
});

test('runRelatedList 相关商品推荐', () => {
  const self = productsData[0];
  const related = runRelatedList(productsData, self, null);
  
  assert.equal(related.length, Math.min(8, productsData.length - 1));
  assert.ok(related.every(item => item.id !== self.id));
  assert.ok(related.every(item => item.id && item.title));
});
