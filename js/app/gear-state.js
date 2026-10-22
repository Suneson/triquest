// gear-state.js — your GEAR inventory, spends, gels and wallet, as last read
// from the server. The server is the authority (0014_gear.sql): this module
// only reads, asks the server to buy or use, and keeps a copy on the device so
// the workshop can be browsed offline and the boosts show at once on reload.
// Buying always needs a connection.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo } from './demo.js';
import { coinsEarned, balance, gelsHeld } from '../core/wallet.js';
import { gearById, GEAR_RULES, GEL, KITS, tierId } from '../core/gear.js';
import { canUseGel } from '../core/boosts.js';
import { t } from '../core/i18n.js';

const KEY = 'moske-gear';
const EMPTY = { uid: null, inventory: [], spends: [], boosts: [], wallet: null, at: 0 };
const listeners = new Set();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && Array.isArray(s.inventory) ? { ...EMPTY, ...s } : { ...EMPTY };
  } catch { return { ...EMPTY }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

let state = load();

// demo mode: a part-kitted athlete with a gel running, so the workshop and the
// boosted numbers can be reviewed without an account
function demoState() {
  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const inventory = ['bike-wheels-t1', 'bike-wheels-t2', 'bike-frame-t1', 'bike-aerobars-t1', 'run-shoes-t1', 'gym-belt-t1', 'kit-moske-navy']
    .map((item_id, i) => ({ item_id, acquired_at: ago(24 * 30 - i) }));
  // ?demo=1&gel=0 starts with no gel running (to review taking one)
  let gelOn = true;
  try { gelOn = new URLSearchParams(location.search).get('gel') !== '0'; } catch { /* no location */ }
  const boosts = [{ kind: 'gel', started_at: ago(gelOn ? 1.25 : 72), expires_at: ago(gelOn ? -2.75 : 68), multiplier: 1.3 }];
  const spends = [{ item_id: 'gel', coins: 60 }, { item_id: 'gel', coins: 60 }];
  return { uid: 'demo', inventory, spends, boosts, wallet: { earned: 1640, spent: 1010, balance: 630 }, at: Date.now() };
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
    const [inv, sp, bo, wa] = await Promise.all([
      c.from('user_gear').select('item_id, acquired_at'),
      c.from('coin_spends').select('item_id, coins, created_at'),
      c.from('user_boosts').select('kind, started_at, expires_at, multiplier'),
      c.rpc('wallet'),
    ]);
    const err = inv.error || sp.error || bo.error || wa.error;
    if (err) throw err;
    state = { uid, inventory: inv.data || [], spends: sp.data || [], boosts: bo.data || [], wallet: wa.data || null, at: Date.now() };
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

// demo mode plays the server's rules on the local copy, so the workshop
// moment can be reviewed without an account (nothing is stored or sent)
function demoCall(fn, args) {
  const s = gearState();
  const owned = (id) => s.inventory.some((r) => r.item_id === id);
  const held = gelsHeld(s.spends, s.boosts);
  const now = new Date().toISOString();
  if (fn === 'use_gel') {
    const ok = canUseGel(s.boosts, held, Date.now());
    if (!ok.ok) throw new Error(`gear:gel_${ok.reason}`);
    s.boosts.push({ kind: 'gel', started_at: now, expires_at: new Date(Date.now() + GEAR_RULES.gel.hours * 3600e3).toISOString(), multiplier: 1 + GEAR_RULES.gel.boostBp / 10000 });
  } else {
    const id = args.p_item_id;
    const item = gearById(id) || KITS.find((k) => k.id === id) || (id === 'gel' ? GEL : null);
    if (!item) throw new Error('gear:unknown_item');
    if (item.kind === 'gear' && item.tier === 0) throw new Error('gear:starter');
    if (item.kind !== 'gel' && owned(id)) throw new Error('gear:owned');
    if (item.kind === 'gear' && item.tier > 1 && !owned(tierId(item.sport, item.slot, item.tier - 1))) throw new Error('gear:tier_locked');
    if (item.kind === 'gel' && held >= GEAR_RULES.gel.maxHeld) throw new Error('gear:gel_full');
    if (s.wallet.balance < item.cost) throw new Error('gear:insufficient');
    s.spends.push({ item_id: id, coins: item.cost });
    if (item.kind !== 'gel') s.inventory.push({ item_id: id, acquired_at: now });
    s.wallet = { ...s.wallet, spent: s.wallet.spent + item.cost, balance: s.wallet.balance - item.cost };
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

/** Buy an item (a gear tier, a kit, or a gel). Throws with a `gear:` code. */
export const buyItem = (id) => call('buy_gear', { p_item_id: id });
/** Start a gel. Throws with a `gear:` code. */
export const useGel = () => call('use_gel', { p_kind: 'gel' });

/**
 * Your balance: the server's wallet when it's fresh; otherwise worked out
 * from your sessions the same way (wallet.js), so it shows offline too.
 */
export function walletNow(workouts) {
  const s = gearState();
  const local = { earned: coinsEarned(workouts), spent: (s.spends || []).reduce((n, x) => n + (Number(x.coins) || 0), 0) };
  local.balance = balance(local.earned, s.spends);
  const w = s.wallet;
  return {
    earned: w ? Number(w.earned) : local.earned,
    spent: w ? Number(w.spent) : local.spent,
    balance: w ? Number(w.balance) : local.balance,
    gels: gelsHeld(s.spends, s.boosts),
  };
}
