// feats.js — feats: how fast, how far, how hard (docs/FEATS.md). Pure.
//
// Feats sit above badges.js (volume milestones on the device). A feat is
// checked by the server against stored Strava data (0018_feats.sql runs the
// same rules, kind by kind; tests/feats-sql.test.js keeps the two equal), it
// drops a trophy on the sport's board, and the big ones unlock an item.
//
// Every feat is data, { id, sport, tier, kind, …params, repeatable, reward },
// so the SQL copy is generated from this file (tools/feats-sql.mjs) and the
// two can't drift. The rules for a session to count at all:
//   - Strava proof, not typed in by hand, not on a machine (for run, bike and
//     cross feats), dated from FEATS_SINCE, not on a planned rest day;
//   - the gym strength feats are the one labelled exception: an app-logged
//     session that passes the gym rules and carries the gym check-in.
// A session that reaches a feat's target but breaks one of its sanity bounds
// is a *rejection*: never awarded, and logged with the reason.

import { t } from './i18n.js';
import { earnsXp, hasStravaProof, MANUAL_SINCE } from './xp-rules.js';
import { plannedDaySet, isRestDay } from './rest.js';
import { startOfWeek, addDays } from './dates.js';

/** Sessions dated before this never count toward a feat. */
export const FEATS_SINCE = '2026-10-23';
export { MANUAL_SINCE };

export const FEAT_RULES = {
  // Strava sport types each sport's feats accept (machines and e-bikes never)
  sportTypes: {
    run: ['Run', 'TrailRun'],
    bike: ['Ride', 'GravelRide', 'MountainBikeRide'],
    swim: ['Swim'],
  },
  // sanity bounds (docs/FEATS.md §3)
  runMaxSpeedKmh: 30,
  bikeMaxSpeedKmh: 100,
  runFastestPace: { '5k': 825, '10k': 1650, half: 3587, '30k': 5100, marathon: 7175 }, // seconds; faster = rejected
  runFastestSecPerKm: 170,   // 2:50 /km over a long run
  runSlowestSecPerKm: 600,   // 10:00 /km: a hike, not a run feat
  bikeMaxAvgKmh: 45,         // a 50–160 km ride faster than this is a motorbike
  bikeMaxAvgKmhShort: 52,    // the 40 km/h feat
  climbMaxMPerKm: 60,
  climbMinKm: 40,
  maxVamMh: 2000,
  swimFastestSecPer100: 65,
  swimFastestMinM: 400,
  swimMaxM: 15000,
  // a month counts each day at most this far (and flags the rest)
  dayCapKm: { run: 45, bike: 200, swim: 6 },
  // lifts
  liftMaxRatio: { bench: 2.5, squat: 3.5, dead: 4 },
  liftJump: 1.15,            // an estimated 1RM more than 15% over your best in…
  liftJumpDays: 56,          // …the previous 8 weeks is refused
  liftMinHistory: 3,         // earlier sessions with the lift
  bodyweightDays: 30,        // the heaviest weight logged in this many days before
  liftReps: [1, 5],
};

export const LIFTS = { bench: 'barbell-bench-press', squat: 'back-squat', dead: 'deadlift' };

// name and blurb are getters: they read the active language (ids never change)
const feat = (f) => Object.defineProperties({ repeatable: false, reward: null, ...f }, {
  name: { enumerable: true, get: () => t(`feat.${f.id}.name`) },
  blurb: { enumerable: true, get: () => t(`feat.${f.id}.blurb`) },
  art: { enumerable: true, get: () => `icons/Pixelart/FEATS/${f.id}.png` },
});

/**
 * The catalog. Kinds:
 *   distance  one session ≥ km
 *   time      a distance (best effort, else whole-activity pace) in ≤ sec
 *   month     a calendar month's distance (each day capped) ≥ km; once a season
 *   climb     one ride's elevation ≥ m
 *   speed     ≥ km at ≥ kmh moving average, whole activity
 *   segment   a Strava segment effort of climb category ≥ cat (5 = HC)
 *   steady    one swim ≥ m with elapsed ≤ ratio × moving
 *   pace      one swim ≥ m at ≤ sec per 100 m
 *   count     n gym sessions that earned XP (any proof)
 *   lift      a 1–5 rep set ≥ ratio × bodyweight (logged, checked in)
 *   weeks     n Monday weeks in a row, each with run, bike, swim and gym
 *   triday    one day with a swim, a ride and a run of at least these lengths
 *   race      Strava's race flag on a day you planned as a race
 */
export const FEATS = [
  // run
  feat({ id: 'run-10k', sport: 'run', tier: 1, kind: 'distance', km: 10 }),
  feat({ id: 'run-5k-25', sport: 'run', tier: 1, kind: 'time', dist: '5k', sec: 25 * 60 }),
  feat({ id: 'run-5k-22', sport: 'run', tier: 2, kind: 'time', dist: '5k', sec: 22 * 60 }),
  feat({ id: 'run-5k-20', sport: 'run', tier: 3, kind: 'time', dist: '5k', sec: 20 * 60, reward: 'kit-run-sub20' }),
  feat({ id: 'run-10k-50', sport: 'run', tier: 2, kind: 'time', dist: '10k', sec: 50 * 60 }),
  feat({ id: 'run-10k-45', sport: 'run', tier: 3, kind: 'time', dist: '10k', sec: 45 * 60 }),
  feat({ id: 'run-half', sport: 'run', tier: 2, kind: 'distance', km: 21.1, reward: 'cap-run' }),
  feat({ id: 'run-30k', sport: 'run', tier: 3, kind: 'distance', km: 30 }),
  feat({ id: 'run-marathon', sport: 'run', tier: 4, kind: 'distance', km: 42.2, reward: 'shirt-finisher' }),
  feat({ id: 'run-month-50', sport: 'run', tier: 1, kind: 'month', km: 50, repeatable: true }),
  feat({ id: 'run-month-100', sport: 'run', tier: 3, kind: 'month', km: 100, repeatable: true }),
  // bike
  feat({ id: 'bike-50', sport: 'bike', tier: 1, kind: 'distance', km: 50 }),
  feat({ id: 'bike-100', sport: 'bike', tier: 2, kind: 'distance', km: 100 }),
  feat({ id: 'bike-160', sport: 'bike', tier: 3, kind: 'distance', km: 160, reward: 'kit-gran-fondo' }),
  feat({ id: 'bike-climb-2000', sport: 'bike', tier: 3, kind: 'climb', m: 2000 }),
  feat({ id: 'bike-40kph', sport: 'bike', tier: 3, kind: 'speed', km: 20, kmh: 40 }),
  feat({ id: 'bike-hc', sport: 'bike', tier: 4, kind: 'segment', cat: 5, reward: 'cap-climber' }),
  feat({ id: 'bike-month-200', sport: 'bike', tier: 1, kind: 'month', km: 200, repeatable: true }),
  feat({ id: 'bike-month-500', sport: 'bike', tier: 3, kind: 'month', km: 500, repeatable: true }),
  // swim
  feat({ id: 'swim-1k', sport: 'swim', tier: 1, kind: 'distance', km: 1 }),
  feat({ id: 'swim-1k-steady', sport: 'swim', tier: 2, kind: 'steady', m: 1000, ratio: 1.1 }),
  feat({ id: 'swim-2k', sport: 'swim', tier: 2, kind: 'distance', km: 2, reward: 'trisuit-limited' }),
  feat({ id: 'swim-1k-145', sport: 'swim', tier: 3, kind: 'pace', m: 1000, sec: 105 }),
  feat({ id: 'swim-month-10', sport: 'swim', tier: 2, kind: 'month', km: 10, repeatable: true }),
  // gym
  feat({ id: 'gym-25', sport: 'gym', tier: 1, kind: 'count', n: 25 }),
  feat({ id: 'gym-100', sport: 'gym', tier: 3, kind: 'count', n: 100 }),
  feat({ id: 'gym-bench-1', sport: 'gym', tier: 2, kind: 'lift', lift: 'bench', ratio: 1, logged: true }),
  feat({ id: 'gym-squat-15', sport: 'gym', tier: 3, kind: 'lift', lift: 'squat', ratio: 1.5, logged: true }),
  feat({ id: 'gym-dead-2', sport: 'gym', tier: 3, kind: 'lift', lift: 'dead', ratio: 2, logged: true }),
  // cross
  feat({ id: 'cross-four-weeks', sport: 'cross', tier: 3, kind: 'weeks', n: 4, reward: 'cap-training' }),
  feat({ id: 'cross-olympic-day', sport: 'cross', tier: 3, kind: 'triday', swim: 1.5, bike: 40, run: 10, reward: 'frame-olympic' }),
  feat({ id: 'cross-iron-day', sport: 'cross', tier: 5, kind: 'triday', swim: 3.8, bike: 180, run: 42.2, reward: 'kit-iron' }),
  feat({ id: 'cross-race', sport: 'cross', tier: 2, kind: 'race', runKm: 5, bikeKm: 20, repeatable: true, reward: 'frame-race' }),
];

/** The three lifts together unlock the singlet. */
export const TRIO = { feats: ['gym-bench-1', 'gym-squat-15', 'gym-dead-2'], reward: 'singlet-lifting' };

export const featById = (id) => FEATS.find((f) => f.id === id) || null;
export const FEAT_SPORTS = ['run', 'bike', 'swim', 'gym', 'cross'];

/** The season a date falls in: its calendar quarter, '2026-Q4'. */
export function seasonOf(date) {
  const [y, m] = String(date).split('-').map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

// ---- what a session is ---------------------------------------------------------

const A = (w) => w?.actual || {};
const distM = (w) => {
  const m = Number(A(w).distanceM);
  if (m > 0) return m;
  const km = Number(A(w).distanceKm ?? w?.metrics?.distanceKm);
  return km > 0 ? km * 1000 : 0;
};
const movingSec = (w) => {
  const s = Number(A(w).movingSec);
  if (s > 0) return s;
  const min = Number(A(w).durationMin ?? w?.durationMin);
  return min > 0 ? min * 60 : 0;
};
const elapsedSec = (w) => Number(A(w).elapsedSec) || movingSec(w);
/** The Strava sport type, or a stand-in from the app type for rows imported before it was stored. */
const sportTypeOf = (w) => A(w).sportType || ({ run: 'Run', bike: 'Ride', swim: 'Swim' }[w?.type] ?? null);

/** Is a session on a planned rest day? The server's stamp when it has one, else worked out from the plan. */
export function onRestDay(w, planned) {
  if (typeof w?.onRestDay === 'boolean') return w.onRestDay;
  return isRestDay(w?.date, planned);
}

/**
 * Why a Strava session can't count toward a feat in `sport` at all, or null.
 * 'since' | 'proof' | 'manual' | 'machine' | 'restDay'
 */
export function baseReason(w, sport, planned) {
  if (!w || String(w.date) < FEATS_SINCE) return 'since';
  if (A(w).manual === true) return 'manual';
  if (!earnsXp(w) || !hasStravaProof(w)) return 'proof';
  const types = FEAT_RULES.sportTypes[sport];
  if (types && (A(w).trainer === true || !types.includes(sportTypeOf(w)))) return 'machine';
  if (onRestDay(w, planned)) return 'restDay';
  return null;
}

// per-sport sanity bounds on a single session; the reason, or null
function sessionBound(w, sport) {
  const R = FEAT_RULES;
  const m = distM(w);
  const mov = movingSec(w);
  const vmax = Number(A(w).maxSpeedKmh) || 0;
  if (sport === 'run') {
    if (vmax > R.runMaxSpeedKmh) return 'maxSpeed';
    if (m >= 21000 && mov > 0) {
      const perKm = mov / (m / 1000);
      if (perKm < R.runFastestSecPerKm) return 'tooFast';
      if (perKm > R.runSlowestSecPerKm) return 'tooSlow';
    }
  }
  if (sport === 'bike') {
    if (vmax > R.bikeMaxSpeedKmh) return 'maxSpeed';
    if (m >= 50000 && mov > 0 && m / mov * 3.6 > R.bikeMaxAvgKmh) return 'tooFast';
  }
  if (sport === 'swim') {
    if (m > R.swimMaxM) return 'tooLong';
    if (m >= R.swimFastestMinM && mov > 0 && mov / (m / 100) < R.swimFastestSecPer100) return 'tooFast';
  }
  return null;
}

// ---- one session against one feat -----------------------------------------------

/**
 * A single-session feat: { value, hit, reason, whole } where `hit` is whether
 * the session reaches the target, `reason` why it's refused (null when it
 * counts) and `whole` whether a time came from whole-activity pace.
 * Null when the feat isn't a single-session kind or the session isn't its sport.
 */
export function checkSession(f, w, planned) {
  if (!['distance', 'time', 'climb', 'speed', 'segment', 'steady', 'pace'].includes(f.kind)) return null;
  if (w?.type !== f.sport) return null;
  const R = FEAT_RULES;
  const m = distM(w);
  const mov = movingSec(w);
  let value = 0; let hit = false; let reason = null; let whole = false;
  if (f.kind === 'distance') {
    value = Math.round(m) / 1000;
    hit = m >= f.km * 1000;
  } else if (f.kind === 'time') {
    const d = { '5k': 5000, '10k': 10000 }[f.dist];
    const be = Number(A(w).bestEfforts?.[f.dist]);
    if (be > 0) value = be;
    else if (m >= d && mov > 0) { value = Math.round(mov * d / m); whole = true; } else value = 0;
    hit = value > 0 && value <= f.sec;
    if (hit && value < R.runFastestPace[f.dist]) reason = 'tooFast';
  } else if (f.kind === 'climb') {
    value = Math.round(Number(A(w).elevationGainM) || 0);
    hit = value >= f.m;
    if (hit && (m < R.climbMinKm * 1000 || value / (m / 1000) > R.climbMaxMPerKm)) reason = 'climbDensity';
  } else if (f.kind === 'speed') {
    value = m >= f.km * 1000 && mov > 0 ? Math.round(m / mov * 36) / 10 : 0;
    hit = value >= f.kmh;
    whole = true;
    if (hit && value > R.bikeMaxAvgKmhShort) reason = 'tooFast';
  } else if (f.kind === 'segment') {
    const segs = (A(w).segments || []).filter((s) => Number(s.cat) >= f.cat);
    const ok = segs.filter((s) => !(s.gainM > 0 && s.sec > 0 && s.gainM / (s.sec / 3600) > R.maxVamMh));
    value = segs.length ? Math.max(...segs.map((s) => Number(s.gainM) || 0)) : 0;
    hit = segs.length > 0;
    if (hit && !ok.length) reason = 'vam';
  } else if (f.kind === 'steady') {
    value = m >= f.m && mov > 0 ? Math.round(elapsedSec(w) / mov * 100) / 100 : 0;
    hit = value > 0 && value <= f.ratio;
  } else if (f.kind === 'pace') {
    value = m >= f.m && mov > 0 ? Math.round(mov / (m / 100)) : 0;
    hit = value > 0 && value <= f.sec;
    whole = true;
  }
  if (hit && !reason) reason = baseReason(w, f.sport, planned) || sessionBound(w, f.sport);
  return { value, hit, reason, whole };
}

// ---- the athlete's whole history ------------------------------------------------

const byWhen = (a, b) => String(a.date).localeCompare(String(b.date))
  || String(A(a).startUtc || a.completedAt || '').localeCompare(String(A(b).startUtc || b.completedAt || ''))
  || String(a.id).localeCompare(String(b.id));

const monthOf = (date) => String(date).slice(0, 7);

/** The heaviest bodyweight logged in the `days` before `date` (inclusive), or null. */
export function bodyweightAt(log, date, days = FEAT_RULES.bodyweightDays) {
  const from = addDays(date, -days);
  const ws = (log || []).filter((m) => m && m.date <= date && m.date >= from && Number(m.weight) > 0).map((m) => Number(m.weight));
  return ws.length ? Math.max(...ws) : null;
}

const e1rm = (kg, reps) => (reps === 1 ? kg : kg * (1 + reps / 30));
/** Done working sets of one library lift in a session: [{ kg, reps }]. */
const liftSets = (w, libId) => (w?.exercises || []).filter((e) => e && e.libId === libId)
  .flatMap((e) => (Array.isArray(e.sets) ? e.sets : []))
  .filter((s) => s && s.done && s.kind !== 'warmup' && Number(s.weight) > 0 && Number(s.reps) > 0)
  .map((s) => ({ kg: Number(s.weight), reps: Number(s.reps) }));

/**
 * Everything a history earns: { awards, rejections }.
 *   awards:     [{ featId, season, workoutId, value, date, whole? }], the first earning per feat
 *               (per season for a repeatable one)
 *   rejections: [{ featId, workoutId, reason }], sessions that reached a target but were refused
 * `ctx`: { bodyweights: [{ date, weight }], events: [{ date }] } from the athlete's settings.
 */
export function evaluateFeats(workouts, ctx = {}) {
  const ws = (workouts || []).filter(Boolean).slice().sort(byWhen);
  const planned = plannedDaySet(ws);
  const awards = [];
  const rejections = [];
  const award = (f, w, value, date, extra = {}) => awards.push({ featId: f.id, season: seasonOf(date), workoutId: w?.id ?? null, value, date, ...extra });

  for (const f of FEATS) {
    if (['distance', 'time', 'climb', 'speed', 'segment', 'steady', 'pace'].includes(f.kind)) {
      let done = false;
      for (const w of ws) {
        const c = checkSession(f, w, planned);
        if (!c || !c.hit) continue;
        if (c.reason) { if (c.reason !== 'since') rejections.push({ featId: f.id, workoutId: w.id, reason: c.reason }); continue; }
        if (!done) { award(f, w, c.value, w.date, c.whole ? { whole: true } : {}); done = true; }
      }
    } else if (f.kind === 'month') {
      const cap = FEAT_RULES.dayCapKm[f.sport] * 1000;
      const days = new Map();
      for (const w of ws) {
        if (w.type !== f.sport || baseReason(w, f.sport, planned) || sessionBound(w, f.sport)) continue;
        days.set(w.date, [...(days.get(w.date) || []), w]);
      }
      const months = new Map();
      for (const [date, list] of [...days.entries()].sort()) {
        const counted = Math.min(cap, list.reduce((n, w) => n + distM(w), 0));
        const mo = monthOf(date);
        const cur = months.get(mo) || { m: 0, hitOn: null, w: null };
        cur.m += counted;
        if (!cur.hitOn && cur.m >= f.km * 1000) { cur.hitOn = date; cur.w = list[list.length - 1]; }
        months.set(mo, cur);
      }
      const seasons = new Set();
      for (const [, cur] of [...months.entries()].sort()) {
        if (!cur.hitOn || seasons.has(seasonOf(cur.hitOn))) continue;
        seasons.add(seasonOf(cur.hitOn));
        award(f, cur.w, Math.round(cur.m) / 1000, cur.hitOn);
      }
    } else if (f.kind === 'count') {
      const gym = ws.filter((w) => w.type === 'gym' && earnsXp(w) && String(w.date) >= FEATS_SINCE && !onRestDay(w, planned));
      if (gym.length >= f.n) award(f, gym[f.n - 1], f.n, gym[f.n - 1].date);
    } else if (f.kind === 'lift') {
      const R = FEAT_RULES;
      const lib = LIFTS[f.lift];
      for (const w of ws) {
        if (w.type !== 'gym' || !earnsXp(w) || String(w.date) < FEATS_SINCE) continue;
        const sets = liftSets(w, lib).filter((s) => s.reps >= R.liftReps[0] && s.reps <= R.liftReps[1]);
        if (!sets.length) continue;
        const bw = bodyweightAt(ctx.bodyweights, w.date);
        const top = Math.max(...sets.map((s) => s.kg));
        if (!bw || top < f.ratio * bw) continue; // not a hit (no bodyweight: the case says so)
        const best = sets.filter((s) => s.kg === top).sort((a, b) => b.reps - a.reps)[0];
        const earlier = ws.filter((x) => x !== w && byWhen(x, w) < 0 && x.type === 'gym' && liftSets(x, lib).length);
        const recent = earlier.filter((x) => x.date >= addDays(w.date, -R.liftJumpDays));
        const prevBest = Math.max(0, ...recent.flatMap((x) => liftSets(x, lib)).filter((s) => s.reps <= 12).map((s) => e1rm(s.kg, s.reps)));
        let reason = null;
        if (onRestDay(w, planned)) reason = 'restDay';
        else if (w.gymCheckin !== true) reason = 'noCheckin';
        else if (top > R.liftMaxRatio[f.lift] * bw) reason = 'liftRatio';
        else if (earlier.length < R.liftMinHistory) reason = 'liftHistory';
        else if (e1rm(best.kg, best.reps) > R.liftJump * prevBest) reason = 'liftJump';
        if (reason) { rejections.push({ featId: f.id, workoutId: w.id, reason }); continue; }
        award(f, w, top, w.date, { logged: true });
        break;
      }
    } else if (f.kind === 'weeks') {
      // when each Monday week first had all four sports (gym by any proof)
      const firstBy = new Map();
      for (const w of ws) {
        const sport = w.type;
        if (!['run', 'bike', 'swim', 'gym'].includes(sport)) continue;
        const ok = sport === 'gym'
          ? earnsXp(w) && String(w.date) >= FEATS_SINCE && !onRestDay(w, planned)
          : !baseReason(w, sport, planned);
        if (!ok) continue;
        const wk = startOfWeek(w.date, 1);
        const m = firstBy.get(wk) || {};
        if (!m[sport]) m[sport] = w;
        firstBy.set(wk, m);
      }
      const complete = new Map();
      for (const [wk, m] of firstBy) {
        if (['run', 'bike', 'swim', 'gym'].every((k) => m[k])) {
          complete.set(wk, ['run', 'bike', 'swim', 'gym'].map((k) => m[k]).sort(byWhen).pop());
        }
      }
      for (const wk of [...complete.keys()].sort()) {
        if (Array.from({ length: f.n }, (_, i) => addDays(wk, -7 * i)).every((x) => complete.has(x))) {
          const w = complete.get(wk);
          award(f, w, f.n, w.date);
          break;
        }
      }
    } else if (f.kind === 'triday') {
      const dates = [...new Set(ws.map((w) => w.date))].sort();
      for (const date of dates) {
        const pick = {};
        for (const sport of ['swim', 'bike', 'run']) {
          const c = ws.filter((w) => w.date === date && w.type === sport && !baseReason(w, sport, planned) && !sessionBound(w, sport))
            .sort((a, b) => distM(b) - distM(a) || byWhen(a, b))[0];
          if (c && distM(c) >= f[sport] * 1000) pick[sport] = c;
        }
        if (!(pick.swim && pick.bike && pick.run)) continue;
        const spans = ['swim', 'bike', 'run'].map((k) => {
          const s = Date.parse(A(pick[k]).startUtc);
          return Number.isFinite(s) ? [s, s + elapsedSec(pick[k]) * 1000] : null;
        });
        const overlap = spans.every(Boolean) && spans.some((a, i) => spans.some((b, j) => i < j && a[0] < b[1] && b[0] < a[1]));
        if (overlap) { rejections.push({ featId: f.id, workoutId: pick.run.id, reason: 'overlap' }); continue; }
        const last = ['swim', 'bike', 'run'].map((k) => pick[k]).sort(byWhen).pop();
        award(f, last, null, date);
        break;
      }
    } else if (f.kind === 'race') {
      const events = new Set((ctx.events || []).map((e) => e?.date).filter(Boolean));
      const raceDays = new Set(ws.filter((w) => w.isRace && w.source !== 'strava').map((w) => w.date));
      const seasons = new Set();
      for (const w of ws) {
        const sport = w.type;
        const flag = (sport === 'run' && A(w).workoutType === 1) || (sport === 'bike' && A(w).workoutType === 11);
        if (!flag || !(raceDays.has(w.date) || events.has(w.date))) continue;
        if (distM(w) < (sport === 'run' ? f.runKm : f.bikeKm) * 1000) continue;
        const reason = baseReason(w, sport, planned) || sessionBound(w, sport);
        // a race on a day you planned as one isn't a rest day, whatever the plan around it says
        if (reason && reason !== 'restDay') { if (reason !== 'since') rejections.push({ featId: f.id, workoutId: w.id, reason }); continue; }
        if (seasons.has(seasonOf(w.date))) continue;
        seasons.add(seasonOf(w.date));
        award(f, w, Math.round(distM(w)) / 1000, w.date);
      }
    }
  }
  return { awards, rejections };
}

// ---- the trophy case's near-miss line --------------------------------------------

/**
 * How close you are to a single-session or month feat you haven't earned:
 * { best, target, unit, whole } or null (none of your sessions is even a start).
 * Lower-is-better feats (times, paces, the swim ratio) report the lowest value.
 */
export function nearMiss(f, workouts) {
  const ws = (workouts || []).filter(Boolean);
  const planned = plannedDaySet(ws);
  const lower = ['time', 'pace', 'steady'].includes(f.kind);
  let best = null; let whole = false;
  if (f.kind === 'month') {
    const by = new Map();
    for (const w of ws) {
      if (w.type !== f.sport || baseReason(w, f.sport, planned) || sessionBound(w, f.sport)) continue;
      const k = monthOf(w.date);
      by.set(k, (by.get(k) || 0) + distM(w));
    }
    if (by.size) best = Math.round(Math.max(...by.values())) / 1000;
    return best == null ? null : { best, target: f.km, unit: 'km', whole };
  }
  for (const w of ws) {
    const c = checkSession(f, w, planned);
    if (!c || !c.value || (c.reason && c.hit)) continue;
    if (!c.hit && baseReason(w, f.sport, planned)) continue;
    if (best == null || (lower ? c.value < best : c.value > best)) { best = c.value; whole = c.whole; }
  }
  if (best == null) return null;
  const target = { distance: f.km, time: f.sec, climb: f.m, speed: f.kmh, segment: null, steady: f.ratio, pace: f.sec }[f.kind];
  const unit = { distance: 'km', time: 'sec', climb: 'm', speed: 'kmh', segment: 'm', steady: 'ratio', pace: 'sec100' }[f.kind];
  return { best, target, unit, whole };
}
