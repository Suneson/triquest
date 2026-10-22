// Shared Strava helpers for Edge Functions (Deno). Mirrors the pure logic in
// js/core/strava.js (which is unit-tested); kept dependency-free.

export const SPORT_TYPE_MAP: Record<string, string> = {
  Ride: "bike", VirtualRide: "bike", GravelRide: "bike", MountainBikeRide: "bike", EBikeRide: "bike",
  Run: "run", TrailRun: "run", VirtualRun: "run",
  Swim: "swim",
  WeightTraining: "gym", Workout: "gym", Crossfit: "gym",
};

export function mapType(sportType: string): string {
  return SPORT_TYPE_MAP[sportType] ?? "other";
}

export function activityLocalDate(a: any): string {
  return String(a.start_date_local || a.start_date || "").slice(0, 10);
}

export function actualsFromActivity(a: any) {
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
  return {
    stravaId: a.id,
    stravaLink: `https://www.strava.com/activities/${a.id}`,
    name: a.name ?? null,
    startedAt: a.start_date_local || a.start_date || null,
    // start_date_local is wall-clock time with a misleading 'Z'; these two are the real instant (gel windows need it)
    startUtc: a.start_date || null,
    elapsedSec: num(a.elapsed_time),
    distanceKm: num(a.distance) != null ? Math.round(a.distance / 100) / 10 : null,
    durationMin: num(a.moving_time) != null ? Math.round(a.moving_time / 60) : null,
    elevationGainM: num(a.total_elevation_gain),
    avgHr: num(a.average_heartrate),
    avgWatts: num(a.average_watts),
    avgCadence: num(a.average_cadence),
    calories: num(a.calories) ?? num(a.kilojoules),
    // feats and challenges (docs/FEATS.md §1); same as js/core/strava.js
    distanceM: num(a.distance) != null ? Math.round(a.distance) : null,
    movingSec: num(a.moving_time),
    sportType: a.sport_type || a.type || null,
    manual: a.manual === true,
    trainer: a.trainer === true,
    maxSpeedKmh: num(a.max_speed) != null ? Math.round(a.max_speed * 36) / 10 : null,
    workoutType: num(a.workout_type),
    ...effortsFromActivity(a),
  };
}

const BEST_EFFORT_KEYS: Record<string, string> = { "5k": "5k", "10k": "10k", "Half-Marathon": "half", "30k": "30k", Marathon: "marathon" };
const MAX_SEGMENTS = 60;

/** Best efforts and segment efforts: only a detailed activity has them (mirrors js/core/strava.js). */
export function effortsFromActivity(a: any): Record<string, unknown> {
  if (!a || !(Array.isArray(a.segment_efforts) || Array.isArray(a.best_efforts))) return {};
  const bestEfforts: Record<string, number> = {};
  for (const e of a.best_efforts || []) {
    const k = BEST_EFFORT_KEYS[e?.name];
    const sec = Number(e?.elapsed_time);
    if (k && sec > 0 && !(bestEfforts[k] <= sec)) bestEfforts[k] = sec;
  }
  const best = new Map<number, any>();
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
  const segments = [...best.values()].sort((x, y) => y.cat - x.cat || y.gainM - x.gainM).slice(0, MAX_SEGMENTS);
  return { detail: true, bestEfforts, segments };
}

// Map an activity to a workouts-table row patch (snake_case columns).
export function activityToRow(a: any) {
  const actual = actualsFromActivity(a);
  return {
    type: mapType(a.sport_type),
    date: activityLocalDate(a),
    duration_min: actual.durationMin,
    distance_km: actual.distanceKm,
    completed: true,
    completed_at: actual.startedAt,
    strava_activity_id: a.id,
    actual,
  };
}
