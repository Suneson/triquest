// challenges.js — challenges between athletes, and what's staked on them
// (docs/CHALLENGES.md). Pure.
//
// Everything that pays out is decided by the server (0019_challenges.sql runs
// the same rules; tests/challenges-sql.test.js keeps the two equal). This file
// gives the same numbers for the live standings on the device, the rule read
// back in plain words, and the guards the join sheet explains before anyone
// stakes a coin.
//
// The lines that never move:
//   - coins only, never bought, never cashed out; a stake moves only into a
//     pot and out of it as a payout or a refund;
//   - only Strava-recorded sessions, never typed in by hand, never on a planned
//     rest day; gym is never in a challenge;
//   - a window is 1 to 28 days, and every volume kind has a ceiling.

import { t, fmtNum } from './i18n.js';
import { earnsXp, hasStravaProof, xpForWorkout } from './xp-rules.js';
import { FEAT_RULES } from './feats.js';
import { plannedDaySet, isRestDay } from './rest.js';
import { addDays } from './dates.js';

export const CHALLENGE_RULES = {
  maxParticipants: 5,
  minWindowDays: 1,
  maxWindowDays: 28,
  maxStartAheadDays: 14,   // a challenge starts at most this far ahead…
  graceDays: 2,            // …and is settled this long after its last day (late Strava syncs)
  feeBp: 500,              // 5% of the pot, burned
  payouts: { winner: [100], top2: [65, 35], top3: [50, 30, 20] },
  // stakes (coins only)
  maxStake: 150,
  maxStakeShareBp: 5000,   // at most 50% of your balance on one challenge
  weeklyStakeCap: 300,     // coins staked in any 7 days
  minAccountDays: 14,      // before staking at all
  minVerified: 6,          // Strava sessions that earned XP in the last 30 days
  pairWeek: 1,             // staked challenges shared with the same person in 7 days…
  pairMonth: 3,            // …and in 30
  maxOpenCreated: 2,       // challenges you created that haven't settled
  // the room
  roomCardsPerDay: 3,
  roomOpenMax: 6,
  // ceilings on volume (docs/CHALLENGES.md §2)
  dayCap: { run: 25000, bike: 150000, swim: 5000 },          // metres
  climbDayCap: { run: 1500, bike: 2500 },                    // metres of climbing
  weekFloor: { run: 20000, bike: 100000, swim: 4000 },       // the week ceiling never drops below these
  climbWeekFloor: { run: 1500, bike: 1500 },
  weekGrowthBp: 13000,     // 1.3 × your own weekly average over the 4 weeks before
  // longest: the target can't be set above these (minutes)
  longestMaxMin: { run: 180, bike: 360, swim: 120 },
  // fastest: the distances, in metres
  fastest: { run: { '5k': 5000, '10k': 10000, half: 21097 }, bike: { '20k': 20000, '40k': 40000 }, swim: { '1k': 1000 } },
};

/** The kinds, and the sports each takes ('any' = run, bike or swim, never gym). */
export const KINDS = {
  distance: ['run', 'bike', 'swim'],
  xp: ['any', 'run', 'bike', 'swim'],
  sessions: ['any', 'run', 'bike', 'swim'],
  fastest: ['run', 'bike', 'swim'],
  longest: ['run', 'bike', 'swim'],
  climb: ['bike', 'run'],
  segment: ['run', 'bike'],
};
/** Lower score wins for these. */
export const LOWER_WINS = new Set(['fastest', 'segment']);
/** Machines (treadmill, trainer, e-bike) never count for these. */
const OUTDOOR = new Set(['distance', 'fastest', 'longest', 'climb', 'segment']);
const SPORTS_ANY = ['run', 'bike', 'swim', 'brick'];

/** Suggestions, one tap each; the custom form takes it from there. */
export const TEMPLATES = [
  { id: 'weekend-long', kind: 'longest', sport: 'bike', params: { targetMin: 180 }, days: 2, startDow: 6 },
  { id: 'fast-5k', kind: 'fastest', sport: 'run', params: { dist: '5k' }, days: 7 },
  { id: 'km-week', kind: 'distance', sport: 'run', params: {}, days: 7, startDow: 1 },
  { id: 'consistent', kind: 'sessions', sport: 'any', params: {}, days: 14 },
  { id: 'xp-sprint', kind: 'xp', sport: 'any', params: {}, days: 7 },
  { id: 'climb-month', kind: 'climb', sport: 'bike', params: {}, days: 28 },
  { id: 'segment-king', kind: 'segment', sport: 'bike', params: {}, days: 7 },
];

// ---- one session, as a challenge sees it ----------------------------------------

const A = (w) => w?.actual || {};
// whole metres, so the client and the server add up the same numbers
const distM = (w) => {
  for (const v of [Number(A(w).distanceM), Number(A(w).distanceKm) * 1000, Number(w?.metrics?.distanceKm) * 1000]) if (v > 0) return Math.round(v);
  return 0;
};
const movingSec = (w) => {
  for (const v of [Number(A(w).movingSec), Number(A(w).durationMin) * 60, Number(w?.durationMin) * 60]) if (v > 0) return v;
  return 0;
};
const sportTypeOf = (w) => A(w).sportType || ({ run: 'Run', bike: 'Ride', swim: 'Swim' }[w?.type] ?? null);
const restOf = (w, planned) => (typeof w?.onRestDay === 'boolean' ? w.onRestDay : isRestDay(w?.date, planned));

// the feat bounds (docs/FEATS.md §3): a session a feat would refuse doesn't count here either
function bound(w) {
  const R = FEAT_RULES; const m = distM(w); const mov = movingSec(w); const vmax = Number(A(w).maxSpeedKmh) || 0;
  if (w.type === 'run') {
    if (vmax > R.runMaxSpeedKmh) return true;
    if (m >= 21000 && mov > 0 && (mov / (m / 1000) < R.runFastestSecPerKm || mov / (m / 1000) > R.runSlowestSecPerKm)) return true;
  }
  if (w.type === 'bike') {
    if (vmax > R.bikeMaxSpeedKmh) return true;
    if (m >= 50000 && mov > 0 && m / mov * 3.6 > R.bikeMaxAvgKmh) return true;
  }
  if (w.type === 'swim') {
    if (m > R.swimMaxM) return true;
    if (m >= R.swimFastestMinM && mov > 0 && mov / (m / 100) < R.swimFastestSecPer100) return true;
  }
  return false;
}

/** Does a session count toward challenge `c` at all? */
export function qualifies(c, w, planned) {
  if (!w || w.type === 'gym' || !earnsXp(w) || !hasStravaProof(w) || A(w).manual === true) return false;
  if (String(w.date) < c.starts_on || String(w.date) > c.ends_on) return false;
  if (c.sport === 'any' ? !SPORTS_ANY.includes(w.type) : w.type !== c.sport) return false;
  if (restOf(w, planned)) return false;
  if (OUTDOOR.has(c.kind)) {
    const types = FEAT_RULES.sportTypes[w.type];
    if (!types || A(w).trainer === true || !types.includes(sportTypeOf(w))) return false;
  }
  return !bound(w);
}

// ---- scores ------------------------------------------------------------------------

// the week ceiling: 1.3 × the athlete's own weekly average over the 4 weeks before the window, never below the floor
function weekCeiling(c, workouts, metric, floor) {
  const from = addDays(c.starts_on, -28);
  const before = (workouts || []).filter((w) => w && w.type === c.sport && String(w.date) >= from && String(w.date) < c.starts_on
    && earnsXp(w) && hasStravaProof(w) && A(w).manual !== true);
  const total = before.reduce((n, w) => n + metric(w), 0);
  return Math.max(floor, Math.floor(total * CHALLENGE_RULES.weekGrowthBp / 40000));
}

// day caps, then a cap on each 7-day block of the window
function cappedSum(c, sessions, workouts, metric, dayCap, floor) {
  const byDay = new Map();
  for (const w of sessions) byDay.set(w.date, (byDay.get(w.date) || 0) + metric(w));
  const ceiling = weekCeiling(c, workouts, metric, floor);
  const byWeek = new Map();
  let cut = false;
  for (const [date, v] of byDay) {
    const d = Math.min(dayCap, v);
    if (d < v) cut = true;
    const wk = Math.floor((Date.parse(date) - Date.parse(c.starts_on)) / 864e5 / 7);
    byWeek.set(wk, (byWeek.get(wk) || 0) + d);
  }
  let total = 0;
  for (const v of byWeek.values()) { if (v > ceiling) cut = true; total += Math.min(ceiling, v); }
  return { total, cut, ceiling };
}

/**
 * One athlete's score in challenge `c` from their own workouts:
 * { score, sessions, cut } — score null when no session qualifies (a no-show).
 * Scores are whole numbers in the unit the app shows (10 m, 1 m, 1 XP,
 * 1 session, 1 second), so a GPS wobble is never a win.
 */
export function scoreFor(c, workouts) {
  const ws = (workouts || []).filter(Boolean);
  const planned = plannedDaySet(ws);
  const q = ws.filter((w) => qualifies(c, w, planned));
  if (!q.length) return { score: null, sessions: [], cut: false };
  const R = CHALLENGE_RULES;
  const ids = q.map((w) => w.id);
  if (c.kind === 'distance') {
    const r = cappedSum(c, q, ws, distM, R.dayCap[c.sport], R.weekFloor[c.sport]);
    return { score: Math.round(r.total / 10), sessions: ids, cut: r.cut };
  }
  if (c.kind === 'climb') {
    const elev = (w) => Math.max(0, Math.round(Number(A(w).elevationGainM) || 0));
    const r = cappedSum(c, q, ws, elev, R.climbDayCap[c.sport], R.climbWeekFloor[c.sport]);
    return { score: Math.round(r.total), sessions: ids, cut: r.cut };
  }
  if (c.kind === 'xp') return { score: q.reduce((n, w) => n + xpForWorkout(w), 0), sessions: ids, cut: false };
  if (c.kind === 'sessions') return { score: new Set(q.map((w) => w.date)).size, sessions: ids, cut: false };
  if (c.kind === 'longest') {
    const cap = Math.min(Number(c.params?.targetMin) || 0, R.longestMaxMin[c.sport]) * 60;
    const best = Math.max(...q.map((w) => Math.round(movingSec(w))));
    return { score: Math.min(cap, best), sessions: ids, cut: best > cap };
  }
  if (c.kind === 'fastest') {
    const d = R.fastest[c.sport]?.[c.params?.dist];
    if (!d) return { score: null, sessions: [], cut: false };
    const times = q.map((w) => {
      const be = c.sport === 'run' ? Number(A(w).bestEfforts?.[c.params.dist]) : 0;
      if (be > 0) return { w, sec: be };
      const m = distM(w); const mov = movingSec(w);
      return m >= d && mov > 0 ? { w, sec: Math.round(mov * d / m) } : null;
    }).filter(Boolean);
    if (!times.length) return { score: null, sessions: [], cut: false };
    const best = times.reduce((a, b) => (b.sec < a.sec ? b : a));
    return { score: best.sec, sessions: [best.w.id], cut: false };
  }
  if (c.kind === 'segment') {
    const id = Number(c.params?.segmentId);
    const efforts = q.flatMap((w) => (A(w).segments || []).filter((s) => Number(s.id) === id).map((s) => ({ w, sec: Number(s.sec) })))
      .filter((e) => e.sec > 0);
    if (!efforts.length) return { score: null, sessions: [], cut: false };
    const best = efforts.reduce((a, b) => (b.sec < a.sec ? b : a));
    return { score: best.sec, sessions: [best.w.id], cut: false };
  }
  return { score: null, sessions: [], cut: false };
}

// ---- places and the pot --------------------------------------------------------------

/**
 * Places from scores. `rows`: [{ user, score }] (score null = no-show).
 * Returns rows with `place` (1-based, ties share the place), no-shows last
 * with place null.
 */
export function placesFor(kind, rows) {
  const lower = LOWER_WINS.has(kind);
  const shown = rows.filter((r) => r.score != null)
    .sort((a, b) => (lower ? a.score - b.score : b.score - a.score) || String(a.user).localeCompare(String(b.user)));
  let place = 0; let prev = null;
  const out = shown.map((r, i) => {
    if (prev === null || r.score !== prev) { place = i + 1; prev = r.score; }
    return { ...r, place };
  });
  return [...out, ...rows.filter((r) => r.score == null).map((r) => ({ ...r, place: null }))];
}

/**
 * The pot, worked out (docs/CHALLENGES.md §4b, §5):
 * { pot, fee, prize, payouts: Map user → coins, burned, void }.
 * `stakes`: Map user → coins staked. Paid places beyond the number of people
 * with a session fold into the filled ones in proportion; tied people share
 * the places they cover; a no-show is never paid. Integer coins: each payout
 * is rounded down and the leftover is burned with the fee. Nobody with a
 * session at all: void, every stake comes back, nothing is burned.
 */
export function settle(kind, payout, places, stakes) {
  const pot = [...stakes.values()].reduce((n, v) => n + v, 0);
  const qualifiers = places.filter((r) => r.place != null);
  const payouts = new Map(places.map((r) => [r.user, 0]));
  if (!qualifiers.length) {
    for (const [u, v] of stakes) payouts.set(u, v);
    return { pot, fee: 0, prize: 0, payouts, burned: 0, void: true };
  }
  const fee = Math.floor(pot * CHALLENGE_RULES.feeBp / 10000);
  const prize = pot - fee;
  const P = CHALLENGE_RULES.payouts[payout] || CHALLENGE_RULES.payouts.winner;
  const paid = P.slice(0, Math.min(P.length, qualifiers.length));
  const sumPaid = paid.reduce((n, v) => n + v, 0);
  // group the qualifiers by place; a group at place p covers places p .. p + size - 1
  const groups = new Map();
  for (const r of qualifiers) groups.set(r.place, [...(groups.get(r.place) || []), r.user]);
  for (const [place, users] of groups) {
    const covered = paid.slice(place - 1, place - 1 + users.length).reduce((n, v) => n + v, 0);
    if (!covered) continue;
    const each = Math.floor(prize * covered / (sumPaid * users.length));
    for (const u of users) payouts.set(u, each);
  }
  const out = [...payouts.values()].reduce((n, v) => n + v, 0);
  return { pot, fee, prize, payouts, burned: pot - out, void: false };
}

// ---- the challenge's life ---------------------------------------------------------------

/**
 * Where a challenge is, from its stored state and today's date (the athlete's
 * local date): 'open' | 'running' | 'resolving' | 'settled' | 'cancelled'.
 */
export function phaseOf(c, today) {
  if (c.state === 'settled' || c.state === 'cancelled') return c.state;
  if (today < c.starts_on) return 'open';
  if (today <= c.ends_on) return 'running';
  return 'resolving';
}

/** The day a challenge can be settled (after the grace for late syncs). */
export const settlesOn = (c) => addDays(c.ends_on, CHALLENGE_RULES.graceDays + 1);

/**
 * Is a challenge as written allowed? null, or the reason:
 * 'kind' | 'sport' | 'window' | 'start' | 'stake' | 'payout' | 'dist' | 'target' | 'segment' | 'invitees'
 */
export function checkChallenge(c, today) {
  const R = CHALLENGE_RULES;
  if (!KINDS[c.kind]) return 'kind';
  if (!KINDS[c.kind].includes(c.sport)) return 'sport';
  const days = Math.round((Date.parse(c.ends_on) - Date.parse(c.starts_on)) / 864e5) + 1;
  if (!(days >= R.minWindowDays && days <= R.maxWindowDays)) return 'window';
  if (!(c.starts_on > today && c.starts_on <= addDays(today, R.maxStartAheadDays))) return 'start';
  if (!(Number.isInteger(c.stake) && c.stake >= 0 && c.stake <= R.maxStake)) return 'stake';
  if (!R.payouts[c.payout]) return 'payout';
  if (c.kind === 'fastest' && !R.fastest[c.sport]?.[c.params?.dist]) return 'dist';
  if (c.kind === 'longest') {
    const m = Number(c.params?.targetMin);
    if (!(Number.isInteger(m) && m >= 10 && m <= R.longestMaxMin[c.sport])) return 'target';
  }
  if (c.kind === 'segment' && !(Number(c.params?.segmentId) > 0)) return 'segment';
  if (c.visibility === 'direct' && !(Array.isArray(c.invitees) && c.invitees.length >= 1 && c.invitees.length <= R.maxParticipants - 1)) return 'invitees';
  return null;
}

/**
 * Can this athlete stake on a challenge? null, or why not:
 * 'age' | 'verified' | 'share' | 'week' | 'balance' | 'pair'
 * `me`: { accountDays, verified30, balance, stakedWeek, pairs: Map other → { week, month } }.
 */
export function stakeBlock(stake, me, others = []) {
  if (!(stake > 0)) return null;
  const R = CHALLENGE_RULES;
  if (me.accountDays < R.minAccountDays) return 'age';
  if (me.verified30 < R.minVerified) return 'verified';
  if (stake > me.balance) return 'balance';
  if (stake * 10000 > me.balance * R.maxStakeShareBp) return 'share';
  if (me.stakedWeek + stake > R.weeklyStakeCap) return 'week';
  for (const o of others) {
    const p = me.pairs?.get(o);
    if (p && (p.week >= R.pairWeek || p.month >= R.pairMonth)) return 'pair';
  }
  return null;
}

/** A Strava segment id from a link or a bare number, or null. */
export function segmentIdFrom(text) {
  const m = String(text || '').match(/(?:segments\/)?(\d{3,12})\b/);
  return m ? Number(m[1]) : null;
}

/** The rule in plain words: "Most running kilometres, Mon 3 – Sun 9 Nov, Strava only · top 3 paid 50/30/20". */
export function ruleText(c, fmtDay) {
  const what = t(`ch.rule.${c.kind}`, {
    sport: t(`ch.sportWord.${c.sport}`),
    dist: c.params?.dist ? t(`ch.dist.${c.params.dist}`) : '',
    target: c.params?.targetMin ? t('ch.minutes', { n: fmtNum(c.params.targetMin) }) : '',
    segment: c.params?.segmentName || (c.params?.segmentId ? `#${c.params.segmentId}` : ''),
  });
  const when = c.starts_on === c.ends_on ? fmtDay(c.starts_on) : `${fmtDay(c.starts_on)} – ${fmtDay(c.ends_on)}`;
  const pay = c.payout === 'winner' ? t('ch.payWinner') : t('ch.payPlaces', { split: CHALLENGE_RULES.payouts[c.payout].join('/') });
  return t('ch.ruleLine', { what, when, pay });
}
