// island.js: the buildings on the island that start in ruins (docs/CITY.md).
//
// The club base, the pool and the market each start destroyed. You pay coins once, the mechanic
// rebuilds it for a couple of hours, and it stands for good. On the rebuilt market you can buy one
// stall and place it on any free spot: for now it only stands there.
//
// The server keeps the same rules (supabase/migrations/0033_island.sql, island_rules()) and is the
// one that charges: tests/island-sql.test.js holds the two together.

export const ISLAND_RULES = {
  buildHours: 2,
  pieces: { club: 150, pool: 350, market: 600 },   // the club costs less than the opening purse (300)
  standCost: 400,                                  // what a market by the base costs (markets.js)
  spots: [1, 2, 3, 4, 5, 6, 7, 8, 9],              // on the market's plaza: 3 x 3
};

export const isIslandPiece = (p) => Object.hasOwn(ISLAND_RULES.pieces, p);
export const isStandSpot = (s) => ISLAND_RULES.spots.includes(Number(s));

/** A row of user_island ({ piece, cost, started_at, finishes_at, spot }), if there is one. */
export const islandRow = (rows, piece) => (rows || []).find((r) => r.piece === piece) || null;

/** Where a piece stands at `nowMs`: { state: 'ruin' | 'building' | 'built', left (ms), frac (0 to 1) }. */
export function pieceState(rows, piece, nowMs) {
  const r = islandRow(rows, piece);
  if (!r) return { state: 'ruin', left: 0, frac: 0 };
  const from = Date.parse(r.started_at); const to = Date.parse(r.finishes_at);
  if (nowMs >= to) return { state: 'built', left: 0, frac: 1 };
  return { state: 'building', left: to - nowMs, frac: Math.max(0, Math.min(1, (nowMs - from) / Math.max(1, to - from))) };
}

/** The market's stall, if it's bought. */
export const standOf = (rows) => islandRow(rows, 'stand');

/** A new row for starting a rebuild at `nowMs`. */
export function startRow(piece, nowMs) {
  return { piece, cost: ISLAND_RULES.pieces[piece], started_at: new Date(nowMs).toISOString(),
    finishes_at: new Date(nowMs + ISLAND_RULES.buildHours * 3600e3).toISOString(), spot: null };
}
