// room.js — the General chat's data: one public room for everyone signed in.
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
import { isDemo, demoRoom, DEMO_ME } from './demo.js';
import { checkBody, rateLimited, roomUnread, mergeMessages, clientId } from '../core/room.js';
import { haptic } from './haptics.js';
import { t } from '../core/i18n.js';

const PAGE = 40;
const SEEN = 'moske-room-seen';

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

const emit = (why) => listeners.forEach((fn) => { try { fn(why); } catch { /* a view went away */ } });
export const onRoom = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const roomState = () => state;
export const roomEnabled = () => isDemo() || (SYNC_ENABLED && !!currentUser());

const readSeen = () => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } };
const writeSeen = (id) => { try { localStorage.setItem(SEEN, String(id)); } catch { /* private mode */ } };

export const unreadRoom = () => (state.ready ? roomUnread(state.messages, { lastSeenId: readSeen(), me: state.me, blocked: state.blocked }) : 0);
export function markRoomRead() {
  const newest = Math.max(0, ...state.messages.filter((m) => !m.pending).map((m) => m.id));
  if (newest > readSeen()) { writeSeen(newest); emit('read'); }
}
export const author = (uid) => state.authors.get(uid) || null;

// ---- load + live ------------------------------------------------------------------------

async function fetchAuthors(c) {
  const { data, error } = await c.rpc('room_authors');
  if (error) throw error;
  (data || []).forEach((a) => state.authors.set(a.user_id, a));
}

export function startRoom() {
  if (!roomEnabled()) { stopRoom(); return Promise.resolve(); }
  if (isDemo()) {
    if (!state.ready) {
      const d = demoRoom();
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
        c.from('room_messages').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE),
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

export function stopRoom() {
  if (channel) { client().then((c) => c.removeChannel(channel)).catch(() => {}); channel = null; }
  started = null;
  Object.assign(state, { ready: false, me: null, messages: [], blocked: new Set(), isAdmin: false, hasMore: true, error: '' });
  state.authors = new Map();
  emit('stop');
}

let authorTimer = null;
function subscribe(c) {
  channel = c.channel('room:general')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages' }, (p) => {
      const row = p.new;
      if (!row?.id) return;
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
export async function loadOlder() {
  if (!state.ready || state.loading || !state.hasMore || isDemo()) return 0;
  const oldest = state.messages.filter((m) => !m.pending).reduce((a, m) => (!a || m.created_at < a.created_at ? m : a), null);
  if (!oldest) return 0;
  state.loading = true;
  try {
    const c = await client();
    const { data, error } = await c.from('room_messages').select('*')
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
export async function sendRoom(text, { retryOf = null } = {}) {
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
    const { data, error } = await c.from('room_messages').insert({ user_id: state.me, body: chk.body, client_id: cid }).select().single();
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

export function discardRoom(cid) {
  state.messages = state.messages.filter((m) => !(m.pending && m.client_id === cid));
  emit('update');
}

async function rpc(name, args) {
  const c = await client();
  const { data, error } = await c.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function removeRoom(id) {
  if (!isDemo()) await rpc('remove_room_message', { p_id: id });
  const m = state.messages.find((x) => x.id === id);
  if (m) { m.deleted_at = new Date().toISOString(); m.body = ''; }
  emit('update');
}

export async function reportRoom(id, reason = null) {
  if (!isDemo()) {
    const c = await client();
    const { error } = await c.from('room_reports').insert({ message_id: id, reporter: state.me, reason: reason ? String(reason).slice(0, 300) : null });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  }
}

export async function blockUser(uid) {
  if (!isDemo()) await rpc('block_user', { p_user: uid });
  state.blocked = new Set([...state.blocked, uid]);
  emit('blocks');
}

export async function unblockUser(uid) {
  if (!isDemo()) await rpc('unblock_user', { p_user: uid });
  state.blocked = new Set([...state.blocked].filter((x) => x !== uid));
  emit('blocks');
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { state.offline = false; emit('online'); });
  window.addEventListener('offline', () => { state.offline = true; emit('offline'); });
}
