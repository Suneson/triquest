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
    distanceKm: num(a.distance) != null ? Math.round(a.distance / 100) / 10 : null,
    durationMin: num(a.moving_time) != null ? Math.round(a.moving_time / 60) : null,
    elevationGainM: num(a.total_elevation_gain),
    avgHr: num(a.average_heartrate),
    avgWatts: num(a.average_watts),
    avgCadence: num(a.average_cadence),
    calories: num(a.calories) ?? num(a.kilojoules),
  };
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
