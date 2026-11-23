import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, jobOn, jobOf, nextLevel, whyNot, startRow, crew, freeBuilder, progress, TARGETS } from '../js/core/jobs.js';

const H = 3600e3;
const NOW = Date.parse('2026-11-23T12:00:00Z');

test('levels count finished jobs only', () => {
  const jobs = [startRow([], 'gel-stand', 'blue', NOW - 10 * H)];
  assert.equal(levelOf(jobs, 'gel-stand', NOW), 2);
  const running = [...jobs, startRow(jobs, 'gel-stand', 'blue', NOW - H, 2)];
  assert.equal(levelOf(running, 'gel-stand', NOW), 2);
  assert.equal(jobOn(running, 'gel-stand', NOW).to_level, 3);
  assert.equal(jobOf(running, 'blue', NOW).id, 2);
  assert.ok(progress(jobOf(running, 'blue', NOW), NOW) > 0);
  assert.equal(nextLevel(running, 'gel-stand', NOW).to, 3);
});

test('whyNot: the same checks as the server', () => {
  const base = { jobs: [], inventory: [], coins: 10000, target: 'gel-stand', builder: 'blue', now: NOW };
  assert.equal(whyNot(base), null);
  assert.equal(whyNot({ ...base, target: 'pool' }), 'gear:unknown_target');
  assert.equal(whyNot({ ...base, builder: 'red' }), 'gear:not_hired');
  assert.equal(whyNot({ ...base, inventory: [{ item_id: 'builder-red' }], builder: 'red' }), null);
  assert.equal(whyNot({ ...base, coins: 10 }), 'gear:insufficient');
  const busy = [startRow([], 'coffee-shop', 'blue', NOW)];
  assert.equal(whyNot({ ...base, jobs: busy }), 'gear:builder_busy');
  assert.equal(whyNot({ ...base, jobs: busy, target: 'coffee-shop', builder: 'red', inventory: [{ item_id: 'builder-red' }] }), 'gear:busy_target');
  const top = TARGETS['gel-stand'].levels.slice(2).map((_, i) => ({ id: i, builder: 'blue', target: 'gel-stand', to_level: i + 2, started_at: '2026-01-01T00:00:00Z', finishes_at: '2026-01-02T00:00:00Z' }));
  assert.equal(whyNot({ ...base, jobs: top }), 'gear:top');
});

test('crew and the first free builder', () => {
  const jobs = [startRow([], 'coffee-shop', 'blue', NOW)];
  const inv = [{ item_id: 'builder-green' }];
  assert.deepEqual(crew(jobs, inv, NOW).map((c) => [c.who, c.hired, !!c.job]), [['blue', true, true], ['red', false, false], ['green', true, false], ['gold', false, false]]);
  assert.equal(freeBuilder(jobs, inv, NOW), 'green');
  assert.equal(freeBuilder(jobs, [], NOW), null);
});
