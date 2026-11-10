// drills.js — training and recovering in the base (docs/DRILLS.md). Pure: no DOM, no clock of its own.
//
// A drill is a session on a machine in your base: tap the treadmill, pick a level, press Start,
// and your athlete runs it in real time. (The app's "workouts" are your real training; a drill is
// the game's.) It drains stamina steadily while it runs:
//  - enough stamina for the whole drill: it's completed, and the next level of that machine opens;
//  - not enough: stamina reaches zero part way, the drill fails there, and nothing opens.
// A level's cost comes down with `efficiency` (0 to 1): better machines now, shoes, outfits and
// skill points later. The top levels cost more than a full bar, so they can't be done without it.
//
// Recovery tools give stamina back faster than waiting: each takes longer than the last and gives
// more. One thing at a time: you can't recover during a drill, or train in the ice bath.
//
// What's kept (settings.drills):
//   { levels: { run: 3 },                   the highest level open on each machine
//     active: { kind, level, startedAt, endAt, cost, from } | null,   the drill being run
//     recovering: { tool, startedAt, endAt, gain } | null,
//     result: { kind, level, ok, km, at } | { tool, gain, at } | null }   what to tell you next time you look
// Stamina itself is js/core/stamina.js's anchor: `settle` hands back the new one when something ends.

import { STAMINA, staminaAt, staminaSet } from './stamina.js';

const MIN = 60e3;

/**
 * The machines and their levels. `km` and `min` are what the level says on the card; `min` is
 * also how long it takes (real minutes). `cost`: stamina with no efficiency. `pace`: the level is
 * a time to beat, not just a distance. `clip`: what the athlete plays (js/core/wardrobe.js CLIPS).
 */
export const DRILLS = {
  run: {
    station: 'treadmill', room: 'run',
    levels: [
      { km: 1, min: 6, cost: 10, clip: 'run-slow' },
      { km: 3, min: 18, cost: 30, clip: 'run-slow' },
      { km: 5, min: 30, cost: 48, clip: 'run' },
      { km: 5, min: 25, cost: 60, clip: 'run', pace: true },
      { km: 8, min: 44, cost: 75, clip: 'run' },
      { km: 10, min: 55, cost: 90, clip: 'run' },
      { km: 5, min: 20, cost: 100, clip: 'run-fast', pace: true },
      { km: 15, min: 80, cost: 115, clip: 'run' },
      { km: 21.1, min: 110, cost: 135, clip: 'run' },
      { km: 42.2, min: 210, cost: 170, clip: 'run' },
    ],
  },
};
export const DRILL_KINDS = Object.keys(DRILLS);

/** Which machine starts which drill, by item id (js/core/placement.js). */
export const drillOfItem = (itemId) => DRILL_KINDS.find((k) => itemId === DRILLS[k].station || String(itemId).startsWith(`${DRILLS[k].station}-t`)) || null;

/**
 * Recovery tools, quickest first: `min` real minutes, `gain` stamina. `item`: the base item that
 * starts it (null: not in the game yet).
 */
export const RECOVERY = {
  'massage-gun': { min: 5, gain: 8, item: null },
  'ice-bath': { min: 10, gain: 15, item: 'ice-bath' },
  sauna: { min: 20, gain: 28, item: null },
  'compression-boots': { min: 40, gain: 50, item: null },
};
export const recoveryOfItem = (itemId) => Object.keys(RECOVERY).find((k) => RECOVERY[k].item === itemId) || null;

/** How much less a drill costs with a better treadmill (its tier, 1 to 4, from the run room's level). */
export const MACHINE_EFFICIENCY = [0, 0.05, 0.1, 0.15];

/** Efficiency from everything that gives it, capped. `machineTier`: 1 to 4. */
export function efficiency({ machineTier = 1, extra = 0 } = {}) {
  const tier = Math.max(1, Math.min(MACHINE_EFFICIENCY.length, Math.floor(machineTier) || 1));
  return Math.max(0, Math.min(0.6, MACHINE_EFFICIENCY[tier - 1] + (Number(extra) || 0)));
}

export const emptyDrills = () => ({ levels: {}, active: null, recovering: null, result: null });

/** Saved drills, checked: anything broken goes back to empty. */
export function normaliseDrills(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = emptyDrills();
  for (const k of DRILL_KINDS) out.levels[k] = Math.max(1, Math.min(DRILLS[k].levels.length, Math.floor(Number(r.levels?.[k]) || 1)));
  const a = r.active;
  if (a && DRILLS[a.kind]?.levels[a.level - 1] && Number.isFinite(a.startedAt) && a.endAt > a.startedAt && a.cost >= 0 && a.from >= 0) out.active = { kind: a.kind, level: a.level, startedAt: a.startedAt, endAt: a.endAt, cost: a.cost, from: a.from };
  const c = r.recovering;
  if (c && RECOVERY[c.tool] && Number.isFinite(c.startedAt) && c.endAt > c.startedAt) out.recovering = { tool: c.tool, startedAt: c.startedAt, endAt: c.endAt, gain: Number(c.gain) || 0 };
  if (r.result && typeof r.result === 'object' && Number.isFinite(r.result.at)) out.result = { ...r.result };
  return out;
}

/** The highest level open on a machine (1 to begin with). */
export const levelOpen = (drills, kind) => Math.max(1, drills?.levels?.[kind] || 1);

/** A level's card: { level, km, min, pace, clip, cost } with `eff` taken off the cost. Null when there's no such level. */
export function drillLevel(kind, level, eff = 0) {
  const l = DRILLS[kind]?.levels[level - 1];
  if (!l) return null;
  return { level, km: l.km, min: l.min, pace: !!l.pace, clip: l.clip, cost: Math.max(1, Math.round(l.cost * (1 - eff))) };
}

/**
 * What would happen if you started this level with `stamina`: does it finish, and if not, how far
 * you'd get before the bar is empty.
 * @returns {{ ok: boolean, km: number, min: number }} the distance and minutes you'd last
 */
export function forecast(kind, level, stamina, eff = 0) {
  const l = drillLevel(kind, level, eff);
  if (!l) return { ok: false, km: 0, min: 0 };
  const share = Math.min(1, Math.max(0, stamina) / l.cost);
  return { ok: share >= 1, km: l.km * share, min: l.min * share };
}

/**
 * Start a drill. Refused: `busy` (a drill or a recovery is running), `locked` (the level isn't
 * open), `empty` (no stamina at all).
 * @returns {{ drills } | { error: string }}
 */
export function startDrill(drills, kind, level, { stamina, now, eff = 0 }) {
  if (drills.active || drills.recovering) return { error: 'busy' };
  const l = drillLevel(kind, level, eff);
  if (!l || level > levelOpen(drills, kind)) return { error: 'locked' };
  if (stamina <= 0) return { error: 'empty' };
  return { drills: { ...drills, result: null, active: { kind, level, startedAt: now, endAt: now + l.min * MIN, cost: l.cost, from: Math.floor(stamina) } } };
}

/**
 * A running drill at `now`.
 * @returns {{ share, km, stamina, left, failAt, over, ok }}
 *   share 0 to 1 of the drill run so far; km covered; stamina left; ms left until it ends (or fails);
 *   failAt: when the bar runs out (null if it won't); over: it has ended; ok: it will be, or was, completed
 */
export function drillNow(active, now) {
  const l = DRILLS[active.kind].levels[active.level - 1];
  const span = active.endAt - active.startedAt;
  const ok = active.from >= active.cost;
  const failAt = ok ? null : active.startedAt + span * (active.from / active.cost);
  const stop = ok ? active.endAt : failAt;
  const at = Math.max(active.startedAt, Math.min(now, stop));
  const share = (at - active.startedAt) / span;
  return {
    share, km: l.km * share, ok, failAt,
    stamina: Math.max(0, Math.round(active.from - active.cost * share)),
    left: Math.max(0, stop - now), over: now >= stop,
  };
}

/** Stop a drill early: the stamina spent so far is gone, nothing opens. */
export function cancelDrill(drills, now) {
  if (!drills.active) return { drills, stamina: null };
  const s = drillNow(drills.active, now);
  return { drills: { ...drills, active: null }, stamina: staminaSet(s.stamina, Math.min(now, drills.active.endAt)) };
}

/**
 * Start a recovery tool. Refused: `busy`, `full` (nothing to recover), `unknown`.
 * @returns {{ drills } | { error: string }}
 */
export function startRecovery(drills, tool, { stamina, now }) {
  const r = RECOVERY[tool];
  if (!r) return { error: 'unknown' };
  if (drills.active || drills.recovering) return { error: 'busy' };
  if (stamina >= STAMINA.max) return { error: 'full' };
  return { drills: { ...drills, result: null, recovering: { tool, startedAt: now, endAt: now + r.min * MIN, gain: r.gain } } };
}

/** Get out of a recovery tool early: nothing is gained. */
export const cancelRecovery = (drills) => (drills.recovering ? { ...drills, recovering: null } : drills);

/** A running recovery at `now`: { share, left } (0 to 1 done, ms left). */
export function recoveryNow(rec, now) {
  const span = rec.endAt - rec.startedAt;
  return { share: Math.max(0, Math.min(1, (now - rec.startedAt) / span)), left: Math.max(0, rec.endAt - now) };
}

/**
 * Close whatever has ended by `now`. A finished drill opens the next level; a failed one leaves
 * stamina at zero from the moment it ran out; a finished recovery adds its gain to what the bar
 * had refilled to by then. The outcome is left in `result` until `clearResult`.
 * @param {{ value, at }} anchor  the stamina anchor
 * @returns {{ drills, stamina: { value, at } | null, changed: boolean }} stamina: the new anchor, when it moved
 */
export function settle(drills, anchor, now) {
  let out = drills; let stamina = null;
  if (out.active) {
    const a = out.active; const s = drillNow(a, now);
    if (s.over) {
      const top = DRILLS[a.kind].levels.length;
      const levels = s.ok ? { ...out.levels, [a.kind]: Math.max(levelOpen(out, a.kind), Math.min(top, a.level + 1)) } : out.levels;
      const at = s.ok ? a.endAt : s.failAt;
      stamina = staminaSet(s.ok ? a.from - a.cost : 0, at);
      out = { ...out, levels, active: null, result: { kind: a.kind, level: a.level, ok: s.ok, km: +s.km.toFixed(2), opened: s.ok && a.level < top && a.level + 1 > levelOpen(drills, a.kind) ? a.level + 1 : null, at } };
    }
  }
  if (out.recovering && now >= out.recovering.endAt) {
    const r = out.recovering;
    const before = staminaAt(stamina || anchor, r.endAt);
    stamina = staminaSet(before + r.gain, r.endAt);
    out = { ...out, recovering: null, result: { tool: r.tool, gain: stamina.value - before, at: r.endAt } };
  }
  return { drills: out, stamina, changed: out !== drills };
}

export const clearResult = (drills) => (drills.result ? { ...drills, result: null } : drills);

/**
 * The stamina to show at `now`: a running drill's falling bar, else the anchor's own refill.
 * (The bar doesn't refill during a drill.)
 */
export const staminaShown = (drills, anchor, now) => (drills?.active ? drillNow(drills.active, now).stamina : staminaAt(anchor, now));
