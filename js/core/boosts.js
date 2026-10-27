// boosts.js — what gear and gels add to a session's XP. Pure.
//
// A session is boosted by the gear owned and the food running *when it was
// done*, plus a gel taken for it (a gel waits for your next workout), never
// by what you own now: buying wheels today doesn't touch last
// March. The server works this out once, the first time a session earns, and
// stamps it on the row (workouts.boost = { gear_bp, gel_bp }, see
// 0014_gear.sql). When a session carries that stamp it's used as is; the
// maths here gives the same answer for instant feedback before the round trip.
//
// All in basis points (100 = +1%) so JS and SQL agree to the unit:
//   total = round(base × (10000 + gear_bp) × (10000 + gel_bp) / 10^8)
// Boosts are for your own levels and scenes only. Ranks uses base XP.

import { SLOTS, GEAR_RULES, ownedTier } from './gear.js';
import { PRESTIGE } from './collections.js';
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
  return Math.min(GEAR_RULES.sportCapBp, sum) + starBp(inventory, sport, at);
}

/**
 * Prestige stars (docs/LOOP.md §4.3) ride in the inventory as
 * `prestige:<sport>:<n>` rows from the moment they were taken; each adds
 * PRESTIGE.bonusBp on top of the gear cap.
 */
export const starRow = (sport, star, at) => ({ item_id: `prestige:${sport}:${star}`, acquired_at: at });
function starBp(inventory, sport, at) {
  const atMs = at == null ? Infinity : ms(at);
  const n = (inventory || []).filter((r) => String(r?.item_id || '').startsWith(`prestige:${sport}:`)
    && (atMs === Infinity || (ms(r.acquired_at) ?? Infinity) <= atMs)).length;
  return n * PRESTIGE.bonusBp;
}

const FUEL = GEAR_RULES.fuel.items;
const isFuel = (b) => !!(b && FUEL[b.kind]);
/** A gel waiting for your next workout (taken, not yet used up by a session). */
export const isWaiting = (b) => !!(isFuel(b) && b.until_next && !b.workout_id);
/** Food on a clock (the boost windows that are prorated). */
const isTimed = (b) => isFuel(b) && !b.until_next;
// a waiting gel's end is 'infinity' on the server: it runs until a workout uses it
const endOf = (b) => (isWaiting(b) ? Infinity : ms(b.expires_at));
/** A fuel's boost in basis points. */
export const fuelBp = (b) => Math.round((Number(b?.multiplier) - 1) * 10000) || FUEL[b?.kind]?.boostBp || 0;
/** The largest fuel boost: a session never gets more than one fuel's worth. */
const FUEL_CAP_BP = Math.max(...Object.values(FUEL).map((f) => f.boostBp));

/** The fuel on at `at` (ms or ISO): food running, or a gel waiting for your next workout; or null. One at a time. */
export function activeFuel(boosts, at) {
  const t = typeof at === 'number' ? at : ms(at);
  if (t == null) return null;
  return (boosts || []).find((b) => isFuel(b) && ms(b.started_at) <= t && t < endOf(b)) || null;
}
/** The gel running at `at`, or null. */
export const activeGel = (boosts, at) => {
  const f = activeFuel(boosts, at);
  return f?.kind === 'gel' ? f : null;
};

/** Fuel of one kind used in the rolling window ending at `at`. */
export function fuelUsedRecently(boosts, kind, at) {
  const t = typeof at === 'number' ? at : ms(at);
  const from = t - GEAR_RULES.fuel.windowDays * 864e5;
  return (boosts || []).filter((b) => b?.kind === kind && ms(b.started_at) > from && ms(b.started_at) <= t).length;
}
export const gelsUsedRecently = (boosts, at) => fuelUsedRecently(boosts, 'gel', at);

/** Can this fuel be used at `at`? { ok } or { ok: false, reason: 'active' | 'limit' | 'none' }. */
export function canUseFuel(kind, boosts, held, at) {
  if (activeFuel(boosts, at)) return { ok: false, reason: 'active' };
  if (fuelUsedRecently(boosts, kind, at) >= (FUEL[kind]?.perWindow ?? 0)) return { ok: false, reason: 'limit' };
  if (!(held > 0)) return { ok: false, reason: 'none' };
  return { ok: true };
}
export const canUseGel = (boosts, held, at) => canUseFuel('gel', boosts, held, at);

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

/** Food's share of a session, in basis points: boostBp × (time inside the window ÷ session time). A gel has none: it goes to one workout whole. */
export function gelShare(gel, span) {
  if (!gel || !span || !isTimed(gel)) return 0;
  const [s, e] = span;
  const bp = fuelBp(gel);
  if (e <= s) return s >= ms(gel.started_at) && s < ms(gel.expires_at) ? bp : 0;
  const inside = Math.max(0, Math.min(e, ms(gel.expires_at)) - Math.max(s, ms(gel.started_at)));
  return Math.round(bp * inside / (e - s));
}

/** Can a waiting gel go to a session that ended at `end` (ms)? Only one that ended after, or at most graceHours before, it was taken. */
const gelFits = (b, end) => end != null && end >= ms(b.started_at) - GEAR_RULES.fuel.graceHours * 3600e3;

/**
 * Which session each waiting gel goes to, before the server has said: the
 * first unstamped earning session (in the order they finished) that fits it.
 * Map of workout id → the gel. The server does the same when the session
 * reaches it, and from then on the session's stamp says so.
 */
export function gelClaims(workouts, boosts) {
  const out = new Map();
  const waiting = (boosts || []).filter(isWaiting).sort((a, b) => ms(a.started_at) - ms(b.started_at));
  if (!waiting.length) return out;
  const open = (workouts || []).filter((w) => !(w?.boost && Number.isFinite(Number(w.boost.gear_bp))) && earnsXp(w))
    .map((w) => ({ w, end: sessionSpan(w)?.[1] ?? null }))
    .sort((a, b) => (a.end ?? 0) - (b.end ?? 0));
  for (const g of waiting) {
    const hit = open.find((x) => !out.has(x.w.id) && gelFits(g, x.end));
    if (hit) out.set(hit.w.id, g);
  }
  return out;
}

/**
 * The stamp a session gets: { gear_bp, gel_bp }. The server's stamp when the
 * session has one; otherwise worked out from the gear owned at the end of the
 * session, the food windows it overlaps, and a waiting gel: `claims` (from
 * gelClaims) when several sessions are being worked out together, else the
 * first waiting gel that fits this one.
 */
export function boostStamp(w, inventory, boosts, claims = null) {
  if (w?.boost && Number.isFinite(Number(w.boost.gear_bp))) {
    return { gear_bp: Number(w.boost.gear_bp) || 0, gel_bp: Number(w.boost.gel_bp) || 0 };
  }
  const span = sessionSpan(w);
  const end = span ? span[1] : null;
  const gear_bp = end == null ? 0 : gearBoost(inventory, w?.type, new Date(end).toISOString());
  // a long session can run across two back-to-back foods; it never gets more than the biggest fuel's worth
  const food = span ? (boosts || []).reduce((n, b) => n + gelShare(b, span), 0) : 0;
  const gel = claims ? claims.get(w?.id) : (boosts || []).filter(isWaiting).find((b) => gelFits(b, end));
  return { gear_bp, gel_bp: Math.min(FUEL_CAP_BP, food + (gel ? fuelBp(gel) : 0)) };
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
export function boostFor(w, inventory, boosts, base = null, claims = null) {
  const b = base ?? (earnsXp(w) ? xpLedger([w])[0]?.xp || 0 : 0);
  return applyBoost(b, boostStamp(w, inventory, boosts, claims));
}

/** Every earning session with its boosted XP, after the gym cap: [{ w, base, gear, gel, total }]. */
export function boostedLedger(workouts, inventory, boosts) {
  const claims = gelClaims(workouts, boosts);
  return xpLedger(workouts).map(({ w, xp }) => ({ w, ...boostFor(w, inventory, boosts, xp, claims) }));
}

/** Boosted XP per discipline type: { bike, run, … }. Your own Profile only; never Ranks. */
export function boostedSportXp(workouts, inventory, boosts) {
  const out = {};
  for (const r of boostedLedger(workouts, inventory, boosts)) out[r.w.type] = (out[r.w.type] || 0) + r.total;
  return out;
}
