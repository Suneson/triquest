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

// ---- race day ---------------------------------------------------------------

const RACE_CUE = {
  run: 'Start slower than feels right, settle by the second third, then empty the tank in the last.',
  bike: 'Ride your own numbers, not anyone else’s wheel. Eat early, drink often.',
  swim: 'Find clear water, long strokes, sight every six. Calm is fast.',
  brick: 'Swim calm, ride smart, run proud. Eat early on the bike, it pays you back on the run.',
  gym: 'Warm up properly, open with a lift you know you own, then go for it.',
  other: 'Pace the first third, fuel early, finish strong.',
};

const RACE_OPENERS = [
  (t) => `Race day: ${t}.`,
  (t) => `It’s here. ${t}.`,
  (t) => `${t}. This is what you trained for.`,
];

const RACE_CLOSERS = [
  'Every session you logged is in your legs today.',
  'Nothing new today: same breakfast, same kit, same you.',
  'Smile at the hard parts. You earned the right to be here.',
];

// deterministic pick so the line doesn't change on every redraw
const pick = (list, seed) => list[[...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0) % list.length];

/**
 * The athlete's race on `iso`, if any: a planned session marked as a race, or
 * an event saved in settings (onboarding's race date). Returns {title, type} or null.
 */
export function raceOn(workouts = [], events = [], iso) {
  const w = workouts.find((x) => x.date === iso && x.isRace);
  if (w) return { title: cleanRaceTitle(w.title) || 'Race', type: w.type || 'other', done: !!w.completed };
  const e = events.find((x) => x?.date === iso);
  return e ? { title: cleanRaceTitle(e.title) || 'Race', type: e.type || 'other', done: false } : null;
}

const cleanRaceTitle = (t) => String(t || '').replace(/\s*[—–-]\s*race day\s*$/i, '').trim();

/** The coach's line for race day (or the eve of it). */
export function raceLine(race, { eve = false, done = false, seed = '' } = {}) {
  if (!race) return '';
  const t = race.title || 'Race';
  if (done) return `${t}: done. Whatever the clock says, you showed up and finished. Proud of you.`;
  if (eve) return `${t} is tomorrow. Lay out your kit, eat what you know, sleep early. The hard work is already done.`;
  return `${pick(RACE_OPENERS, seed + t)(t)} ${RACE_CUE[race.type] || RACE_CUE.other} ${pick(RACE_CLOSERS, t + seed)}`;
}

/** Guidance for one session, shown at the top of its detail sheet. */
export function sessionLine(w) {
  if (!w) return '';
  if (w.completed) {
    return w.strava_activity_id || w.source === 'strava'
      ? 'Verified on Strava. That one counts. Recover well.'
      : 'Marked done. Link it on Strava to make it count.';
  }
  if (w.isRace) return raceLine({ title: cleanRaceTitle(w.title) || 'Race', type: w.type }, { seed: w.date });
  const opener = TYPE_OPENER[w.type] || TYPE_OPENER.other;
  const main = mainSet(w.notes).replace(/[.;,\s]+$/, '');
  if (main) return `${opener} Main set: ${clip(main)}.`;
  const z = Number(w.hr_zone);
  if (ZONE_CUE[z]) return `${opener} ${ZONE_CUE[z]}`;
  return `${opener} ${INTENSITY_CUE[w.intensity] || INTENSITY_CUE.steady}`;
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
