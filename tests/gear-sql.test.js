// The GEAR economy on both sides: the SQL in 0014_gear.sql must give the same
// numbers as js/core/wallet.js and boosts.js. Runs every migration in PGlite
// (a dev dependency; the test skips when it isn't installed) and compares
// over a fixture set, plus buying and gel rules end to end.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/gear-sql.mjs';
import { coinsEarned, walletFold } from '../js/core/wallet.js';
import { boostStamp, boostedSportXp } from '../js/core/boosts.js';
import { xpLedger } from '../js/core/xp-rules.js';
import { GEAR_RULES } from '../js/core/gear.js';

test('the generated block in 0014_gear.sql matches js/core/gear.js', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const block = sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length);
  assert.equal(block, generatedBlock(), 'run: node tools/gear-sql.mjs');
});

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }

const UID = '00000000-0000-0000-0000-0000000000a1';
const H = 3600e3;
const NOW = Date.now();
const at = (off) => new Date(NOW + off).toISOString();

async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    create publication supabase_realtime;
  `);
  const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(dir + f, 'utf8'));
  await db.query(`insert into auth.users (id, email) values ($1, 'a@test')`, [UID]);
  return db;
}

// Fixtures: JS workouts, inserted into Postgres as rows.
const sets = (n, gapSec, t0) => Array.from({ length: n }, (_, i) => ({
  kind: 'work', done: true, reps: 8, weight: 60, doneAt: new Date(t0 + i * gapSec * 1000).toISOString(),
}));
const FIX = [
  // a ride wholly inside the gel
  { id: 'a', date: '2026-11-10', type: 'bike', intensity: 'steady', durationMin: 60, completed: true, strava_activity_id: 11,
    metrics: { distanceKm: 25 }, actual: { startUtc: at(-2 * H), elapsedSec: 3600 } },
  // a run straddling the gel's start, same day
  { id: 'b', date: '2026-11-10', type: 'run', intensity: 'threshold', durationMin: 50, completed: true, strava_activity_id: 12,
    metrics: { distanceKm: 11 }, actual: { startUtc: at(-3.5 * H), elapsedSec: 3000 } },
  // a long ride on another day: hits the coin cap; done before the wheels were bought
  { id: 'c', date: '2026-11-11', type: 'bike', intensity: 'easy', durationMin: 180, completed: true, strava_activity_id: 13,
    metrics: { distanceKm: 75 }, actual: { startUtc: at(-30 * H), elapsedSec: 10800 } },
  // two app-logged gym sessions on one day: the second is trimmed by the gym cap
  { id: 'd', date: '2026-11-12', type: 'gym', intensity: 'moderate', durationMin: 180, completed: true,
    completedAt: at(-1 * H), gymLoggedAt: at(-1 * H), exercises: [{ sets: sets(20, 480, NOW - 4 * H) }] },
  { id: 'e', date: '2026-11-12', type: 'gym', intensity: 'moderate', durationMin: 180, completed: true,
    completedAt: at(-0.5 * H), gymLoggedAt: at(-0.5 * H), exercises: [{ sets: sets(20, 480, NOW - 3.9 * H) }] },
  // a brick, a swim, one before launch, one without proof
  { id: 'f', date: '2026-11-13', type: 'brick', intensity: 'moderate', durationMin: 90, completed: true, strava_activity_id: 14,
    metrics: { distanceKm: 40 }, actual: { startUtc: at(-0.25 * H), elapsedSec: 5400 } },
  { id: 'g', date: '2026-11-13', type: 'swim', intensity: 'steady', durationMin: 45, completed: true, strava_activity_id: 15,
    metrics: { distanceKm: 2.2 }, completedAt: at(-6 * H) },
  { id: 'h', date: '2026-10-20', type: 'run', intensity: 'easy', durationMin: 40, completed: true, strava_activity_id: 16,
    metrics: { distanceKm: 8 }, actual: { startUtc: at(-2 * H), elapsedSec: 2400 } },
  { id: 'i', date: '2026-11-13', type: 'run', intensity: 'easy', durationMin: 40, completed: true, metrics: { distanceKm: 8 } },
];
const INV = [
  { item_id: 'bike-wheels-t1', acquired_at: at(-40 * H) },
  { item_id: 'bike-wheels-t2', acquired_at: at(-5 * H) },
  { item_id: 'bike-frame-t1', acquired_at: at(-40 * H) },
  { item_id: 'run-shoes-t1', acquired_at: at(-10 * H) },
  { item_id: 'gym-belt-t1', acquired_at: at(-10 * H) },
];
const BOOSTS = [{ kind: 'gel', started_at: at(-3 * H), expires_at: at(1 * H), multiplier: 1.3 }];

async function seed(db) {
  for (const r of INV) await db.query('insert into public.user_gear (user_id, item_id, acquired_at) values ($1, $2, $3)', [UID, r.item_id, r.acquired_at]);
  for (const b of BOOSTS) {
    await db.query(`insert into public.user_boosts (user_id, kind, started_at, expires_at, multiplier) values ($1, 'gel', $2, $3, $4)`,
      [UID, b.started_at, b.expires_at, b.multiplier]);
  }
  for (const w of FIX) {
    await db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, distance_km, completed,
        completed_at, strava_activity_id, source, actual, exercises, extra)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'plan', $11, $12, $13)`,
    [w.id, UID, w.date, w.type, w.intensity, w.durationMin, w.metrics?.distanceKm ?? null, w.completed,
      w.completedAt ?? null, w.strava_activity_id ?? null, w.actual ?? null, JSON.stringify(w.exercises || []),
      w.gymLoggedAt ? { gymLoggedAt: w.gymLoggedAt } : {}]);
  }
}

test('JS and SQL agree: ledger, stamps, coins and boosted sport XP', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  await seed(db);

  // the per-session ledger (gym cap applied in the same order)
  const sqlLedger = (await db.query('select id, xp::int as xp, boost from public.xp_ledger($1) order by id', [UID])).rows;
  const jsLedger = xpLedger(FIX).map(({ w, xp }) => ({ id: w.id, xp })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(sqlLedger.map(({ id, xp }) => ({ id, xp })), jsLedger);

  // the stamp the trigger wrote equals the client's own reckoning
  for (const r of sqlLedger) {
    const w = FIX.find((x) => x.id === r.id);
    assert.deepEqual(r.boost, boostStamp(w, INV, BOOSTS), `stamp for ${r.id}`);
  }
  // and the fixtures exercise every branch: a gel, a straddle, gear, a capped gym session
  const stamps = Object.fromEntries(sqlLedger.map((r) => [r.id, r.boost]));
  assert.equal(stamps.a.gel_bp, 3000);
  assert.ok(stamps.b.gel_bp > 0 && stamps.b.gel_bp < 3000, 'the run straddles the gel');
  assert.equal(stamps.c.gear_bp, 100 + 100, 'wheels t2 came after the long ride');
  assert.equal(stamps.a.gear_bp, 200 + 100);
  assert.ok(sqlLedger.find((r) => r.id === 'e').xp < sqlLedger.find((r) => r.id === 'd').xp, 'the second gym session is capped');

  // coins
  const earned = Number((await db.query('select public.coins_earned($1) as n', [UID])).rows[0].n);
  assert.equal(earned, coinsEarned(FIX));

  // boosted sport XP for your own levels
  const rows = (await db.query('select type, base::int as base, boosted::int as boosted from public.boosted_sport_xp($1)', [UID])).rows;
  const js = boostedSportXp(FIX, INV, BOOSTS);
  for (const r of rows) assert.equal(r.boosted, js[r.type], `boosted ${r.type}`);

  // Ranks stays on base XP
  const lb = (await db.query('select xp::int as xp from public.leaderboard(null) where user_id = $1', [UID])).rows[0];
  assert.equal(lb.xp, xpLedger(FIX).reduce((n, r) => n + r.xp, 0));
});

test('a client cannot write its own boost, and re-completing does not restamp', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  await seed(db);
  await db.query(`update public.workouts set boost = '{"gear_bp":9999,"gel_bp":9999}', first_earned_at = null where id = 'a'`);
  const a = (await db.query(`select boost from public.workouts where id = 'a'`)).rows[0].boost;
  assert.equal(a.gear_bp, 300);
  await db.query(`update public.workouts set completed = false where id = 'a'`);
  await db.query(`update public.workouts set completed = true where id = 'a'`);
  assert.deepEqual((await db.query(`select boost from public.workouts where id = 'a'`)).rows[0].boost, a);
  // inserting with a forged stamp is ignored too
  await db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, completed, strava_activity_id, boost)
                  values ('z', $1, '2026-11-14', 'swim', 'easy', 30, true, 99, '{"gear_bp":9999,"gel_bp":9999}')`, [UID]);
  const z = (await db.query(`select boost from public.workouts where id = 'z'`)).rows[0].boost;
  assert.ok(z.gear_bp < 9999 && z.gel_bp < 9999);
});

test('buying: tiers in order, each currency checked, errors the client can translate', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  const buy = (id) => db.query('select public.buy_gear($1) as w', [id]).then((r) => r.rows[0].w);
  const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));

  assert.equal(await code(buy('bike-wheels-t2')), 'tier_locked');
  assert.equal(await code(buy('bike-wheels-t0')), 'starter');
  assert.equal(await code(buy('nope')), 'unknown_item');
  const w1 = await buy('bike-wheels-t1');                // coins 300 → 200
  assert.equal(Number(w1.coins), GEAR_RULES.starterPurse - 100);
  assert.equal(Number(w1.carbs), GEAR_RULES.starterCarbs);
  assert.equal(await code(buy('bike-wheels-t1')), 'owned');
  assert.equal(await code(buy('bike-wheels-t2')), 'insufficient');
  const w2 = await buy('gel');                           // carbs 200 → 80
  assert.equal(Number(w2.carbs), GEAR_RULES.starterCarbs - GEAR_RULES.fuel.items.gel.cost);
  assert.equal(Number(w2.coins), GEAR_RULES.starterPurse - 100);
  assert.equal(Number(w2.held.gel), 1);
  assert.equal(await code(buy('gel')), 'insufficient');
  // the rows can't be written directly by a signed-in user
  await db.exec('set role authenticated');
  assert.notEqual(await code(db.query(`insert into public.user_gear (user_id, item_id) values ('${UID}', 'bike-frame-t1')`)), 'ok');
  assert.notEqual(await code(db.query(`insert into public.coin_spends (user_id, item_id, coins) values ('${UID}', 'gel', 0)`)), 'ok');
  await db.exec('reset role');
});

test('fuel: one at a time, a weekly limit per kind, and you need one', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
  const use = (k = 'gel') => db.query(`select public.use_gel($1) as w`, [k]);
  assert.equal(await code(use()), 'fuel_none');
  // stock up past the starter carbs (written as the server would, to skip earning them)
  for (const k of ['gel', 'gel', 'gel', 'pasta']) {
    await db.query(`insert into public.coin_spends (user_id, item_id, coins, currency) values ($1, $2, 0, 'carbs')`, [UID, k]);
  }
  assert.equal(await code(db.query(`select public.buy_gear('gel')`)), 'fuel_full');
  // a gel waits for the next workout: nothing else can be taken meanwhile
  assert.equal(await code(use()), 'ok');
  assert.equal(await code(use('pasta')), 'fuel_active');
  let n = 0;
  const ride = (startOffH) => db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, completed, strava_activity_id, source, actual)
      values ($1, $2, '2026-11-10', 'bike', 'steady', 60, true, $3, 'plan', $4) returning boost`,
    [`r${++n}`, UID, 100 + n, { startUtc: new Date(Date.now() + startOffH * H).toISOString(), elapsedSec: 3600 }]).then((r) => r.rows[0].boost);
  const waiting = async () => Number((await db.query(`select count(*) as c from public.user_boosts where until_next and workout_id is null`)).rows[0].c);
  // an old activity synced late (ended over graceHours before the gel) doesn't use it
  assert.equal((await ride(-30)).gel_bp, 0);
  assert.equal(await waiting(), 1);
  // the next workout gets the whole gel, and the gel is then used up
  assert.equal((await ride(-0.5)).gel_bp, 3000);
  assert.equal(await waiting(), 0);
  assert.equal((await db.query(`select workout_id from public.user_boosts`)).rows[0].workout_id, 'r2');
  assert.equal((await ride(1)).gel_bp, 0, 'only one workout per gel');
  assert.equal(await code(use()), 'ok');
  await ride(0);
  assert.equal(await code(use()), 'fuel_limit');          // two blue gels a week
  assert.equal(await code(use('pasta')), 'ok');           // another kind has its own limit
  const w = (await db.query('select public.wallet() as w')).rows[0].w;
  assert.equal(Number(w.held.gel), 1);
  assert.equal(w.active.kind, 'pasta');
});

test('JS and SQL agree on the storage-capped wallet: training, missions and spends in time order', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  const days = Array.from({ length: 95 }, (_, i) => ({
    id: `w${i}`, date: new Date(Date.parse('2026-11-03') + i * 864e5).toISOString().slice(0, 10), type: 'bike', intensity: 'steady',
    durationMin: 240, completed: true, strava_activity_id: 1000 + i, metrics: { distanceKm: 110 },
  }));
  for (const w of days) {
    await db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, distance_km, completed, strava_activity_id)
      values ($1, $2, $3, 'bike', 'steady', $4, $5, true, $6)`, [w.id, UID, w.date, w.durationMin, w.metrics.distanceKm, w.strava_activity_id]);
  }
  const quests = [{ day: '2026-11-05', quest_id: 'brick' }, { day: '2026-12-01', quest_id: 'min-45' }, { day: '2026-10-20', quest_id: 'km-10' }];
  for (const q of quests) await db.query(`insert into public.quest_completions (user_id, day, quest_id, xp) values ($1, $2, $3, 10)`, [UID, q.day, q.quest_id]);
  const spends = [
    { item_id: 'bike-frame-t1', coins: 100, currency: 'coins', created_at: '2026-11-04T09:30:00.000Z' },
    { item_id: 'gel', coins: 120, currency: 'carbs', created_at: '2027-01-15T18:00:00.000Z' },
    { item_id: 'bike-frame-t2', coins: 350, currency: 'coins', created_at: '2027-02-01T08:00:00.000Z' },
  ];
  for (const s of spends) {
    await db.query(`insert into public.coin_spends (user_id, item_id, coins, currency, created_at) values ($1, $2, $3, $4, $5)`,
      [UID, s.item_id, s.coins, s.currency, s.created_at]);
  }
  const sql = (await db.query('select * from public.wallet_fold($1)', [UID])).rows[0];
  const js = walletFold({ workouts: days, quests, spends });
  assert.deepEqual(
    { coins: Number(sql.coins), carbs: Number(sql.carbs), lostCoins: Number(sql.lost_coins), lostCarbs: Number(sql.lost_carbs), spentCoins: Number(sql.spent_coins) },
    { coins: js.coins, carbs: js.carbs, lostCoins: js.lost.coins, lostCarbs: js.lost.carbs, spentCoins: js.spent.coins });
  assert.ok(js.lost.coins > 0, 'the fixture fills the coin store');
});
