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
import { exerciseArtSrc, cuesForId, exerciseById, exName, muscleLabel, equipLabel } from '../core/exercises.js';
import { cuesFor, poseSvgFor } from '../core/poses.js';
import { openPicker, openNameSheet } from './gym-picker.js';
import { haptic } from './haptics.js';
import { xpStatus } from '../core/scoring.js';
import { earnedBySession } from '../core/wallet.js';
import { sessionXp, splitText } from './xp-split.js';
import { enableDragSort } from './drag-sort.js';
import { openExerciseHistory } from './gym-history.js';
import { morph } from './vt.js';
import { detectPRs } from '../core/gym-stats.js';
import {
  exerciseFromEntry, replaceExercise, moveItem, linkWithNext, unlinkSuperset, cleanSupersets,
  supersetInfo, restAfterTick, routineFromWorkout, saveRoutine,
} from '../core/gym-edit.js';
import {
  setLabels, previousSets, previousFor, formatSet, fillFrom, addSet, removeSet, tickSet, markStarted,
  sessionSummary, fmtClock, restLabel, REST_PRESETS, SET_KIND_LABELS, startRest, restRemaining, extendRest,
  startStopwatch, stopwatchElapsed, finishPatch, nextSet,
} from '../core/gym-log.js';
import { t, fmtNum } from '../core/i18n.js';
import { planTitle } from '../core/plan-i18n.js';
import { checkinOn, atGym } from './checkin.js';

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
    ? `<span class="tag gl-logged">${svg('check')} ${t('gym.logged')}</span>` : '';
  const restRow = left > 0 ? `
    <div class="gl-rest${left <= 3 ? ' is-ending' : ''}" role="timer" aria-label="${t('gym.restLeft', { time: fmtClock(left) })}">
      <span class="gl-ring">${restRing(left, rest.totalSec)}<b class="data-num gl-rest-left">${fmtClock(left)}</b></span>
      <span class="gl-k">${t('gym.restK')}</span>
      <span class="gl-rest-btns">
        <button class="btn tiny secondary" data-action="gym-rest-adjust" data-by="-15" data-id="${esc(w.id)}" aria-label="${t('gym.less15')}">${svg('minus')}15</button>
        <button class="btn tiny secondary" data-action="gym-rest-adjust" data-by="15" data-id="${esc(w.id)}" aria-label="${t('gym.more15')}">${svg('plus')}15</button>
        <button class="btn tiny ghost" data-action="gym-rest-skip" data-id="${esc(w.id)}">${t('gym.skip')}</button>
      </span>
    </div>` : '';
  return `
    <div class="gl-bar-row">
      <div class="gl-clock">
        <span class="gl-k">${t('gym.time')}</span>
        <b class="data-num" data-gl-elapsed>${sum.durationSec != null ? fmtClock(sum.durationSec) : '0:00'}</b>
        ${sum.durationSec == null ? `<small class="muted">${t('gym.pressStart')}</small>` : logged}
      </div>
      ${!w.gymStartedAt && !w.gymLoggedAt && w.exercises?.length
    ? `<button class="btn primary tiny gl-finish" data-action="gym-start" data-id="${esc(w.id)}">${t('gym.start')}</button>`
    : `<button class="btn primary tiny gl-finish" data-action="gym-finish" data-id="${esc(w.id)}">${w.gymLoggedAt ? t('gym.save') : t('gym.finish')}</button>`}
    </div>${restRow}`;
}

// The rest drains as a ring of twelve pixel blocks around the countdown, one
// block at a time, clockwise from the top. The last three seconds pulse (CSS).
function restRing(left, total) {
  const n = 12;
  const on = Math.max(0, Math.min(n, Math.ceil((left / Math.max(1, total)) * n)));
  const cells = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = Math.round(29 + 23 * Math.cos(a) - 3);
    const y = Math.round(29 + 23 * Math.sin(a) - 3);
    return `<rect x="${x}" y="${y}" width="6" height="6" class="${i < on ? 'on' : ''}"/>`;
  }).join('');
  return `<svg class="gl-ring-svg" viewBox="0 0 58 58" width="58" height="58" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
}

// ---- guided workout: the set to do next ------------------------------------------------------
// Once the session has started, the next unticked set (in the order you do
// them; supersets alternate) is outlined in gold. While a rest runs it is
// only marked as up next; when the rest ends (or you skip it) it lights up
// and scrolls into view.

function cursorFor(w) {
  if (!w?.gymStartedAt || w.gymLoggedAt) return null;
  const n = nextSet(w.exercises);
  if (!n) return null;
  const rest = getRest();
  const resting = rest && rest.workoutId === w.id && restRemaining(rest, Date.now()) > 0;
  return { ...n, cls: resting ? 'is-upnext' : 'is-next' };
}

/** Re-mark the next set on screen without redrawing (inputs keep focus). */
export function paintCursor() {
  document.querySelectorAll('[data-gl-list]').forEach((list) => {
    const w = _getWorkout?.(list.dataset.id);
    const cur = w && cursorFor(w);
    list.querySelectorAll('[data-gl-row]').forEach((row) => {
      const on = cur && row.dataset.glRow === `${cur.ex}:${cur.set}`;
      row.classList.toggle('is-next', !!on && cur.cls === 'is-next');
      row.classList.toggle('is-upnext', !!on && cur.cls === 'is-upnext');
    });
  });
}

/** Bring the next set into view, unless you're typing somewhere in the log. */
export function scrollToNext() {
  const row = document.querySelector('[data-gl-list] .gl-row.is-next, [data-gl-list] .gl-row.is-upnext');
  if (!row) return;
  if (document.activeElement?.closest?.('[data-gl-list]') && document.activeElement.matches('input, textarea')) return;
  const calm = document.body.classList.contains('rm') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  row.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
}

/** The whole logger for a workout. */
export function renderLogger(w, workouts) {
  if (!Array.isArray(w.exercises)) w.exercises = [];
  const ss = supersetInfo(w.exercises);
  const blocks = w.exercises.map((ex, i) => exerciseBlock(w, ex, i, workouts, ss[i])).join('');
  const ids = `data-id="${esc(w.id)}"`;
  return `<div class="gl-bar" data-gl-bar data-id="${esc(w.id)}">${sessionBar(w)}</div><!--gl-split-->
    <div class="block gl"><h4>${t('gym.exercises')}</h4>
      ${blocks ? `<div class="gl-list" data-gl-list ${ids}>${blocks}</div>` : `<p class="muted gl-empty">${t('gym.noExercises')}</p>`}
      <button class="btn secondary block" data-action="gym-add-ex" ${ids}>${svg('plus')} ${t('gym.addExercises')}</button>
      ${blocks ? `<button class="btn ghost block" data-action="gym-save-routine" ${ids}>${svg('copy')} ${t('gym.saveRoutine')}</button>` : ''}
    </div>`;
}

function exerciseMenu(w, ex, i, ss) {
  const n = w.exercises.length;
  const items = [
    ['up', i > 0],
    ['down', i < n - 1],
    ['link', i < n - 1 && !(ss && !ss.last)],
    ['unlink', !!ss],
    ['replace', true],
    ['remove', true],
  ].filter(([, ok]) => ok);
  return `<label class="icon-btn tiny gl-more" title="${t('gym.more')}">${svg('more')}
    <select data-action="gym-ex-menu" data-id="${esc(w.id)}" data-ex="${i}" aria-label="${esc(t('gym.moreAria', { name: exName(ex) }))}">
      <option value="" selected disabled hidden>${t('gym.more')}</option>
      ${items.map(([v]) => `<option value="${v}">${t(`gym.menu.${v}`)}</option>`).join('')}
    </select></label>`;
}

function exerciseBlock(w, ex, i, workouts, ss) {
  const lib = exerciseById(ex.libId);
  const art = exerciseArtSrc(ex.libId);
  const pic = ex.imageUrl
    ? `<img src="${esc(ex.imageUrl)}" alt="" width="64" height="64" loading="lazy" onerror="this.style.display='none'">`
    : art ? `<img src="${esc(art)}" alt="" width="64" height="64" loading="lazy" decoding="async">` : poseSvgFor(ex.name);
  const name = exName(ex);
  const sub = [muscleLabel(ex.muscle || lib?.muscle), equipLabel(ex.equipment || lib?.equipment)].filter(Boolean).join(' · ');
  const cues = cuesForId(ex.libId) || cuesFor(ex.name);
  // a note reads as one line; the text box only opens from the Note chip
  const noteOpen = openNotes.has(`${w.id}:${i}`);
  const prev = previousSets(workouts, ex, { beforeDate: w.date, excludeId: w.id });
  const timed = ex.kind === 'time' || ex.kind === 'distance';
  const labels = setLabels(ex.sets);
  const sw = getStopwatch();
  const cur = cursorFor(w);
  const rows = ex.sets.map((s, j) => setRow(w, ex, i, s, j, labels[j], previousFor(prev, ex.sets, j), timed, sw,
    s.done && s.kind !== 'warmup' && detectPRs(workouts, w, i, j).length > 0,
    cur && cur.ex === i && cur.set === j ? cur.cls : '')).join('');
  const ids = `data-id="${esc(w.id)}" data-ex="${i}"`;
  const head = timed
    ? `<span>${t('gym.colSet')}</span><span class="gl-col-prev">${t('gym.colLast')}</span><span>${t('gym.colTime')}</span><span aria-label="${t('gym.done')}">${svg('check')}</span>`
    : `<span>${t('gym.colSet')}</span><span class="gl-col-prev">${t('gym.colLast')}</span><span>${ex.kind === 'bodyweight' ? t('gym.colPlusKg') : t('gym.colKg')}</span><span>${t('gym.colReps')}</span><span aria-label="${t('gym.done')}">${svg('check')}</span>`;
  return `
    <section class="gl-ex ${ss ? `in-ss${ss.first ? ' ss-first' : ''}${ss.last ? ' ss-last' : ''}` : ''}" data-gl-item aria-label="${esc(ss ? t('gym.supersetAria', { letter: ss.letter, name }) : name)}">
      ${ss?.first ? `<span class="tag gl-ss-tag">${esc(t('gym.superset', { letter: ss.letter }))}</span>` : ''}
      <header class="gl-ex-head">
        <div class="ex-img ${art && !ex.imageUrl ? 'ex-art' : ''}">${pic}</div>
        <div class="gl-ex-title">
          <h5><button type="button" class="gl-name" data-action="gym-history" ${ids} aria-label="${esc(t('gym.historyAria', { name }))}">${esc(name)}</button></h5>
          ${sub ? `<span class="muted small">${esc(sub)}</span>` : ''}
        </div>
        <span class="gl-ex-tools">
          <button type="button" class="icon-btn tiny gl-grip" data-gl-grip aria-label="${esc(t('gym.dragAria', { name }))}" title="${t('gym.dragTitle')}">${svg('grip')}</button>
          ${exerciseMenu(w, ex, i, ss)}
        </span>
      </header>
      <div class="gl-chips">
        <label class="chip gl-chip">${svg('clock')}<select data-action="gym-rest" ${ids} aria-label="${t('gym.restBetween')}">
          ${[...new Set([...REST_PRESETS, ex.restSec || 0])].sort((a, b) => a - b)
    .map((sec) => `<option value="${sec}" ${sec === (ex.restSec || 0) ? 'selected' : ''}>${restLabel(sec)}</option>`).join('')}
        </select></label>
        <button class="chip gl-chip" data-action="gym-note-toggle" ${ids} aria-expanded="${noteOpen}">${svg('edit')}${t('gym.note')}</button>
      </div>
      ${noteOpen ? `<textarea class="gl-note" rows="2" data-action="gym-note" ${ids} placeholder="${t('gym.notePh')}" aria-label="${esc(t('gym.noteAria', { name }))}">${esc(ex.note || '')}</textarea>`
    : ex.note ? `<p class="gl-note-txt">${esc(ex.note)}</p>` : ''}
      ${cues?.length ? `<details class="gl-cues"><summary>${t('gym.howTo')}</summary><ul class="cues">${cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
      <div class="gl-grid ${timed ? 'is-timed' : ''}">
        <div class="gl-row gl-head" aria-hidden="true">${head}</div>
        ${rows}
      </div>
      <button class="btn secondary gl-add" data-action="gym-add-set" ${ids}>${svg('plus')} ${t('gym.addSet')}</button>
    </section>`;
}

function setRow(w, ex, i, s, j, label, prevSet, timed, sw, isPR = false, cursorCls = '') {
  const ids = `data-id="${esc(w.id)}" data-ex="${i}" data-set="${j}"`;
  const name = t('gym.setName', { kind: SET_KIND_LABELS[s.kind] || SET_KIND_LABELS.work, label });
  const prevText = formatSet(prevSet, ex.kind);
  const prevBtn = (cls) => (prevText
    ? `<button class="gl-prev ${cls}" data-action="gym-fill-prev" ${ids} aria-label="${esc(t('gym.useLast', { set: prevText }))}">${cls === 'gl-prev-sub' ? t('gym.lastPrefix') : ''}${esc(prevText)}</button>`
    : `<span class="gl-prev ${cls} muted" aria-hidden="true">${cls === 'gl-prev-sub' ? '' : '–'}</span>`);
  const num = (field, mode, value, aria) => `<input class="gl-in data-num" type="text" inputmode="${mode}" autocomplete="off"
      value="${value == null ? '' : esc(String(value))}" placeholder="${esc(prevSet?.[field] != null ? String(prevSet[field]) : '–')}"
      data-action="gym-field" data-field="${field}" ${ids} aria-label="${esc(`${name} ${aria}`)}">`;
  const kindSel = `<label class="gl-set k-${s.kind}">
      <span aria-hidden="true">${label}</span>
      <select data-action="gym-set-kind" ${ids} aria-label="${esc(t('gym.changeType', { name }))}">
        ${Object.entries(SET_KIND_LABELS).map(([k, label]) => `<option value="${k}" ${k === s.kind ? 'selected' : ''}>${label}</option>`).join('')}
        <option value="remove" ${ex.sets.length <= 1 ? 'disabled' : ''}>${t('gym.removeSet')}</option>
      </select>
    </label>`;
  let cells;
  if (timed) {
    const running = sw && sw.workoutId === w.id && sw.ex === i && sw.set === j;
    cells = `<span class="gl-time">
        <button class="icon-btn tiny gl-sw" data-action="gym-stopwatch" ${ids} aria-label="${esc(t(running ? 'gym.clockAria.stop' : 'gym.clockAria.start', { name }))}">${svg(running ? 'stop' : 'play')}</button>
        ${running
    ? `<b class="gl-in gl-sw-live data-num" data-gl-sw="${esc(`${w.id}:${i}:${j}`)}" role="timer">${fmtClock(stopwatchElapsed(sw, Date.now()))}</b>`
    : num('seconds', 'numeric', s.seconds, t('gym.seconds'))}
      </span>`;
  } else {
    cells = `${num('weight', 'decimal', s.weight, ex.kind === 'bodyweight' ? t('gym.addedKilos') : t('gym.kilos'))}${num('reps', 'numeric', s.reps, t('gym.reps'))}`;
  }
  return `<div class="gl-row ${s.done ? 'done' : ''} ${cursorCls}" data-gl-row="${i}:${j}">
      ${kindSel}
      ${prevBtn('gl-col-prev')}
      ${cells}
      <button class="gl-tick ${isPR ? 'is-pr' : ''}" data-action="gym-tick" ${ids} aria-pressed="${s.done}" aria-label="${esc(t(isPR ? 'gym.setDonePR' : 'gym.setDone', { name }))}">${isPR ? `<span class="gl-pr">${t('gym.pr')}</span>` : svg('check')}</button>
      ${prevText ? prevBtn('gl-prev-sub') : ''}
    </div>`;
}

/** Shown in the sheet after Finish. */
export function finishView(w, workouts = []) {
  const st = xpStatus(w, workouts);
  // the boosted number lands; the base, gear, gel and the coins it earned sit under it
  const b = sessionXp(w, workouts);
  const split = splitText(b);
  const got = earnedBySession(w, workouts);
  const extra = [split, got.coins ? t('xp.coinsN', { n: got.coins }) : '', got.carbs ? t('xp.carbsN', { n: got.carbs }) : ''].filter(Boolean).join(' · ');
  const earned = st.xp > 0
    ? dialogue({ text: t('gym.savedEarned'), body: `<span class="xp-land">+${b ? b.total : st.xp} XP</span>${extra ? `<small class="xp-land-sub">${esc(extra)}</small>` : ''}${st.capped ? `<p class="xp-line is-cap">${esc(t('xp.reason.cap'))}</p>` : ''}`, cls: 'coach-say gl-done' })
    : dialogue({ text: t('xp.savedNot'), body: `<p class="xp-line is-off">${esc(t(`xp.reason.${st.reason || 'sets'}`))}</p>`, cls: 'coach-say gl-done' });
  const sum = sessionSummary(w, Date.parse(w.gymLoggedAt) || Date.now());
  const dur = w.gymDurationSec != null ? w.gymDurationSec : sum.durationSec;
  return `
    <div class="gl-sum gl-sum-reveal">
      <div class="gl-sum-cell" style="--d:0"><span class="gl-k">${t('gym.sumSets')}</span><b class="data-num">${sum.sets}</b></div>
      <div class="gl-sum-cell" style="--d:1"><span class="gl-k">${t('gym.sumVolume')}</span><b class="data-num">${fmtNum(sum.volumeKg)}<span class="data-unit"> kg</span></b></div>
      <div class="gl-sum-cell" style="--d:2"><span class="gl-k">${t('gym.sumTime')}</span><b class="data-num">${dur != null ? fmtClock(dur) : '–'}</b></div>
    </div>
    <div role="status">${earned}</div>
    <button class="btn primary" data-action="gym-done" data-id="${esc(w.id)}">${t('main.done')}</button>
    <button class="btn ghost" data-action="gym-back" data-id="${esc(w.id)}">${t('gym.backToLog')}</button>`;
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
      if (s.done) { tickFeedback(i, j); celebrate(deps, w, i, j, el); }
      // no rest to wait for (rest off, or mid-superset): go straight to the next set
      if (s.done && !getRest()) scrollToNext();
      break;
    }
    case 'gym-start':
      markStarted(w, now);
      save(); refresh(id);
      _getWorkout = _getWorkout || ((wid) => store.workoutById(wid));
      scrollToNext(); // past the warm-up text, to the first set
      break;
    case 'gym-history':
      // the exercise's picture carries into its history
      if (ex) morph([{ name: 'exercise-art', from: el.closest('.gl-ex')?.querySelector('.ex-img'), to: '.gl-ex-head .ex-img' }],
        () => openExerciseHistory({ libId: ex.libId, name: ex.name }));
      break;
    case 'gym-add-ex':
      openPicker({
        onPick: (entries) => {
          if (!entries.length) return;
          entries.forEach((en) => w.exercises.push(exerciseFromEntry(en, Date.now())));
          save(); refresh(id); // refresh keeps the scroll where it was
        },
      });
      break;
    case 'gym-save-routine':
      openNameSheet({
        title: t('gym.routineTitle'), label: t('gym.routineLabel'), value: planTitle(w.title) || '', submit: t('gym.routineSubmit'),
        onSave: (name) => {
          const settings = store.getSettings();
          store.setSetting('routines', saveRoutine(settings.routines, routineFromWorkout(w, name, Date.now())));
          deps.toast(esc(t('gym.routineSaved', { name })), 'check');
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
      if (openNotes.has(key)) openNotes.delete(key); else openNotes.add(key);
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
        celebrate(deps, w, i, j, el);
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
      paintCursor();
      scrollToNext();
      break;
    case 'gym-finish': {
      const patch = finishPatch(w, now);
      if (!patch) { deps.toast(t('gym.tickFirst')); break; }
      const wasLogged = !!w.gymLoggedAt;
      writeJSON(REST_KEY, null);
      writeJSON(SW_KEY, null);
      // completes the session (gym earns XP without Strava), freezes the clock,
      // saves and redraws the app so XP and levels update
      store.updateWorkout(id, patch);
      if (wasLogged) { refresh(id); deps.toast(t('gym.saved'), 'check'); } else deps.showFinish(id);
      // the optional check-in: only a yes is kept, never where you were
      if (!wasLogged && checkinOn()) atGym().then((yes) => { if (yes) store.updateWorkout(id, { gymCheckin: true }); });
      break;
    }
    case 'gym-back': refresh(id); break;
    case 'gym-done': deps.close(); break;
    default: break;
  }
  return true;
}

// A ticked set: the row fills gold in four steps, the phone gives a short tick
// (Android) and a small chip flies from the tick to Finish, where the
// session's XP is paid. Reduced motion: just the done state.
function tickFeedback(i, j) {
  haptic('tick');
  const row = document.querySelector(`[data-gl-row="${i}:${j}"]`);
  if (!row || reducedMotion()) return;
  row.classList.add('just-ticked');
  setTimeout(() => row.classList.remove('just-ticked'), 600);
  const from = row.querySelector('.gl-tick')?.getBoundingClientRect();
  const to = document.querySelector('.gl-finish')?.getBoundingClientRect();
  if (!from || !to || !document.body.animate) return;
  const chip = document.createElement('span');
  chip.className = 'fly-chip';
  chip.textContent = t('gym.flyChip');
  chip.setAttribute('aria-hidden', 'true');
  chip.style.left = `${from.left + from.width / 2}px`;
  chip.style.top = `${from.top}px`;
  document.body.appendChild(chip);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top - from.top;
  chip.animate([
    { transform: 'translate(-50%, 0)', opacity: 1 },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), ${dy * 0.5 - 24}px)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), ${dy}px)`, opacity: 0 },
  ], { duration: 480, easing: 'steps(6, end)' }).finished.finally(() => chip.remove());
}

const reducedMotion = () => document.body.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches;

// a ticked set that beats your best: confetti from the tick, a sound, a toast
function celebrate(deps, w, i, j, el) {
  const prs = detectPRs(deps.store.getWorkouts(), w, i, j);
  if (!prs.length) return;
  const tick = document.querySelector(`[data-gl-row="${i}:${j}"] .gl-tick`) || el;
  const r = tick?.getBoundingClientRect?.();
  deps.onRecord?.({
    name: exName(w.exercises[i]), prs, target: tick,
    key: `${w.id}:${w.exercises[i].id || i}:${j}:${prs.map((p) => p.label).join('|')}`, // one stamp per record
    x: r ? r.left + r.width / 2 : null, y: r ? r.top : null,
  });
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
      title: t('gym.replaceTitle'), multi: false,
      onPick: ([en]) => { if (en) { list[i] = replaceExercise(ex, en, Date.now()); done(); } },
    });
  } else if (pick === 'remove') {
    const logged = (ex.sets || []).filter((s) => s.done).length;
    if (logged && !confirm(t('gym.removeConfirm', { name: exName(ex), n: logged }))) return;
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
      paintBars();
      paintCursor(); // the next set lights up
      document.querySelector('.gl-row.is-next')?.classList.add('lit-in');
      scrollToNext();
      return;
    }
    paintBars();
  }, 1000);
}

export function stopTicker() {
  if (_timer) clearInterval(_timer);
  _timer = null;
}
