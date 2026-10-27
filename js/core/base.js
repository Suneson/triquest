// base.js — the home base's "what should I do next" answers (docs/LOOP.md §3). Pure.
//
// Three plain facts, never a nudge to train: what's being built, what you can
// nearly afford, and which feat you're closest to. Each is worked out from
// what's already yours; nothing here asks for a session on a set day.

import { SPORTS, SLOTS, nextTier, ownedTier } from './gear.js';
import { propsFor } from './scenes.js';
import { jobPhase, jobFor } from './workshop.js';
import { FEATS, nearMiss } from './feats.js';

/** Jobs queued or being fitted, soonest finish first. */
export function building(jobs, now = Date.now()) {
  return (jobs || []).filter((j) => ['fitting', 'waiting'].includes(jobPhase(j, now)))
    .sort((a, b) => Date.parse(a.finishes_at) - Date.parse(b.finishes_at));
}

/** Everything you could buy next with coins: each slot's next tier and each prop not yet yours. */
export function shoppingList(inventory, jobs, now = Date.now()) {
  const owned = new Set((inventory || []).map((r) => r.item_id));
  const free = (id) => !owned.has(id) && !jobFor(jobs, id, now);
  const gear = SPORTS.flatMap((sport) => SLOTS[sport].map((slot) => {
    // the tier after one already in the workshop waits for it, so it isn't "next" yet
    const next = nextTier(inventory, sport, slot);
    return next && ownedTier(inventory, sport, slot) === next.tier - 1 && free(next.id) ? next : null;
  })).filter(Boolean);
  const props = SPORTS.flatMap((s) => propsFor(s)).filter((p) => free(p.id));
  return [...gear, ...props];
}

/**
 * { affordable, nearest }: how many things you can buy now, and the cheapest
 * thing you can't yet, with what's missing ({ item, short }), or null.
 */
export function nearlyAffordable(inventory, jobs, coins, now = Date.now()) {
  const list = shoppingList(inventory, jobs, now);
  const affordable = list.filter((x) => x.cost <= coins).length;
  const out = list.filter((x) => x.cost > coins).sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
  return { affordable, nearest: out.length ? { item: out[0], short: out[0].cost - coins } : null };
}

/** How far toward a feat's target, 0–1 (times and paces are lower-is-better). */
export function featProgress(f, nm) {
  if (!nm || nm.target == null || !nm.best) return 0;
  if (['time', 'pace', 'steady'].includes(f.kind)) return Math.max(0, Math.min(1, nm.target / nm.best));
  return Math.max(0, Math.min(1, nm.best / nm.target));
}

/** The feat you haven't won that you're closest to: { feat, nm, progress } or null. */
export function closestFeat(workouts, wonIds) {
  const won = new Set(wonIds || []);
  let best = null;
  for (const f of FEATS) {
    if (won.has(f.id)) continue;
    const nm = nearMiss(f, workouts);
    const progress = featProgress(f, nm);
    if (progress <= 0 || progress >= 1) continue;
    if (!best || progress > best.progress) best = { feat: f, nm, progress };
  }
  return best;
}
