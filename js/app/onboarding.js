// onboarding.js — the premium AI coaching questionnaire. One question per
// screen, thin gradient progress line, sliding transitions, and a Strava
// history deep-dive before the plan is generated. Matches the charcoal/matte
// aesthetic and never scrolls the page (each step is one fixed viewport).

import * as store from './store.js';
import { generateAIWorkoutPlan, stravaSummary } from './ai.js';
import { toast } from './effects.js';
import { esc } from './ui.js';
import { addDays } from '../core/dates.js';

// Every endurance discipline gets first-class onboarding: pure runners,
// cyclists and swimmers configure their own goal ladders alongside triathletes.
const ATHLETES = [
  { id: 'tri', name: 'Triathlete', sub: 'Swim · bike · run', sports: ['Swimming', 'Cycling', 'Running', 'Gym'] },
  { id: 'run', name: 'Runner', sub: '5k to ultra-marathon', sports: ['Running', 'Gym'] },
  { id: 'bike', name: 'Cyclist', sub: 'Road, gravel & endurance', sports: ['Cycling', 'Gym'] },
  { id: 'swim', name: 'Swimmer', sub: 'Pool & open water', sports: ['Swimming', 'Gym'] },
];
const GOALS_BY = {
  tri: [
    { id: 'sprint', name: 'Sprint Triathlon', sub: '750m swim · 20k bike · 5k run' },
    { id: 'olympic', name: 'Olympic Triathlon', sub: '1.5k swim · 40k bike · 10k run' },
    { id: 'half', name: '70.3 · Half-Ironman', sub: '1.9k swim · 90k bike · 21.1k run' },
    { id: 'full', name: '140.6 · Full Ironman', sub: '3.8k swim · 180k bike · 42.2k run' },
  ],
  run: [
    { id: '5k', name: '5k · 10k', sub: 'Speed & threshold development' },
    { id: 'half-mar', name: 'Half Marathon', sub: '21.1k endurance build' },
    { id: 'marathon', name: 'Marathon', sub: '42.2k full distance' },
    { id: 'ultra', name: 'Ultra / Trail', sub: '50k+ time-on-feet focus' },
  ],
  bike: [
    { id: 'fondo', name: 'Gran Fondo', sub: '100–160k endurance event' },
    { id: 'century', name: 'Century Ride', sub: '160k / 100 miles' },
    { id: 'stage', name: 'Stage Race / Tour', sub: 'Multi-day back-to-back load' },
    { id: 'ftp', name: 'FTP Builder', sub: 'No race — raise raw power' },
  ],
  swim: [
    { id: 'ow15', name: 'Open Water 1.5k', sub: 'First open-water distance' },
    { id: 'ow3k', name: 'Open Water 3k+', sub: 'Marathon-swim endurance' },
    { id: 'meet', name: 'Pool Meet', sub: '100–400m race pace' },
    { id: 'fitness', name: 'General Fitness', sub: 'Technique & aerobic base' },
  ],
};
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GEN_PHASES = [
  'AI Coach compiling multi-sport macrocycle…',
  'Balancing periodization curves…',
  'Calculating swim, bike and run intensity distribution…',
  'Scaling watt targets to your FTP…',
  'Validating progressive recovery phases…',
];

// Average weekly volume from the last 4 weeks of completed (Strava-verified) work.
function analyzeHistory(workouts) {
  const today = new Date().toISOString().slice(0, 10);
  const start = addDays(today, -27);
  const done = workouts.filter((w) => w.completed && w.date >= start && w.date <= today);
  const minOf = (t) => done.filter((w) => !t || w.type === t).reduce((a, w) => a + (w.durationMin || 0), 0);
  const kmOf = (t) => done.filter((w) => w.type === t)
    .reduce((a, w) => a + (Number(w.metrics?.distanceKm) || Number(w.actual?.distanceKm) || 0), 0);
  return {
    sessions: done.length,
    weeklyHours: Math.round((minOf() / 60 / 4) * 10) / 10,
    weeklySwimKm: Math.round((kmOf('swim') / 4) * 10) / 10,
    weeklyBikeHours: Math.round((minOf('bike') / 60 / 4) * 10) / 10,
    weeklyRunKm: Math.round((kmOf('run') / 4) * 10) / 10,
    stravaCount: done.filter((w) => w.strava_activity_id).length,
  };
}

export function openOnboarding({ onDone } = {}) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');

  const s = {
    athlete: null, goal: null, raceDate: '', raceName: '', raceMode: 'finish',
    ftp: store.getSettings().ftp || 250, runPace: '', swimPace: '', rhr: '', maxhr: '',
    longDays: [5, 6], restDays: [], hours: 8,
  };
  const hist = analyzeHistory(store.getWorkouts());
  let step = 0;              // 0..4 questions, 5 analysis, then generating
  const QUESTIONS = 5;
  const sportsOf = () => (ATHLETES.find((a) => a.id === s.athlete)?.sports) || ATHLETES[0].sports;

  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };

  const dayChips = (attr, selected) => DAY_LABELS.map((L, i) =>
    `<button type="button" class="ob-chip ${selected.includes(i) ? 'on' : ''}" data-${attr}="${i}">${L}</button>`).join('');

  const stepHtml = () => {
    if (step === 0) {
      return `<h2>What kind of athlete are you?</h2>
        <div class="ob-grid">${ATHLETES.map((a) => `
          <button type="button" class="ob-choice ${s.athlete === a.id ? 'on' : ''}" data-athlete="${a.id}">
            <b>${a.name}</b><small>${a.sub}</small>
          </button>`).join('')}</div>`;
    }
    if (step === 1) {
      return `<h2>What is your primary distance goal?</h2>
        <div class="ob-grid">${(GOALS_BY[s.athlete] || GOALS_BY.tri).map((g) => `
          <button type="button" class="ob-choice ${s.goal === g.id ? 'on' : ''}" data-goal="${g.id}">
            <b>${g.name}</b><small>${g.sub}</small>
          </button>`).join('')}</div>`;
    }
    if (step === 2) {
      return `<h2>When is your primary A-Race?</h2>
        <div class="ob-fields">
          <label class="ob-field"><span>Race date</span><input type="date" data-ob="raceDate" value="${esc(s.raceDate)}"></label>
          <label class="ob-field"><span>Race name</span><input type="text" data-ob="raceName" placeholder="Ironman 70.3 Marbella" value="${esc(s.raceName)}"></label>
        </div>
        <div class="ob-chip-row">
          <button type="button" class="ob-chip wide ${s.raceMode === 'finish' ? 'on' : ''}" data-mode="finish">Just finish comfortably</button>
          <button type="button" class="ob-chip wide ${s.raceMode === 'pr' ? 'on' : ''}" data-mode="pr">Execute a PR / time goal</button>
        </div>`;
    }
    if (step === 3) {
      const sp = sportsOf();
      return `<h2>Set your performance baselines.</h2>
        <div class="ob-fields">
          ${sp.includes('Cycling') ? `<label class="ob-field"><span>Cycling FTP (W)</span><input type="number" inputmode="numeric" min="50" max="600" data-ob="ftp" value="${esc(String(s.ftp))}"></label>` : ''}
          ${sp.includes('Running') ? `<label class="ob-field"><span>Run threshold pace</span><input type="text" data-ob="runPace" placeholder="4:30 min/km" value="${esc(s.runPace)}"></label>` : ''}
          ${sp.includes('Swimming') ? `<label class="ob-field"><span>Swim 100m pace</span><input type="text" data-ob="swimPace" placeholder="1:45 / 100m" value="${esc(s.swimPace)}"></label>` : ''}
          <div class="ob-half">
            <label class="ob-field"><span>Resting HR <em>optional</em></span><input type="number" inputmode="numeric" data-ob="rhr" placeholder="—" value="${esc(s.rhr)}"></label>
            <label class="ob-field"><span>Max HR <em>optional</em></span><input type="number" inputmode="numeric" data-ob="maxhr" placeholder="—" value="${esc(s.maxhr)}"></label>
          </div>
        </div>`;
    }
    if (step === 4) {
      return `<h2>What does your training week look like?</h2>
        <div class="ob-sub">Preferred long-session days</div>
        <div class="ob-chip-row">${dayChips('long', s.longDays)}</div>
        <div class="ob-sub">Absolute rest days</div>
        <div class="ob-chip-row">${dayChips('rest', s.restDays)}</div>
        <div class="ob-sub">Weekly training capacity</div>
        <div class="ob-hours"><b>${s.hours}<small> h / week</small></b>
          <input type="range" min="4" max="20" step="1" value="${s.hours}" data-ob-hours></div>`;
    }
    // step 4 — Strava deep-dive
    const gap = hist.weeklyHours > 0 && s.hours > hist.weeklyHours * 1.15;
    const row = (k, v) => `<div class="ob-hist-row"><span>${k}</span><b>${v}</b></div>`;
    return `<h2>Analyzing your athletic profile with Strava</h2>
      <div class="ob-hist">
        ${row('Sessions · last 4 weeks', hist.sessions)}
        ${row('Avg weekly volume', `${hist.weeklyHours} h`)}
        ${row('Weekly bike', `${hist.weeklyBikeHours} h`)}
        ${row('Weekly run', `${hist.weeklyRunKm} km`)}
        ${row('Weekly swim', `${hist.weeklySwimKm} km`)}
        ${row('Strava-verified', hist.stravaCount)}
      </div>
      ${gap
        ? `<p class="ob-note warn">Your target of <b>${s.hours} h/week</b> is well above your recent ~${hist.weeklyHours} h/week.
             The plan will apply an injury-prevention ramp — volume builds at most 10–15% per week from your real baseline.</p>`
        : hist.weeklyHours > 0
          ? `<p class="ob-note ok">Your target of <b>${s.hours} h/week</b> matches your recent training — the plan builds straight from your baseline.</p>`
          : `<p class="ob-note">No recent history found — the plan starts from a conservative base and builds gradually.</p>`}`;
  };

  const draw = (dir = 1) => {
    const pct = Math.round(((step + 1) / (QUESTIONS + 1)) * 100);
    root.innerHTML = `
    <div class="ob-screen" role="dialog" aria-modal="true" aria-label="AI coach setup">
      <div class="ob-progress"><i style="width:${pct}%"></i></div>
      <div class="ob-head">
        <button class="fh-back" data-ob-back aria-label="Back">←</button>
        <small>AI Coach · ${step < QUESTIONS ? `Step ${step + 1} of ${QUESTIONS}` : 'Strava analysis'}</small>
      </div>
      <div class="ob-card ${dir >= 0 ? 'ob-in-right' : 'ob-in-left'}">${stepHtml()}</div>
      <footer class="ob-foot">
        <button class="btn primary block" data-ob-next>${step === QUESTIONS ? 'Generate Tailored Plan' : 'Continue'}</button>
      </footer>
    </div>`;
    wire();
  };

  const generating = () => {
    root.innerHTML = `
    <div class="ob-screen ob-gen" role="dialog" aria-modal="true" aria-label="Generating plan">
      <div class="ob-gen-orb"></div>
      <h2 id="ob-phase">${GEN_PHASES[0]}</h2>
      <p class="ob-sub" style="text-align:center">This takes a few seconds — your macrocycle is being tailored.</p>
    </div>`;
    let i = 0;
    const cycle = setInterval(() => {
      const el = document.getElementById('ob-phase');
      if (!el) { clearInterval(cycle); return; }
      i = (i + 1) % GEN_PHASES.length;
      el.textContent = GEN_PHASES[i];
    }, 1600);
    return () => clearInterval(cycle);
  };

  const generate = async () => {
    const stopCycle = generating();
    const athlete = ATHLETES.find((a) => a.id === s.athlete) || ATHLETES[0];
    const goal = (GOALS_BY[s.athlete] || GOALS_BY.tri).find((g) => g.id === s.goal);
    const gap = hist.weeklyHours > 0 && s.hours > hist.weeklyHours * 1.15;
    try {
      const events = (s.raceDate && (s.raceName || goal))
        ? [{ title: s.raceName || `${goal?.name || 'A-Race'}`, date: s.raceDate }] : [];
      if (events.length) store.setSetting('events', events);
      store.setSetting('ftp', s.ftp);

      const r = await generateAIWorkoutPlan({
        sports: athlete.sports,
        athlete_type: athlete.name,
        goal_distance: goal?.name || athlete.name,
        a_race: { name: s.raceName, date: s.raceDate, execution: s.raceMode === 'pr' ? 'competitive time goal' : 'finish comfortably' },
        baselines: { run_threshold_pace: s.runPace, swim_100m_pace: s.swimPace, resting_hr: s.rhr, max_hr: s.maxhr },
        ftp: s.ftp,
        weekly_hours_target: s.hours,
        long_days: s.longDays.map((i) => DAY_LABELS[i]),
        rest_days: s.restDays.map((i) => DAY_LABELS[i]),
        daysPerWeek: 7 - s.restDays.length,
        max_double_days: s.hours >= 12 ? 2 : 1,
        historical_weekly_hours: hist.weeklyHours,
        ramp_rule: gap
          ? `athlete's real recent volume is only ${hist.weeklyHours} h/week — start near that baseline and increase total weekly volume by no more than 10-15% per week toward the ${s.hours} h target`
          : null,
      }, stravaSummary(store.getWorkouts()));

      stopCycle();
      store.setSetting('goals', { ...(store.getSettings().goals || {}), hours: s.hours, sessions: 7 - s.restDays.length });
      close();
      toast(`AI Coach added ${r.inserted} tailored sessions to your calendar ✨`);
      setTimeout(() => store.commit(), 1200);
      if (onDone) onDone();
    } catch (err) {
      stopCycle();
      step = QUESTIONS;
      draw(-1);
      const msgEl = document.createElement('p');
      msgEl.className = 'ob-note warn';
      msgEl.textContent = err.message || 'Plan generation failed — try again.';
      root.querySelector('.ob-card')?.appendChild(msgEl);
    }
  };

  function wire() {
    root.querySelector('[data-ob-back]').addEventListener('click', () => {
      if (step === 0) { close(); return; }
      step -= 1; draw(-1);
    });
    root.querySelector('[data-ob-next]').addEventListener('click', () => {
      if (step === 0 && !s.athlete) { toast('Pick your discipline first'); return; }
      if (step === 1 && !s.goal) { toast('Pick your distance goal first'); return; }
      if (step === QUESTIONS) { generate(); return; }
      step += 1; draw(1);
    });
    root.querySelectorAll('[data-athlete]').forEach((b) => b.addEventListener('click', () => {
      if (s.athlete !== b.dataset.athlete) s.goal = null; // goal ladders differ per discipline
      s.athlete = b.dataset.athlete;
      root.querySelectorAll('[data-athlete]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    root.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => {
      s.goal = b.dataset.goal;
      root.querySelectorAll('[data-goal]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      s.raceMode = b.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    root.querySelectorAll('[data-ob]').forEach((el) => el.addEventListener('input', () => {
      const k = el.dataset.ob;
      s[k] = k === 'ftp' ? Math.max(0, parseInt(el.value) || 0) : el.value;
    }));
    const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    root.querySelectorAll('[data-long]').forEach((b) => b.addEventListener('click', () => {
      s.longDays = toggleIn(s.longDays, +b.dataset.long); b.classList.toggle('on');
    }));
    root.querySelectorAll('[data-rest]').forEach((b) => b.addEventListener('click', () => {
      s.restDays = toggleIn(s.restDays, +b.dataset.rest); b.classList.toggle('on');
    }));
    const hrs = root.querySelector('[data-ob-hours]');
    if (hrs) hrs.addEventListener('input', () => {
      s.hours = +hrs.value;
      root.querySelector('.ob-hours b').innerHTML = `${s.hours}<small> h / week</small>`;
    });
  }

  draw(1);
}
