// Collections, blueprints and prestige on the server (0023_collections.sql)
// against js/core/collections.js: set bonuses in the wallet, fragments and
// building, the prestige gate and its boost. Runs every migration in PGlite
// (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/collections-sql.mjs';
import { collectionAwards, COLLECTION_RULES, PRESTIGE } from '../js/core/collections.js';
import { levelFromTotalXp } from '../js/core/scoring.js';
import { GEAR_RULES } from '../js/core/gear.js';

test('the generated block in 0023_collections.sql matches js/core', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.equal(sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length), generatedBlock(), 'run: node tools/collections-sql.mjs');
});

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';

const UID = '00000000-0000-0000-0000-0000000000c1';

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
  await db.query(`insert into auth.users (id, email) values ($1, 'c@test')`, [UID]);
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  return db;
}
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const coins = async (db) => Number((await db.query('select coins from public.wallet_fold($1)', [UID])).rows[0].coins);
const own = (db, id, at) => db.query('insert into public.user_gear (user_id, item_id, acquired_at) values ($1, $2, $3)', [UID, id, at]);
const iso = (d) => new Date(d).toISOString();

test('collection awards: SQL and JS agree, and the wallet pays each set once', { skip }, async () => {
  const db = await freshDb();
  const c0 = await coins(db);
  const inv = [
    ...['wheels', 'aerobars', 'frame', 'power'].map((s, i) => ({ item_id: `bike-${s}-t1`, acquired_at: `2026-10-0${i + 1}T08:00:00.000Z` })),
    ...['wheels', 'aerobars', 'frame'].map((s) => ({ item_id: `bike-${s}-t2`, acquired_at: '2026-10-06T08:00:00.000Z' })),
    ...['belt', 'shoes', 'sleeves', 'bar'].map((s) => ({ item_id: `gym-${s}-t1`, acquired_at: '2026-10-03T09:00:00.000Z' })),
  ];
  for (const r of inv) await own(db, r.item_id, r.acquired_at);
  // the last bike tier-2 piece comes out of the workshop: it counts from its finish
  await db.query(`insert into public.workshop_jobs (user_id, item_id, cost, bay, started_at, finishes_at, state)
    values ($1, 'bike-power-t2', 350, 1, '2026-10-07T08:00:00Z', '2026-10-07T09:00:00Z', 'queued')`, [UID]);
  const sql = (await db.query('select sport, tier, at, coins from public.collection_awards($1) order by at, sport, tier', [UID])).rows
    .map((r) => ({ sport: r.sport, tier: r.tier, at: iso(r.at), coins: r.coins }));
  const js = collectionAwards([...inv, { item_id: 'bike-power-t2', acquired_at: '2026-10-07T09:00:00.000Z' }]);
  assert.deepEqual(sql, js);
  assert.deepEqual(js.map((a) => `${a.sport}${a.tier}`), ['gym1', 'bike1', 'bike2']);
  assert.equal(await coins(db), c0 + 40 + 40 + 140);
  // a cancelled job doesn't complete anything
  await db.query(`update public.workshop_jobs set state = 'cancelled'`);
  assert.equal(await coins(db), c0 + 40 + 40);
});

test('blueprints: fragments from missions, building spends them, never twice', { skip }, async () => {
  const db = await freshDb();
  const since = COLLECTION_RULES.fragmentsSince;
  await db.query(`insert into public.quest_completions (user_id, day, quest_id, xp)
    select $1, $2::date + (i / 3), 'q' || i, 10 from generate_series(0, 29) i`, [UID, since]);
  await db.query(`insert into public.quest_completions (user_id, day, quest_id, xp) values ($1, '2026-09-01', 'old', 10)`, [UID]);
  const f = (await db.query('select * from public.blueprint_fragments($1)', [UID])).rows[0];
  assert.deepEqual({ ...f }, { earned: 30, spent: 0, free: 30 });
  assert.equal(await code(db.query(`select public.build_blueprint('bike-rack')`)), 'unknown_item', 'a shop prop is not a blueprint');
  const r = (await db.query(`select public.build_blueprint('run-statue') as r`)).rows[0].r;
  assert.equal(r.free, 6);
  assert.equal(await code(db.query(`select public.build_blueprint('run-statue')`)), 'owned');
  assert.equal(await code(db.query(`select public.build_blueprint('bike-podium')`)), 'fragments_short');
  // and buy_gear can't sell it
  assert.equal(await code(db.query(`select public.buy_gear('bike-podium')`)), 'unknown_item');
});

test('level_from_xp matches levelFromTotalXp', { skip }, async () => {
  const db = await freshDb();
  for (const xp of [0, 99, 100, 403, 404, 5000, 13371, 13372, 13373, 99999]) {
    const lv = (await db.query('select public.level_from_xp($1) as l', [xp])).rows[0].l;
    assert.equal(lv, levelFromTotalXp(xp).level, `xp ${xp}`);
  }
});

test('prestige: refused below the level, a star at it, and the star boosts later sessions only', { skip }, async () => {
  const db = await freshDb();
  // full bike kit, so the gear boost is at its cap
  for (const s of ['wheels', 'aerobars', 'frame', 'power']) await own(db, `bike-${s}-t3`, '2026-10-01T00:00:00Z');
  const ride = (id, date) => db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, completed, completed_at, strava_activity_id, source)
    values ($1, $2, $3, 'bike', 'hard', 180, true, now(), $4, 'plan')`, [id, UID, date, Math.floor(Math.random() * 1e9)]);
  await ride('r0', '2026-10-30');
  assert.equal(await code(db.query(`select public.prestige('bike')`)), 'prestige_level');
  assert.equal(await code(db.query(`select public.prestige('kayak')`)), 'unknown_item');
  for (let i = 1; i < 60; i++) await ride(`r${i}`, `2026-${i < 30 ? '09' : '08'}-${String((i % 28) + 1).padStart(2, '0')}`);
  const xp = Number((await db.query(`select boosted from public.boosted_sport_xp($1) where type = 'bike'`, [UID])).rows[0].boosted);
  assert.ok(levelFromTotalXp(xp).level >= PRESTIGE.level, `enough XP (${xp})`);
  const p = (await db.query(`select public.prestige('bike') as p`)).rows[0].p;
  assert.equal(p.star, 1);
  assert.equal(Number(p.xp_at), xp);
  // straight away again: the level since the reset is 1
  assert.equal(await code(db.query(`select public.prestige('bike')`)), 'prestige_level');
  // the boost: cap + a star from now on, not before
  const bp = async (at) => (await db.query(`select public.gear_bp_sport($1, 'bike', $2) as b`, [UID, at])).rows[0].b;
  assert.equal(await bp(new Date(Date.now() + 60e3).toISOString()), GEAR_RULES.sportCapBp + PRESTIGE.bonusBp);
  assert.equal(await bp('2026-10-02T00:00:00Z'), GEAR_RULES.sportCapBp);
  assert.equal((await db.query(`select public.gear_bp_sport($1, 'run', now() + interval '1 minute') as b`, [UID])).rows[0].b, 0, 'per sport');
});
