// The island on the server (0033_island.sql) against js/core/island.js: the same rules, charged
// once, built after its two hours, and one stall on a rebuilt market. Runs every migration in
// PGlite (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ISLAND_RULES, pieceState, standOf, startRow } from '../js/core/island.js';
import { walletFold } from '../js/core/wallet.js';

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';
const UID = '00000000-0000-0000-0000-0000000000f1';

async function freshDb(purse = 5000) {
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
  await db.query(`insert into auth.users (id, email) values ($1, 'i@test')`, [UID]);
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  if (purse) {
    const ch = (await db.query(`insert into public.challenges (creator, kind, sport, starts_on, ends_on, visibility, state)
      values ($1, 'xp', 'any', current_date - 10, current_date - 4, 'room', 'settled') returning id`, [UID])).rows[0].id;
    await db.query(`insert into public.coin_moves (user_id, challenge_id, kind, coins) values ($1, $2, 'payout', $3)`, [UID, ch, purse]);
  }
  return db;
}
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const coins = async (db) => Number((await db.query('select coins from public.wallet_fold($1)', [UID])).rows[0].coins);
const build = (db, piece) => db.query('select public.start_island_build($1)', [piece]);
const stand = (db, spot) => db.query('select public.buy_island_stand($1)', [spot]);

test('the rules: SQL and JS agree', { skip }, async () => {
  const db = await freshDb(0);
  assert.deepEqual((await db.query('select public.island_rules() as r')).rows[0].r, ISLAND_RULES);
});

test('a rebuild is charged once and takes its two hours', { skip }, async () => {
  const db = await freshDb();
  const before = await coins(db);
  await build(db, 'club');
  assert.equal(await coins(db), before - ISLAND_RULES.pieces.club);
  assert.equal(await code(build(db, 'club')), 'owned');
  assert.equal(await code(build(db, 'castle')), 'unknown_piece');
  const r = (await db.query('select extract(epoch from finishes_at - started_at) as s from public.user_island where user_id = $1', [UID])).rows[0];
  assert.equal(Number(r.s), ISLAND_RULES.buildHours * 3600);
});

test('a rebuild you cannot afford is refused', { skip }, async () => {
  const db = await freshDb(0);
  await build(db, 'club');
  assert.equal(await code(build(db, 'market')), 'insufficient');
});

test('one stall, only on a finished market, and it can move', { skip }, async () => {
  const db = await freshDb();
  assert.equal(await code(stand(db, 1)), 'not_built');
  await build(db, 'market');
  assert.equal(await code(stand(db, 1)), 'not_built', 'still being rebuilt');
  await db.query(`update public.user_island set finishes_at = now() - interval '1 minute' where user_id = $1`, [UID]);
  const before = await coins(db);
  assert.equal(await code(stand(db, 99)), 'unknown_spot');
  await stand(db, 3);
  assert.equal(await coins(db), before - ISLAND_RULES.standCost);
  assert.equal(await code(stand(db, 4)), 'owned');
  await db.query('select public.move_island_stand(7)');
  assert.equal(Number((await db.query(`select spot from public.user_island where piece = 'stand'`)).rows[0].spot), 7);
});

test('the market slots go up to eight', { skip }, async () => {
  const db = await freshDb();
  await db.query('select public.buy_market(8)');
  assert.equal(await code(db.query('select public.buy_market(9)')), 'unknown_market');
});

test('a piece goes from ruin to built by the clock', () => {
  const t0 = Date.parse('2026-11-09T12:00:00Z');
  assert.equal(pieceState([], 'club', t0).state, 'ruin');
  const rows = [startRow('club', t0)];
  assert.equal(pieceState(rows, 'club', t0 + 60e3).state, 'building');
  assert.ok(Math.abs(pieceState(rows, 'club', t0 + 3600e3).frac - 0.5) < 1e-9);
  assert.equal(pieceState(rows, 'club', t0 + 2 * 3600e3).state, 'built');
  assert.equal(pieceState(rows, 'pool', t0 + 2 * 3600e3).state, 'ruin');
  assert.equal(standOf(rows), null);
});

test('the prices climb: club, pool, market, and the club fits the opening purse', () => {
  const { club, pool, market } = ISLAND_RULES.pieces;
  assert.ok(club < 300 && club < pool && pool < market);
  assert.equal(market, 600);
});

test('the wallet pays for the island when it starts', () => {
  const t0 = Date.parse('2026-11-09T12:00:00Z');
  const w0 = walletFold({});
  const w1 = walletFold({ island: [startRow('club', t0)] });
  assert.equal(w0.coins - w1.coins, ISLAND_RULES.pieces.club);
});
