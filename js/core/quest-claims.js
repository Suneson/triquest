// quest-claims.js — which completed quests still need claiming on the server.
// Pure: given the workouts, settings, today and the local claim ledger, returns
// the claims to send. The server (claim_quest in 0006_quest_xp.sql) is
// idempotent and re-checks every claim, so sending one twice is harmless.

import { QUESTS_SINCE, questsFor, indexByDate } from './quests.js';
import { addDays, diffDays } from './dates.js';

export const claimKey = (day, questId) => `${day}|${questId}`;

/** Quests the server's claim_quest() knows. A quest the server doesn't know
 *  yet would be refused (and never retried), so new client quests wait here
 *  until their migration is live. 'rest-day' needs 0007_rest_quest.sql. */
export const CLAIMABLE = new Set(['plan-done', 'min-45', 'two-disc', 'streak', 'km-10', 'brick', 'pack-bag']);

/** Quests that are only final once the day is over (rest: "nothing logged"). */
const END_OF_DAY = new Set(['rest-day']);

/** Empty ledger. `done` = the server has it; `rejected` = the server refused it
 *  (not complete, cap reached) and it shouldn't be retried for that day. */
export const emptyLedger = () => ({ done: [], rejected: [], backfilled: false });

/** Normalise whatever came out of storage. */
export function readLedger(raw) {
  const l = raw && typeof raw === 'object' ? raw : {};
  return {
    done: Array.isArray(l.done) ? l.done.filter((k) => typeof k === 'string') : [],
    rejected: Array.isArray(l.rejected) ? l.rejected.filter((k) => typeof k === 'string') : [],
    backfilled: !!l.backfilled,
  };
}

/**
 * Claims to send now. Before the one-time backfill it walks every day from
 * QUESTS_SINCE to today; afterwards only the last `recentDays` (default 3,
 * so a sync that lands a day late still claims).
 * @returns {Array<{day: string, quest_id: string, xp: number}>}
 */
export function pendingClaims(today, workouts, settings, ledger, { recentDays = 3, claimable = CLAIMABLE } = {}) {
  const l = readLedger(ledger);
  const skip = new Set([...l.done, ...l.rejected]);
  const byDate = indexByDate(workouts);
  const first = l.backfilled ? addDays(today, -(recentDays - 1)) : QUESTS_SINCE;
  let day = first < QUESTS_SINCE ? QUESTS_SINCE : first;
  const out = [];
  while (diffDays(day, today) <= 0) {
    for (const q of questsFor(day, workouts, settings, byDate)) {
      if (!q.done || skip.has(claimKey(day, q.id)) || !claimable.has(q.id)) continue;
      if (END_OF_DAY.has(q.id) && day >= today) continue;
      out.push({ day, quest_id: q.id, xp: q.xp });
    }
    day = addDays(day, 1);
  }
  return out;
}

/** Fold one server answer into the ledger. Returns a new ledger.
 *  `result`: 'ok' (stored or already stored), 'rejected', or 'retry'. */
export function applyResult(ledger, claim, result) {
  const l = readLedger(ledger);
  const key = claimKey(claim.day, claim.quest_id);
  if (result === 'ok' && !l.done.includes(key)) l.done.push(key);
  if (result === 'rejected' && !l.rejected.includes(key)) l.rejected.push(key);
  return l;
}

/** Drop ledger entries older than `keepDays` so storage stays small. Days that
 *  old are never re-claimed (the recent window has moved past them). */
export function pruneLedger(ledger, today, keepDays = 14) {
  const l = readLedger(ledger);
  if (!l.backfilled) return l;
  const cutoff = addDays(today, -keepDays);
  const keep = (k) => k.slice(0, 10) >= cutoff;
  return { ...l, done: l.done.filter(keep), rejected: l.rejected.filter(keep) };
}

/** Classify a Supabase RPC error: is it worth trying again later? */
export function classifyError(err) {
  if (!err) return 'ok';
  const code = String(err.code || '');
  // 22023 = the server checked the claim and said no; don't loop on it
  if (code === '22023') return 'rejected';
  return 'retry'; // offline, function not deployed yet, auth hiccup…
}
