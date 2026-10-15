// plan-i18n.js — shows the seeded plan in the active language. The plan is
// stored in English (js/core/plan.js writes it once, then it's the athlete's
// data), so its words are translated where they're drawn, by exact match on
// the English text. Anything typed by the athlete or written by the AI coach
// isn't in the table and shows exactly as stored. Pure: no DOM.

import { getLang } from './i18n.js';
import {
  TITLES, TITLE_SUFFIX, NOTE_PREFIX, NOTES, SEGMENTS, ITEMS, PRINCIPLES, PACE_LABELS, PRESET_ITEMS, PRESET_BY_SPORT,
} from './locales/plan-es.js';

const isEs = () => getLang() === 'es';

/** A session title: "Easy run (deload)" → "Rodaje suave (descarga)". */
export function planTitle(title) {
  const s = String(title ?? '');
  if (!isEs() || !s) return s;
  const m = s.match(/^(.*?)((?: \((?:deload|taper)\))*)$/);
  const base = TITLES[m[1]];
  if (!base) return s;
  return base + m[2].replace(/\((deload|taper)\)/g, (_, k) => `(${TITLE_SUFFIX[k]})`);
}

/** Session notes: the deload/taper sentence, then the note itself. */
export function planNotes(notes) {
  const s = String(notes ?? '');
  if (!isEs() || !s) return s;
  let rest = s;
  let head = '';
  for (const [en, es] of Object.entries(NOTE_PREFIX)) {
    if (rest.startsWith(en)) { head = es; rest = rest.slice(en.length).trimStart(); break; }
  }
  const body = rest ? NOTES[rest] : '';
  if (rest && !body) return s; // not the seeded plan's words: leave it whole
  return [head, body].filter(Boolean).join(' ');
}

/** An interval label, a packing item, a principle or a pace-card line. */
export const planWord = (s) => {
  const v = String(s ?? '');
  if (!isEs()) return v;
  return SEGMENTS[v] || ITEMS[v] || PRINCIPLES[v] || PACE_LABELS[v] || v;
};

/** A packing item, read for its sport: "cap" is a gorra for a run, a gorro for a swim. */
export const planItem = (item, sport) => {
  const v = String(item ?? '');
  if (!isEs()) return v;
  return PRESET_BY_SPORT[sport]?.[v] || PRESET_ITEMS[v] || planWord(v);
};
