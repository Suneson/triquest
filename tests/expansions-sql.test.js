// Room expansions on the server (0029_expansions.sql) against js/core/expansions.js: the same
// rules, a ready room bought once for its price, the others coming soon, paid out of the wallet.
// And the 16 × 16 room's fit: it fills its floor's roof inside the railing. Runs every
// migration in PGlite (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXPANSION_RULES, expansionReady, isExpanded, expandedSize, nextExpansion, EXPANDED_ART } from '../js/core/expansions.js';
import { stageGeom, roomPlacement, roomPctToWorld, envFor } from '../js/core/diorama.js';
import { ROOM_GEOMETRY } from '../js/core/placement.js';
import { walletFold } from '../js/core/wallet.js';

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';
const UID = '00000000-0000-0000-0000-0000000000f1';

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
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const coins = async (db) => Number((await db.query('select coins from public.wallet_fold($1)', [UID])).rows[0].coins);
const buy = (db, room, size = 16) => db.query('select public.buy_expansion($1, $2)', [room, size]);

test('the rules: SQL and JS agree', { skip }, async () => {
  const db = await freshDb(0);
  assert.deepEqual((await db.query('select public.expansion_rules() as r')).rows[0].r, EXPANSION_RULES);
});

test('expanding: a ready room once, for its price; the others coming soon', { skip }, async () => {
  const poor = await freshDb(0);
  assert.equal(await code(buy(poor, 'locker')), 'insufficient');
  const db = await freshDb(2000);
  const before = await coins(db);
  assert.equal(await code(buy(db, 'attic')), 'unknown_room');
  assert.equal(await code(buy(db, 'gym')), 'coming_soon');
  assert.equal(await code(buy(db, 'locker')), 'ok');
  assert.equal(await coins(db), before - EXPANSION_RULES.cost);
  assert.equal(await code(buy(db, 'locker')), 'owned');
  const rows = (await db.query('select room, cost from public.user_expansions')).rows;
  assert.deepEqual(rows, [{ room: 'locker', cost: EXPANSION_RULES.cost }]);
});

test('the last step: 32 × 32 after 16 × 16, for its own price', { skip }, async () => {
  const db = await freshDb(8000);
  assert.equal(await code(buy(db, 'locker', 32)), 'needs_16');
  assert.equal(await code(buy(db, 'locker', 24)), 'unknown_size');
  assert.equal(await code(buy(db, 'locker')), 'ok');
  const before = await coins(db);
  assert.equal(await code(buy(db, 'locker', 32)), 'ok');
  assert.equal(await coins(db), before - EXPANSION_RULES.cost32);
  assert.equal(await code(buy(db, 'locker', 32)), 'owned');
});

test('how big a room is, and what comes next', () => {
  const r16 = [{ room: 'locker', size: 16 }]; const r32 = [...r16, { room: 'locker', size: 32 }];
  assert.equal(expandedSize([], 'locker'), 8);
  assert.equal(expandedSize([{ room: 'locker' }], 'locker'), 16, 'a row from before there were sizes');
  assert.equal(expandedSize(r32, 'locker'), 32);
  assert.deepEqual(nextExpansion([], 'locker'), { size: 16, cost: EXPANSION_RULES.cost });
  assert.deepEqual(nextExpansion(r16, 'locker'), { size: 32, cost: EXPANSION_RULES.cost32 });
  assert.equal(nextExpansion(r32, 'locker'), null);
  assert.equal(nextExpansion([], 'pool'), null);
});

test('the JS side: ready rooms, owned rooms, the wallet', () => {
  assert.ok(expansionReady('locker') && !expansionReady('pool'));
  assert.ok(isExpanded([{ room: 'locker' }], 'locker') && !isExpanded([], 'locker'));
  for (const r of EXPANSION_RULES.ready) assert.ok(EXPANDED_ART[r], r);
  const at = new Date().toISOString();
  const base = walletFold({});
  const after = walletFold({ expansions: [{ room: 'locker', cost: EXPANSION_RULES.cost, bought_at: at }] });
  assert.equal(base.coins - after.coins, EXPANSION_RULES.cost);
});

test('the expanded locker fills its roof inside the railing, centred on it, the tape marking what you own', () => {
  const env = envFor('locker');
  const g16 = stageGeom('locker', true); const g8 = stageGeom('locker', false);
  assert.equal(g16, 'locker-16'); assert.equal(g8, 'locker-square');
  assert.equal(stageGeom('locker', 16), 'locker-16'); assert.equal(stageGeom('locker', 32), 'locker-32');
  assert.equal(ROOM_GEOMETRY[g16].cols, 32); assert.equal(ROOM_GEOMETRY[g16].limit, 16);
  assert.equal(ROOM_GEOMETRY['locker-32'].cols, 32); assert.equal(ROOM_GEOMETRY['locker-32'].limit, undefined);
  const width = (g) => roomPctToWorld(g, ROOM_GEOMETRY[g].right[0], 0, env)[0] - roomPctToWorld(g, ROOM_GEOMETRY[g].left[0], 0, env)[0];
  const slab = env.plot.right[0] - env.plot.left[0];
  // the 8 × 8 floor takes half the slab, the big floor most of it
  assert.ok(Math.abs(width(g8) / slab - 0.5) < 1e-9);
  assert.ok(width(g16) / slab > 0.8 && width(g16) / slab < 0.86, `${width(g16) / slab}`);
  // both floors centred on the slab
  const mid = (g) => (roomPctToWorld(g, ROOM_GEOMETRY[g].right[0], 0, env)[0] + roomPctToWorld(g, ROOM_GEOMETRY[g].left[0], 0, env)[0]) / 2;
  assert.ok(Math.abs(mid(g16) - mid(g8)) < 1e-6);
  assert.equal(roomPlacement(g16, env)[1], 0);
});
