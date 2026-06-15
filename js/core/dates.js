// dates.js — pure date helpers working on 'YYYY-MM-DD' strings.
// All Date objects are anchored at local noon to dodge DST / timezone edge cases.

/** Build a local Date at noon from a 'YYYY-MM-DD' string. */
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Format a Date (or 'YYYY-MM-DD') as 'YYYY-MM-DD' in local time. */
export function toISO(date) {
  if (typeof date === 'string') return date;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add n days to an ISO date, returning a new ISO date. */
export function addDays(iso, n) {
  const dt = parseISO(iso);
  dt.setDate(dt.getDate() + n);
  return toISO(dt);
}

/** Whole-day difference a - b (positive when a is later). */
export function diffDays(a, b) {
  const ms = parseISO(a).getTime() - parseISO(b).getTime();
  return Math.round(ms / 86400000);
}

/** Day of week with Monday = 0 ... Sunday = 6. */
export function weekdayMon0(iso) {
  return (parseISO(iso).getDay() + 6) % 7;
}

/**
 * Monday (or chosen weekStart) on/before the given date.
 * weekStart: 1 = Monday (default), 0 = Sunday.
 */
export function startOfWeek(iso, weekStart = 1) {
  const dow = parseISO(iso).getDay(); // Sun=0
  const delta = (dow - weekStart + 7) % 7;
  return addDays(iso, -delta);
}

/** Inclusive list of ISO dates from start to end. */
export function dateRange(startIso, endIso) {
  const out = [];
  let cur = startIso;
  while (diffDays(cur, endIso) <= 0) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Mon 6 Jul' style label. */
export function shortLabel(iso) {
  const dt = parseISO(iso);
  return `${SHORT_DAYS[weekdayMon0(iso)]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

/** 'Monday' weekday name. */
export function weekdayName(iso) {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekdayMon0(iso)];
}

export function monthName(iso) {
  return MONTHS[parseISO(iso).getMonth()];
}

export { SHORT_DAYS, MONTHS };
