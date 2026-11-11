// convert-plan.mjs — turn a human/AI-authored "triquest-plan/v2" coaching plan
// into a TriQuest import snapshot (the shape Settings → Import JSON expects).
//
//   node tools/convert-plan.mjs <plan.json> <out.json>
//
// The app imports a WHOLE APP SNAPSHOT, not a plan document: top-level
// { version, settings, workouts[], unlockedBadges[] }. Anything else is dropped,
// and a missing `workouts` array makes the migration silently reseed the stock
// plan — so this script is the bridge between the two formats.

import { readFileSync, writeFileSync } from 'node:fs';

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node tools/convert-plan.mjs <plan.json> <out.json>'); process.exit(1); }

const plan = JSON.parse(readFileSync(IN, 'utf8'));
const FTP = plan.zones?.power?.ftpWatts || plan.athlete?.ftpWatts || 250;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const warn = [];

// The athlete's own tested power zones drive every watt we infer, so the bars
// match the numbers they actually ride to.
const ZONE_W = {};
for (const z of plan.zones?.power?.zones || []) {
  const lo = Number(z.minW) || 0;
  const hi = Number(z.maxW) || Math.round(lo * 1.2);
  ZONE_W[z.z] = Math.round((Math.max(lo, 60) + hi) / 2);
}
const zoneWatts = (z) => ZONE_W[z] || Math.round(FTP * [0, 0.5, 0.68, 0.83, 0.97, 1.12][z] || FTP * 0.7);

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ---- field mapping ----------------------------------------------------------

// TriQuest has exactly seven disciplines; everything must land on one of them.
function mapType(s) {
  if (s.type === 'brick') return 'brick';
  if (s.type === 'mobility') return 'mobility';
  if (s.sport === 'triathlon') return 'brick';   // swim+bike+run in one session
  if (['bike', 'run', 'swim', 'gym'].includes(s.sport)) return s.sport;
  return 'other';
}

// TriQuest has exactly seven intensities; they set the XP multiplier, so the
// mapping follows effort, reading the plan's own zone strings.
function mapIntensity(s) {
  const zone = `${s.intensity?.zone || ''} ${s.title || ''}`.toLowerCase();
  if (s.type === 'race' || s.type === 'race_sim') return 'race';
  if (/z5|vo2/.test(zone)) return 'vo2';
  if (/z4|threshold/.test(zone)) return 'threshold';
  if (/z1\b|recovery/.test(zone) || ['recovery', 'logistics'].includes(s.type)) return 'easy';
  if (s.type === 'intervals') return 'quality';
  if (/z3|tempo|race pace|race power/.test(zone)) return 'moderate';
  if (['technique', 'activation', 'mobility'].includes(s.type)) return 'easy';
  if (s.type === 'strength' || s.type === 'test') return 'moderate';
  return 'steady';
}

// hr_zone drives the neon Z1–Z5 badge on the card.
function mapHrZone(s) {
  const zone = (s.intensity?.zone || '').toLowerCase();
  const m = zone.match(/z([1-5])/);
  if (m) return +m[1];
  const inten = mapIntensity(s);
  return { easy: 1, steady: 2, moderate: 3, threshold: 4, quality: 4, vo2: 5, race: 4 }[inten] || 2;
}

const minutesIn = (t) => { const m = String(t || '').match(/(\d+)\s*min/i); return m ? +m[1] : null; };

// Absolute watts from any phrasing the plan uses: "240-255W", "@ 260W",
// "88-93% FTP", "<150", or a bare zone label.
function wattsIn(text) {
  const t = String(text || '');
  let m = t.match(/(\d{2,4})\s*-\s*(\d{2,4})\s*W/i);
  if (m) return Math.round((+m[1] + +m[2]) / 2);
  m = t.match(/(\d{2,4})\s*W\b/i);
  if (m) return +m[1];
  m = t.match(/(\d{2,3})\s*-\s*(\d{2,3})\s*%\s*FTP/i);
  if (m) return Math.round(((+m[1] + +m[2]) / 2 / 100) * FTP);
  m = t.match(/(\d{2,3})\s*%\s*FTP/i);
  if (m) return Math.round((+m[1] / 100) * FTP);
  m = t.match(/<\s*(\d{2,4})/);
  if (m) return Math.round(+m[1] * 0.85);
  m = t.match(/z([1-5])/i);
  if (m) return zoneWatts(+m[1]);
  if (/progressive|easy|spin/i.test(t)) return zoneWatts(2);
  return null;
}

// Zwift-style interval bars: expand the structure into [{min,watts}] blocks.
function buildPower(s) {
  if (mapType(s) !== 'bike' || !Array.isArray(s.structure)) return [];
  const blocks = [];
  const fallbackW = wattsIn(s.intensity?.powerW || s.intensity?.zone) || zoneWatts(2);

  for (const b of s.structure) {
    const label = `${b.name || ''}`.toLowerCase();
    if (b.work) {
      const reps = Math.max(1, Number(b.repeats) || 1);
      const wMin = minutesIn(b.work);
      const wW = wattsIn(b.work) || fallbackW;
      const rMin = minutesIn(b.recovery);
      const rW = wattsIn(b.recovery) || zoneWatts(1);
      if (!wMin) continue;
      for (let i = 0; i < reps; i++) {
        blocks.push({ min: wMin, watts: wW });
        if (rMin && i < reps - 1) blocks.push({ min: rMin, watts: rW });
      }
      continue;
    }
    const min = minutesIn(b.detail);
    if (!min) continue;
    const watts = wattsIn(b.detail) || (/cool|warm/.test(label) ? zoneWatts(2) : fallbackW);
    blocks.push({ min, watts });
  }
  return blocks.filter((b) => b.watts >= 50 && b.watts <= 2000).slice(0, 40);
}

// Gym movements become real exercise rows (tickable, with sets/reps/RPE).
function buildExercises(s) {
  if (mapType(s) !== 'gym' || !Array.isArray(s.structure)) return [];
  return s.structure
    .filter((b) => b.sets != null || b.reps != null)
    .map((b) => ({
      name: [b.name, b.perSide ? '(per side)' : ''].filter(Boolean).join(' '),
      sets: Number(b.sets) || 3,
      reps: String(b.reps ?? '8'),
      done: false, weight: b.load ? String(b.load) : '', actualReps: '', rpe: '', notes: '', imageUrl: '',
    }));
}

// The detail view ONLY renders notes inside [Bracketed] blocks, so every piece
// of coaching prose has to be wrapped in one or it is invisible in the app.
function buildNotes(s, exercises = []) {
  const out = [];
  // Gym movements already render as tickable exercise rows; repeating their
  // sets/reps in the session block just duplicates the same numbers.
  const skipSets = exercises.length > 0;
  const targets = [
    s.intensity?.powerW ? `${s.intensity.powerW} W` : '',
    s.intensity?.hrBpm ? `${s.intensity.hrBpm} bpm` : '',
    s.intensity?.paceMinKm ? `${s.intensity.paceMinKm} /km` : '',
    s.intensity?.zone && s.intensity.zone !== 'n/a' ? s.intensity.zone : '',
  ].filter(Boolean).join(' · ');
  if (targets && !/^(race|mixed|n\/a)$/i.test(targets)) out.push(`[Target] ${targets}`);

  for (const b of s.structure || []) {
    const name = b.name || 'Block';
    if (b.work) {
      const reps = Number(b.repeats) || 1;
      const rec = b.recovery && b.recovery !== '-' ? ` / ${b.recovery} recovery` : '';
      out.push(`[${name}] ${reps > 1 ? `${reps}x ` : ''}${b.work}${rec}`);
    } else if (b.detail) {
      out.push(`[${name}] ${b.detail}${b.target ? ` (target ${b.target})` : ''}`);
    } else if (b.target) {
      out.push(`[${name}] target ${b.target}`);
    } else if (b.sets != null && !skipSets) {
      out.push(`[${name}] ${b.sets}x${b.reps}${b.load ? ` @ ${b.load}` : ''}`);
    }
  }
  if (s.location) out.push(`[Where] ${s.location}`);
  if (s.fuelling) out.push(`[Fuelling] ${s.fuelling}`);
  if (s.rpe != null) out.push(`[RPE] ${s.rpe}/10`);
  // Commas split a block into bullet pills; prose reads better as one line.
  if (s.notes) out.push(`[Coach] ${s.notes.replace(/,\s*/g, ' · ').replace(/;\s*/g, ' · ')}`);
  return out.join(' ');
}

// ---- build the snapshot -----------------------------------------------------

const workouts = [];
for (const wk of plan.weeks || []) {
  const monday = new Date(`${wk.start}T00:00:00Z`).getUTCDay();
  if (monday !== 1) warn.push(`week ${wk.week} starts ${wk.start}, which is not a Monday`);

  DAYS.forEach((dk, di) => {
    const sessions = wk.days?.[dk] || [];
    sessions.forEach((s, si) => {
      const date = addDays(wk.start, di);
      if (date > wk.end) warn.push(`week ${wk.week} ${dk} -> ${date} falls past week end ${wk.end}`);
      const type = mapType(s);
      const power = buildPower(s);
      const w = {
        id: `plan-${date}-${si}`,
        date,
        type,
        title: s.title || 'Session',
        intensity: mapIntensity(s),
        durationMin: Math.max(0, Math.round(Number(s.durationMin) || 0)),
        metrics: { distanceKm: s.distanceKm != null ? Number(s.distanceKm) : '' },
        completed: false,
        completedAt: null,
        phase: wk.phase || '',
        phaseId: String(wk.phase || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        weekNum: wk.week,
        deload: /recovery|taper/i.test(wk.phase || '') && s.type !== 'race',
        isRace: s.type === 'race',
        seeded: false,
        source: 'custom',
        segments: [],
        exercises: buildExercises(s),
        packing: [],
        notes: buildNotes(s, buildExercises(s)),
        actual: null,
        strava_activity_id: null,
        hr_zone: mapHrZone(s),
        updated_at: new Date().toISOString(),
      };
      if (power.length) w.power = power;
      workouts.push(w);
    });
  });
}

// Weekly targets -> the app's goal rings (averaged across the plan).
const weeks = plan.weeks || [];
const avg = (f) => Math.round(weeks.reduce((a, w) => a + (Number(f(w)) || 0), 0) / (weeks.length || 1));
const race = (plan.goals || []).find((g) => g.type === 'race');

const snapshot = {
  version: 2,
  settings: {
    sound: true,
    units: 'metric',
    weekStart: 1,
    reduceMotion: false,
    ftp: FTP,
    goals: {
      sessions: Math.round(workouts.length / (weeks.length || 1)),
      km: avg((w) => (w.targets?.bikeKm || 0) + (w.targets?.runKm || 0)),
      hours: avg((w) => w.targets?.totalHours || 0),
    },
    events: (plan.goals || [])
      .filter((g) => g.date)
      .map((g) => ({ title: g.name, date: g.date })),
    packing: {
      run: ['shoes', 'watch', 'gels', 'cap'],
      bike: ['bib', 'shoes', 'bottles', 'helmet'],
      swim: ['trunks', 'goggles', 'cap', 'towel'],
      gym: ['shoes', 'belt', 'water'],
    },
  },
  workouts,
  unlockedBadges: [],
};

writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);

const byType = {};
for (const w of workouts) byType[w.type] = (byType[w.type] || 0) + 1;
console.log(`workouts: ${workouts.length}`);
console.log(`by type : ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`dates   : ${workouts[0].date} -> ${workouts.at(-1).date}`);
console.log(`ftp     : ${FTP}W; power charts on ${workouts.filter((w) => w.power).length} rides`);
console.log(`events  : ${snapshot.settings.events.map((e) => `${e.title} ${e.date}`).join(' | ')}`);
if (warn.length) console.log(`WARNINGS:\n  ${warn.join('\n  ')}`);
