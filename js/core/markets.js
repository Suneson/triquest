// markets.js — the four markets round the MOSKE tower's lobby (docs/MARKETS.md).
//
// Like the collectors round a base in a builder game: each market is bought once, then makes
// MOSKE coins on its own, a few an hour, up to what it can hold. A coin over it says there's
// something to take; tapping collects it into the wallet. Until you buy one it stands there dark.
//
// The server keeps the same rules (supabase/migrations/0028_markets.sql, market_rules()) and is
// the one that pays: tests/markets-sql.test.js holds the two together.

export const MARKET_RULES = {
  cost: 400,                // coins, each
  slots: [1, 2, 3, 4],      // left far, left near, right near, right far (city3d.js MARKETS)
  // what a market makes at each level: coins an hour, and the most it holds before it stops
  levels: [{ level: 1, perHour: 2, capacity: 24 }],
};

/** The rules at a market's level (level 1 when it has none yet). */
export const marketLevel = (m) => MARKET_RULES.levels[Math.max(0, Math.min(MARKET_RULES.levels.length, Number(m?.level) || 1) - 1)];

/** Is this one of the four slots? */
export const isMarketSlot = (slot) => MARKET_RULES.slots.includes(Number(slot));

/** The market in a slot, if it's bought: rows are { slot, level, bought_at, collected_at }. */
export const marketIn = (markets, slot) => (markets || []).find((m) => Number(m.slot) === Number(slot)) || null;

/** Whole coins waiting in a bought market at `nowMs`: what it's made since it was last emptied, up to what it holds. */
export function marketStock(m, nowMs) {
  if (!m) return 0;
  const L = marketLevel(m);
  const hours = Math.max(0, (nowMs - Date.parse(m.collected_at)) / 3600e3);
  return Math.min(L.capacity, Math.floor(hours * L.perHour));
}

/** How long until a market is full (ms; 0 when it is). */
export function marketFullIn(m, nowMs) {
  if (!m) return 0;
  const L = marketLevel(m);
  const fullAt = Date.parse(m.collected_at) + (L.capacity / L.perHour) * 3600e3;
  return Math.max(0, fullAt - nowMs);
}

/**
 * Collecting: take what's waiting, as much as the wallet has room for (`room`). Returns
 * { coins, collected_at } — the coins taken and the market's new clock. A full market starts
 * again from now; otherwise the clock moves on only by the coins taken, so the part of a coin
 * it's half way through making isn't lost, and what didn't fit in the wallet stays in it.
 */
export function marketCollect(m, nowMs, room = Infinity) {
  const L = marketLevel(m);
  const stock = marketStock(m, nowMs);
  const coins = Math.max(0, Math.min(stock, Math.floor(room)));
  const from = Date.parse(m.collected_at);
  const at = stock >= L.capacity && coins === stock ? nowMs : from + (coins / L.perHour) * 3600e3;
  return { coins, collected_at: new Date(Math.min(at, nowMs)).toISOString() };
}
