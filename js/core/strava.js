// strava.js — pure Strava mapping + matching logic. No network, no DOM, no
// storage, so it's unit-testable and shared by the frontend poller and (mirrored)
// the Edge Function webhook. Strava is metric (metres, seconds, m of elevation).

import { t } from './i18n.js';

/** Strava sport_type -> app workout type. */
export const SPORT_TYPE_MAP = {
  Ride: 'bike', VirtualRide: 'bike', GravelRide: 'bike', MountainBikeRide: 'bike', EBikeRide: 'bike',
  Run: 'run', TrailRun: 'run', VirtualRun: 'run',
  Swim: 'swim',
  WeightTraining: 'gym', Workout: 'gym', Crossfit: 'gym',
};

export function mapType(sportType) {
  return SPORT_TYPE_MAP[sportType] || 'other';
}

/** Pull the local calendar date (YYYY-MM-DD) from a Strava activity. */
export function activityLocalDate(activity) {
  const s = activity.start_date_local || activity.start_date || '';
  return s.slice(0, 10);
}

/** Build the `actual` results object from a Strava activity (rounded, metric). */
export function actualsFromActivity(activity) {
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const actual = {
    stravaId: activity.id,
    stravaLink: `https://www.strava.com/activities/${activity.id}`,
    name: activity.name || null,
    startedAt: activity.start_date_local || activity.start_date || null,
    // start_date_local is wall-clock time with a misleading 'Z'; these two are the real instant (gel windows need it)
    startUtc: activity.start_date || null,
    elapsedSec: num(activity.elapsed_time),
    distanceKm: num(activity.distance) != null ? Math.round(activity.distance / 100) / 10 : null,
    durationMin: num(activity.moving_time) != null ? Math.round(activity.moving_time / 60) : null,
    elevationGainM: num(activity.total_elevation_gain),
    avgHr: num(activity.average_heartrate),
    avgWatts: num(activity.average_watts),
    avgCadence: num(activity.average_cadence),
    calories: num(activity.calories) ?? num(activity.kilojoules),
    // what feats and challenges need to tell a real effort from bad data
    // (docs/FEATS.md §1): exact distance and time, the kind of activity, and
    // whether it was typed in by hand or done on a machine
    distanceM: num(activity.distance) != null ? Math.round(activity.distance) : null,
    movingSec: num(activity.moving_time),
    sportType: activity.sport_type || activity.type || null,
    manual: activity.manual === true,
    trainer: activity.trainer === true,
    maxSpeedKmh: num(activity.max_speed) != null ? Math.round(activity.max_speed * 36) / 10 : null,
    workoutType: num(activity.workout_type),
    ...effortsFromActivity(activity),
  };
  return actual;
}

// Strava's best-effort names → the distances feats and challenges use
export const BEST_EFFORT_KEYS = { '5k': '5k', '10k': '10k', 'Half-Marathon': 'half', '30k': '30k', Marathon: 'marathon' };
export const MAX_SEGMENTS = 60;

/**
 * Best efforts and segment efforts, present only on a *detailed* activity
 * (GET /activities/{id}; the activity list never carries them):
 *   detail: true, bestEfforts: { '5k': sec, … }, segments: [{ id, sec, cat, gainM, m }]
 * Nothing for a summary, so a later summary never wipes a detail out.
 */
export function effortsFromActivity(a) {
  if (!a || !(Array.isArray(a.segment_efforts) || Array.isArray(a.best_efforts))) return {};
  const bestEfforts = {};
  for (const e of a.best_efforts || []) {
    const k = BEST_EFFORT_KEYS[e?.name];
    const sec = Number(e?.elapsed_time);
    if (k && sec > 0 && !(bestEfforts[k] <= sec)) bestEfforts[k] = sec;
  }
  const best = new Map();
  for (const e of a.segment_efforts || []) {
    const id = Number(e?.segment?.id);
    const sec = Number(e?.elapsed_time);
    if (!id || !(sec > 0) || best.get(id)?.sec <= sec) continue;
    const g = e.segment;
    best.set(id, {
      id, sec,
      cat: Number(g.climb_category) || 0,
      gainM: Number.isFinite(g.elevation_high - g.elevation_low) ? Math.round(g.elevation_high - g.elevation_low) : 0,
      m: Math.round(Number(g.distance) || 0),
    });
  }
  // the hardest climbs first, so the cap never drops an HC
  const segments = [...best.values()].sort((x, y) => y.cat - x.cat || y.gainM - x.gainM).slice(0, MAX_SEGMENTS);
  return { detail: true, bestEfforts, segments };
}

/**
 * Decide what to do with an incoming Strava activity given the user's workouts.
 * Pure: returns a decision; the caller mutates/persists.
 *
 * @returns {{action:'update'|'link'|'insert', workout?:object, type:string, date:string}}
 *   - update: activity already linked to `workout` (refresh actuals)
 *   - link:   `workout` is the best planned candidate to tick off
 *   - insert: no candidate — caller should create a new completed 'strava' workout
 */
export function matchActivity(activity, workouts) {
  const type = mapType(activity.sport_type);
  const date = activityLocalDate(activity);

  const alreadyLinked = workouts.find((w) => w.strava_activity_id === activity.id);
  if (alreadyLinked) return { action: 'update', workout: alreadyLinked, type, date };

  const candidates = workouts.filter((w) =>
    w.type === type && w.date === date && !w.completed && w.strava_activity_id == null);

  if (candidates.length) {
    const targetMin = (activity.moving_time || 0) / 60;
    candidates.sort((a, b) =>
      Math.abs((a.durationMin || 0) - targetMin) - Math.abs((b.durationMin || 0) - targetMin));
    return { action: 'link', workout: candidates[0], type, date };
  }

  return { action: 'insert', type, date };
}

/** Tick off a planned workout with Strava actuals (mutates + returns it). */
export function linkActivityToWorkout(workout, activity) {
  const actual = actualsFromActivity(activity);
  workout.completed = true;
  workout.completedAt = activity.start_date_local || activity.start_date || new Date().toISOString();
  workout.strava_activity_id = activity.id;
  workout.actual = actual;
  workout.updated_at = new Date().toISOString();
  return workout;
}

/** Build a brand-new completed workout from an unmatched Strava activity. */
export function buildStravaWorkout(activity, id) {
  const actual = actualsFromActivity(activity);
  const type = mapType(activity.sport_type);
  const date = activityLocalDate(activity);
  return {
    id,
    date,
    type,
    title: activity.name || t('misc.stravaActivity'),
    intensity: 'steady',
    durationMin: actual.durationMin || 0,
    metrics: { distanceKm: actual.distanceKm || 0 },
    completed: true,
    completedAt: actual.startedAt || new Date().toISOString(),
    source: 'strava',
    strava_activity_id: activity.id,
    actual,
    segments: [],
    exercises: [],
    packing: [],
    notes: '',
    seeded: false,
    updated_at: new Date().toISOString(),
  };
}

/** Detach a deleted Strava activity without deleting a planned session. */
export function unlinkActivity(workout) {
  if (workout.source === 'strava') return { removeId: workout.id }; // unplanned import -> caller may delete
  workout.strava_activity_id = null;
  workout.actual = null;
  workout.updated_at = new Date().toISOString();
  return { kept: workout };
}
