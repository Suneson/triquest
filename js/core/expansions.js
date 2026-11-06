// expansions.js — taking a room from 8 × 8 to 16 × 16 (docs/ROOMS3D.md).
//
// Every room starts as the painted 8 × 8 room in the middle of its floor's roof. Expanding it
// buys the 16 × 16 room, a 3D model rendered from the city's camera, which fills the whole roof
// up to the railing. Bought once per room, for good. Only the locker room has its model so far;
// the others say "coming soon".
//
// The server keeps the same rules (supabase/migrations/0029_expansions.sql) and is the one that
// charges: tests/expansions-sql.test.js holds the two together.

export const EXPANSION_RULES = {
  cost: 1000,                                        // coins, each room
  rooms: ['locker', 'gym', 'bike', 'run', 'pool'],   // the order the shop lists them in
  ready: ['locker'],                                 // the rooms with a 16 × 16 model
};

/** Can this room be expanded yet (is its 16 × 16 model in)? */
export const expansionReady = (room) => EXPANSION_RULES.ready.includes(room);

/** Has this room been expanded? Rows are { room, cost, bought_at }. */
export const isExpanded = (rows, room) => (rows || []).some((r) => r.room === room);

/** The 16 × 16 room's picture for a room that has one. */
export const EXPANDED_ART = { locker: 'icons/Pixelart/NEW/LOCKER/model-10.webp' };

/**
 * Rooms that show their 16 × 16 picture from the start, taped off to the 8 × 8 in its back corner
 * until they're expanded (docs/ROOMS-16-NEXT.md). None for everyone until all five rooms have their
 * pictures; admins can preview it from the Expand window.
 */
export const TAPED_ROOMS = [];
export const tapedRoom = (room, preview = false) => !!EXPANDED_ART[room] && (preview || TAPED_ROOMS.includes(room));
