// chests-state.js — your reward chests, as last read from the server
// (my_chests(), 0027_reward_chests.sql). The server makes them, rolls them and
// pays them when they're opened; this module asks, keeps a copy, and says which
// ones the device hasn't announced yet (the banner shows each chest once).
// Demo mode keeps two chests on the device and opens them locally.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { isDemo } from './demo.js';
import { refreshGear, demoCredit } from './gear-state.js';
import { chestBonus, rollChestTier, CHEST_RULES } from '../core/rewards.js';
import { rollBottles, bottlesHeld, BOTTLE_IDS } from '../core/bottles.js';
import { todayISO } from '../core/dates.js';

const KEY = 'moske-chests';
const SEEN = 'moske-chests-seen';
// bottles: bottles_for() (0042): { held: { id: n }, active: { id: until|true|null }, fuel_on, jobs_running }
const NO_BOTTLES = { held: Object.fromEntries(BOTTLE_IDS.map((id) => [id, 0])), active: {}, fuel_on: false, jobs_running: 0 };
const EMPTY = { uid: null, chests: [], admin: false, bottles: NO_BOTTLES, at: 0 };
const listeners = new Set();

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

let state = { ...EMPTY, ...read(KEY, {}) };
let demo = null;

/** Chests are on when signed in to the server (or in demo mode). */
export const chestsEnabled = () => isDemo() || (SYNC_ENABLED && !!currentUser());

// demo: a long run and a hard ride left a legendary and a rare, both unopened
// (the demo has no finished sessions, so they're described here, not looked up)
function demoState() {
  const at = (h) => new Date(Date.now() - h * 36e5).toISOString();
  const mk = (id, tier, type, difficulty, xp, h) => ({
    id, source: 'workout', workout_id: null, type, day: todayISO(), difficulty, tier, xp, ...chestBonus(tier, xp), bottles: rollBottles(tier), charged: false, created_at: at(h), opened_at: null,
  });
  // and one of each bottle to try (a demo has no builders at work, so its Build Brew says so)
  const held = Object.fromEntries(BOTTLE_IDS.map((id) => [id, id === 'vo2-max' ? 0 : 1]));
  return { uid: 'demo', admin: true, at: Date.now(), chests: [mk(-1, 'legendary', 'run', 'brutal', 190, 1), mk(-2, 'rare', 'bike', 'hard', 120, 5)],
    bottles: { held, active: {}, fuel_on: false, jobs_running: 0 } };
}

function raw() {
  if (isDemo()) return (demo ||= demoState());
  const uid = currentUser()?.id || null;
  return uid && state.uid === uid ? state : { ...EMPTY, uid };
}

/** { chests, admin, at }: yours, newest first. */
export const chestsState = () => raw();
/** The chests waiting to be opened, newest first. */
export const pendingChests = () => raw().chests.filter((c) => !c.opened_at);
/** Are you an admin (app_admins)? Admins get the chest tools in Settings. */
export const isChestAdmin = () => !!raw().admin;

export function onChests(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => { try { fn(raw()); } catch (e) { console.error(e); } });

/** Ask the server: it makes any chests your new sessions earned, then lists them. */
export async function refreshChests() {
  if (isDemo()) { emit(); return raw(); }
  if (!chestsEnabled()) return raw();
  const uid = currentUser().id;
  try {
    const c = await client();
    const { data, error } = await c.rpc('my_chests');
    if (error) throw error;
    state = { uid, chests: data?.chests || [], admin: !!data?.admin, bottles: data?.bottles || NO_BOTTLES, at: Date.now() };
    write(KEY, state);
    emit();
  } catch (e) {
    // before 0027 is live there are no chests
    if (!/my_chests|function|404/i.test(String(e?.message || e?.code || ''))) console.warn('chests refresh failed', e);
  }
  return raw();
}

function replace(chest) {
  const s = raw();
  const i = s.chests.findIndex((c) => c.id === chest.id);
  if (i >= 0) s.chests[i] = { ...s.chests[i], ...chest }; else s.chests.unshift(chest);
  if (!isDemo()) { state = s; write(KEY, state); }
}

/**
 * Open a chest. The server stamps it and from then the wallet counts its bonus;
 * opening twice is harmless. Resolves to the chest as the server has it.
 */
export async function openChest(id) {
  if (isDemo()) {
    const c = raw().chests.find((x) => x.id === id);
    if (!c) throw new Error('gear:chest_unknown');
    if (!c.opened_at) {
      c.opened_at = new Date().toISOString(); demoCredit(c.coins, c.carbs);
      for (const b of c.bottles || []) raw().bottles.held[b] = (raw().bottles.held[b] || 0) + 1;
    }
    emit();
    return c;
  }
  const c = await client();
  const { data, error } = await c.rpc('open_chest', { p_id: id });
  if (error) throw error;
  replace(data.chest);
  emit();
  refreshGear(); // the wallet now counts it
  if (data.chest?.bottles?.length) refreshChests(); // and you hold its bottles
  return data.chest;
}

/** Admins: a real chest of a tier, for yourself (the server checks). */
export async function giftChest(tier) {
  if (isDemo()) {
    const d = raw();
    const id = Math.min(0, ...d.chests.map((c) => c.id)) - 1;
    const chest = { id, source: 'gift', workout_id: null, day: todayISO(), difficulty: null, tier, xp: 0, ...chestBonus(tier, 0), bottles: rollBottles(tier), charged: false, created_at: new Date().toISOString(), opened_at: null };
    d.chests.unshift(chest);
    emit();
    return chest;
  }
  const c = await client();
  const { data, error } = await c.rpc('admin_gift_chest', { p_tier: tier });
  if (error) throw error;
  replace(data);
  emit();
  return data;
}

/** A chest that isn't real (the admin preview and the simulated workout): nothing is paid. */
export function previewChest(tier, { difficulty = 'hard', xp = 120 } = {}) {
  const t = tier || rollChestTier(difficulty);
  return { id: `preview-${Date.now()}`, preview: true, source: 'workout', workout_id: null, type: 'bike', day: todayISO(), difficulty, tier: t, xp, ...chestBonus(t, xp), bottles: rollBottles(t), charged: false, created_at: new Date().toISOString(), opened_at: null };
}

// ---- bottles (0042_bottles.sql) -------------------------------------------------------------------

/** { held, active, fuel_on, jobs_running }: your bottles, as my_chests() last said. */
export const bottlesState = () => raw().bottles || NO_BOTTLES;

/**
 * Drink a bottle. The server checks you hold it and that it isn't already working, then does it (the Surge's
 * boost, the brew on your builders, the charge waiting for a chest). Recovery Mix's stamina is the device's:
 * the caller fills it. Resolves to the new bottles state.
 */
export async function drinkBottle(id) {
  if (isDemo()) {
    const b = raw().bottles;
    if (!(b.held[id] > 0)) throw new Error('gear:bottle_none');
    if (b.active[id]) throw new Error('gear:bottle_active');
    if (id === 'build-brew' && !b.jobs_running) throw new Error('gear:idle');
    b.held[id] -= 1;
    if (id === 'chest-charge') b.active[id] = true;
    if (id === 'electro-surge') b.active[id] = new Date(Date.now() + 24 * 3600e3).toISOString();
    if (id === 'build-brew') b.active[id] = new Date(Date.now() + 3600e3).toISOString();
    emit();
    return b;
  }
  const c = await client();
  const { data, error } = await c.rpc('drink_bottle', { p_bottle: id });
  if (error) throw error;
  if (state.uid === currentUser()?.id) { state = { ...state, bottles: data }; write(KEY, state); }
  emit();
  if (id === 'electro-surge' || id === 'build-brew') refreshGear(); // the Surge is a fuel (the chips), the brew moved the jobs
  return data;
}

export { bottlesHeld };

// ---- the banner: each chest is announced once per device ---------------------------------

const seenKey = () => `${SEEN}:${raw().uid || 'none'}`;
/** Unopened chests this device hasn't shown the banner for yet. */
export const unannounced = () => {
  const seen = new Set(read(seenKey(), []));
  return pendingChests().filter((c) => !seen.has(String(c.id)));
};
export function markAnnounced(ids) {
  const seen = new Set(read(seenKey(), []));
  ids.forEach((id) => seen.add(String(id)));
  write(seenKey(), [...seen].slice(-200));
}

export { CHEST_RULES };
