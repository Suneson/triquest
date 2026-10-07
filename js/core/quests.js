// quests.js — daily quests and the account level. Pure: everything is derived
// from the workout list (plus `settings` for the packing presets), so every
// device computes the same quests and the same XP with nothing extra stored.
//
// Training quests complete only from VERIFIED sessions: completed AND linked to
// a Strava activity. That is stricter than XP's `completed`, because an
// imported JSON file can mark sessions completed and must not earn quests.
//
// The pool is append-only. Each quest carries a `since` date and never applies
// before it, so adding quests later never re-rolls or re-scores past days.

import { addDays, diffDays } from './dates.js';
import { levelFromTotalXp, xpForWorkout } from './scoring.js';

/** First day quests exist. Days before it earn no quest XP. */
export const QUESTS_SINCE = '2026-10-05';
export const QUESTS_PER_DAY = 3;

export const isVerified = (w) => !!(w && w.completed && (w.strava_activity_id || w.source === 'strava'));

const minutesOf = (w) => Math.max(0, Number(w.actual?.durationMin ?? w.durationMin) || 0);
const kmOf = (w) => Math.max(0, Number(w.actual?.distanceKm ?? w.metrics?.distanceKm) || 0);
const DISTANCE_TYPES = new Set(['run', 'bike', 'swim', 'brick']);

export const QUEST_POOL = [
  {
    id: 'plan-done', kind: 'training', xp: 40, since: QUESTS_SINCE,
    text: "Finish today's planned session",
    eligible: (d) => d.planned.length > 0,
    done: (d) => d.planned.some(isVerified),
  },
  {
    id: 'min-45', kind: 'training', xp: 30, since: QUESTS_SINCE,
    text: 'Train 45+ minutes today',
    eligible: () => true,
    done: (d) => d.verified.reduce((a, w) => a + minutesOf(w), 0) >= 45,
  },
  {
    id: 'two-disc', kind: 'training', xp: 50, since: QUESTS_SINCE,
    text: 'Two disciplines in one day',
    eligible: (d) => new Set(d.planned.map((w) => w.type)).size >= 2,
    done: (d) => new Set(d.verified.map((w) => w.type)).size >= 2,
  },
  {
    id: 'streak', kind: 'training', xp: 30, since: QUESTS_SINCE,
    text: 'Keep the streak alive',
    eligible: (d) => d.yesterdayVerified.length > 0,
    done: (d) => d.verified.length > 0,
  },
  {
    id: 'km-10', kind: 'training', xp: 30, since: QUESTS_SINCE,
    text: 'Cover 10 km today',
    eligible: (d) => d.planned.some((w) => DISTANCE_TYPES.has(w.type)),
    done: (d) => d.verified.reduce((a, w) => a + kmOf(w), 0) >= 10,
  },
  {
    id: 'brick', kind: 'training', xp: 50, since: QUESTS_SINCE,
    text: 'Nail the brick session',
    eligible: (d) => d.planned.some((w) => w.type === 'brick'),
    done: (d) => d.verified.some((w) => w.type === 'brick'),
  },
  {
    id: 'pack-bag', kind: 'app', xp: 10, since: QUESTS_SINCE,
    text: "Pack tomorrow's bag",
    eligible: (d) => d.tomorrowPackable.length > 0,
    done: (d) => d.tomorrowPackable.length > 0 && d.tomorrowPackable.every(({ w, preset }) => {
      const packed = new Set(w.packed || []);
      return preset.every((item) => packed.has(item));
    }),
  },
];

// ---- deterministic daily pick ------------------------------------------------

/** FNV-1a 32-bit hash of a string. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 PRNG → function returning floats in [0, 1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Group workouts by date once, so whole-history scans stay linear. */
export function indexByDate(workouts) {
  const m = new Map();
  for (const w of workouts || []) {
    if (!w?.date) continue;
    if (!m.has(w.date)) m.set(w.date, []);
    m.get(w.date).push(w);
  }
  return m;
}

/** Everything a quest needs to judge one day. */
export function dayContext(date, byDate, settings) {
  const on = (iso) => byDate.get(iso) || [];
  const today = on(date);
  const tomorrow = on(addDays(date, 1));
  const presets = settings?.packing || {};
  return {
    date,
    all: today,
    planned: today.filter((w) => w.source !== 'strava'),
    verified: today.filter(isVerified),
    yesterdayVerified: on(addDays(date, -1)).filter(isVerified),
    tomorrowPackable: tomorrow
      .map((w) => ({ w, preset: presets[w.type] || [] }))
      .filter((x) => x.preset.length > 0),
  };
}

/**
 * The day's quests: up to three, picked by a PRNG seeded from the date, with
 * at most one app-action quest. Same date + same plan → same quests anywhere.
 * @returns {Array<{id, kind, text, xp, done}>}
 */
export function questsFor(date, workouts, settings, byDate = indexByDate(workouts)) {
  const d = dayContext(date, byDate, settings);
  const order = shuffled(QUEST_POOL, seededRandom(hashString(`moske-quests:${date}`)));
  const out = [];
  let apps = 0;
  for (const q of order) {
    if (out.length >= QUESTS_PER_DAY) break;
    if (date < q.since || !q.eligible(d)) continue;
    if (q.kind === 'app') { if (apps >= 1) continue; apps++; }
    out.push({ id: q.id, kind: q.kind, text: q.text, xp: q.xp, done: !!q.done(d) });
  }
  return out;
}

/** Quest XP earned from QUESTS_SINCE (or the first workout) through `today`. */
export function questXpThrough(today, workouts, settings) {
  const byDate = indexByDate(workouts);
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return 0;
  let cur = dates[0] > QUESTS_SINCE ? dates[0] : QUESTS_SINCE;
  let xp = 0;
  // a quest can only be done on a day with a verified session or tomorrow's
  // bag packed, so days with no workouts either side are skipped cheaply
  while (diffDays(cur, today) <= 0) {
    if (byDate.has(cur) || byDate.has(addDays(cur, 1))) {
      for (const q of questsFor(cur, workouts, settings, byDate)) if (q.done) xp += q.xp;
    }
    cur = addDays(cur, 1);
  }
  return xp;
}

/** Training XP from completed sessions (same rule as computeStats). */
export function trainingXp(workouts) {
  return (workouts || []).reduce((a, w) => a + (w.completed ? xpForWorkout(w) : 0), 0);
}

/** The account level: training XP + quest XP on the shared level curve.
 *  Separate from the per-sport levels that drive the Profile scenes. */
export function accountProgress(workouts, settings, today) {
  const training = trainingXp(workouts);
  const quests = questXpThrough(today, workouts, settings);
  return { ...levelFromTotalXp(training + quests), trainingXp: training, questXp: quests };
}

/** Milliseconds until the next local midnight (the quest reset). */
export function msUntilReset(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

/** 'HH:MM' countdown label. */
export function formatCountdown(ms) {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
