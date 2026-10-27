// The home base's "what next" answers (js/core/base.js, docs/LOOP.md §3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { building, shoppingList, nearlyAffordable, closestFeat, featProgress } from '../js/core/base.js';
import { featById } from '../js/core/feats.js';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const at = (min) => new Date(NOW + min * 60e3).toISOString();

test('building: live jobs, soonest finish first; finished and cancelled ones are not', () => {
  const jobs = [
    { id: 1, item_id: 'bike-rack', started_at: at(-60), finishes_at: at(-30) },
    { id: 2, item_id: 'bike-wheels-t1', started_at: at(-5), finishes_at: at(5) },
    { id: 3, item_id: 'run-water', started_at: at(5), finishes_at: at(35) },
    { id: 4, item_id: 'gym-chalk', started_at: at(-5), finishes_at: at(25), state: 'cancelled' },
  ];
  assert.deepEqual(building(jobs, NOW).map((j) => j.id), [2, 3]);
});

test('shopping list: each slot\'s next tier and the props not yours or queued', () => {
  const inv = [{ item_id: 'bike-wheels-t1' }, { item_id: 'bike-rack' }];
  const jobs = [{ id: 1, item_id: 'bike-frame-t1', started_at: at(-1), finishes_at: at(9) }];
  const ids = shoppingList(inv, jobs, NOW).map((x) => x.id);
  assert.ok(ids.includes('bike-wheels-t2'));
  assert.ok(!ids.includes('bike-frame-t1'), 'in the workshop');
  assert.ok(!ids.includes('bike-frame-t2'), 'waits for the tier in the workshop');
  assert.ok(!ids.includes('bike-rack'), 'owned');
  assert.ok(ids.includes('bike-stand'));
  assert.ok(!ids.includes('bike-podium'), 'rare props are never on sale');
});

test('nearly affordable: what you can buy now, and the cheapest thing you cannot yet', () => {
  const r = nearlyAffordable([], [], 120, NOW);
  assert.ok(r.affordable > 0, 'tier-1 gear costs 100');
  assert.equal(r.nearest.item.cost, 150, 'the chalk bowl is the next cheapest');
  assert.equal(r.nearest.short, 30);
  assert.equal(nearlyAffordable([], [], 0, NOW).affordable, 0);
});

test('closest feat: the unwon feat with the most progress, never a won or untouched one', () => {
  const run = (id, km, date) => ({ id, date, type: 'run', intensity: 'easy', durationMin: km * 6, completed: true, strava_activity_id: id.length, metrics: { distanceKm: km }, actual: { distanceKm: km, movingSec: km * 360 } });
  const ws = [run('a', 8, '2026-11-01')];
  const c = closestFeat(ws, []);
  assert.ok(c, 'something is close');
  assert.ok(c.progress > 0 && c.progress < 1);
  const again = closestFeat(ws, [c.feat.id]);
  assert.ok(!again || again.feat.id !== c.feat.id);
  assert.equal(closestFeat([], []), null);
  assert.equal(featProgress(featById('run-10k'), { best: 5, target: 10 }), 0.5);
  assert.equal(featProgress(featById('run-5k-25'), { best: 1800, target: 1500 }), 1500 / 1800);
});
