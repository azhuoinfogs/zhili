import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickHotOrPersonalized,
  apiProfileToScoringProfile,
  buildPersonalizedPayload,
  parsePaging,
  runHotList,
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
