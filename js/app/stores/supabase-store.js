// supabase-store.js — the signed-in store. Implements the same interface as
// LocalStore, using a LocalStore as a write-through offline cache and Supabase
// Postgres as the synced source of truth. Reconciliation is last-write-wins by
// updated_at; remote changes stream in via realtime.

import { LocalStore } from './local-store.js';
import { mergeByUpdatedAt, applyRemoteChange } from '../../core/sync.js';

// app-only display flags that live in the `extra` jsonb column
const EXTRA_KEYS = ['isRace', 'optional', 'phaseId', 'weekNum', 'seeded', 'hr_zone', 'ai', 'packed', 'power'];

export function workoutToRow(w, userId) {
  const extra = {};
  for (const k of EXTRA_KEYS) if (w[k] !== undefined) extra[k] = w[k];
  const km = w.metrics?.distanceKm;
  return {
    id: w.id,
    user_id: userId,
    date: w.date,
    type: w.type,
    title: w.title ?? null,
    intensity: w.intensity ?? null,
    duration_min: Number.isFinite(+w.durationMin) ? Math.round(+w.durationMin) : null,
    distance_km: km === '' || km == null ? null : Number(km),
    completed: !!w.completed,
    completed_at: w.completedAt ?? null,
    phase: w.phase ?? null,
    deload: !!w.deload,
    segments: w.segments ?? [],
    exercises: w.exercises ?? [],
    packing: w.packing ?? [],
    notes: w.notes ?? '',
    actual: w.actual ?? null,
    strava_activity_id: w.strava_activity_id ?? null,
    source: w.source ?? 'custom',
    extra,
    updated_at: w.updated_at ?? new Date().toISOString(),
  };
}

export function rowToWorkout(r) {
  return {
    id: r.id,
    date: r.date,
    type: r.type,
    title: r.title ?? '',
    intensity: r.intensity ?? 'easy',
    durationMin: r.duration_min ?? 0,
    metrics: { distanceKm: r.distance_km == null ? '' : Number(r.distance_km) },
    completed: !!r.completed,
    completedAt: r.completed_at ?? null,
    phase: r.phase ?? '',
    deload: !!r.deload,
    segments: r.segments ?? [],
    exercises: r.exercises ?? [],
    packing: r.packing ?? [],
    notes: r.notes ?? '',
    actual: r.actual ?? null,
    strava_activity_id: r.strava_activity_id ?? null,
    source: r.source ?? 'custom',
    updated_at: r.updated_at,
    ...(r.extra || {}),
  };
}

export class SupabaseStore {
  constructor(client, userId, { onRemoteChange } = {}) {
    this.client = client;
    this.userId = userId;
    this.kind = 'supabase';
    this.cache = new LocalStore();
    this.persistent = this.cache.persistent;
    this.onRemoteChange = onRemoteChange;
    this.online = true;
    this.uploadedLocal = 0;
    this._channel = null;
  }

  async hydrate() {
    this.cache.hydrate();          // instant, offline-safe
    await this.pull();             // network — tolerant of failure
    this._subscribeRealtime();
    return this.cache.snapshot();
  }

  snapshot() { return this.cache.snapshot(); }
  list() { return this.cache.list(); }
  get(id) { return this.cache.get(id); }

  async pull() {
    try {
      const { data: rows, error } = await this.client
        .from('workouts').select('*').eq('user_id', this.userId);
      if (error) throw error;
      const remote = (rows || []).map(rowToWorkout);
      const local = this.cache.list();
      const { merged, toUpsertRemote } = mergeByUpdatedAt(local, remote);

      const snap = this.cache.snapshot();
      snap.workouts = merged;
      this.cache.replaceAll(snap);

      this.uploadedLocal = toUpsertRemote.length;
      if (toUpsertRemote.length) await this._pushRows(toUpsertRemote);

      await this._syncProfile();
      this.online = true;
    } catch (e) {
      console.warn('Supabase pull failed (offline?) — using local cache:', e?.message || e);
      this.online = false;
    }
  }

  async _syncProfile() {
    const { data } = await this.client.from('profiles')
      .select('settings').eq('id', this.userId).maybeSingle();
    if (data?.settings && Object.keys(data.settings).length) {
      const snap = this.cache.snapshot();
      snap.settings = { ...snap.settings, ...data.settings };
      this.cache.replaceAll(snap);
    } else {
      await this._pushProfile();
    }
  }

  upsert(workout) {
    const w = this.cache.upsert(workout); // stamps updated_at + caches
    this._queue(() => this.client.from('workouts').upsert(workoutToRow(w, this.userId)));
    return w;
  }

  delete(id) {
    this.cache.delete(id);
    this._queue(() => this.client.from('workouts').delete().eq('id', id).eq('user_id', this.userId));
  }

  setMeta(patch = {}) {
    this.cache.setMeta(patch);
    if (patch.settings) this._queue(() => this._pushProfile());
  }

  replaceAll(snapshot) {
    this.cache.replaceAll(snapshot);
    this._queue(() => this._pushRows(snapshot.workouts));
    this._queue(() => this._pushProfile());
  }

  flush() { this.cache.flush(); }

  async _pushRows(workouts) {
    const rows = workouts.map((w) => workoutToRow(w, this.userId));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await this.client.from('workouts').upsert(rows.slice(i, i + 200));
      if (error) throw error;
    }
  }

  async _pushProfile() {
    const snap = this.cache.snapshot();
    await this.client.from('profiles').upsert({
      id: this.userId, settings: snap.settings, updated_at: new Date().toISOString(),
    });
  }

  // Fire-and-forget writes. If offline they fail quietly; the local cache keeps
  // the change and a later pull reconciles it (local updated_at wins via LWW).
  _queue(fn) {
    Promise.resolve().then(fn).catch((e) => console.warn('Supabase write deferred (offline?):', e?.message || e));
  }

  _subscribeRealtime() {
    try {
      this._channel = this.client
        .channel(`workouts-${this.userId}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'workouts', filter: `user_id=eq.${this.userId}` },
          (payload) => {
            const snap = this.cache.snapshot();
            if (payload.eventType === 'DELETE') {
              snap.workouts = snap.workouts.filter((w) => w.id !== payload.old.id);
            } else {
              snap.workouts = applyRemoteChange(snap.workouts, rowToWorkout(payload.new));
            }
            this.cache.replaceAll(snap);
            if (this.onRemoteChange) this.onRemoteChange();
          })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscribe failed:', e?.message || e);
    }
  }

  async dispose() {
    if (this._channel) { try { await this.client.removeChannel(this._channel); } catch { /* ignore */ } }
  }
}
