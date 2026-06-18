// ai.js — frontend entry for the AI workout-plan wizard. Calls the ai-plan Edge
// Function (which holds the Gemini key and inserts into the user's calendar).
import { client } from './auth.js';
import { functionsBaseUrl } from './config.js';

/** Compact summary of the user's recent (Strava-verified) training. */
export function stravaSummary(workouts) {
  return workouts
    .filter((w) => w.completed)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .map((w) => ({
      date: w.date, type: w.type, intensity: w.intensity,
      km: Number(w.metrics?.distanceKm || w.actual?.distanceKm || 0),
      min: w.durationMin, avgHr: w.actual?.avgHr || null,
    }));
}

export async function generateAIWorkoutPlan(wizardData, stravaHistory) {
  const c = await client();
  const { data: { session } } = await c.auth.getSession();
  if (!session) throw new Error('Sign in to generate a plan.');
  const res = await fetch(`${functionsBaseUrl()}/ai-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ wizard: wizardData, strava: stravaHistory }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'AI plan generation failed.');
  return json; // { inserted: N }
}
