import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateProfileBody,
  normalizeProfilePayload,
  rowToApiProfile,
} from './lib/profileSchema.js';

test('validateProfileBody 合法画像', () => {
  const body = {
    relation: 'friend',
    ageBand: '26-35',
    interests: ['tech', 'home'],
    occasion: 'birthday',
    budget: '100-300',
    gender: 'male',
    style: 'practical',
    taboos: ['smell'],
  };
  const v = validateProfileBody(body, { partial: false });
  assert.strictEqual(v.ok, true);
});

test('validateProfileBody 缺必填', () => {
  const v = validateProfileBody({ relation: 'friend' }, { partial: false });
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.error, 'BAD_REQUEST');
});

test('validateProfileBody interests 超过 3 个', () => {
  const v = validateProfileBody(
    {
      relation: 'friend',
      ageBand: '26-35',
      occasion: 'birthday',
      budget: '100-300',
      interests: ['tech', 'art', 'home', 'food'],
    },
    { partial: false }
  );
  assert.strictEqual(v.ok, false);
});

test('normalizeProfilePayload + rowToApiProfile round-trip 形状', () => {
  const p = normalizeProfilePayload({
    relation: 'friend',
    ageBand: '18-25',
    interests: ['tech'],
    occasion: 'thanks',
    budget: 'lt100',
    gender: 'unknown',
    style: 'warm',
    taboos: [],
    name: '送给同事',
    is_default: true,
  });
  assert.strictEqual(p.age_band, '18-25');
  assert.strictEqual(p.interests.length, 1);
  const row = {
    id: 9,
    user_id: 1,
    name: p.name,
    relation: p.relation,
    gender: p.gender,
    age_band: p.age_band,
    budget: p.budget,
    occasion: p.occasion,
    style: p.style,
    interests: JSON.stringify(p.interests),
    taboos: JSON.stringify(p.taboos),
    is_default: 1,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
  };
  const api = rowToApiProfile(row);
  assert.strictEqual(api.id, 9);
  assert.strictEqual(api.ageBand, '18-25');
  assert.deepStrictEqual(api.interests, ['tech']);
  assert.strictEqual(api.is_default, true);
});
