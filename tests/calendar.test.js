import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toICS } from '../js/core/calendar.js';

const w = (over = {}) => ({ id: 'a1', date: '2026-07-06', type: 'run', title: 'Fartlek', intensity: 'quality', durationMin: 60, metrics: { distanceKm: 12 }, completed: false, ...over });

test('produces a valid VCALENDAR with one VEVENT per workout', () => {
  const ics = toICS([w(), w({ id: 'a2', date: '2026-07-07', type: 'bike' })]);
  assert.match(ics, /^BEGIN:VCALENDAR/);
  assert.match(ics, /END:VCALENDAR$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('\r\n'), 'uses CRLF line endings');
});

test('event has DTSTART/DTEND reflecting the planned duration', () => {
  const ics = toICS([w({ durationMin: 60 })], { startHour: 7 });
  assert.match(ics, /DTSTART:20260706T070000/);
  assert.match(ics, /DTEND:20260706T080000/);
});

test('summary + description carry title and distance; special chars escaped', () => {
  const ics = toICS([w({ title: 'Run; hard, fast', notes: 'line1\nline2' })]);
  assert.match(ics, /SUMMARY:.*Run\\; hard\\, fast/);
  assert.match(ics, /Distance: 12 km/);
  assert.match(ics, /line1\\nline2/);
});

test('completed sessions are CONFIRMED, planned are TENTATIVE', () => {
  assert.match(toICS([w({ completed: true })]), /STATUS:CONFIRMED/);
  assert.match(toICS([w({ completed: false })]), /STATUS:TENTATIVE/);
});

test('skips workouts without a date', () => {
  const ics = toICS([w({ date: null }), w({ id: 'ok' })]);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
});
