// stamina.js — the third resource on the base's HUD (docs/COMPOUND.md). Pure.
//
// Stamina refills on its own: from empty to full in 30 hours, worked out from a timestamp, so it
// has caught up whenever the app opens again however long it was closed. Training in the base
// spends it and recovery tools give it back (js/core/drills.js): both move the anchor (the value
// and the time it was true), and the refill carries on from there.
//
//   anchor = { value, at }   at: ms since the epoch

/** `regenSec`: seconds per point. 100 points in 30 hours is one every 18 minutes. */
export const STAMINA = { max: 100, regenSec: (30 * 3600) / 100 };

/** A fresh anchor: a new athlete starts rested. */
export const freshStamina = (now = Date.now()) => ({ value: STAMINA.max, at: now });

/** Stamina at `now` from an anchor (a missing or broken anchor counts as empty). */
export function staminaAt(anchor, now = Date.now()) {
  const v = Number(anchor?.value); const at = Number(anchor?.at);
  if (!Number.isFinite(v) || !Number.isFinite(at)) return 0;
  const gained = Math.floor(Math.max(0, now - at) / (STAMINA.regenSec * 1000));
  return Math.max(0, Math.min(STAMINA.max, Math.floor(v) + gained));
}

/** Milliseconds until the next point (0 when full). */
export function msToNext(anchor, now = Date.now()) {
  if (staminaAt(anchor, now) >= STAMINA.max) return 0;
  const step = STAMINA.regenSec * 1000;
  const since = Math.max(0, now - Number(anchor.at));
  return step - (since % step);
}

/** Milliseconds until full. */
export function msToFull(anchor, now = Date.now()) {
  const left = STAMINA.max - staminaAt(anchor, now);
  return left <= 0 ? 0 : msToNext(anchor, now) + (left - 1) * STAMINA.regenSec * 1000;
}

/** A new anchor: stamina is `value` (kept between 0 and max) at `now`. */
export const staminaSet = (value, now = Date.now()) => ({ value: Math.max(0, Math.min(STAMINA.max, Math.floor(Number(value) || 0))), at: now });

/** A new anchor after `delta` points are added (or taken, when negative) at `now`. */
export const staminaAdd = (anchor, delta, now = Date.now()) => staminaSet(staminaAt(anchor, now) + delta, now);
