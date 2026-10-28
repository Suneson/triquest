// room.js — a chat room's data. General is one public room for everyone
// signed in; a club's room (docs/LOOP.md §6) is the same thing for its
// members only, the same table with a club_id (0026_clubs.sql), so it has the
// same rate limit, removal, reports and blocking. createRoom(clubId) makes
// one; General's is made here and its functions exported as before.
//
// Loads the latest page, pages backwards on demand, and stays live through a
// realtime channel. Sending is optimistic: a bubble appears at once with a
// client id, and the server's row replaces it when it arrives (or it's marked
// "not sent" with a retry). Offline is a state of its own: you can read,
// you can't send. Blocking folds an author to "message hidden"; reporting
// files a row for the owner; removing is the author's (or an admin's).
// ?demo=1 answers everything locally.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo, demoRoom, demoClubRoom, DEMO_ME } from './demo.js';
import { checkBody, rateLimited, roomUnread, mergeMessages, clientId } from '../core/room.js';
import { haptic } from './haptics.js';
import { t } from '../core/i18n.js';

const PAGE = 40;
const SEEN = 'moske-room-seen';
const ROOMS = new Set();

/** A room: General (clubId null) or a club's. Same API either way. */
export function createRoom(clubId = null) {
  const state = {
    ready: false, loading: false, error: '',
    me: null, isAdmin: false,
    messages: [],            // server rows + pending bubbles
    authors: new Map(),      // user_id → { display_name, username, avatar, xp }
    blocked: new Set(),
    hasMore: true,
    offline: typeof navigator !== 'undefined' && navigator.onLine === false,
    sentAt: [],              // my recent post times, for the client-side rate check
  };
  const listeners = new Set();
  let channel = null;
  let started = null;
  const SEEN_KEY = clubId ? `${SEEN}-club-${clubId}` : SEEN;
  // General shows rows with no club; a club room only its own
  const scoped = (q) => (clubId ? q.eq('club_id', clubId) : q.is('club_id', null));
  const mine = (row) => (row?.club_id ?? null) === clubId;

  const emit = (why) => listeners.forEach((fn) => { try { fn(why); } catch { /* a view went away */ } });
  const onRoom = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const roomState = () => state;
  const roomEnabled = () => isDemo() || (SYNC_ENABLED && !!currentUser());

  const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };
  const writeSeen = (id) => { try { localStorage.setItem(SEEN_KEY, String(id)); } catch { /* private mode */ } };

  const unreadRoom = () => (state.ready ? roomUnread(state.messages, { lastSeenId: readSeen(), me: state.me, blocked: state.blocked }) : 0);
  function markRoomRead() {
    const newest = Math.max(0, ...state.messages.filter((m) => !m.pending).map((m) => m.id));
    if (newest > readSeen()) { writeSeen(newest); emit('read'); }
  }
  const author = (uid) => state.authors.get(uid) || null;

  // ---- load + live ------------------------------------------------------------------------

  async function fetchAuthors(c) {
    const { data, error } = await c.rpc('room_authors');
    if (error) throw error;
    (data || []).forEach((a) => state.authors.set(a.user_id, a));
  }

  function startRoom() {
    if (!roomEnabled()) { stopRoom(); return Promise.resolve(); }
    if (isDemo()) {
      if (!state.ready) {
        const d = clubId ? demoClubRoom() : demoRoom();
        Object.assign(state, { ready: true, me: DEMO_ME, messages: d.messages, blocked: new Set(d.blocked), isAdmin: d.isAdmin, hasMore: false });
        d.authors.forEach((a) => state.authors.set(a.user_id, a));
        emit('load');
      }
      return Promise.resolve();
    }
    const uid = currentUser().id;
    if (started && state.me === uid) return started;
    stopRoom();
    state.me = uid;
    started = (async () => {
      try {
        state.loading = true;
        const c = await client();
        const [page, blocks, admin] = await Promise.all([
          scoped(c.from('room_messages').select('*')).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE),
          c.from('user_blocks').select('blocked').is('unblocked_at', null),
          c.rpc('is_app_admin'),
        ]);
        if (page.error) throw page.error;
        await fetchAuthors(c);
        state.messages = page.data || [];
        state.hasMore = (page.data || []).length === PAGE;
        state.blocked = new Set((blocks.data || []).map((b) => b.blocked));
        state.isAdmin = !!admin.data;
        state.ready = true; state.error = '';
        subscribe(c);
        emit('load');
      } catch (e) {
        state.error = e?.message || t('room.roomFailed');
        started = null;
        emit('error');
      } finally { state.loading = false; }
    })();
    return started;
  }

  function stopRoom() {
    if (channel) { client().then((c) => c.removeChannel(channel)).catch(() => {}); channel = null; }
    started = null;
    Object.assign(state, { ready: false, me: null, messages: [], blocked: new Set(), isAdmin: false, hasMore: true, error: '' });
    state.authors = new Map();
    emit('stop');
  }

  let authorTimer = null;
  function subscribe(c) {
    channel = c.channel(clubId ? `room:club:${clubId}` : 'room:general')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages', ...(clubId ? { filter: `club_id=eq.${clubId}` } : {}) }, (p) => {
        const row = p.new;
        if (!row?.id || !mine(row)) return;
        // the echo of my own optimistic bubble replaces it (roomView drops the pending one)
        state.messages = mergeMessages(state.messages.filter((m) => !(m.pending && m.client_id && m.client_id === row.client_id)), [row]);
        if (!state.authors.has(row.user_id)) {
          clearTimeout(authorTimer);
          authorTimer = setTimeout(() => fetchAuthors(c).then(() => emit('authors')).catch(() => {}), 300);
        }
        if (p.eventType === 'INSERT' && row.user_id !== state.me && !state.blocked.has(row.user_id)) haptic('message');
        emit(p.eventType === 'INSERT' ? 'message' : 'update');
      })
      .subscribe();
  }

  /** The page before the oldest message I have. Resolves to how many arrived. */
  async function loadOlder() {
    if (!state.ready || state.loading || !state.hasMore || isDemo()) return 0;
    const oldest = state.messages.filter((m) => !m.pending).reduce((a, m) => (!a || m.created_at < a.created_at ? m : a), null);
    if (!oldest) return 0;
    state.loading = true;
    try {
      const c = await client();
      const { data, error } = await scoped(c.from('room_messages').select('*'))
        .lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(PAGE);
      if (error) throw error;
      state.messages = mergeMessages(state.messages, data || []);
      state.hasMore = (data || []).length === PAGE;
      if ((data || []).some((m) => !state.authors.has(m.user_id))) await fetchAuthors(c);
      emit('older');
      return (data || []).length;
    } catch { return 0; } finally { state.loading = false; }
  }

  // ---- actions ----------------------------------------------------------------------------

  /** Send (or resend) a message. Returns an error string, or '' when it's on its way. */
  async function sendRoom(text, { retryOf = null } = {}) {
    const chk = checkBody(text);
    if (chk.error) return chk.error;
    if (state.offline) return t('room.offlineSend');
    if (rateLimited(state.sentAt)) return t('room.slowDown');
    const cid = retryOf || clientId();
    state.messages = state.messages.filter((m) => !(m.pending && m.client_id === cid));
    const bubble = { id: -Date.now(), user_id: state.me, body: chk.body, client_id: cid, created_at: new Date().toISOString(), deleted_at: null, pending: true };
    state.messages.push(bubble);
    state.sentAt = [...state.sentAt.filter((at) => Date.now() - at < 60000), Date.now()];
    emit('sending');
    if (isDemo()) {
      setTimeout(() => {
        state.messages = mergeMessages(state.messages.filter((m) => m !== bubble), [{ ...bubble, id: Date.now(), pending: false }]);
        emit('message');
      }, 350);
      return '';
    }
    try {
      const c = await client();
      const { data, error } = await c.from('room_messages').insert({ user_id: state.me, body: chk.body, client_id: cid, ...(clubId ? { club_id: clubId } : {}) }).select().single();
      if (error) throw error;
      state.messages = mergeMessages(state.messages.filter((m) => !(m.pending && m.client_id === cid)), [data]);
      emit('message');
      return '';
    } catch (e) {
      bubble.failed = true; bubble.error = /Slow down/.test(e?.message || '') ? t('room.slowDownShort') : t('room.notSent');
      emit('failed');
      return '';
    }
  }

  function discardRoom(cid) {
    state.messages = state.messages.filter((m) => !(m.pending && m.client_id === cid));
    emit('update');
  }

  async function rpc(name, args) {
    const c = await client();
    const { data, error } = await c.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }

  async function removeRoom(id) {
    if (!isDemo()) await rpc('remove_room_message', { p_id: id });
    const m = state.messages.find((x) => x.id === id);
    if (m) { m.deleted_at = new Date().toISOString(); m.body = ''; }
    emit('update');
  }

  async function reportRoom(id, reason = null) {
    if (!isDemo()) {
      const c = await client();
      const { error } = await c.from('room_reports').insert({ message_id: id, reporter: state.me, reason: reason ? String(reason).slice(0, 300) : null });
      if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    }
  }

  // a block is yours, not a room's: every open room folds that author away
  async function blockUser(uid) {
    if (!isDemo()) await rpc('block_user', { p_user: uid });
    ROOMS.forEach((r) => r.setBlocked(new Set([...r.roomState().blocked, uid])));
  }

  async function unblockUser(uid) {
    if (!isDemo()) await rpc('unblock_user', { p_user: uid });
    ROOMS.forEach((r) => r.setBlocked(new Set([...r.roomState().blocked].filter((x) => x !== uid))));
  }

  function setBlocked(set) { state.blocked = set; emit('blocks'); }
  function setOffline(off) { state.offline = off; emit(off ? 'offline' : 'online'); }

  const room = { clubId, onRoom, roomState, roomEnabled, unreadRoom, markRoomRead, author, startRoom, stopRoom, loadOlder, sendRoom, discardRoom, removeRoom, reportRoom, blockUser, unblockUser, setBlocked, setOffline };
  ROOMS.add(room);
  return room;
}

/** Forget a club room (you left the club). */
export function dropRoom(room) { if (room && room.clubId) { room.stopRoom(); ROOMS.delete(room); } }

/** General: everyone's room. */
export const general = createRoom(null);
export const { onRoom, roomState, roomEnabled, unreadRoom, markRoomRead, author, startRoom, stopRoom, loadOlder, sendRoom, discardRoom, removeRoom, reportRoom, blockUser, unblockUser } = general;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => ROOMS.forEach((r) => r.setOffline(false)));
  window.addEventListener('offline', () => ROOMS.forEach((r) => r.setOffline(true)));
}
