// checkin.js — the optional gym check-in. Off unless the athlete turns it on.
//
// When it's on, finishing a gym session asks the phone where it is and
// compares that with the gym the athlete saved. The only thing stored with
// the session (and synced) is a yes: `gymCheckin: true`. The saved gym's
// position stays on this device (localStorage) and the current position is
// never kept or sent anywhere. It's a badge, not an XP multiplier: a phone
// can be anywhere, so the check-in is a courtesy signal, not proof.

import * as store from './store.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { toast } from './effects.js';
import { svg } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { distanceM } from '../core/geo.js';

const SPOT_KEY = 'moske-gym-spot';
const NEAR_M = 300; // within this many metres of the saved gym counts as "at the gym"

export const checkinOn = () => store.getSettings().gymCheckin === true;

function readSpot() {
  try { const s = JSON.parse(localStorage.getItem(SPOT_KEY)); return Number.isFinite(s?.lat) && Number.isFinite(s?.lng) ? s : null; } catch { return null; }
}
const writeSpot = (s) => { try { if (s) localStorage.setItem(SPOT_KEY, JSON.stringify(s)); else localStorage.removeItem(SPOT_KEY); } catch { /* private mode */ } };
export const hasSpot = () => !!readSpot();

function here(timeout = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout, maximumAge: 120000 },
    );
  });
}

/** At the saved gym right now? true / false, or null when it can't tell. */
export async function atGym() {
  const spot = readSpot();
  if (!checkinOn() || !spot) return null;
  const p = await here();
  return p ? distanceM(p, spot) <= NEAR_M : null;
}

async function saveSpot() {
  const p = await here(12000);
  if (!p) { toast(t('checkin.noLocation'), { icon: svg('warn') }); return false; }
  // about 10 m of precision is plenty for "is this my gym"; it never leaves the phone
  writeSpot({ lat: Math.round(p.lat * 1e4) / 1e4, lng: Math.round(p.lng * 1e4) / 1e4 });
  return true;
}

/** The sheet that explains it, at the point of asking, and turns it on or off. */
export function openCheckinSheet({ onChange } = {}) {
  const root = openLayer('checkin');
  const draw = () => {
    const on = checkinOn();
    root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
      <div class="modal pk-modal pk-small" role="dialog" aria-modal="true" aria-labelledby="ci-title">
        ${sheetHead({ icon: 'pin', title: t('checkin.title'), id: 'ci-title' })}
        <div class="modal-body ci-body">
          <p>${t('checkin.what')}</p>
          <ul class="ci-points">
            <li>${t('checkin.p1')}</li>
            <li>${t('checkin.p2')}</li>
            <li>${t('checkin.p3')}</li>
          </ul>
          ${on
    ? `<p class="muted small">${hasSpot() ? t('checkin.onSaved') : t('checkin.onNoSpot')}</p>
             <button class="btn primary block" data-ci="save">${svg('pin')} ${t('checkin.saveHere')}</button>
             <button class="btn ghost block" data-ci="off">${t('checkin.turnOff')}</button>`
    : `<button class="btn primary block" data-ci="on">${svg('pin')} ${t('checkin.turnOn')}</button>
             <button class="btn ghost block" data-layer-close>${t('checkin.notNow')}</button>`}
        </div>
      </div>`;
  };
  root.onclick = async (e) => {
    const act = e.target.closest('[data-ci]')?.dataset.ci;
    if (!act) return;
    if (act === 'on' || act === 'save') {
      if (await saveSpot()) {
        store.setSetting('gymCheckin', true);
        toast(t('checkin.saved'), { icon: svg('pin') });
        closeLayer(root);
        onChange?.();
      }
    } else if (act === 'off') {
      store.setSetting('gymCheckin', false);
      writeSpot(null);
      closeLayer(root);
      onChange?.();
    }
  };
  draw();
}
