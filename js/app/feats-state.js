// feats-state.js — the feats you've won, as last read from the server
// (0018_feats.sql). The server decides: refreshing asks it to award anything
// new (award_feats, idempotent) and reads back user_feats. A copy is kept on
// the device so the board and the trophy case show at once on reload.
//
// Signed out, the app works the same rules out on the device (evaluateFeats)
// so the trophy case still shows what you'd have; nothing is stored or paid.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo } from './demo.js';
import { evaluateFeats, featItemsOwned, featById } from '../core/feats.js';
import * as store from './store.js';

const KEY = 'moske-feats';
const EMPTY = { uid: null, rows: [], at: 0 };
const listeners = new Set();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && Array.isArray(s.rows) ? { ...EMPTY, ...s } : { ...EMPTY };
  } catch { return { ...EMPTY }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

let state = load();

const fromRow = (r) => ({
  featId: r.feat_id, season: r.season, workoutId: r.workout_id, value: r.value == null ? null : Number(r.value),
  date: r.achieved_on, whole: !!r.whole, logged: !!r.logged,
});

// demo mode: a few feats won and a few close, so the board and the case can be reviewed
const DEMO = [
  { featId: 'run-10k', season: '2026-Q4', value: 10.4, date: '2026-10-25' },
  { featId: 'run-5k-25', season: '2026-Q4', value: 1452, date: '2026-10-25' },
  { featId: 'run-month-50', season: '2026-Q4', value: 63.2, date: '2026-10-29' },
  { featId: 'bike-50', season: '2026-Q4', value: 62.1, date: '2026-10-24' },
  { featId: 'bike-100', season: '2026-Q4', value: 104.6, date: '2026-10-31' },
  { featId: 'bike-160', season: '2026-Q4', value: 161.3, date: '2026-11-07' },
  { featId: 'swim-1k', season: '2026-Q4', value: 1.5, date: '2026-10-26' },
  { featId: 'swim-2k', season: '2026-Q4', value: 2.2, date: '2026-11-02' },
  { featId: 'cross-four-weeks', season: '2026-Q4', value: 4, date: '2026-11-22' },
].map((a) => ({ workoutId: null, whole: false, logged: false, ...a }));
// held back so a review (and the clips) can watch one being won: demoUnlock()
const DEMO_NEXT = [{ featId: 'run-half', season: '2026-Q4', value: 21.3, date: '2026-11-15', workoutId: null, whole: false, logged: false }];
let demoWon = [];

/** Can this device ask the server for feats (signed in, or demo)? */
export const featsSynced = () => isDemo() || (SYNC_ENABLED && !!currentUser());

/** Your awards: [{ featId, season, workoutId, value, date, whole, logged }]. */
export function featAwards() {
  if (isDemo()) return [...DEMO, ...demoWon];
  const uid = currentUser()?.id || null;
  if (uid && SYNC_ENABLED) return state.uid === uid ? state.rows : [];
  // signed out: the same rules, worked out here
  const settings = store.getSettings() || {};
  return evaluateFeats(store.getWorkouts(), { bodyweights: settings.bodyMetrics, events: settings.events }).awards;
}

/** Items your feats have earned: [{ id, season, featId }]. */
export const featItems = () => featItemsOwned(featAwards());
export const ownsFeatItem = (id) => featItems().some((i) => i.id === id);

export function onFeats(fn) { listeners.add(fn); return () => listeners.delete(fn); }
// the sports a feat was just won in, for a few seconds: the board flashes once
let fresh = { at: 0, sports: new Set() };
export const justWon = (sport) => Date.now() - fresh.at < 4000 && (fresh.sports.has(sport) || fresh.sports.has('cross'));
const emit = (won = []) => {
  if (won.length) fresh = { at: Date.now(), sports: new Set(won.map((a) => featById(a.featId)?.sport).filter(Boolean)) };
  listeners.forEach((fn) => { try { fn(won); } catch (e) { console.error(e); } });
};

/** ?demo=1 only: win the held-back feat now, as a sync would. */
export function demoUnlock() {
  if (!isDemo() || demoWon.length) return [];
  demoWon = DEMO_NEXT;
  emit(demoWon);
  return demoWon;
}

let inflight = null;
/**
 * Ask the server to award anything new, then read every award back.
 * Resolves to the newly won awards (empty when nothing changed or offline).
 */
export function refreshFeats() {
  if (isDemo() || !featsSynced()) return Promise.resolve([]);
  if (inflight) return inflight;
  const uid = currentUser().id;
  inflight = (async () => {
    try {
      const c = await client();
      const won = await c.rpc('award_feats');
      if (won.error) throw won.error;
      const all = await c.from('user_feats').select('feat_id, season, workout_id, value, whole, logged, achieved_on');
      if (all.error) throw all.error;
      state = { uid, rows: (all.data || []).map(fromRow), at: Date.now() };
      save(state);
      const got = (won.data || []).map(fromRow);
      emit(got);
      return got;
    } catch (e) {
      console.warn('feats refresh failed', e);
      return [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
