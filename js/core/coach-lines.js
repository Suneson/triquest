// coach-lines.js — what the trainer says. Pure, rule-based picks from the
// session and the day; no network, no AI. Lines stay short enough for a
// dialogue box on a phone (one to two sentences).

const ZONE_CUE = {
  1: 'Zone 1: barely working, nose-breathing easy.',
  2: 'Zone 2: you should be able to chat the whole way.',
  3: 'Zone 3: steady and honest, a few words at a time.',
  4: 'Zone 4: threshold. Hard but controlled, no surging.',
  5: 'Zone 5: short and sharp. Full recovery between reps.',
};

const INTENSITY_CUE = {
  easy: 'Keep it genuinely easy. Easy days make the hard days work.',
  steady: 'Settle into a rhythm you could hold for hours.',
  moderate: 'Comfortably hard. Stay smooth, stay relaxed.',
  threshold: 'Sit right on the edge: hard, but never ragged.',
  quality: 'Quality over quantity. Nail every rep, then stop.',
  vo2: 'Big efforts, full recoveries. Start the first rep a touch easy.',
  race: "Race day. Trust the training and pace the first third.",
};

const TYPE_OPENER = {
  run: 'Run day.',
  bike: 'Time on the bike.',
  swim: 'Into the pool.',
  gym: 'Gym session.',
  brick: 'Brick day: bike, then straight into the run.',
  mobility: 'Mobility work.',
  other: 'Session on the board.',
};

/** Pull the [Main Set] block out of structured notes, if any. */
export function mainSet(notes) {
  const m = String(notes || '').match(/\[main set\]\s*([^[]*)/i);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}

function clip(s, n = 90) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Guidance for one session, shown at the top of its detail sheet. */
export function sessionLine(w) {
  if (!w) return '';
  if (w.completed) {
    return w.strava_activity_id || w.source === 'strava'
      ? 'Verified on Strava. That one counts. Recover well.'
      : 'Marked done. Link it on Strava to make it count.';
  }
  const opener = TYPE_OPENER[w.type] || TYPE_OPENER.other;
  const main = mainSet(w.notes).replace(/[.;,\s]+$/, '');
  if (main) return `${opener} Main set: ${clip(main)}.`;
  const z = Number(w.hr_zone);
  if (ZONE_CUE[z]) return `${opener} ${ZONE_CUE[z]}`;
  return `${opener} ${INTENSITY_CUE[w.intensity] || INTENSITY_CUE.steady}`;
}

/**
 * One line for the day, shown in the Home quests panel.
 * @param {{planned: number, verified: number, questsDone: number, questsTotal: number, streak: number}} s
 */
export function dayLine(s) {
  if (s.questsTotal > 0 && s.questsDone === s.questsTotal) return 'All quests cleared. Rest up, same time tomorrow.';
  if (s.verified > 0 && s.streak > 1) return `${s.streak} days in a row. Keep stacking them.`;
  if (s.verified > 0) return 'Session verified. Check what is left on the board.';
  if (s.planned === 0) return 'Rest day. Recovery is training too.';
  if (s.streak > 0) return `Streak on ${s.streak}. One verified session keeps it alive.`;
  return 'Quests complete when Strava verifies your session.';
}

/** Short lines for feedback moments. */
export const MOMENT_LINES = {
  accepted: 'Quest accepted. I will see you out there.',
  questDone: (text) => `Quest complete: ${text}.`,
  sportLevel: (label, level) => `${label} level ${level}. New ground unlocked.`,
  accountLevel: (level) => `Account level ${level}. You are building something.`,
  stravaNudge: 'Connect Strava. Verified sessions are what earn XP and quests.',
};
