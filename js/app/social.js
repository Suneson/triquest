// social.js — friends, direct messages and notifications (Supabase).
//
// One place holds the signed-in athlete's social state and keeps it live:
//   friends      accepted friendships, plus pending requests both ways
//   threads      one per friend: the last message and how many are unread
//   notifications friend requests/acceptances and app news (user_id null)
// Everything is read through RLS (you only ever see your own rows) and every
// write goes through a checked RPC, except sending a message, which the
// messages_send policy only allows to an accepted friend.
// Realtime pushes new messages, friendship changes and notifications; when
// something new arrives for you the bell lights up and the phone buzzes.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo, demoSocial } from './demo.js';
import { haptic } from './haptics.js';
import { groupThreads, unreadOf, bellCountOf, validUsername, cleanUsername } from '../core/social.js';

const SEEN_NEWS = 'moske-news-seen'; // app news is shared, so "read" is per device

const state = {
  ready: false,
  me: null,            // { id, username }
  friends: [],         // my_friends() rows
  messages: [],        // newest first, recent window
  notifications: [],   // newest first
};
const listeners = new Set();
let channel = null;
let started = null;

const emit = (reason) => listeners.forEach((fn) => { try { fn(reason); } catch { /* a view went away */ } });
export const onSocial = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const socialState = () => state;
export const socialEnabled = () => isDemo() || (SYNC_ENABLED && !!currentUser());

const readSeen = () => { try { return Number(localStorage.getItem(SEEN_NEWS)) || 0; } catch { return 0; } };
const writeSeen = (id) => { try { localStorage.setItem(SEEN_NEWS, String(id)); } catch { /* private mode */ } };

// a buzz on Android when something arrives (see haptics.js: iOS has no vibration)
const buzz = (name = 'request') => haptic(name);

// ---- derived --------------------------------------------------------------------------------

export const accepted = () => state.friends.filter((f) => f.status === 'accepted');
export const incoming = () => state.friends.filter((f) => f.status === 'pending' && f.incoming);
export const outgoing = () => state.friends.filter((f) => f.status === 'pending' && !f.incoming);

/** How I relate to another athlete: friends | incoming | outgoing | none. */
export function relationTo(uid) {
  const f = state.friends.find((x) => x.user_id === uid);
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  return f.incoming ? 'incoming' : 'outgoing';
}
export const friendRow = (uid) => state.friends.find((x) => x.user_id === uid) || null;

/** One thread per accepted friend: last message + unread count, newest first. */
export const threads = () => groupThreads(state.messages, state.me?.id, state.friends);

export const unreadMessages = () => threads().reduce((n, t) => n + t.unread, 0);

/** Notifications not read yet: my own unread ones + app news newer than what this device has seen. */
export const unreadNotifications = () => unreadOf(state.notifications, readSeen());

/** Does the bell light up? Friend requests waiting, or unread notifications. */
export const bellCount = () => bellCountOf(state.friends, state.notifications, readSeen());

// ---- loading + realtime -----------------------------------------------------------------------

// demo mode answers the RPCs locally, with the same rules as the database
function demoRpc(name, a) {
  const f = (uid) => state.friends.find((x) => x.user_id === uid);
  if (name === 'request_friend') {
    const r = f(a.p_user);
    if (r?.status === 'pending' && r.incoming) { r.status = 'accepted'; return { status: 'friends' }; }
    if (r) return { status: r.status === 'accepted' ? 'friends' : 'pending' };
    state.friends.push({ friendship_id: Date.now(), user_id: a.p_user, display_name: 'Demo athlete', username: null, avatar: null, status: 'pending', incoming: false, created_at: new Date().toISOString() });
    return { status: 'pending' };
  }
  if (name === 'respond_friend') {
    const r = state.friends.find((x) => x.friendship_id === a.p_id);
    if (r && a.p_accept) r.status = 'accepted'; else if (r) state.friends.splice(state.friends.indexOf(r), 1);
    return {};
  }
  if (name === 'remove_friend') { state.friends = state.friends.filter((x) => x.user_id !== a.p_user); return null; }
  if (name === 'find_user') {
    const uid = a.p_username === 'yusuf_d' ? 'd-12' : a.p_username === 'hannah_s' ? 'd-11' : null;
    return uid ? [{ user_id: uid, display_name: uid === 'd-12' ? 'Yusuf Demir' : 'Hannah Schäfer', username: a.p_username, avatar: null }] : [];
  }
  if (name === 'set_username') return a.p_username;
  return null;
}

async function rpc(name, args) {
  if (isDemo()) return demoRpc(name, args || {});
  const c = await client();
  const { data, error } = await c.rpc(name, args);
  if (error) throw new Error(error.message || 'Something went wrong');
  return data;
}

async function loadAll() {
  const c = await client();
  const [uname, friends, msgs, notes] = await Promise.all([
    rpc('my_username'),
    rpc('my_friends'),
    c.from('messages').select('*').order('created_at', { ascending: false }).limit(400),
    c.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
  ]);
  state.me = { id: currentUser()?.id, username: uname || null };
  state.friends = friends || [];
  state.messages = msgs.data || [];
  state.notifications = notes.data || [];
}

/** Start (or restart) for the signed-in athlete. Safe to call repeatedly. */
export function startSocial() {
  if (!socialEnabled()) { stopSocial(); return Promise.resolve(); }
  if (isDemo()) {
    // ?demo=1: sample friends and chats, nothing leaves the page
    if (!state.ready) { Object.assign(state, demoSocial(), { ready: true }); emit('load'); }
    return Promise.resolve();
  }
  const uid = currentUser().id;
  if (started && state.me?.id === uid) return started;
  stopSocial();
  started = (async () => {
    try {
      await loadAll();
      state.ready = true;
      emit('load');
      subscribe(uid);
    } catch (e) {
      console.warn('social: load failed', e?.message || e);
      state.ready = false;
      started = null;
    }
  })();
  return started;
}

export function stopSocial() {
  if (channel) { client().then((c) => c.removeChannel(channel)).catch(() => {}); channel = null; }
  started = null;
  Object.assign(state, { ready: false, me: null, friends: [], messages: [], notifications: [] });
  emit('stop');
}

/** Pull everything again (after an RPC, or when the app comes back to the front). */
export async function refreshSocial() {
  if (!socialEnabled() || !state.ready) return;
  if (isDemo()) { emit('refresh'); return; }
  try { await loadAll(); emit('refresh'); } catch { /* keep what we have */ }
}

async function subscribe(uid) {
  const c = await client();
  const upsertMsg = (m) => {
    const i = state.messages.findIndex((x) => x.id === m.id);
    if (i >= 0) state.messages[i] = m; else state.messages.unshift(m);
  };
  channel = c.channel(`social:${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient=eq.${uid}` }, (p) => {
      if (!p.new?.id) return;
      const isNew = p.eventType === 'INSERT';
      upsertMsg(p.new);
      if (isNew) buzz('message');
      emit(isNew ? 'message' : 'read');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender=eq.${uid}` }, (p) => {
      if (!p.new?.id) return;
      upsertMsg(p.new);
      emit('read');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee=eq.${uid}` }, () => refreshSocial())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester=eq.${uid}` }, () => refreshSocial())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (p) => {
      if (!p.new?.id) return;
      state.notifications.unshift(p.new);
      buzz();
      emit('notification');
    })
    .subscribe();
}

// ---- actions --------------------------------------------------------------------------------

export async function requestFriend(uid) {
  const r = await rpc('request_friend', { p_user: uid });
  await refreshSocial();
  return r?.status || 'pending';
}

export async function requestByUsername(name) {
  const clean = cleanUsername(name);
  if (!validUsername(clean)) throw new Error('Usernames are 3–20 letters, numbers or _');
  if (clean === state.me?.username) throw new Error('That’s you.');
  const rows = await rpc('find_user', { p_username: clean });
  const hit = rows?.[0];
  if (!hit) throw new Error(`No athlete is called @${clean}.`);
  const status = await requestFriend(hit.user_id);
  return { status, user: hit };
}

export async function respondFriend(friendshipId, accept) {
  await rpc('respond_friend', { p_id: friendshipId, p_accept: !!accept });
  await refreshSocial();
}

export async function removeFriend(uid) {
  await rpc('remove_friend', { p_user: uid });
  await refreshSocial();
}

export async function setUsername(v) {
  const name = await rpc('set_username', { p_username: v });
  state.me = { ...state.me, username: name };
  emit('me');
  return name;
}

/** Messages with one friend, oldest first (loads the full recent history). */
export async function loadThread(uid) {
  if (isDemo()) return threadWith(uid);
  const me = state.me?.id;
  const c = await client();
  const { data, error } = await c.from('messages').select('*')
    .or(`and(sender.eq.${me},recipient.eq.${uid}),and(sender.eq.${uid},recipient.eq.${me})`)
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  for (const m of data || []) if (!state.messages.some((x) => x.id === m.id)) state.messages.push(m);
  state.messages.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return threadWith(uid);
}

export const threadWith = (uid) => {
  const me = state.me?.id;
  return state.messages.filter((m) => (m.sender === me && m.recipient === uid) || (m.sender === uid && m.recipient === me))
    .slice().reverse();
};

export async function sendMessage(uid, body) {
  const text = String(body || '').trim().slice(0, 1000);
  if (!text) return null;
  if (isDemo()) {
    const m = { id: Date.now(), sender: state.me.id, recipient: uid, body: text, created_at: new Date().toISOString(), read_at: null };
    state.messages.unshift(m); emit('sent'); return m;
  }
  const c = await client();
  const { data, error } = await c.from('messages')
    .insert({ sender: state.me.id, recipient: uid, body: text }).select().single();
  if (error) throw new Error(/row-level security/i.test(error.message) ? 'You can only message friends.' : error.message);
  if (!state.messages.some((x) => x.id === data.id)) state.messages.unshift(data);
  emit('sent');
  return data;
}

export async function markThreadRead(uid) {
  const me = state.me?.id;
  if (!state.messages.some((m) => m.sender === uid && m.recipient === me && !m.read_at)) return;
  const now = new Date().toISOString();
  state.messages.forEach((m) => { if (m.sender === uid && m.recipient === me && !m.read_at) m.read_at = now; });
  emit('read');
  try { await rpc('mark_chat_read', { p_from: uid }); } catch { /* next load fixes it */ }
}

export async function markNotificationsRead() {
  const now = new Date().toISOString();
  let changed = false;
  state.notifications.forEach((n) => { if (n.user_id && !n.read_at && n.kind !== 'friend_request') { n.read_at = now; changed = true; } });
  const newest = Math.max(0, ...state.notifications.filter((n) => !n.user_id).map((n) => n.id));
  if (newest > readSeen()) { writeSeen(newest); changed = true; }
  if (changed) emit('read');
  try { await rpc('mark_notifications_read'); } catch { /* next load fixes it */ }
}
