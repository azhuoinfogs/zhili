import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, buildReasonLines } from './scoring.js';

const P = {
  id: 't1',
  title: '测试商品',
  price: 199,
  image: 'https://example.com/x.jpg',
  sellPoint: '一句话卖点',
  hotRank: 5,
  gender: 'any',
  ageBands: ['26-35'],
  interests: ['tech', 'food', 'art'],
  occasions: ['birthday', 'universal'],
  styles: ['practical', 'warm'],
  taboosAvoid: ['smell', 'religion'],
  occasionKeyword: '体面不踩雷'
};

test('兴趣未选：中性 5 分', () => {
  const profile = {
    interests: [],
    occasion: 'birthday',
    budget: '100-300',
    ageBand: '26-35',
    gender: 'unknown',
    style: 'practical'
  };
  const i = 0.5 * 5;
  const sit = 0.3 * (6 + 4);
  const bas = 0.2 * (3 + 3 + 3);
  const expected = i + sit + bas;
  assert.equal(computeScore(P, profile), expected);
});

test('兴趣 2 个重合：7 分', () => {
  const profile = {
    interests: ['tech', 'food'],
    occasion: 'birthday',
    budget: '100-300',
    ageBand: '26-35',
    gender: 'female',
    style: 'practical'
  };
  assert.equal(computeScore(P, profile), 0.5 * 7 + 0.3 * 10 + 0.2 * (4 + 3 + 3));
});

test('道歉场合 + 商品含搞怪：风格冲突 0', () => {
  const p2 = { ...P, styles: ['quirky'] };
  const profile = {
    interests: [],
    occasion: 'apology',
    budget: '100-300',
    ageBand: '26-35',
    gender: 'unknown',
    style: 'warm'
  };
  // 场合 universal=4，风格道歉+搞怪=0 → 情境 4 分
  assert.equal(computeScore(p2, profile), 0.5 * 5 + 0.3 * 4 + 0.2 * (3 + 3 + 3));
});

test('理由含兴趣或场合模板（Top2 可能不含预算）', () => {
  const lines = buildReasonLines(P, {
    interests: ['tech'],
    occasion: 'birthday',
    budget: '100-300',
    ageBand: '26-35',
    gender: 'unknown',
    style: 'practical',
    taboos: []
  });
  const text = lines.map((l) => l.text).join('');
  assert.ok(text.includes('科技数码') || text.includes('生日'));
});

test('禁忌规避文案', () => {
  const lines = buildReasonLines(P, {
    interests: [],
    occasion: 'birthday',
    budget: '100-300',
    ageBand: '26-35',
    gender: 'unknown',
    style: 'practical',
    taboos: ['smell']
  });
  assert.ok(lines.some((l) => l.icon === '🚫'));
});
