// Training and recovering in the base (js/core/drills.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRILLS, emptyDrills, normaliseDrills, levelOpen, drillLevel, forecast, startDrill, drillNow, cancelDrill,
  startRecovery, cancelRecovery, settle, clearResult, staminaShown, efficiency, drillOfItem, recoveryOfItem,
} from '../js/core/drills.js';
import { STAMINA } from '../js/core/stamina.js';

const MIN = 60e3;
const fresh = () => normaliseDrills(null);

test('level 1 is a 1 km run in 6 minutes that costs a little; level 2 is 3 km in 18 and costs more', () => {
  const l1 = drillLevel('run', 1); const l2 = drillLevel('run', 2);
  assert.deepEqual([l1.km, l1.min], [1, 6]);
  assert.deepEqual([l2.km, l2.min], [3, 18]);
  assert.ok(l2.cost > 2 * l1.cost);
  assert.ok(DRILLS.run.levels.some((l) => l.pace), 'some levels are a time to beat');
  assert.ok(DRILLS.run.levels.at(-1).cost > STAMINA.max, 'the top levels need efficiency');
});

test('only level 1 is open to begin with', () => {
  const d = fresh();
  assert.equal(levelOpen(d, 'run'), 1);
  assert.equal(startDrill(d, 'run', 2, { stamina: 100, now: 0 }).error, 'locked');
  assert.equal(startDrill(d, 'run', 1, { stamina: 0, now: 0 }).error, 'empty');
});

test('a completed drill opens the next level and spends its cost', () => {
  const { drills } = startDrill(fresh(), 'run', 1, { stamina: 80, now: 0 });
  assert.equal(drillNow(drills.active, 3 * MIN).stamina, 75, 'it drains as it goes');
  assert.equal(staminaShown(drills, { value: 80, at: 0 }, 3 * MIN), 75);
  const r = settle(drills, { value: 80, at: 0 }, 6 * MIN);
  assert.equal(r.drills.active, null);
  assert.equal(levelOpen(r.drills, 'run'), 2);
  assert.deepEqual(r.stamina, { value: 70, at: 6 * MIN });
  assert.equal(r.drills.result.ok, true);
  assert.equal(r.drills.result.opened, 2);
  assert.equal(clearResult(r.drills).result, null);
});

test('not enough stamina: it fails where the bar runs out, stamina is zero, nothing opens', () => {
  const d = { ...fresh(), levels: { run: 2 } };
  const f = forecast('run', 2, 12);
  assert.equal(f.ok, false);
  assert.ok(Math.abs(f.km - 1.2) < 1e-9);
  const { drills } = startDrill(d, 'run', 2, { stamina: 12, now: 0 });
  const s = drillNow(drills.active, 0);
  assert.equal(s.ok, false);
  assert.equal(s.failAt, 0.4 * 18 * MIN);
  const r = settle(drills, { value: 12, at: 0 }, 20 * MIN);
  assert.equal(levelOpen(r.drills, 'run'), 2);
  assert.deepEqual(r.stamina, { value: 0, at: 0.4 * 18 * MIN }, 'empty from the moment it ran out, refilling from then');
  assert.equal(r.drills.result.ok, false);
  assert.equal(r.drills.result.km, 1.2);
});

test('stopping early keeps what was spent and opens nothing', () => {
  const { drills } = startDrill(fresh(), 'run', 1, { stamina: 50, now: 0 });
  const r = cancelDrill(drills, 3 * MIN);
  assert.equal(r.drills.active, null);
  assert.deepEqual(r.stamina, { value: 45, at: 3 * MIN });
  assert.equal(levelOpen(r.drills, 'run'), 1);
});

test('one thing at a time', () => {
  const { drills } = startDrill(fresh(), 'run', 1, { stamina: 50, now: 0 });
  assert.equal(startRecovery(drills, 'ice-bath', { stamina: 50, now: 0 }).error, 'busy');
  assert.equal(startDrill(drills, 'run', 1, { stamina: 50, now: 0 }).error, 'busy');
});

test('the ice bath gives 15 stamina after 10 minutes; getting out early gives nothing', () => {
  assert.equal(startRecovery(fresh(), 'ice-bath', { stamina: 100, now: 0 }).error, 'full');
  const { drills } = startRecovery(fresh(), 'ice-bath', { stamina: 40, now: 0 });
  assert.equal(settle(drills, { value: 40, at: 0 }, 9 * MIN).changed, false);
  const r = settle(drills, { value: 40, at: 0 }, 10 * MIN);
  assert.deepEqual(r.stamina, { value: 55, at: 10 * MIN });
  assert.equal(r.drills.result.gain, 15);
  assert.equal(cancelRecovery(drills).recovering, null);
  const top = settle(startRecovery(fresh(), 'ice-bath', { stamina: 95, now: 0 }).drills, { value: 95, at: 0 }, 10 * MIN);
  assert.equal(top.stamina.value, 100, 'never past full');
});

test('better treadmills cost less; items know what they open', () => {
  assert.equal(efficiency({ machineTier: 1 }), 0);
  assert.ok(drillLevel('run', 2, efficiency({ machineTier: 4 })).cost < drillLevel('run', 2).cost);
  assert.equal(drillOfItem('treadmill'), 'run');
  assert.equal(drillOfItem('treadmill-t3'), 'run');
  assert.equal(drillOfItem('ice-bath'), null);
  assert.equal(recoveryOfItem('ice-bath'), 'ice-bath');
});

test('broken saved state goes back to empty', () => {
  const d = normaliseDrills({ levels: { run: 99 }, active: { kind: 'nope' }, recovering: { tool: 'x' } });
  assert.equal(d.levels.run, DRILLS.run.levels.length);
  assert.equal(d.active, null);
  assert.equal(d.recovering, null);
  assert.deepEqual(emptyDrills().levels, {});
});
