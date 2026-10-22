// Feats on both sides: 0018_feats.sql must award and refuse exactly what
// js/core/feats.js does. Runs every migration in PGlite (a dev dependency;
// skipped when it isn't installed) over one fixture history that touches
// every kind of feat and every rejection reason.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/feats-sql.mjs';
import { evaluateFeats } from '../js/core/feats.js';

test('the generated block in 0018_feats.sql matches js/core/feats.js', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const block = sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length);
  assert.equal(block, generatedBlock(), 'run: node tools/feats-sql.mjs');
});

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }

const UID = '00000000-0000-0000-0000-0000000000f1';

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
  await db.query(`insert into auth.users (id, email) values ($1, 'f@test')`, [UID]);
  await db.query(`insert into public.profiles (id) values ($1) on conflict (id) do nothing`, [UID]);
  return db;
}

// ---- one history that touches every kind ---------------------------------------

let n = 0;
const D = (k) => new Date(Date.UTC(2026, 9, 26 + k)).toISOString().slice(0, 10); // D(0) = Mon 26 Oct 2026
const st = (date, type, km, min, actual = {}, over = {}) => ({
  id: over.id || `s${String(++n).padStart(3, '0')}`, date, type, intensity: 'steady', durationMin: min, completed: true,
  strava_activity_id: 5000 + n, source: 'strava', completedAt: `${date}T08:00:00.000Z`, metrics: { distanceKm: km },
  actual: { distanceKm: km, distanceM: Math.round(km * 1000), movingSec: min * 60, elapsedSec: min * 60,
    startUtc: `${date}T07:${String(n % 60).padStart(2, '0')}:00Z`,
    sportType: { run: 'Run', bike: 'Ride', swim: 'Swim' }[type], ...actual },
  ...over,
});
const gym = (date, libId, kg, reps, over = {}) => {
  const t0 = Date.parse(`${date}T18:00:00Z`);
  const sets = Array.from({ length: 4 }, (_, i) => ({ kind: 'work', done: true, weight: kg, reps, doneAt: new Date(t0 + i * 180e3).toISOString() }));
  return { id: over.id || `g${String(++n).padStart(3, '0')}`, date, type: 'gym', intensity: 'moderate', durationMin: 40, completed: true,
    source: 'custom', gymLoggedAt: new Date(t0 + 20 * 60e3).toISOString(), exercises: [{ libId, name: libId, sets }], ...over };
};
const plan = (date, over = {}) => ({ id: `p${date}${over.isRace ? 'r' : ''}`, date, type: 'run', source: 'plan', durationMin: 40, completed: false, metrics: {}, ...over });

const PLANS = [plan(D(60)), plan(D(62)), plan(D(70), { isRace: true })];
const HISTORY = [
  st(D(0), 'run', 10.2, 44, { bestEfforts: { '5k': 1190, '10k': 2620 } }),
  st(D(1), 'run', 5.3, 27, { movingSec: 1590 }),
  st(D(2), 'run', 10, 30, { maxSpeedKmh: 48 }),
  st(D(3), 'run', 10, 50, { manual: true }),
  st(D(4), 'run', 10, 50, { sportType: 'VirtualRun' }),
  st(D(5), 'bike', 60, 120, { trainer: true }),
  st('2026-10-01', 'run', 12, 60),
  st(D(61), 'run', 12, 60),                                      // planned rest day (60 and 62 planned)
  st(D(6), 'bike', 90, 300, { elevationGainM: 2300 }),
  st(D(7), 'bike', 25, 36),
  st(D(8), 'bike', 70, 240, { segments: [{ id: 7, sec: 3600, cat: 5, gainM: 1200, m: 20000 }] }),
  st(D(9), 'bike', 30, 120, { elevationGainM: 2500 }),
  st(D(10), 'bike', 70, 200, { segments: [{ id: 8, sec: 1800, cat: 5, gainM: 1200, m: 15000 }] }),
  st(D(11), 'bike', 120, 120),
  st(D(12), 'swim', 1.2, 22, { elapsedSec: 22 * 60 + 60 }),
  st(D(13), 'swim', 1.2, 20),
  st(D(14), 'swim', 2.2, 18),
  ...['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22'].map((d) => st(d, 'run', 14, 70)),
  ...['2027-01-05', '2027-01-12', '2027-01-19', '2027-01-26'].map((d) => st(d, 'run', 14, 70)),
  st('2026-11-28', 'run', 60, 300),
  gym(D(-14), 'barbell-bench-press', 70, 5), gym(D(-10), 'barbell-bench-press', 75, 5), gym(D(-5), 'barbell-bench-press', 78, 5),
  gym(D(15), 'barbell-bench-press', 80, 3, { gymCheckin: false }),
  gym(D(16), 'barbell-bench-press', 80, 3, { gymCheckin: true }),
  gym(D(17), 'back-squat', 300, 3, { gymCheckin: true }),
  ...[0, 1, 2, 3].flatMap((wk) => [st(D(28 + wk * 7), 'run', 8, 45), st(D(29 + wk * 7), 'bike', 30, 60), st(D(30 + wk * 7), 'swim', 1.5, 35),
    gym(D(31 + wk * 7), 'back-squat', 60, 8)]),
  st(D(80), 'swim', 1.5, 30, { startUtc: `${D(80)}T07:00:00Z` }),
  st(D(80), 'bike', 40, 70, { startUtc: `${D(80)}T09:00:00Z` }),
  st(D(80), 'run', 10, 45, { startUtc: `${D(80)}T11:00:00Z` }),
  st(D(70), 'run', 10, 42, { workoutType: 1 }),
  st(D(90), 'run', 10, 42, { workoutType: 1 }),
];
const SETTINGS = { bodyMetrics: [{ date: D(-2), weight: 78 }, { date: D(14), weight: 79 }], events: [{ title: 'Club 10k', date: D(90) }] };

async function seed(db) {
  await db.query('update public.profiles set settings = $2 where id = $1', [UID, SETTINGS]);
  for (const w of [...PLANS, ...HISTORY]) {
    const extra = {};
    for (const k of ['gymLoggedAt', 'gymCheckin', 'isRace', 'optional']) if (w[k] !== undefined) extra[k] = w[k];
    await db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, distance_km, completed,
        completed_at, strava_activity_id, source, actual, exercises, extra)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [w.id, UID, w.date, w.type, w.intensity || null, w.durationMin, w.metrics?.distanceKm ?? null, w.completed,
      w.completedAt ?? null, w.strava_activity_id ?? null, w.source, w.actual ?? null, JSON.stringify(w.exercises || []), extra]);
  }
}

const keyA = (a) => `${a.featId}|${a.season}|${a.workoutId}|${a.value == null ? '' : Number(a.value)}|${a.date}|${!!a.whole}|${!!a.logged}`;
const keyR = (r) => `${r.featId}|${r.workoutId}|${r.reason}`;

test('JS and SQL award and refuse the same feats', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  await seed(db);
  const rows = (await db.query(`select out_kind, feat_id, season, workout_id, value::float8 as value, achieved_on::text as achieved_on,
      whole, logged, reason from public.feat_eval($1)`, [UID])).rows;
  const sqlA = rows.filter((r) => r.out_kind === 'award').map((r) => keyA({ featId: r.feat_id, season: r.season, workoutId: r.workout_id, value: r.value, date: r.achieved_on, whole: r.whole, logged: r.logged })).sort();
  const sqlR = rows.filter((r) => r.out_kind === 'reject').map((r) => keyR({ featId: r.feat_id, workoutId: r.workout_id, reason: r.reason })).sort();
  const js = evaluateFeats([...PLANS, ...HISTORY], { bodyweights: SETTINGS.bodyMetrics, events: SETTINGS.events });
  assert.deepEqual(sqlA, js.awards.map(keyA).sort());
  assert.deepEqual(sqlR, js.rejections.map(keyR).sort());
  // the fixtures exercise every kind and every reason
  const kinds = new Set(js.awards.map((a) => a.featId));
  for (const id of ['run-5k-20', 'run-5k-25', 'run-month-50', 'bike-climb-2000', 'bike-40kph', 'bike-hc', 'swim-1k-steady', 'swim-1k-145',
    'gym-bench-1', 'cross-four-weeks', 'cross-olympic-day', 'cross-race']) assert.ok(kinds.has(id), id);
  const reasons = new Set(js.rejections.map((r) => r.reason));
  for (const r of ['maxSpeed', 'manual', 'machine', 'restDay', 'climbDensity', 'vam', 'tooFast', 'noCheckin', 'liftRatio']) assert.ok(reasons.has(r), r);
});

test('award_feats writes once, is idempotent, and only for yourself', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await freshDb();
  await seed(db);
  await db.query(`select set_config('test.uid', $1, false)`, [UID]);
  const first = (await db.query('select feat_id, season from public.award_feats()')).rows;
  assert.ok(first.length > 10);
  const again = (await db.query('select feat_id from public.award_feats()')).rows;
  assert.equal(again.length, 0, 'nothing new the second time');
  const months = (await db.query(`select season from public.user_feats where feat_id = 'run-month-50' order by season`)).rows.map((r) => r.season);
  assert.deepEqual(months, ['2026-Q4', '2027-Q1']);
  const other = '00000000-0000-0000-0000-0000000000f2';
  await assert.rejects(db.query('select public.award_feats($1)', [other]), /not yours/);
  // a hand-typed activity from manualSince earns no XP on the server either
  const m = (await db.query(`select public.earns(w) as e from public.workouts w where w.actual ->> 'manual' = 'true'`)).rows[0];
  assert.equal(m.e, false);
  // the rest-day stamp was written when the session first earned
  const rest = (await db.query(`select on_rest_day from public.workouts where date = $1 and type = 'run' and source = 'strava'`, [D(61)])).rows[0];
  assert.equal(rest.on_rest_day, true);
});
