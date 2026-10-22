// boosts.js — what gear and gels add to a session's XP. Pure.
//
// A session is boosted by the gear owned and the gel active *when it was
// done*, never by what you own now: buying wheels today doesn't touch last
// March. The server works this out once, the first time a session earns, and
// stamps it on the row (workouts.boost = { gear_bp, gel_bp }, see
// 0014_gear.sql). When a session carries that stamp it's used as is; the
// maths here gives the same answer for instant feedback before the round trip.
//
// All in basis points (100 = +1%) so JS and SQL agree to the unit:
//   total = round(base × (10000 + gear_bp) × (10000 + gel_bp) / 10^8)
// Boosts are for your own levels and scenes only. Ranks uses base XP.

import { SLOTS, GEAR_RULES, ownedTier } from './gear.js';
import { earnsXp, xpLedger, proofOf } from './xp-rules.js';

const ms = (s) => {
  const x = Date.parse(s);
  return Number.isFinite(x) ? x : null;
};

/**
 * A discipline's gear boost in basis points, from the gear owned at `at`
 * (default: everything owned). A brick gets the average of bike and run,
 * rounded down; mobility and other get none.
 */
export function gearBoost(inventory, sport, at = null) {
  if (sport === 'brick') return Math.floor((gearBoost(inventory, 'bike', at) + gearBoost(inventory, 'run', at)) / 2);
  const slots = SLOTS[sport];
  if (!slots) return 0;
  const sum = slots.reduce((n, slot) => n + GEAR_RULES.tierBoostBp[ownedTier(inventory, sport, slot, at)], 0);
  return Math.min(GEAR_RULES.sportCapBp, sum);
}

/** The gel running at `at` (ms or ISO), or null. `boosts` are user_boosts rows. */
export function activeGel(boosts, at) {
  const t = typeof at === 'number' ? at : ms(at);
  if (t == null) return null;
  return (boosts || []).find((b) => b?.kind === 'gel' && ms(b.started_at) <= t && t < ms(b.expires_at)) || null;
}

/** Gels used in the rolling window ending at `at`. */
export function gelsUsedRecently(boosts, at) {
  const t = typeof at === 'number' ? at : ms(at);
  const from = t - GEAR_RULES.gel.windowDays * 864e5;
  return (boosts || []).filter((b) => b?.kind === 'gel' && ms(b.started_at) > from && ms(b.started_at) <= t).length;
}

/** Can a gel be used at `at`? { ok } or { ok: false, reason: 'active' | 'limit' | 'none' }. */
export function canUseGel(boosts, held, at) {
  if (activeGel(boosts, at)) return { ok: false, reason: 'active' };
  if (gelsUsedRecently(boosts, at) >= GEAR_RULES.gel.perWindow) return { ok: false, reason: 'limit' };
  if (!(held > 0)) return { ok: false, reason: 'none' };
  return { ok: true };
}

/**
 * When a session happened, as [startMs, endMs] (UTC instants), or null.
 *   - Strava: the activity's UTC start plus its elapsed time (actual.startUtc / elapsedSec)
 *   - a gym log: first tick to last tick
 *   - otherwise: back from completedAt by the duration
 */
export function sessionSpan(w) {
  if (!w) return null;
  const durMs = Math.max(0, Number(w.durationMin) || 0) * 60e3;
  const start = ms(w.actual?.startUtc);
  if (start != null) {
    const el = Number(w.actual?.elapsedSec);
    return [start, start + (Number.isFinite(el) && el > 0 ? el * 1e3 : durMs)];
  }
  if (proofOf(w) === 'app') {
    const ticks = (w.exercises || []).flatMap((e) => (Array.isArray(e?.sets) ? e.sets : []))
      .filter((s) => s && s.done && s.kind !== 'warmup').map((s) => ms(s.doneAt)).filter((x) => x != null);
    if (ticks.length) return [Math.min(...ticks), Math.max(...ticks)];
  }
  const end = ms(w.completedAt);
  return end == null ? null : [end - durMs, end];
}

/** The gel's share of a session, in basis points: boostBp × (time inside the window ÷ session time). */
export function gelShare(gel, span) {
  if (!gel || !span) return 0;
  const [s, e] = span;
  const bp = Math.round((Number(gel.multiplier) - 1) * 10000) || GEAR_RULES.gel.boostBp;
  if (e <= s) return s >= ms(gel.started_at) && s < ms(gel.expires_at) ? bp : 0;
  const inside = Math.max(0, Math.min(e, ms(gel.expires_at)) - Math.max(s, ms(gel.started_at)));
  return Math.round(bp * inside / (e - s));
}

/**
 * The stamp a session gets: { gear_bp, gel_bp }. The server's stamp when the
 * session has one; otherwise worked out from the gear owned at the end of the
 * session and the gel window it overlaps.
 */
export function boostStamp(w, inventory, boosts) {
  if (w?.boost && Number.isFinite(Number(w.boost.gear_bp))) {
    return { gear_bp: Number(w.boost.gear_bp) || 0, gel_bp: Number(w.boost.gel_bp) || 0 };
  }
  const span = sessionSpan(w);
  const end = span ? span[1] : null;
  const gear_bp = end == null ? 0 : gearBoost(inventory, w?.type, new Date(end).toISOString());
  // a long session can run across two back-to-back gels; it never gets more than one gel's worth
  const gel = span ? (boosts || []).filter((b) => b?.kind === 'gel').reduce((n, b) => n + gelShare(b, span), 0) : 0;
  return { gear_bp, gel_bp: Math.min(GEAR_RULES.gel.boostBp, gel) };
}

/** Split a base XP into { base, gear, gel, total } under a stamp. */
export function applyBoost(base, stamp) {
  const b = Math.max(0, Math.round(Number(base) || 0));
  const g = Number(stamp?.gear_bp) || 0;
  const l = Number(stamp?.gel_bp) || 0;
  const withGear = Math.round(b * (10000 + g) / 10000);
  const total = Math.round(b * (10000 + g) * (10000 + l) / 1e8);
  return { base: b, gear: withGear - b, gel: total - withGear, total };
}

/**
 * What a session counts for on your own levels: { base, gear, gel, total }.
 * `base` defaults to the session's XP on its own; pass the ledger value when
 * the gym daily cap applies.
 */
export function boostFor(w, inventory, boosts, base = null) {
  const b = base ?? (earnsXp(w) ? xpLedger([w])[0]?.xp || 0 : 0);
  return applyBoost(b, boostStamp(w, inventory, boosts));
}

/** Every earning session with its boosted XP, after the gym cap: [{ w, base, gear, gel, total }]. */
export function boostedLedger(workouts, inventory, boosts) {
  return xpLedger(workouts).map(({ w, xp }) => ({ w, ...boostFor(w, inventory, boosts, xp) }));
}

/** Boosted XP per discipline type: { bike, run, … }. Your own Profile only; never Ranks. */
export function boostedSportXp(workouts, inventory, boosts) {
  const out = {};
  for (const r of boostedLedger(workouts, inventory, boosts)) out[r.w.type] = (out[r.w.type] || 0) + r.total;
  return out;
}
