// editor.js — create / edit / delete / duplicate session modal.
// Keeps a local `draft` copy; structural changes re-render the modal body,
// field edits mutate the draft in place. Save writes through to the store.

import { upsertWorkout, deleteWorkout, duplicateWorkout, workoutById, newId } from './store.js';
import { DISCIPLINES, INTENSITIES, esc, coachMini } from './ui.js';
import { formatDuration } from '../core/scoring.js';
import { todayISO } from '../core/dates.js';
import { toast, playAccept } from './effects.js';
import { svg } from '../core/icons.js';
import { newSet, workSets } from '../core/sets.js';
import { matchExercise, exerciseById, exerciseArtSrc } from '../core/exercises.js';
import { exerciseFromEntry, moveItem, cleanSupersets, supersetInfo } from '../core/gym-edit.js';
import { openPicker } from './gym-picker.js';
import { enableDragSort } from './drag-sort.js';
import { routineRows } from './gym-routines.js';
import { MOMENT_LINES } from '../core/coach-lines.js';
import { openLayer, closeLayer } from './nav.js';

const SEG_KINDS = { warmup: 'Warm-up', work: 'Work', rest: 'Rest / float', cooldown: 'Cool-down' };
const SEG_INTENSITIES = { easy: 'Easy', moderate: 'Moderate', threshold: 'Threshold', vo2: 'VO₂', steady: 'Steady' };

let draft = null;
let isNew = false;

function blankWorkout(date) {
  return {
    id: newId(), date: date || todayISO(),
    type: 'run', title: '', intensity: 'easy', durationMin: 45,
    completed: false, completedAt: null, metrics: { distanceKm: '' },
    segments: [], exercises: [], packing: [], notes: '', seeded: false,
    deload: false, isRace: false, source: 'custom', strava_activity_id: null,
  };
}

export function openEditor(id = null, defaultDate = null) {
  const existing = id ? workoutById(id) : null;
  isNew = !existing;
  draft = existing ? structuredClone(existing) : blankWorkout(defaultDate);
  if (draft.metrics?.distanceKm == null) draft.metrics.distanceKm = '';
  // a fresh sheet on the layer stack (it starts at the top); closing it any
  // way (button, back, swipe, Escape) drops the draft
  const root = openLayer('editor', { reuse: false, onClose: () => { if (editorRoot === root) { editorRoot = null; draft = null; } } });
  editorRoot = root;
  renderModal();
}

let editorRoot = null;

function closeModal() {
  if (editorRoot) closeLayer(editorRoot);
}

function options(map, selected) {
  return Object.entries(map).map(([v, label]) =>
    `<option value="${v}" ${v === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function renderModal() {
  const root = editorRoot;
  if (!root) return;
  const d = draft;
  // adding or removing a row redraws the sheet: keep the scroll where it was
  const prevTop = root.querySelector('.modal-body')?.scrollTop ?? 0;

  const segRows = d.segments.map((s, i) => `
    <div class="row seg-row" data-seg="${i}">
      <input class="grow" type="text" value="${esc(s.label)}" placeholder="Label" data-seg-field="label" data-i="${i}">
      <select data-seg-field="kind" data-i="${i}">${options(SEG_KINDS, s.kind)}</select>
      <input class="num" type="number" min="0" step="0.5" value="${esc(s.value)}" placeholder="min" data-seg-field="value" data-i="${i}">
      <select data-seg-field="intensity" data-i="${i}">${options(SEG_INTENSITIES, s.intensity)}</select>
      <button type="button" class="icon-btn" data-del-seg="${i}" aria-label="Remove segment">${svg('close')}</button>
    </div>`).join('');

  // one row per exercise: picture, name, sets × reps; reorder with the arrows
  // or by dragging the grip; add more from the picker
  const ss = supersetInfo(d.exercises);
  const exRows = d.exercises.map((e, i) => {
    const ws = workSets(e);
    const timed = e.kind === 'time';
    const target = timed ? ws[0]?.seconds : ws[0]?.reps;
    const art = exerciseArtSrc(e.libId);
    return `
    <li class="ed-ex ${ss[i] ? 'in-ss' : ''}" data-ed-item>
      <span class="pk-thumb ${art ? 'ex-art' : ''}" aria-hidden="true">${art ? `<img src="${esc(art)}" alt="" width="48" height="48" loading="lazy" decoding="async">` : svg('gym')}</span>
      <span class="ed-ex-main">
        <b>${esc(e.name || 'Exercise')}</b>${ss[i] ? ` <small class="muted">Superset ${ss[i].letter}</small>` : ''}
        <span class="ed-ex-nums">
          <label><input class="num" type="text" inputmode="numeric" value="${ws.length}" aria-label="${esc(`${e.name} sets`)}" data-ex-field="sets" data-i="${i}"> sets</label>
          <label>× <input class="num" type="text" inputmode="numeric" value="${esc(target ?? '')}" aria-label="${esc(`${e.name} ${timed ? 'seconds' : 'reps'}`)}" data-ex-field="reps" data-i="${i}"> ${timed ? 's' : 'reps'}</label>
        </span>
      </span>
      <span class="ed-ex-tools">
        <button type="button" class="icon-btn tiny" data-mv-ex="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(`Move ${e.name} up`)}"><span class="ic-up">${svg('chevron')}</span></button>
        <button type="button" class="icon-btn tiny" data-mv-ex="${i}" data-dir="1" ${i === d.exercises.length - 1 ? 'disabled' : ''} aria-label="${esc(`Move ${e.name} down`)}"><span class="ic-down">${svg('chevron')}</span></button>
        <button type="button" class="icon-btn tiny gl-grip" data-ed-grip aria-label="${esc(`Drag to reorder ${e.name}`)}">${svg('grip')}</button>
        <button type="button" class="icon-btn tiny danger" data-del-ex="${i}" aria-label="${esc(`Remove ${e.name}`)}">${svg('close')}</button>
      </span>
    </li>`;
  }).join('');

  const packRows = d.packing.map((p, i) => `
    <div class="row pack-row" data-pack="${i}">
      <input class="grow" type="text" value="${esc(p.item)}" placeholder="Item" data-pack-field="item" data-i="${i}">
      <button type="button" class="icon-btn" data-del-pack="${i}" aria-label="Remove item">${svg('close')}</button>
    </div>`).join('');

  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${isNew ? 'New session' : 'Edit session'}">
      <header class="modal-head">
        <h2>${svg(isNew ? 'plus' : 'edit')} ${isNew ? 'New session' : 'Edit session'}</h2>
        <button class="icon-btn" data-close aria-label="Close">${svg('close')}</button>
      </header>
      <div class="modal-body">
        ${isNew && routineRows({ date: d.date }) ? `<fieldset class="sub-list"><legend>Start a routine</legend>${routineRows({ date: d.date })}</fieldset>` : ''}
        <label class="field"><span>Title</span>
          <input type="text" id="f-title" value="${esc(d.title)}" placeholder="e.g. Long ride Z2" data-field="title"></label>

        <div class="field-grid">
          <label class="field"><span>Type</span><select data-field="type">${options(Object.fromEntries(Object.entries(DISCIPLINES).map(([k, v]) => [k, v.label])), d.type)}</select></label>
          <label class="field"><span>Intensity</span><select data-field="intensity">${options(INTENSITIES, d.intensity)}</select></label>
          <label class="field"><span>Date</span><input type="date" value="${esc(d.date)}" data-field="date"></label>
          <label class="field"><span>Distance (km, optional)</span><input type="number" min="0" step="0.1" value="${esc(d.metrics.distanceKm)}" data-field="distance"></label>
        </div>

        <label class="field"><span>Duration — <b id="dur-label">${formatDuration(d.durationMin)}</b></span>
          <input type="range" id="f-duration" min="0" max="240" step="5" value="${d.durationMin}" data-field="duration"></label>

        <label class="field"><span>Notes / plan</span>
          <textarea rows="3" data-field="notes" placeholder="Targets, paces, reminders…">${esc(d.notes)}</textarea></label>

        <fieldset class="sub-list"><legend>Interval structure</legend>
          ${segRows || '<p class="muted small">No segments. Add work/rest blocks to draw the interval chart.</p>'}
          <button type="button" class="btn tiny ghost" data-add-seg>${svg('plus')} Add segment</button>
        </fieldset>

        <fieldset class="sub-list"><legend>Gym exercises</legend>
          ${exRows ? `<ul class="ed-ex-list" data-ed-list>${exRows}</ul>` : '<p class="muted small">No exercises.</p>'}
          <button type="button" class="btn tiny ghost" data-add-ex>${svg('plus')} Add exercises</button>
        </fieldset>

        <fieldset class="sub-list"><legend>Packing list</legend>
          ${packRows || '<p class="muted small">No items.</p>'}
          <button type="button" class="btn tiny ghost" data-add-pack>${svg('plus')} Add item</button>
        </fieldset>
      </div>
      <footer class="modal-foot">
        ${!isNew ? `<button class="btn ghost danger" data-do="delete">${svg('trash')} Delete</button><button class="btn ghost" data-do="duplicate">${svg('copy')} Duplicate</button>` : ''}
        <span class="spacer"></span>
        <button class="btn ghost" data-close>Cancel</button>
        <button class="btn primary" data-do="save">Save</button>
      </footer>
    </div>`;

  const body = root.querySelector('.modal-body');
  if (body) body.scrollTop = prevTop;
  wire(root);
}

function wire(root) {
  // close
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));

  // top-level fields
  root.querySelectorAll('[data-field]').forEach((el) => {
    const handler = () => {
      const f = el.dataset.field;
      if (f === 'duration') {
        draft.durationMin = Number(el.value);
        root.querySelector('#dur-label').textContent = formatDuration(draft.durationMin);
      } else if (f === 'distance') {
        draft.metrics.distanceKm = el.value === '' ? '' : Number(el.value);
      } else {
        draft[f] = el.value;
      }
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  // segment field edits
  root.querySelectorAll('[data-seg-field]').forEach((el) => el.addEventListener('input', () => {
    const i = +el.dataset.i, f = el.dataset.segField;
    draft.segments[i][f] = f === 'value' ? Number(el.value) : el.value;
  }));
  root.querySelectorAll('[data-ex-field]').forEach((el) => el.addEventListener('input', () => {
    const ex = draft.exercises[+el.dataset.i];
    const f = el.dataset.exField;
    const n = Math.round(Number(el.value));
    if (f === 'sets') {
      if (!(n >= 1 && n <= 20)) return;
      const ws = workSets(ex);
      const tmpl = ws[ws.length - 1] || newSet('work');
      while (workSets(ex).length < n) ex.sets.push(newSet('work', { reps: tmpl.reps, seconds: tmpl.seconds, weight: tmpl.weight }));
      while (workSets(ex).length > n) ex.sets.splice(ex.sets.lastIndexOf(workSets(ex).at(-1)), 1);
    } else if (f === 'reps') {
      const v = el.value.trim() === '' || !Number.isFinite(n) ? null : n;
      workSets(ex).forEach((s) => { if (ex.kind === 'time') s.seconds = v; else s.reps = v; });
    } else {
      ex[f] = el.value;
    }
  }));
  root.querySelectorAll('[data-pack-field]').forEach((el) => el.addEventListener('input', () => {
    draft.packing[+el.dataset.i][el.dataset.packField] = el.value;
  }));

  // add / remove rows (re-render to keep indices clean)
  const re = () => renderModal();
  root.querySelector('[data-add-seg]')?.addEventListener('click', () => { draft.segments.push({ label: 'Work', kind: 'work', value: 3, intensity: 'threshold' }); re(); });
  root.querySelector('[data-add-ex]')?.addEventListener('click', () => openPicker({
    onPick: (entries) => {
      entries.forEach((en) => draft?.exercises.push(exerciseFromEntry(en, Date.now())));
      if (entries.length && draft.type !== 'gym' && !draft.exercises.length) draft.type = 'gym';
      re();
    },
  }));
  root.querySelectorAll('[data-mv-ex]').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.mvEx;
    if (moveItem(draft.exercises, i, i + Number(b.dataset.dir))) { cleanSupersets(draft.exercises); re(); }
  }));
  enableDragSort(root.querySelector('[data-ed-list]'), {
    item: '[data-ed-item]', handle: '[data-ed-grip]',
    onMove: (from, to) => { if (moveItem(draft.exercises, from, to)) { cleanSupersets(draft.exercises); re(); } },
  });
  root.querySelector('[data-add-pack]')?.addEventListener('click', () => { draft.packing.push({ item: '', checked: false }); re(); });
  root.querySelectorAll('[data-del-seg]').forEach((b) => b.addEventListener('click', () => { draft.segments.splice(+b.dataset.delSeg, 1); re(); }));
  root.querySelectorAll('[data-del-ex]').forEach((b) => b.addEventListener('click', () => { draft.exercises.splice(+b.dataset.delEx, 1); cleanSupersets(draft.exercises); re(); }));
  root.querySelectorAll('[data-del-pack]').forEach((b) => b.addEventListener('click', () => { draft.packing.splice(+b.dataset.delPack, 1); re(); }));

  // actions
  root.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', () => action(b.dataset.do)));

  // focus the title once, when a new session opens (not on every redraw)
  if (isNew && !root.dataset.edFocused) { root.dataset.edFocused = '1'; root.querySelector('#f-title')?.focus({ preventScroll: true }); }

}

function action(kind) {
  if (kind === 'delete') {
    if (confirm('Delete this session? This cannot be undone.')) {
      deleteWorkout(draft.id);
      toast('Session deleted', { icon: svg('trash') });
      closeModal();
    }
    return;
  }
  if (kind === 'duplicate') {
    saveDraft();
    const copy = duplicateWorkout(draft.id);
    toast('Session duplicated', { icon: svg('copy') });
    closeModal();
    if (copy) openEditor(copy.id);
    return;
  }
  if (kind === 'save') {
    if (!draft.title.trim()) draft.title = `${DISCIPLINES[draft.type]?.label || 'Session'}`;
    saveDraft();
    if (isNew) {
      // a new session on the calendar is a quest the athlete just took on
      toast(`<b>Quest accepted</b><br>${MOMENT_LINES.accepted}`, { icon: coachMini() });
      playAccept();
    } else {
      toast('Session saved', { icon: svg('check') });
    }
    closeModal();
  }
}

function saveDraft() {
  // Strip empty distance, clean exercises/packing
  const out = structuredClone(draft);
  if (out.metrics.distanceKm === '' || out.metrics.distanceKm == null) delete out.metrics.distanceKm;
  out.exercises = out.exercises.filter((e) => e.name.trim()).map((e) => {
    // exercises come from the picker with their library (or custom) id; only
    // an old free-text one without an id tries to pick up its library entry
    if (e.libId) return e;
    const libId = matchExercise(e.name);
    if (!libId) return e;
    const lib = exerciseById(libId);
    return { ...e, libId, muscle: lib?.muscle ?? e.muscle ?? null, equipment: lib?.equipment ?? e.equipment ?? null };
  });
  out.packing = out.packing.filter((p) => p.item.trim());
  out.segments = out.segments.filter((s) => Number(s.value) > 0);
  upsertWorkout(out);
}
