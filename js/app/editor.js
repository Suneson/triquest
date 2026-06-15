// editor.js — create / edit / delete / duplicate session modal.
// Keeps a local `draft` copy; structural changes re-render the modal body,
// field edits mutate the draft in place. Save writes through to the store.

import { upsertWorkout, deleteWorkout, duplicateWorkout, workoutById, newId } from './store.js';
import { DISCIPLINES, INTENSITIES, esc } from './ui.js';
import { formatDuration } from '../core/scoring.js';
import { toast } from './effects.js';

const SEG_KINDS = { warmup: 'Warm-up', work: 'Work', rest: 'Rest / float', cooldown: 'Cool-down' };
const SEG_INTENSITIES = { easy: 'Easy', moderate: 'Moderate', threshold: 'Threshold', vo2: 'VO₂', steady: 'Steady' };

let draft = null;
let isNew = false;

function blankWorkout(date) {
  return {
    id: newId(), date: date || new Date().toISOString().slice(0, 10),
    type: 'run', title: '', intensity: 'easy', durationMin: 45,
    completed: false, completedAt: null, metrics: { distanceKm: '' },
    segments: [], exercises: [], packing: [], notes: '', seeded: false,
    deload: false, isRace: false,
  };
}

export function openEditor(id = null, defaultDate = null) {
  const existing = id ? workoutById(id) : null;
  isNew = !existing;
  draft = existing ? structuredClone(existing) : blankWorkout(defaultDate);
  if (draft.metrics?.distanceKm == null) draft.metrics.distanceKm = '';
  renderModal();
}

function closeModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  root.classList.remove('open');
  draft = null;
}

function options(map, selected) {
  return Object.entries(map).map(([v, label]) =>
    `<option value="${v}" ${v === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function renderModal() {
  const root = document.getElementById('modal-root');
  const d = draft;

  const segRows = d.segments.map((s, i) => `
    <div class="row seg-row" data-seg="${i}">
      <input class="grow" type="text" value="${esc(s.label)}" placeholder="Label" data-seg-field="label" data-i="${i}">
      <select data-seg-field="kind" data-i="${i}">${options(SEG_KINDS, s.kind)}</select>
      <input class="num" type="number" min="0" step="0.5" value="${esc(s.value)}" placeholder="min" data-seg-field="value" data-i="${i}">
      <select data-seg-field="intensity" data-i="${i}">${options(SEG_INTENSITIES, s.intensity)}</select>
      <button type="button" class="icon-btn" data-del-seg="${i}" aria-label="Remove segment">✕</button>
    </div>`).join('');

  const exRows = d.exercises.map((e, i) => `
    <div class="row ex-row" data-ex="${i}">
      <input class="grow" type="text" value="${esc(e.name)}" placeholder="Exercise" data-ex-field="name" data-i="${i}">
      <input class="num" type="text" value="${esc(e.sets)}" placeholder="sets" data-ex-field="sets" data-i="${i}">
      <input class="num" type="text" value="${esc(e.reps)}" placeholder="reps" data-ex-field="reps" data-i="${i}">
      <input class="grow" type="url" value="${esc(e.imageUrl || '')}" placeholder="custom image URL (optional)" data-ex-field="imageUrl" data-i="${i}">
      <button type="button" class="icon-btn" data-del-ex="${i}" aria-label="Remove exercise">✕</button>
    </div>`).join('');

  const packRows = d.packing.map((p, i) => `
    <div class="row pack-row" data-pack="${i}">
      <input class="grow" type="text" value="${esc(p.item)}" placeholder="Item" data-pack-field="item" data-i="${i}">
      <button type="button" class="icon-btn" data-del-pack="${i}" aria-label="Remove item">✕</button>
    </div>`).join('');

  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${isNew ? 'New session' : 'Edit session'}">
      <header class="modal-head">
        <h2>${isNew ? '➕ New session' : '✏️ Edit session'}</h2>
        <button class="icon-btn" data-close aria-label="Close">✕</button>
      </header>
      <div class="modal-body">
        <label class="field"><span>Title</span>
          <input type="text" id="f-title" value="${esc(d.title)}" placeholder="e.g. Long ride Z2" data-field="title"></label>

        <div class="field-grid">
          <label class="field"><span>Type</span><select data-field="type">${options(Object.fromEntries(Object.entries(DISCIPLINES).map(([k, v]) => [k, `${v.icon} ${v.label}`])), d.type)}</select></label>
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
          <button type="button" class="btn tiny ghost" data-add-seg>+ Add segment</button>
        </fieldset>

        <fieldset class="sub-list"><legend>Gym exercises</legend>
          ${exRows || '<p class="muted small">No exercises.</p>'}
          <button type="button" class="btn tiny ghost" data-add-ex>+ Add exercise</button>
        </fieldset>

        <fieldset class="sub-list"><legend>Packing list</legend>
          ${packRows || '<p class="muted small">No items.</p>'}
          <button type="button" class="btn tiny ghost" data-add-pack>+ Add item</button>
        </fieldset>
      </div>
      <footer class="modal-foot">
        ${!isNew ? '<button class="btn ghost danger" data-do="delete">🗑 Delete</button><button class="btn ghost" data-do="duplicate">⧉ Duplicate</button>' : ''}
        <span class="spacer"></span>
        <button class="btn ghost" data-close>Cancel</button>
        <button class="btn primary" data-do="save">Save</button>
      </footer>
    </div>`;

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
    const i = +el.dataset.i;
    draft.exercises[i][el.dataset.exField] = el.value;
  }));
  root.querySelectorAll('[data-pack-field]').forEach((el) => el.addEventListener('input', () => {
    draft.packing[+el.dataset.i][el.dataset.packField] = el.value;
  }));

  // add / remove rows (re-render to keep indices clean)
  const re = () => renderModal();
  root.querySelector('[data-add-seg]')?.addEventListener('click', () => { draft.segments.push({ label: 'Work', kind: 'work', value: 3, intensity: 'threshold' }); re(); });
  root.querySelector('[data-add-ex]')?.addEventListener('click', () => { draft.exercises.push({ name: '', sets: 3, reps: '8', done: false, weight: '', actualReps: '', rpe: '', notes: '', imageUrl: '' }); re(); });
  root.querySelector('[data-add-pack]')?.addEventListener('click', () => { draft.packing.push({ item: '', checked: false }); re(); });
  root.querySelectorAll('[data-del-seg]').forEach((b) => b.addEventListener('click', () => { draft.segments.splice(+b.dataset.delSeg, 1); re(); }));
  root.querySelectorAll('[data-del-ex]').forEach((b) => b.addEventListener('click', () => { draft.exercises.splice(+b.dataset.delEx, 1); re(); }));
  root.querySelectorAll('[data-del-pack]').forEach((b) => b.addEventListener('click', () => { draft.packing.splice(+b.dataset.delPack, 1); re(); }));

  // actions
  root.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', () => action(b.dataset.do)));

  // focus title for new sessions
  if (isNew) root.querySelector('#f-title')?.focus();

  // esc to close
  root.querySelector('.modal')?.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

function action(kind) {
  if (kind === 'delete') {
    if (confirm('Delete this session? This cannot be undone.')) {
      deleteWorkout(draft.id);
      toast('Session deleted');
      closeModal();
    }
    return;
  }
  if (kind === 'duplicate') {
    saveDraft();
    const copy = duplicateWorkout(draft.id);
    toast('Session duplicated');
    closeModal();
    if (copy) openEditor(copy.id);
    return;
  }
  if (kind === 'save') {
    if (!draft.title.trim()) draft.title = `${DISCIPLINES[draft.type]?.label || 'Session'}`;
    saveDraft();
    toast(isNew ? 'Session added 💪' : 'Session saved');
    closeModal();
  }
}

function saveDraft() {
  // Strip empty distance, clean exercises/packing
  const out = structuredClone(draft);
  if (out.metrics.distanceKm === '' || out.metrics.distanceKm == null) delete out.metrics.distanceKm;
  out.exercises = out.exercises.filter((e) => e.name.trim());
  out.packing = out.packing.filter((p) => p.item.trim());
  out.segments = out.segments.filter((s) => Number(s.value) > 0);
  upsertWorkout(out);
}
