// gym-logger.js — the set-by-set gym logger inside the workout sheet.
//
// Layout, top to bottom: a session bar that sticks to the top of the sheet
// (elapsed clock, the rest timer when it runs, Finish), then one block per
// exercise: art, name, muscle, a rest chip, a note chip, collapsed cues, and
// the set grid (SET / LAST / KG / REPS / tick; timed exercises get a TIME
// column with a count-up stopwatch instead). Below ~330px of width the LAST
// column folds into a line under each set.
//
// The rules (labels, previous sets, timers, what Finish writes) live in
// js/core/gym-log.js. This file only draws and wires them. Timers are stored
// as timestamps in localStorage, so they survive a reload or a locked phone.

import { esc, dialogue } from './ui.js';
import { svg } from '../core/icons.js';
import { exerciseArtSrc, cuesForId, exerciseById } from '../core/exercises.js';
import { cuesFor, poseSvgFor } from '../core/poses.js';
import { openPicker, openNameSheet } from './gym-picker.js';
import { enableDragSort } from './drag-sort.js';
import {
  exerciseFromEntry, replaceExercise, moveItem, linkWithNext, unlinkSuperset, cleanSupersets,
  supersetInfo, restAfterTick, routineFromWorkout, saveRoutine,
} from '../core/gym-edit.js';
import {
  setLabels, previousSets, previousFor, formatSet, fillFrom, addSet, removeSet, tickSet, markStarted,
  sessionSummary, fmtClock, restLabel, REST_PRESETS, SET_KIND_LABELS, startRest, restRemaining, extendRest,
  startStopwatch, stopwatchElapsed, finishPatch,
} from '../core/gym-log.js';

const REST_KEY = 'moske-rest';
const SW_KEY = 'moske-stopwatch';
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const writeJSON = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* private mode: timers just don't survive a reload */ } };

export const getRest = () => readJSON(REST_KEY);
const getStopwatch = () => readJSON(SW_KEY);

// note fields opened this session (a note with text is always open)
const openNotes = new Set();

/** Does this workout get the logger? Gym sessions, and any session with exercises. */
export const hasLogger = (w) => !!w && (w.type === 'gym' || (Array.isArray(w.exercises) && w.exercises.length > 0));

// ---- render -----------------------------------------------------------------------------

/** The sticky session bar. Re-drawn on its own every second by the ticker. */
export function sessionBar(w, now = Date.now()) {
  const sum = sessionSummary(w, now);
  const rest = getRest();
  const left = rest && rest.workoutId === w.id ? restRemaining(rest, now) : 0;
  const logged = w.gymLoggedAt
    ? `<span class="tag gl-logged">${svg('check')} Logged</span>` : '';
  const restRow = left > 0 ? `
    <div class="gl-rest" role="timer" aria-label="Rest ${fmtClock(left)} left">
      <span class="gl-k">Rest</span>
      <b class="data-num gl-rest-left">${fmtClock(left)}</b>
      <span class="gl-rest-bar" aria-hidden="true">${restSegments(left, rest.totalSec)}</span>
      <span class="gl-rest-btns">
        <button class="btn tiny secondary" data-action="gym-rest-adjust" data-by="-15" data-id="${esc(w.id)}" aria-label="15 seconds less">${svg('minus')}15</button>
        <button class="btn tiny secondary" data-action="gym-rest-adjust" data-by="15" data-id="${esc(w.id)}" aria-label="15 seconds more">${svg('plus')}15</button>
        <button class="btn tiny ghost" data-action="gym-rest-skip" data-id="${esc(w.id)}">Skip</button>
      </span>
    </div>` : '';
  return `
    <div class="gl-bar-row">
      <div class="gl-clock">
        <span class="gl-k">Time</span>
        <b class="data-num" data-gl-elapsed>${sum.durationSec != null ? fmtClock(sum.durationSec) : '0:00'}</b>
        ${sum.durationSec == null ? '<small class="muted">starts on your first set</small>' : logged}
      </div>
      <button class="btn primary tiny gl-finish" data-action="gym-finish" data-id="${esc(w.id)}">${w.gymLoggedAt ? 'Save' : 'Finish'}</button>
    </div>${restRow}`;
}

function restSegments(left, total) {
  const n = 10;
  const on = Math.max(0, Math.min(n, Math.ceil((left / Math.max(1, total)) * n)));
  return Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('');
}

/** The whole logger for a workout. */
export function renderLogger(w, workouts) {
  if (!Array.isArray(w.exercises)) w.exercises = [];
  const ss = supersetInfo(w.exercises);
  const blocks = w.exercises.map((ex, i) => exerciseBlock(w, ex, i, workouts, ss[i])).join('');
  const ids = `data-id="${esc(w.id)}"`;
  return `<div class="gl-bar" data-gl-bar data-id="${esc(w.id)}">${sessionBar(w)}</div><!--gl-split-->
    <div class="block gl"><h4>Exercises</h4>
      ${blocks ? `<div class="gl-list" data-gl-list ${ids}>${blocks}</div>` : '<p class="muted gl-empty">No exercises yet. Add some, or start from a routine in Settings.</p>'}
      <button class="btn secondary block" data-action="gym-add-ex" ${ids}>${svg('plus')} Add exercises</button>
      ${blocks ? `<button class="btn ghost block" data-action="gym-save-routine" ${ids}>${svg('copy')} Save as routine</button>` : ''}
    </div>`;
}

function exerciseMenu(w, ex, i, ss) {
  const n = w.exercises.length;
  const items = [
    ['up', 'Move up', i > 0],
    ['down', 'Move down', i < n - 1],
    ['link', ss && !ss.last ? '' : 'Superset with next', i < n - 1 && !(ss && !ss.last)],
    ['unlink', 'Remove from superset', !!ss],
    ['replace', 'Replace exercise', true],
    ['remove', 'Remove exercise', true],
  ].filter(([, t, ok]) => t && ok);
  return `<label class="icon-btn tiny gl-more" title="More">${svg('more')}
    <select data-action="gym-ex-menu" data-id="${esc(w.id)}" data-ex="${i}" aria-label="${esc(`${ex.name}: more`)}">
      <option value="" selected disabled hidden>More</option>
      ${items.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
    </select></label>`;
}

function exerciseBlock(w, ex, i, workouts, ss) {
  const lib = exerciseById(ex.libId);
  const art = exerciseArtSrc(ex.libId);
  const pic = ex.imageUrl
    ? `<img src="${esc(ex.imageUrl)}" alt="" width="64" height="64" loading="lazy" onerror="this.style.display='none'">`
    : art ? `<img src="${esc(art)}" alt="" width="64" height="64" loading="lazy" decoding="async">` : poseSvgFor(ex.name);
  const sub = [ex.muscle || lib?.muscle, ex.equipment || lib?.equipment].filter(Boolean).join(' · ');
  const cues = cuesForId(ex.libId) || cuesFor(ex.name);
  const noteOpen = !!ex.note || openNotes.has(`${w.id}:${i}`);
  const prev = previousSets(workouts, ex, { beforeDate: w.date, excludeId: w.id });
  const timed = ex.kind === 'time' || ex.kind === 'distance';
  const labels = setLabels(ex.sets);
  const sw = getStopwatch();
  const rows = ex.sets.map((s, j) => setRow(w, ex, i, s, j, labels[j], previousFor(prev, ex.sets, j), timed, sw)).join('');
  const ids = `data-id="${esc(w.id)}" data-ex="${i}"`;
  const head = timed
    ? `<span>Set</span><span class="gl-col-prev">Last</span><span>Time</span><span aria-label="Done">${svg('check')}</span>`
    : `<span>Set</span><span class="gl-col-prev">Last</span><span>${ex.kind === 'bodyweight' ? '+Kg' : 'Kg'}</span><span>Reps</span><span aria-label="Done">${svg('check')}</span>`;
  return `
    <section class="gl-ex ${ss ? `in-ss${ss.first ? ' ss-first' : ''}${ss.last ? ' ss-last' : ''}` : ''}" data-gl-item aria-label="${esc(ss ? `Superset ${ss.letter}: ${ex.name}` : ex.name)}">
      ${ss?.first ? `<span class="tag gl-ss-tag">Superset ${ss.letter}</span>` : ''}
      <header class="gl-ex-head">
        <div class="ex-img ${art && !ex.imageUrl ? 'ex-art' : ''}">${pic}</div>
        <div class="gl-ex-title">
          <h5>${esc(ex.name)}</h5>
          ${sub ? `<span class="muted small">${esc(sub)}</span>` : ''}
        </div>
        <span class="gl-ex-tools">
          <button type="button" class="icon-btn tiny gl-grip" data-gl-grip aria-label="${esc(`Drag to reorder ${ex.name}`)}" title="Drag to reorder">${svg('grip')}</button>
          ${exerciseMenu(w, ex, i, ss)}
        </span>
      </header>
      <div class="gl-chips">
        <label class="chip gl-chip">${svg('clock')}<select data-action="gym-rest" ${ids} aria-label="Rest between sets">
          ${[...new Set([...REST_PRESETS, ex.restSec || 0])].sort((a, b) => a - b)
    .map((sec) => `<option value="${sec}" ${sec === (ex.restSec || 0) ? 'selected' : ''}>${restLabel(sec)}</option>`).join('')}
        </select></label>
        <button class="chip gl-chip" data-action="gym-note-toggle" ${ids} aria-expanded="${noteOpen}">${svg('edit')}Note</button>
      </div>
      ${noteOpen ? `<textarea class="gl-note" rows="2" data-action="gym-note" ${ids} placeholder="A note for this exercise" aria-label="Note for ${esc(ex.name)}">${esc(ex.note || '')}</textarea>` : ''}
      ${cues?.length ? `<details class="gl-cues"><summary>How to</summary><ul class="cues">${cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
      <div class="gl-grid ${timed ? 'is-timed' : ''}">
        <div class="gl-row gl-head" aria-hidden="true">${head}</div>
        ${rows}
      </div>
      <button class="btn secondary gl-add" data-action="gym-add-set" ${ids}>${svg('plus')} Add set</button>
    </section>`;
}

function setRow(w, ex, i, s, j, label, prevSet, timed, sw) {
  const ids = `data-id="${esc(w.id)}" data-ex="${i}" data-set="${j}"`;
  const name = `${label === 'W' ? 'Warm-up' : SET_KIND_LABELS[s.kind]} set ${label}`;
  const prevText = formatSet(prevSet, ex.kind);
  const prevBtn = (cls) => (prevText
    ? `<button class="gl-prev ${cls}" data-action="gym-fill-prev" ${ids} aria-label="Use last time: ${esc(prevText)}">${cls === 'gl-prev-sub' ? 'Last ' : ''}${esc(prevText)}</button>`
    : `<span class="gl-prev ${cls} muted" aria-hidden="true">${cls === 'gl-prev-sub' ? '' : '–'}</span>`);
  const num = (field, mode, value, aria) => `<input class="gl-in data-num" type="text" inputmode="${mode}" autocomplete="off"
      value="${value == null ? '' : esc(String(value))}" placeholder="${esc(prevSet?.[field] != null ? String(prevSet[field]) : '–')}"
      data-action="gym-field" data-field="${field}" ${ids} aria-label="${esc(`${name} ${aria}`)}">`;
  const kindSel = `<label class="gl-set k-${s.kind}">
      <span aria-hidden="true">${label}</span>
      <select data-action="gym-set-kind" ${ids} aria-label="${esc(`${name}. Change type or remove`)}">
        ${Object.entries(SET_KIND_LABELS).map(([k, t]) => `<option value="${k}" ${k === s.kind ? 'selected' : ''}>${t}</option>`).join('')}
        <option value="remove" ${ex.sets.length <= 1 ? 'disabled' : ''}>Remove set</option>
      </select>
    </label>`;
  let cells;
  if (timed) {
    const running = sw && sw.workoutId === w.id && sw.ex === i && sw.set === j;
    cells = `<span class="gl-time">
        <button class="icon-btn tiny gl-sw" data-action="gym-stopwatch" ${ids} aria-label="${running ? 'Stop' : 'Start'} the clock for ${esc(name)}">${svg(running ? 'stop' : 'play')}</button>
        ${running
    ? `<b class="gl-in gl-sw-live data-num" data-gl-sw="${esc(`${w.id}:${i}:${j}`)}" role="timer">${fmtClock(stopwatchElapsed(sw, Date.now()))}</b>`
    : num('seconds', 'numeric', s.seconds, 'seconds')}
      </span>`;
  } else {
    cells = `${num('weight', 'decimal', s.weight, ex.kind === 'bodyweight' ? 'added kilos' : 'kilos')}${num('reps', 'numeric', s.reps, 'reps')}`;
  }
  return `<div class="gl-row ${s.done ? 'done' : ''}">
      ${kindSel}
      ${prevBtn('gl-col-prev')}
      ${cells}
      <button class="gl-tick" data-action="gym-tick" ${ids} aria-pressed="${s.done}" aria-label="${esc(`${name} done`)}">${svg('check')}</button>
      ${prevText ? prevBtn('gl-prev-sub') : ''}
    </div>`;
}

/** Shown in the sheet after Finish. */
export function finishView(w) {
  const sum = sessionSummary(w, Date.parse(w.gymLoggedAt) || Date.now());
  const dur = w.gymDurationSec != null ? w.gymDurationSec : sum.durationSec;
  return `
    <div role="status">${dialogue({ text: 'Logged. Sync with Strava to earn XP.', cls: 'coach-say gl-done' })}</div>
    <div class="gl-sum">
      <div class="gl-sum-cell"><span class="gl-k">Time</span><b class="data-num">${dur != null ? fmtClock(dur) : '–'}</b></div>
      <div class="gl-sum-cell"><span class="gl-k">Sets</span><b class="data-num">${sum.sets}</b></div>
      <div class="gl-sum-cell"><span class="gl-k">Volume</span><b class="data-num">${sum.volumeKg.toLocaleString()}<span class="data-unit"> kg</span></b></div>
    </div>
    <button class="btn primary" data-action="gym-done" data-id="${esc(w.id)}">Done</button>
    <button class="btn ghost" data-action="gym-back" data-id="${esc(w.id)}">Back to the log</button>`;
}

// ---- actions ------------------------------------------------------------------------------

/**
 * Handle a logger action. `deps` = { store, refresh(id), close(), toast, onRestDone }.
 * Returns true when the action was the logger's.
 */
export function handleGymAction(action, el, deps, kind) {
  if (!action || !action.startsWith('gym-')) return false;
  const { store, refresh } = deps;
  const id = el.dataset.id;
  const w = store.workoutById(id);
  if (!w) return true;
  const i = +el.dataset.ex; const j = +el.dataset.set;
  const ex = w.exercises?.[i];
  const now = Date.now();
  const save = () => store.touchWorkout(id);

  // text fields save silently on input (no redraw, so focus and caret stay)
  if (kind === 'input') {
    if (action === 'gym-field' && ex?.sets[j]) {
      const v = el.value.trim().replace(',', '.');
      const n = v === '' ? null : Number(v);
      ex.sets[j][el.dataset.field] = n == null || !Number.isFinite(n) || n < 0 ? null : n;
      save();
    } else if (action === 'gym-note' && ex) {
      ex.note = el.value;
      save();
    }
    return true;
  }

  if (kind === 'change') {
    if (action === 'gym-rest' && ex) {
      ex.restSec = Math.max(0, Math.round(+el.value) || 0);
      save();
    } else if (action === 'gym-ex-menu' && ex) {
      const pick = el.value;
      el.value = '';
      exerciseMenuAction(pick, w, i, deps);
    } else if (action === 'gym-set-kind' && ex?.sets[j]) {
      if (el.value === 'remove') removeSet(ex, j);
      else ex.sets[j].kind = el.value;
      save(); refresh(id);
    }
    return true;
  }

  switch (action) {
    case 'gym-tick': {
      const s = ex?.sets[j];
      if (!s) break;
      if (s.done) {
        tickSet(ex, j, false, now);
      } else {
        const prev = previousFor(previousSets(store.getWorkouts(), ex, { beforeDate: w.date, excludeId: w.id }), ex.sets, j);
        tickSet(ex, j, true, now, prev);
        markStarted(w, now);
        // inside a superset you go straight to the next exercise; rest after the last
        const rest = startRest(w.id, restAfterTick(w.exercises, i), now);
        if (rest) writeJSON(REST_KEY, rest);
      }
      save(); refresh(id);
      break;
    }
    case 'gym-add-ex':
      openPicker({
        onPick: (entries) => {
          if (!entries.length) return;
          const at = w.exercises.length;
          entries.forEach((en) => w.exercises.push(exerciseFromEntry(en, Date.now())));
          save(); refresh(id);
          document.querySelectorAll('[data-gl-item]')[at]?.scrollIntoView({ block: 'start' });
        },
      });
      break;
    case 'gym-save-routine':
      openNameSheet({
        title: 'Save as routine', label: 'Routine name', value: w.title || '', submit: 'Save routine',
        onSave: (name) => {
          const settings = store.getSettings();
          store.setSetting('routines', saveRoutine(settings.routines, routineFromWorkout(w, name, Date.now())));
          deps.toast(`Saved “${name}”. Start it from Settings or the + button.`, 'check');
        },
      });
      break;
    case 'gym-fill-prev': {
      const prev = previousFor(previousSets(store.getWorkouts(), ex, { beforeDate: w.date, excludeId: w.id }), ex.sets, j);
      if (prev && ex.sets[j]) { fillFrom(ex.sets[j], prev); save(); refresh(id); }
      break;
    }
    case 'gym-add-set':
      if (ex) { addSet(ex); save(); refresh(id); }
      break;
    case 'gym-note-toggle': {
      const key = `${id}:${i}`;
      if (openNotes.has(key) && !ex?.note) openNotes.delete(key); else openNotes.add(key);
      refresh(id);
      if (openNotes.has(key)) document.querySelector(`.gl-note[data-ex="${i}"]`)?.focus();
      break;
    }
    case 'gym-stopwatch': {
      const sw = getStopwatch();
      const running = sw && sw.workoutId === id && sw.ex === i && sw.set === j;
      if (running) {
        ex.sets[j].seconds = stopwatchElapsed(sw, now);
        tickSet(ex, j, true, now);
        markStarted(w, now);
        writeJSON(SW_KEY, null);
        const rest = startRest(w.id, restAfterTick(w.exercises, i), now);
        if (rest) writeJSON(REST_KEY, rest);
        save();
      } else {
        writeJSON(SW_KEY, startStopwatch(id, i, j, now));
        markStarted(w, now); save();
      }
      refresh(id);
      break;
    }
    case 'gym-rest-adjust': {
      const r = getRest();
      if (r) writeJSON(REST_KEY, extendRest(r, +el.dataset.by, now));
      paintBars();
      break;
    }
    case 'gym-rest-skip':
      writeJSON(REST_KEY, null);
      paintBars();
      break;
    case 'gym-finish': {
      const patch = finishPatch(w, now);
      if (!patch) { deps.toast('Tick at least one working set first.'); break; }
      Object.assign(w, patch); // gymLoggedAt + gymDurationSec only — never `completed`
      writeJSON(REST_KEY, null);
      writeJSON(SW_KEY, null);
      store.touchWorkout(id);
      deps.showFinish(id);
      break;
    }
    case 'gym-back': refresh(id); break;
    case 'gym-done': deps.close(); break;
    default: break;
  }
  return true;
}

function exerciseMenuAction(pick, w, i, deps) {
  const { store, refresh } = deps;
  const list = w.exercises;
  const ex = list[i];
  const done = () => { cleanSupersets(list); store.touchWorkout(w.id); refresh(w.id); };
  if (pick === 'up') { moveItem(list, i, i - 1); done(); }
  else if (pick === 'down') { moveItem(list, i, i + 1); done(); }
  else if (pick === 'link') { linkWithNext(list, i, Date.now()); done(); }
  else if (pick === 'unlink') { unlinkSuperset(list, i); done(); }
  else if (pick === 'replace') {
    openPicker({
      title: 'Replace exercise', multi: false,
      onPick: ([en]) => { if (en) { list[i] = replaceExercise(ex, en, Date.now()); done(); } },
    });
  } else if (pick === 'remove') {
    const logged = (ex.sets || []).filter((s) => s.done).length;
    if (logged && !confirm(`Remove ${ex.name}? Its ${logged} logged set${logged === 1 ? '' : 's'} go too.`)) return;
    list.splice(i, 1);
    openNotes.clear();
    done();
  }
}

/** Hook up drag-to-reorder after the logger is drawn. */
export function wireLogger(root, deps) {
  root?.querySelectorAll('[data-gl-list]').forEach((list) => enableDragSort(list, {
    item: '[data-gl-item]',
    handle: '[data-gl-grip]',
    onMove: (from, to) => {
      const w = deps.store.workoutById(list.dataset.id);
      if (!w || !moveItem(w.exercises, from, to)) return;
      cleanSupersets(w.exercises);
      deps.store.touchWorkout(w.id);
      deps.refresh(w.id);
    },
  }));
}

// ---- ticker --------------------------------------------------------------------------------

let _timer = null;
let _getWorkout = null;
let _onRestDone = null;

function paintBars() {
  const now = Date.now();
  document.querySelectorAll('[data-gl-bar]').forEach((bar) => {
    const w = _getWorkout?.(bar.dataset.id);
    if (w) bar.innerHTML = sessionBar(w, now);
  });
  const sw = getStopwatch();
  document.querySelectorAll('[data-gl-sw]').forEach((el) => { el.textContent = fmtClock(stopwatchElapsed(sw, now)); });
}

/**
 * Run the once-a-second clock while a logger is on screen or a rest is
 * running (so the rest still beeps after the sheet is closed). A rest that
 * ran out while the app was shut is cleared quietly instead of beeping late.
 */
export function startTicker(getWorkout, onRestDone) {
  stopTicker();
  _getWorkout = getWorkout;
  _onRestDone = onRestDone;
  const stale = getRest();
  if (stale && stale.endsAt < Date.now() - 5000) writeJSON(REST_KEY, null);
  if (!document.querySelector('[data-gl-bar]') && !getRest()) return;
  _timer = setInterval(() => {
    if (!document.querySelector('[data-gl-bar]') && !getRest()) { stopTicker(); return; }
    const r = getRest();
    if (r && restRemaining(r, Date.now()) === 0) {
      writeJSON(REST_KEY, null);
      _onRestDone?.();
    }
    paintBars();
  }, 1000);
}

export function stopTicker() {
  if (_timer) clearInterval(_timer);
  _timer = null;
}
