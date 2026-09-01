import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore, migrate, normalizeWorkout, freshState, SCHEMA_VERSION } from '../js/app/stores/local-store.js';

// In-memory Storage-like shim so the store is testable outside the browser.
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

test('hydrate seeds a fresh plan when storage is empty', () => {
  const s = new LocalStore({ storage: fakeStorage() });
  const snap = s.hydrate();
  assert.equal(snap.version, SCHEMA_VERSION);
  assert.ok(snap.workouts.length > 200);
  assert.ok(snap.workouts.every((w) => w.source && w.updated_at), 'every workout has source + updated_at');
});

test('upsert stamps updated_at and persists; get/list read it back', () => {
  const s = new LocalStore({ storage: fakeStorage() });
  s.hydrate();
  const before = s.list().length;
  const w = { id: 'x1', date: '2026-07-01', type: 'run', title: 'Test', source: 'custom' };
  s.upsert(w);
  assert.equal(s.list().length, before + 1);
  assert.ok(s.get('x1').updated_at, 'updated_at stamped on upsert');

  const t1 = s.get('x1').updated_at;
  s.upsert({ ...w, title: 'Renamed' });
  assert.equal(s.list().length, before + 1, 'upsert by id replaces, not duplicates');
  assert.equal(s.get('x1').title, 'Renamed');
  assert.ok(s.get('x1').updated_at >= t1);
});

test('delete removes a workout', () => {
  const s = new LocalStore({ storage: fakeStorage() });
  s.hydrate();
  s.upsert({ id: 'gone', date: '2026-07-01', type: 'run', title: 'x' });
  s.delete('gone');
  assert.equal(s.get('gone'), undefined);
});

test('persistence round-trips across instances on the same storage', () => {
  const storage = fakeStorage();
  const a = new LocalStore({ storage });
  a.hydrate();
  a.upsert({ id: 'keep', date: '2026-07-02', type: 'bike', title: 'Ride', source: 'custom' });

  const b = new LocalStore({ storage });
  b.hydrate();
  assert.ok(b.get('keep'), 'second instance reads the persisted workout');
  assert.equal(b.get('keep').title, 'Ride');
});

test('setMeta persists settings and unlocked badges', () => {
  const s = new LocalStore({ storage: fakeStorage() });
  s.hydrate();
  s.setMeta({ settings: { sound: true }, unlockedBadges: ['first-workout'] });
  assert.equal(s.snapshot().settings.sound, true);
  assert.deepEqual(s.snapshot().unlockedBadges, ['first-workout']);
});

test('migrate backfills source + updated_at on legacy v1 data', () => {
  const legacy = {
    version: 1,
    settings: { sound: true },
    workouts: [
      { id: 'a', date: '2026-07-01', type: 'run', title: 'Seeded', seeded: true },
      { id: 'b', date: '2026-07-01', type: 'gym', title: 'Custom one', completedAt: '2026-07-01T10:00:00.000Z' },
    ],
  };
  const out = migrate(legacy);
  assert.equal(out.version, SCHEMA_VERSION);
  assert.equal(out.workouts[0].source, 'plan');
  assert.equal(out.workouts[1].source, 'custom');
  assert.equal(out.workouts[1].updated_at, '2026-07-01T10:00:00.000Z', 'falls back to completedAt');
  assert.ok(Array.isArray(out.unlockedBadges));
  assert.equal(out.settings.units, 'metric', 'defaults merged in');
});

test('normalizeWorkout is idempotent', () => {
  const w = normalizeWorkout({ id: 'a', seeded: true });
  const w2 = normalizeWorkout(w);
  assert.equal(w2.source, 'plan');
  assert.equal(w2.updated_at, w.updated_at);
});

test('deleteMany drops every id in one pass and persists', () => {
  const storage = fakeStorage();
  const s = new LocalStore({ storage });
  s.hydrate();
  const before = s.list().length;
  const ids = s.list().slice(0, 5).map((w) => w.id);

  s.deleteMany(ids);

  assert.equal(s.list().length, before - 5);
  assert.ok(ids.every((id) => !s.get(id)), 'none of the ids survive');
  const persisted = JSON.parse(storage.getItem('triquest.v1'));
  assert.equal(persisted.workouts.length, before - 5, 'the wipe reached storage');
});

test('deleteMany ignores unknown ids and an empty list', () => {
  const s = new LocalStore({ storage: fakeStorage() });
  s.hydrate();
  const before = s.list().length;
  s.deleteMany([]);
  s.deleteMany(['no-such-workout']);
  assert.equal(s.list().length, before);
});
