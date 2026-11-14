// The numbers the design promises (docs/TRAINING.md): a 36-hour gauge, recovery
// taking off 50-60%, an easy level 1, a level 8 that needs the whole build, and
// drills paying 25-30% of the real session.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSES, DISCIPLINES, ENERGY, OPEN_LEVELS, TRAINING, assignJob, burnFactor, canStart, classSwitchCost,
  completionBonus, drillMinutes, setBonus, energyAt, freeWorkers, freshEnergy, gearBuffs, levelTarget, maxStamina, msToFull,
  payShareBp, planDrill, rawBurn, realSessionXp, settleDrill, spendEnergy, successChance, useRecovery, wageFor,
  workerCount,
} from '../js/core/training.js';

const HOUR = 3600000;
const NOW = Date.UTC(2026, 10, 6);
const { run, bike, swim, lift } = DISCIPLINES;
const newcomer = { sportLevel: 1, machineTier: 1, gearBp: 0, classId: null, cleared: false };
const built = { sportLevel: 8, machineTier: 3, gearBp: 1600, classId: 'pacer', cleared: false };

test('an empty gauge takes 36 hours, whatever its maximum', () => {
  for (const max of [100, 130, 172]) {
    const empty = { value: 0, at: NOW };
    assert.ok(Math.abs(msToFull(empty, max, NOW) - 36 * HOUR) < 1);
    assert.ok(Math.abs(energyAt(empty, max, NOW + 18 * HOUR) - max / 2) < 1e-6);
    assert.equal(energyAt(empty, max, NOW + 99 * HOUR), max);
  }
});

test('the gauge is a float, and starts full', () => {
  assert.equal(energyAt(freshEnergy(100, NOW), 100, NOW), 100);
  assert.ok(energyAt({ value: 0, at: NOW }, 100, NOW + 60000) % 1 !== 0);
});

test('the maximum grows with account level and levels cleared', () => {
  assert.equal(maxStamina(), ENERGY.baseMax);
  assert.equal(maxStamina({ rank: 21, cleared: 10 }), 120);
  assert.equal(maxStamina({ rank: 500 }), 140);
});

test('a recovery station takes 50-60% off what is left, from 36 h to 14-18 h', () => {
  const empty = { value: 0, at: NOW };
  const hours = (tier) => msToFull(useRecovery(empty, 100, NOW, 'ice-bath', tier), 100, NOW) / HOUR;
  assert.ok(Math.abs(hours(1) - 18) < 1e-6);
  assert.ok(Math.abs(hours(3) - 14.4) < 1e-6);
  // part-way through: the time left is what's cut
  const half = useRecovery(empty, 100, NOW + 18 * HOUR, 'sauna', 1);
  assert.ok(Math.abs(msToFull(half, 100, NOW + 18 * HOUR) / HOUR - 9) < 1e-6);
});

test('recovery does not stack, and a drill ends it', () => {
  const a = useRecovery({ value: 0, at: NOW }, 100, NOW, 'ice-bath', 3);
  const b = useRecovery(a, 100, NOW, 'sauna', 1);
  assert.equal(b.cutBp, 6000);
  const c = spendEnergy(b, 100, NOW, 0);
  assert.equal(c.cutBp, 0);
});

test('level 1 is a 1 km jog of about 5 minutes with a small drain', () => {
  assert.equal(levelTarget(run, 1), 1);
  assert.equal(drillMinutes(run, 1), 5);
  const plan = planDrill(run, 1, newcomer);
  assert.equal(plan.burn, 11);
  assert.ok(plan.drainPerMin < 2.5);
  assert.equal(successChance(plan, 100), 1);
});

test('the bike ladder goes from a 5 km sprint to a century', () => {
  assert.equal(levelTarget(bike, 1), 5);
  assert.equal(levelTarget(bike, 8), 100);
});

test('distance, time and burn all climb, and the ladder runs past level 20', () => {
  for (const d of Object.values(DISCIPLINES)) {
    for (let l = 2; l <= 24; l++) {
      assert.ok(levelTarget(d, l) > levelTarget(d, l - 1), `${d.id} target ${l}`);
      assert.ok(drillMinutes(d, l) > drillMinutes(d, l - 1), `${d.id} time ${l}`);
      assert.ok(rawBurn(d, l) > rawBurn(d, l - 1), `${d.id} burn ${l}`);
    }
    assert.ok(Math.abs(rawBurn(d, OPEN_LEVELS) - TRAINING.burnAtTop) < 1e-6);
  }
});

test('level 8 takes the whole build: drop any part and it cannot be finished', () => {
  const stamina = maxStamina({ rank: 21, cleared: 10 });
  const chance = (a, s = stamina, d = run) => successChance(planDrill(d, 8, a), s);
  assert.ok(chance(built) > 0.5, 'the full build has a real chance');
  assert.ok(chance(built) < 1, 'and is still no sure thing');
  assert.equal(chance({ ...built, gearBp: 0 }), 0, 'no gear');
  assert.equal(chance({ ...built, machineTier: 1 }), 0, 'basic machine');
  assert.equal(chance({ ...built, sportLevel: 3 }), 0, 'low stats');
  assert.equal(chance({ ...built, classId: 'titan' }), 0, 'wrong class');
  assert.equal(chance(built, 100), 0, 'a small gauge');
  assert.equal(chance(newcomer), 0, 'a newcomer');
  assert.equal(chance({ ...built, classId: 'titan' }, stamina, lift), 1, 'the titan belongs under the bar');
});

test('a machine too basic for the level cannot start it, and levels go in order', () => {
  assert.deepEqual(canStart(1, 0, 1), { ok: true });
  assert.equal(canStart(3, 0, 4).reason, 'ladder');
  assert.equal(canStart(8, 7, 2).reason, 'machine');
  assert.deepEqual(canStart(8, 7, 3), { ok: true });
  assert.equal(canStart(9, 8, 4).reason, 'closed');
});

test('running out stops the athlete there: all of it spent, 10% of base XP, no bonus', () => {
  const plan = planDrill(run, 5, newcomer);
  const stamina = plan.burn * 0.5;
  const r = settleDrill(run, 5, newcomer, stamina, 0.5);
  assert.equal(r.ok, false);
  assert.equal(r.spent, stamina);
  assert.ok(Math.abs(r.stoppedAtMin - plan.durationMin / 2) < 1e-9);
  assert.equal(r.bonus, null);
  assert.equal(r.xp, Math.round(realSessionXp(run, 5) * 0.25 * 0.1));
  assert.deepEqual(completionBonus(5, r.bonus), { crate: false, carbs: 0, maxStamina: 0 });
});

test('minute by minute, the clock agrees with the closed form', () => {
  const plan = planDrill(run, 6, { ...newcomer, machineTier: 3 });
  const stamina = plan.burn * 0.7;
  const r = settleDrill(run, 6, { ...newcomer, machineTier: 3 }, stamina, 0.5);
  let left = stamina;
  let t = 0;
  const step = plan.durationMin / 10000;
  while (left > 0 && t < plan.durationMin) { left -= (r.burn / plan.durationMin) * step; t += step; }
  assert.ok(Math.abs(t - r.stoppedAtMin) < step * 2);
});

test('the shown chance is the chance you get', () => {
  const plan = planDrill(run, 8, built);
  const stamina = plan.burn;
  const chance = successChance(plan, stamina);
  let wins = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) if (settleDrill(run, 8, built, stamina, (i + 0.5) / N).ok) wins++;
  assert.ok(Math.abs(wins / N - chance) < 0.01);
});

test('every finished drill pays 25-30% of the real session, whatever is stacked on it', () => {
  for (const d of Object.values(DISCIPLINES)) {
    for (const classId of [null, ...Object.keys(CLASSES)]) {
      for (const cleared of [false, true]) {
        for (const fuelled of [false, true]) {
          const a = { ...built, classId, cleared, fuelled };
          const bp = payShareBp(d, a);
          assert.ok(bp >= 2500 && bp <= 3000, `${d.id} ${classId} ${bp}`);
          for (let l = 1; l <= OPEN_LEVELS; l++) {
            const r = settleDrill(d, l, a, 1e6, 0.5);
            const real = realSessionXp(d, l);
            assert.ok(r.ok);
            assert.ok(r.xp >= real * 0.25 - 0.5 && r.xp <= real * 0.3 + 0.5, `${d.id} L${l} ${r.xp} of ${real}`);
          }
        }
      }
    }
  }
});

test('a real session always out-earns its drill by more than three to one', () => {
  for (const d of Object.values(DISCIPLINES)) {
    for (let l = 2; l <= OPEN_LEVELS; l++) {
      const r = settleDrill(d, l, { ...built, classId: 'titan', cleared: true, fuelled: true }, 1e6, 0);
      assert.ok(realSessionXp(d, l) > r.xp * 3);
    }
  }
});

test('replaying a cleared level is safer, cheaper, and pays more per stamina', () => {
  for (const d of Object.values(DISCIPLINES)) {
    const first = { ...built, classId: null };
    const again = { ...first, cleared: true };
    const a = planDrill(d, 6, first);
    const b = planDrill(d, 6, again);
    assert.ok(b.burn < a.burn);
    assert.ok(b.burnHigh - b.burnLow < a.burnHigh - a.burnLow);
    const perStamina = (x, p) => settleDrill(d, 6, x, 1e6, 0.5).xp / p.burn;
    assert.ok(perStamina(again, b) > perStamina(first, a) * 1.15);
    assert.deepEqual(completionBonus(6, 'replay'), { crate: false, carbs: 28, maxStamina: 0 });
  }
});

test('a built athlete earns more per stamina near the top than on level 1', () => {
  const perStamina = (d, l, a) => settleDrill(d, l, a, 1e6, 0.5).xp / planDrill(d, l, a).burn;
  for (const d of Object.values(DISCIPLINES)) {
    const a = { ...built, classId: d.cardio ? 'pacer' : 'titan' };
    assert.ok(perStamina(d, 7, a) > perStamina(d, 1, a), d.id);
  }
});

test('gear does two jobs: less drain, and more from real-world crates', () => {
  assert.deepEqual(gearBuffs(1600), { drainBp: 2400, crateBp: 1600 });
  assert.deepEqual(gearBuffs(99999), { drainBp: 2400, crateBp: 1600 });
  assert.deepEqual(gearBuffs(0), { drainBp: 0, crateBp: 0 });
});

test('classes pull in the directions they should', () => {
  const at = (classId, d) => burnFactor(d, { ...newcomer, classId });
  for (const d of [run, bike, swim]) {
    assert.ok(at('pacer', d) < at('functional', d));
    assert.ok(at('titan', d) > 1);
  }
  assert.ok(at('titan', lift) < at('functional', lift));
  assert.ok(at('pacer', lift) > 1);
  assert.ok(drillMinutes(run, 5, 'triathlete') < drillMinutes(run, 5));
});

test('a set pays for two pieces and more for all three', () => {
  assert.deepEqual(setBonus({ top: 'aero', bottom: 'iron', shoes: 'titan' }), { drainBp: 0, crateBp: 0 });
  assert.deepEqual(setBonus({ top: 'aero', bottom: 'aero', shoes: 'titan' }), { drainBp: 300, crateBp: 0 });
  assert.deepEqual(setBonus({ top: 'aero', bottom: 'aero', shoes: 'aero' }), { drainBp: 600, crateBp: 500 });
  const plain = burnFactor(run, built);
  assert.ok(Math.abs(burnFactor(run, { ...built, setDrainBp: 600 }) - plain * 0.94) < 1e-9);
});

test('the first class is free; after that it costs coins and carbs', () => {
  assert.deepEqual(classSwitchCost(null, 'pacer'), { coins: 0, carbs: 0 });
  assert.deepEqual(classSwitchCost('pacer', 'pacer'), { coins: 0, carbs: 0 });
  assert.deepEqual(classSwitchCost('pacer', 'titan'), { coins: 400, carbs: 150 });
});

test('one mechanic means one job at a time; a second is a row in the table', () => {
  assert.equal(workerCount([]), 1);
  assert.equal(workerCount(['cross-four-weeks']), 2);
  const a = assignJob([], [], NOW, { id: 'a', kind: 'machine', target: 'treadmill', minutes: 60 });
  assert.ok(a.ok);
  assert.equal(assignJob([a.job], [], NOW + 60000, { id: 'b', kind: 'floor', target: 'run', minutes: 60 }).reason, 'busy');
  assert.equal(assignJob([a.job], ['cross-four-weeks'], NOW + 60000, { id: 'b', kind: 'floor', target: 'run', minutes: 60 }).job.worker, 1);
  assert.deepEqual(freeWorkers([a.job], [], NOW + 61 * 60000), [0]);
  assert.equal(wageFor(900), 90);
});
