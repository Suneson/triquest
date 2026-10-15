import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gymVerdict, earnsXp, xpForWorkout, xpLedger, xpStatus, proofOf, GYM, PROOF_BONUS, GYM_RULES_SINCE,
} from '../js/core/xp-rules.js';
import { computeStats, sportProgress } from '../js/core/scoring.js';

const DAY = '2026-10-20';
const T0 = Date.parse(`${DAY}T17:00:00Z`);
// n working sets ticked `gapSec` apart
const sets = (n, gapSec, extra = {}) => Array.from({ length: n }, (_, i) => ({
  kind: 'work', done: true, reps: 8, weight: 60, doneAt: new Date(T0 + i * gapSec * 1000).toISOString(), ...extra,
}));
const gym = (over = {}) => ({
  id: over.id || 'g1', date: DAY, type: 'gym', intensity: 'moderate', durationMin: 60, completed: true,
  gymLoggedAt: new Date(T0 + 3600e3).toISOString(), exercises: [{ sets: sets(12, 180) }], ...over,
});

test('a real gym log counts, for the minutes the log supports', () => {
  const v = gymVerdict(gym());
  assert.equal(v.ok, true);
  // 11 gaps of 3 min = 33 min span, + 20 min slack = 53, under the planned 60
  assert.equal(v.minutes, 33 + GYM.slackMin);
  assert.equal(earnsXp(gym()), true);
  assert.equal(xpForWorkout(gym()), Math.round(53 * 1.0 * 1.15));
});

test('a gym log that does not look like a session is rejected, with the reason', () => {
  assert.equal(gymVerdict(gym({ exercises: [{ sets: sets(2, 180) }] })).reason, 'sets');
  assert.equal(gymVerdict(gym({ exercises: [{ sets: sets(12, 5) }] })).reason, 'tooFast');
  assert.equal(gymVerdict(gym({ exercises: [{ sets: sets(4, 3 * 3600) }] })).reason, 'tooLong');
  assert.equal(gymVerdict(gym({ exercises: [{ sets: sets(5, 100, { doneAt: null }) }] })).reason, 'timestamps');
  // warm-ups don't count toward the sets
  const warm = [...sets(2, 180), ...sets(5, 60, { kind: 'warmup' })];
  assert.equal(gymVerdict(gym({ exercises: [{ sets: warm }] })).reason, 'sets');
  assert.equal(earnsXp(gym({ exercises: [{ sets: sets(12, 5) }] })), false);
  assert.equal(xpStatus(gym({ exercises: [{ sets: sets(12, 5) }] }), []).reason, 'tooFast');
});

test('editing the duration up does not buy XP the log does not show', () => {
  const honest = xpForWorkout(gym());
  assert.equal(xpForWorkout(gym({ durationMin: 240 })), honest);
});

test('gym sessions dated before the rules keep the old rule', () => {
  const old = gym({ date: '2026-10-10', exercises: [] });
  assert.ok(old.date < GYM_RULES_SINCE);
  assert.equal(earnsXp(old), true);
  assert.equal(xpForWorkout(old), Math.round(60 * 1.15));
});

test('Strava proof earns a modest bonus, any sport', () => {
  const run = { id: 'r', date: DAY, type: 'run', intensity: 'easy', durationMin: 60, completed: true, strava_activity_id: 1 };
  assert.equal(proofOf(run), 'strava');
  assert.equal(xpForWorkout(run), Math.round(60 * 1.1 * PROOF_BONUS));
  const noProof = { ...run, strava_activity_id: null };
  assert.equal(earnsXp(noProof), false);
  assert.equal(xpStatus(noProof, []).reason, 'proof');
});

test('app-logged gym XP is capped per day; Strava-verified gym is not', () => {
  const a = gym({ id: 'a', durationMin: 180, gymLoggedAt: `${DAY}T18:00:00Z`, exercises: [{ sets: sets(20, 480) }] });
  const b = gym({ id: 'b', durationMin: 180, gymLoggedAt: `${DAY}T21:00:00Z`, exercises: [{ sets: sets(20, 480) }] });
  const each = xpForWorkout(a);
  assert.ok(each > GYM.dailyCap / 2);
  const ledger = xpLedger([b, a]);
  assert.equal(ledger.reduce((n, r) => n + r.xp, 0), GYM.dailyCap);
  assert.equal(ledger.find((r) => r.w === b).capped, true); // the later one is trimmed
  assert.equal(xpStatus(b, [a, b]).reason, 'cap');
  const stravaGym = { ...b, id: 'c', strava_activity_id: 9 };
  assert.equal(xpLedger([a, stravaGym]).reduce((n, r) => n + r.xp, 0), Math.min(each, GYM.dailyCap) + xpForWorkout(stravaGym));
});

test('Profile totals and sport levels use the same ledger', () => {
  const a = gym({ id: 'a', durationMin: 180, exercises: [{ sets: sets(20, 480) }] });
  const b = gym({ id: 'b', durationMin: 180, gymLoggedAt: `${DAY}T23:00:00Z`, exercises: [{ sets: sets(20, 480) }] });
  assert.equal(computeStats([a, b]).totalXp, GYM.dailyCap);
  assert.equal(sportProgress([a, b], 'gym').totalXp, GYM.dailyCap);
});

test('the gym check-in measures distance, nothing more', async () => {
  const { distanceM } = await import('../js/core/geo.js');
  const a = { lat: 40.4168, lng: -3.7038 };
  assert.ok(Math.abs(distanceM(a, { lat: 40.4195, lng: -3.7038 }) - 300) < 5);
  assert.equal(Math.round(distanceM(a, a)), 0);
});
