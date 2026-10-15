// disciplines.js — shared, DOM-free discipline + intensity metadata and the
// planned pace/zone hints surfaced inline on cards.

import { t } from './i18n.js';

// labels are getters, so every DISCIPLINES[type].label and INTENSITIES[key]
// reads the active language without the call sites changing
const disc = (key, icon, color) => ({ get label() { return t(`sport.${key}`); }, icon, color });
export const DISCIPLINES = {
  run: disc('run', '🏃', 'var(--c-run)'),
  bike: disc('bike', '🚴', 'var(--c-bike)'),
  swim: disc('swim', '🏊', 'var(--c-swim)'),
  gym: disc('gym', '🏋️', 'var(--c-gym)'),
  brick: disc('brick', '🧱', 'var(--c-brick)'),
  mobility: disc('mobility', '🧘', 'var(--c-mobility)'),
  other: disc('other', '✨', 'var(--c-other)'),
};

export const INTENSITIES = Object.defineProperties({}, Object.fromEntries(
  ['easy', 'steady', 'moderate', 'threshold', 'vo2', 'quality', 'race'].map((k) => [k, { enumerable: true, get: () => t(`intensity.${k}`) }]),
));

// Planned pace / zone target by discipline + intensity (from the plan's
// reference card). Returns a short string, or '' when not applicable.
const PACE = {
  run: {
    easy: '~5:05–5:30 /km', steady: '~5:00 /km', moderate: 'MP ~4:40–4:55 /km',
    threshold: '~4:10–4:25 /km (RPE 6–7)', quality: 'hard reps, RPE 7–8', vo2: 'RPE 8–9', race: 'race pace',
  },
  bike: {
    easy: 'Z2 recovery, RPE 3', steady: 'Z2 conversational, RPE 3–4',
    threshold: '2–3×12–15′, RPE 6–7', quality: 'RPE 7', vo2: '5×3′, RPE 8–9', race: 'race effort',
  },
  swim: { easy: 'easy aerobic', steady: 'aerobic technique' },
  brick: { race: '70.3 race pace off the bike' },
};

export function paceHint(type, intensity) {
  return (PACE[type] && PACE[type][intensity]) || '';
}
