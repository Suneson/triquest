// stamina.js — the third resource on the base's HUD (docs/COMPOUND.md). Pure.
//
// Stamina refills on its own: +1 every regenSec up to max, worked out from a
// timestamp, so it has caught up whenever the app opens again however long it
// was closed. Nothing spends it yet; spending will move the anchor (the value
// and the time it was true), and regeneration carries on from there.
//
//   anchor = { value, at }   at: ms since the epoch

export const STAMINA = { max: 100, regenSec: 60 };

/** A fresh anchor: empty, filling from now. */
export const freshStamina = (now = Date.now()) => ({ value: 0, at: now });

/** Stamina at `now` from an anchor (a missing or broken anchor counts as fresh at now). */
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
