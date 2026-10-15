import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupThreads, unreadOf, bellCountOf, chatTime, validUsername, cleanUsername } from '../js/core/social.js';

const ME = 'me';
const friends = [
  { user_id: 'a', status: 'accepted', incoming: false, created_at: '2026-10-01T00:00:00Z' },
  { user_id: 'b', status: 'accepted', incoming: true, created_at: '2026-10-02T00:00:00Z' },
  { user_id: 'c', status: 'pending', incoming: true, created_at: '2026-10-03T00:00:00Z' },
  { user_id: 'd', status: 'pending', incoming: false, created_at: '2026-10-04T00:00:00Z' },
];
const msg = (id, sender, recipient, at, read = true) => ({ id, sender, recipient, body: `m${id}`, created_at: at, read_at: read ? at : null });

test('threads: one per accepted friend, newest conversation first, unread counted', () => {
  const messages = [
    msg(1, 'a', ME, '2026-10-10T10:00:00Z', false),
    msg(2, ME, 'a', '2026-10-10T11:00:00Z'),
    msg(3, 'b', ME, '2026-10-12T09:00:00Z', false),
    msg(4, 'b', ME, '2026-10-12T09:05:00Z', false),
    msg(5, 'c', ME, '2026-10-13T09:05:00Z', false), // pending friend: no thread
  ];
  const t = groupThreads(messages, ME, friends);
  assert.deepEqual(t.map((x) => [x.friend.user_id, x.last.id, x.unread]), [['b', 4, 2], ['a', 2, 1]]);
  const empty = groupThreads([], ME, friends);
  assert.deepEqual(empty.map((x) => [x.friend.user_id, x.last, x.unread]), [['b', null, 0], ['a', null, 0]]);
});

test('bell: waiting friend requests + unread notifications, app news by device', () => {
  const notes = [
    { id: 9, user_id: null, kind: 'app_update', read_at: null },
    { id: 8, user_id: ME, kind: 'friend_request', read_at: null }, // already counted as a request
    { id: 7, user_id: ME, kind: 'friend_accepted', read_at: null },
    { id: 6, user_id: ME, kind: 'friend_accepted', read_at: '2026-10-01T00:00:00Z' },
  ];
  assert.deepEqual(unreadOf(notes, 0).map((n) => n.id), [9, 8, 7]);
  assert.deepEqual(unreadOf(notes, 9).map((n) => n.id), [8, 7], 'news this device has seen is read');
  assert.equal(bellCountOf(friends, notes, 0), 1 + 2);
  assert.equal(bellCountOf(friends, notes, 9), 1 + 1);
  assert.equal(bellCountOf([], [], 0), 0);
});

test('short chat times', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  assert.equal(chatTime('2026-10-15T11:59:30Z', now), 'now');
  assert.equal(chatTime('2026-10-15T11:55:00Z', now), '5m');
  assert.equal(chatTime('2026-10-15T09:00:00Z', now), '3h');
  assert.equal(chatTime('2026-10-01T09:00:00Z', now), '1 Oct');
  assert.equal(chatTime('nope', now), '');
});

test('usernames follow the database rule', () => {
  assert.ok(validUsername('alberto_s'));
  assert.ok(validUsername('@Alberto_S'), 'a leading @ and capitals are cleaned');
  assert.ok(!validUsername('ab'));
  assert.ok(!validUsername('has space'));
  assert.ok(!validUsername('x'.repeat(21)));
  assert.equal(cleanUsername(' @Moske_Fan '), 'moske_fan');
});
