// The workshop on the server (0022_workshop.sql) against js/core/workshop.js:
// placing jobs in bays, the queue moving up, refunds, finishing with a gel,
// owning what's finished, and the boost counting a finished job. Runs every
// migration in PGlite (skips when it isn't installed). Times are moved by
// writing the job rows as the owner, never by trusting a client clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/workshop-sql.mjs';
import { WORKSHOP_RULES, placeJob, cancelRefund } from '../js/core/workshop.js';
import { GEAR_RULES } from '../js/core/gear.js';

test('the generated block in 0022_workshop.sql matches js/core', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.equal(sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length), generatedBlock(), 'run: node tools/workshop-sql.mjs');
});

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';

const UID = '00000000-0000-0000-0000-0000000000b1';
const MIN = 60e3;

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
  await db.query(`insert into auth.users (id, email) values ($1, 'w@test')`, [UID]);
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  // coins to spend, written as the server would: a challenge payout of 5,000
  const ch = (await db.query(`insert into public.challenges (creator, kind, sport, starts_on, ends_on, visibility, state)
    values ($1, 'xp', 'any', current_date - 10, current_date - 4, 'room', 'settled') returning id`, [UID])).rows[0].id;
  await db.query(`insert into public.coin_moves (user_id, challenge_id, kind, coins) values ($1, $2, 'payout', 5000)`, [UID, ch]);
  return db;
}
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*gear:/, ''));
const buy = (db, id) => db.query('select public.buy_gear($1) as w', [id]).then((r) => r.rows[0].w);
const read = (db) => db.query('select public.workshop() as w').then((r) => r.rows[0].w);
const coins = async (db) => Number((await db.query('select coins from public.wallet_fold($1)', [UID])).rows[0].coins);
const jobs = async (db) => (await db.query('select * from public.workshop_jobs order by id')).rows;
const t = (v) => new Date(v).getTime();
// move a job's window: started `a` minutes from now, finishing `b` minutes from now
const shift = (db, id, a, b) => db.query(`update public.workshop_jobs set started_at = now() + make_interval(secs => $2::int * 60), finishes_at = now() + make_interval(secs => $3::int * 60) where id = $1`, [id, a, b]);

test('buying queues: gear is not owned until fitted, the next job waits for the bay', { skip }, async () => {
  const db = await freshDb();
  const c0 = await coins(db);
  assert.ok(c0 > 2000, `enough coins to test with (${c0})`);
  await buy(db, 'bike-wheels-t1');
  await buy(db, 'bike-wheels-t2');                 // allowed: t1 is in the workshop ahead of it
  await buy(db, 'bike-rack');
  assert.equal(await coins(db), c0 - 100 - 350 - 180, 'paid on queueing');
  const [a, b, c] = await jobs(db);
  assert.equal(t(a.finishes_at) - t(a.started_at), 10 * MIN);
  assert.equal(t(b.started_at), t(a.finishes_at), 'the second waits for the first');
  assert.equal(t(b.finishes_at) - t(b.started_at), 60 * MIN);
  assert.equal(t(c.started_at), t(b.finishes_at));
  assert.equal(t(c.finishes_at) - t(c.started_at), 30 * MIN);
  assert.ok([a, b, c].every((j) => j.bay === 1));
  // nothing is owned yet, and buying the same thing again says so
  assert.equal(Number((await db.query('select count(*) as n from public.user_gear')).rows[0].n), 0);
  assert.equal(await code(buy(db, 'bike-wheels-t1')), 'in_workshop');
  assert.equal(await code(buy(db, 'bike-frame-t2')), 'tier_locked');
  // JS places the same way: one bay, after the last job
  const js = placeJob([a, b, c].map((j) => ({ ...j, state: 'queued' })), 1, 45, Date.now());
  assert.equal(js.bay, 1);
  assert.equal(js.startMs, t(c.finishes_at));
});

test('finishing: owned from the finish time, and the boost counts it before anyone looks', { skip }, async () => {
  const db = await freshDb();
  await buy(db, 'bike-wheels-t1');
  const [a] = await jobs(db);
  await shift(db, a.id, -20, -5);
  // before settling, the boost already counts a finished job
  const bp = (await db.query(`select public.gear_bp_sport($1, 'bike', now()) as bp`, [UID])).rows[0].bp;
  assert.equal(bp, GEAR_RULES.tierBoostBp[1]);
  const w = await read(db);
  assert.equal(w.jobs[0].state, 'done');
  const inv = (await db.query('select item_id, acquired_at from public.user_gear')).rows;
  assert.equal(inv.length, 1);
  assert.equal(t(inv[0].acquired_at), t((await jobs(db))[0].finishes_at), 'owned from the finish, not from when it was read');
  assert.equal(await code(buy(db, 'bike-wheels-t1')), 'owned');
  assert.ok(w.bays === 1 && w.now);
});

test('cancelling: free before it starts; mid-fit whole the first time, then half; never under a queued next tier', { skip }, async () => {
  const db = await freshDb();
  const c0 = await coins(db);
  await buy(db, 'bike-wheels-t1');
  await buy(db, 'bike-wheels-t2');
  const [a, b] = await jobs(db);
  assert.equal(await code(db.query('select public.workshop_cancel($1)', [a.id])), 'has_next');
  // waiting: everything back
  await db.query('select public.workshop_cancel($1)', [b.id]);
  assert.equal(await coins(db), c0 - 100);
  // mid-fit, the first time: everything back
  await shift(db, a.id, -3, 7);
  const ja = (await jobs(db))[0];
  assert.deepEqual(cancelRefund({ ...ja, state: 'queued' }, [], Date.now()), { refund: 100, midfit: true });
  await db.query('select public.workshop_cancel($1)', [a.id]);
  assert.equal(await coins(db), c0);
  // mid-fit again: half back
  await buy(db, 'bike-lights');                     // 600
  const l = (await jobs(db)).at(-1);
  await shift(db, l.id, -10, 170);
  await db.query('select public.workshop_cancel($1)', [l.id]);
  assert.equal(await coins(db), c0 - 600 + Math.floor(600 * WORKSHOP_RULES.cancelRefundBp / 10000));
  const row = (await jobs(db)).at(-1);
  assert.equal(row.state, 'cancelled'); assert.equal(row.midfit, true); assert.equal(row.refund, 300);
  assert.equal(await code(db.query('select public.workshop_cancel($1)', [l.id])), 'job_done');
});

test('a gel finishes the job being fitted, is used up, and the queue moves up', { skip }, async () => {
  const db = await freshDb();
  await buy(db, 'bike-lights');                     // 180 min
  await buy(db, 'bike-rack');                       // waits behind it
  const [a, b] = await jobs(db);
  assert.equal(await code(db.query(`select public.workshop_skip($1, 'gel')`, [b.id])), 'not_fitting');
  assert.equal(await code(db.query(`select public.workshop_skip($1, 'gel')`, [a.id])), 'fuel_none');
  assert.equal(await code(db.query(`select public.workshop_skip($1, 'pasta')`, [a.id])), 'unknown_item');
  await buy(db, 'gel');
  const w = (await db.query(`select public.workshop_skip($1, 'gel') as w`, [a.id])).rows[0].w;
  assert.equal(Number(w.held.gel), 0, 'the gel is used up');
  const [a2, b2] = await jobs(db);
  assert.equal(a2.state, 'done');
  assert.equal(a2.skipped_with, 'gel');
  assert.ok(Math.abs(t(b2.started_at) - Date.now()) < 5000, 'the rack starts now');
  assert.equal(t(b2.finishes_at) - t(b2.started_at), 30 * MIN);
  assert.equal(Number((await db.query(`select count(*) as n from public.user_gear where item_id = 'bike-lights'`)).rows[0].n), 1);
  // a gel spent in the workshop can't also be taken as a boost
  assert.equal(await code(db.query(`select public.use_gel('gel')`)), 'fuel_none');
});

test('a second bay with the feat: two jobs fit at once', { skip }, async () => {
  const db = await freshDb();
  await db.query(`insert into public.user_feats (user_id, feat_id, season, achieved_on) values ($1, $2, '2026-Q4', current_date)`, [UID, WORKSHOP_RULES.bay2Feat]);
  assert.equal((await read(db)).bays, 2);
  await buy(db, 'bike-lights');
  await buy(db, 'run-water');
  const [a, b] = await jobs(db);
  assert.deepEqual([a.bay, b.bay], [1, 2]);
  assert.ok(Math.abs(t(b.started_at) - t(a.started_at)) < 5000, 'both start now');
});

test('nobody writes jobs or settles for someone else', { skip }, async () => {
  const db = await freshDb();
  await db.exec('set role authenticated');
  assert.notEqual(await code(db.query(`insert into public.workshop_jobs (user_id, item_id, cost, bay, started_at, finishes_at) values ('${UID}', 'bike-rack', 0, 1, now(), now())`)), 'ok');
  assert.notEqual(await code(db.query(`select public.workshop_settle('${UID}')`)), 'ok');
  await db.exec('reset role');
});
