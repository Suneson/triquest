// The builders' jobs on the server (0039_builder_jobs.sql) against js/core/jobs.js: the same prices, one
// job per builder and per building, paid out of the wallet, levels counted from finished jobs. Runs every
// migration in PGlite (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JOB_RULES, TARGETS, ABILITIES, useAbility } from '../js/core/jobs.js';

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';
const UID = '00000000-0000-0000-0000-0000000000b1';

async function freshDb(purse) {
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
  await db.query(`insert into auth.users (id, email) values ($1, 'x@test')`, [UID]);
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  if (purse) {
    const ch = (await db.query(`insert into public.challenges (creator, kind, sport, starts_on, ends_on, visibility, state)
      values ($1, 'xp', 'any', current_date - 10, current_date - 4, 'room', 'settled') returning id`, [UID])).rows[0].id;
    await db.query(`insert into public.coin_moves (user_id, challenge_id, kind, coins) values ($1, $2, 'payout', $3)`, [UID, ch, purse]);
  }
  return db;
}
const coins = async (db) => Number((await db.query(`select coins from public.wallet_fold($1)`, [UID])).rows[0].coins);
const fails = async (db, sql, code) => {
  await assert.rejects(db.query(sql), (e) => (e.message || '').includes(code), code);
};

const start = (db, target, who) => db.query(`select public.start_builder_job($1, $2)`, [target, who]);
// the locker room (the hall) already at a level, for free: finished jobs at no cost
const hallAt = (db, level) => db.query(`insert into public.builder_jobs (user_id, builder, target, to_level, cost, started_at, finishes_at)
  select $1, 'blue', 'locker', n, 0, now() - interval '3 days', now() - interval '2 days' from generate_series(2, $2::int) n`, [UID, level]);
const finishAll = (db) => db.query(`update public.builder_jobs set started_at = now() - interval '2 days', finishes_at = now() - interval '1 second'`);

test('builder_rules() is JOB_RULES', { skip }, async () => {
  const db = await freshDb();
  assert.deepEqual((await db.query(`select public.builder_rules() as r`)).rows[0].r, JOB_RULES);
});

test('a job: paid when it starts, the level goes up when it finishes', { skip }, async () => {
  const db = await freshDb(20000);
  const before = await coins(db);
  await start(db, 'gel-stand', 'blue');
  const price = TARGETS['gel-stand'].levels[2];
  assert.equal(await coins(db), before - price.coins);
  const row = (await db.query(`select to_level, cost, extract(epoch from finishes_at - started_at) as secs from public.builder_jobs`)).rows[0];
  assert.equal(row.to_level, 2); assert.equal(row.cost, price.coins); assert.equal(Number(row.secs), price.hours * 3600);
  // the building is busy, and so is the builder
  await fails(db, `select public.start_builder_job('gel-stand', 'blue')`, 'gear:busy_target');
  await fails(db, `select public.start_builder_job('coffee-shop', 'blue')`, 'gear:builder_busy');
  await finishAll(db);
  await hallAt(db, 2);
  await start(db, 'gel-stand', 'blue');
  assert.equal((await db.query(`select max(to_level) as n from public.builder_jobs where target = 'gel-stand'`)).rows[0].n, 3);
});

test('only hired builders work, and not past the top', { skip }, async () => {
  const db = await freshDb(200000);
  await fails(db, `select public.start_builder_job('coffee-shop', 'red')`, 'gear:not_hired');
  await fails(db, `select public.start_builder_job('pool', 'blue')`, 'gear:unknown_target');
  await db.query(`select public.buy_builder('builder-red')`);
  await start(db, 'coffee-shop', 'red');
  await start(db, 'gel-stand', 'blue');
  // the locker room first, to its top, so nothing else is capped
  await hallAt(db, TARGETS.locker.levels.length - 1);
  for (let n = 3; n <= TARGETS['gel-stand'].levels.length - 1; n++) { await finishAll(db); await start(db, 'gel-stand', 'blue'); }
  await finishAll(db);
  await fails(db, `select public.start_builder_job('gel-stand', 'blue')`, 'gear:top');
});

test('no coins, no job', { skip }, async () => {
  const db = await freshDb();
  await db.query(`insert into public.builder_jobs (user_id, builder, target, to_level, cost, started_at, finishes_at)
    values ($1, 'blue', 'coffee-shop', 2, 1000000, now() - interval '1 day', now() - interval '1 hour')`, [UID]);
  await fails(db, `select public.start_builder_job('gel-stand', 'blue')`, 'gear:insufficient');
});

test('the locker room caps the others: gear:hall_low', { skip }, async () => {
  const db = await freshDb(200000);
  await start(db, 'gel-stand', 'blue');
  await finishAll(db);
  await fails(db, `select public.start_builder_job('gel-stand', 'blue')`, 'gear:hall_low');
  await start(db, 'locker', 'blue');
  await finishAll(db);
  await start(db, 'gel-stand', 'blue');
  assert.equal((await db.query(`select max(to_level) as n from public.builder_jobs where target = 'gel-stand'`)).rows[0].n, 3);
});

test('ability_rules() is ABILITIES', { skip }, async () => {
  const db = await freshDb();
  const r = (await db.query(`select public.ability_rules() as r`)).rows[0].r;
  const mine = Object.fromEntries(Object.entries(ABILITIES).map(([who, { id, ...a }]) => [who, a]));
  assert.deepEqual(r, mine);
});

test('a builder ability: only on a job, takes the time off, then rests', { skip }, async () => {
  const db = await freshDb(200000);
  await fails(db, `select public.use_builder_ability('blue')`, 'gear:idle');
  await fails(db, `select public.use_builder_ability('red')`, 'gear:not_hired');
  await start(db, 'gel-stand', 'blue');
  const fin = async () => Date.parse((await db.query(`select finishes_at from public.builder_jobs where finishes_at > now()`)).rows[0].finishes_at);
  const before = await fin();
  await db.query(`select public.use_builder_ability('blue')`);
  assert.ok(Math.abs(before - (await fin()) - ABILITIES.blue.cut * 60e3) < 2000);
  await fails(db, `select public.use_builder_ability('blue')`, 'gear:cooldown');
  // the client works it out the same way
  const now = Date.now();
  const job = { builder: 'red', target: 'x', started_at: new Date(now - 1e3).toISOString(), finishes_at: new Date(now + 4 * 3600e3).toISOString() };
  assert.equal(Date.parse(useAbility([job], 'red', now)[0].finishes_at), now + 3 * 3600e3);
});
