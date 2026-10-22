import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG, KITS, FUELS, GEAR_RULES, GEAR_SINCE, SLOTS, QUEST_REWARDS, gearById, ownedTier, nextTier, catalogRows, tierId,
} from '../js/core/gear.js';
import { coinsEarned, coinDays, coinsForDay, coinsForSession, balance, gelsHeld, walletFold, earnedBySession, fuelHeld } from '../js/core/wallet.js';
import {
  gearBoost, activeGel, canUseGel, canUseFuel, sessionSpan, gelShare, boostStamp, applyBoost, boostFor, boostedSportXp,
} from '../js/core/boosts.js';
import { computeStats } from '../js/core/scoring.js';

const H = 3600e3;
const T0 = Date.parse('2026-11-10T08:00:00Z');
const iso = (msOff) => new Date(T0 + msOff).toISOString();
const ride = (over = {}) => ({
  id: over.id || 'r1', date: '2026-11-10', type: 'bike', intensity: 'steady', durationMin: 60, completed: true,
  strava_activity_id: 1, metrics: { distanceKm: 25 }, actual: { startUtc: iso(0), elapsedSec: 3600 }, ...over,
});
const own = (id, atOff) => ({ item_id: id, acquired_at: iso(atOff) });
const gel = (startOff, hours = GEAR_RULES.gel.hours) => ({
  kind: 'gel', started_at: iso(startOff), expires_at: iso(startOff + hours * H), multiplier: 1 + GEAR_RULES.gel.boostBp / 10000,
});

// ---- catalog ---------------------------------------------------------------

test('the catalog: four disciplines, four slots each, a free starter and three tiers to buy', () => {
  assert.equal(CATALOG.length, 4 * 4 * 4);
  for (const [sport, slots] of Object.entries(SLOTS)) {
    assert.equal(slots.length, 4);
    for (const slot of slots) {
      const tiers = [0, 1, 2, 3].map((n) => gearById(tierId(sport, slot, n)));
      assert.deepEqual(tiers.map((e) => e.cost), GEAR_RULES.tierCost);
      assert.ok(tiers.every((e) => e.name && !e.name.startsWith('gear.')), `${sport}-${slot} has names`);
      assert.match(tiers[2].art, /^icons\/Pixelart\/GEAR\/[a-z]+-[a-z]+-t2\.png$/);
    }
  }
  // a full kit is exactly the cap, so the last purchase still counts
  assert.equal(4 * GEAR_RULES.tierBoostBp[3], GEAR_RULES.sportCapBp);
  const rows = catalogRows();
  assert.equal(rows.length, CATALOG.length + KITS.length + FUELS.length);
  assert.ok(rows.every((r) => (r.kind === 'gear' || r.kind === 'kit') === (r.currency === 'coins')), 'coins buy gear and clothes, carbs buy fuel');
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
});

test('owned tier and the next purchase', () => {
  const inv = [own('bike-wheels-t1', 0), own('bike-wheels-t2', H)];
  assert.equal(ownedTier(inv, 'bike', 'wheels'), 2);
  assert.equal(ownedTier(inv, 'bike', 'wheels', iso(H / 2)), 1);
  assert.equal(ownedTier(inv, 'bike', 'wheels', iso(-1)), 0);
  assert.equal(nextTier(inv, 'bike', 'wheels').id, 'bike-wheels-t3');
  assert.equal(nextTier(inv, 'bike', 'frame').id, 'bike-frame-t1');
  assert.equal(nextTier([...inv, own('bike-wheels-t3', 2 * H)], 'bike', 'wheels'), null);
});

// ---- wallet ----------------------------------------------------------------

test('coins: half the day’s base XP, capped per day, from launch, plus the starter purse', () => {
  assert.equal(coinsEarned([]), GEAR_RULES.starterPurse);
  const r = ride(); // 114 XP → 57 coins
  assert.equal(coinsEarned([r]), GEAR_RULES.starterPurse + 57);
  // before launch earns nothing
  assert.equal(coinsEarned([ride({ date: '2026-10-01' })]), GEAR_RULES.starterPurse);
  assert.ok('2026-10-01' < GEAR_SINCE);
  // a monster day hits the cap
  const big = ride({ id: 'big', durationMin: 180, metrics: { distanceKm: 75 }, intensity: 'easy' }); // 322 XP
  assert.equal(coinDays([big])[0].coins, GEAR_RULES.dailyCoinCap);
  assert.equal(coinDays([big])[0].capped, true);
  assert.equal(coinsForDay(1000), GEAR_RULES.dailyCoinCap);
  // two sessions on one day share the cap; what each added is reported
  const r2 = ride({ id: 'r2', type: 'run', metrics: { distanceKm: 12 } });
  const day = coinDays([r, r2])[0];
  assert.equal(day.coins, Math.min(120, Math.floor(day.xp / 2)));
  assert.equal(coinsForSession(r2, [r, r2]) + coinsForSession(r, [r]), day.coins);
});

test('coins come only from sessions that earn XP', () => {
  const noProof = ride({ strava_activity_id: null });
  assert.equal(coinsEarned([noProof]), GEAR_RULES.starterPurse);
  const planned = ride({ completed: false });
  assert.equal(coinsEarned([planned]), GEAR_RULES.starterPurse);
});

test('balance is earned − spent, can go negative; gels held = bought − used', () => {
  assert.equal(balance(500, [{ coins: 100 }, { coins: 350 }]), 50);
  assert.equal(balance(300, [{ coins: 350 }]), -50);
  const spends = [{ item_id: 'gel', coins: 60 }, { item_id: 'gel', coins: 60 }, { item_id: 'bike-wheels-t1', coins: 100 }];
  assert.equal(gelsHeld(spends, [gel(0)]), 1);
});

// ---- boosts ----------------------------------------------------------------

test('gear boost per discipline: tiers add up and the cap holds', () => {
  assert.equal(gearBoost([], 'bike'), 0);
  const inv = [own('bike-wheels-t1', 0), own('bike-wheels-t2', 0), own('bike-frame-t1', 0)];
  assert.equal(gearBoost(inv, 'bike'), 200 + 100);
  assert.equal(gearBoost(inv, 'run'), 0);
  const full = SLOTS.bike.flatMap((slot) => [1, 2, 3].map((n) => own(tierId('bike', slot, n), 0)));
  assert.equal(gearBoost(full, 'bike'), GEAR_RULES.sportCapBp);
  // a brick averages bike and run, rounded down; mobility gets nothing
  assert.equal(gearBoost([own('bike-wheels-t1', 0), own('run-shoes-t1', 0), own('run-shoes-t2', 0)], 'brick'), Math.floor((100 + 200) / 2));
  assert.equal(gearBoost(full, 'mobility'), 0);
});

test('a session completed before an item was bought is not boosted by it', () => {
  const r = ride(); // 08:00–09:00
  const inv = [own('bike-wheels-t1', -H), own('bike-frame-t1', 2 * H)];
  assert.deepEqual(boostStamp(r, inv, []), { gear_bp: 100, gel_bp: 0 });
});

test('the gel: inside, straddling the end, after, and stacking with gear', () => {
  const r = ride(); // 08:00–09:00
  assert.equal(activeGel([gel(-H)], iso(0)).kind, 'gel');
  assert.equal(activeGel([gel(-5 * H)], iso(0)), null);
  assert.equal(boostStamp(r, [], [gel(-H)]).gel_bp, 3000);            // wholly inside
  assert.equal(boostStamp(r, [], [gel(-3.5 * H)]).gel_bp, 1500);      // window ends at 08:30: half the ride
  assert.equal(boostStamp(r, [], [gel(-5 * H)]).gel_bp, 0);           // window over before the ride
  assert.equal(boostStamp(r, [], [gel(0.5 * H)]).gel_bp, 1500);       // gel taken half way through
  // two back-to-back gels never give more than one gel's worth
  assert.equal(boostStamp(r, [], [gel(-3.5 * H), gel(0.5 * H)]).gel_bp, 3000);
  const b = boostFor(r, [own('bike-wheels-t1', -H)], [gel(-H)]);
  assert.equal(b.base, 114);
  assert.equal(b.total, Math.round(114 * 1.01 * 1.3));
  assert.equal(b.base + b.gear + b.gel, b.total);
});

test('a server stamp wins over the local guess', () => {
  const r = ride({ boost: { gear_bp: 400, gel_bp: 0 } });
  assert.deepEqual(boostStamp(r, [], [gel(-H)]), { gear_bp: 400, gel_bp: 0 });
});

test('gel rules: one active, two in any seven days, and you need one to use one', () => {
  assert.deepEqual(canUseGel([gel(-H)], 2, T0), { ok: false, reason: 'active' });
  assert.deepEqual(canUseGel([gel(-48 * H), gel(-24 * H)], 2, T0), { ok: false, reason: 'limit' });
  assert.deepEqual(canUseGel([gel(-8 * 24 * H), gel(-24 * H)], 2, T0), { ok: true });
  assert.deepEqual(canUseGel([], 0, T0), { ok: false, reason: 'none' });
});

test('session span: Strava UTC start, gym ticks, or back from completedAt', () => {
  assert.deepEqual(sessionSpan(ride()), [T0, T0 + H]);
  const gym = {
    type: 'gym', date: '2026-11-10', durationMin: 60, completed: true, gymLoggedAt: iso(H),
    exercises: [{ sets: [{ done: true, doneAt: iso(0) }, { done: true, kind: 'warmup', doneAt: iso(-H) }, { done: true, doneAt: iso(H / 2) }] }],
  };
  assert.deepEqual(sessionSpan(gym), [T0, T0 + H / 2]);
  assert.deepEqual(sessionSpan({ durationMin: 30, completedAt: iso(H) }), [T0 + H / 2, T0 + H]);
  assert.equal(gelShare(gel(0), [T0 + H, T0 + H]), 3000); // a point inside the window
});

test('applyBoost splits the number honestly', () => {
  assert.deepEqual(applyBoost(240, { gear_bp: 1600, gel_bp: 3000 }), { base: 240, gear: 38, gel: 84, total: 362 });
  assert.deepEqual(applyBoost(0, { gear_bp: 1600, gel_bp: 3000 }), { base: 0, gear: 0, gel: 0, total: 0 });
});

test('boosted sport XP is for your own levels; base totals are untouched', () => {
  const r = ride();
  const inv = [own('bike-wheels-t3', -H)];
  assert.equal(boostedSportXp([r], inv, []).bike, Math.round(114 * 1.04));
  assert.equal(computeStats([r]).totalXp, 114); // the base the leaderboard sees
});

// ---- carbs, missions, storage, fuel ------------------------------------------

test('carbs come with coins: grams from the day’s base XP, capped per day', () => {
  const r = ride(); // 114 XP → 57 coins, 91 g
  assert.deepEqual(earnedBySession(r, [r]), { coins: 57, carbs: Math.floor(114 * GEAR_RULES.carbsPerXp) });
  const big = ride({ id: 'big', durationMin: 400, metrics: { distanceKm: 160 } });
  assert.equal(coinDays([big])[0].carbs, GEAR_RULES.dailyCarbCap);
});

test('missions pay coins or carbs, from launch on', () => {
  const f = walletFold({ quests: [{ day: '2026-11-10', quest_id: 'brick' }, { day: '2026-11-10', quest_id: 'min-45' }, { day: '2026-10-01', quest_id: 'brick' }] });
  assert.equal(f.coins, GEAR_RULES.starterPurse + QUEST_REWARDS.brick.coins);
  assert.equal(f.carbs, GEAR_RULES.starterCarbs + QUEST_REWARDS['min-45'].carbs);
});

test('storage: each currency holds at most the cap; a full store loses what comes in, a spend makes room', () => {
  const days = Array.from({ length: 100 }, (_, i) => ride({ id: `d${i}`, date: new Date(Date.parse('2026-11-03') + i * 864e5).toISOString().slice(0, 10), durationMin: 300, metrics: { distanceKm: 150 } }));
  const full = walletFold({ workouts: days });
  assert.equal(full.coins, GEAR_RULES.storageCap);
  assert.equal(full.earned.coins - full.lost.coins, GEAR_RULES.storageCap);
  assert.ok(full.lost.coins > 0);
  // spending in the middle makes room, so less is lost
  const mid = walletFold({ workouts: days, spends: [{ item_id: 'bike-frame-t1', coins: 850, currency: 'coins', created_at: '2027-01-20T12:00:00Z' }] });
  assert.equal(mid.coins, GEAR_RULES.storageCap);
  assert.equal(mid.lost.coins, full.lost.coins - 850);
  // a spend after the last earning stays spent
  const late = walletFold({ workouts: days, spends: [{ item_id: 'gel', coins: 120, currency: 'carbs', created_at: '2027-12-01T00:00:00Z' }] });
  assert.equal(late.carbs, GEAR_RULES.storageCap - 120);
});

test('fuel: one runs at a time, each kind has its own weekly limit', () => {
  const pasta = { kind: 'pasta', started_at: iso(-30 * H), expires_at: iso(-18 * H), multiplier: 1.1 };
  assert.deepEqual(canUseFuel('pasta', [pasta], 1, T0), { ok: false, reason: 'limit' });
  assert.deepEqual(canUseFuel('gel', [pasta], 1, T0), { ok: true });
  const bar = { kind: 'energy-bar', started_at: iso(-H), expires_at: iso(5 * H), multiplier: 1.15 };
  assert.deepEqual(canUseFuel('gel', [bar], 1, T0), { ok: false, reason: 'active' });
  assert.equal(boostStamp(ride(), [], [bar]).gel_bp, 1500);
  assert.equal(fuelHeld([{ item_id: 'pasta' }, { item_id: 'pasta' }], [pasta], 'pasta'), 1);
});
