// gym-routines.js — saved routines: listing them, starting one as a new gym
// session, deleting one. Routines live in settings.routines (see
// js/core/gym-edit.js), so they sync with the rest of the settings.

import * as store from './store.js';
import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { workoutFromRoutine } from '../core/gym-edit.js';

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
      <span class="rt-txt"><b>${esc(r.name)}</b><small class="muted">${n} exercise${n === 1 ? '' : 's'}</small></span>
      <button type="button" class="btn tiny secondary" data-action="routine-start" data-rt="${esc(r.id)}" ${date ? `data-date="${esc(date)}"` : ''}>${svg('play')} Start</button>
      ${withDelete ? `<button type="button" class="icon-btn tiny danger" data-action="routine-delete" data-rt="${esc(r.id)}" aria-label="${esc(`Delete routine ${r.name}`)}">${svg('trash')}</button>` : ''}
    </li>`;
  }).join('')}</ul>`;
}
