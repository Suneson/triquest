// Reward chests (js/core/rewards.js): brackets, odds, the roll, the bonus, who
// gets one, and the wallet paying an opened chest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHEST_RULES, TIERS, workoutDifficulty, chestOdds, rollChestTier, chestBonus, chestSessions, sessionBase, topTier, chestArt,
} from '../js/core/rewards.js';
import { walletFold } from '../js/core/wallet.js';
import { GEAR_RULES } from '../js/core/gear.js';

const w = (o) => ({ id: o.id || 'w', date: '2026-11-02', type: 'run', intensity: 'steady', durationMin: 50, completed: true, strava_activity_id: 7, ...o });

test('difficulty follows what was measured: time, then milestones', () => {
  assert.equal(workoutDifficulty(w({ durationMin: 30 })), 'easy');
  assert.equal(workoutDifficulty(w({ durationMin: 44 })), 'easy');
  assert.equal(workoutDifficulty(w({ durationMin: 45 })), 'moderate');
  assert.equal(workoutDifficulty(w({ durationMin: 89 })), 'moderate');
  assert.equal(workoutDifficulty(w({ durationMin: 120 })), 'hard');
  assert.equal(workoutDifficulty(w({ durationMin: 160 })), 'brutal');
  // Strava's moving time wins over the plan's minutes
  assert.equal(workoutDifficulty(w({ durationMin: 30, actual: { movingSec: 100 * 60 } })), 'hard');
  // milestones: a century, a half marathon, an Ironman swim, a long brick
  assert.equal(workoutDifficulty(w({ type: 'bike', durationMin: 140, actual: { distanceKm: 101 } })), 'brutal');
  assert.equal(workoutDifficulty(w({ type: 'run', durationMin: 95, metrics: { distanceKm: 21.1 } })), 'brutal');
  assert.equal(workoutDifficulty(w({ type: 'swim', durationMin: 70, actual: { distanceKm: 3.8 } })), 'brutal');
  assert.equal(workoutDifficulty(w({ type: 'brick', durationMin: 95 })), 'brutal');
  assert.equal(workoutDifficulty(w({ type: 'mobility', durationMin: 200 })), 'easy');
});

test('the plan label moves a session one bracket at most, and never to brutal', () => {
  assert.equal(workoutDifficulty(w({ durationMin: 30, intensity: 'vo2' })), 'moderate');
  assert.equal(workoutDifficulty(w({ durationMin: 60, intensity: 'threshold' })), 'hard');
  assert.equal(workoutDifficulty(w({ durationMin: 120, intensity: 'quality' })), 'hard');
  assert.equal(workoutDifficulty(w({ durationMin: 30, intensity: 'race' })), 'hard');
  assert.equal(workoutDifficulty(w({ durationMin: 60, intensity: 'race' })), 'brutal');
});

test('odds: each row sums to 100, epic is off and rolls as rare', () => {
  for (const d of Object.keys(CHEST_RULES.odds)) {
    const o = chestOdds(d);
    assert.ok(Math.abs(Object.values(o).reduce((a, b) => a + b, 0) - 100) < 1e-9, d);
    assert.equal('epic' in o, false, `${d}: epic is switched off`);
    const row = CHEST_RULES.odds[d];
    const sum = TIERS.reduce((n, t) => n + row[t], 0);
    assert.ok(Math.abs(o.rare - ((row.rare + row.epic) / sum) * 100) < 1e-9, `${d}: epic's share went to rare`);
    assert.ok(Math.abs(o.legendary - (row.legendary / sum) * 100) < 1e-9, `${d}: legendary keeps its odds`);
  }
  assert.equal(chestOdds('easy').mythic, 0);
});

test('the roll is a pure function of r, and harder brackets roll rarer', () => {
  assert.equal(rollChestTier('easy', 0), 'common');
  assert.equal(rollChestTier('easy', 0.8199), 'common');
  assert.equal(rollChestTier('easy', 0.8201), 'uncommon');
  assert.equal(rollChestTier('brutal', 0.999999), 'mythic');
  assert.equal(rollChestTier('easy', 0.999999), 'legendary', 'easy can never roll mythic');
  for (const r of [0.1, 0.5, 0.77, 0.93]) assert.equal(rollChestTier('hard', r), rollChestTier('hard', r));
  // a seeded sweep: the share of each tier matches its odds
  const n = 200000;
  for (const d of ['easy', 'brutal']) {
    const count = Object.fromEntries(TIERS.map((t) => [t, 0]));
    for (let i = 0; i < n; i++) count[rollChestTier(d, (i + 0.5) / n)]++;
    const o = chestOdds(d);
    for (const t of Object.keys(o)) assert.ok(Math.abs((count[t] / n) * 100 - o[t]) < 0.01, `${d} ${t}`);
    assert.equal(count.epic, 0);
  }
});

test('the bonus: a flat amount plus a share of the session', () => {
  const xp = 80;
  const base = sessionBase(xp);
  assert.deepEqual(base, { coins: Math.floor(80 * GEAR_RULES.coinsPerXp), carbs: Math.floor(80 * GEAR_RULES.carbsPerXp) });
  const b = CHEST_RULES.bonus.rare;
  assert.deepEqual(chestBonus('rare', xp), { coins: b.coins + Math.floor((base.coins * b.pct) / 100), carbs: b.carbs + Math.floor((base.carbs * b.pct) / 100) });
  assert.deepEqual(chestBonus('mythic', 0), { coins: CHEST_RULES.bonus.mythic.coins, carbs: CHEST_RULES.bonus.mythic.carbs });
  // every tier pays more than the one below it
  for (let i = 1; i < TIERS.length; i++) assert.ok(chestBonus(TIERS[i], xp).coins > chestBonus(TIERS[i - 1], xp).coins);
});

test('who gets a chest: verified, long enough, from launch, three a day', () => {
  const ws = [
    w({ id: 'old', date: '2026-10-29', durationMin: 60 }),
    w({ id: 'short', durationMin: 15 }),
    w({ id: 'manual', durationMin: 60, strava_activity_id: null }),
    ...[1, 2, 3, 4].map((i) => w({ id: `s${i}`, durationMin: 30 + i, completedAt: `2026-11-02T0${i}:00:00Z` })),
    w({ id: 'next', date: '2026-11-03', durationMin: 100 }),
  ];
  const got = chestSessions(ws).map((c) => `${c.w.id}:${c.difficulty}`);
  assert.deepEqual(got, ['s1:easy', 's2:easy', 's3:easy', 'next:hard']);
});

test('the wallet pays a chest only once it is opened, from when it was', () => {
  const base = walletFold({});
  const shut = walletFold({ chests: [{ id: 1, coins: 60, carbs: 90, opened_at: null }] });
  assert.deepEqual([shut.coins, shut.carbs], [base.coins, base.carbs]);
  const open = walletFold({ chests: [{ id: 1, coins: 60, carbs: 90, opened_at: '2026-11-02T10:00:00Z' }] });
  assert.deepEqual([open.coins - base.coins, open.carbs - base.carbs], [60, 90]);
  // a chest is an earning like any other: a full store loses what doesn't fit
  const full = walletFold({ chests: [{ id: 1, coins: 20000, carbs: 0, opened_at: '2026-11-02T10:00:00Z' }] });
  assert.equal(full.coins, GEAR_RULES.storageCap);
});

test('art and the top tier', () => {
  assert.deepEqual(chestArt('rare'), { webm: 'icons/AnimatedRewards/WEBM/Rare.webm', mp3: 'icons/AnimatedRewards/mp3/Rare.mp3', still: 'icons/AnimatedRewards/still/Rare.webp' });
  assert.equal(topTier([{ tier: 'common' }, { tier: 'legendary' }, { tier: 'rare' }]), 'legendary');
  assert.equal(topTier([]), 'common');
});
