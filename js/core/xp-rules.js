// xp-rules.js — who earns XP, how much, and why not. Pure; no DOM.
//
// Two honest paths, written down in docs/XP.md:
//   - Strava proof: a session linked to a Strava activity earns its XP, plus
//     a modest bonus (PROOF_BONUS) for being verified. Any sport.
//   - Logged in the app: a gym session ticked set by set in the logger earns
//     XP when the log looks like a real session (gymVerdict): enough working
//     sets, ticked over a believable stretch of time, and a duration that fits
//     the log. Gym XP from the app is capped per day (GYM.dailyCap).
// Everything else (a run marked done without Strava, say) earns nothing.
//
// The server applies the same rules (supabase/migrations/0013_gym_integrity.sql:
// gym_reason, session_xp, the leaderboard's daily cap, claim_quest), so the
// number on your Profile and the one on the leaderboard agree.

/** The plausibility rules start here; gym sessions dated before keep the old rule. */
export const GYM_RULES_SINCE = '2026-10-16';

export const GYM = {
  minSets: 3,          // ticked working sets (warm-ups don't count)
  minSpanSec: 300,     // first tick to last tick, at least 5 minutes…
  secPerSet: 20,       // …and at least 20 s per set after the first
  maxSpanSec: 4 * 3600, // a session spread over more than 4 hours isn't one session
  slackMin: 20,        // minutes allowed beyond the ticked span (warm-up, the last set, cool-down)
  minMinutes: 10,      // shorter than this counts for nothing
  maxMinutes: 180,     // the most one gym session can count for
  dailyCap: 150,       // gym XP from the app per day
};

/** Strava-verified sessions earn this much more. */
export const PROOF_BONUS = 1.1;

export const TYPE_FACTOR = { run: 1.1, bike: 1.0, swim: 1.2, gym: 1.0, brick: 1.35, mobility: 0.6, other: 1.0 };
export const INTENSITY_FACTOR = { easy: 1.0, steady: 1.1, moderate: 1.15, threshold: 1.3, quality: 1.35, vo2: 1.45, race: 1.6 };

/** Strava proof: an activity id, or a session imported from Strava. */
export const hasStravaProof = (w) => !!(w && (w.strava_activity_id || w.source === 'strava'));

/** Which path a session is on: 'strava', 'app' (a gym log) or null. */
export function proofOf(w) {
  if (!w) return null;
  if (hasStravaProof(w)) return 'strava';
  if (w.type === 'gym' && w.gymLoggedAt) return 'app';
  return null;
}

const ts = (s) => {
  const t = Date.parse(s?.doneAt);
  return Number.isFinite(t) ? t : null;
};

/**
 * Does a gym log look like a real session? Returns { ok: true, minutes } with
 * the minutes it counts for, or { ok: false, reason } where reason is one of
 * 'sets' | 'timestamps' | 'tooFast' | 'tooLong' | 'short'.
 * Only app-logged gym sessions are judged; anything else is { ok: true }.
 */
export function gymVerdict(w) {
  const planned = Math.max(0, Number(w?.durationMin) || 0);
  if (proofOf(w) !== 'app') return { ok: true, minutes: planned };
  if (String(w.date || '') < GYM_RULES_SINCE) return { ok: true, minutes: planned };
  const work = (w.exercises || []).flatMap((e) => (Array.isArray(e?.sets) ? e.sets : []))
    .filter((s) => s && s.done && s.kind !== 'warmup');
  if (work.length < GYM.minSets) return { ok: false, reason: 'sets' };
  const times = work.map(ts);
  if (times.some((x) => x == null)) return { ok: false, reason: 'timestamps' };
  const span = (Math.max(...times) - Math.min(...times)) / 1000;
  if (span < Math.max(GYM.minSpanSec, (work.length - 1) * GYM.secPerSet)) return { ok: false, reason: 'tooFast' };
  if (span > GYM.maxSpanSec) return { ok: false, reason: 'tooLong' };
  const minutes = Math.min(planned || Infinity, Math.ceil(span / 60) + GYM.slackMin, GYM.maxMinutes);
  if (minutes < GYM.minMinutes) return { ok: false, reason: 'short' };
  return { ok: true, minutes };
}

/** Does this session earn XP at all? */
export const earnsXp = (w) => !!(w && w.completed && proofOf(w) && gymVerdict(w).ok);

/** The XP a session is worth on its own (before the daily gym cap). */
export function xpForWorkout(w) {
  const v = gymVerdict(w);
  const dur = v.ok ? v.minutes : Math.max(0, Number(w?.durationMin) || 0);
  const tf = TYPE_FACTOR[w?.type] ?? 1.0;
  const inf = INTENSITY_FACTOR[w?.intensity] ?? 1.0;
  // a small distance bonus so long endurance days feel rewarding
  const km = Math.max(0, Number(w?.metrics?.distanceKm) || 0);
  const base = dur * tf * inf + km * 1.5;
  return Math.round(base * (hasStravaProof(w) ? PROOF_BONUS : 1));
}

/** The order sessions are taken in within a day: by date, then when they were finished, then id. */
export const ledgerOrder = (a, b) => String(a.date).localeCompare(String(b.date))
  || String(a.completedAt || a.gymLoggedAt || '').localeCompare(String(b.completedAt || b.gymLoggedAt || ''))
  || String(a.id).localeCompare(String(b.id));

/**
 * Every session that earns XP with the XP it actually counts for, after the
 * daily cap on app-logged gym XP: [{ w, xp, capped }]. Sessions on one day are
 * taken in the order they were finished, so the cap trims the last ones.
 */
export function xpLedger(workouts) {
  const earning = (workouts || []).filter(earnsXp);
  const order = [...earning].sort(ledgerOrder);
  const used = new Map();
  const out = new Map();
  for (const w of order) {
    let xp = xpForWorkout(w);
    let capped = false;
    if (proofOf(w) === 'app') {
      const before = used.get(w.date) || 0;
      const left = Math.max(0, GYM.dailyCap - before);
      if (xp > left) { xp = left; capped = true; }
      used.set(w.date, before + xp);
    }
    out.set(w, { w, xp, capped });
  }
  return earning.map((w) => out.get(w));
}

/** What a session counts for, and why not when it doesn't: { xp, reason, capped }. */
export function xpStatus(w, workouts) {
  if (!w?.completed) return { xp: 0, reason: null, capped: false };
  if (!proofOf(w)) return { xp: 0, reason: 'proof', capped: false };
  const v = gymVerdict(w);
  if (!v.ok) return { xp: 0, reason: v.reason, capped: false };
  const row = xpLedger(workouts && workouts.includes(w) ? workouts : [...(workouts || []), w]).find((r) => r.w === w);
  return { xp: row?.xp ?? 0, reason: row?.capped ? 'cap' : null, capped: !!row?.capped };
}
