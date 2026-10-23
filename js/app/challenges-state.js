// challenges-state.js — the challenges you can see (the room's, and ones you're
// in), their people, results and live standings, as last read from the server
// (0019_challenges.sql). The server decides everything that pays: creating,
// joining, leaving, cancelling and settling are its functions; this module
// asks, then reads back. Changes arrive live (realtime) and on pull.
//
// ?demo=1 plays a small set locally so the screens can be reviewed.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo } from './demo.js';
import { t } from '../core/i18n.js';
import { addDays, todayISO } from '../core/dates.js';
import { refreshGear } from './gear-state.js';

const EMPTY = { ready: false, list: [], people: [], results: [], standings: new Map(), error: null };
let state = { ...EMPTY, standings: new Map() };
const listeners = new Set();
let channel = null;

export const onChallenges = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (why) => listeners.forEach((fn) => { try { fn(why); } catch (e) { console.error(e); } });

export const challengesEnabled = () => isDemo() || (SYNC_ENABLED && !!currentUser());
export const me = () => (isDemo() ? 'demo-me' : currentUser()?.id || null);
export const challengesState = () => state;
export const challengeById = (id) => state.list.find((c) => c.id === id) || null;
export const peopleOf = (id) => state.people.filter((p) => p.challenge_id === id);
export const resultOf = (id) => state.results.find((r) => r.challenge_id === id) || null;
export const standingsOf = (id) => state.standings.get(id) || null;
export const myStatus = (id) => peopleOf(id).find((p) => p.user_id === me())?.status || null;

/** A server error ('ch:share') as words. */
export function challengeError(e) {
  const code = String(e?.message || e || '').match(/ch:([a-z_]+)/)?.[1];
  if (code) return t(`chx.err.${code}`);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return t('chx.err.offline');
  return t('chx.err.generic');
}

// ---- demo --------------------------------------------------------------------------

function demoState() {
  const today = todayISO();
  const mk = (id, over) => ({
    id, creator: 'demo-me', kind: 'distance', sport: 'run', params: {}, starts_on: addDays(today, 1), ends_on: addDays(today, 7),
    stake: 50, payout: 'winner', visibility: 'room', state: 'open', created_at: new Date().toISOString(), ...over,
  });
  const list = [
    mk('demo-open', { creator: 'd-11', kind: 'fastest', params: { dist: '5k' }, stake: 40 }),
    mk('demo-run', { kind: 'distance', sport: 'bike', starts_on: addDays(today, -3), ends_on: addDays(today, 3), stake: 60, payout: 'top3' }),
    mk('demo-done', { creator: 'd-12', kind: 'sessions', sport: 'any', starts_on: addDays(today, -12), ends_on: addDays(today, -6), stake: 30, state: 'settled' }),
    mk('demo-invite', { creator: 'd-12', kind: 'longest', sport: 'bike', params: { targetMin: 180 }, visibility: 'direct', stake: 0 }),
  ];
  const p = (challenge_id, user_id, status = 'joined', stake = 0) => ({ challenge_id, user_id, status, stake, display_name: { 'demo-me': t('chx.you'), 'd-11': 'Hannah', 'd-12': 'Yusuf', 'd-13': 'Leire', 'd-14': 'Marco' }[user_id] });
  const people = [
    p('demo-open', 'd-11', 'joined', 40), p('demo-open', 'd-13', 'joined', 40),
    p('demo-run', 'demo-me', 'joined', 60), p('demo-run', 'd-11', 'joined', 60), p('demo-run', 'd-12', 'joined', 60), p('demo-run', 'd-14', 'joined', 60),
    p('demo-done', 'd-12', 'joined', 30), p('demo-done', 'demo-me', 'joined', 30), p('demo-done', 'd-13', 'joined', 30),
    p('demo-invite', 'd-12', 'joined'), p('demo-invite', 'demo-me', 'invited'),
  ];
  const results = [{ challenge_id: 'demo-done', outcome: 'settled', pot: 90, fee: 4, prize: 86, burned: 4, rule: {}, rows: [
    { user: 'demo-me', stake: 30, score: 5, place: 1, payout: 86 }, { user: 'd-12', stake: 30, score: 4, place: 2, payout: 0 },
    { user: 'd-13', stake: 30, score: null, place: null, payout: 0 }] }];
  const standings = new Map([['demo-run', [
    { user_id: 'd-11', display_name: 'Hannah', score: 14230, place: 1, cut: false },
    { user_id: 'demo-me', display_name: t('chx.you'), score: 11850, place: 2, cut: false },
    { user_id: 'd-14', display_name: 'Marco', score: 9020, place: 3, cut: true },
    { user_id: 'd-12', display_name: 'Yusuf', score: null, place: null, cut: false }]]]);
  return { ready: true, list, people, results, standings, error: null };
}

// ---- reading -------------------------------------------------------------------------

/** Read everything again (and settle anything that's due). */
export async function refreshChallenges() {
  if (isDemo()) { if (!state.ready) { state = demoState(); emit('load'); } return state; }
  if (!challengesEnabled()) return state;
  try {
    const c = await client();
    await c.rpc('resolve_due').catch(() => {});
    const since = addDays(todayISO(), -30);
    const [ch, pp, rs] = await Promise.all([
      c.from('challenges').select('*').gte('ends_on', since).order('starts_on', { ascending: true }).limit(60),
      c.rpc('challenge_people', { p_since: since }),
      c.from('challenge_results').select('*'),
    ]);
    const err = ch.error || pp.error || rs.error;
    if (err) throw err;
    const ids = new Set((ch.data || []).map((x) => x.id));
    const people = (pp.data || []).filter((p) => ids.has(p.challenge_id));
    state = {
      ...state, ready: true, error: null, list: ch.data || [],
      people: people.map((p) => ({ ...p, display_name: p.user_id === me() ? t('chx.you') : p.display_name || t('chx.athlete') })),
      results: (rs.data || []).filter((r) => ids.has(r.challenge_id)),
    };
    subscribe(c);
    emit('load');
  } catch (e) {
    state = { ...state, ready: true, error: String(e?.message || e) };
    emit('error');
  }
  return state;
}

/** Live standings for one challenge (scores now, places, ceilings). */
export async function refreshStandings(id) {
  if (isDemo()) return standingsOf(id);
  try {
    const c = await client();
    const { data, error } = await c.rpc('challenge_standings', { p_id: id });
    if (error) throw error;
    state.standings.set(id, (data || []).map((r) => ({ ...r, display_name: r.user_id === me() ? t('chx.you') : r.display_name,
      score: r.score == null ? null : Number(r.score), place: r.place == null ? null : Number(r.place) })));
    emit('standings');
  } catch (e) { console.warn('standings failed', e); }
  return standingsOf(id);
}

function subscribe(c) {
  if (channel) return;
  let timer = null;
  const again = () => { clearTimeout(timer); timer = setTimeout(() => refreshChallenges(), 400); };
  channel = c.channel('challenges')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, again)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_participants' }, again)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_results' }, again)
    .subscribe();
}

export function stopChallenges() {
  channel?.unsubscribe?.(); channel = null;
  state = { ...EMPTY, standings: new Map() };
}

// ---- asking the server ---------------------------------------------------------------

async function call(fn, args) {
  if (isDemo()) return demoCall(fn, args);
  if (!challengesEnabled()) throw new Error('ch:not_signed_in');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('ch:offline');
  const c = await client();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  await refreshChallenges();
  refreshGear(); // a stake or a refund moved coins
  return data;
}

export const createChallenge = (p) => call('create_challenge', { p });
export const joinChallenge = (id) => call('join_challenge', { p_id: id });
export const declineChallenge = (id) => call('decline_challenge', { p_id: id });
export const cancelChallenge = (id) => call('cancel_challenge', { p_id: id });

function demoCall(fn, args) {
  const today = todayISO();
  if (fn === 'create_challenge') {
    const id = `demo-${Date.now()}`;
    state.list.push({ ...args.p, id, creator: 'demo-me', state: 'open', created_at: new Date().toISOString() });
    state.people.push({ challenge_id: id, user_id: 'demo-me', status: 'joined', stake: args.p.stake, display_name: t('chx.you') });
  } else {
    const c = challengeById(args.p_id);
    if (!c) throw new Error('ch:not_found');
    if (today >= c.starts_on) throw new Error('ch:closed');
    const mine = peopleOf(c.id).find((p) => p.user_id === 'demo-me');
    if (fn === 'join_challenge') {
      if (mine) Object.assign(mine, { status: 'joined', stake: c.stake });
      else state.people.push({ challenge_id: c.id, user_id: 'demo-me', status: 'joined', stake: c.stake, display_name: t('chx.you') });
    } else if (fn === 'decline_challenge' && mine) Object.assign(mine, { status: 'declined', stake: 0 });
    else if (fn === 'cancel_challenge') c.state = 'cancelled';
  }
  emit('load');
  return null;
}
