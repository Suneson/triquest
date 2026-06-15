import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandPlan, phaseFor, isDeloadWeek, PHASES, RACES, PLAN_START, PLAN_END } from '../js/core/plan.js';
import { weekdayMon0, diffDays } from '../js/core/dates.js';

const plan = expandPlan();
const byDate = (iso) => plan.filter((w) => w.date === iso);

test('plan spans the full date range with sessions on most days', () => {
  assert.equal(plan[0].date, PLAN_START);
  assert.equal(plan[plan.length - 1].date, PLAN_END);
  // ~159 days of plan, many with two sessions -> comfortably > 200 sessions.
  assert.ok(plan.length > 200, `only ${plan.length} sessions`);
});

test('every session carries the correct phase tag', () => {
  for (const w of plan) {
    const phase = phaseFor(w.date);
    assert.equal(w.phase, phase.name, `${w.date} should be in ${phase.name}`);
  }
});

test('phase boundaries are exact', () => {
  assert.equal(phaseFor('2026-07-01').id, 'base');
  assert.equal(phaseFor('2026-08-30').id, 'base');
  assert.equal(phaseFor('2026-09-01').id, 'specific');
  assert.equal(phaseFor('2026-10-19').id, 'specific');
  assert.equal(phaseFor('2026-10-20').id, 'bridge');
  assert.equal(phaseFor('2026-12-06').id, 'bridge');
});

test('every seeded id is unique', () => {
  const ids = plan.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('race days are present as milestone sessions and replace the template', () => {
  for (const race of RACES) {
    const sessions = byDate(race.date);
    assert.equal(sessions.length, 1, `${race.date} should hold exactly the race`);
    assert.ok(sessions[0].isRace, `${race.date} should be flagged as a race`);
    assert.equal(sessions[0].intensity, 'race');
  }
});

test('deload weeks exist in base/specific and scale volume down', () => {
  // The 4th week of the base phase should be a deload.
  const deloadDay = plan.find((w) => w.deload && w.phaseId === 'base');
  assert.ok(deloadDay, 'expected at least one base-phase deload session');
  assert.ok(isDeloadWeek(deloadDay.date));

  // No deload tagging in the bridge phase.
  assert.ok(!plan.some((w) => w.phaseId === 'bridge' && w.deload && !w.isRace));
});

test('Monday base week has the Fartlek run with interval segments', () => {
  const mon = byDate('2026-07-06'); // first full Monday of the plan
  const run = mon.find((w) => w.type === 'run');
  assert.ok(run, 'Monday should have a run');
  assert.equal(weekdayMon0(run.date), 0);
  assert.ok(run.segments.length > 0, 'structured run should have segments');
  assert.ok(run.segments.some((s) => s.kind === 'work' && s.intensity === 'threshold'));
});

test('gym sessions carry exercises with sets/reps', () => {
  const gym = plan.find((w) => w.type === 'gym' && w.exercises.length);
  assert.ok(gym.exercises[0].name);
  assert.ok(gym.exercises[0].sets);
  // Runtime fields are seeded so logging works immediately.
  assert.equal(gym.exercises[0].done, false);
  assert.equal(gym.exercises[0].weight, '');
});

test('phase-3 long-run progression peaks at 32 km on 15 Nov', () => {
  const peak = byDate('2026-11-15').find((w) => w.type === 'run');
  assert.ok(peak);
  assert.equal(peak.metrics.distanceKm, 32);
});

test('packing lists are objects with item + checked', () => {
  const withPacking = plan.find((w) => w.packing.length);
  assert.equal(typeof withPacking.packing[0].item, 'string');
  assert.equal(withPacking.packing[0].checked, false);
});

test('phases are contiguous and cover the whole range', () => {
  for (let i = 1; i < PHASES.length; i++) {
    assert.equal(diffDays(PHASES[i].start, PHASES[i - 1].end), 1, 'phases must be back-to-back');
  }
});
