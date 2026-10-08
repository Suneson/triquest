// streaks.js — pure streak logic. A "streak day" is any calendar day with at
// least one completed session. There is a one-day grace: an unfinished *today*
// does not break a streak that was alive yesterday.

import { addDays, toISO } from './dates.js';
import { plannedDaySet, isRestDay } from './rest.js';

/** Set of ISO dates that have >= 1 completed workout. */
export function completedDateSet(workouts) {
  const set = new Set();
  for (const w of workouts) {
    if (w.completed) set.add(w.date);
  }
  return set;
}

/**
 * Planned rest days (see rest.js) bridge a streak: they don't add to it and
 * they don't break it, so following the plan's rest never costs the streak.
 * @param {Array} workouts
 * @param {string} today ISO date used as "now" (injectable for tests)
 * @returns {{current:number, longest:number, isTodayDone:boolean, activeDates:Set<string>}}
 */
export function computeStreaks(workouts, today = toISO(new Date())) {
  const active = completedDateSet(workouts);
  const planned = plannedDaySet(workouts);
  const isTodayDone = active.has(today);
  const rest = (d) => !active.has(d) && isRestDay(d, planned);

  // --- current streak: walk back from today (or yesterday, the one-day grace) ---
  let current = 0;
  let cur = isTodayDone ? today : addDays(today, -1);
  while (active.has(cur) || rest(cur)) {
    if (active.has(cur)) current++;
    cur = addDays(cur, -1);
  }

  // --- longest streak ever: active days in a row, rest days bridging ---
  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    let joined = prev !== null;
    if (joined) {
      for (let g = addDays(prev, 1); g < d; g = addDays(g, 1)) {
        if (!rest(g)) { joined = false; break; }
      }
    }
    run = joined ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  return { current, longest, isTodayDone, activeDates: active };
}
