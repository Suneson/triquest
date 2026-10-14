// gym-picker.js — the exercise picker, and the small sheets that sit on top
// of the workout sheet (save routine). Opens in its own layer (#sheet-root)
// so the sheet underneath keeps its state and scroll.
//
// Search by name or alias, filter by equipment and muscle, recents first,
// everything else grouped by muscle, a pixel-art thumb on every row. Tap rows
// to select (numbered in the order you tapped), then Add. "Create exercise"
// saves a custom one into settings.customExercises.

import * as store from './store.js';
import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { MUSCLES, EQUIPMENT, exerciseArtSrc } from '../core/exercises.js';
import { catalogue, searchExercises, recentIds, groupByMuscle, makeCustomExercise, entryById } from '../core/gym-edit.js';

const KIND_OPTIONS = { weight_reps: 'Weight and reps', bodyweight: 'Bodyweight reps', time: 'Time' };

export function layer() {
  let root = document.getElementById('sheet-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'sheet-root';
    root.className = 'modal-root sheet-root';
    document.body.appendChild(root);
  }
  return root;
}

export function closeLayer() {
  const root = document.getElementById('sheet-root');
  if (root) { root.innerHTML = ''; root.classList.remove('open'); }
}

const opts = (list, sel, all) => `${all ? `<option value="">${all}</option>` : ''}${list.map((v) =>
  `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('')}`;

function thumb(e) {
  const src = exerciseArtSrc(e.id);
  return `<span class="pk-thumb ${src ? 'ex-art' : ''}" aria-hidden="true">${src
    ? `<img src="${esc(src)}" alt="" width="48" height="48" loading="lazy" decoding="async">`
    : svg('gym')}</span>`;
}

/**
 * Open the picker. `multi` picks several (Add button); otherwise the first tap
 * picks. `onPick(entries)` gets catalogue entries in the order they were tapped.
 */
export function openPicker({ title = 'Add exercises', multi = true, onPick } = {}) {
  const st = { q: '', equipment: '', muscle: '', picked: [], mode: 'list', error: '' };
  const root = layer();
  root.classList.add('open');
  const custom = () => store.getSettings().customExercises || [];

  const rowHtml = (e) => {
    const n = st.picked.indexOf(e.id);
    return `<li><button type="button" class="pk-row ${n >= 0 ? 'on' : ''}" data-pk="${esc(e.id)}" aria-pressed="${n >= 0}">
      ${thumb(e)}
      <span class="pk-txt"><b>${esc(e.name)}</b><small>${esc([e.muscle, e.equipment].filter(Boolean).join(' · '))}${e.custom ? ' · yours' : ''}</small></span>
      <span class="pk-mark" aria-hidden="true">${n >= 0 ? (multi ? n + 1 : svg('check')) : ''}</span>
    </button></li>`;
  };

  function listHtml() {
    const all = catalogue(custom());
    const filtered = !!(st.q.trim() || st.equipment || st.muscle);
    if (filtered) {
      const hits = searchExercises(all, st);
      return hits.length
        ? `<ul class="pk-ul">${hits.map(rowHtml).join('')}</ul>`
        : `<p class="muted pk-empty">Nothing matches. Try fewer letters, clear a filter, or create it.</p>`;
    }
    const recent = recentIds(store.getWorkouts()).map((id) => entryById(id, custom())).filter(Boolean);
    const groups = groupByMuscle(all);
    return `${recent.length ? `<h3 class="pk-h">Recent</h3><ul class="pk-ul">${recent.map(rowHtml).join('')}</ul>` : ''}
      ${groups.map((g) => `<h3 class="pk-h">${esc(g.muscle)}</h3><ul class="pk-ul">${g.items.map(rowHtml).join('')}</ul>`).join('')}`;
  }

  function footHtml() {
    if (st.mode === 'create') return '';
    return `<footer class="modal-foot">
      <button type="button" class="btn ghost" data-pk-do="create">${svg('plus')} Create</button>
      <span class="spacer"></span>
      ${multi ? `<button type="button" class="btn primary" data-pk-do="add" ${st.picked.length ? '' : 'disabled'}>Add${st.picked.length ? ` ${st.picked.length}` : ''}</button>` : ''}
    </footer>`;
  }

  function createHtml() {
    return `<form class="pk-create" data-pk-form>
      <label class="field"><span>Name</span><input type="text" name="name" maxlength="60" required value="${esc(st.q)}" autocomplete="off"></label>
      <label class="field"><span>Equipment</span><select name="equipment">${opts(EQUIPMENT, st.equipment || 'Other')}</select></label>
      <label class="field"><span>Main muscle</span><select name="muscle">${opts(MUSCLES, st.muscle || 'Full body')}</select></label>
      <label class="field"><span>Logged as</span><select name="kind">${Object.entries(KIND_OPTIONS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
      ${st.error ? `<p class="pk-error" role="alert">${esc(st.error)}</p>` : ''}
      <div class="row">
        <button type="button" class="btn ghost" data-pk-do="back">Back</button>
        <span class="spacer"></span>
        <button type="submit" class="btn primary">Save exercise</button>
      </div>
    </form>`;
  }

  function draw() {
    root.innerHTML = `
      <div class="modal-backdrop" data-pk-close></div>
      <div class="modal pk-modal" role="dialog" aria-modal="true" aria-label="${esc(st.mode === 'create' ? 'Create exercise' : title)}">
        <header class="modal-head"><h2>${svg(st.mode === 'create' ? 'plus' : 'gym')} ${esc(st.mode === 'create' ? 'Create exercise' : title)}</h2>
          <button class="icon-btn" data-pk-close aria-label="Close">${svg('close')}</button></header>
        ${st.mode === 'create' ? `<div class="modal-body">${createHtml()}</div>` : `
        <div class="pk-tools">
          <label class="pk-search">${svg('search')}<input type="search" placeholder="Search exercise" value="${esc(st.q)}" data-pk-q aria-label="Search exercise" autocomplete="off"></label>
          <div class="pk-filters">
            <label class="chip gl-chip"><select data-pk-f="equipment" aria-label="Equipment">${opts(EQUIPMENT, st.equipment, 'All equipment')}</select></label>
            <label class="chip gl-chip"><select data-pk-f="muscle" aria-label="Muscle">${opts(MUSCLES, st.muscle, 'All muscles')}</select></label>
          </div>
        </div>
        <div class="modal-body pk-body" data-pk-list>${listHtml()}</div>`}
        ${footHtml()}
      </div>`;
    if (st.mode === 'create') root.querySelector('[name="name"]')?.focus();
  }

  const redrawList = () => {
    const list = root.querySelector('[data-pk-list]');
    if (list) list.innerHTML = listHtml();
    const foot = root.querySelector('.modal-foot');
    if (foot) foot.outerHTML = footHtml();
  };

  const finish = (entries) => { closeLayer(); onPick?.(entries); };

  root.oninput = (e) => {
    if (e.target.matches('[data-pk-q]')) { st.q = e.target.value; redrawList(); }
  };
  root.onchange = (e) => {
    const f = e.target.dataset.pkF;
    if (f) { st[f] = e.target.value; redrawList(); }
  };
  root.onclick = (e) => {
    if (e.target.closest('[data-pk-close]')) { closeLayer(); return; }
    const row = e.target.closest('[data-pk]');
    if (row) {
      const id = row.dataset.pk;
      if (!multi) { finish([entryById(id, custom())]); return; }
      const at = st.picked.indexOf(id);
      if (at >= 0) st.picked.splice(at, 1); else st.picked.push(id);
      const scroller = root.querySelector('[data-pk-list]');
      const top = scroller?.scrollTop;
      redrawList();
      if (scroller) scroller.scrollTop = top;
      return;
    }
    const act = e.target.closest('[data-pk-do]')?.dataset.pkDo;
    if (act === 'add') finish(st.picked.map((id) => entryById(id, custom())).filter(Boolean));
    else if (act === 'create') { st.mode = 'create'; st.error = ''; draw(); }
    else if (act === 'back') { st.mode = 'list'; draw(); }
  };
  root.onsubmit = (e) => {
    if (!e.target.matches('[data-pk-form]')) return;
    e.preventDefault();
    const fd = new FormData(e.target);
    const res = makeCustomExercise(Object.fromEntries(fd), custom());
    if (res.error) { st.error = res.error; st.q = String(fd.get('name') || ''); draw(); return; }
    store.setSetting('customExercises', [...custom(), res.entry]);
    if (!multi) { finish([res.entry]); return; }
    st.picked.push(res.entry.id);
    st.mode = 'list'; st.q = ''; st.equipment = ''; st.muscle = '';
    draw();
  };
  root.onkeydown = (e) => { if (e.key === 'Escape') closeLayer(); };
  draw();
  root.querySelector('[data-pk-q]')?.focus({ preventScroll: true });
}

/** A one-field sheet on top of the workout sheet: "Save as routine" and the like. */
export function openNameSheet({ title, label, value = '', submit = 'Save', onSave }) {
  const root = layer();
  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop" data-pk-close></div>
    <div class="modal pk-modal pk-small" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-pk-close aria-label="Close">${svg('close')}</button></header>
      <form class="modal-body" data-name-form>
        <label class="field"><span>${esc(label)}</span><input type="text" name="v" maxlength="60" required value="${esc(value)}" autocomplete="off"></label>
        <button type="submit" class="btn primary">${esc(submit)}</button>
      </form>
    </div>`;
  root.onclick = (e) => { if (e.target.closest('[data-pk-close]')) closeLayer(); };
  root.oninput = null; root.onchange = null;
  root.onkeydown = (e) => { if (e.key === 'Escape') closeLayer(); };
  root.onsubmit = (e) => {
    e.preventDefault();
    const v = String(new FormData(e.target).get('v') || '').trim();
    if (!v) return;
    closeLayer();
    onSave?.(v);
  };
  const input = root.querySelector('input');
  input?.focus(); input?.select();
}
