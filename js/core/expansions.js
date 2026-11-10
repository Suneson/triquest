// expansions.js — taking a room from 8 × 8 to 16 × 16 and then to 32 × 32 (docs/ROOMS3D.md).
//
// Every room starts as the painted 8 × 8 room in the middle of its floor's roof. Expanding it buys
// the 32 × 32 picture that fills the whole roof, taped off to its back 16 × 16; the last step takes
// the tape away. Each is bought once per room, for good. Every room has a picture now, but four of
// them only at level 10, so those are for admins to try until all their levels exist.
//
// The server keeps the same rules (supabase/migrations/0034_expansions_all_rooms.sql) and is the one that
// charges: tests/expansions-sql.test.js holds the two together.

import { ROOM32 } from './room32-art.js';

export const EXPANSION_RULES = {
  cost: 1000,                                        // coins, each room: 8 × 8 to 16 × 16
  cost32: 5000,                                      // and 16 × 16 to 32 × 32
  rooms: ['locker', 'gym', 'bike', 'run', 'pool'],   // the order the shop lists them in
  ready: ['locker', 'gym', 'bike', 'run', 'pool'],   // the rooms that can go to 16 × 16
  ready32: ['locker', 'gym', 'bike', 'run', 'pool'], // and to 32 × 32
};

// The rooms every player can buy an expansion for. All five have their ten levels, but the live
// database still only sells the locker room's: add the other four here once
// supabase/migrations/0034_expansions_all_rooms.sql has been applied to it.
const ON_SALE = ['locker'];
/** Is this room offered to this player? Admins and the demo can try them all. */
export const onSale = (room, tester = false) => tester || ON_SALE.includes(room);

// Buying 32 × 32 waits for supabase/migrations/0032_expansions_32.sql to be applied to the live
// database: turn this on once it has been.
export const SIZE_32_LIVE = true;

/** Can this room be expanded yet (is its 16 × 16 model in)? */
export const expansionReady = (room) => EXPANSION_RULES.ready.includes(room);

/** Has this room been expanded at all? Rows are { room, size, cost, bought_at }. */
export const isExpanded = (rows, room) => (rows || []).some((r) => r.room === room);

/** How big a room is now: 8, 16 or 32 tiles along each side. */
export const expandedSize = (rows, room) => Math.max(8, ...(rows || []).filter((r) => r.room === room).map((r) => Number(r.size) || 16));

/** The next step this room can be expanded by, { size, cost }, or null if there's none (yet). */
export function nextExpansion(rows, room, allow32 = true) {
  const now = expandedSize(rows, room);
  if (now === 8 && expansionReady(room)) return { size: 16, cost: EXPANSION_RULES.cost };
  if (now === 16 && allow32 && EXPANSION_RULES.ready32.includes(room)) return { size: 32, cost: EXPANSION_RULES.cost32 };
  return null;
}

/** The big room's picture for a room that has one (all 32 × 32 of it, or taped off), at level 10. */
export const EXPANDED_ART = Object.fromEntries(Object.entries(ROOM32).map(([room, r]) => [room, r.src]));

/** The same big room at a level (1–10): tools/cut-rooms-32.py cuts all ten to one frame. */
export const bigArt = (room, level) => EXPANDED_ART[room]?.replace(/big-10\.webp$/, `big-${Math.max(1, Math.min(10, level || 1))}.webp`);

/**
 * The same picture at half size (tools/room-mids.py): what the base shows until you zoom in. A
 * quarter of the memory and about a third of the download of the full one.
 */
export const MID_W = 1700;
export const midArt = (room, level) => bigArt(room, level)?.replace(/big-(\d+)\.webp$/, 'mid-$1.webp');
/** Is a picture `width` px wide too soft for a room drawn `onScreen` device px wide? */
export const needsFull = (onScreen, width = MID_W) => onScreen > width * 1.1;

/**
 * Rooms that show their big picture from the start, taped off to the 8 × 8 in its back corner
 * until they're expanded (docs/ROOMS-16-NEXT.md). That is every room now: the old painted 8 × 8
 * rooms are gone, and a room that hasn't been expanded is the same big room behind tape.
 */
export const TAPED_ROOMS = ['locker', 'gym', 'bike', 'run', 'pool'];
export const tapedRoom = (room, preview = false) => !!EXPANDED_ART[room] && (preview || TAPED_ROOMS.includes(room));
