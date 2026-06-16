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
