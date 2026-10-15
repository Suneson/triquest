// ai.js — frontend entry for the AI workout-plan wizard. Calls the ai-plan Edge
// Function (which holds the Gemini key and inserts into the user's calendar).
import { client } from './auth.js';
import { functionsBaseUrl } from './config.js';
import { t } from '../core/i18n.js';

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

// the function's errors are English keys; show them in the active language
// i18n-ignore-start (the server's messages, matched as keys)
const SERVER_ERRORS = {
  'AI coach unavailable': 'ai.unavailable', 'AI returned invalid JSON': 'ai.bad',
  'AI returned no sessions': 'ai.bad', 'no valid sessions': 'ai.bad',
};
// i18n-ignore-end
const serverError = (e) => (SERVER_ERRORS[e] ? t(SERVER_ERRORS[e]) : (e || t('ai.failed')));

export async function generateAIWorkoutPlan(wizardData, stravaHistory, { wipeFrom = null } = {}) {
  const c = await client();
  const { data: { session } } = await c.auth.getSession();
  if (!session) throw new Error(t('ob.signIn'));
  const res = await fetch(`${functionsBaseUrl()}/ai-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ wizard: wizardData, strava: stravaHistory, wipe_from: wipeFrom }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Keep the server's detail — a dead model id or a missing key is otherwise
    // indistinguishable from "the wizard is broken".
    const detail = json.detail ? ` (${String(json.detail).slice(0, 200)})` : '';
    throw new Error(`${serverError(json.error)}${detail}`);
  }
  return json; // { inserted: N, removed: N }
}
