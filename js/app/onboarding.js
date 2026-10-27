// onboarding.js — the premium AI coaching questionnaire. One question per
// screen, thin gradient progress line, sliding transitions, and a Strava
// history deep-dive before the plan is generated. The step pipeline is
// DYNAMIC: it branches per training ecosystem (Endurance / HYROX / Hybrid /
// Gym) so every archetype gets a tailored interview.

import * as store from './store.js';
import { generateAIWorkoutPlan, stravaSummary } from './ai.js';
import { toast } from './effects.js';
import { svg } from '../core/icons.js';
import { esc, mondayOf } from './ui.js';
import { addDays, todayISO } from '../core/dates.js';
import { SPLIT_PRESETS, SPLIT_GROUPS, presetSplit, normalizeSplit, splitWarnings, moveGroup } from '../core/gym-split.js';
import { openLayer, closeLayer } from './nav.js';
import { t, tList, fmtNum, getLang } from '../core/i18n.js';
import { muscleLabel } from '../core/exercises.js';

// ---- static choice matrices --------------------------------------------------
// i18n-ignore-start (English on purpose: the AI reads these names)

const ECOS = [
  { id: 'endurance', name: 'Endurance / Triathlon', sub: 'Swim, bike & run progression' },
  { id: 'hyrox', name: 'HYROX', sub: 'Functional hybrid power + aerobic pacing' },
  { id: 'hybrid', name: 'Hybrid Athlete', sub: 'Weight-room strength + cardio disciplines' },
  { id: 'gym', name: 'Only Gym / Strength', sub: 'Weight training, splits & conditioning' },
];

const ATHLETES = [
  { id: 'tri', name: 'Triathlete', sub: 'Swim · bike · run', sports: ['Swimming', 'Cycling', 'Running', 'Gym'] },
  // a runner gets runs only (pick Hybrid for running plus the gym)
  { id: 'run', name: 'Runner', sub: '5k to ultra-marathon', sports: ['Running'] },
  { id: 'bike', name: 'Cyclist', sub: 'Road, gravel & endurance', sports: ['Cycling'] },
  { id: 'swim', name: 'Swimmer', sub: 'Pool & open water', sports: ['Swimming'] },
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
    { id: 'ftp', name: 'FTP Builder', sub: 'No race, raise raw power' },
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

// i18n-ignore-end
// The names above stay English: they're what the AI reads. On screen every
// choice shows through ob.<group>.<id> in the active language.
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // sent to the AI
const GEN_PHASES = () => tList('ob.gen');

// Average weekly volume from the last 4 weeks of completed (Strava-verified) work.
function analyzeHistory(workouts) {
  const today = todayISO();
  const start = addDays(today, -27);
  const done = workouts.filter((w) => w.completed && w.date >= start && w.date <= today);
  const minOf = (type) => done.filter((w) => !type || w.type === type).reduce((a, w) => a + (w.durationMin || 0), 0);
  const kmOf = (type) => done.filter((w) => w.type === type)
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
    if (s.eco === 'hyrox') return ['Running', 'Gym']; // HYROX is running plus functional stations
    if (s.eco === 'hybrid') {
      const picked = s.hybridSports.map((x) => HYBRID_MAP[x]).filter(Boolean);
      return picked.length ? picked : ['Gym', 'Running'];
    }
    return (ATHLETES.find((a) => a.id === s.athlete)?.sports) || ATHLETES[0].sports;
  };

  const close = () => closeLayer(root);

  const choiceGrid = (items, attr, current, group = attr) => `<div class="ob-grid">${items.map((it) => `
    <button type="button" class="ob-choice ${current === it.id ? 'on' : ''}" data-${attr}="${it.id}">
      <b>${esc(t(`ob.${group}.${it.id}.name`))}</b><small>${esc(t(`ob.${group}.${it.id}.sub`))}</small>
    </button>`).join('')}</div>`;

  const dayChips = (attr, selected) => tList('date.daysShort').map((L, i) =>
    `<button type="button" class="ob-chip ${selected.includes(i) ? 'on' : ''}" data-${attr}="${i}">${L}</button>`).join('');

  const stepHtml = (key) => {
    if (key === 'eco') {
      return `<h2>${t('ob.qEco')}</h2>${choiceGrid(ECOS, 'eco', s.eco)}`;
    }
    if (key === 'athlete') {
      return `<h2>${t('ob.qAthlete')}</h2>${choiceGrid(ATHLETES, 'athlete', s.athlete)}`;
    }
    if (key === 'goal') {
      return `<h2>${t('ob.qGoal')}</h2>${choiceGrid(GOALS_BY[s.athlete] || GOALS_BY.tri, 'goal', s.goal)}`;
    }
    if (key === 'hybrid') {
      return `<h2>${t('ob.qHybrid')}</h2>
        <div class="ob-sub">${t('ob.hybridSub')}</div>
        <div class="ob-chip-row">${HYBRID_SPORTS.map((sp) =>
          `<button type="button" class="ob-chip wide ${s.hybridSports.includes(sp) ? 'on' : ''}" data-hyb="${esc(sp)}">${esc(t(`ob.hyb.${sp}`))}</button>`).join('')}</div>`;
    }
    if (key === 'gymgoal') {
      return `<h2>${t('ob.qGymGoal')}</h2>${choiceGrid(GYM_GOALS, 'gymgoal', s.gymGoal)}`;
    }
    if (key === 'split') return splitHtml();
    if (key === 'hyrox') {
      return `<h2>${esc(t('ob.qHyrox'))}</h2>
        <div class="ob-fields">
          <label class="ob-field"><span>${t('ob.runPace1k')}</span><input type="text" data-ob="runPace" placeholder="${t('ob.runPacePh')}" value="${esc(s.runPace)}"></label>
          <label class="ob-field"><span>${t('ob.sled')}</span><input type="text" data-ob="sled" placeholder="${t('ob.sledPh')}" value="${esc(s.sled)}"></label>
          <label class="ob-field"><span>${t('ob.wallball')}</span><input type="text" data-ob="wallball" placeholder="${t('ob.wallballPh')}" value="${esc(s.wallball)}"></label>
        </div>`;
    }
    if (key === 'race') {
      return `<h2>${t('ob.qRace')}</h2>
        <div class="ob-fields">
          <label class="ob-field"><span>${t('ob.raceDate')}</span><input type="date" data-ob="raceDate" value="${esc(s.raceDate)}"></label>
          <label class="ob-field"><span>${t('ob.raceName')}</span><input type="text" data-ob="raceName" placeholder="${s.eco === 'hyrox' ? t('ob.raceNamePhHyrox') : t('ob.raceNamePh')}" value="${esc(s.raceName)}"></label>
        </div>
        <div class="ob-chip-row">
          <button type="button" class="ob-chip wide ${s.raceMode === 'finish' ? 'on' : ''}" data-mode="finish">${t('ob.finish')}</button>
          <button type="button" class="ob-chip wide ${s.raceMode === 'pr' ? 'on' : ''}" data-mode="pr">${t('ob.pr')}</button>
        </div>`;
    }
    if (key === 'baselines') {
      const sp = sportsOf();
      const askRun = sp.includes('Running') && s.eco !== 'hyrox'; // hyrox already asked
      return `<h2>${t('ob.qBaselines')}</h2>
        <div class="ob-fields">
          ${sp.includes('Cycling') ? `<label class="ob-field"><span>${t('ob.ftp')}</span><input type="number" inputmode="numeric" min="50" max="600" data-ob="ftp" value="${esc(String(s.ftp))}"></label>` : ''}
          ${askRun ? `<label class="ob-field"><span>${t('ob.runThreshold')}</span><input type="text" data-ob="runPace" placeholder="${t('ob.runThresholdPh')}" value="${esc(s.runPace)}"></label>` : ''}
          ${sp.includes('Swimming') ? `<label class="ob-field"><span>${t('ob.swimPace')}</span><input type="text" data-ob="swimPace" placeholder="${t('ob.swimPacePh')}" value="${esc(s.swimPace)}"></label>` : ''}
          <div class="ob-half">
            <label class="ob-field"><span>${t('ob.rhr')} <em>${t('ob.optional')}</em></span><input type="number" inputmode="numeric" data-ob="rhr" placeholder="—" value="${esc(s.rhr)}"></label>
            <label class="ob-field"><span>${t('ob.maxhr')} <em>${t('ob.optional')}</em></span><input type="number" inputmode="numeric" data-ob="maxhr" placeholder="—" value="${esc(s.maxhr)}"></label>
          </div>
        </div>`;
    }
    if (key === 'week') {
      return `<h2>${t('ob.qWeek')}</h2>
        <div class="ob-sub">${t('ob.longDays')}</div>
        <div class="ob-chip-row">${dayChips('long', s.longDays)}</div>
        <div class="ob-sub">${t('ob.restDays')}</div>
        <div class="ob-chip-row">${dayChips('rest', s.restDays)}</div>
        <div class="ob-sub">${t('ob.capacity')}</div>
        <div class="ob-hours"><b>${s.hours}<small>${t('ob.perWeek')}</small></b>
          <input type="range" min="4" max="20" step="1" value="${s.hours}" data-ob-hours></div>`;
    }
    // 'analysis' — Strava deep-dive
    const gap = hist.weeklyHours > 0 && s.hours > hist.weeklyHours * 1.15;
    const row = (k, v) => `<div class="ob-hist-row"><span>${k}</span><b>${v}</b></div>`;
    return `<h2>${t('ob.qAnalysis')}</h2>
      <div class="ob-hist">
        ${row(t('ob.hSessions'), hist.sessions)}
        ${row(t('ob.hVolume'), `${fmtNum(hist.weeklyHours)} h`)}
        ${row(t('ob.hBike'), `${fmtNum(hist.weeklyBikeHours)} h`)}
        ${row(t('ob.hRun'), `${fmtNum(hist.weeklyRunKm)} km`)}
        ${row(t('ob.hSwim'), `${fmtNum(hist.weeklySwimKm)} km`)}
        ${row(t('ob.hVerified'), hist.stravaCount)}
      </div>
      ${gap
        ? `<p class="ob-note warn">${t('ob.gap', { target: s.hours, recent: fmtNum(hist.weeklyHours) })}</p>`
        : hist.weeklyHours > 0
          ? `<p class="ob-note ok">${t('ob.match', { target: s.hours })}</p>`
          : `<p class="ob-note">${t('ob.noHistory')}</p>`}`;
  };

  // ---- split builder: presets, then a chip editor (tap a chip, then tap a
  // day to move it; or drag it; or use the arrows). Warnings, never blocks.
  function splitHtml() {
    const sp = s.split;
    const warn = splitWarnings(sp, { trainingDays: 7 - s.restDays.length });
    const sel = picked && sp.days[picked.day]?.groups[picked.idx];
    const day = (x, i) => {
      const chips = x.rest ? `<span class="muted small">${t('ob.restDay')}</span>` : x.groups.map((g, j) => {
        const on = picked && picked.day === i && picked.idx === j;
        return `<button type="button" class="sp-chip ${on ? 'on' : ''}" data-sp-chip="${i}:${j}" aria-pressed="${on}">${esc(muscleLabel(g))}</button>`;
      }).join('');
      const free = SPLIT_GROUPS.filter((g) => !x.groups.includes(g));
      return `<section class="sp-day ${x.rest ? 'is-rest' : ''} ${sel && picked.day !== i && !x.rest ? 'is-target' : ''}" data-sp-day="${i}"
          aria-label="${esc(x.label)}${sel && picked.day !== i && !x.rest ? esc(t('ob.moveHere', { group: muscleLabel(sel) })) : ''}">
        <div class="sp-day-head">
          <span class="sp-num data-num">${i + 1}</span>
          <input class="sp-label" type="text" maxlength="24" value="${esc(x.label)}" data-sp-label="${i}" aria-label="${t('ob.dayName', { n: i + 1 })}">
          <button type="button" class="icon-btn tiny danger" data-sp-del="${i}" aria-label="${esc(t('ob.removeDay', { label: x.label }))}">${svg('close')}</button>
        </div>
        <div class="sp-chips">${chips}
          ${x.rest ? '' : `<label class="sp-add chip gl-chip">${svg('plus')}<select data-sp-add="${i}" aria-label="${esc(t('ob.addGroup', { label: x.label }))}">
            <option value="" selected>${t('ob.add')}</option>${free.map((g) => `<option value="${esc(g)}">${esc(muscleLabel(g))}</option>`).join('')}</select></label>`}
        </div>
      </section>`;
    };
    return `<h2>${t('ob.qSplit')}</h2>
      <div class="ob-sub">${t('ob.splitSub')}</div>
      <div class="ob-chip-row sp-presets">${SPLIT_PRESETS.map((p) =>
        `<button type="button" class="ob-chip wide ${sp.preset === p.id ? 'on' : ''}" data-sp-preset="${p.id}">${esc(p.name)}</button>`).join('')}</div>
      <div class="sp-days" data-sp-days>${sp.days.map(day).join('')}</div>
      ${sel ? `<div class="sp-tools" role="group" aria-label="${esc(t('ob.selectedAria', { group: muscleLabel(sel) }))}">
          <span class="small">${t('ob.selected', { group: esc(muscleLabel(sel)) })}</span>
          <button type="button" class="btn tiny secondary" data-sp-arrow="-1" aria-label="${esc(t('ob.moveBefore', { group: muscleLabel(sel) }))}"><span class="ic-up">${svg('chevron')}</span></button>
          <button type="button" class="btn tiny secondary" data-sp-arrow="1" aria-label="${esc(t('ob.moveAfter', { group: muscleLabel(sel) }))}"><span class="ic-down">${svg('chevron')}</span></button>
          <button type="button" class="btn tiny ghost danger" data-sp-remove>${t('ob.remove')}</button>
        </div>` : ''}
      <div class="row sp-add-days">
        <button type="button" class="btn tiny secondary" data-sp-add-day ${sp.days.length >= 7 ? 'disabled' : ''}>${svg('plus')} ${t('ob.trainingDay')}</button>
        <button type="button" class="btn tiny ghost" data-sp-add-rest ${sp.days.length >= 7 ? 'disabled' : ''}>${svg('plus')} ${t('ob.restDayBtn')}</button>
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
      sp.days.push({ label: t('split.dayN', { n: sp.days.length + 1 }), groups: [] }); custom(); redrawSplit();
    });
    root.querySelector('[data-sp-add-rest]')?.addEventListener('click', () => {
      sp.days.push({ label: t('split.rest'), groups: [], rest: true }); custom(); redrawSplit();
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
    <div class="ob-screen" role="dialog" aria-modal="true" aria-label="${t('ob.aria')}">
      <div class="ob-progress"><i style="width:${pct}%"></i></div>
      <div class="ob-head">
        <button class="fh-back" data-ob-back aria-label="${t('ob.back')}">${svg('back')}</button>
        <small>${last ? t('ob.stepAnalysis') : t('ob.step', { n: idx + 1, total: keys.length - 1 })}</small>
      </div>
      <div class="ob-card ${dir >= 0 ? 'ob-in-right' : 'ob-in-left'}">${stepHtml(key)}</div>
      <footer class="ob-foot">
        <button class="btn primary block" data-ob-next>${last ? t('ob.generate') : t('ob.continue')}</button>
      </footer>
    </div>`;
    wire(key);
  };

  const generating = () => {
    root.innerHTML = `
    <div class="ob-screen ob-gen" role="dialog" aria-modal="true" aria-label="${t('ob.genAria')}">
      <div class="ob-gen-orb"></div>
      <h2 id="ob-phase">${GEN_PHASES()[0]}</h2>
      <p class="ob-sub" style="text-align:center">${t('ob.genSub')}</p>
    </div>`;
    let i = 0;
    const cycle = setInterval(() => {
      const el = document.getElementById('ob-phase');
      if (!el) { clearInterval(cycle); return; }
      const phases = GEN_PHASES();
      i = (i + 1) % phases.length;
      el.textContent = phases[i];
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
        ? [{ title: s.raceName || t(goal ? `ob.goal.${goal.id}.name` : `ob.eco.${eco.id}.name`), date: s.raceDate }] : [];
      if (events.length) store.setSetting('events', events);
      store.setSetting('ftp', s.ftp);
      // the rooms of your compound follow the sports you chose (docs/COMPOUND.md)
      store.setSetting('disciplines', sportsOf().map((x) => ({ Swimming: 'pool', Cycling: 'bike', Running: 'run', Gym: 'gym' })[x]).filter(Boolean));
      if (gymInPlay()) store.setSetting('gymSplit', normalizeSplit(s.split));

      // the new plan replaces the old one from this week's Monday on: what is
      // planned and not yet done goes (the server deletes it as it writes the
      // new plan); completed and Strava-verified sessions always stay
      const wipeFrom = mondayOf(todayISO());
      const replaced = store.getWorkouts()
        .filter((w) => w.date >= wipeFrom && !w.completed && !w.strava_activity_id).map((w) => w.id);

      const r = await generateAIWorkoutPlan({
        // titles and notes come back in this language; types, intensities and
        // exercise ids stay English (see supabase/functions/ai-plan)
        lang: getLang(),
        sports: sportsOf(),
        ecosystem: eco.name,
        athlete_type: athlete?.name || eco.name,
        goal_distance: s.eco === 'endurance' ? (goal?.name || 'Triathlon')
          : s.eco === 'hyrox' ? 'HYROX race'
          : s.eco === 'gym' ? (gymGoal?.name || 'Strength') : 'Hybrid athlete', // i18n-ignore (AI payload)
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
      }, stravaSummary(store.getWorkouts()), { wipeFrom });

      // drop the replaced sessions here too (the ids were taken before the new
      // plan existed, so nothing new can be caught), then pull the new plan
      store.deleteWorkouts(replaced);

      // The sessions are written server-side, so pull them in before revealing
      // the calendar — otherwise they only land whenever realtime gets around
      // to it, and the athlete sees an empty week.
      await store.refresh().catch(() => store.commit());

      stopCycle();
      store.setSetting('goals', { ...(store.getSettings().goals || {}), hours: s.hours, sessions: 7 - s.restDays.length });
      close();
      toast(t('ob.added', { n: r.inserted }), { icon: svg('spark') });
      if (onDone) onDone();
    } catch (err) {
      stopCycle();
      idx = stepKeys().length - 1;
      draw(-1);
      const msgEl = document.createElement('p');
      msgEl.className = 'ob-note warn';
      msgEl.textContent = err.message || t('ob.failed');
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
      if (key === 'eco' && !s.eco) { toast(t('ob.pickEco')); return; }
      if (key === 'athlete' && !s.athlete) { toast(t('ob.pickAthlete')); return; }
      if (key === 'goal' && !s.goal) { toast(t('ob.pickGoal')); return; }
      if (key === 'hybrid' && !s.hybridSports.length) { toast(t('ob.pickHybrid')); return; }
      if (key === 'gymgoal' && !s.gymGoal) { toast(t('ob.pickGymGoal')); return; }
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
      root.querySelector('.ob-hours b').innerHTML = `${s.hours}<small>${t('ob.perWeek')}</small>`;
    });
  }

  draw(1);
}
