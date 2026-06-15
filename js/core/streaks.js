// streaks.js — pure streak logic. A "streak day" is any calendar day with at
// least one completed session. There is a one-day grace: an unfinished *today*
// does not break a streak that was alive yesterday.

import { addDays, diffDays, toISO } from './dates.js';

/** Set of ISO dates that have >= 1 completed workout. */
export function completedDateSet(workouts) {
  const set = new Set();
  for (const w of workouts) {
    if (w.completed) set.add(w.date);
  }
  return set;
}

/**
 * @param {Array} workouts
 * @param {string} today ISO date used as "now" (injectable for tests)
 * @returns {{current:number, longest:number, isTodayDone:boolean, activeDates:Set<string>}}
 */
export function computeStreaks(workouts, today = toISO(new Date())) {
  const active = completedDateSet(workouts);
  const isTodayDone = active.has(today);

  // --- current streak (with one-day grace) ---
  let current = 0;
  // Anchor: today if done, otherwise yesterday (grace), otherwise no streak.
  let anchor = null;
  if (isTodayDone) anchor = today;
  else if (active.has(addDays(today, -1))) anchor = addDays(today, -1);

  if (anchor) {
    let cur = anchor;
    while (active.has(cur)) {
      current++;
      cur = addDays(cur, -1);
    }
  }

  // --- longest streak ever ---
  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    if (prev !== null && diffDays(d, prev) === 1) run++;
    else run = 1;
    if (run > longest) longest = run;
    prev = d;
  }

  return { current, longest, isTodayDone, activeDates: active };
}
