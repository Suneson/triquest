// gym-routines.js — saved routines: listing them, starting one as a new gym
// session, deleting one. Routines live in settings.routines (see
// js/core/gym-edit.js), so they sync with the rest of the settings.

import * as store from './store.js';
import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { workoutFromRoutine } from '../core/gym-edit.js';
import { t } from '../core/i18n.js';

export const getRoutines = () => store.getSettings().routines || [];

/** Create a session on `date` from routine `id` and ask the app to open it. */
export function startRoutine(id, date) {
  const rt = getRoutines().find((r) => r.id === id);
  if (!rt) return null;
  const w = workoutFromRoutine(rt, { id: store.newId(), date, now: Date.now() });
  store.upsertWorkout(w);
  document.dispatchEvent(new CustomEvent('moske:open-workout', { detail: w.id }));
  return w;
}

export function deleteRoutine(id) {
  store.setSetting('routines', getRoutines().filter((r) => r.id !== id));
}

/** Rows of routines with Start (and, in Settings, Delete) buttons. */
export function routineRows({ date, withDelete = false } = {}) {
  const list = getRoutines();
  if (!list.length) return '';
  return `<ul class="rt-list">${list.map((r) => {
    const n = r.exercises?.length || 0;
    return `<li class="rt-row">
      <span class="rt-txt"><b>${esc(r.name)}</b><small class="muted">${t('rt.exercises', { n })}</small></span>
      <button type="button" class="btn tiny secondary" data-action="routine-start" data-rt="${esc(r.id)}" ${date ? `data-date="${esc(date)}"` : ''}>${svg('play')} ${t('rt.start')}</button>
      ${withDelete ? `<button type="button" class="icon-btn tiny danger" data-action="routine-delete" data-rt="${esc(r.id)}" aria-label="${esc(t('rt.delete', { name: r.name }))}">${svg('trash')}</button>` : ''}
    </li>`;
  }).join('')}</ul>`;
}
