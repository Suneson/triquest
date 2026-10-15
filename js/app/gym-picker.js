// gym-picker.js — the exercise picker, and the small sheets that sit on top
// of the workout sheet (save routine). Each opens as its own layer on the nav stack
// so the sheet underneath keeps its state and scroll.
//
// Search by name or alias, filter by equipment and muscle, recents first,
// everything else grouped by muscle, a pixel-art thumb on every row. Tap rows
// to select (numbered in the order you tapped), then Add. "Create exercise"
// saves a custom one into settings.customExercises.

import * as store from './store.js';
import { openLayer, closeLayer as navClose } from './nav.js';
import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { MUSCLES, EQUIPMENT, exerciseArtSrc, muscleLabel, equipLabel } from '../core/exercises.js';
import { catalogue, searchExercises, recentIds, groupByMuscle, makeCustomExercise, entryById } from '../core/gym-edit.js';
import { sheetHead } from './sheet.js';
import { t } from '../core/i18n.js';

const KIND_OPTIONS = ['weight_reps', 'bodyweight', 'time'];

// Sheets that sit on top of the workout sheet are layers on the nav stack, so
// back, the edge swipe and Escape close them like everything else.
const sheets = [];
export function layer(name = 'sheet') {
  const el = openLayer(name, {
    reuse: false, className: 'sheet-root',
    onClose: () => { const i = sheets.indexOf(el); if (i >= 0) sheets.splice(i, 1); },
  });
  sheets.push(el);
  return el;
}

/** Close a sheet (default: the newest one this module opened). */
export function closeLayer(el) {
  const target = el || sheets[sheets.length - 1];
  if (target) navClose(target);
}

// values stay English (they're stored); the labels follow the language
const opts = (list, sel, all, label = (v) => v) => `${all ? `<option value="">${all}</option>` : ''}${list.map((v) =>
  `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(label(v))}</option>`).join('')}`;

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
export function openPicker({ title = t('pk.addExercises'), multi = true, onPick } = {}) {
  const st = { q: '', equipment: '', muscle: '', picked: [], mode: 'list', error: '' };
  const root = layer('picker');
  const custom = () => store.getSettings().customExercises || [];

  const rowHtml = (e) => {
    const n = st.picked.indexOf(e.id);
    return `<li><button type="button" class="pk-row ${n >= 0 ? 'on' : ''}" data-pk="${esc(e.id)}" aria-pressed="${n >= 0}">
      ${thumb(e)}
      <span class="pk-txt"><b>${esc(e.name)}</b><small>${esc([muscleLabel(e.muscle), equipLabel(e.equipment)].filter(Boolean).join(' · '))}${e.custom ? t('pk.yours') : ''}</small></span>
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
        : `<p class="muted pk-empty">${t('pk.nothing')}</p>`;
    }
    const recent = recentIds(store.getWorkouts()).map((id) => entryById(id, custom())).filter(Boolean);
    const groups = groupByMuscle(all);
    return `${recent.length ? `<h3 class="pk-h">${t('pk.recent')}</h3><ul class="pk-ul">${recent.map(rowHtml).join('')}</ul>` : ''}
      ${groups.map((g) => `<h3 class="pk-h">${esc(muscleLabel(g.muscle))}</h3><ul class="pk-ul">${g.items.map(rowHtml).join('')}</ul>`).join('')}`;
  }

  function footHtml() {
    if (st.mode === 'create') return '';
    return `<footer class="modal-foot">
      <button type="button" class="btn ghost" data-pk-do="create">${svg('plus')} ${t('pk.create')}</button>
      <span class="spacer"></span>
      ${multi ? `<button type="button" class="btn primary" data-pk-do="add" ${st.picked.length ? '' : 'disabled'}>${st.picked.length ? t('pk.addN', { n: st.picked.length }) : t('pk.add')}</button>` : ''}
    </footer>`;
  }

  function createHtml() {
    return `<form class="pk-create" data-pk-form>
      <label class="field"><span>${t('pk.name')}</span><input type="text" name="name" maxlength="60" required value="${esc(st.q)}" autocomplete="off"></label>
      <label class="field"><span>${t('pk.equipment')}</span><select name="equipment">${opts(EQUIPMENT, st.equipment || 'Other', '', equipLabel)}</select></label>
      <label class="field"><span>${t('pk.mainMuscle')}</span><select name="muscle">${opts(MUSCLES, st.muscle || 'Full body', '', muscleLabel)}</select></label>
      <label class="field"><span>${t('pk.loggedAs')}</span><select name="kind">${KIND_OPTIONS.map((k) => `<option value="${k}">${t(`pk.kind.${k}`)}</option>`).join('')}</select></label>
      ${st.error ? `<p class="pk-error" role="alert">${esc(st.error)}</p>` : ''}
      <div class="row">
        <button type="button" class="btn ghost" data-pk-do="back">${t('pk.back')}</button>
        <span class="spacer"></span>
        <button type="submit" class="btn primary">${t('pk.saveExercise')}</button>
      </div>
    </form>`;
  }

  function draw() {
    root.innerHTML = `
      <div class="modal-backdrop" data-pk-close></div>
      <div class="modal pk-modal" role="dialog" aria-modal="true" tabindex="-1" aria-label="${esc(st.mode === 'create' ? t('pk.createExercise') : title)}">
        ${sheetHead({ icon: st.mode === 'create' ? 'plus' : 'gym', title: esc(st.mode === 'create' ? t('pk.createExercise') : title), closeAttr: 'data-pk-close' })}
        ${st.mode === 'create' ? `<div class="modal-body">${createHtml()}</div>` : `
        <div class="pk-tools">
          <label class="pk-search">${svg('search')}<input type="search" placeholder="${t('pk.search')}" value="${esc(st.q)}" data-pk-q aria-label="${t('pk.search')}" autocomplete="off"></label>
          <div class="pk-filters">
            <label class="chip gl-chip"><select data-pk-f="equipment" aria-label="${t('pk.equipment')}">${opts(EQUIPMENT, st.equipment, t('pk.allEquipment'), equipLabel)}</select></label>
            <label class="chip gl-chip"><select data-pk-f="muscle" aria-label="${t('pk.muscle')}">${opts(MUSCLES, st.muscle, t('pk.allMuscles'), muscleLabel)}</select></label>
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
  draw();
  // focus the sheet, not the search box: the full list shows first and the
  // phone keyboard stays down until you tap Search yourself
  root.querySelector('.pk-modal')?.focus({ preventScroll: true });
}

/** A one-field sheet on top of the workout sheet: "Save as routine" and the like. */
export function openNameSheet({ title, label, value = '', submit = t('pk.save'), onSave }) {
  const root = layer('name-sheet');
  root.innerHTML = `
    <div class="modal-backdrop" data-pk-close></div>
    <div class="modal pk-modal pk-small" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      ${sheetHead({ title: `${esc(title)}`, closeAttr: 'data-pk-close' })}
      <form class="modal-body" data-name-form>
        <label class="field"><span>${esc(label)}</span><input type="text" name="v" maxlength="60" required value="${esc(value)}" autocomplete="off"></label>
        <button type="submit" class="btn primary">${esc(submit)}</button>
      </form>
    </div>`;
  root.onclick = (e) => { if (e.target.closest('[data-pk-close]')) closeLayer(); };
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
