import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workoutToRow, rowToWorkout } from '../js/app/stores/supabase-store.js';

const sample = {
  id: 'seed-2026-07-06-0', date: '2026-07-06', type: 'run', title: 'Fartlek',
  intensity: 'quality', durationMin: 60, metrics: { distanceKm: 12 },
  completed: true, completedAt: '2026-07-06T09:00:00.000Z', phase: 'Base + Strength',
  deload: false, segments: [{ label: 'Hard', kind: 'work', value: 3, intensity: 'threshold' }],
  exercises: [], packing: [{ item: 'Shoes', checked: false }], notes: 'go',
  source: 'plan', strava_activity_id: null, updated_at: '2026-07-06T09:00:00.000Z',
  isRace: false, optional: false, phaseId: 'base', weekNum: 1, seeded: true,
};

test('workoutToRow maps camelCase + nested metrics to snake_case columns', () => {
  const row = workoutToRow(sample, 'user-123');
  assert.equal(row.user_id, 'user-123');
  assert.equal(row.duration_min, 60);
  assert.equal(row.distance_km, 12);
  assert.equal(row.completed_at, '2026-07-06T09:00:00.000Z');
  assert.equal(row.source, 'plan');
  assert.deepEqual(row.extra, { isRace: false, optional: false, phaseId: 'base', weekNum: 1, seeded: true });
});

test('empty distance becomes null (not NaN/empty string)', () => {
  const row = workoutToRow({ ...sample, metrics: { distanceKm: '' } }, 'u');
  assert.equal(row.distance_km, null);
});

test('row -> workout -> row round-trips the meaningful fields', () => {
  const row = workoutToRow(sample, 'u');
  const w = rowToWorkout(row);
  assert.equal(w.id, sample.id);
  assert.equal(w.durationMin, 60);
  assert.equal(w.metrics.distanceKm, 12);
  assert.equal(w.completed, true);
  assert.equal(w.isRace, false);
  assert.equal(w.weekNum, 1);
  assert.equal(w.seeded, true);

  const row2 = workoutToRow(w, 'u');
  assert.deepEqual(row2, row);
});

test('rowToWorkout tolerates a sparse Strava-inserted row', () => {
  const w = rowToWorkout({
    id: 'abc', date: '2026-07-10', type: 'bike', completed: true, source: 'strava',
    distance_km: 50.2, duration_min: 96, updated_at: '2026-07-10T10:00:00Z', extra: null,
  });
  assert.equal(w.metrics.distanceKm, 50.2);
  assert.equal(w.intensity, 'easy');
  assert.deepEqual(w.segments, []);
});

// ---- remote wipe semantics --------------------------------------------------
// pull() keeps any row that exists only on the server, so a delete or an import
// that never removes the server's copy silently undoes itself on the next sync.

/** Minimal postgrest-shaped fake: records deletes, serves select('id'). */
function fakeClient(remoteIds = []) {
  const calls = { deleted: [], upserted: [] };
  let rows = remoteIds.map((id) => ({ id }));
  const client = {
    from() {
      const q = {
        select: () => ({ eq: async () => ({ data: rows, error: null }) }),
        delete: () => ({
          in: (_col, ids) => ({
            eq: async () => {
              calls.deleted.push(...ids);
              rows = rows.filter((r) => !ids.includes(r.id));
              return { error: null };
            },
          }),
        }),
        upsert: async (payload) => {
          calls.upserted.push(...(Array.isArray(payload) ? payload : [payload]));
          return { error: null };
        },
      };
      return q;
    },
  };
  return { client, calls, remaining: () => rows.map((r) => r.id) };
}

const settled = () => new Promise((r) => setTimeout(r, 0));

test('deleteMany removes the rows from the server, chunked', async () => {
  const { SupabaseStore } = await import('../js/app/stores/supabase-store.js');
  const { client, calls } = fakeClient();
  const s = new SupabaseStore(client, 'u');
  s.cache = { deleteMany() {}, delete() {} };

  const ids = Array.from({ length: 250 }, (_, i) => `w-${i}`);
  s.deleteMany(ids);
  await settled();

  assert.deepEqual(calls.deleted, ids, 'every id reaches the server');
});

test('replaceAll deletes server rows the new snapshot drops', async () => {
  const { SupabaseStore } = await import('../js/app/stores/supabase-store.js');
  const { client, calls, remaining } = fakeClient(['old-1', 'old-2', 'kept']);
  const s = new SupabaseStore(client, 'u');
  s.cache = { replaceAll() {}, snapshot: () => ({ settings: {} }) };

  s.replaceAll({ workouts: [{ id: 'kept' }, { id: 'new-1' }], settings: {} });
  await settled(); await settled(); await settled();

  assert.deepEqual(calls.deleted.sort(), ['old-1', 'old-2'], 'dropped rows are deleted');
  assert.ok(!calls.deleted.includes('kept'), 'rows the import keeps are not deleted');
  assert.deepEqual(remaining().sort(), ['kept'], 'server no longer holds the replaced plan');
  assert.ok(calls.upserted.some((r) => r.id === 'new-1'), 'imported rows are pushed');
});

test('a failed delete reports through onWriteError instead of failing silently', async () => {
  const { SupabaseStore } = await import('../js/app/stores/supabase-store.js');
  const boom = {
    from: () => ({ delete: () => ({ in: () => ({ eq: async () => ({ error: { message: 'offline' } }) }) }) }),
  };
  let reported = null;
  const s = new SupabaseStore(boom, 'u', { onWriteError: (e) => { reported = e; } });
  s.cache = { deleteMany() {} };

  s.deleteMany(['w-1']);
  await settled(); await settled();

  assert.ok(reported, 'the athlete is told the wipe did not reach the server');
  assert.match(reported.message, /offline/);
});
