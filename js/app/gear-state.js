// gear-state.js — your GEAR inventory, spends, gels and wallet, as last read
// from the server. The server is the authority (0014_gear.sql): this module
// only reads, asks the server to buy or use, and keeps a copy on the device so
// the workshop can be browsed offline and the boosts show at once on reload.
// Buying always needs a connection.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo } from './demo.js';
import { walletFold, fuelHeld } from '../core/wallet.js';
import { gearById, GEAR_RULES, KITS, FUELS, fuelById, currencyOf, tierId } from '../core/gear.js';
import { canUseFuel } from '../core/boosts.js';
import { t } from '../core/i18n.js';

const KEY = 'moske-gear';
const EMPTY = { uid: null, inventory: [], spends: [], boosts: [], quests: [], wallet: null, at: 0 };
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
  const inventory = ['bike-wheels-t1', 'bike-wheels-t2', 'bike-frame-t1', 'bike-aerobars-t1', 'run-shoes-t1', 'gym-belt-t1', 'kit-moske-navy', 'kit-moske-sand']
    .map((item_id, i) => ({ item_id, acquired_at: ago(24 * 30 - i) }));
  // ?demo=1&gel=0 starts with no fuel running (to review taking one)
  let gelOn = true;
  try { gelOn = new URLSearchParams(location.search).get('gel') !== '0'; } catch { /* no location */ }
  // a gel taken and waiting for the next workout (or, with gel=0, one an old ride used up)
  const boosts = [gelOn
    ? { id: 1, kind: 'gel', started_at: ago(1.25), expires_at: 'infinity', multiplier: 1.3, until_next: true, workout_id: null }
    : { id: 1, kind: 'gel', started_at: ago(72), expires_at: ago(70), multiplier: 1.3, until_next: true, workout_id: 'demo-old' }];
  const spends = ['gel', 'gel', 'gel-caffeine', 'energy-bar', 'rice-cake', 'pasta'].map((item_id) => ({ item_id, coins: 0, currency: 'carbs', created_at: ago(80) }));
  return { uid: 'demo', inventory, spends, boosts, quests: [], wallet: { coins: 6340, carbs: 2480, cap: GEAR_RULES.storageCap }, at: Date.now() };
}

/** Can this device talk to the workshop at all (signed in, or demo)? */
export const gearEnabled = () => isDemo() || (SYNC_ENABLED && !!currentUser());

/** The current copy: { inventory, spends, boosts, wallet, at }. Only yours. */
let demo = null;
export function gearState() {
  if (isDemo()) return (demo ||= demoState());
  const uid = currentUser()?.id || null;
  return uid && state.uid === uid ? state : { ...EMPTY, uid };
}

export function onGear(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });

/** Read everything again from the server. Resolves to the state (or the cached copy offline). */
export async function refreshGear() {
  if (isDemo() || !gearEnabled()) return gearState();
  const uid = currentUser().id;
  try {
    const c = await client();
    const [inv, sp, bo, qc, wa] = await Promise.all([
      c.from('user_gear').select('item_id, acquired_at'),
      c.from('coin_spends').select('id, item_id, coins, currency, created_at'),
      c.from('user_boosts').select('id, kind, started_at, expires_at, multiplier, until_next, workout_id'),
      c.from('quest_completions').select('day, quest_id'),
      c.rpc('wallet'),
    ]);
    const err = inv.error || sp.error || bo.error || qc.error || wa.error;
    if (err) throw err;
    state = { uid, inventory: inv.data || [], spends: sp.data || [], boosts: bo.data || [], quests: qc.data || [], wallet: wa.data || null, at: Date.now() };
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
  const s = gearState();
  const owned = (id) => s.inventory.some((r) => r.item_id === id);
  const now = new Date().toISOString();
  if (fn === 'use_gel') {
    const kind = args.p_kind;
    const f = fuelById(kind);
    if (!f) throw new Error('gear:unknown_item');
    const ok = canUseFuel(kind, s.boosts, fuelHeld(s.spends, s.boosts, kind), Date.now());
    if (!ok.ok) throw new Error(`gear:fuel_${ok.reason}`);
    s.boosts.push(f.nextWorkout
      ? { id: s.boosts.length + 1, kind, started_at: now, expires_at: 'infinity', multiplier: 1 + f.boostBp / 10000, until_next: true, workout_id: null }
      : { id: s.boosts.length + 1, kind, started_at: now, expires_at: new Date(Date.now() + f.hours * 3600e3).toISOString(), multiplier: 1 + f.boostBp / 10000 });
  } else {
    const id = args.p_item_id;
    const item = gearById(id) || KITS.find((k) => k.id === id) || fuelById(id);
    if (!item) throw new Error('gear:unknown_item');
    const cur = currencyOf(item);
    if (item.kind === 'gear' && item.tier === 0) throw new Error('gear:starter');
    if ((item.kind === 'gear' || item.kind === 'kit') && owned(id)) throw new Error('gear:owned');
    if (item.kind === 'gear' && item.tier > 1 && !owned(tierId(item.sport, item.slot, item.tier - 1))) throw new Error('gear:tier_locked');
    if (fuelById(id) && fuelHeld(s.spends, s.boosts, id) >= item.maxHeld) throw new Error('gear:fuel_full');
    if (s.wallet[cur] < item.cost) throw new Error('gear:insufficient');
    s.spends.push({ item_id: id, coins: item.cost, currency: cur, created_at: now });
    if (item.kind === 'gear' || item.kind === 'kit') s.inventory.push({ item_id: id, acquired_at: now });
    s.wallet = { ...s.wallet, [cur]: s.wallet[cur] - item.cost };
  }
  listeners.forEach((f) => f(s));
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

/**
 * Your coins and carbs: the server's wallet when there is one; otherwise
 * worked out from your sessions the same way (wallet.js), so it shows offline.
 * { coins, carbs, cap, held: { gel, 'energy-bar', pasta } }
 */
export function walletNow(workouts) {
  const s = gearState();
  const w = s.wallet;
  const local = w ? null : walletFold({ workouts, quests: s.quests, spends: s.spends });
  const held = Object.fromEntries(FUELS.map((f) => [f.id, fuelHeld(s.spends, s.boosts, f.id)]));
  return {
    coins: Number(w ? w.coins : local.coins) || 0,
    carbs: Number(w ? w.carbs : local.carbs) || 0,
    cap: GEAR_RULES.storageCap,
    held,
    gels: held.gel,
  };
}
