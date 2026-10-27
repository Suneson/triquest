// placement-state.js — where your compound items stand (docs/COMPOUND.md).
// Kept on the device for an instant draw, and in user_placements
// (0024_placements.sql) so it follows you to another device. A position is
// only ever written by you moving the item; the server keeps one row per item.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo } from './demo.js';

const KEY = 'moske-placements';
const listeners = new Set();

const uid = () => (isDemo() ? 'demo' : currentUser()?.id || 'local');
function readAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function writeAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ } }

/** Saved positions: { itemId: { room, u, v } }. */
export const savedPlacements = () => readAll()[uid()] || {};

export function onPlacements(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

/** Remember a move (and send it to the server when signed in). */
export async function savePlacement(itemId, p) {
  const all = readAll();
  all[uid()] = { ...(all[uid()] || {}), [itemId]: { room: p.room, u: p.u, v: p.v } };
  writeAll(all);
  if (isDemo() || !SYNC_ENABLED || !currentUser()) return;
  try {
    const c = await client();
    const { error } = await c.from('user_placements').upsert(
      { user_id: currentUser().id, item_id: itemId, room: p.room, u: p.u, v: p.v, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,item_id' });
    if (error) throw error;
  } catch (e) { console.warn('placement not saved to the server', e); }
}

/** Read the server's copy (the newer device wins nothing: the server is the record). */
export async function refreshPlacements() {
  if (isDemo() || !SYNC_ENABLED || !currentUser()) return savedPlacements();
  try {
    const c = await client();
    const { data, error } = await c.from('user_placements').select('item_id, room, u, v');
    if (error) throw error;
    const all = readAll();
    all[uid()] = Object.fromEntries((data || []).map((r) => [r.item_id, { room: r.room, u: r.u, v: r.v }]));
    writeAll(all);
    emit();
  } catch (e) { console.warn('placements refresh failed', e); }
  return savedPlacements();
}
