// rules.js — plain JS shared by the ai-plan function (Deno) and the tests (Node).

// The disciplines the athlete picked in the wizard ("Running", "Gym", …) →
// the session types the plan may contain. A runner gets runs, nothing else; a
// brick only when both bike and run are in. An empty or unknown list allows
// every type (an older client that didn't send its sports).
const SPORT_TYPES = { Running: 'run', Cycling: 'bike', Swimming: 'swim', Gym: 'gym' };

export function allowedTypes(sports, all) {
  const picked = (Array.isArray(sports) ? sports : []).map((x) => SPORT_TYPES[String(x)]).filter(Boolean);
  if (!picked.length) return [...all];
  const out = new Set(picked);
  if (out.has('run') && out.has('bike')) out.add('brick');
  return [...out];
}
