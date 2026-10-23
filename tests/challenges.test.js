import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_RULES, KINDS, TEMPLATES, scoreFor, placesFor, settle, phaseOf, settlesOn, checkChallenge, stakeBlock, segmentIdFrom, ruleText,
} from '../js/core/challenges.js';
import { walletFold } from '../js/core/wallet.js';

let n = 0;
const D = (k) => new Date(Date.UTC(2026, 10, 2 + k)).toISOString().slice(0, 10); // D(0) = Mon 2 Nov 2026
const st = (date, type, km, min, actual = {}, over = {}) => ({
  id: over.id || `w${++n}`, date, type, intensity: 'steady', durationMin: min, completed: true, strava_activity_id: 7000 + n, source: 'strava',
  completedAt: `${date}T08:00:00.000Z`, metrics: { distanceKm: km },
  actual: { distanceKm: km, distanceM: Math.round(km * 1000), movingSec: min * 60, elapsedSec: min * 60, startUtc: `${date}T07:00:00Z`,
    sportType: { run: 'Run', bike: 'Ride', swim: 'Swim' }[type], ...actual },
  ...over,
});
const C = (over = {}) => ({ id: 'c1', kind: 'distance', sport: 'run', params: {}, starts_on: D(0), ends_on: D(6), stake: 100, payout: 'winner', state: 'open', ...over });

test('settling: the worked examples in docs/CHALLENGES.md', () => {
  const stakes = (u, v) => new Map(u.map((x) => [x, v]));
  const three = stakes(['ana', 'ben', 'caro'], 100);
  // Ana wins
  let s = settle('distance', 'winner', placesFor('distance', [{ user: 'ana', score: 9 }, { user: 'ben', score: 5 }, { user: 'caro', score: 3 }]), three);
  assert.deepEqual([s.pot, s.fee, s.prize, s.payouts.get('ana'), s.payouts.get('ben'), s.burned], [300, 15, 285, 285, 0, 15]);
  // Ana and Ben tie
  s = settle('distance', 'winner', placesFor('distance', [{ user: 'ana', score: 9 }, { user: 'ben', score: 9 }, { user: 'caro', score: 3 }]), three);
  assert.deepEqual([s.payouts.get('ana'), s.payouts.get('ben'), s.payouts.get('caro'), s.burned], [142, 142, 0, 16]);
  // Caro no-shows
  s = settle('distance', 'winner', placesFor('distance', [{ user: 'ana', score: 9 }, { user: 'ben', score: 5 }, { user: 'caro', score: null }]), three);
  assert.deepEqual([s.payouts.get('ana'), s.payouts.get('caro')], [285, 0]);
  // nobody: void, every stake back, nothing burned
  s = settle('distance', 'winner', placesFor('distance', [{ user: 'ana', score: null }, { user: 'ben', score: null }, { user: 'caro', score: null }]), three);
  assert.deepEqual([s.void, s.payouts.get('ana'), s.payouts.get('ben'), s.burned], [true, 100, 100, 0]);
  // five at 60, top 3
  const five = stakes(['a', 'b', 'c', 'd', 'e'], 60);
  s = settle('distance', 'top3', placesFor('distance', [{ user: 'a', score: 50 }, { user: 'b', score: 40 }, { user: 'c', score: 30 }, { user: 'd', score: 20 }, { user: 'e', score: 10 }]), five);
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map((u) => s.payouts.get(u)), [142, 85, 57, 0, 0]);
  assert.equal(s.burned, 16);
  s = settle('distance', 'top3', placesFor('distance', [{ user: 'a', score: 50 }, { user: 'b', score: 50 }, { user: 'c', score: 30 }, { user: 'd', score: 20 }, { user: 'e', score: 10 }]), five);
  assert.deepEqual(['a', 'b', 'c'].map((u) => s.payouts.get(u)), [114, 114, 57]);
  assert.equal(s.burned, 15);
  s = settle('distance', 'top3', placesFor('distance', [{ user: 'a', score: 50 }, { user: 'b', score: 40 }, { user: 'c', score: null }, { user: 'd', score: null }, { user: 'e', score: null }]), five);
  assert.deepEqual(['a', 'b', 'c'].map((u) => s.payouts.get(u)), [178, 106, 0]);
  assert.equal(s.burned, 16);
  // fastest: lower wins
  const p = placesFor('fastest', [{ user: 'x', score: 1300 }, { user: 'y', score: 1190 }]);
  assert.equal(p.find((r) => r.user === 'y').place, 1);
  // a free challenge: no pot, nobody paid
  s = settle('xp', 'winner', placesFor('xp', [{ user: 'a', score: 5 }]), stakes(['a', 'b'], 0));
  assert.deepEqual([s.pot, s.fee, s.payouts.get('a')], [0, 0, 0]);
});

test('scores: only Strava, outdoors for distance, never on a rest day, inside the window', () => {
  const c = C();
  const ws = [
    st(D(0), 'run', 10, 50),
    st(D(1), 'run', 8, 40, { trainer: true }),                // treadmill: not for distance
    st(D(2), 'run', 8, 40, { manual: true }),                 // typed in: never
    st(D(3), 'run', 8, 40, {}, { strava_activity_id: null, source: 'plan' }), // no proof
    st(D(7), 'run', 8, 40),                                   // after the window
    { ...st(D(4), 'gym', 0, 60), type: 'gym' },               // gym: never
    st(D(5), 'run', 6, 30, {}, { onRestDay: true }),          // planned rest day
  ];
  const r = scoreFor(c, ws);
  assert.equal(r.score, 1000); // 10 km in units of 10 m
  // the treadmill run counts for XP and sessions
  assert.equal(scoreFor(C({ kind: 'sessions' }), ws).score, 2);
  assert.ok(scoreFor(C({ kind: 'xp' }), ws).score > 0);
  // a no-show
  assert.equal(scoreFor(c, []).score, null);
});

test('ceilings: 25 km a day, and 1.3 × your own weekly average (never under the floor)', () => {
  const c = C();
  // a 40 km run counts 25 km; with no history the week ceiling is the 20 km floor
  assert.equal(scoreFor(c, [st(D(0), 'run', 40, 220)]).score, 2000);
  // four weeks before at 40 km a week: ceiling 52 km
  const before = Array.from({ length: 8 }, (_, i) => st(new Date(Date.UTC(2026, 9, 6 + i * 3)).toISOString().slice(0, 10), 'run', 20, 100));
  const r = scoreFor(c, [...before, ...[0, 1, 2, 3].map((d) => st(D(d), 'run', 18, 90))]);
  assert.equal(r.score, 5200);
  assert.equal(r.cut, true);
});

test('fastest, longest, segment', () => {
  const ws = [st(D(0), 'run', 10, 48, { bestEfforts: { '5k': 1250 } }), st(D(2), 'run', 5.2, 26)];
  assert.equal(scoreFor(C({ kind: 'fastest', params: { dist: '5k' } }), ws).score, 1250);
  assert.equal(scoreFor(C({ kind: 'longest', params: { targetMin: 45 } }), ws).score, 2700);
  const bike = [st(D(1), 'bike', 40, 90, { segments: [{ id: 123456, sec: 600, cat: 2, gainM: 300, m: 5000 }] }),
    st(D(3), 'bike', 40, 90, { segments: [{ id: 123456, sec: 580, cat: 2, gainM: 300, m: 5000 }] })];
  const seg = scoreFor(C({ kind: 'segment', sport: 'bike', params: { segmentId: 123456 } }), bike);
  assert.equal(seg.score, 580);
  assert.equal(segmentIdFrom('https://www.strava.com/segments/123456?x=1'), 123456);
});

test('what a challenge may be, and who may stake', () => {
  const today = D(-1);
  assert.equal(checkChallenge(C(), today), null);
  assert.equal(checkChallenge(C({ ends_on: D(28) }), today), 'window');
  assert.equal(checkChallenge(C({ starts_on: today }), today), 'start');
  assert.equal(checkChallenge(C({ stake: 151 }), today), 'stake');
  assert.equal(checkChallenge(C({ sport: 'gym' }), today), 'sport');
  assert.equal(checkChallenge(C({ kind: 'fastest', params: { dist: '7k' } }), today), 'dist');
  assert.equal(checkChallenge(C({ kind: 'longest', params: { targetMin: 400 } }), today), 'target');
  assert.equal(checkChallenge(C({ visibility: 'direct', invitees: [] }), today), 'invitees');
  for (const tpl of TEMPLATES) assert.ok(KINDS[tpl.kind].includes(tpl.sport), tpl.id);
  const me = { accountDays: 30, verified30: 8, balance: 1000, stakedWeek: 0, pairs: new Map() };
  assert.equal(stakeBlock(150, me), null);
  assert.equal(stakeBlock(0, { ...me, accountDays: 1 }), null, 'a free challenge needs none of this');
  assert.equal(stakeBlock(100, { ...me, accountDays: 10 }), 'age');
  assert.equal(stakeBlock(100, { ...me, verified30: 2 }), 'verified');
  assert.equal(stakeBlock(100, { ...me, balance: 180 }), 'share');
  assert.equal(stakeBlock(100, { ...me, stakedWeek: 250 }), 'week');
  assert.equal(stakeBlock(100, { ...me, balance: 50 }), 'balance');
  assert.equal(stakeBlock(100, { ...me, pairs: new Map([['ben', { week: 1, month: 1 }]]) }, ['ben']), 'pair');
  assert.equal(CHALLENGE_RULES.feeBp, 500);
});

test('the life of a challenge, and the wallet', () => {
  const c = C();
  assert.equal(phaseOf(c, D(-1)), 'open');
  assert.equal(phaseOf(c, D(3)), 'running');
  assert.equal(phaseOf(c, D(7)), 'resolving');
  assert.equal(settlesOn(c), D(9));
  assert.equal(phaseOf({ ...c, state: 'settled' }, D(3)), 'settled');
  // a stake leaves the wallet; a payout comes back, through the storage cap
  const w = walletFold({ moves: [{ id: 1, coins: -100, created_at: '2026-11-01T10:00:00Z' }, { id: 2, coins: 285, created_at: '2026-11-10T10:00:00Z' }] });
  assert.equal(w.coins, 300 - 100 + 285);
  assert.ok(ruleText(c, (d) => d).includes('Strava'));
});
