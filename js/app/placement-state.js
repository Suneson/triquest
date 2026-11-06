// placement-state.js — where your compound items stand (docs/COMPOUND.md).
// Kept on the device for an instant draw, and in user_placements
// (0024_placements.sql) so it follows you to another device. A position is
// only ever written by you moving the item; the server keeps one row per item.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo } from './demo.js';
import { PLACEABLES } from '../core/placement.js';

const KEY = 'moske-placements';
const OWNED = 'moske-base-items';
const listeners = new Set();

const uid = () => (isDemo() ? 'demo' : currentUser()?.id || 'local');
function readAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function writeAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ } }

/** Saved positions: { itemId: { room, u, v, face?, stashed? } } (face: 'a' or 'b', for items with two facings). */
export const savedPlacements = () => readAll()[uid()] || {};

export function onPlacements(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

/** Remember a move (and send it to the server when signed in). */
export async function savePlacement(itemId, p) {
  const all = readAll();
  all[uid()] = { ...(all[uid()] || {}), [itemId]: { room: p.room, u: p.u, v: p.v, ...(p.face ? { face: p.face } : {}), ...(p.stashed ? { stashed: true } : {}) } };
  writeAll(all);
  if (isDemo() || !SYNC_ENABLED || !currentUser()) return;
  try {
    const c = await client();
    const row = { user_id: currentUser().id, item_id: itemId, room: p.room, u: p.u, v: p.v, updated_at: new Date().toISOString() };
    let { error } = await c.from('user_placements').upsert({ ...row, face: p.face || null, stashed: !!p.stashed }, { onConflict: 'user_id,item_id' });
    // before 0030 and 0031 are live those columns aren't there: keep the spot, the rest stays on this device
    if (error && /face|stashed/.test(error.message || '')) ({ error } = await c.from('user_placements').upsert(row, { onConflict: 'user_id,item_id' }));
    if (error) throw error;
  } catch (e) { console.warn('placement not saved to the server', e); }
}

/** Put an item away in the stash. Its spot and facing are kept on its row; it stands nowhere until it's set down again. */
export const stashPlacement = (itemId, p) => savePlacement(itemId, { ...p, stashed: true });

/** The base items you own (user_base_items, 0031_base_items.sql), as inventory rows; demo mode has them all. */
export function baseItemRows() {
  if (isDemo()) return PLACEABLES.filter((p) => p.stashFirst).map((p) => ({ item_id: p.id }));
  try { return (JSON.parse(localStorage.getItem(OWNED)) || {})[uid()] || []; } catch { return []; }
}

/** Read the server's copy (the newer device wins nothing: the server is the record). */
export async function refreshPlacements() {
  if (isDemo() || !SYNC_ENABLED || !currentUser()) return savedPlacements();
  try {
    const c = await client();
    let { data, error } = await c.from('user_placements').select('item_id, room, u, v, face, stashed');
    if (error && /face|stashed/.test(error.message || '')) ({ data, error } = await c.from('user_placements').select('item_id, room, u, v'));
    if (error) throw error;
    const all = readAll();
    const mine = all[uid()] || {};
    // the server's spot; its facing, or this device's when the server has none yet
    all[uid()] = Object.fromEntries((data || []).map((r) => [r.item_id, { room: r.room, u: r.u, v: r.v,
      ...((r.face || mine[r.item_id]?.face) ? { face: r.face || mine[r.item_id].face } : {}),
      ...((r.stashed ?? mine[r.item_id]?.stashed) ? { stashed: true } : {}) }]));
    writeAll(all);
    const owned = await c.from('user_base_items').select('item_id');
    if (!owned.error) {
      try {
        const rows = JSON.parse(localStorage.getItem(OWNED)) || {};
        localStorage.setItem(OWNED, JSON.stringify({ ...rows, [uid()]: owned.data || [] }));
      } catch { /* private mode */ }
    }
    emit();
  } catch (e) { console.warn('placements refresh failed', e); }
  return savedPlacements();
}
