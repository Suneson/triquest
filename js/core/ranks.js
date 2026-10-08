// ranks.js — podium, rank change since the last visit, and the rival row.
// Pure: rows are the leaderboard RPC rows already sorted by XP (rank = index + 1).

/** The top three in podium order: second, first, third. */
export function podium(rows) {
  const [a, b, c] = rows || [];
  return [b, a, c].filter(Boolean);
}

/** Movement since the last visit. `prev` is null the first time. */
export function rankDelta(prev, rank) {
  if (!rank) return null;
  if (!prev) return { dir: 'new', by: 0 };
  if (rank < prev) return { dir: 'up', by: prev - rank };
  if (rank > prev) return { dir: 'down', by: rank - prev };
  return { dir: 'same', by: 0 };
}

/**
 * The athlete directly above me, with the XP gap and how far along I am (0..1).
 * At #1 the rival is the chaser below. Null when I'm not ranked or alone.
 */
export function rivalOf(rows, meId) {
  const i = (rows || []).findIndex((r) => r.user_id === meId);
  if (i < 0) return null;
  const me = rows[i];
  const xp = (r) => Number(r.xp) || 0;
  if (i > 0) {
    const r = rows[i - 1];
    return { kind: 'above', me, rival: r, rank: i, gap: xp(r) - xp(me), frac: xp(r) ? xp(me) / xp(r) : 1 };
  }
  if (rows[1]) {
    const r = rows[1];
    return { kind: 'chaser', me, rival: r, rank: 2, gap: xp(me) - xp(r), frac: xp(me) ? xp(r) / xp(me) : 0 };
  }
  return null;
}
