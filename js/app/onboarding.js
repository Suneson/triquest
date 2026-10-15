// onboarding.js — the premium AI coaching questionnaire. One question per
// screen, thin gradient progress line, sliding transitions, and a Strava
// history deep-dive before the plan is generated. The step pipeline is
// DYNAMIC: it branches per training ecosystem (Endurance / HYROX / Hybrid /
// Gym) so every archetype gets a tailored interview.

import * as store from './store.js';
import { generateAIWorkoutPlan, stravaSummary } from './ai.js';
import { toast } from './effects.js';
import { svg } from '../core/icons.js';
import { esc } from './ui.js';
import { addDays, todayISO } from '../core/dates.js';
import { SPLIT_PRESETS, SPLIT_GROUPS, presetSplit, normalizeSplit, splitWarnings, moveGroup } from '../core/gym-split.js';
import { openLayer, closeLayer } from './nav.js';

// ---- static choice matrices --------------------------------------------------

const ECOS = [
  { id: 'endurance', name: 'Endurance / Triathlon', sub: 'Swim, bike & run progression' },
  { id: 'hyrox', name: 'HYROX', sub: 'Functional hybrid power + aerobic pacing' },
  { id: 'hybrid', name: 'Hybrid Athlete', sub: 'Weight-room strength + cardio disciplines' },
  { id: 'gym', name: 'Only Gym / Strength', sub: 'Weight training, splits & conditioning' },
];

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

const GYM_GOALS = [
  { id: 'strength', name: 'Maximum Strength', sub: 'Heavy compound lifts, low reps' },
  { id: 'hypertrophy', name: 'Hypertrophy / Muscle Building', sub: 'Volume-driven splits' },
  { id: 'conditioning', name: 'Functional Conditioning', sub: 'Engine work, circuits, carries' },
  { id: 'support', name: 'Endurance & Injury Prevention', sub: 'Strength that supports cardio sport' },
];

const HYBRID_SPORTS = ['Gym / Strength', 'Running', 'Cycling', 'Swimming'];
const HYBRID_MAP = { 'Gym / Strength': 'Gym', Running: 'Running', Cycling: 'Cycling', Swimming: 'Swimming' };

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GEN_PHASES = [
  'AI Coach compiling multi-sport macrocycle…',
  'Balancing periodization curves…',
  'Calculating intensity distribution…',
  'Scaling strength & watt targets to your baselines…',
  'Validating progressive recovery phases…',
];

// Average weekly volume from the last 4 weeks of completed (Strava-verified) work.
function analyzeHistory(workouts) {
  const today = todayISO();
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
  const root = openLayer('ai-wizard', { reuse: false });

  const s = {
    eco: null, athlete: null, goal: null, hybridSports: [], gymGoal: null,
    raceDate: '', raceName: '', raceMode: 'finish',
    ftp: store.getSettings().ftp || 250, runPace: '', swimPace: '', rhr: '', maxhr: '',
    sled: '', wallball: '',
    longDays: [5, 6], restDays: [], hours: 8,
    split: store.getSettings().gymSplit ? normalizeSplit(store.getSettings().gymSplit) : presetSplit('ppl'),
  };
  let picked = null; // the chip picked in the split editor: { day, idx }
  const gymInPlay = () => s.eco === 'gym' || (s.eco === 'hybrid' && s.hybridSports.includes('Gym / Strength'));
  const hist = analyzeHistory(store.getWorkouts());
  let idx = 0;

  // Dynamic pipeline: recomputed every draw so branch choices reshape the flow.
  const stepKeys = () => {
    const k = ['eco'];
    if (s.eco === 'endurance') k.push('athlete', 'goal');
    if (s.eco === 'hybrid') k.push('hybrid');
    if (gymInPlay()) k.push('gymgoal', 'split');
    if (s.eco === 'hyrox') k.push('hyrox');
    if (s.eco !== 'gym') k.push('race');
    k.push('baselines', 'week', 'analysis');
    return k;
  };

  const sportsOf = () => {
    if (s.eco === 'gym') return ['Gym'];
    if (s.eco === 'hyrox') return ['Running', 'Gym'];
    if (s.eco === 'hybrid') {
      const picked = s.hybridSports.map((x) => HYBRID_MAP[x]).filter(Boolean);
      return picked.length ? picked : ['Gym', 'Running'];
    }
    return (ATHLETES.find((a) => a.id === s.athlete)?.sports) || ATHLETES[0].sports;
  };

  const close = () => closeLayer(root);

  const choiceGrid = (items, attr, current) => `<div class="ob-grid">${items.map((it) => `
    <button type="button" class="ob-choice ${current === it.id ? 'on' : ''}" data-${attr}="${it.id}">
      <b>${it.name}</b><small>${it.sub}</small>
    </button>`).join('')}</div>`;

  const dayChips = (attr, selected) => DAY_LABELS.map((L, i) =>
    `<button type="button" class="ob-chip ${selected.includes(i) ? 'on' : ''}" data-${attr}="${i}">${L}</button>`).join('');

  const stepHtml = (key) => {
    if (key === 'eco') {
      return `<h2>Select your primary training ecosystem:</h2>${choiceGrid(ECOS, 'eco', s.eco)}`;
    }
    if (key === 'athlete') {
      return `<h2>What kind of endurance athlete are you?</h2>${choiceGrid(ATHLETES, 'athlete', s.athlete)}`;
    }
    if (key === 'goal') {
      return `<h2>What is your primary distance goal?</h2>${choiceGrid(GOALS_BY[s.athlete] || GOALS_BY.tri, 'goal', s.goal)}`;
    }
    if (key === 'hybrid') {
      return `<h2>Build your hybrid mix.</h2>
        <div class="ob-sub">Pick every discipline your week should include</div>
        <div class="ob-chip-row">${HYBRID_SPORTS.map((sp) =>
          `<button type="button" class="ob-chip wide ${s.hybridSports.includes(sp) ? 'on' : ''}" data-hyb="${esc(sp)}">${esc(sp)}</button>`).join('')}</div>`;
    }
    if (key === 'gymgoal') {
      return `<h2>What is your primary weight room goal?</h2>${choiceGrid(GYM_GOALS, 'gymgoal', s.gymGoal)}`;
    }
    if (key === 'split') return splitHtml();
    if (key === 'hyrox') {
      return `<h2>Your HYROX pacing &amp; functional baselines.</h2>
        <div class="ob-fields">
          <label class="ob-field"><span>Current run pace (1k repeats)</span><input type="text" data-ob="runPace" placeholder="4:45 min/km" value="${esc(s.runPace)}"></label>
          <label class="ob-field"><span>Sled push / pull comfort</span><input type="text" data-ob="sled" placeholder="e.g. 125 kg push, steady" value="${esc(s.sled)}"></label>
          <label class="ob-field"><span>Wall ball threshold (unbroken reps)</span><input type="text" data-ob="wallball" placeholder="e.g. 40 reps @ 6 kg" value="${esc(s.wallball)}"></label>
        </div>`;
    }
    if (key === 'race') {
      return `<h2>When is your primary A-Race?</h2>
        <div class="ob-fields">
          <label class="ob-field"><span>Race date</span><input type="date" data-ob="raceDate" value="${esc(s.raceDate)}"></label>
          <label class="ob-field"><span>Race name</span><input type="text" data-ob="raceName" placeholder="${s.eco === 'hyrox' ? 'HYROX Stockholm' : 'Ironman 70.3 Marbella'}" value="${esc(s.raceName)}"></label>
        </div>
        <div class="ob-chip-row">
          <button type="button" class="ob-chip wide ${s.raceMode === 'finish' ? 'on' : ''}" data-mode="finish">Just finish comfortably</button>
          <button type="button" class="ob-chip wide ${s.raceMode === 'pr' ? 'on' : ''}" data-mode="pr">Execute a PR / time goal</button>
        </div>`;
    }
    if (key === 'baselines') {
      const sp = sportsOf();
      const askRun = sp.includes('Running') && s.eco !== 'hyrox'; // hyrox already asked
      return `<h2>Set your performance baselines.</h2>
        <div class="ob-fields">
          ${sp.includes('Cycling') ? `<label class="ob-field"><span>Cycling FTP (W)</span><input type="number" inputmode="numeric" min="50" max="600" data-ob="ftp" value="${esc(String(s.ftp))}"></label>` : ''}
          ${askRun ? `<label class="ob-field"><span>Run threshold pace</span><input type="text" data-ob="runPace" placeholder="4:30 min/km" value="${esc(s.runPace)}"></label>` : ''}
          ${sp.includes('Swimming') ? `<label class="ob-field"><span>Swim 100m pace</span><input type="text" data-ob="swimPace" placeholder="1:45 / 100m" value="${esc(s.swimPace)}"></label>` : ''}
          <div class="ob-half">
            <label class="ob-field"><span>Resting HR <em>optional</em></span><input type="number" inputmode="numeric" data-ob="rhr" placeholder="—" value="${esc(s.rhr)}"></label>
            <label class="ob-field"><span>Max HR <em>optional</em></span><input type="number" inputmode="numeric" data-ob="maxhr" placeholder="—" value="${esc(s.maxhr)}"></label>
          </div>
        </div>`;
    }
    if (key === 'week') {
      return `<h2>What does your training week look like?</h2>
        <div class="ob-sub">Preferred long-session days</div>
        <div class="ob-chip-row">${dayChips('long', s.longDays)}</div>
        <div class="ob-sub">Absolute rest days</div>
        <div class="ob-chip-row">${dayChips('rest', s.restDays)}</div>
        <div class="ob-sub">Weekly training capacity</div>
        <div class="ob-hours"><b>${s.hours}<small> h / week</small></b>
          <input type="range" min="4" max="20" step="1" value="${s.hours}" data-ob-hours></div>`;
    }
    // 'analysis' — Strava deep-dive
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

  // ---- split builder: presets, then a chip editor (tap a chip, then tap a
  // day to move it; or drag it; or use the arrows). Warnings, never blocks.
  function splitHtml() {
    const sp = s.split;
    const warn = splitWarnings(sp, { trainingDays: 7 - s.restDays.length });
    const sel = picked && sp.days[picked.day]?.groups[picked.idx];
    const day = (x, i) => {
      const chips = x.rest ? '<span class="muted small">Rest day</span>' : x.groups.map((g, j) => {
        const on = picked && picked.day === i && picked.idx === j;
        return `<button type="button" class="sp-chip ${on ? 'on' : ''}" data-sp-chip="${i}:${j}" aria-pressed="${on}">${esc(g)}</button>`;
      }).join('');
      const free = SPLIT_GROUPS.filter((g) => !x.groups.includes(g));
      return `<section class="sp-day ${x.rest ? 'is-rest' : ''} ${sel && picked.day !== i && !x.rest ? 'is-target' : ''}" data-sp-day="${i}"
          aria-label="${esc(x.label)}${sel && picked.day !== i && !x.rest ? `: tap to move ${esc(sel)} here` : ''}">
        <div class="sp-day-head">
          <span class="sp-num data-num">${i + 1}</span>
          <input class="sp-label" type="text" maxlength="24" value="${esc(x.label)}" data-sp-label="${i}" aria-label="Name of day ${i + 1}">
          <button type="button" class="icon-btn tiny danger" data-sp-del="${i}" aria-label="Remove ${esc(x.label)}">${svg('close')}</button>
        </div>
        <div class="sp-chips">${chips}
          ${x.rest ? '' : `<label class="sp-add chip gl-chip">${svg('plus')}<select data-sp-add="${i}" aria-label="Add a muscle group to ${esc(x.label)}">
            <option value="" selected>Add</option>${free.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label>`}
        </div>
      </section>`;
    };
    return `<h2>Build your gym split.</h2>
      <div class="ob-sub">Start from a preset, then shape it. Tap a muscle, then tap another day to move it, or drag it.</div>
      <div class="ob-chip-row sp-presets">${SPLIT_PRESETS.map((p) =>
        `<button type="button" class="ob-chip wide ${sp.preset === p.id ? 'on' : ''}" data-sp-preset="${p.id}">${esc(p.name)}</button>`).join('')}</div>
      <div class="sp-days" data-sp-days>${sp.days.map(day).join('')}</div>
      ${sel ? `<div class="sp-tools" role="group" aria-label="${esc(sel)} selected">
          <span class="small"><b>${esc(sel)}</b> selected</span>
          <button type="button" class="btn tiny secondary" data-sp-arrow="-1" aria-label="Move ${esc(sel)} to the day before"><span class="ic-up">${svg('chevron')}</span></button>
          <button type="button" class="btn tiny secondary" data-sp-arrow="1" aria-label="Move ${esc(sel)} to the day after"><span class="ic-down">${svg('chevron')}</span></button>
          <button type="button" class="btn tiny ghost danger" data-sp-remove>Remove</button>
        </div>` : ''}
      <div class="row sp-add-days">
        <button type="button" class="btn tiny secondary" data-sp-add-day ${sp.days.length >= 7 ? 'disabled' : ''}>${svg('plus')} Training day</button>
        <button type="button" class="btn tiny ghost" data-sp-add-rest ${sp.days.length >= 7 ? 'disabled' : ''}>${svg('plus')} Rest day</button>
      </div>
      <div aria-live="polite">${warn.length ? `<ul class="ob-note warn sp-warn">${warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}</div>`;
  }

  function redrawSplit() {
    const card = root.querySelector('.ob-card'); // the scrolling box: keep its place
    if (!card) return;
    const top = card.scrollTop;
    card.innerHTML = splitHtml();
    card.scrollTop = top;
    wireSplit();
  }

  function wireSplit() {
    const sp = s.split;
    const custom = () => { sp.preset = 'custom'; };
    root.querySelectorAll('[data-sp-preset]').forEach((b) => b.addEventListener('click', () => {
      s.split = presetSplit(b.dataset.spPreset); picked = null; redrawSplit();
    }));
    root.querySelectorAll('[data-sp-label]').forEach((el) => {
      el.addEventListener('input', () => { sp.days[+el.dataset.spLabel].label = el.value; custom(); });
      el.addEventListener('change', () => { s.split = normalizeSplit(sp); redrawSplit(); });
    });
    root.querySelectorAll('[data-sp-del]').forEach((b) => b.addEventListener('click', () => {
      sp.days.splice(+b.dataset.spDel, 1); picked = null; custom(); redrawSplit();
    }));
    root.querySelectorAll('[data-sp-add]').forEach((el) => el.addEventListener('change', () => {
      if (!el.value) return;
      sp.days[+el.dataset.spAdd].groups.push(el.value); custom(); redrawSplit();
    }));
    root.querySelector('[data-sp-add-day]')?.addEventListener('click', () => {
      sp.days.push({ label: `Day ${sp.days.length + 1}`, groups: [] }); custom(); redrawSplit();
    });
    root.querySelector('[data-sp-add-rest]')?.addEventListener('click', () => {
      sp.days.push({ label: 'Rest', groups: [], rest: true }); custom(); redrawSplit();
    });
    root.querySelector('[data-sp-remove]')?.addEventListener('click', () => {
      sp.days[picked.day].groups.splice(picked.idx, 1); picked = null; custom(); redrawSplit();
    });
    root.querySelectorAll('[data-sp-arrow]').forEach((b) => b.addEventListener('click', () => {
      const dir = +b.dataset.spArrow;
      let to = picked.day + dir;
      while (sp.days[to]?.rest) to += dir; // skip rest days
      if (!sp.days[to]) return;
      const g = sp.days[picked.day].groups[picked.idx];
      if (moveGroup(sp, picked.day, picked.idx, to)) { picked = { day: to, idx: sp.days[to].groups.indexOf(g) }; custom(); redrawSplit(); }
    }));
    // tap a chip to pick it; tap another day to drop it there; or drag it
    const days = root.querySelector('[data-sp-days]');
    if (!days) return;
    days.addEventListener('click', (e) => {
      if (e.target.closest('input, select, label, [data-sp-del]')) return;
      const chip = e.target.closest('[data-sp-chip]');
      if (chip) {
        const [d, j] = chip.dataset.spChip.split(':').map(Number);
        picked = picked && picked.day === d && picked.idx === j ? null : { day: d, idx: j };
        redrawSplit();
        return;
      }
      const target = e.target.closest('[data-sp-day]');
      if (target && picked && moveGroup(sp, picked.day, picked.idx, +target.dataset.spDay)) {
        picked = null; custom(); redrawSplit();
      }
    });
    days.addEventListener('pointerdown', (e) => {
      const chip = e.target.closest('[data-sp-chip]');
      if (!chip || e.button > 0) return;
      const [d, j] = chip.dataset.spChip.split(':').map(Number);
      const x0 = e.clientX; const y0 = e.clientY;
      let dragging = false;
      let scrollShift = 0; // how far the list scrolled under the dragged chip
      const move = (ev) => {
        const dx = ev.clientX - x0; const dy = ev.clientY - y0;
        if (!dragging && Math.hypot(dx, dy) < 8) return;
        dragging = true;
        chip.classList.add('is-dragging');
        // near the top or bottom edge, scroll the list so far-away days can be reached
        const card = root.querySelector('.ob-card');
        const box = card?.getBoundingClientRect();
        let scrolled = 0;
        if (box && ev.clientY > box.bottom - 48) scrolled = 12;
        else if (box && ev.clientY < box.top + 48) scrolled = -12;
        if (scrolled) { const t0 = card.scrollTop; card.scrollTop += scrolled; scrollShift += card.scrollTop - t0; }
        chip.style.transform = `translate(${Math.round(dx / 2) * 2}px, ${Math.round((dy + scrollShift) / 2) * 2}px)`;
      };
      const up = (ev) => {
        chip.removeEventListener('pointermove', move);
        chip.removeEventListener('pointerup', up);
        chip.removeEventListener('pointercancel', up);
        if (!dragging) return; // a plain tap: the click handler picks it
        chip.style.visibility = 'hidden'; // look past the dragged chip to the day under the finger
        const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-sp-day]');
        chip.style.visibility = '';
        chip.style.transform = '';
        chip.classList.remove('is-dragging');
        const swallow = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
        days.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => days.removeEventListener('click', swallow, { capture: true }), 0);
        if (over && moveGroup(sp, d, j, +over.dataset.spDay)) { picked = null; custom(); redrawSplit(); }
      };
      chip.setPointerCapture?.(e.pointerId);
      chip.addEventListener('pointermove', move);
      chip.addEventListener('pointerup', up);
      chip.addEventListener('pointercancel', up);
    });
  }

  const draw = (dir = 1) => {
    const keys = stepKeys();
    idx = Math.min(idx, keys.length - 1);
    const key = keys[idx];
    const last = idx === keys.length - 1;
    const pct = Math.round(((idx + 1) / keys.length) * 100);
    root.innerHTML = `
    <div class="ob-screen" role="dialog" aria-modal="true" aria-label="AI coach setup">
      <div class="ob-progress"><i style="width:${pct}%"></i></div>
      <div class="ob-head">
        <button class="fh-back" data-ob-back aria-label="Back">${svg('back')}</button>
        <small>AI Coach · ${last ? 'Strava analysis' : `Step ${idx + 1} of ${keys.length - 1}`}</small>
      </div>
      <div class="ob-card ${dir >= 0 ? 'ob-in-right' : 'ob-in-left'}">${stepHtml(key)}</div>
      <footer class="ob-foot">
        <button class="btn primary block" data-ob-next>${last ? 'Generate Tailored Plan' : 'Continue'}</button>
      </footer>
    </div>`;
    wire(key);
  };

  const generating = () => {
    root.innerHTML = `
    <div class="ob-screen ob-gen" role="dialog" aria-modal="true" aria-label="Generating plan">
      <div class="ob-gen-orb"></div>
      <h2 id="ob-phase">${GEN_PHASES[0]}</h2>
      <p class="ob-sub" style="text-align:center">This takes a few seconds — your plan is being tailored.</p>
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
    const eco = ECOS.find((e) => e.id === s.eco) || ECOS[0];
    const athlete = ATHLETES.find((a) => a.id === s.athlete);
    const goal = s.eco === 'endurance' ? (GOALS_BY[s.athlete] || GOALS_BY.tri).find((g) => g.id === s.goal) : null;
    const gymGoal = GYM_GOALS.find((g) => g.id === s.gymGoal);
    const gap = hist.weeklyHours > 0 && s.hours > hist.weeklyHours * 1.15;
    try {
      const events = (s.raceDate && s.eco !== 'gym')
        ? [{ title: s.raceName || goal?.name || eco.name, date: s.raceDate }] : [];
      if (events.length) store.setSetting('events', events);
      store.setSetting('ftp', s.ftp);
      if (gymInPlay()) store.setSetting('gymSplit', normalizeSplit(s.split));

      const r = await generateAIWorkoutPlan({
        sports: sportsOf(),
        ecosystem: eco.name,
        athlete_type: athlete?.name || eco.name,
        goal_distance: s.eco === 'endurance' ? (goal?.name || 'Triathlon')
          : s.eco === 'hyrox' ? 'HYROX race'
          : s.eco === 'gym' ? (gymGoal?.name || 'Strength') : 'Hybrid athlete',
        gym_goal: gymGoal?.name || null,
        gym_split: gymInPlay() ? normalizeSplit(s.split) : null,
        hyrox_baselines: s.eco === 'hyrox'
          ? { run_pace: s.runPace, sled_push_pull: s.sled, wall_ball_threshold: s.wallball } : null,
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

      // The sessions are written server-side, so pull them in before revealing
      // the calendar — otherwise they only land whenever realtime gets around
      // to it, and the athlete sees an empty week.
      await store.refresh().catch(() => store.commit());

      stopCycle();
      store.setSetting('goals', { ...(store.getSettings().goals || {}), hours: s.hours, sessions: 7 - s.restDays.length });
      close();
      toast(`AI Coach added ${r.inserted} tailored sessions to your calendar`, { icon: svg('spark') });
      if (onDone) onDone();
    } catch (err) {
      stopCycle();
      idx = stepKeys().length - 1;
      draw(-1);
      const msgEl = document.createElement('p');
      msgEl.className = 'ob-note warn';
      msgEl.textContent = err.message || 'Plan generation failed — try again.';
      root.querySelector('.ob-card')?.appendChild(msgEl);
    }
  };

  function wire(key) {
    if (key === 'split') wireSplit();
    root.querySelector('[data-ob-back]').addEventListener('click', () => {
      if (idx === 0) { close(); return; }
      idx -= 1; draw(-1);
    });
    root.querySelector('[data-ob-next]').addEventListener('click', () => {
      if (key === 'eco' && !s.eco) { toast('Pick your training ecosystem first'); return; }
      if (key === 'athlete' && !s.athlete) { toast('Pick your discipline first'); return; }
      if (key === 'goal' && !s.goal) { toast('Pick your distance goal first'); return; }
      if (key === 'hybrid' && !s.hybridSports.length) { toast('Pick at least one discipline'); return; }
      if (key === 'gymgoal' && !s.gymGoal) { toast('Pick your weight room goal first'); return; }
      if (idx === stepKeys().length - 1) { generate(); return; }
      idx += 1; draw(1);
    });

    const single = (attr, field, alsoReset) => root.querySelectorAll(`[data-${attr}]`).forEach((b) =>
      b.addEventListener('click', () => {
        if (alsoReset && s[field] !== b.dataset[attr]) alsoReset();
        s[field] = b.dataset[attr];
        root.querySelectorAll(`[data-${attr}]`).forEach((x) => x.classList.toggle('on', x === b));
      }));
    single('eco', 'eco', () => { s.athlete = null; s.goal = null; s.hybridSports = []; s.gymGoal = null; });
    single('athlete', 'athlete', () => { s.goal = null; });
    single('goal', 'goal');
    single('gymgoal', 'gymGoal');
    single('mode', 'raceMode');

    root.querySelectorAll('[data-hyb]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.hyb;
      s.hybridSports = s.hybridSports.includes(v)
        ? s.hybridSports.filter((x) => x !== v) : [...s.hybridSports, v];
      b.classList.toggle('on');
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
