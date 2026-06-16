// calendar.js — pure .ics (iCalendar) export. Each session becomes a timed
// VEVENT (default 07:00 local, planned duration). No deps; CRLF per RFC 5545.

import { DISCIPLINES } from './disciplines.js';

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' + minutes-from-midnight -> 'YYYYMMDDTHHMMSS' floating local. */
function dt(dateIso, minutesFromMidnight) {
  const [y, m, d] = dateIso.split('-');
  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  return `${y}${m}${d}T${pad(hh)}${pad(mm)}00`;
}

function escText(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Build an .ics document from a list of workouts. startHour defaults to 07:00. */
export function toICS(workouts, { startHour = 7, calName = 'MOSKE Training' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MOSKE//Training//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escText(calName)}`,
  ];
  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

  for (const w of workouts) {
    if (!w.date) continue;
    const start = startHour * 60;
    const dur = Math.max(15, Number(w.durationMin) || 30);
    const d = DISCIPLINES[w.type] || {};
    const km = w.metrics?.distanceKm;
    const desc = [w.intensity ? `Intensity: ${w.intensity}` : '', km ? `Distance: ${km} km` : '', w.notes || '']
      .filter(Boolean).join('\\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escText(w.id)}@moske`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dt(w.date, start)}`,
      `DTEND:${dt(w.date, start + dur)}`,
      `SUMMARY:${escText(`${d.icon || ''} ${w.title || d.label || 'Session'}`.trim())}`,
      `DESCRIPTION:${escText(desc)}`,
      `STATUS:${w.completed ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
