// The markets on the server (0028_markets.sql) against js/core/markets.js: the same rules, bought
// once for their price, making coins by the hour up to what they hold, collected into the wallet
// as far as it has room. Runs every migration in PGlite (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MARKET_RULES, marketStock, marketCollect, marketFullIn, marketIn, isMarketSlot, marketNext, marketUpgrade } from '../js/core/markets.js';

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';

const UID = '00000000-0000-0000-0000-0000000000e1';
const L1 = MARKET_RULES.levels[0];

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
  await db.query(`insert into auth.users (id, email) values ($1, 'm@test')`, [UID]);
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  if (purse) {
    // coins to spend, written as the server would: a challenge payout
    const ch = (await db.query(`insert into public.challenges (creator, kind, sport, starts_on, ends_on, visibility, state)
      values ($1, 'xp', 'any', current_date - 10, current_date - 4, 'room', 'settled') returning id`, [UID])).rows[0].id;
    await db.query(`insert into public.coin_moves (user_id, challenge_id, kind, coins) values ($1, $2, 'payout', $3)`, [UID, ch, purse]);
  }
  return db;
}
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const coins = async (db) => Number((await db.query('select coins from public.wallet_fold($1)', [UID])).rows[0].coins);
const buy = (db, slot) => db.query('select public.buy_market($1) as w', [slot]);
const collect = (db, slot) => db.query('select public.collect_market($1) as r', [slot]).then((r) => r.rows[0].r);
// wind a market's clock back, as if `hours` had gone by since it was last emptied
const ago = (db, slot, hours) => db.query(`update public.user_markets set collected_at = now() - make_interval(secs => $2::numeric * 3600) where user_id = $1 and slot = $3`, [UID, hours, slot]);

test('the rules: SQL and JS agree', { skip }, async () => {
  const db = await freshDb(0);
  const r = (await db.query('select public.market_rules() as r')).rows[0].r;
  assert.deepEqual(r, MARKET_RULES);
});

test('stock: SQL and JS agree hour by hour, up to what it holds', { skip }, async () => {
  const db = await freshDb(0);
  const at = '2026-11-02T12:00:00.000Z';
  for (const h of [0, 0.2, 0.49, 0.5, 0.51, 1, 3.7, 11.99, 12, 12.5, 30, 400]) {
    const now = new Date(Date.parse(at) + h * 3600e3).toISOString();
    const sql = (await db.query('select public.market_stock(1, $1::timestamptz, $2::timestamptz) as s', [at, now])).rows[0].s;
    assert.equal(sql, marketStock({ level: 1, collected_at: at }, Date.parse(now)), `${h} h`);
  }
  assert.equal(marketStock({ level: 1, collected_at: at }, Date.parse(at) + 400 * 3600e3), L1.capacity);
});

test('buying: once a slot, for its price, only with the coins for it', { skip }, async () => {
  const poor = await freshDb(0);
  assert.equal(await code(buy(poor, 1)), 'insufficient');
  const db = await freshDb(1000);
  const before = await coins(db);
  assert.equal(await code(buy(db, 5)), 'unknown_market');
  assert.equal(await code(buy(db, 1)), 'ok');
  assert.equal(await coins(db), before - MARKET_RULES.cost);
  assert.equal(await code(buy(db, 1)), 'owned');
  assert.equal(await code(buy(db, 2)), 'ok');
  // the purse runs out before the third
  assert.equal(await code(buy(db, 3)), before - 2 * MARKET_RULES.cost >= MARKET_RULES.cost ? 'ok' : 'insufficient');
  const rows = (await db.query('select slot, level, cost from public.user_markets order by slot')).rows;
  assert.deepEqual(rows.slice(0, 2), [{ slot: 1, level: 1, cost: MARKET_RULES.cost }, { slot: 2, level: 1, cost: MARKET_RULES.cost }]);
});

test('collecting: what it made goes into the wallet, the clock keeps the part-made coin', { skip }, async () => {
  const db = await freshDb(1000);
  await buy(db, 1);
  assert.equal(await code(collect(db, 2)), 'not_owned');
  assert.equal(await code(collect(db, 1)), 'market_empty');
  await ago(db, 1, 3.25);   // 6.5 coins made: 6 taken, half a coin's time kept
  const before = await coins(db);
  const r = await collect(db, 1);
  assert.equal(r.coins, Math.floor(3.25 * L1.perHour));
  assert.equal(await coins(db), before + r.coins);
  assert.equal(Number(r.wallet.coins), before + r.coins);
  const left = (await db.query(`select extract(epoch from now() - collected_at) as s from public.user_markets where slot = 1`)).rows[0].s;
  assert.ok(Math.abs(left - 0.25 * 3600) < 5, `kept ${left}s`);
  // a full market starts again from now
  await ago(db, 1, 1000);
  assert.equal((await collect(db, 1)).coins, L1.capacity);
  const s2 = (await db.query(`select extract(epoch from now() - collected_at) as s from public.user_markets where slot = 1`)).rows[0].s;
  assert.ok(s2 < 5, `restarted ${s2}s ago`);
  assert.equal(await code(collect(db, 1)), 'market_empty');
});

test('collecting into a full wallet: it takes what fits and keeps the rest', { skip }, async () => {
  const db = await freshDb(1000);
  await buy(db, 1);
  const cap = Number((await db.query(`select (public.gear_rules() ->> 'storageCap')::int as c`)).rows[0].c);
  const room = 5;
  const ch = (await db.query(`select id from public.challenges limit 1`)).rows[0].id;
  await db.query(`insert into public.coin_moves (user_id, challenge_id, kind, coins) values ($1, $2, 'payout', $3)`, [UID, ch, cap - (await coins(db)) - room]);
  assert.equal(await coins(db), cap - room);
  await ago(db, 1, 10);
  const r = await collect(db, 1);
  assert.equal(r.coins, room);
  assert.equal(await coins(db), cap);
  assert.equal(await code(collect(db, 1)), 'wallet_full');
});

test('the JS side: collecting, how long till full, which slot', () => {
  const at = '2026-11-02T12:00:00.000Z';
  const m = { slot: 3, level: 1, collected_at: at };
  const t = Date.parse(at);
  assert.deepEqual(marketCollect(m, t + 3.25 * 3600e3), { coins: 6, collected_at: new Date(t + 3 * 3600e3).toISOString() });
  assert.deepEqual(marketCollect(m, t + 99 * 3600e3), { coins: L1.capacity, collected_at: new Date(t + 99 * 3600e3).toISOString() });
  assert.deepEqual(marketCollect(m, t + 99 * 3600e3, 4), { coins: 4, collected_at: new Date(t + 2 * 3600e3).toISOString() });
  assert.equal(marketFullIn(m, t), (L1.capacity / L1.perHour) * 3600e3);
  assert.equal(marketFullIn(m, t + 99 * 3600e3), 0);
  assert.equal(marketIn([m], 3), m);
  assert.equal(marketIn([m], 2), null);
  assert.ok(isMarketSlot(4) && !isMarketSlot(0) && !isMarketSlot(5));
});

test('upgrading: to level 2 for its price, keeping what was made, making more an hour', { skip }, async () => {
  const L2 = MARKET_RULES.levels[1];
  const db = await freshDb(2000);
  const up = (slot) => db.query('select public.upgrade_market($1) as w', [slot]);
  assert.equal(await code(up(1)), 'not_owned');
  await buy(db, 1);
  await ago(db, 1, 5);                       // 10 coins waiting at level 1
  const before = await coins(db);
  assert.equal(await code(up(1)), 'ok');
  assert.equal(await coins(db), before - L2.cost);
  const row = (await db.query('select level, extract(epoch from now() - collected_at) as s from public.user_markets where slot = 1')).rows[0];
  assert.equal(row.level, 2);
  // still 10 waiting, now at 3 an hour
  assert.equal(Math.floor((row.s / 3600) * L2.perHour + 1e-6), 5 * L1.perHour);
  assert.equal(await code(up(1)), 'market_max');
  // it holds more now
  await ago(db, 1, 1000);
  assert.equal((await collect(db, 1)).coins, L2.capacity);
  // a second market can't be upgraded without the coins
  const poor = await freshDb(MARKET_RULES.cost - 300 + 100);
  await buy(poor, 2);
  assert.equal(await code(poor.query('select public.upgrade_market(2)')), 'insufficient');
});

test('the JS side of upgrading', () => {
  const at = '2026-11-02T12:00:00.000Z'; const t = Date.parse(at);
  const m = { slot: 1, level: 1, collected_at: at };
  assert.equal(marketNext(m).level, 2);
  assert.equal(marketNext({ ...m, level: 2 }), null);
  const u = marketUpgrade(m, t + 5 * 3600e3);
  assert.equal(u.level, 2);
  assert.equal(marketStock({ ...m, ...u }, t + 5 * 3600e3), 10);
});
