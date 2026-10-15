// disciplines.js — shared, DOM-free discipline + intensity metadata and the
// planned pace/zone hints surfaced inline on cards.

import { t, has } from './i18n.js';

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
// The words live in the locales under pace.<type>.<intensity>.
export function paceHint(type, intensity) {
  const key = `pace.${type}.${intensity}`;
  return has(key) ? t(key) : '';
}
