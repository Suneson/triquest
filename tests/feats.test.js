import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATS, FEAT_RULES, FEATS_SINCE, featById, seasonOf, evaluateFeats, checkSession, nearMiss, bodyweightAt, baseReason,
} from '../js/core/feats.js';
import { effortsFromActivity, actualsFromActivity } from '../js/core/strava.js';
import { earnsXp, xpStatus } from '../js/core/xp-rules.js';
import en from '../js/core/locales/en.js';
import es from '../js/core/locales/es.js';

let n = 0;
// a Strava session: sport, km, moving minutes, extra actual fields
const st = (date, type, km, min, actual = {}, over = {}) => ({
  id: over.id || `s${++n}`, date, type, intensity: 'steady', durationMin: min, completed: true, strava_activity_id: 1000 + n, source: 'strava',
  completedAt: `${date}T08:00:00Z`, metrics: { distanceKm: km },
  actual: { distanceKm: km, distanceM: Math.round(km * 1000), movingSec: min * 60, elapsedSec: min * 60, startUtc: `${date}T07:00:00Z`,
    sportType: { run: 'Run', bike: 'Ride', swim: 'Swim', gym: 'WeightTraining' }[type], ...actual },
  ...over,
});
// an app-logged gym session that passes the gym rules, with one lift
const gym = (date, libId, kg, reps, over = {}) => {
  const t0 = Date.parse(`${date}T18:00:00Z`);
  const sets = Array.from({ length: 4 }, (_, i) => ({ kind: 'work', done: true, weight: kg, reps, doneAt: new Date(t0 + i * 180e3).toISOString() }));
  return { id: over.id || `g${++n}`, date, type: 'gym', intensity: 'moderate', durationMin: 40, completed: true,
    gymLoggedAt: new Date(t0 + 20 * 60e3).toISOString(), exercises: [{ libId, name: libId, sets }], ...over };
};
const D = (k) => { const d = new Date(Date.UTC(2026, 9, 26 + k)); return d.toISOString().slice(0, 10); }; // D(0) = Mon 26 Oct 2026
const ids = (r) => r.awards.map((a) => a.featId);

test('the catalog: unique ids, a name and blurb in both languages, sane kinds', () => {
  const seen = new Set();
  for (const f of FEATS) {
    assert.ok(!seen.has(f.id), f.id); seen.add(f.id);
    assert.ok(en.feat[f.id]?.name && en.feat[f.id]?.blurb, `en ${f.id}`);
    assert.ok(es.feat[f.id]?.name && es.feat[f.id]?.blurb, `es ${f.id}`);
    assert.ok(['run', 'bike', 'swim', 'gym', 'cross'].includes(f.sport));
  }
  assert.equal(featById('run-5k-20').reward, 'kit-run-sub20');
  assert.equal(seasonOf('2026-10-26'), '2026-Q4');
  assert.equal(seasonOf('2027-02-01'), '2027-Q1');
});

test('Strava detail: best efforts and segment efforts are kept; a summary carries none', () => {
  const detail = effortsFromActivity({
    best_efforts: [{ name: '5k', elapsed_time: 1250 }, { name: '5k', elapsed_time: 1190 }, { name: '1k', elapsed_time: 200 }, { name: 'Half-Marathon', elapsed_time: 5400 }],
    segment_efforts: [
      { elapsed_time: 900, segment: { id: 1, climb_category: 0, elevation_high: 120, elevation_low: 100, distance: 2000 } },
      { elapsed_time: 3600, segment: { id: 2, climb_category: 5, elevation_high: 2100, elevation_low: 900, distance: 20000 } },
      { elapsed_time: 3500, segment: { id: 2, climb_category: 5, elevation_high: 2100, elevation_low: 900, distance: 20000 } },
    ],
  });
  assert.deepEqual(detail.bestEfforts, { '5k': 1190, half: 5400 });
  assert.deepEqual(detail.segments.map((s) => [s.id, s.sec, s.cat, s.gainM]), [[2, 3500, 5, 1200], [1, 900, 0, 20]]);
  assert.equal(detail.detail, true);
  assert.deepEqual(effortsFromActivity({ id: 1, distance: 5000 }), {});
  const a = actualsFromActivity({ id: 9, distance: 10234.6, moving_time: 2700, max_speed: 5.5, manual: true, trainer: false, sport_type: 'Run', workout_type: 1 });
  assert.equal(a.distanceM, 10235); assert.equal(a.maxSpeedKmh, 19.8); assert.equal(a.manual, true); assert.equal(a.workoutType, 1); assert.equal(a.sportType, 'Run');
});

test('a 5 km best effort inside a 10 km run; whole-activity pace when there are no best efforts', () => {
  const r = evaluateFeats([st(D(0), 'run', 10.2, 44, { bestEfforts: { '5k': 1190, '10k': 2620 } })]);
  for (const id of ['run-10k', 'run-5k-25', 'run-5k-22', 'run-5k-20', 'run-10k-50', 'run-10k-45']) assert.ok(ids(r).includes(id), id);
  assert.equal(r.awards.find((a) => a.featId === 'run-5k-20').value, 1190);
  assert.equal(r.awards.find((a) => a.featId === 'run-5k-20').whole, undefined);
  // 5.3 km in 26:30 moving = 25:00 for 5 km, whole activity
  const w = evaluateFeats([st(D(0), 'run', 5.3, 26.5)]);
  const a = w.awards.find((x) => x.featId === 'run-5k-25');
  assert.equal(a.value, 1500); assert.equal(a.whole, true);
  assert.ok(!ids(w).includes('run-5k-22'));
});

test('bad data is refused quietly, with the reason logged', () => {
  const car = st(D(0), 'run', 10, 30, { maxSpeedKmh: 48 });
  const manual = st(D(1), 'run', 10, 50, { manual: true });
  const treadmill = st(D(2), 'run', 10, 50, { sportType: 'VirtualRun' });
  const trainer = st(D(3), 'bike', 60, 120, { trainer: true });
  const old = st('2026-10-01', 'run', 10, 50);
  const r = evaluateFeats([car, manual, treadmill, trainer, old]);
  assert.deepEqual(ids(r), []);
  const why = Object.fromEntries(r.rejections.filter((x) => ['run-10k', 'bike-50'].includes(x.featId)).map((x) => [x.workoutId, x.reason]));
  assert.equal(why[car.id], 'maxSpeed');
  assert.equal(why[manual.id], 'manual');
  assert.equal(why[treadmill.id], 'machine');
  assert.equal(why[trainer.id], 'machine');
  assert.equal(why[old.id], undefined, 'before launch is not a rejection, just not counted');
  // a hand-typed Strava activity earns no XP from MANUAL_SINCE
  assert.equal(earnsXp(manual), false);
  assert.equal(xpStatus(manual, [manual]).reason, 'manual');
  assert.equal(earnsXp(st('2026-10-01', 'run', 5, 30, { manual: true })), true, 'earlier ones keep their XP');
  // world-record bounds
  assert.equal(checkSession(featById('run-5k-20'), st(D(0), 'run', 5, 13, { bestEfforts: { '5k': 780 } }), new Set()).reason, 'tooFast');
  assert.equal(checkSession(featById('bike-100'), st(D(0), 'bike', 120, 120), new Set()).reason, 'tooFast'); // 60 km/h for 2 h
  assert.equal(checkSession(featById('swim-2k'), st(D(0), 'swim', 2, 18), new Set()).reason, 'tooFast');   // 0:54 /100 m
});

test('a session on a planned rest day never counts', () => {
  // planned Mon and Wed, nothing planned Tue: Tue is a rest day
  const plan = (date) => ({ id: `p${date}`, date, type: 'run', source: 'plan', durationMin: 40, completed: false });
  const tue = st(D(1), 'run', 12, 60);
  const r = evaluateFeats([plan(D(0)), plan(D(2)), tue]);
  assert.ok(!ids(r).includes('run-10k'));
  assert.equal(r.rejections.find((x) => x.featId === 'run-10k').reason, 'restDay');
  // the server's stamp wins over the plan as it is now
  assert.ok(ids(evaluateFeats([plan(D(0)), plan(D(2)), { ...tue, onRestDay: false }])).includes('run-10k'));
  assert.equal(baseReason({ ...tue, onRestDay: true }, 'run', new Set()), 'restDay');
});

test('a month: each day counts at most its cap; once a season, then again the next', () => {
  const f = featById('run-month-50');
  const ws = [st('2026-11-02', 'run', 60, 300), st('2026-11-10', 'run', 10, 55)];   // 45 (capped) + 10 = 55
  const r = evaluateFeats(ws);
  const a = r.awards.find((x) => x.featId === f.id);
  assert.equal(a.value, 55); assert.equal(a.date, '2026-11-10'); assert.equal(a.season, '2026-Q4');
  // December (same season) adds nothing; January (next season) earns it again
  const more = [...ws, ...[1, 8, 15, 22, 29].map((d) => st(`2026-12-${String(d).padStart(2, '0')}`, 'run', 12, 60)),
    ...[5, 12, 19, 26].map((d) => st(`2027-01-${String(d).padStart(2, '0')}`, 'run', 14, 70))];
  const seasons = evaluateFeats(more).awards.filter((x) => x.featId === f.id).map((x) => x.season);
  assert.deepEqual(seasons, ['2026-Q4', '2027-Q1']);
  assert.equal(FEAT_RULES.dayCapKm.run, 45);
});

test('bike: climbing, 40 km/h, an HC segment, and their bounds', () => {
  const climb = st(D(0), 'bike', 90, 300, { elevationGainM: 2300 });
  const flat = st(D(1), 'bike', 25, 36, {});                     // 41.7 km/h
  const hc = st(D(2), 'bike', 70, 240, { segments: [{ id: 7, sec: 3600, cat: 5, gainM: 1200, m: 20000 }] });
  const r = evaluateFeats([climb, flat, hc]);
  assert.ok(ids(r).includes('bike-climb-2000'));
  assert.equal(r.awards.find((x) => x.featId === 'bike-40kph').whole, true);
  assert.ok(ids(r).includes('bike-hc'));
  const lift = st(D(3), 'bike', 30, 120, { elevationGainM: 2500 });  // 83 m/km: a cable car
  const rocket = st(D(4), 'bike', 70, 200, { segments: [{ id: 8, sec: 1800, cat: 5, gainM: 1200, m: 15000 }] }); // VAM 2400
  const bad = evaluateFeats([lift, rocket]);
  assert.equal(bad.rejections.find((x) => x.featId === 'bike-climb-2000').reason, 'climbDensity');
  assert.equal(bad.rejections.find((x) => x.featId === 'bike-hc').reason, 'vam');
});

test('swim: steady kilometre and 1:45 pace', () => {
  const steady = st(D(0), 'swim', 1.2, 22, { elapsedSec: 22 * 60 + 60 });   // 4.5% rest
  const choppy = st(D(1), 'swim', 1.2, 22, { elapsedSec: 30 * 60 });
  const r = evaluateFeats([steady, choppy]);
  assert.equal(r.awards.find((x) => x.featId === 'swim-1k-steady').workoutId, steady.id);
  assert.ok(!ids(r).includes('swim-1k-145'), '22 min for 1.2 km is 1:50 /100 m');
  assert.ok(ids(evaluateFeats([st(D(2), 'swim', 1.2, 20)])).includes('swim-1k-145'), '20 min for 1.2 km is 1:40 /100 m');
});

test('lifts: logged, checked in, against bodyweight, with history and a jump check', () => {
  const bw = [{ date: D(-10), weight: 78 }];
  const hist = [gym(D(-14), 'barbell-bench-press', 70, 5), gym(D(-10), 'barbell-bench-press', 75, 5), gym(D(-5), 'barbell-bench-press', 78, 5)];
  const ok = gym(D(2), 'barbell-bench-press', 80, 3, { gymCheckin: true });
  const r = evaluateFeats([...hist, ok], { bodyweights: bw });
  const a = r.awards.find((x) => x.featId === 'gym-bench-1');
  assert.equal(a.workoutId, ok.id); assert.equal(a.value, 80); assert.equal(a.logged, true);
  // no check-in, no history, a jump, no bodyweight
  const reason = (ws, ctx = { bodyweights: bw }) => evaluateFeats(ws, ctx).rejections.find((x) => x.featId === 'gym-bench-1')?.reason;
  assert.equal(reason([...hist, { ...ok, gymCheckin: false }]), 'noCheckin');
  assert.equal(reason([hist[2], ok]), 'liftHistory');
  assert.equal(reason([gym(D(-14), 'barbell-bench-press', 50, 5), gym(D(-10), 'barbell-bench-press', 50, 5), gym(D(-5), 'barbell-bench-press', 50, 5), ok]), 'liftJump');
  assert.equal(evaluateFeats([...hist, ok], { bodyweights: [] }).awards.length, 0);
  assert.equal(bodyweightAt([{ date: D(-40), weight: 90 }, { date: D(-3), weight: 77 }, { date: D(-2), weight: 76 }], D(0)), 77);
});

test('cross: four weeks of all four, an Olympic day, a real race', () => {
  const ws = [];
  for (let wk = 0; wk < 4; wk++) {
    ws.push(st(D(wk * 7), 'run', 8, 45), st(D(wk * 7 + 1), 'bike', 30, 60), st(D(wk * 7 + 2), 'swim', 1.5, 35), gym(D(wk * 7 + 3), 'back-squat', 60, 8));
  }
  const r = evaluateFeats(ws);
  const four = r.awards.find((x) => x.featId === 'cross-four-weeks');
  assert.ok(four); assert.equal(four.date, D(21 + 3));
  assert.ok(!ids(evaluateFeats(ws.slice(0, 12))).includes('cross-four-weeks'));
  // Olympic day: swim 07:00, ride 09:00, run 11:00
  const day = [
    st(D(40), 'swim', 1.5, 30, { startUtc: `${D(40)}T07:00:00Z` }),
    st(D(40), 'bike', 40, 70, { startUtc: `${D(40)}T09:00:00Z` }),
    st(D(40), 'run', 10, 45, { startUtc: `${D(40)}T11:00:00Z` }),
  ];
  assert.ok(ids(evaluateFeats(day)).includes('cross-olympic-day'));
  const twice = day.map((w) => ({ ...w, actual: { ...w.actual, startUtc: `${D(40)}T07:00:00Z` } }));
  assert.equal(evaluateFeats(twice).rejections.find((x) => x.featId === 'cross-olympic-day').reason, 'overlap');
  // a race: Strava's race flag on a planned race day
  const race = st(D(50), 'run', 10, 42, { workoutType: 1 });
  assert.ok(!ids(evaluateFeats([race])).includes('cross-race'), 'flag alone is not enough');
  assert.ok(ids(evaluateFeats([race], { events: [{ date: D(50) }] })).includes('cross-race'));
});

test('the near-miss line: how close you are', () => {
  const ws = [st(D(0), 'run', 10, 50, { bestEfforts: { '5k': 1274 } }), st(D(1), 'run', 5, 27, { bestEfforts: { '5k': 1350 } })];
  assert.deepEqual(nearMiss(featById('run-5k-20'), ws), { best: 1274, target: 1200, unit: 'sec', whole: false });
  assert.deepEqual(nearMiss(featById('run-half'), ws), { best: 10, target: 21.1, unit: 'km', whole: false });
  assert.equal(nearMiss(featById('bike-100'), ws), null);
  assert.equal(nearMiss(featById('run-month-100'), ws).best, 15);
  assert.ok(FEATS_SINCE <= D(0));
});

test('items: a feat pays its reward in the season it was won; the trio pays the singlet', async () => {
  const { featItemsOwned, seasonHue } = await import('../js/core/feats.js');
  const { FEAT_ITEMS, featItemById, KIT_SPRITES, kitSprite } = await import('../js/core/gear.js');
  const { sceneFor, SCENE_SPORTS } = await import('../js/core/scenes.js');
  const owned = featItemsOwned([
    { featId: 'run-5k-20', season: '2027-Q2' }, { featId: 'run-5k-20', season: '2026-Q4' },
    { featId: 'gym-bench-1', season: '2026-Q4' }, { featId: 'gym-squat-15', season: '2027-Q1' },
    { featId: 'run-10k', season: '2026-Q4' },
  ]);
  assert.deepEqual(owned.map((o) => [o.id, o.season]), [['kit-run-sub20', '2026-Q4']]);
  const trio = featItemsOwned(['gym-bench-1', 'gym-squat-15', 'gym-dead-2'].map((featId, i) => ({ featId, season: `2027-Q${i + 1}` })));
  assert.deepEqual(trio.map((o) => [o.id, o.season]), [['singlet-lifting', '2027-Q3']]);
  // every reward in the catalog is a feat item, and none has a price
  for (const f of FEATS) if (f.reward) assert.ok(featItemById(f.reward), f.reward);
  assert.ok(FEAT_ITEMS.every((i) => i.source === 'feat' && !('cost' in i) && i.feats.length));
  // wearable kits have a rider sprite
  for (const i of FEAT_ITEMS.filter((x) => x.wearable)) assert.ok(KIT_SPRITES[i.id], i.id);
  assert.ok(kitSprite('icons/Pixelart/BIKE/CHARACTERS/bikelvl6_char.webp', 'kit-iron').endsWith('--kit-iron.webp'));
  // colourways: the first season keeps the colours; no two of the next three years repeat
  assert.equal(seasonHue('2026-Q4'), 0);
  const hues = Array.from({ length: 12 }, (_, i) => seasonHue(`${2027 + Math.floor(i / 4)}-Q${(i % 4) + 1}`));
  assert.equal(new Set(hues).size, 12);
  // every scene has a board inside its art
  for (const s of SCENE_SPORTS) {
    const b = sceneFor(s, 1).board;
    assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.w <= 100 && b.y + b.h <= 100, s);
  }
});
