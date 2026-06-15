// store.js — app state + defensive persistence.
// localStorage is the source of truth on disk; if it's blocked (private mode,
// disabled cookies) we transparently fall back to an in-memory store and raise
// a flag so the UI can warn the user.

import { expandPlan } from '../core/plan.js';

const KEY = 'triquest.v1';
const VERSION = 1;

// ---- defensive storage backend -------------------------------------------

function makeBackend() {
  try {
    const probe = '__triquest_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return { persistent: true, store: localStorage };
  } catch {
    // In-memory shim implementing the bits of the Storage API we use.
    const mem = new Map();
    return {
      persistent: false,
      store: {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, String(v)),
        removeItem: (k) => mem.delete(k),
      },
    };
  }
}

const backend = makeBackend();
export const isPersistent = () => backend.persistent;

// ---- defaults + state ------------------------------------------------------

function defaultSettings() {
  return { sound: false, units: 'metric', weekStart: 1, reduceMotion: false };
}

function freshState() {
  return {
    version: VERSION,
    settings: defaultSettings(),
    workouts: expandPlan(),
    unlockedBadges: [],
    seededAt: new Date().toISOString(),
  };
}

export const state = { current: null };
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state.current);
}

export function save() {
  try {
    backend.store.setItem(KEY, JSON.stringify(state.current));
  } catch {
    /* quota or blocked — already running in-memory, nothing else to do */
  }
}

/** Persist + notify subscribers. */
export function commit() {
  save();
  emit();
}

function migrate(data) {
  // Future-proofing hook. v1 is the baseline; merge in any new default settings.
  data.settings = { ...defaultSettings(), ...(data.settings || {}) };
  if (!Array.isArray(data.workouts)) data.workouts = expandPlan();
  if (!Array.isArray(data.unlockedBadges)) data.unlockedBadges = [];
  data.version = VERSION;
  return data;
}

export function init() {
  const raw = backend.store.getItem(KEY);
  if (raw) {
    try {
      state.current = migrate(JSON.parse(raw));
    } catch {
      state.current = freshState();
    }
  } else {
    state.current = freshState();
  }
  save();
  return state.current;
}

// ---- selectors -------------------------------------------------------------

export const getState = () => state.current;
export const getSettings = () => state.current.settings;
export const getWorkouts = () => state.current.workouts;
export const workoutsOn = (iso) => state.current.workouts.filter((w) => w.date === iso);
export const workoutById = (id) => state.current.workouts.find((w) => w.id === id);

// ---- mutations -------------------------------------------------------------

export function setSetting(key, value) {
  state.current.settings[key] = value;
  commit();
}

export function toggleComplete(id, completed) {
  const w = workoutById(id);
  if (!w) return;
  w.completed = completed;
  w.completedAt = completed ? new Date().toISOString() : null;
  commit();
}

export function updateWorkout(id, patch) {
  const w = workoutById(id);
  if (!w) return;
  Object.assign(w, patch);
  commit();
}

export function upsertWorkout(workout) {
  const idx = state.current.workouts.findIndex((w) => w.id === workout.id);
  if (idx >= 0) state.current.workouts[idx] = workout;
  else state.current.workouts.push(workout);
  commit();
}

export function deleteWorkout(id) {
  state.current.workouts = state.current.workouts.filter((w) => w.id !== id);
  commit();
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
  state.current.workouts.push(copy);
  commit();
  return copy;
}

export function setUnlockedBadges(ids) {
  state.current.unlockedBadges = ids;
  save(); // no emit: badge sync runs inside the render cycle
}

let _counter = 0;
export function newId() {
  return `w-${Date.now().toString(36)}-${(_counter++).toString(36)}`;
}

// ---- reseed / backup -------------------------------------------------------

export function reseed() {
  const settings = state.current.settings;
  state.current = freshState();
  state.current.settings = settings; // keep the user's preferences
  commit();
}

export function exportData() {
  return JSON.stringify(state.current, null, 2);
}

export function importData(json) {
  const data = migrate(JSON.parse(json));
  state.current = data;
  commit();
}
