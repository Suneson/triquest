// Weekly missions and the daily stall on the server (0025_missions.sql) against
// js/core/missions.js and stall.js: the same boards, the same stall, the same
// measures, paid once into the wallet. Runs every migration in PGlite (skips
// when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/missions-sql.mjs';
import { weeklyMissions, missionBoard, MISSION_RULES, MISSIONS } from '../js/core/missions.js';
import { stallFor, STALL_ITEMS } from '../js/core/stall.js';

test('the generated block in 0025_missions.sql matches js/core', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.equal(sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length), generatedBlock(), 'run: node tools/missions-sql.mjs');
});

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
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  return db;
}
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const day = (base, n) => new Date(Date.parse(`${base}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const utcToday = () => new Date().toISOString().slice(0, 10);
const mondayOf = (d) => { const t = new Date(`${d}T12:00:00Z`); return day(d, -((t.getUTCDay() + 6) % 7)); };

test('week boards and stall days: SQL and JS agree', { skip }, async () => {
  const db = await freshDb();
  for (let k = -1; k < 30; k++) {
    const week = day('2026-10-26', k * 7);
    const sql = (await db.query('select public.week_missions($1::date) as m', [week])).rows[0].m;
    assert.deepEqual(sql, weeklyMissions(week), week);
  }
  for (let k = -2; k < 20; k++) {
    const d = day('2026-10-28', k);
    const sql = (await db.query('select public.stall_item($1::date) as s', [d])).rows[0].s;
    assert.equal(sql, stallFor(d)?.id ?? null, d);
  }
});

async function put(db, ws) {
  for (const w of ws) {
    await db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, distance_km, completed, completed_at, strava_activity_id, source)
      values ($1, $2, $3, $4, 'moderate', $5, $6, $7, now(), $8, 'plan')`,
    [w.id, UID, w.date, w.type, w.durationMin, w.metrics?.distanceKm ?? null, w.completed, w.strava_activity_id ?? null]);
  }
}

test('mission measures: SQL and JS agree over the same week', { skip }, async () => {
  const db = await freshDb();
  // a week that is fully over, so rest days count the same on both sides
  const week = day(mondayOf(utcToday()), -7);
  const ws = [
    { id: 'a', date: week, type: 'bike', durationMin: 95, metrics: { distanceKm: 32.5 }, completed: true, strava_activity_id: 11 },
    { id: 'b', date: day(week, 1), type: 'run', durationMin: 35, metrics: { distanceKm: 7.4 }, completed: true, strava_activity_id: 12 },
    { id: 'c', date: day(week, 1), type: 'swim', durationMin: 50, metrics: { distanceKm: 2.1 }, completed: true, strava_activity_id: 13 },
    { id: 'd', date: day(week, 3), type: 'run', durationMin: 70, metrics: { distanceKm: 12 }, completed: true, strava_activity_id: null }, // no proof
    { id: 'e', date: day(week, 5), type: 'bike', durationMin: 30, metrics: { distanceKm: 10 }, completed: false, strava_activity_id: null }, // planned only
  ];
  await put(db, ws);
  const today = utcToday();
  for (const m of MISSIONS) {
    const sql = (await db.query('select public.mission_value($1, $2::date, $3) as v', [UID, week, m.id])).rows[0].v;
    const d = { start: week };
    const js = (await import('../js/core/missions.js')).weekContext(week, ws, today);
    assert.equal(sql, m.measure(js), `${m.id} on ${d.start}`);
  }
});

test('claim_mission pays once, only when done, only in its window; the wallet adds it', { skip }, async () => {
  const db = await freshDb();
  const thisWeek = mondayOf(utcToday());
  // last week when missions already ran then, else this week
  const week = day(thisWeek, -7) >= MISSION_RULES.since ? day(thisWeek, -7) : thisWeek;
  const wallet = async () => (await db.query('select coins, carbs from public.wallet_fold($1)', [UID])).rows[0];
  const board = weeklyMissions(week);
  const train = board[0];
  // nothing done yet
  assert.equal(await code(db.query('select public.claim_mission($1::date, $2)', [week, train])), 'mission_not_done');
  // three long verified days on two sports finish every training mission
  await put(db, [0, 1, 2].map((i) => ({ id: `t${i}`, date: day(week, i), type: i % 2 ? 'run' : 'bike', durationMin: 100, metrics: { distanceKm: 20 }, completed: true, strava_activity_id: 100 + i })));
  const before = await wallet();
  assert.equal(await code(db.query('select public.claim_mission($1::date, $2)', [week, train])), 'ok');
  const again = (await db.query('select public.claim_mission($1::date, $2) as r', [week, train])).rows[0].r;
  assert.equal(again.already, true);
  const after = await wallet();
  assert.equal(Number(after.coins) - Number(before.coins), MISSION_RULES.reward.coins);
  assert.equal(Number(after.carbs) - Number(before.carbs), MISSION_RULES.reward.carbs);
  // the rest mission pays the same, when its days are there
  const rest = board.at(-1);
  const v = (await db.query('select public.mission_value($1, $2::date, $3) as v', [UID, week, rest])).rows[0].v;
  const target = MISSIONS.find((m) => m.id === rest).target;
  assert.equal(await code(db.query('select public.claim_mission($1::date, $2)', [week, rest])), v >= target ? 'ok' : 'mission_not_done');
  // not on the board, not a Monday, too old, in the future
  const off = MISSIONS.find((m) => !board.includes(m.id)).id;
  assert.equal(await code(db.query('select public.claim_mission($1::date, $2)', [week, off])), 'mission_unknown');
  assert.equal(await code(db.query('select public.claim_mission($1::date, $2)', [day(week, 1), train])), 'mission_week');
  assert.equal(await code(db.query('select public.claim_mission($1::date, $2)', [day(thisWeek, -21), train])), 'mission_week');
  assert.equal(await code(db.query('select public.claim_mission($1::date, $2)', [day(thisWeek, 14), train])), 'mission_week');
  // the JS board agrees it was paid
  const claims = (await db.query("select to_char(week, 'YYYY-MM-DD') as week, mission_id from public.mission_claims")).rows;
  assert.equal(missionBoard(week, [], utcToday(), claims)[0].claimed, true);
});

test('the stall sells only today\'s item, once, for coins; buy_gear refuses decor', { skip }, async () => {
  const db = await freshDb();
  const today = stallFor(utcToday());
  if (!today) return; // before the stall opens
  const other = STALL_ITEMS.find((i) => i.id !== today.id);
  assert.equal(await code(db.query('select public.buy_stall($1)', [other.id])), 'stall_gone');
  assert.equal(await code(db.query('select public.buy_gear($1)', [today.id])), 'stall_only');
  assert.equal(await code(db.query('select public.buy_stall($1)', ['bike-wheels-t1'])), 'unknown_item');
  const w0 = Number((await db.query('select coins from public.wallet_fold($1)', [UID])).rows[0].coins);
  if (w0 >= today.cost) {
    assert.equal(await code(db.query('select public.buy_stall($1)', [today.id])), 'ok');
    assert.equal(await code(db.query('select public.buy_stall($1)', [today.id])), 'owned');
    const w1 = Number((await db.query('select coins from public.wallet_fold($1)', [UID])).rows[0].coins);
    assert.equal(w0 - w1, today.cost);
    assert.equal((await db.query('select count(*)::int as n from public.user_gear where item_id = $1', [today.id])).rows[0].n, 1);
  } else {
    assert.equal(await code(db.query('select public.buy_stall($1)', [today.id])), 'insufficient');
  }
});
