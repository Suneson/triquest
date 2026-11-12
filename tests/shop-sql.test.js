// The markets on the server (0035_shop.sql) against js/core/shop.js: the same rules, the same
// sales, and the training bonuses. Runs every migration in PGlite (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SHOP_RULES, SHOP_ITEMS, shopItem, itemBuy, itemSell, marketSales, periodOf, soldIn, specialty, trafficFor,
  weekMinutes, demandAt, brickDay, restockCost, settleSlot, shopNext, buildCostFor, cratesLeft,
} from '../js/core/shop.js';
import { walletFold } from '../js/core/wallet.js';

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';
const UID = '00000000-0000-0000-0000-0000000000f2';

let base = null;
async function freshDb(purse = 20000) {
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
  base ??= readdirSync(dir).filter((x) => x.endsWith('.sql')).sort().map((f) => readFileSync(dir + f, 'utf8'));
  for (const sql of base) await db.exec(sql);
  await db.query(`insert into auth.users (id, email) values ($1, 's@test')`, [UID]);
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  if (purse) {
    const ch = (await db.query(`insert into public.challenges (creator, kind, sport, starts_on, ends_on, visibility, state)
      values ($1, 'xp', 'any', current_date - 10, current_date - 4, 'room', 'settled') returning id`, [UID])).rows[0].id;
    await db.query(`insert into public.coin_moves (user_id, challenge_id, kind, coins) values ($1, $2, 'payout', $3)`, [UID, ch, purse]);
  }
  // a rebuilt market plot
  await db.query(`insert into public.user_island (user_id, piece, cost, started_at, finishes_at) values ($1, 'market', 0, now() - interval '3 hours', now() - interval '1 hour')`, [UID]);
  return db;
}
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const coins = async (db) => Number((await db.query('select coins from public.wallet_fold($1)', [UID])).rows[0].coins);
const q = (db, sql, args = []) => db.query(sql, args);
const ago = (db, min) => q(db, `update public.user_shop_slots set since = now() - make_interval(mins => $1) where user_id = $2`, [min, UID]);

test('the rules: SQL and JS agree', { skip }, async () => {
  const db = await freshDb(0);
  const r = (await q(db, 'select public.shop_rules() as r')).rows[0].r;
  const { items, ...rest } = r;
  assert.deepEqual(rest, SHOP_RULES);
  assert.deepEqual(items, Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i.tier])));
});

test('build, buy stock, stock a slot, sell, collect: the server pays what shop.js says', { skip }, async () => {
  const db = await freshDb();
  const c0 = await coins(db);
  assert.equal(await code(q(db, 'select public.build_shop(7)')), 'unknown_spot');
  await q(db, 'select public.build_shop(2)');
  assert.equal(await coins(db), c0 - buildCostFor(0));
  assert.equal(await code(q(db, 'select public.build_shop(2)')), 'owned');
  await q(db, 'select public.build_shop(5)');
  assert.equal(await coins(db), c0 - buildCostFor(0) - buildCostFor(1), 'the second costs more');

  const c1 = await coins(db);
  await q(db, `select public.buy_shop_stock('run-socks', 25)`);
  assert.equal(await coins(db), c1 - 25 * itemBuy('run-socks'));
  assert.equal(await code(q(db, `select public.buy_shop_stock('run-socks', 990)`)), 'too_many');
  assert.equal(await code(q(db, `select public.shop_stock_slot(2, 2, 'run-socks')`)), 'locked', 'level 1 has one slot');
  assert.equal(await code(q(db, `select public.shop_stock_slot(2, 1, 'run-cap')`)), 'locked', 'a tier 2 item needs level 2');
  const put = (await q(db, `select public.shop_stock_slot(2, 1, 'run-socks') as r`)).rows[0].r;
  assert.equal(put.put, 10, 'level 1 holds 10');
  assert.equal(Number((await q(db, `select units from public.user_shop_stock where item = 'run-socks'`)).rows[0].units), 15);

  // 25 minutes on: socks sell one every 6 minutes, 4 sold
  await ago(db, 25);
  const c2 = await coins(db);
  const slot = { slot: 1, item: 'run-socks', units: 10, since: new Date(Date.now() - 25 * 60e3).toISOString() };
  const want = marketSales(1, [slot], Date.now());
  assert.equal(want.coins, 4 * itemSell('run-socks'));
  const got = (await q(db, 'select public.collect_shop(2) as r')).rows[0].r;
  assert.equal(got.coins, want.coins);
  assert.equal(await coins(db), c2 + want.coins);
  const row = (await q(db, `select units, extract(epoch from now() - since) as s from public.user_shop_slots where spot = 2`)).rows[0];
  assert.equal(Number(row.units), 6);
  assert.ok(Math.abs(Number(row.s) - 60) < 2, 'the clock keeps the minute it was part way through');
});

test('restock all: from the storeroom first, the rest bought', { skip }, async () => {
  const db = await freshDb();
  await q(db, 'select public.build_shop(1)');
  await q(db, `select public.buy_shop_stock('gym-rope', 12)`);
  await q(db, `select public.shop_stock_slot(1, 1, 'gym-rope')`);
  await ago(db, 31);                                   // 5 sold
  await q(db, 'select public.collect_shop(1)');
  const want = restockCost(1, [{ slot: 1, item: 'gym-rope', units: 5 }], { 'gym-rope': 2 });
  assert.deepEqual(want, { coins: 3 * itemBuy('gym-rope'), units: 5 });
  const c = await coins(db);
  const r = (await q(db, 'select public.restock_shop(1) as r')).rows[0].r;
  assert.equal(r.coins, want.coins);
  assert.equal(await coins(db), c - want.coins);
  assert.equal(Number((await q(db, 'select units from public.user_shop_slots')).rows[0].units), 10);
});

test('swapping an item puts the old one back in the storeroom', { skip }, async () => {
  const db = await freshDb();
  await q(db, 'select public.build_shop(1)');
  await q(db, `select public.buy_shop_stock('swim-cap', 10)`);
  await q(db, `select public.buy_shop_stock('swim-goggles', 4)`);
  await q(db, `select public.shop_stock_slot(1, 1, 'swim-cap')`);
  await q(db, `select public.shop_stock_slot(1, 1, 'swim-goggles')`);
  const stock = Object.fromEntries((await q(db, 'select item, units from public.user_shop_stock')).rows.map((r) => [r.item, Number(r.units)]));
  assert.deepEqual(stock, { 'swim-cap': 10, 'swim-goggles': 0 });
  await q(db, 'select public.shop_clear_slot(1, 1)');
  assert.equal(Number((await q(db, `select units from public.user_shop_stock where item = 'swim-goggles'`)).rows[0].units), 4);
});

test('upgrades: a slot and more room a level, to level 8', { skip }, async () => {
  const db = await freshDb(9000);
  await q(db, 'select public.build_shop(1)');
  const ch = (await q(db, 'select id from public.challenges limit 1')).rows[0].id;
  for (let l = 2; l <= 8; l++) {
    await q(db, `insert into public.coin_moves (user_id, challenge_id, kind, coins) values ($1, $2, 'payout', 5000)`, [UID, ch]);
    const c = await coins(db);
    await q(db, 'select public.upgrade_shop(1)');
    assert.equal(await coins(db), c - shopNext(l - 1).cost);
  }
  assert.equal(await code(q(db, 'select public.upgrade_shop(1)')), 'top_level');
});

test('training: demand, traffic and the brick-day VIP', { skip }, async () => {
  const db = await freshDb();
  await q(db, 'select public.build_shop(1)');
  await q(db, `select public.buy_shop_stock('bike-bottle', 10)`);
  await q(db, `select public.shop_stock_slot(1, 1, 'bike-bottle')`);
  const today = new Date().toISOString().slice(0, 10);
  // a 90-minute ride an hour ago: bike gear in demand, and the week is "busy"
  await q(db, `insert into public.workouts (id, user_id, date, type, duration_min, completed, completed_at) values ('w1', $1, $2, 'bike', 90, true, now() - interval '1 hour')`, [UID, today]);
  const w = [{ date: today, type: 'bike', duration_min: 90, completed: true, completed_at: new Date(Date.now() - 3600e3).toISOString() }];
  const f = trafficFor(weekMinutes(w, Date.now())).f;
  assert.equal(f, 0.9);
  assert.equal(Number((await q(db, 'select public.shop_traffic($1) as f', [UID])).rows[0].f), f);
  assert.deepEqual([...demandAt(w, Date.now())], ['bike']);
  await ago(db, 30);
  const want = marketSales(1, [{ slot: 1, item: 'bike-bottle', units: 10, since: new Date(Date.now() - 30 * 60e3).toISOString() }], Date.now(), { f, demand: demandAt(w, Date.now()) });
  assert.equal(want.sold[0].units, Math.floor(30 / (6 * 0.9)));
  assert.equal((await q(db, 'select public.collect_shop(1) as r')).rows[0].r.coins, want.coins);

  assert.equal(await code(q(db, 'select public.shop_vip()')), 'no_brick');
  await q(db, `insert into public.workouts (id, user_id, date, type, duration_min, completed, completed_at) values ('w2', $1, $2, 'run', 20, true, now())`, [UID, today]);
  assert.ok(brickDay([...w, { date: today, type: 'run' }], today));
  const left = Number((await q(db, 'select units from public.user_shop_slots')).rows[0].units);
  const c = await coins(db);
  const vip = (await q(db, 'select public.shop_vip() as r')).rows[0].r;
  assert.equal(vip.coins, Math.floor(left * itemSell('bike-bottle') * SHOP_RULES.vip));
  assert.equal(await coins(db), c + vip.coins);
  assert.equal(await code(q(db, 'select public.shop_vip()')), 'owned', 'once a day');
});

test('a crate for each reward chest opened fills the slots free', { skip }, async () => {
  const db = await freshDb();
  await q(db, 'select public.build_shop(1)');
  await q(db, `select public.buy_shop_stock('run-socks', 3)`);
  await q(db, `select public.shop_stock_slot(1, 1, 'run-socks')`);
  assert.equal(await code(q(db, 'select public.use_shop_crate(1)')), 'no_crate');
  await q(db, `insert into public.reward_chests (user_id, source, day, tier, coins, carbs, opened_at) values ($1, 'gift', current_date, 'common', 0, 0, now())`, [UID]);
  const c = await coins(db);
  await q(db, 'select public.use_shop_crate(1)');
  assert.equal(await coins(db), c, 'free');
  assert.equal(Number((await q(db, 'select units from public.user_shop_slots')).rows[0].units), 10);
  assert.equal(await code(q(db, 'select public.use_shop_crate(1)')), 'no_crate');
});

// ---- shop.js alone ------------------------------------------------------------------------------

test('sixty items, fifteen a sport, two a tier and one at the top', () => {
  assert.equal(SHOP_ITEMS.length, 60);
  for (const s of ['gym', 'bike', 'run', 'swim']) {
    const t = SHOP_ITEMS.filter((i) => i.sport === s).map((i) => i.tier);
    assert.deepEqual(t, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8]);
  }
  assert.equal(shopItem('swim-gold-goggles').tier, 8);
  // always a profit, and a better margin higher up
  SHOP_RULES.sell.forEach((s, i) => assert.ok(s > SHOP_RULES.buy[i]));
});

test('selling: one unit a period, faster with traffic, and the clock carries over', () => {
  const t0 = Date.parse('2026-11-12T10:00:00Z');
  const slot = { slot: 1, item: 'run-socks', units: 10, since: new Date(t0).toISOString() };
  assert.equal(periodOf('run-socks'), 6 * 60e3);
  assert.equal(soldIn(slot, t0 + 59 * 60e3), 9);
  assert.equal(soldIn(slot, t0 + 5 * 3600e3), 10, 'never more than it holds');
  assert.equal(soldIn(slot, t0 + 30 * 60e3, 0.8), Math.floor(30 / 4.8));
  const s2 = settleSlot(slot, 3);
  assert.equal(s2.units, 7);
  assert.equal(Date.parse(s2.since), t0 + 18 * 60e3);
});

test('a specialty shop: every open slot one sport, two slots or more', () => {
  const s = (item, slot) => ({ slot, item, units: 5, since: new Date().toISOString() });
  assert.ok(!specialty([s('run-socks', 1)], 1), 'one slot is no specialty');
  assert.ok(specialty([s('run-socks', 1), s('run-cap', 2)], 2));
  assert.ok(!specialty([s('run-socks', 1), s('bike-bottle', 2)], 2));
  assert.ok(!specialty([s('run-socks', 1)], 2), 'a slot left empty');
});

test('foot traffic steps at 60, 150 and 300 minutes', () => {
  assert.equal(trafficFor(0).id, 'quiet');
  assert.equal(trafficFor(60).id, 'busy');
  assert.equal(trafficFor(299).id, 'bustling');
  assert.equal(trafficFor(300).id, 'festival');
  assert.equal(trafficFor(300).next, null);
});

test('crates: one per chest opened since the start, less those used', () => {
  const chests = [{ opened_at: '2026-11-13T10:00:00Z' }, { opened_at: '2026-11-01T10:00:00Z' }, { opened_at: null }];
  assert.equal(cratesLeft(chests, []), 1);
  assert.equal(cratesLeft(chests, [{ kind: 'crate' }]), 0);
});

test('the wallet counts the markets\' moves', () => {
  const w0 = walletFold({});
  const w1 = walletFold({ shopMoves: [{ id: 1, at: '2026-11-12T10:00:00Z', coins: -300 }, { id: 2, at: '2026-11-12T11:00:00Z', coins: 40 }] });
  assert.equal(w0.coins - w1.coins, 260);
});
