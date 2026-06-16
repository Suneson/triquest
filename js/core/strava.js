// strava.js — pure Strava mapping + matching logic. No network, no DOM, no
// storage, so it's unit-testable and shared by the frontend poller and (mirrored)
// the Edge Function webhook. Strava is metric (metres, seconds, m of elevation).

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
    distanceKm: num(activity.distance) != null ? Math.round(activity.distance / 100) / 10 : null,
    durationMin: num(activity.moving_time) != null ? Math.round(activity.moving_time / 60) : null,
    elevationGainM: num(activity.total_elevation_gain),
    avgHr: num(activity.average_heartrate),
    avgWatts: num(activity.average_watts),
    avgCadence: num(activity.average_cadence),
    calories: num(activity.calories) ?? num(activity.kilojoules),
  };
  return actual;
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
    title: activity.name || 'Strava activity',
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
