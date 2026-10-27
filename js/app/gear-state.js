// gear-state.js — your GEAR inventory, spends, gels and wallet, as last read
// from the server. The server is the authority (0014_gear.sql): this module
// only reads, asks the server to buy or use, and keeps a copy on the device so
// the workshop can be browsed offline and the boosts show at once on reload.
// Buying always needs a connection.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo } from './demo.js';
import { walletFold, fuelHeld } from '../core/wallet.js';
import { gearById, GEAR_RULES, GEAR_SINCE, KITS, FUELS, fuelById, currencyOf, tierId } from '../core/gear.js';
import { withFitted, jobPhase, placeJob, fitMinutes, cancelRefund, reflow, WORKSHOP_RULES } from '../core/workshop.js';
import { propById } from '../core/scenes.js';
import { canUseFuel, starRow } from '../core/boosts.js';
import { collectionAwards, sportLevel } from '../core/collections.js';
import { t } from '../core/i18n.js';

const KEY = 'moske-gear';
// jobs, bays and offset come from workshop() (0022): offset is the server's clock
// minus this device's, so countdowns follow the server however the phone is set
// blueprints (rare props built) and prestige (stars) come from 0023 (docs/LOOP.md §4)
const EMPTY = { uid: null, inventory: [], spends: [], boosts: [], quests: [], wallet: null, jobs: [], bays: 1, offset: 0, at: 0, blueprints: [], prestige: [] };
const listeners = new Set();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && Array.isArray(s.inventory) ? { ...EMPTY, ...s } : { ...EMPTY };
  } catch { return { ...EMPTY }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

let state = load();

// demo mode: a part-kitted athlete with a gel running, so the shop, the
// inventory and the boosted numbers can be reviewed without an account
function demoState() {
  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const inventory = ['bike-wheels-t1', 'bike-wheels-t2', 'bike-frame-t1', 'bike-aerobars-t1', 'bike-power-t1', 'run-shoes-t1', 'gym-belt-t1', 'kit-moske-navy', 'kit-moske-sand']
    .map((item_id, i) => ({ item_id, acquired_at: ago(24 * 30 - i) }));
  // ?demo=1&gel=0 starts with no fuel running (to review taking one)
  let gelOn = true;
  try { gelOn = new URLSearchParams(location.search).get('gel') !== '0'; } catch { /* no location */ }
  // a gel taken and waiting for the next workout (or, with gel=0, one an old ride used up)
  const boosts = [gelOn
    ? { id: 1, kind: 'gel', started_at: ago(1.25), expires_at: 'infinity', multiplier: 1.3, until_next: true, workout_id: null }
    : { id: 1, kind: 'gel', started_at: ago(72), expires_at: ago(70), multiplier: 1.3, until_next: true, workout_id: 'demo-old' }];
  const spends = ['gel', 'gel', 'gel-caffeine', 'energy-bar', 'rice-cake', 'pasta'].map((item_id) => ({ item_id, coins: 0, currency: 'carbs', created_at: ago(80) }));
  // the workshop: the bike lights fitted last week, the run's water station done
  // an hour ago, top wheels mid-fit, and a bike rack waiting behind them
  const min = (m) => new Date(Date.now() + m * 60e3).toISOString();
  const jobs = [
    { id: 1, item_id: 'bike-lights', cost: 600, bay: 1, started_at: ago(170), finishes_at: ago(167), state: 'done' },
    { id: 2, item_id: 'run-water', cost: 180, bay: 1, started_at: ago(1.5), finishes_at: ago(1), state: 'queued' },
    { id: 3, item_id: 'bike-wheels-t3', cost: 850, bay: 1, started_at: min(-50), finishes_at: min(190), state: 'queued' },
    { id: 4, item_id: 'bike-rack', cost: 180, bay: 1, started_at: min(190), finishes_at: min(220), state: 'queued' },
  ];
  // twenty missions done since the start: twenty fragments towards a rare prop (24)
  const quests = Array.from({ length: 20 }, (_, i) => ({ day: GEAR_SINCE, quest_id: `demo-${i}` }));
  return { uid: 'demo', inventory, spends, boosts, quests, wallet: { coins: 6340, carbs: 2480, cap: GEAR_RULES.storageCap }, jobs, bays: 1, offset: 0, at: Date.now(), blueprints: [], prestige: [] };
}

/** Can this device talk to the workshop at all (signed in, or demo)? */
export const gearEnabled = () => isDemo() || (SYNC_ENABLED && !!currentUser());

let demo = null;
function rawState() {
  if (isDemo()) return (demo ||= demoState());
  const uid = currentUser()?.id || null;
  return uid && state.uid === uid ? state : { ...EMPTY, uid };
}

/** Now, by the server's clock (as last seen). */
export const serverNow = () => Date.now() + (Number(rawState().offset) || 0);

/**
 * The current copy: { inventory, spends, boosts, wallet, jobs, bays, at }. Only
 * yours. A job that has finished counts in `inventory` from its finish time,
 * even before the server has been asked again.
 */
export function gearState() {
  const s = rawState();
  return { ...s, inventory: [...withFitted(s.inventory, s.jobs, serverNow()), ...loopRows(s)] };
}

// rare props you built and prestige stars, as inventory rows: the scene draws
// the props, the quadrant counts them, and gearBoost() adds the stars
const loopRows = (s) => [
  ...(s.blueprints || []).map((b) => ({ item_id: b.item_id, acquired_at: b.built_at })),
  ...(s.prestige || []).map((p) => starRow(p.sport, p.star, p.created_at)),
];

/** A sport's level from its boosted XP, after any prestige resets: { level, …, stars, artLevel }. */
export const sportLevelOf = (sport, xp) => sportLevel(xp, rawState().prestige, sport);

export function onGear(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => {
  listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  watchWorkshop();
};

// ---- the workshop: finishing, and saying so ------------------------------------------

const SEEN_KEY = 'moske-ws-seen';    // finished jobs you've looked at (the shop button's dot)
const SAID_KEY = 'moske-ws-said';    // finished jobs already announced
const finishListeners = new Set();
/** Called with [job…] when jobs finish while you watch (or since you last looked). */
export const onWorkshopFinish = (fn) => { finishListeners.add(fn); return () => finishListeners.delete(fn); };
const readIds = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k)) || []); } catch { return new Set(); } };
const writeIds = (k, ids) => { try { localStorage.setItem(k, JSON.stringify([...ids].slice(-200))); } catch { /* private mode */ } };
const jobKey = (j) => `${rawState().uid || 'x'}:${j.id}`;

/** Finished jobs you haven't seen in the shop yet (the dot on the shop button). */
export function unseenFinished() {
  const seen = readIds(SEEN_KEY);
  const now = serverNow();
  return (rawState().jobs || []).filter((j) => jobPhase(j, now) === 'done' && Date.now() - Date.parse(j.finishes_at) < 7 * 864e5 && !seen.has(jobKey(j)));
}
export function markWorkshopSeen() {
  const seen = readIds(SEEN_KEY);
  const now = serverNow();
  (rawState().jobs || []).filter((j) => jobPhase(j, now) === 'done').forEach((j) => seen.add(jobKey(j)));
  writeIds(SEEN_KEY, seen);
}

let watchTimer = null;
let firstLook = true;
/** Announce what has finished, then wake for the next finish. */
function watchWorkshop() {
  clearTimeout(watchTimer);
  const s = rawState();
  const now = serverNow();
  const said = readIds(SAID_KEY);
  const done = (s.jobs || []).filter((j) => jobPhase(j, now) === 'done' && j.state !== 'cancelled' && !said.has(jobKey(j)));
  if (done.length) {
    done.forEach((j) => said.add(jobKey(j)));
    writeIds(SAID_KEY, said);
    // the first look on a device only records (no stamp for last month's jobs)
    const recent = done.filter((j) => !firstLook || Date.now() - Date.parse(j.finishes_at) < 6 * 3600e3);
    if (recent.length) finishListeners.forEach((fn) => { try { fn(recent); } catch (e) { console.error(e); } });
  }
  firstLook = false;
  const next = (s.jobs || []).filter((j) => jobPhase(j, now) !== 'done' && j.state !== 'cancelled')
    .reduce((m, j) => Math.min(m, Date.parse(j.finishes_at)), Infinity);
  if (Number.isFinite(next)) {
    const wait = Math.min(2 ** 31 - 1, Math.max(500, next - now + 800));
    watchTimer = setTimeout(() => { if (isDemo()) { listeners.forEach((fn) => fn(state)); watchWorkshop(); } else refreshGear(); }, wait);
  }
}

/** Read everything again from the server. Resolves to the state (or the cached copy offline). */
export async function refreshGear() {
  if (isDemo()) { watchWorkshop(); return gearState(); }
  if (!gearEnabled()) return gearState();
  const uid = currentUser().id;
  try {
    const c = await client();
    // the workshop first: it settles finished jobs into user_gear before the rest is read
    const t0 = Date.now();
    const ws = await c.rpc('workshop');
    const t1 = Date.now();
    const [inv, sp, bo, qc, wa, bp, pr] = await Promise.all([
      c.from('user_gear').select('item_id, acquired_at'),
      c.from('coin_spends').select('id, item_id, coins, currency, created_at'),
      c.from('user_boosts').select('id, kind, started_at, expires_at, multiplier, until_next, workout_id'),
      c.from('quest_completions').select('day, quest_id'),
      c.rpc('wallet'),
      c.from('user_blueprints').select('item_id, fragments, built_at'),
      c.from('user_prestige').select('sport, star, xp_at, created_at'),
    ]);
    const err = inv.error || sp.error || bo.error || qc.error || wa.error;
    if (err) throw err;
    // before 0022 is live there's no workshop: everything bought is owned at once, as before
    const w = ws.error ? null : ws.data;
    const offset = w?.now ? Date.parse(w.now) - (t0 + t1) / 2 : 0;
    state = { uid, inventory: inv.data || [], spends: sp.data || [], boosts: bo.data || [], quests: qc.data || [], wallet: wa.data || null,
      jobs: w?.jobs || [], bays: w?.bays || WORKSHOP_RULES.bays, offset: Number.isFinite(offset) ? offset : 0, at: Date.now(),
      // before 0023 is live these tables aren't there: nothing built, no stars
      blueprints: bp.error ? [] : bp.data || [], prestige: pr.error ? [] : pr.data || [] };
    save(state);
    emit();
  } catch (e) {
    console.warn('gear refresh failed', e);
  }
  return gearState();
}

/** Turn a server error ('gear:insufficient') into words. */
export function gearError(e) {
  const code = String(e?.message || e || '').match(/gear:([a-z_]+)/)?.[1];
  if (code) return t(`gear.err.${code}`);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return t('gear.err.offline');
  return t('gear.err.generic');
}

// demo mode plays the server's rules on the local copy, so the shop moment
// can be reviewed without an account (nothing is stored or sent)
function demoCall(fn, args) {
  const s = rawState();
  if (fn === 'build_blueprint') {
    s.blueprints.push({ item_id: args.p_item, fragments: 24, built_at: new Date().toISOString() });
    listeners.forEach((f) => f(s));
    return s;
  }
  if (fn === 'prestige') {
    const star = s.prestige.filter((p) => p.sport === args.p_sport).length + 1;
    s.prestige.push({ sport: args.p_sport, star, xp_at: args.xp, created_at: new Date().toISOString() });
    listeners.forEach((f) => f(s));
    return s;
  }
  if (fn === 'workshop_cancel' || fn === 'workshop_skip') return demoJob(fn, args, s);
  const owned = (id) => s.inventory.some((r) => r.item_id === id);
  const now = new Date().toISOString();
  if (fn === 'use_gel') {
    const kind = args.p_kind;
    const f = fuelById(kind);
    if (!f) throw new Error('gear:unknown_item');
    const ok = canUseFuel(kind, s.boosts, fuelHeld(s.spends, s.boosts, kind, s.jobs), Date.now());
    if (!ok.ok) throw new Error(`gear:fuel_${ok.reason}`);
    s.boosts.push(f.nextWorkout
      ? { id: s.boosts.length + 1, kind, started_at: now, expires_at: 'infinity', multiplier: 1 + f.boostBp / 10000, until_next: true, workout_id: null }
      : { id: s.boosts.length + 1, kind, started_at: now, expires_at: new Date(Date.now() + f.hours * 3600e3).toISOString(), multiplier: 1 + f.boostBp / 10000 });
  } else {
    const id = args.p_item_id;
    const item = gearById(id) || KITS.find((k) => k.id === id) || fuelById(id) || propById(id);
    if (!item) throw new Error('gear:unknown_item');
    const cur = currencyOf(item);
    if (item.kind === 'gear' && item.tier === 0) throw new Error('gear:starter');
    const inShop = (x) => s.jobs.some((j) => j.item_id === x && jobPhase(j, Date.now()) !== 'done' && j.state !== 'cancelled');
    if (owned(id) || withFitted(s.inventory, s.jobs).some((r) => r.item_id === id)) throw new Error('gear:owned');
    if (inShop(id)) throw new Error('gear:in_workshop');
    const below = item.kind === 'gear' && item.tier > 1 ? tierId(item.sport, item.slot, item.tier - 1) : null;
    if (below && !owned(below) && !inShop(below) && !withFitted(s.inventory, s.jobs).some((r) => r.item_id === below)) throw new Error('gear:tier_locked');
    if (fuelById(id) && fuelHeld(s.spends, s.boosts, id, s.jobs) >= item.maxHeld) throw new Error('gear:fuel_full');
    if (s.wallet[cur] < item.cost) throw new Error('gear:insufficient');
    s.spends.push({ item_id: id, coins: item.cost, currency: cur, created_at: now });
    const mins = fitMinutes(id);
    if (mins) {
      const at = placeJob(s.jobs, s.bays, mins, Date.now());
      s.jobs.push({ id: Math.max(0, ...s.jobs.map((j) => j.id)) + 1, item_id: id, cost: item.cost, bay: at.bay, state: 'queued',
        started_at: new Date(at.startMs).toISOString(), finishes_at: new Date(at.finishMs).toISOString() });
    } else if (item.kind === 'kit') s.inventory.push({ item_id: id, acquired_at: now });
    s.wallet = { ...s.wallet, [cur]: s.wallet[cur] - item.cost };
  }
  listeners.forEach((f) => f(s));
  watchWorkshop();
  return s;
}

function demoJob(fn, args, s) {
  const j = s.jobs.find((x) => x.id === args.p_job);
  const now = Date.now();
  if (!j || ['done', 'cancelled'].includes(jobPhase(j, now))) throw new Error('gear:job_done');
  if (fn === 'workshop_skip') {
    if (jobPhase(j, now) !== 'fitting') throw new Error('gear:not_fitting');
    if (fuelHeld(s.spends, s.boosts, args.p_kind, s.jobs) < 1) throw new Error('gear:fuel_none');
    j.finishes_at = new Date(now).toISOString();
    j.skipped_with = args.p_kind;
  } else {
    const { refund, midfit } = cancelRefund(j, s.jobs, now);
    Object.assign(j, { state: 'cancelled', midfit, refund, cancelled_at: new Date(now).toISOString() });
    s.wallet = { ...s.wallet, coins: s.wallet.coins + refund };
  }
  s.jobs = reflow(s.jobs, j.bay, now);
  listeners.forEach((f) => f(s));
  watchWorkshop();
  return s;
}

async function call(fn, args) {
  if (isDemo()) return demoCall(fn, args);
  if (!gearEnabled()) throw new Error('gear:not_signed_in');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('gear:offline');
  const c = await client();
  const { error } = await c.rpc(fn, args);
  if (error) throw error;
  return refreshGear();
}

/** Buy an item (a gear tier, clothes, or fuel). Throws with a `gear:` code. */
export const buyItem = (id) => call('buy_gear', { p_item_id: id });
/** Start a fuel (gel, energy bar, pasta). Throws with a `gear:` code. */
export const useFuel = (kind) => call('use_gel', { p_kind: kind });
export const useGel = () => useFuel('gel');
/** Take a job out of the workshop (free before it starts; see cancelRefund()). */
export const cancelJob = (id) => call('workshop_cancel', { p_job: id });
/** Finish the job being fitted now with a gel of this kind. */
export const skipJob = (id, kind) => call('workshop_skip', { p_job: id, p_kind: kind });
/** Build a rare prop from blueprint fragments (docs/LOOP.md §4.2). */
export const buildBlueprint = (id) => call('build_blueprint', { p_item: id });
/** Reset a discipline's level for a star (§4.3). `xp` is only for demo mode; the server reads its own. */
export const takePrestige = (sport, xp) => (isDemo() ? demoCall('prestige', { p_sport: sport, xp }) : call('prestige', { p_sport: sport }));

/**
 * Your coins and carbs: the server's wallet when there is one; otherwise
 * worked out from your sessions the same way (wallet.js), so it shows offline.
 * { coins, carbs, cap, held: { gel, 'energy-bar', pasta } }
 */
export function walletNow(workouts) {
  const s = gearState();
  const w = s.wallet;
  const local = w ? null : walletFold({ workouts, quests: s.quests, spends: s.spends, awards: collectionAwards(s.inventory) });
  const held = Object.fromEntries(FUELS.map((f) => [f.id, fuelHeld(s.spends, s.boosts, f.id, s.jobs)]));
  return {
    coins: Number(w ? w.coins : local.coins) || 0,
    carbs: Number(w ? w.carbs : local.carbs) || 0,
    cap: GEAR_RULES.storageCap,
    held,
    gels: held.gel,
  };
}
