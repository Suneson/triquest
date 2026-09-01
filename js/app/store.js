// store.js — app-facing state facade over a pluggable store implementation.
//
// The facade holds the live snapshot (`state.current`) that the render layer
// reads synchronously, and delegates persistence (and, when signed in, remote
// sync) to the active store. Today the active store is always LocalStore;
// Phase 2 swaps in SupabaseStore on sign-in without changing this surface.

import { LocalStore, freshState, migrate } from './stores/local-store.js';

let activeStore = new LocalStore();

export const state = { current: null };
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state.current);
}

export const isPersistent = () => activeStore.persistent;
export const storeKind = () => activeStore.kind;

/** Swap the active store (e.g. to SupabaseStore on sign-in). Returns new snapshot. */
export async function useStore(store) {
  activeStore = store;
  state.current = await store.hydrate();
  emit();
  return state.current;
}

export async function init() {
  state.current = await activeStore.hydrate();
  return state.current;
}

// ---- selectors -------------------------------------------------------------

export const getState = () => state.current;
export const getSettings = () => state.current.settings;
export const getWorkouts = () => state.current.workouts;
export const workoutsOn = (iso) => state.current.workouts.filter((w) => w.date === iso);
export const workoutById = (id) => state.current.workouts.find((w) => w.id === id);

// ---- mutations -------------------------------------------------------------

/** Persist the whole snapshot + notify (used for bulk/inline edits). */
export function commit() {
  activeStore.flush();
  emit();
}

/** Persist the whole snapshot without re-rendering (silent text edits). */
export function save() {
  activeStore.flush();
}

export function setSetting(key, value) {
  state.current.settings[key] = value;
  activeStore.setMeta({ settings: state.current.settings });
  emit();
}

export function toggleComplete(id, completed) {
  const w = workoutById(id);
  if (!w) return;
  w.completed = completed;
  w.completedAt = completed ? new Date().toISOString() : null;
  activeStore.upsert(w);
  emit();
}

export function updateWorkout(id, patch) {
  const w = workoutById(id);
  if (!w) return;
  Object.assign(w, patch);
  activeStore.upsert(w);
  emit();
}

/** Persist a single workout's current state (stamps updated_at). */
export function touchWorkout(id) {
  const w = workoutById(id);
  if (w) activeStore.upsert(w);
}

export function upsertWorkout(workout) {
  if (!workout.source) workout.source = 'custom';
  activeStore.upsert(workout);
  emit();
}

export function deleteWorkout(id) {
  activeStore.delete(id);
  emit();
}

/** Delete many workouts in one pass (one remote round-trip, one re-render). */
export function deleteWorkouts(ids) {
  const unique = [...new Set(ids)];
  if (!unique.length) return 0;
  activeStore.deleteMany(unique);
  emit();
  return unique.length;
}

/** Re-read the source of truth (remote rows written outside the client, e.g. by
 *  the ai-plan Edge Function) and re-render. No-ops for the local-only store. */
export async function refresh() {
  if (activeStore.pull) await activeStore.pull();
  state.current = activeStore.snapshot();
  emit();
  return state.current;
}

export function duplicateWorkout(id) {
  const w = workoutById(id);
  if (!w) return null;
  const copy = structuredClone(w);
  copy.id = newId();
  copy.title = `${w.title} (copy)`;
  copy.completed = false;
  copy.completedAt = null;
  copy.seeded = false;
  copy.source = 'custom';
  copy.strava_activity_id = null;
  activeStore.upsert(copy);
  emit();
  return copy;
}

export function setUnlockedBadges(ids) {
  state.current.unlockedBadges = ids;
  activeStore.setMeta({ unlockedBadges: ids }); // no emit: runs inside the render cycle
}

let _counter = 0;
export function newId() {
  return `w-${Date.now().toString(36)}-${(_counter++).toString(36)}`;
}

// ---- reseed / backup -------------------------------------------------------

export function reseed() {
  const settings = state.current.settings;
  const snap = freshState();
  snap.settings = settings; // keep the user's preferences
  activeStore.replaceAll(snap);
  state.current = activeStore.snapshot();
  emit();
}

export function exportData() {
  return JSON.stringify(state.current, null, 2);
}

export function importData(json) {
  const data = migrate(JSON.parse(json));
  activeStore.replaceAll(data);
  state.current = activeStore.snapshot();
  emit();
}
