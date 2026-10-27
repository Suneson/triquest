// workshop.js — fitting gear and props takes real time (docs/LOOP.md §1). Pure.
//
// Buying a gear tier or a scene prop pays for it and puts a job in the
// workshop. Each job runs in a bay; a bay fits one job at a time, in the order
// they were queued. The server (0022_workshop.sql) sets every start and finish
// time from its own clock and the client only draws them, so moving the
// device's clock changes nothing. A job's item is yours from its finish time.
//
//   - Queued and not started yet: removing it is free (a full refund).
//   - Mid-fit: the first cancel ever refunds in full, later ones at
//     cancelRefundBp of the price.
//   - A gel finishes the job being fitted now (the gel is used up).
//   - One bay to start; a second comes with the bay2Feat feat.
//
// The functions here are the same rules as the SQL, so tests can check both.

import { gearById, SLOTS, ownedTier } from './gear.js';
import { propById, scenePropsFor } from './scenes.js';

export const WORKSHOP_RULES = {
  fitMin: [0, 10, 60, 240],      // a gear tier's fitting time, by tier (minutes)
  bays: 1,                        // bays everyone has
  bay2Feat: 'cross-four-weeks',   // the feat that opens the second bay
  cancelRefundBp: 5000,           // mid-fit cancels after the first refund half
  skipKinds: ['gel', 'gel-caffeine', 'gel-race'], // the fuel that can finish a job
};

const MIN = 60e3;

/** Minutes a catalog item takes to fit, or null when it isn't fitted (kits, fuel). */
export function fitMinutes(itemId) {
  const g = gearById(itemId);
  if (g) return g.tier > 0 ? WORKSHOP_RULES.fitMin[g.tier] : null;
  const p = propById(itemId);
  return p ? p.fitMin : null;
}

/** Bays open to someone with these feat ids. */
export const bayCount = (featIds = []) => WORKSHOP_RULES.bays + (new Set(featIds).has(WORKSHOP_RULES.bay2Feat) ? 1 : 0);

const ms = (v) => (typeof v === 'number' ? v : v instanceof Date ? v.getTime() : Date.parse(v));

/** Where a job is at a moment: 'waiting' | 'fitting' | 'done' | 'cancelled'. */
export function jobPhase(job, now = Date.now()) {
  if (job.state === 'cancelled') return 'cancelled';
  if (job.state === 'done' || ms(job.finishes_at) <= now) return 'done';
  return ms(job.started_at) > now ? 'waiting' : 'fitting';
}

/** Jobs still holding a bay (not cancelled, not finished) at a moment. */
const live = (jobs, now) => (jobs || []).filter((j) => ['waiting', 'fitting'].includes(jobPhase(j, now)));

/**
 * Where a new job goes: the bay that frees up first (lowest number on a tie),
 * starting then (or now, if it's free). { bay, startMs, finishMs }.
 */
export function placeJob(jobs, bays, minutes, now = Date.now()) {
  let best = null;
  for (let bay = 1; bay <= Math.max(1, bays); bay++) {
    const busy = live(jobs, now).filter((j) => j.bay === bay).reduce((t, j) => Math.max(t, ms(j.finishes_at)), now);
    if (!best || busy < best.startMs) best = { bay, startMs: busy };
  }
  return { ...best, finishMs: best.startMs + minutes * MIN };
}

/**
 * After a job leaves a bay early (cancelled or finished with a gel), the jobs
 * waiting behind it move up, keeping their order and their lengths. Returns
 * new job objects; the others are returned unchanged.
 */
export function reflow(jobs, bay, now = Date.now()) {
  const inBay = (jobs || []).filter((j) => j.bay === bay);
  let cursor = inBay.filter((j) => jobPhase(j, now) === 'fitting').reduce((t, j) => Math.max(t, ms(j.finishes_at)), now);
  const moved = new Map();
  for (const j of inBay.filter((x) => jobPhase(x, now) === 'waiting').sort((a, b) => ms(a.started_at) - ms(b.started_at) || a.id - b.id)) {
    const len = ms(j.finishes_at) - ms(j.started_at);
    moved.set(j, { ...j, started_at: new Date(cursor).toISOString(), finishes_at: new Date(cursor + len).toISOString() });
    cursor += len;
  }
  return (jobs || []).map((j) => moved.get(j) || j);
}

/**
 * What cancelling a job gives back: { refund, midfit }. Waiting jobs come back
 * whole; a mid-fit cancel is whole the first time (no earlier mid-fit cancel in
 * `history`), then cancelRefundBp of the price.
 */
export function cancelRefund(job, history, now = Date.now()) {
  const cost = Number(job.cost) || 0;
  const phase = jobPhase(job, now);
  if (phase === 'waiting') return { refund: cost, midfit: false };
  if (phase !== 'fitting') return { refund: 0, midfit: false };
  const before = (history || []).some((j) => j.state === 'cancelled' && j.midfit);
  return { refund: before ? Math.floor(cost * WORKSHOP_RULES.cancelRefundBp / 10000) : cost, midfit: true };
}

/** Finished jobs as inventory rows ({ item_id, acquired_at }), so ownership reads them like a purchase. */
export const jobsAsInventory = (jobs, now = Date.now()) =>
  (jobs || []).filter((j) => jobPhase(j, now) === 'done').map((j) => ({ item_id: j.item_id, acquired_at: j.finishes_at }));

/** Inventory with finished jobs folded in (deduplicated by item). */
export function withFitted(inventory, jobs, now = Date.now()) {
  const have = new Set((inventory || []).map((r) => r.item_id));
  return [...(inventory || []), ...jobsAsInventory(jobs, now).filter((r) => !have.has(r.item_id))];
}

/** Jobs queued or fitting for an item (so the shop can say "in the workshop"). */
export const jobFor = (jobs, itemId, now = Date.now()) => live(jobs, now).find((j) => j.item_id === itemId) || null;

/** Gels of a kind used to finish jobs early. */
export const skipsOf = (jobs, kind) => (jobs || []).filter((j) => j.skipped_with === kind).length;

// ---- the quadrant: what you've built --------------------------------------------------

/** Points a quadrant level needs, from level 1 up. */
export const QUADRANT_STEPS = [0, 2, 5, 9, 14, 20, 27];

/** Build points in a sport: every gear tier owned counts one, every prop (rare ones too) its points. */
export function quadrantPoints(sport, inventory) {
  const tiers = (SLOTS[sport] || []).reduce((n, slot) => n + ownedTier(inventory, sport, slot), 0);
  const owned = new Set((inventory || []).map((r) => r.item_id));
  return tiers + scenePropsFor(sport).filter((p) => owned.has(p.id)).reduce((n, p) => n + p.points, 0);
}

/** { level, points, next, toNext } — next is the points the next level needs (null at the top). */
export function quadrantLevel(sport, inventory) {
  const points = quadrantPoints(sport, inventory);
  let level = 1;
  QUADRANT_STEPS.forEach((need, i) => { if (points >= need) level = i + 1; });
  const next = QUADRANT_STEPS[level] ?? null;
  return { level, points, next, toNext: next == null ? 0 : next - points };
}
