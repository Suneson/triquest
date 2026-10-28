// clubs-state.js — your club (docs/LOOP.md §6), as the server last told it:
// the club board (names, this week's total, the relay), your invites, and the
// clubs anyone can find by name. Every change goes through a 0026_clubs.sql
// function; nothing here can see another member's days, because the server
// never sends them. ?demo=1 plays it all locally.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo, demoClubBoard, demoClubList } from './demo.js';
import { createRoom, dropRoom } from './room.js';
import { CLUB_RULES, checkClubName, nextRoute } from '../core/clubs.js';
import { t } from '../core/i18n.js';

const state = { ready: false, loading: false, board: null, invites: [], error: '' };
const listeners = new Set();
let room = null;
let demo = null;

const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
export const onClub = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const clubState = () => state;
export const clubsEnabled = () => isDemo() || (SYNC_ENABLED && !!currentUser());

/** Your club's room (made once per club), or null outside a club. */
export function clubRoom() {
  const id = state.board?.id || null;
  if (room && room.clubId !== id) { dropRoom(room); room = null; }
  if (id && !room) room = createRoom(id);
  return room;
}

/** Read your club and invites again. */
export async function refreshClub() {
  if (!clubsEnabled()) return state;
  if (isDemo()) {
    demo ||= { board: demoClubBoard(), invites: [] };
    Object.assign(state, { ready: true, board: demo.board, invites: demo.invites, error: '' });
    emit();
    return state;
  }
  state.loading = true;
  try {
    const c = await client();
    const [b, i] = await Promise.all([c.rpc('club_board'), c.rpc('my_club_invites')]);
    if (b.error) throw b.error;
    Object.assign(state, { ready: true, board: b.data || null, invites: i.error ? [] : i.data || [], error: '' });
  } catch (e) {
    // before 0026 is live there are no clubs: say nothing, show the empty state
    Object.assign(state, { ready: true, error: /club_board|function/.test(e?.message || '') ? '' : e?.message || t('club.err.generic') });
  } finally { state.loading = false; }
  emit();
  return state;
}

export function stopClub() {
  if (room) { dropRoom(room); room = null; }
  Object.assign(state, { ready: false, board: null, invites: [], error: '' });
  demo = null;
  emit();
}

/** A server error ('club:full') in words. */
export function clubError(e) {
  const c = String(e?.message || e || '').match(/club:([a-z_]+)/)?.[1];
  return c ? t(`club.err.${c}`, { n: CLUB_RULES.maxMembers }) : t('club.err.generic');
}

async function call(fn, args = {}) {
  const c = await client();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** Clubs anyone can find, by name. */
export async function listClubs(q = '') {
  if (isDemo()) return demoClubList().filter((c) => c.name.toLowerCase().includes(String(q).toLowerCase()));
  if (!clubsEnabled()) return [];
  try { return (await call('list_clubs', { p_query: String(q || '') })) || []; } catch { return []; }
}

export async function createClub(name, crest) {
  const chk = checkClubName(name);
  if (chk.error) throw new Error(`club:name_${chk.error}`);
  if (isDemo()) {
    demo.board = { ...demoClubBoard(), id: 99, name: chk.name, crest, me: 'owner', members: [{ user_id: 'd-07', display_name: 'Lucía Fernández', role: 'owner' }], week_minutes: 0, relay: { route_id: 'gc-cumbre', started_at: new Date().toISOString(), km: 0 }, relays_done: 0 };
    return refreshClub();
  }
  await call('create_club', { p_name: chk.name, p_crest: crest });
  return refreshClub();
}

export async function inviteToClub(username) {
  if (isDemo()) return { invited: true };
  return call('invite_to_club', { p_username: String(username || '').trim() });
}

export async function respondInvite(id, accept) {
  if (isDemo()) { demo.invites = demo.invites.filter((i) => i.id !== id); return refreshClub(); }
  await call('respond_club_invite', { p_invite: id, p_accept: !!accept });
  return refreshClub();
}

export async function leaveClub() {
  if (isDemo()) { demo.board = null; if (room) { dropRoom(room); room = null; } return refreshClub(); }
  await call('leave_club');
  if (room) { dropRoom(room); room = null; }
  return refreshClub();
}

export async function setClubTarget(hours) {
  if (isDemo()) { demo.board = { ...demo.board, target_minutes: Math.round(hours) * 60 }; return refreshClub(); }
  await call('set_club_target', { p_hours: Math.round(hours) });
  return refreshClub();
}

export async function startRelay() {
  if (isDemo()) {
    const next = nextRoute(demo.board.relay.route_id);
    demo.board = { ...demo.board, relay: { route_id: next.id, started_at: new Date().toISOString(), km: 0 }, relays_done: demo.board.relays_done + 1 };
    return refreshClub();
  }
  await call('start_relay');
  return refreshClub();
}
