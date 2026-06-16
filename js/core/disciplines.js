// disciplines.js — shared, DOM-free discipline + intensity metadata and the
// planned pace/zone hints surfaced inline on cards.

export const DISCIPLINES = {
  run: { label: 'Run', icon: '🏃', color: 'var(--c-run)' },
  bike: { label: 'Bike', icon: '🚴', color: 'var(--c-bike)' },
  swim: { label: 'Swim', icon: '🏊', color: 'var(--c-swim)' },
  gym: { label: 'Gym', icon: '🏋️', color: 'var(--c-gym)' },
  brick: { label: 'Brick', icon: '🧱', color: 'var(--c-brick)' },
  mobility: { label: 'Mobility', icon: '🧘', color: 'var(--c-mobility)' },
  other: { label: 'Other', icon: '✨', color: 'var(--c-other)' },
};

export const INTENSITIES = {
  easy: 'Easy', steady: 'Steady', moderate: 'Moderate',
  threshold: 'Threshold', vo2: 'VO₂', quality: 'Quality', race: 'Race',
};

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
