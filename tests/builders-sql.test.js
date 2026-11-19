// Hiring builders on the server (0038_builders.sql) against js/core/builders.js: the same prices, each
// hired once, paid out of the wallet, and never sold by buy_gear(). Runs every migration in PGlite
// (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUILDERS, builderId } from '../js/core/builders.js';

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

test('the catalog prices the builders as builders.js does', { skip }, async () => {
  const db = await freshDb(0);
  const rows = (await db.query(`select id, cost from public.gear_catalog where slot = 'builder' order by cost`)).rows;
  assert.deepEqual(rows.map((r) => [r.id, r.cost]), BUILDERS.filter((b) => b.cost > 0).map((b) => [builderId(b.who), b.cost]));
});

test('a builder is hired once, for its price', { skip }, async () => {
  const db = await freshDb(2000);
  const before = await coins(db);
  await db.query(`select public.buy_builder('builder-red')`);
  assert.equal(before - await coins(db), 1500);
  assert.equal((await db.query(`select 1 from public.user_gear where user_id = $1 and item_id = 'builder-red'`, [UID])).rows.length, 1);
  await fails(db, `select public.buy_builder('builder-red')`, 'gear:owned');
  await fails(db, `select public.buy_builder('builder-green')`, 'gear:insufficient');
  await fails(db, `select public.buy_builder('builder-blue')`, 'gear:unknown_item');
  await fails(db, `select public.buy_builder('decor-plant')`, 'gear:unknown_item');
});

test('buy_gear never sells a builder', { skip }, async () => {
  const db = await freshDb(9000);
  const before = await coins(db);
  await fails(db, `select public.buy_gear('builder-gold')`, 'gear:builder_only');
  assert.equal(await coins(db), before);
});
