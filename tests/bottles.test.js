// The sports bottles (js/core/bottles.js, 0042_bottles.sql): the drop rolls, what you hold, drinking each one,
// and a Chest Charger raising the next workout chest. The SQL half runs every migration in PGlite (skips when it
// isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/bottles-sql.mjs';
import {
  BOTTLE_RULES, BOTTLE_IDS, rollBottles, bottleWeight, bottleOdds, tierUp, bottlesHeld, canDrink, brewedFinish,
} from '../js/core/bottles.js';
import { TIERS, CHEST_RULES } from '../js/core/rewards.js';

const seq = (xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('the generated block in 0042_bottles.sql matches js/core', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.equal(sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length), generatedBlock(), 'run: node tools/bottles-sql.mjs');
});

test('stronger bottles are rarer, and rarer chests lean to them', () => {
  for (const tier of TIERS) {
    const w = BOTTLE_RULES.weights[tier];
    assert.equal(w.length, 4, tier);
  }
  // the weakest bottle's share falls and the strongest's rises with the chest
  const share = (tier, id) => bottleWeight(tier, id) / BOTTLE_IDS.reduce((n, x) => n + bottleWeight(tier, x), 0);
  const order = TIERS.filter((t) => CHEST_RULES.enabled[t]);
  for (let i = 1; i < order.length; i++) {
    assert.ok(share(order[i], 'recovery-mix') < share(order[i - 1], 'recovery-mix'), order[i]);
    assert.ok(share(order[i], 'chest-charge') > share(order[i - 1], 'chest-charge'), order[i]);
    assert.ok(bottleOdds(order[i]).expected > bottleOdds(order[i - 1]).expected, order[i]);
  }
  assert.equal(bottleWeight('common', 'chest-charge'), 0);
  for (const tier of TIERS) assert.equal(bottleWeight(tier, 'vo2-max'), 0, 'VO2 Max does not drop yet');
});

test('rollBottles: slots, then a pick by weight', () => {
  // common: one slot at 12%
  assert.deepEqual(rollBottles('common', seq([0.5])), []);
  assert.deepEqual(rollBottles('common', seq([0.05, 0])), ['recovery-mix']);
  assert.deepEqual(rollBottles('common', seq([0.05, 0.999])), ['build-brew']);
  // mythic: two sure slots and a 50% one; 15/25/32/28 of 100
  assert.deepEqual(rollBottles('mythic', seq([0.9, 0.1, 0.9, 0.2, 0.6])), ['recovery-mix', 'electro-surge']);
  assert.deepEqual(rollBottles('mythic', seq([0, 0.99, 0, 0.5, 0.4, 0.45])), ['chest-charge', 'build-brew', 'build-brew']);
  // the counts over many rolls follow the odds
  let n = 0; for (let i = 0; i < 4000; i++) n += rollBottles('legendary').length;
  assert.ok(Math.abs(n / 4000 - bottleOdds('legendary').expected) < 0.06, String(n / 4000));
});

test('tierUp skips the switched-off tier and stops at mythic', () => {
  assert.equal(tierUp('common'), 'uncommon');
  assert.equal(tierUp('rare'), CHEST_RULES.enabled.epic ? 'epic' : 'legendary');
  assert.equal(tierUp('mythic'), 'mythic');
});

test('held, and whether one can be drunk', () => {
  const held = bottlesHeld([
    { opened_at: 'x', bottles: ['build-brew', 'recovery-mix', 'build-brew'] },
    { opened_at: null, bottles: ['chest-charge'] },
  ], [{ bottle: 'build-brew' }]);
  assert.equal(held['build-brew'], 1);
  assert.equal(held['recovery-mix'], 1);
  assert.equal(held['chest-charge'], 0, 'a shut chest holds its bottles back');
  assert.deepEqual(canDrink('build-brew', { held: 1, jobsRunning: 0 }), { ok: false, reason: 'idle' });
  assert.deepEqual(canDrink('build-brew', { held: 1, jobsRunning: 2 }), { ok: true });
  assert.deepEqual(canDrink('electro-surge', { held: 1, fuelOn: true }), { ok: false, reason: 'fuel' });
  assert.deepEqual(canDrink('chest-charge', { held: 2, active: { 'chest-charge': true } }), { ok: false, reason: 'active' });
  assert.deepEqual(canDrink('recovery-mix', { held: 0 }), { ok: false, reason: 'none' });
  assert.deepEqual(canDrink('vo2-max', { held: 3 }), { ok: false, reason: 'soon' });
});

test('Build Brew: 10x for an hour', () => {
  const H = 3600e3;
  assert.equal(brewedFinish(5 * H, 0), 0.5 * H);   // 5 h left: done in 30 min
  assert.equal(brewedFinish(10 * H, 0), H);         // 10 h: in the hour
  assert.equal(brewedFinish(24 * H, 0), 15 * H);    // 24 h: 9 h off
  assert.equal(brewedFinish(-5, 0), -5);
});

// ---- the server -------------------------------------------------------------------------------------------

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';
const UID = '00000000-0000-0000-0000-0000000000d1';

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
  await db.query(`insert into auth.users (id, email) values ($1, 'd@test')`, [UID]);
  await db.query('insert into public.app_admins (user_id) values ($1)', [UID]);
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  return db;
}
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const one = async (db, sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
/** A chest holding exactly these bottles, opened. */
const give = async (db, bottles) => {
  const c = await one(db, `select public.admin_gift_chest('rare') as c`);
  await db.query('update public.reward_chests set bottles = $1 where id = $2', [bottles, c.id]);
  await db.query('select public.open_chest($1)', [c.id]);
};

test('server: chests roll their bottles by tier', { skip }, async () => {
  const db = await freshDb();
  const rolls = async (tier, n) => (await db.query(`select public.bottle_roll($1) as b from generate_series(1, $2)`, [tier, n])).rows.map((r) => r.b);
  for (const b of await rolls('mythic', 200)) {
    assert.ok(b.length >= 2 && b.length <= 3, String(b));
    assert.ok(!b.includes('vo2-max'));
  }
  for (const b of await rolls('common', 300)) {
    assert.ok(b.length <= 1);
    assert.ok(!b.includes('chest-charge'), 'a common chest never holds the strongest');
  }
  const gift = await one(db, `select public.admin_gift_chest('legendary') as c`);
  assert.ok(gift.bottles.length >= 1, 'a legendary chest always holds one');
  assert.equal(gift.charged, false);
});

test('server: you hold a chest\'s bottles once it is opened, and drink them', { skip }, async () => {
  const db = await freshDb();
  const c = await one(db, `select public.admin_gift_chest('rare') as c`);
  await db.query('update public.reward_chests set bottles = $1 where id = $2', [['recovery-mix', 'recovery-mix'], c.id]);
  let st = await one(db, 'select public.my_chests() as r');
  assert.equal(st.bottles.held['recovery-mix'], 0, 'still shut');
  await db.query('select public.open_chest($1)', [c.id]);
  st = await one(db, 'select public.my_chests() as r');
  assert.equal(st.bottles.held['recovery-mix'], 2);
  st = await one(db, `select public.drink_bottle('recovery-mix') as r`);
  assert.equal(st.held['recovery-mix'], 1);
  await db.query(`select public.drink_bottle('recovery-mix')`);
  assert.equal(await code(db.query(`select public.drink_bottle('recovery-mix')`)), 'bottle_none');
  assert.equal(await code(db.query(`select public.drink_bottle('vo2-max')`)), 'unknown_item');
});

test('server: Electrolyte Surge is a 24 h fuel boost, one fuel at a time', { skip }, async () => {
  const db = await freshDb();
  await give(db, ['electro-surge', 'electro-surge']);
  const st = await one(db, `select public.drink_bottle('electro-surge') as r`);
  assert.ok(st.active['electro-surge']);
  assert.equal(st.fuel_on, true);
  const b = (await db.query(`select multiplier::float8 as m, extract(epoch from expires_at - started_at) / 3600 as h from public.user_boosts where kind = 'electro-surge'`)).rows[0];
  assert.deepEqual([b.m, Math.round(b.h)], [1.5, 24]);
  assert.equal(await code(db.query(`select public.drink_bottle('electro-surge')`)), 'bottle_active');
  // and food can't go on top of it
  assert.equal(await code(db.query(`select public.use_gel('gel')`)), 'fuel_active');
});

test('server: Build Brew runs the builders 10x for an hour', { skip }, async () => {
  const db = await freshDb();
  await give(db, ['build-brew', 'build-brew']);
  assert.equal(await code(db.query(`select public.drink_bottle('build-brew')`)), 'idle', 'no job, no brew');
  await db.query(`insert into public.builder_jobs (user_id, builder, target, to_level, cost, finishes_at) values
    ($1, 'blue', 'gel-stand', 2, 0, now() + interval '5 hours'), ($1, 'red', 'coffee-shop', 2, 0, now() + interval '24 hours')`, [UID]);
  await db.query(`select public.drink_bottle('build-brew')`);
  const left = (await db.query(`select target, round(extract(epoch from finishes_at - now()) / 60) as m from public.builder_jobs order by target`)).rows;
  assert.deepEqual(left.map((r) => [r.target, Number(r.m)]), [['coffee-shop', 900], ['gel-stand', 30]]);
  assert.equal(await code(db.query(`select public.drink_bottle('build-brew')`)), 'bottle_active', 'one brew an hour');
});

test('server: a Chest Charger raises the next workout chest and is used up', { skip }, async () => {
  const db = await freshDb();
  await give(db, ['chest-charge', 'chest-charge']);
  let st = await one(db, `select public.drink_bottle('chest-charge') as r`);
  assert.equal(st.active['chest-charge'], true);
  assert.equal(await code(db.query(`select public.drink_bottle('chest-charge')`)), 'bottle_active');
  await db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, completed, completed_at, strava_activity_id, source)
    values ('w1', $1, current_date, 'run', 'steady', 30, true, now(), 4242, 'strava')`, [UID]);
  const { chests, bottles } = await one(db, 'select public.my_chests() as r');
  const w = chests.find((c) => c.workout_id === 'w1');
  assert.ok(w, 'the workout left a chest');
  assert.equal(w.charged, true);
  assert.notEqual(w.tier, 'common', 'one rarity up from at least common');
  assert.equal(bottles.active['chest-charge'], false, 'the charge is used up');
  st = await one(db, `select public.drink_bottle('chest-charge') as r`);
  assert.equal(st.held['chest-charge'], 0);
});
