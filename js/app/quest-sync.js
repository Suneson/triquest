// quest-sync.js — sends completed daily quests to the server so quest XP counts
// in Ranks. Queued and retried: if the athlete is offline (or the migration
// isn't deployed yet) nothing is lost; the next attempt picks it up. The plan of
// what to send lives in core/quest-claims.js (pure, tested).

import { SYNC_ENABLED } from './config.js';
import { client, currentUser } from './auth.js';
import * as store from './store.js';
import { todayISO } from '../core/dates.js';
import { pendingClaims, applyResult, pruneLedger, readLedger, classifyError } from '../core/quest-claims.js';

const MIN_GAP_MS = 60 * 1000;       // don't hammer the RPC on every render
let _running = false;
let _lastRun = 0;

const ledgerKey = (uid) => `moske-quest-claims:${uid}`;
function loadLedger(uid) {
  try { return readLedger(JSON.parse(localStorage.getItem(ledgerKey(uid)) || 'null')); } catch { return readLedger(null); }
}
function saveLedger(uid, ledger) {
  try { localStorage.setItem(ledgerKey(uid), JSON.stringify(ledger)); } catch { /* private mode: retry next time */ }
}

/** Claim whatever is pending. Safe to call often; it throttles itself. */
export async function syncQuestClaims({ force = false } = {}) {
  const user = currentUser?.();
  if (!SYNC_ENABLED || !user || _running) return;
  if (!force && Date.now() - _lastRun < MIN_GAP_MS) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  _running = true;
  _lastRun = Date.now();
  try {
    const today = todayISO();
    let ledger = loadLedger(user.id);
    const todo = pendingClaims(today, store.getWorkouts(), store.getSettings(), ledger);
    const c = await client();
    for (const claim of todo) {
      const { error } = await c.rpc('claim_quest', { p_day: claim.day, p_quest_id: claim.quest_id });
      const result = classifyError(error);
      if (result === 'retry') break;              // offline / not deployed: stop, try later
      ledger = applyResult(ledger, claim, result);
      saveLedger(user.id, ledger);
    }
    if (!ledger.backfilled && todo.every((cl) => {
      const k = `${cl.day}|${cl.quest_id}`;
      return ledger.done.includes(k) || ledger.rejected.includes(k);
    })) {
      ledger = { ...ledger, backfilled: true };   // the one-time history pass is done
    }
    saveLedger(user.id, pruneLedger(ledger, today));
  } catch { /* network or client load failure: the next call retries */ } finally {
    _running = false;
  }
}

// back online → try straight away
if (typeof window !== 'undefined') window.addEventListener('online', () => syncQuestClaims({ force: true }));
