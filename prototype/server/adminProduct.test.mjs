import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isZhiliAdmin } from './lib/adminAccess.js';
import {
  validateCreateProductBody,
  validateUpdateProductBody,
  genderApiToDb,
  rowToAdminProduct,
} from './lib/productWriteSchema.js';

test('genderApiToDb 与 seed 一致', () => {
  assert.equal(genderApiToDb('any'), 'unknown');
  assert.equal(genderApiToDb('unknown'), 'unknown');
  assert.equal(genderApiToDb('male'), 'male');
  assert.equal(genderApiToDb('female'), 'female');
});

test('validateCreateProductBody 合法', () => {
  const v = validateCreateProductBody({
    id: 'new_p1',
    title: '测',
    price: 12.5,
    gender: 'male',
    images: ['https://a/1.jpg'],
    styles: ['practical'],
  });
  assert.equal(v.ok, true);
  assert.equal(v.data.productId, 'new_p1');
  assert.equal(v.data.genderDb, 'male');
  assert.equal(v.data.price, 12.5);
});

test('validateCreateProductBody 非法 price', () => {
  const v = validateCreateProductBody({ id: 'x', title: 't', price: -1 });
  assert.equal(v.ok, false);
  assert.match(v.message, /price/);
});

test('validateCreateProductBody 非法 gender', () => {
  const v = validateCreateProductBody({ id: 'x', title: 't', price: 1, gender: 'alien' });
  assert.equal(v.ok, false);
  assert.equal(v.error, 'INVALID_ENUM');
});

test('validateUpdateProductBody PATCH 合并', () => {
  const row = {
    product_id: 'p001',
    name: '旧名',
    price: '10.00',
    sell_point: '',
    occasion_keyword: '',
    images: JSON.stringify([]),
    styles: JSON.stringify([]),
    occasions: JSON.stringify([]),
    interests: JSON.stringify([]),
    gender: 'unknown',
    age_bands: JSON.stringify([]),
    taboos_avoid: JSON.stringify([]),
    hot_rank: 5,
    click_count: 0,
    affiliate_url: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
  };
  const v = validateUpdateProductBody(row, { title: '新名' });
  assert.equal(v.ok, true);
  assert.equal(v.data.name, '新名');
  assert.equal(v.data.price, 10);
});

test('isZhiliAdmin JWT role', () => {
  assert.equal(isZhiliAdmin(1, { role: 'admin' }), true);
  assert.equal(isZhiliAdmin(1, { role: 'user' }), false);
});

test('isZhiliAdmin ZHILI_ADMIN_USER_IDS', () => {
  process.env.ZHILI_ADMIN_USER_IDS = '7,8';
  delete process.env.ZHILI_DEV_ADMIN_ANY_USER;
  assert.equal(isZhiliAdmin(7, {}), true);
  assert.equal(isZhiliAdmin(9, {}), false);
  delete process.env.ZHILI_ADMIN_USER_IDS;
});

test('rowToAdminProduct clickCount 与 ISO 时间', () => {
  const p = rowToAdminProduct({
    product_id: 'p001',
    name: 'N',
    price: 1,
    sell_point: '',
    occasion_keyword: '',
    images: '[]',
    styles: '[]',
    occasions: '[]',
    interests: '[]',
    gender: 'male',
    age_bands: '[]',
    taboos_avoid: '[]',
    hot_rank: 1,
    click_count: 3,
    affiliate_url: null,
    created_at: new Date('2026-03-01T08:00:00.000Z'),
    updated_at: new Date('2026-03-01T08:00:00.000Z'),
  });
  assert.equal(p.clickCount, 3);
  assert.equal(p.createdAt, '2026-03-01T08:00:00.000Z');
});
