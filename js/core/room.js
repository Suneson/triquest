// room.js — the General chat's rules, pure and tested: what a message may
// say, how fast you may post, what's unread, how a blocked author shows,
// and how optimistic bubbles reconcile with the server's copy.

import { t } from './i18n.js';

export const MAX_LEN = 500;
export const RATE_PER_MIN = 10; // mirrors the server trigger (0012_general_chat.sql)

/** Trimmed text if it may be sent, or an error message. */
export function checkBody(text) {
  const body = String(text ?? '').trim();
  if (!body) return { error: t('room.writeFirst') };
  if (body.length > MAX_LEN) return { error: t('room.tooLong', { n: MAX_LEN }) };
  return { body };
}

/** Would one more post now break the per-minute limit? `sentAt` = my recent post times (ms). */
export function rateLimited(sentAt, now = Date.now(), limit = RATE_PER_MIN) {
  return sentAt.filter((at) => now - at < 60000).length >= limit;
}

/**
 * Messages as the room shows them, oldest first: removed ones stay as a
 * "removed" line, blocked authors fold to "message hidden" (no text kept).
 * A pending bubble (optimistic, `pending: true`) whose client_id the server
 * already echoed is dropped in favour of the real row.
 */
export function roomView(messages, { blocked = new Set(), me = null } = {}) {
  const echoed = new Set(messages.filter((m) => !m.pending && m.client_id).map((m) => m.client_id));
  return messages
    .filter((m) => !(m.pending && echoed.has(m.client_id)))
    .slice()
    .sort((a, b) => (a.created_at === b.created_at ? (a.id > b.id ? 1 : -1) : a.created_at < b.created_at ? -1 : 1))
    .map((m) => {
      const mine = !!me && m.user_id === me;
      if (m.deleted_at) return { ...m, mine, kind: 'removed', body: '' };
      if (!mine && blocked.has(m.user_id)) return { ...m, mine, kind: 'hidden', body: '' };
      return { ...m, mine, kind: m.pending ? (m.failed ? 'failed' : 'pending') : 'msg' };
    });
}

/** Unread in the room: real messages from others (not blocked, not removed) newer than what I've seen. */
export function roomUnread(messages, { lastSeenId = 0, me = null, blocked = new Set() } = {}) {
  return messages.filter((m) => !m.pending && !m.deleted_at && m.id > lastSeenId
    && m.user_id !== me && !blocked.has(m.user_id)).length;
}

/** Merge a page of older messages (or a realtime row) without duplicates. */
export function mergeMessages(list, incoming) {
  const byId = new Map(list.filter((m) => !m.pending).map((m) => [m.id, m]));
  const pending = list.filter((m) => m.pending);
  for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m });
  return [...byId.values(), ...pending];
}

/** A fresh client id for an optimistic bubble. */
export const clientId = (now = Date.now(), rnd = Math.random()) => `c${now.toString(36)}${Math.floor(rnd * 1e8).toString(36)}`;
