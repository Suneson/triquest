// path.js — the week path on Home and the season path sheet. Pure: derived from
// workouts, today and the settings' events, so every device draws the same map.
// Flags are planted only by Strava-verified sessions (same rule as quests).

import { addDays, diffDays, startOfWeek } from './dates.js';
import { isVerified } from './quests.js';
import { plannedDaySet, isRestDay } from './rest.js';

/** The next event on or after today, with days left. */
export function nextEvent(events, today) {
  const ev = (events || []).filter((e) => e && e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return ev ? { title: ev.title || 'Event', date: ev.date, daysLeft: diffDays(ev.date, today) } : null;
}

/**
 * Seven stops, Monday to Sunday. Each day lists its sessions (planned ones and
 * Strava-only imports); `flag` is set once any session that day is verified.
 */
export function weekPath(workouts, today, events = []) {
  const start = startOfWeek(today, 1);
  const planned = plannedDaySet(workouts);
  const byDate = new Map();
  for (const w of workouts || []) {
    if (!w?.date) continue;
    if (!byDate.has(w.date)) byDate.set(w.date, []);
    byDate.get(w.date).push(w);
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const sessions = (byDate.get(date) || []).filter((w) => w.source !== 'strava' || isVerified(w));
    return {
      date,
      isToday: date === today,
      isPast: date < today,
      types: [...new Set(sessions.map((w) => w.type))],
      flag: sessions.some(isVerified),
      rest: !sessions.length && isRestDay(date, planned),
    };
  });
  const ev = nextEvent(events, today);
  return { start, days, event: ev && ev.date <= addDays(start, 6) ? { ...ev, inWeek: true } : ev };
}

/**
 * Week by week from this week to the event's week (or `weeksIfNoEvent` weeks):
 * planned non-optional sessions and how many were verified.
 */
export function seasonPath(workouts, today, events = [], { weeksIfNoEvent = 8, maxWeeks = 52 } = {}) {
  const ev = nextEvent(events, today);
  const first = startOfWeek(today, 1);
  const last = ev ? startOfWeek(ev.date, 1) : addDays(first, (weeksIfNoEvent - 1) * 7);
  const weeks = [];
  for (let s = first, i = 0; s <= last && i < maxWeeks; s = addDays(s, 7), i++) {
    const end = addDays(s, 6);
    const inWeek = (workouts || []).filter((w) => w.date >= s && w.date <= end);
    weeks.push({
      start: s,
      isCurrent: s === first,
      isEventWeek: !!ev && s === last,
      planned: inWeek.filter((w) => w.source !== 'strava' && !w.optional).length,
      done: inWeek.filter(isVerified).length,
      minutes: inWeek.filter((w) => w.source !== 'strava').reduce((a, w) => a + (Number(w.durationMin) || 0), 0),
    });
  }
  return { event: ev, weeks };
}
