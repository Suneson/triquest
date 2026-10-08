import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pendingClaims, applyResult, readLedger, pruneLedger, classifyError, claimKey, emptyLedger,
} from '../js/core/quest-claims.js';
import { questsFor, QUESTS_SINCE } from '../js/core/quests.js';
import { addDays } from '../js/core/dates.js';

const settings = { packing: { run: ['shoes'] } };
let n = 0;
const verified = (date, o = {}) => ({ id: `c${n++}`, date, type: 'run', intensity: 'easy', durationMin: 50,
  metrics: { distanceKm: 11 }, completed: true, strava_activity_id: 42, source: 'plan', ...o });

const D1 = addDays(QUESTS_SINCE, 2);
const D2 = addDays(QUESTS_SINCE, 3);
const ws = [verified(D1), verified(D2)];

test('pending claims are exactly the done quests, oldest first', () => {
  const claims = pendingClaims(D2, ws, settings, emptyLedger());
  const expected = [D1, D2].flatMap((d) => questsFor(d, ws, settings).filter((q) => q.done).map((q) => `${d}|${q.id}`));
  assert.deepEqual(claims.map((c) => claimKey(c.day, c.quest_id)), expected);
  assert.ok(claims.length > 0);
  for (const c of claims) assert.ok(c.xp > 0);
});

test('claimed and rejected quests are not sent again', () => {
  const all = pendingClaims(D2, ws, settings, emptyLedger());
  let l = applyResult(emptyLedger(), all[0], 'ok');
  if (all[1]) l = applyResult(l, all[1], 'rejected');
  const again = pendingClaims(D2, ws, settings, l).map((c) => claimKey(c.day, c.quest_id));
  assert.ok(!again.includes(claimKey(all[0].day, all[0].quest_id)));
  if (all[1]) assert.ok(!again.includes(claimKey(all[1].day, all[1].quest_id)));
});

test("a 'retry' result leaves the claim pending", () => {
  const [first] = pendingClaims(D2, ws, settings, emptyLedger());
  const l = applyResult(emptyLedger(), first, 'retry');
  assert.deepEqual(l.done, []);
  assert.deepEqual(l.rejected, []);
});

test('after the backfill only recent days are scanned', () => {
  const old = verified(QUESTS_SINCE);
  const today = addDays(QUESTS_SINCE, 20);
  const recent = verified(today);
  const before = pendingClaims(today, [old, recent], settings, emptyLedger());
  assert.ok(before.some((c) => c.day === QUESTS_SINCE));
  const after = pendingClaims(today, [old, recent], settings, { ...emptyLedger(), backfilled: true });
  assert.ok(after.every((c) => c.day > addDays(today, -3)));
});

test('nothing before QUESTS_SINCE is ever claimed', () => {
  const early = verified(addDays(QUESTS_SINCE, -3));
  assert.deepEqual(pendingClaims(addDays(QUESTS_SINCE, -1), [early], settings, emptyLedger()), []);
});

test('ledger reading survives junk from storage', () => {
  assert.deepEqual(readLedger(null), emptyLedger());
  assert.deepEqual(readLedger({ done: 'x', rejected: [1, 'a'], backfilled: 1 }), { done: [], rejected: ['a'], backfilled: true });
});

test('pruning keeps only recent entries once backfilled', () => {
  const today = addDays(QUESTS_SINCE, 30);
  const l = { done: [`${QUESTS_SINCE}|min-45`, `${today}|min-45`], rejected: [], backfilled: true };
  assert.deepEqual(pruneLedger(l, today).done, [`${today}|min-45`]);
  // before the backfill nothing is pruned (it would be re-sent)
  assert.equal(pruneLedger({ ...l, backfilled: false }, today).done.length, 2);
});

test('server errors: 22023 is a refusal, anything else is retried', () => {
  assert.equal(classifyError(null), 'ok');
  assert.equal(classifyError({ code: '22023' }), 'rejected');
  assert.equal(classifyError({ code: 'PGRST202' }), 'retry');
  assert.equal(classifyError({ message: 'Failed to fetch' }), 'retry');
});
