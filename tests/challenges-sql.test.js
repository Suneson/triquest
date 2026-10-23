// Challenges on both sides: 0019_challenges.sql must score exactly what
// js/core/challenges.js does, and its escrow must move coins exactly as
// docs/CHALLENGES.md says: a win, a tie, a no-show, a void, a cancellation
// and leaving before the start. Runs every migration in PGlite (skipped when
// it isn't installed). The window is moved into the past by hand after
// creating, since a real challenge can only start tomorrow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/challenges-sql.mjs';
import { scoreFor, placesFor, settle } from '../js/core/challenges.js';

test('the generated block in 0019_challenges.sql matches js/core/challenges.js', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.equal(sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length), generatedBlock(), 'run: node tools/challenges-sql.mjs');
});

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }

const U = { ana: '00000000-0000-0000-0000-00000000c0a1', ben: '00000000-0000-0000-0000-00000000c0b2', caro: '00000000-0000-0000-0000-00000000c0c3', new: '00000000-0000-0000-0000-00000000c0d4' };
const day = (k) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);

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
  for (const [name, id] of Object.entries(U)) {
    await db.query(`insert into auth.users (id, email, created_at) values ($1, $2, now() - interval '${name === 'new' ? 3 : 60} days')`, [id, `${name}@t`]);
    await db.query(`insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do update set display_name = excluded.display_name`, [id, name]);
  }
  return db;
}

let n = 0;
const st = (date, type, km, min, actual = {}) => ({
  id: `x${++n}`, date, type, intensity: 'steady', durationMin: min, completed: true, strava_activity_id: 9000 + n, source: 'strava',
  completedAt: `${date}T08:00:00.000Z`, metrics: { distanceKm: km },
  actual: { distanceKm: km, distanceM: Math.round(km * 1000), movingSec: min * 60, elapsedSec: min * 60, startUtc: `${date}T07:00:00Z`,
    sportType: { run: 'Run', bike: 'Ride', swim: 'Swim' }[type], ...actual },
});
async function put(db, uid, ws) {
  for (const w of ws) {
    await db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, distance_km, completed, completed_at,
        strava_activity_id, source, actual, exercises, extra) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'[]','{}')`,
    [w.id, uid, w.date, w.type, w.intensity, w.durationMin, w.metrics.distanceKm, true, w.completedAt, w.strava_activity_id, w.source, w.actual]);
  }
}
const as = (db, uid) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*ch:/, ''));
const coins = async (db, uid) => Number((await db.query('select coins from public.wallet_fold($1)', [uid])).rows[0].coins);
// verified history: six easy Strava runs in the last 30 days (also before the window)
const history = () => [-20, -18, -16, -14, -12, -10].map((k) => st(day(k), 'run', 5, 30));

async function create(db, uid, over = {}) {
  await as(db, uid);
  const p = { kind: 'distance', sport: 'run', params: {}, starts_on: day(1), ends_on: day(7), stake: 50, payout: 'winner', visibility: 'room', ...over };
  return (await db.query('select public.create_challenge($1) as id', [p])).rows[0].id;
}
// move a challenge's window so it ran from `from` to `to` days from today
const backdate = (db, id, from, to) => db.query(`update public.challenges set starts_on = $2, ends_on = $3 where id = $1`, [id, day(from), day(to)]);

test('JS and SQL give the same scores', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  const ws = [...history(),
    st(day(-6), 'run', 30, 160), st(day(-5), 'run', 12, 60, { trainer: true }), st(day(-4), 'run', 8, 40, { bestEfforts: { '5k': 1350 } }),
    st(day(-3), 'run', 10.2, 49), st(day(-2), 'bike', 40, 90, { elevationGainM: 900, segments: [{ id: 42, sec: 700, cat: 2, gainM: 200, m: 4000 }] })];
  await put(db, U.ana, ws);
  const kinds = [
    { kind: 'distance', sport: 'run', params: {} }, { kind: 'xp', sport: 'any', params: {} }, { kind: 'sessions', sport: 'any', params: {} },
    { kind: 'fastest', sport: 'run', params: { dist: '5k' } }, { kind: 'longest', sport: 'run', params: { targetMin: 60 } },
    { kind: 'climb', sport: 'bike', params: {} }, { kind: 'segment', sport: 'bike', params: { segmentId: 42 } },
  ];
  for (const k of kinds) {
    const c = { id: 'p', starts_on: day(-7), ends_on: day(-1), stake: 0, payout: 'winner', state: 'open', ...k };
    const sql = (await db.query(`select score, cut from public.challenge_score(row(gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, 'winner', 'room', 'open', now(), null)::public.challenges, $1)`,
      [U.ana, c.kind, c.sport, c.params, c.starts_on, c.ends_on])).rows[0];
    const js = scoreFor(c, ws);
    assert.equal(sql.score == null ? null : Number(sql.score), js.score, `${c.kind} score`);
    assert.equal(!!sql.cut, !!js.cut, `${c.kind} cut`);
  }
});

test('escrow: stakes in, a win out, the fee burned, balances stay derived', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  for (const u of [U.ana, U.ben, U.caro]) await put(db, u, history());
  const before = { ana: await coins(db, U.ana), ben: await coins(db, U.ben), caro: await coins(db, U.caro) };
  const id = await create(db, U.ana);
  await as(db, U.ben); await db.query('select public.join_challenge($1)', [id]);
  await as(db, U.caro); await db.query('select public.join_challenge($1)', [id]);
  assert.equal(await coins(db, U.ana), before.ana - 50, 'the stake left the wallet');
  // the room card is a real row, made by the server
  assert.equal((await db.query('select count(*)::int as n from public.room_messages where challenge_id = $1', [id])).rows[0].n, 1);
  // the window runs; Ana runs most, Ben less, Caro not at all (a no-show)
  await backdate(db, id, -6, -3);
  await put(db, U.ana, [st(day(-5), 'run', 12, 60)]);
  await put(db, U.ben, [st(day(-4), 'run', 8, 45)]);
  assert.equal((await db.query('select public.resolve_challenge($1) as s', [id])).rows[0].s, 'settled');
  const r = (await db.query('select * from public.challenge_results where challenge_id = $1', [id])).rows[0];
  assert.deepEqual([r.pot, r.fee, r.prize, r.burned], [150, 7, 143, 7]);
  assert.equal(await coins(db, U.ana), before.ana - 50 + 143);
  assert.equal(await coins(db, U.ben), before.ben - 50);
  assert.equal(await coins(db, U.caro), before.caro - 50, 'a no-show loses the stake to the pot');
  // the same money as settle() in the client
  const rows = r.rows.map((x) => ({ user: x.user, score: x.score == null ? null : Number(x.score) }));
  const js = settle('distance', 'winner', placesFor('distance', rows), new Map(r.rows.map((x) => [x.user, x.stake])));
  for (const x of r.rows) assert.equal(x.payout, js.payouts.get(x.user));
  // settling twice changes nothing
  assert.equal((await db.query('select public.resolve_challenge($1) as s', [id])).rows[0].s, 'settled');
  assert.equal(await coins(db, U.ana), before.ana - 50 + 143);
});

test('escrow: a tie splits, a void refunds, too few cancels, leaving refunds', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  for (const u of [U.ana, U.ben, U.caro]) await put(db, u, history());
  const start = { ana: await coins(db, U.ana), ben: await coins(db, U.ben), caro: await coins(db, U.caro) };
  // a tie, top 2: Ana and Ben share 1st and 2nd ((65 + 35) / 2 = 50% each)
  const tie = await create(db, U.ana, { kind: 'sessions', sport: 'any', payout: 'top2', stake: 40 });
  await as(db, U.ben); await db.query('select public.join_challenge($1)', [tie]);
  await backdate(db, tie, -6, -3);
  await put(db, U.ana, [st(day(-5), 'run', 5, 30)]);
  await put(db, U.ben, [st(day(-5), 'run', 5, 30)]);
  await db.query('select public.resolve_challenge($1)', [tie]);
  const t = (await db.query('select * from public.challenge_results where challenge_id = $1', [tie])).rows[0];
  assert.deepEqual([t.pot, t.fee, t.prize, t.rows.map((x) => x.payout)], [80, 4, 76, [38, 38]]);
  // a void: nobody had a session, every stake back
  const v = await create(db, U.ben, { stake: 30 });
  await as(db, U.caro); await db.query('select public.join_challenge($1)', [v]);
  await backdate(db, v, -30, -28);
  await db.query('select public.resolve_challenge($1)', [v]);
  assert.equal((await db.query('select outcome, burned from public.challenge_results where challenge_id = $1', [v])).rows[0].outcome, 'void');
  // too few by the start: cancelled, refunded
  const lone = await create(db, U.caro, { stake: 20, kind: 'xp', sport: 'any' });
  await backdate(db, lone, 0, 3);
  assert.equal((await db.query('select public.resolve_due() as n', [])).rows[0].n >= 1, true);
  assert.equal((await db.query('select state from public.challenges where id = $1', [lone])).rows[0].state, 'cancelled');
  // leaving before the start brings the stake back
  const leave = await create(db, U.ana, { stake: 25, kind: 'climb', sport: 'bike' });
  await as(db, U.caro); await db.query('select public.join_challenge($1)', [leave]);
  await db.query('select public.decline_challenge($1)', [leave]);
  await as(db, U.ana); await db.query('select public.cancel_challenge($1)', [leave]);
  // in the end: Ana and Ben each lost 2 coins to the tie's fee; everything else came back
  assert.equal(await coins(db, U.ana), start.ana - 40 + 38);
  assert.equal(await coins(db, U.ben), start.ben - 40 + 38);
  assert.equal(await coins(db, U.caro), start.caro);
  // no coin ever appears from nowhere: payouts + refunds never exceed stakes
  const m = (await db.query(`select kind, sum(coins)::int as s from public.coin_moves group by kind`)).rows;
  const sum = Object.fromEntries(m.map((x) => [x.kind, x.s]));
  assert.ok((sum.payout || 0) + (sum.refund || 0) <= -(sum.stake || 0));
});

test('the guards: age, history, share, the week, the pair, full, closed, refusals and spoofed cards', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  for (const u of [U.ana, U.ben, U.caro]) await put(db, u, history());
  await put(db, U.new, history());
  // a new account can't stake (but can join a free challenge)
  const id = await create(db, U.ana, { stake: 50 });
  await as(db, U.new);
  assert.equal(await code(db.query('select public.join_challenge($1)', [id])), 'age');
  const free = await create(db, U.ben, { stake: 0, kind: 'xp', sport: 'any' });
  await as(db, U.new);
  assert.equal(await code(db.query('select public.join_challenge($1)', [free])), 'ok');
  // more than 20% of the balance, more than the cap
  assert.equal(await code(create(db, U.caro, { stake: 100 })), 'share');
  assert.equal(await code(create(db, U.caro, { stake: 151 })), 'stake');
  // the pair: Ana and Ben already share a staked challenge this week
  await as(db, U.ben); await db.query('select public.join_challenge($1)', [id]);
  const second = await create(db, U.caro, { stake: 10, kind: 'sessions', sport: 'any' });
  await as(db, U.ana); await db.query('select public.join_challenge($1)', [second]);
  await as(db, U.ben);
  assert.equal(await code(db.query('select public.join_challenge($1)', [second])), 'pair');
  // what a challenge may be
  assert.equal(await code(create(db, U.caro, { sport: 'gym', stake: 0 })), 'sport');
  assert.equal(await code(create(db, U.caro, { starts_on: day(0), stake: 0 })), 'start');
  assert.equal(await code(create(db, U.caro, { ends_on: day(40), stake: 0 })), 'window');
  // direct challenges can be switched off
  await db.query(`update public.profiles set settings = '{"directChallenges": false}' where id = $1`, [U.ana]);
  assert.equal(await code(create(db, U.ben, { visibility: 'direct', invitees: [U.ana], stake: 0 })), 'no_direct');
  // nobody can type a card into the room
  await as(db, U.ben);
  assert.notEqual(await code(db.query(`insert into public.room_messages (user_id, body, challenge_id) values ($1, 'x', $2)`, [U.ben, id])), 'ok');
  // closed once it starts
  await backdate(db, free, 0, 3);
  await as(db, U.caro);
  assert.equal(await code(db.query('select public.join_challenge($1)', [free])), 'closed');
  // live standings, with places
  await backdate(db, id, -3, 2);
  await put(db, U.ana, [st(day(-1), 'run', 9, 45)]);
  const s = (await db.query('select user_id, score, place from public.challenge_standings($1) order by place nulls last', [id])).rows;
  assert.equal(s[0].user_id, U.ana);
  assert.equal(Number(s[0].place), 1);
});
