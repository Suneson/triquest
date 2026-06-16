// local-store.js — the local (offline) implementation of the store interface,
// plus the shared schema helpers (defaults, seed, migration).
//
// Store interface (implemented here by LocalStore, and in Phase 2 by
// SupabaseStore, which reuses this localStorage layer as a write-through cache):
//
//   hydrate()            -> snapshot { version, settings, workouts, unlockedBadges }
//   snapshot()           -> the in-memory snapshot (also the app's render state)
//   list()               -> workouts[]
//   get(id)              -> workout | undefined
//   upsert(workout)      -> workout      (stamps updated_at, persists)
//   delete(id)           -> void
//   setMeta({settings?, unlockedBadges?}) -> void
//   replaceAll(snapshot) -> void          (reseed / import)
//   flush()              -> void          (persist the whole snapshot)
//
// The snapshot returned by hydrate() is shared by reference with the app's
// render state, so reads are synchronous and mutations are visible immediately;
// persistence (and, later, remote sync) is the store's responsibility.

import { expandPlan } from '../../core/plan.js';

export const STORAGE_KEY = 'triquest.v1'; // unchanged: existing data must keep loading
export const SCHEMA_VERSION = 2;          // v2 adds `source` + `updated_at` to workouts

export const nowISO = () => new Date().toISOString();

export function defaultSettings() {
  return { sound: false, units: 'metric', weekStart: 1, reduceMotion: false };
}

/** localStorage if available, else an in-memory shim (private mode / blocked). */
export function makeStorageBackend() {
  try {
    const probe = '__triquest_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return { persistent: true, store: localStorage };
  } catch {
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

/** Give a workout the v2 fields if it predates them. */
export function normalizeWorkout(w) {
  const source = w.source || (w.seeded ? 'plan' : 'custom');
  return { ...w, source, updated_at: w.updated_at || w.completedAt || nowISO() };
}

export function freshState() {
  return {
    version: SCHEMA_VERSION,
    settings: defaultSettings(),
    workouts: expandPlan().map(normalizeWorkout),
    unlockedBadges: [],
    seededAt: nowISO(),
  };
}

/** Upgrade any older snapshot to the current schema. Pure + idempotent. */
export function migrate(data) {
  data.settings = { ...defaultSettings(), ...(data.settings || {}) };
  data.workouts = Array.isArray(data.workouts) ? data.workouts.map(normalizeWorkout) : expandPlan().map(normalizeWorkout);
  if (!Array.isArray(data.unlockedBadges)) data.unlockedBadges = [];
  data.version = SCHEMA_VERSION;
  return data;
}

export class LocalStore {
  /** @param {{storage?: Storage}} [opts] inject a Storage-like backend (tests). */
  constructor(opts = {}) {
    if (opts.storage) {
      this.persistent = true;
      this._store = opts.storage;
    } else {
      const b = makeStorageBackend();
      this.persistent = b.persistent;
      this._store = b.store;
    }
    this.data = null;
    this.kind = 'local';
  }

  hydrate() {
    const raw = this._store.getItem(STORAGE_KEY);
    if (raw) {
      try { this.data = migrate(JSON.parse(raw)); }
      catch { this.data = freshState(); }
    } else {
      this.data = freshState();
    }
    this._save();
    return this.data;
  }

  _save() {
    try { this._store.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
    catch { /* quota / blocked — running in-memory, nothing else to do */ }
  }

  snapshot() { return this.data; }
  list() { return this.data.workouts; }
  get(id) { return this.data.workouts.find((w) => w.id === id); }

  upsert(workout) {
    workout.updated_at = nowISO();
    const i = this.data.workouts.findIndex((w) => w.id === workout.id);
    if (i >= 0) this.data.workouts[i] = workout;
    else this.data.workouts.push(workout);
    this._save();
    return workout;
  }

  delete(id) {
    this.data.workouts = this.data.workouts.filter((w) => w.id !== id);
    this._save();
  }

  setMeta(patch = {}) {
    if (patch.settings) this.data.settings = { ...this.data.settings, ...patch.settings };
    if (patch.unlockedBadges) this.data.unlockedBadges = patch.unlockedBadges;
    this._save();
  }

  replaceAll(snapshot) {
    this.data = snapshot;
    this._save();
  }

  flush() { this._save(); }
}
