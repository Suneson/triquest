// stall.js — the daily stall (docs/LOOP.md §5.3). Pure.
//
// One thing for your rooms is on sale each day, for coins only. The stall
// turns over at midnight UTC and walks the list below in order, so everyone
// sees the same stall on the same day, and tomorrow's is known today: no
// luck, no "for you" offers. What you buy is yours for good and stands in the
// diorama like the coffee machine (placement.js). The server's buy_stall()
// (0025_missions.sql) sells only the day's item.

import { diffDays } from './dates.js';

export const STALL_RULES = {
  /** The first stall day (UTC). */
  since: '2026-10-28',
};

const ART = 'icons/Pixelart/NEW/ITEMS';

/**
 * The stall's items, in the order they come round. Append only.
 * w × h: footprint in floor tiles. home: the room it's first set down in.
 * scale/lift: as placement.js's PLACEABLES.
 */
export const STALL_ITEMS = [
  { id: 'decor-plant', cost: 120, w: 1, h: 1, home: 'locker', scale: 0.9, lift: 0.02 },
  { id: 'decor-cooler', cost: 160, w: 1, h: 1, home: 'run', scale: 0.85, lift: 0.02 },
  { id: 'decor-bench', cost: 220, w: 2, h: 1, home: 'locker', scale: 0.95, lift: 0.04 },
  { id: 'decor-roller', cost: 140, w: 1, h: 1, home: 'gym', scale: 0.9, lift: 0.03 },
  { id: 'decor-punchbag', cost: 240, w: 1, h: 1, home: 'gym', scale: 0.9, lift: 0.02 },
  { id: 'decor-shelf', cost: 260, w: 1, h: 1, home: 'locker', scale: 0.9, lift: 0.02 },
  { id: 'decor-towels', cost: 120, w: 1, h: 1, home: 'pool', scale: 0.9, lift: 0.02 },
  { id: 'decor-rug', cost: 200, w: 2, h: 2, home: 'locker', scale: 1, lift: 0.18, flat: true },
].map((it) => ({ ...it, kind: 'decor', currency: 'coins', art: `${ART}/${it.id}.webp` }));

export const stallItemById = (id) => STALL_ITEMS.find((i) => i.id === id) || null;

/** Today's date in UTC (the stall's day), from a timestamp in ms. */
export const stallDay = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

/** The item on the stall on a UTC day, or null before the stall opened. */
export function stallFor(day) {
  const k = diffDays(day, STALL_RULES.since);
  if (k < 0) return null;
  return STALL_ITEMS[k % STALL_ITEMS.length];
}

/** The next `n` days' stall, from tomorrow: [{ day, item }]. */
export function stallAhead(day, n = 3) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.parse(`${day}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10);
    out.push({ day: d, item: stallFor(d) });
  }
  return out;
}

/** Milliseconds until the stall turns over (next midnight UTC). */
export function msToNextStall(ms = Date.now()) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - ms;
}
