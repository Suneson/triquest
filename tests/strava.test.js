import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapType, actualsFromActivity, matchActivity, linkActivityToWorkout, buildStravaWorkout, unlinkActivity,
} from '../js/core/strava.js';

const planned = (over = {}) => ({
  id: 'p1', date: '2026-07-08', type: 'bike', title: 'Bike Z2', intensity: 'steady',
  durationMin: 96, metrics: { distanceKm: 50 }, completed: false, strava_activity_id: null, source: 'plan', ...over,
});

const activity = (over = {}) => ({
  id: 99001, sport_type: 'Ride', name: 'Evening Ride', start_date_local: '2026-07-08T17:30:00Z',
  distance: 50200, moving_time: 5760, total_elevation_gain: 320, average_heartrate: 142,
  average_watts: 198, average_cadence: 88, calories: 720, ...over,
});

test('sport-type mapping covers every documented bucket', () => {
  ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide'].forEach((s) => assert.equal(mapType(s), 'bike'));
  ['Run', 'TrailRun', 'VirtualRun'].forEach((s) => assert.equal(mapType(s), 'run'));
  assert.equal(mapType('Swim'), 'swim');
  ['WeightTraining', 'Workout', 'Crossfit'].forEach((s) => assert.equal(mapType(s), 'gym'));
  assert.equal(mapType('Kayaking'), 'other');
  assert.equal(mapType(undefined), 'other');
});

test('actuals are converted from metric and rounded', () => {
  const a = actualsFromActivity(activity());
  assert.equal(a.distanceKm, 50.2);
  assert.equal(a.durationMin, 96);
  assert.equal(a.elevationGainM, 320);
  assert.equal(a.avgHr, 142);
  assert.equal(a.stravaLink, 'https://www.strava.com/activities/99001');
  // missing fields become null, not NaN
  const sparse = actualsFromActivity({ id: 1, moving_time: 600 });
  assert.equal(sparse.distanceKm, null);
  assert.equal(sparse.durationMin, 10);
});

test('matching: hits the same-day same-type uncompleted planned session', () => {
  const ws = [planned(), planned({ id: 'run1', type: 'run' })];
  const d = matchActivity(activity(), ws);
  assert.equal(d.action, 'link');
  assert.equal(d.workout.id, 'p1');
});

test('matching: among candidates, picks the closest planned duration', () => {
  const ws = [
    planned({ id: 'short', durationMin: 40 }),
    planned({ id: 'close', durationMin: 95 }),
    planned({ id: 'long', durationMin: 180 }),
  ];
  const d = matchActivity(activity({ moving_time: 5760 }), ws); // 96 min
  assert.equal(d.action, 'link');
  assert.equal(d.workout.id, 'close');
});

test('matching: no candidate -> insert', () => {
  const ws = [planned({ type: 'run' })]; // wrong type for a Ride
  assert.equal(matchActivity(activity(), ws).action, 'insert');
  // wrong date
  assert.equal(matchActivity(activity({ start_date_local: '2026-07-09T10:00:00Z' }), [planned()]).action, 'insert');
  // already completed -> not a candidate
  assert.equal(matchActivity(activity(), [planned({ completed: true })]).action, 'insert');
});

test('matching: dedupe — an already-linked activity returns update', () => {
  const ws = [planned({ completed: true, strava_activity_id: 99001 })];
  const d = matchActivity(activity(), ws);
  assert.equal(d.action, 'update');
  assert.equal(d.workout.id, 'p1');
});

test('matching: brick day — a Ride does not hijack the brick, it inserts', () => {
  // The plan has a single 'brick' session; an incoming Ride (->bike) finds no
  // type match and is inserted as unplanned for manual reconciliation.
  const brickDay = [{ id: 'br', date: '2026-09-12', type: 'brick', completed: false, durationMin: 200, strava_activity_id: null }];
  const ride = activity({ start_date_local: '2026-09-12T08:00:00Z' });
  assert.equal(matchActivity(ride, brickDay).action, 'insert');
});

test('linkActivityToWorkout ticks off the plan and stores actuals without losing the plan', () => {
  const w = planned();
  linkActivityToWorkout(w, activity());
  assert.equal(w.completed, true);
  assert.equal(w.strava_activity_id, 99001);
  assert.equal(w.durationMin, 96, 'planned duration preserved');
  assert.equal(w.actual.distanceKm, 50.2, 'actual stored separately');
  assert.ok(w.completedAt);
});

test('buildStravaWorkout creates a completed unplanned session', () => {
  const w = buildStravaWorkout(activity(), 'new-1');
  assert.equal(w.source, 'strava');
  assert.equal(w.completed, true);
  assert.equal(w.type, 'bike');
  assert.equal(w.strava_activity_id, 99001);
  assert.equal(w.metrics.distanceKm, 50.2);
});

test('unlink keeps a planned session but clears the link; flags unplanned for removal', () => {
  const p = planned({ completed: true, strava_activity_id: 99001, actual: { distanceKm: 50 } });
  const r1 = unlinkActivity(p);
  assert.ok(r1.kept);
  assert.equal(p.strava_activity_id, null);
  assert.equal(p.actual, null);

  const imported = buildStravaWorkout(activity(), 'imp-1');
  const r2 = unlinkActivity(imported);
  assert.equal(r2.removeId, 'imp-1');
});
