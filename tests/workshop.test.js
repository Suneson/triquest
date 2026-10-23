import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKSHOP_RULES, fitMinutes, bayCount, jobPhase, placeJob, reflow, cancelRefund, withFitted, jobFor, quadrantLevel, quadrantPoints, QUADRANT_STEPS,
} from '../js/core/workshop.js';
import { PROPS, propById, propsFor, SCENES } from '../js/core/scenes.js';
import { fuelHeld } from '../js/core/wallet.js';

const T0 = Date.parse('2026-11-02T10:00:00Z');
const iso = (m) => new Date(T0 + m * 60e3).toISOString();
const job = (id, bay, start, finish, extra = {}) => ({ id, bay, item_id: 'bike-wheels-t1', cost: 100, state: 'queued', started_at: iso(start), finishes_at: iso(finish), ...extra });

test('fitting times: minutes at tier 1, hours at tier 3, props their own; kits and fuel are not fitted', () => {
  assert.equal(fitMinutes('bike-wheels-t1'), 10);
  assert.equal(fitMinutes('bike-wheels-t2'), 60);
  assert.equal(fitMinutes('bike-wheels-t3'), 240);
  assert.equal(fitMinutes('bike-wheels-t0'), null);
  assert.equal(fitMinutes('bike-lights'), 180);
  assert.equal(fitMinutes('kit-moske-navy'), null);
  assert.equal(fitMinutes('gel'), null);
});

test('one bay to start, a second with the feat', () => {
  assert.equal(bayCount([]), 1);
  assert.equal(bayCount(['run-10k']), 1);
  assert.equal(bayCount(['run-10k', WORKSHOP_RULES.bay2Feat]), 2);
});

test('phases follow the server times', () => {
  const j = job(1, 1, 10, 70);
  assert.equal(jobPhase(j, T0), 'waiting');
  assert.equal(jobPhase(j, T0 + 30 * 60e3), 'fitting');
  assert.equal(jobPhase(j, T0 + 70 * 60e3), 'done');
  assert.equal(jobPhase({ ...j, state: 'cancelled' }, T0), 'cancelled');
});

test('a new job waits for its bay; with two bays it takes the one free first', () => {
  const jobs = [job(1, 1, 0, 60)];
  assert.deepEqual(placeJob(jobs, 1, 10, T0 + 5 * 60e3), { bay: 1, startMs: T0 + 60 * 60e3, finishMs: T0 + 70 * 60e3 });
  assert.deepEqual(placeJob(jobs, 2, 10, T0 + 5 * 60e3), { bay: 2, startMs: T0 + 5 * 60e3, finishMs: T0 + 15 * 60e3 });
  // an empty workshop starts now; finished and cancelled jobs hold nothing
  const old = [job(2, 1, -100, -40), job(3, 1, 0, 300, { state: 'cancelled' })];
  assert.equal(placeJob(old, 1, 10, T0).startMs, T0);
});

test('jobs behind a job that leaves early move up, in order, keeping their lengths', () => {
  const now = T0 + 20 * 60e3;
  const jobs = [job(1, 1, 0, 60, { finishes_at: iso(20) }), job(2, 1, 60, 120), job(3, 1, 120, 130), job(4, 2, 0, 500)];
  const out = reflow(jobs, 1, now);
  assert.equal(out[1].started_at, iso(20)); assert.equal(out[1].finishes_at, iso(80));
  assert.equal(out[2].started_at, iso(80)); assert.equal(out[2].finishes_at, iso(90));
  assert.equal(out[3], jobs[3], 'the other bay is untouched');
});

test('cancelling: free before it starts; mid-fit, whole the first time, then half', () => {
  const now = T0 + 30 * 60e3;
  assert.deepEqual(cancelRefund(job(1, 1, 60, 120), [], now), { refund: 100, midfit: false });
  assert.deepEqual(cancelRefund(job(1, 1, 0, 60), [], now), { refund: 100, midfit: true });
  assert.deepEqual(cancelRefund(job(1, 1, 0, 60, { cost: 351 }), [{ state: 'cancelled', midfit: true }], now), { refund: 175, midfit: true });
  assert.deepEqual(cancelRefund(job(1, 1, -60, -10), [], now), { refund: 0, midfit: false }, 'a finished job is yours');
});

test('a finished job counts as owned from its finish time; an unfinished one does not', () => {
  const jobs = [job(1, 1, 0, 10, { item_id: 'bike-rack' }), job(2, 1, 10, 70, { item_id: 'bike-stand' })];
  const inv = withFitted([{ item_id: 'kit-moske-navy', acquired_at: iso(-999) }], jobs, T0 + 30 * 60e3);
  assert.deepEqual(inv.map((r) => r.item_id), ['kit-moske-navy', 'bike-rack']);
  assert.equal(inv[1].acquired_at, iso(10));
  assert.equal(jobFor(jobs, 'bike-stand', T0 + 30 * 60e3).id, 2);
  assert.equal(jobFor(jobs, 'bike-rack', T0 + 30 * 60e3), null);
});

test('a gel used to finish a job is no longer held', () => {
  const spends = [{ item_id: 'gel' }, { item_id: 'gel' }];
  assert.equal(fuelHeld(spends, [], 'gel'), 2);
  assert.equal(fuelHeld(spends, [], 'gel', [{ skipped_with: 'gel' }]), 1);
});

test('quadrant level comes from what you built, not from XP', () => {
  assert.deepEqual(quadrantLevel('bike', []), { level: 1, points: 0, next: QUADRANT_STEPS[1], toNext: 2 });
  const inv = [
    { item_id: 'bike-wheels-t1' }, { item_id: 'bike-wheels-t2' }, { item_id: 'bike-frame-t1' },
    { item_id: 'bike-rack' }, { item_id: 'bike-lights' }, { item_id: 'run-water' },
  ];
  assert.equal(quadrantPoints('bike', inv), 2 + 1 + 2 + 4);
  assert.equal(quadrantLevel('bike', inv).level, 4);
  assert.equal(quadrantPoints('run', inv), 2);
  // everything built in a sport reaches at least level 6
  const all = ['bike'].flatMap((s) => [...['wheels', 'aerobars', 'frame', 'power'].flatMap((sl) => [1, 2, 3].map((t) => ({ item_id: `${s}-${sl}-t${t}` }))),
    ...propsFor(s).map((p) => ({ item_id: p.id }))]);
  assert.ok(quadrantLevel('bike', all).level >= 6);
});

test('props: every sport has some, ids are unique, slots unique per sport, anchors inside the safe area', () => {
  assert.equal(new Set(PROPS.map((p) => p.id)).size, PROPS.length);
  for (const sport of Object.keys(SCENES)) {
    const ps = propsFor(sport);
    assert.ok(ps.length >= 2, sport);
    assert.equal(new Set(ps.map((p) => p.slot)).size, ps.length, `${sport} slots`);
    for (const p of ps) {
      assert.ok(p.anchor.x >= 9 && p.anchor.x + p.anchor.w <= 91, `${p.id} sits within 9% of the sides`);
      assert.ok(p.anchor.y >= 0 && p.anchor.y < 95, p.id);
      assert.ok(['back', 'front'].includes(p.z), p.id);
      assert.ok(p.cost > 0 && p.fitMin > 0 && p.points > 0, p.id);
      assert.equal(propById(p.id), p);
    }
  }
});

test('a prop never covers the trophy board', () => {
  for (const p of PROPS) {
    const b = SCENES[p.sport].board;
    const a = p.anchor;
    const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
    const overlapY = a.y < b.y + b.h && b.y < a.y + a.w; // a prop is about as tall as it is wide, at most
    assert.ok(!(overlapX && overlapY), `${p.id} overlaps the board`);
  }
});
