// rest.js — planned rest days. A plan's rest day is a day with no planned
// (non-optional) session, sitting in a gap of at most two such days with
// planned days on both sides. That catches "Mon rest" or a Sat+Sun off, but a
// week with nothing logged is a gap, not rest. Strava imports don't count as
// planned; "Easy swim or rest" style optional sessions do count as rest.
// Pure, so streaks, quests and the week path all agree.

import { addDays } from './dates.js';

export const MAX_REST_RUN = 2;

export const isPlanned = (w) => !!(w && w.date && w.source !== 'strava' && !w.optional);

/** Dates that have at least one planned, non-optional session. */
export function plannedDaySet(workouts) {
  const s = new Set();
  for (const w of workouts || []) if (isPlanned(w)) s.add(w.date);
  return s;
}

/** Is `date` a planned rest day, given the set from plannedDaySet()? */
export function isRestDay(date, planned) {
  if (!planned || planned.has(date)) return false;
  let back = 0;
  while (back <= MAX_REST_RUN && !planned.has(addDays(date, -(back + 1)))) back++;
  let fwd = 0;
  while (fwd <= MAX_REST_RUN && !planned.has(addDays(date, fwd + 1))) fwd++;
  return back + 1 + fwd <= MAX_REST_RUN;
}
