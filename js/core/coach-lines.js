// coach-lines.js — what the trainer says. Pure, rule-based picks from the
// session and the day; no network, no AI. Lines stay short enough for a
// dialogue box on a phone (one to two sentences). The words live in the
// locales under coach.*; this file only decides which line fits.

import { t, tList } from './i18n.js';
import { planTitle } from './plan-i18n.js';

const ZONES = [1, 2, 3, 4, 5];
const INTENSITY_KEYS = ['easy', 'steady', 'moderate', 'threshold', 'quality', 'vo2', 'race'];
const TYPES = ['run', 'bike', 'swim', 'gym', 'brick', 'mobility', 'other'];
const RACE_TYPES = ['run', 'bike', 'swim', 'brick', 'gym', 'other'];

const opener = (type) => t(`coach.opener.${TYPES.includes(type) ? type : 'other'}`);

/** Pull the [Main Set] block out of structured notes, if any. */
export function mainSet(notes) {
  const m = String(notes || '').match(/\[main set\]\s*([^[]*)/i);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}

function clip(s, n = 90) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

// ---- race day ---------------------------------------------------------------

// deterministic pick so the line doesn't change on every redraw
const pick = (list, seed) => list[[...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0) % list.length];

/**
 * The athlete's race on `iso`, if any: a planned session marked as a race, or
 * an event saved in settings (onboarding's race date). Returns {title, type} or null.
 * An untitled race reads as '' here; raceLine names it in the active language.
 */
export function raceOn(workouts = [], events = [], iso) {
  const w = workouts.find((x) => x.date === iso && x.isRace);
  if (w) return { title: planTitle(cleanRaceTitle(w.title)), type: w.type || 'other', done: !!w.completed };
  const e = events.find((x) => x?.date === iso);
  return e ? { title: cleanRaceTitle(e.title), type: e.type || 'other', done: false } : null;
}

const cleanRaceTitle = (s) => String(s || '').replace(/\s*[—–-]\s*(race day|día de carrera)\s*$/i, '').trim();

/** The coach's line for race day (or the eve of it). */
export function raceLine(race, { eve = false, done = false, seed = '' } = {}) {
  if (!race) return '';
  const name = race.title || t('coach.race');
  if (done) return t('coach.raceDone', { race: name });
  if (eve) return t('coach.raceEve', { race: name });
  const cue = t(`coach.raceCue.${RACE_TYPES.includes(race.type) ? race.type : 'other'}`);
  return `${pick(tList('coach.raceOpeners', { race: name }), seed + name)} ${cue} ${pick(tList('coach.raceClosers'), name + seed)}`;
}

/** Guidance for one session, shown at the top of its detail sheet. */
export function sessionLine(w) {
  if (!w) return '';
  if (w.completed) {
    return w.strava_activity_id || w.source === 'strava' ? t('coach.verified') : t('coach.markedDone');
  }
  if (w.isRace) return raceLine({ title: planTitle(cleanRaceTitle(w.title)), type: w.type }, { seed: w.date });
  const open = opener(w.type);
  const main = mainSet(w.notes).replace(/[.;,\s]+$/, '');
  if (main) return t('coach.mainSet', { opener: open, main: clip(main) });
  const z = Number(w.hr_zone);
  if (ZONES.includes(z)) return `${open} ${t(`coach.zone.${z}`)}`;
  return `${open} ${t(`coach.intensity.${INTENSITY_KEYS.includes(w.intensity) ? w.intensity : 'steady'}`)}`;
}

/**
 * One line for the day, shown in the Home quests panel.
 * @param {{planned: number, verified: number, questsDone: number, questsTotal: number, streak: number,
 *          race?: object|null, raceTomorrow?: object|null, today?: string}} s
 */
export function dayLine(s) {
  // race day beats everything else the coach could say
  if (s.race) return raceLine(s.race, { done: s.race.done || s.verified > 0, seed: s.today });
  if (s.raceTomorrow) return raceLine(s.raceTomorrow, { eve: true });
  if (s.questsTotal > 0 && s.questsDone === s.questsTotal) return t('coach.allCleared');
  if (s.verified > 0 && s.streak > 1) return t('coach.inARow', { n: s.streak });
  if (s.verified > 0) return t('coach.sessionVerified');
  if (s.planned === 0) return t('coach.restDay');
  if (s.streak > 0) return t('coach.streakOn', { n: s.streak });
  return t('coach.default');
}

/** Short lines for feedback moments. */
export const MOMENT_LINES = {
  get accepted() { return t('coach.moment.accepted'); },
  questDone: (text) => t('coach.moment.questDone', { text }),
  sportLevel: (label, level) => t('coach.moment.sportLevel', { label, level }),
  accountLevel: (level) => t('coach.moment.accountLevel', { level }),
  get stravaNudge() { return t('coach.moment.stravaNudge'); },
};
