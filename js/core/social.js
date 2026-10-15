// social.js (core) — the counting behind chat and the bell. Pure; no DOM, no
// network. The app layer (js/app/social.js) feeds it what Supabase returned.

/** Group messages (any order) into one thread per accepted friend, newest first. */
export function groupThreads(messages, meId, friends) {
  const by = new Map();
  const newestFirst = [...(messages || [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const m of newestFirst) {
    const other = m.sender === meId ? m.recipient : m.sender;
    const t = by.get(other) || { last: null, unread: 0 };
    if (!t.last) t.last = m;
    if (m.recipient === meId && !m.read_at) t.unread++;
    by.set(other, t);
  }
  return (friends || []).filter((f) => f.status === 'accepted')
    .map((f) => ({ friend: f, ...(by.get(f.user_id) || { last: null, unread: 0 }) }))
    .sort((a, b) => (b.last?.created_at || b.friend.created_at || '').localeCompare(a.last?.created_at || a.friend.created_at || ''));
}

/** Notifications still to read: my own unread ones, and app news (user_id null) newer than `seenNewsId`. */
export function unreadOf(notifications, seenNewsId = 0) {
  return (notifications || []).filter((n) => (n.user_id ? !n.read_at : n.id > seenNewsId));
}

/**
 * The bell's number: friend requests waiting for me, plus unread notifications
 * other than the friend-request ones (those are already counted as requests).
 */
export function bellCountOf(friends, notifications, seenNewsId = 0) {
  const requests = (friends || []).filter((f) => f.status === 'pending' && f.incoming).length;
  return requests + unreadOf(notifications, seenNewsId).filter((n) => n.kind !== 'friend_request').length;
}

/** "now", "5m", "3h", "Tue", "12 Oct" — short times for chat rows. */
export function chatTime(iso, nowMs = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (nowMs - t) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  const d = new Date(t);
  if (s < 6 * 86400) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Username rules (same as the database): 3-20 of a-z, 0-9 and _. */
export const validUsername = (v) => /^[a-z0-9_]{3,20}$/.test(String(v || '').trim().replace(/^@/, '').toLowerCase());
export const cleanUsername = (v) => String(v || '').trim().replace(/^@/, '').toLowerCase();
