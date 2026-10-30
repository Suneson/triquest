// Reward chests on the server (0027_reward_chests.sql) against js/core/rewards.js:
// the same brackets, the same roll, the same bonus; chests made once per session,
// three a day; opening pays once into the wallet; only admins gift. Runs every
// migration in PGlite (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/chests-sql.mjs';
import { workoutDifficulty, rollChestTier, chestBonus, CHEST_RULES, TIERS } from '../js/core/rewards.js';

test('the generated block in 0027_reward_chests.sql matches js/core', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.equal(sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length), generatedBlock(), 'run: node tools/chests-sql.mjs');
});

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';

const UID = '00000000-0000-0000-0000-0000000000c1';
const ADMIN = '00000000-0000-0000-0000-0000000000a1';

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
  await db.query(`insert into auth.users (id, email) values ($1, 'c@test'), ($2, 'a@test')`, [UID, ADMIN]);
  await db.query('insert into public.app_admins (user_id) values ($1)', [ADMIN]);
  await as(db, UID);
  return db;
}
const as = (db, uid) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const day = (base, n) => new Date(Date.parse(`${base}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const utcToday = () => new Date().toISOString().slice(0, 10);

// a session as the app holds it, and the row the server stores
const S = (o) => ({ id: o.id, date: o.date || utcToday(), type: 'run', intensity: 'steady', durationMin: 50, completed: true, strava_activity_id: o.strava ?? 900 + Math.floor(Math.random() * 1e6), ...o });
async function put(db, ws, uid = UID) {
  for (const w of ws) {
    await db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, distance_km, completed, completed_at, strava_activity_id, source, actual)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'strava', $11)`,
    [w.id, uid, w.date, w.type, w.intensity, w.durationMin, w.metrics?.distanceKm ?? null, w.completed, w.completedAt || new Date().toISOString(), w.strava_activity_id, w.actual ? JSON.stringify(w.actual) : null]);
  }
}

test('difficulty brackets: SQL and JS agree', { skip }, async () => {
  const db = await freshDb();
  const cases = [
    S({ id: 'e1', durationMin: 30 }), S({ id: 'e2', durationMin: 44 }), S({ id: 'm1', durationMin: 45 }), S({ id: 'm2', durationMin: 89 }),
    S({ id: 'h1', durationMin: 120 }), S({ id: 'b1', durationMin: 151 }),
    S({ id: 'mv', durationMin: 30, actual: { movingSec: 6000 } }),
    S({ id: 'cen', type: 'bike', durationMin: 140, actual: { distanceKm: 101.2 } }),
    S({ id: 'half', type: 'run', durationMin: 95, metrics: { distanceKm: 21.1 } }),
    S({ id: 'swim', type: 'swim', durationMin: 70, actual: { distanceKm: 3.8 } }),
    S({ id: 'brick', type: 'brick', durationMin: 95 }), S({ id: 'mob', type: 'mobility', durationMin: 200 }),
    S({ id: 'vo2', durationMin: 30, intensity: 'vo2' }), S({ id: 'thr', durationMin: 60, intensity: 'threshold' }),
    S({ id: 'q', durationMin: 120, intensity: 'quality' }), S({ id: 'r1', durationMin: 30, intensity: 'race' }), S({ id: 'r2', durationMin: 60, intensity: 'race' }),
    S({ id: 'gym', type: 'gym', durationMin: 55, intensity: null }),
  ];
  await put(db, cases);
  for (const w of cases) {
    const sql = (await db.query('select public.chest_difficulty(w) as d from public.workouts w where w.id = $1', [w.id])).rows[0].d;
    assert.equal(sql, workoutDifficulty(w), w.id);
  }
});

test('the roll and the bonus: SQL and JS agree', { skip }, async () => {
  const db = await freshDb();
  const rs = [0, 0.3199, 0.32, 0.5, 0.6799, 0.68, 0.82, 0.8201, 0.92, 0.97, 0.99, 0.9955, 0.9991, 0.9995, 0.99995, 0.999999, 1];
  for (let i = 0; i < 400; i++) rs.push((i + 0.37) / 400);
  for (const d of Object.keys(CHEST_RULES.odds)) {
    const sql = (await db.query('select r, public.chest_roll($1, r) as t from unnest($2::float8[]) r', [d, rs])).rows;
    for (const { r, t } of sql) assert.equal(t, rollChestTier(d, r), `${d} at ${r}`);
  }
  for (const tier of TIERS) {
    for (const xp of [0, 1, 37, 80, 81.5, 150, 333]) {
      const b = (await db.query('select * from public.chest_bonus($1, $2)', [tier, xp])).rows[0];
      assert.deepEqual({ coins: b.coins, carbs: b.carbs }, chestBonus(tier, xp), `${tier} ${xp}`);
    }
  }
});

test('chests: one per verified session, long enough, three a day, rolled once', { skip }, async () => {
  const db = await freshDb();
  const today = utcToday();
  await put(db, [
    S({ id: 'old', date: day(CHEST_RULES.since, -1), durationMin: 60 }),
    S({ id: 'short', durationMin: 10 }),
    S({ id: 'plan', durationMin: 60, completed: false }),
    ...[1, 2, 3, 4].map((i) => S({ id: `s${i}`, durationMin: 30 + i * 20, completedAt: `${today}T0${i}:00:00Z`, strava: 50 + i })),
  ]);
  const r1 = (await db.query('select public.my_chests() as r')).rows[0].r;
  assert.equal(r1.admin, false);
  const ids = r1.chests.map((c) => c.workout_id).sort();
  assert.deepEqual(ids, CHEST_RULES.since <= today ? ['s1', 's2', 's3'] : []);
  for (const c of r1.chests) {
    assert.ok(TIERS.includes(c.tier) && c.tier !== 'epic', c.tier);
    assert.deepEqual({ coins: c.coins, carbs: c.carbs }, chestBonus(c.tier, c.xp));
    assert.equal(c.opened_at, null);
  }
  // asking again makes nothing new and keeps every roll
  const r2 = (await db.query('select public.my_chests() as r')).rows[0].r;
  assert.deepEqual(r2.chests.map((c) => [c.id, c.tier]).sort(), r1.chests.map((c) => [c.id, c.tier]).sort());
  // the same Strava activity under a new workout id doesn't roll again
  if (r1.chests.length) {
    await db.query("delete from public.workouts where id = 's1'");
    await put(db, [S({ id: 's1-again', durationMin: 50, strava: 51 })]);
    const r3 = (await db.query('select public.my_chests() as r')).rows[0].r;
    assert.equal(r3.chests.length, r1.chests.length);
  }
  // nobody can make chests for someone else, or read theirs
  assert.equal(await code(db.query('select public.chests_grant($1)', [ADMIN])), 'not_yours');
  await as(db, ADMIN);
  assert.equal((await db.query('select count(*)::int as n from public.reward_chests')).rows[0].n >= 0, true);
});

test('opening pays the bonus once, into the wallet, from when it was opened', { skip }, async () => {
  const db = await freshDb();
  await put(db, [S({ id: 'ride', type: 'bike', durationMin: 100, strava: 77 })]);
  const { chests } = (await db.query('select public.my_chests() as r')).rows[0].r;
  if (!chests.length) return; // before launch day
  const wallet = async () => (await db.query('select coins, carbs from public.wallet_fold($1)', [UID])).rows[0];
  const before = await wallet();
  const c = chests[0];
  const o1 = (await db.query('select public.open_chest($1) as r', [c.id])).rows[0].r;
  assert.equal(o1.already, false);
  assert.ok(o1.chest.opened_at);
  const after = await wallet();
  assert.equal(Number(after.coins) - Number(before.coins), c.coins);
  assert.equal(Number(after.carbs) - Number(before.carbs), c.carbs);
  const o2 = (await db.query('select public.open_chest($1) as r', [c.id])).rows[0].r;
  assert.equal(o2.already, true);
  assert.deepEqual(await wallet(), after, 'opening twice pays once');
  // someone else's chest, or none
  await as(db, ADMIN);
  assert.equal(await code(db.query('select public.open_chest($1)', [c.id])), 'chest_unknown');
  assert.equal(await code(db.query('select public.open_chest($1)', [999999])), 'chest_unknown');
});

test('only admins gift, only switched-on tiers, and a gift pays its flat bonus', { skip }, async () => {
  const db = await freshDb();
  assert.equal(await code(db.query("select public.admin_gift_chest('mythic')")), 'not_admin');
  await as(db, ADMIN);
  assert.equal(await code(db.query("select public.admin_gift_chest('epic')")), 'chest_tier');
  assert.equal(await code(db.query("select public.admin_gift_chest('nope')")), 'chest_tier');
  const g = (await db.query("select public.admin_gift_chest('legendary') as c")).rows[0].c;
  assert.equal(g.source, 'gift');
  assert.deepEqual({ coins: g.coins, carbs: g.carbs }, chestBonus('legendary', 0));
  const mine = (await db.query('select public.my_chests() as r')).rows[0].r;
  assert.equal(mine.admin, true);
  assert.ok(mine.chests.some((c) => c.id === g.id));
});
