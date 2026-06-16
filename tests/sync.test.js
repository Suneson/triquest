import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeByUpdatedAt, applyRemoteChange } from '../js/core/sync.js';

const w = (id, updated_at, extra = {}) => ({ id, updated_at, ...extra });

test('newer updated_at wins on both sides', () => {
  const local = [w('a', '2026-07-02T00:00:00Z', { title: 'local-new' })];
  const remote = [w('a', '2026-07-01T00:00:00Z', { title: 'remote-old' })];
  const { merged, toUpsertRemote } = mergeByUpdatedAt(local, remote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'local-new');
  assert.equal(toUpsertRemote.length, 1, 'local is newer -> push');
});

test('remote newer wins and is not re-pushed', () => {
  const local = [w('a', '2026-07-01T00:00:00Z', { title: 'local-old' })];
  const remote = [w('a', '2026-07-03T00:00:00Z', { title: 'remote-new' })];
  const { merged, toUpsertRemote } = mergeByUpdatedAt(local, remote);
  assert.equal(merged[0].title, 'remote-new');
  assert.equal(toUpsertRemote.length, 0);
});

test('local-only rows are kept and queued for upload', () => {
  const local = [w('only-local', '2026-07-01T00:00:00Z')];
  const { merged, toUpsertRemote } = mergeByUpdatedAt(local, []);
  assert.equal(merged.length, 1);
  assert.equal(toUpsertRemote[0].id, 'only-local');
});

test('remote-only rows are pulled in without re-push', () => {
  const remote = [w('only-remote', '2026-07-01T00:00:00Z')];
  const { merged, toUpsertRemote } = mergeByUpdatedAt([], remote);
  assert.equal(merged.length, 1);
  assert.equal(toUpsertRemote.length, 0);
});

test('union of disjoint sets', () => {
  const { merged } = mergeByUpdatedAt([w('a', '2026-07-01Z')], [w('b', '2026-07-01Z')]);
  assert.deepEqual(merged.map((x) => x.id).sort(), ['a', 'b']);
});

test('missing updated_at is treated as oldest', () => {
  const local = [w('a', undefined, { title: 'no-ts' })];
  const remote = [w('a', '2026-01-01T00:00:00Z', { title: 'has-ts' })];
  const { merged } = mergeByUpdatedAt(local, remote);
  assert.equal(merged[0].title, 'has-ts');
});

test('applyRemoteChange inserts new and updates by LWW', () => {
  let list = [w('a', '2026-07-01T00:00:00Z', { title: 'old' })];
  list = applyRemoteChange(list, w('b', '2026-07-01T00:00:00Z'));
  assert.equal(list.length, 2);
  list = applyRemoteChange(list, w('a', '2026-07-05T00:00:00Z', { title: 'new' }));
  assert.equal(list.find((x) => x.id === 'a').title, 'new');
  list = applyRemoteChange(list, w('a', '2020-01-01T00:00:00Z', { title: 'stale' }));
  assert.equal(list.find((x) => x.id === 'a').title, 'new', 'stale remote ignored');
});
