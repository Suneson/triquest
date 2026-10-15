import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBody, rateLimited, roomView, roomUnread, mergeMessages, clientId, MAX_LEN } from '../js/core/room.js';

const m = (id, user_id, at, extra = {}) => ({ id, user_id, body: `m${id}`, created_at: `2026-10-15T10:${String(at).padStart(2, '0')}:00Z`, deleted_at: null, ...extra });

test('a message is 1–500 characters after trimming', () => {
  assert.equal(checkBody('  hi  ').body, 'hi');
  assert.ok(checkBody('   ').error);
  assert.ok(checkBody('x'.repeat(MAX_LEN + 1)).error);
  assert.equal(checkBody('x'.repeat(MAX_LEN)).body.length, MAX_LEN);
});

test('ten posts a minute, then wait', () => {
  const now = 1_000_000;
  const nine = Array.from({ length: 9 }, (_, i) => now - i * 1000);
  assert.equal(rateLimited(nine, now), false);
  assert.equal(rateLimited([...nine, now - 500], now), true);
  assert.equal(rateLimited([...nine, now - 61000], now), false); // a minute old no longer counts
});

test('blocked authors fold, removed messages stay as a line, mine are never hidden', () => {
  const list = [m(1, 'a', 1), m(2, 'b', 2), m(3, 'b', 3, { deleted_at: 'x', body: '' }), m(4, 'me', 4)];
  const v = roomView(list, { blocked: new Set(['b', 'me']), me: 'me' });
  assert.deepEqual(v.map((x) => x.kind), ['msg', 'hidden', 'removed', 'msg']);
  assert.equal(v[1].body, '');
  assert.equal(v[3].mine, true);
});

test('an optimistic bubble gives way to the echoed row; a failed one says so', () => {
  const list = [m(1, 'me', 1, { client_id: 'c1' }), { id: -1, user_id: 'me', body: 'hi', created_at: '2026-10-15T10:01:00Z', pending: true, client_id: 'c1' },
    { id: -2, user_id: 'me', body: 'oops', created_at: '2026-10-15T10:02:00Z', pending: true, failed: true, client_id: 'c2' }];
  const v = roomView(list, { me: 'me' });
  assert.deepEqual(v.map((x) => x.kind), ['msg', 'failed']);
});

test('unread counts other people only, past what I have seen', () => {
  const list = [m(1, 'a', 1), m(2, 'me', 2), m(3, 'b', 3), m(4, 'c', 4, { deleted_at: 'x' }), m(5, 'a', 5)];
  assert.equal(roomUnread(list, { lastSeenId: 0, me: 'me' }), 3);
  assert.equal(roomUnread(list, { lastSeenId: 3, me: 'me' }), 1);
  assert.equal(roomUnread(list, { lastSeenId: 0, me: 'me', blocked: new Set(['a']) }), 1);
});

test('merging pages keeps one copy of each message and keeps pending bubbles', () => {
  const list = [m(5, 'a', 5), { id: -1, pending: true, client_id: 'c', user_id: 'me', created_at: 'z' }];
  const out = mergeMessages(list, [m(4, 'a', 4), m(5, 'a', 5, { body: 'edited' })]);
  assert.equal(out.filter((x) => x.id === 5).length, 1);
  assert.equal(out.find((x) => x.id === 5).body, 'edited');
  assert.equal(out.filter((x) => x.pending).length, 1);
  assert.equal(out.length, 3);
});

test('client ids are short and distinct', () => {
  assert.notEqual(clientId(1, 0.1), clientId(1, 0.2));
  assert.ok(clientId().length <= 64);
});
