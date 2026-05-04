import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndNormalizeEventBody, ALLOWED_EVENT_TYPES } from './lib/eventPayload.js';

test('ALLOWED_EVENT_TYPES 含 collect 等', () => {
  assert.equal(ALLOWED_EVENT_TYPES.has('collect'), true);
  assert.equal(ALLOWED_EVENT_TYPES.has('explore_click'), true);
});

test('validateAndNormalizeEventBody 缺 event', () => {
  const r = validateAndNormalizeEventBody({}, { userIdFromJwt: null });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'BAD_REQUEST');
});

test('validateAndNormalizeEventBody 非法 event', () => {
  const r = validateAndNormalizeEventBody({ event: 'hacker_event' }, { userIdFromJwt: null });
  assert.equal(r.ok, false);
});

test('validateAndNormalizeEventBody 非法 product_id', () => {
  const r = validateAndNormalizeEventBody(
    { event: 'click', product_id: 'bad id' },
    { userIdFromJwt: null }
  );
  assert.equal(r.ok, false);
});

test('validateAndNormalizeEventBody user_id 仅用 JWT，Body user_id 进 extra', () => {
  const r = validateAndNormalizeEventBody(
    {
      event: 'impression',
      user_id: 'anon_vid',
      group: 'B',
      product_id: 'p001',
      page_name: 'browse',
      position: 2,
    },
    { userIdFromJwt: 7 }
  );
  assert.equal(r.ok, true);
  assert.equal(r.row.user_id, 7);
  assert.equal(r.row.event_type, 'impression');
  assert.equal(r.row.product_id, 'p001');
  assert.equal(r.row.page_name, 'browse');
  assert.equal(r.row.position, 2);
  assert.equal(r.row.extra.user_id, 'anon_vid');
  assert.equal(r.row.extra.group, 'B');
});

test('validateAndNormalizeEventBody 匿名 user_id 为 null', () => {
  const r = validateAndNormalizeEventBody({ event: 'page_view', user_id: 'vid' }, { userIdFromJwt: null });
  assert.equal(r.ok, true);
  assert.equal(r.row.user_id, null);
  assert.equal(r.row.extra.user_id, 'vid');
});

test('validateAndNormalizeEventBody 剥离敏感键', () => {
  const r = validateAndNormalizeEventBody(
    { event: 'click', token: 'x', openid: 'o', code: 'wx', group: 'A' },
    { userIdFromJwt: null }
  );
  assert.equal(r.ok, true);
  assert.equal(r.row.extra.token, undefined);
  assert.equal(r.row.extra.openid, undefined);
  assert.equal(r.row.extra.code, undefined);
  assert.equal(r.row.extra.group, 'A');
});
