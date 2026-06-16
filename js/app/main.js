// main.js — bootstrap, derived state, rendering orchestration and event wiring.

import * as store from './store.js';
import { computeStats } from '../core/scoring.js';
import { computeStreaks } from '../core/streaks.js';
import { evaluateBadges, BADGES } from '../core/badges.js';
import { PLAN_START } from '../core/plan.js';
import { addDays, diffDays } from '../core/dates.js';
import {
  renderHud, renderToday, renderWeek, renderProgress, raceBanner, mondayOf, esc,
} from './ui.js';
import { openEditor } from './editor.js';
import { confetti, playComplete, playLevelUp, playBadge, toast, prefersReducedMotion } from './effects.js';
import { SYNC_ENABLED, STRAVA_ENABLED } from './config.js';
import * as auth from './auth.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

const appState = {
  tab: 'today',
  weekStart: null,
  lastLevel: null,
  booted: false,
};

let deferredInstall = null;

// ---- derived context --------------------------------------------------------

function buildCtx() {
  const today = todayISO();
  const workouts = store.getWorkouts();
  return {
    today,
    workouts,
    stats: computeStats(workouts),
    streaks: computeStreaks(workouts, today),
    units: store.getSettings().units,
    unlockedBadges: store.getState().unlockedBadges,
  };
}

// ---- badge + level sync (runs inside render, never emits) -------------------

function syncProgress(ctx) {
  const earned = evaluateBadges(ctx.workouts, ctx.today);
  const union = [...new Set([...ctx.unlockedBadges, ...earned])];
  const fresh = union.filter((id) => !ctx.unlockedBadges.includes(id));
  if (fresh.length) {
    store.setUnlockedBadges(union);
    ctx.unlockedBadges = union;
    if (appState.booted) {
      fresh.forEach((id, i) => {
        const b = BADGES.find((x) => x.id === id);
        if (b) setTimeout(() => { toast(`<b>Badge unlocked!</b><br>${b.name} — ${b.desc}`, { icon: b.icon }); playBadge(); }, 400 + i * 600);
      });
    }
  }

  if (appState.lastLevel != null && ctx.stats.level > appState.lastLevel && appState.booted) {
    setTimeout(() => {
      toast(`<b>Level up!</b><br>You reached level ${ctx.stats.level} 🎉`, { icon: '⭐' });
      playLevelUp();
      if (!prefersReducedMotion()) confetti(window.innerWidth / 2, 120, 140);
    }, 200);
  }
  appState.lastLevel = ctx.stats.level;
}

// ---- render -----------------------------------------------------------------

function render() {
  const ctx = buildCtx();
  syncProgress(ctx);

  document.getElementById('hud').innerHTML = renderHud(ctx.stats, ctx.streaks, ctx.units);
  document.getElementById('race-banner').innerHTML = raceBanner(ctx.today);
  renderSyncBanner();

  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === appState.tab));

  const view = document.getElementById('view');
  if (appState.tab === 'today') view.innerHTML = renderToday(ctx);
  else if (appState.tab === 'week') view.innerHTML = renderWeek(ctx, appState.weekStart);
  else view.innerHTML = renderProgress(ctx);

  document.getElementById('storage-banner').hidden = store.isPersistent();
}

// ---- event handlers ---------------------------------------------------------

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  switch (action) {
    case 'tab':
      appState.tab = el.dataset.tab;
      render();
      break;
    case 'toggle-complete': {
      const w = store.workoutById(id);
      const willComplete = !w.completed;
      store.toggleComplete(id, willComplete); // triggers render
      if (willComplete) {
        const r = el.getBoundingClientRect();
        confetti(r.left + r.width / 2, r.top + r.height / 2, 70);
        playComplete();
      }
      break;
    }
    case 'edit': openEditor(id); break;
    case 'duplicate': store.duplicateWorkout(id); toast('Session duplicated'); break;
    case 'delete':
      if (confirm('Delete this session?')) { store.deleteWorkout(id); toast('Session deleted'); }
      break;
    case 'open-editor-new': openEditor(null, el.dataset.date); break;
    case 'prev-week': appState.weekStart = addDays(appState.weekStart, -7); render(); break;
    case 'next-week': appState.weekStart = addDays(appState.weekStart, 7); render(); break;
    case 'remove-pack': {
      const w = store.workoutById(id);
      w.packing.splice(+el.dataset.pi, 1);
      store.commit();
      break;
    }
    case 'open-settings': openSettings(); break;
    case 'open-auth': auth.openAuthModal(); break;
    case 'dismiss-sync': sessionStorage.setItem('tq-sync-dismissed', '1'); render(); break;
    default: break;
  }
}

function onChange(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  if (action === 'toggle-exercise') {
    const w = store.workoutById(id);
    w.exercises[+el.dataset.ex].done = el.checked;
    store.commit();
  } else if (action === 'toggle-pack') {
    const w = store.workoutById(id);
    w.packing[+el.dataset.pi].checked = el.checked;
    store.commit();
  } else if (action === 'toggle-tomorrow-pack') {
    // Toggle all underlying packing items matching this aggregated item.
    const item = el.dataset.item;
    const tomorrow = addDays(todayISO(), 1);
    store.getWorkouts().filter((w) => w.date === tomorrow).forEach((w) =>
      (w.packing || []).forEach((p) => { if (p.item === item) p.checked = el.checked; }));
    store.commit();
  }
}

function onInput(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  // Text fields save silently (no re-render) so focus/caret survive.
  if (action === 'notes') {
    const w = store.workoutById(id);
    w.notes = el.value;
    store.save();
  } else if (action === 'exercise-field') {
    const w = store.workoutById(id);
    w.exercises[+el.dataset.ex][el.dataset.field] = el.value;
    store.save();
  }
}

function onSubmit(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  const input = el.querySelector('input[type="text"]');
  const val = input.value.trim();
  if (!val) return;

  if (el.dataset.action === 'pack-add') {
    const w = store.workoutById(el.dataset.id);
    w.packing.push({ item: val, checked: false });
    store.commit();
  } else if (el.dataset.action === 'tomorrow-pack-add') {
    const tomorrow = el.dataset.date;
    let target = store.getWorkouts().find((w) => w.date === tomorrow);
    if (!target) { toast('No session tomorrow to attach the item to.'); return; }
    target.packing.push({ item: val, checked: false });
    store.commit();
  }
}

// ---- settings modal ---------------------------------------------------------

function openSettings() {
  const s = store.getSettings();
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop" data-set-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Settings">
      <header class="modal-head"><h2>⚙️ Settings</h2><button class="icon-btn" data-set-close aria-label="Close">✕</button></header>
      <div class="modal-body">
        ${accountSectionHtml()}
        <label class="toggle"><span>🔊 Sound effects</span><input type="checkbox" data-set="sound" ${s.sound ? 'checked' : ''}></label>
        <label class="toggle"><span>🌀 Reduce motion</span><input type="checkbox" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''}></label>
        <label class="field"><span>Units</span><select data-set="units"><option value="metric" ${s.units === 'metric' ? 'selected' : ''}>Metric (km)</option><option value="imperial" ${s.units === 'imperial' ? 'selected' : ''}>Imperial (mi)</option></select></label>
        <label class="field"><span>Week starts on</span><select data-set="weekStart"><option value="1" ${s.weekStart === 1 ? 'selected' : ''}>Monday</option><option value="0" ${s.weekStart === 0 ? 'selected' : ''}>Sunday</option></select></label>

        <hr>
        <h3>Backup</h3>
        <p class="muted small">${auth.currentUser()
          ? 'Signed in — your data syncs across devices automatically. Export/import still works for an extra offline backup.'
          : 'Data is stored <b>per-device in this browser</b> (localStorage). It does <b>not</b> sync between your phone and laptop — sign in above, or use export/import to move it.'}</p>
        <div class="row">
          <button class="btn ghost" data-set-do="export">⬇ Export JSON</button>
          <button class="btn ghost" data-set-do="import">⬆ Import JSON</button>
        </div>
        <input type="file" id="import-file" accept="application/json" hidden>

        ${deferredInstall ? '<hr><button class="btn primary" data-set-do="install">📲 Install app</button>' : ''}

        <hr>
        <h3>Danger zone</h3>
        <button class="btn ghost danger" data-set-do="reseed">↻ Reset &amp; reseed plan</button>
      </div>
      <footer class="modal-foot"><span class="spacer"></span><button class="btn primary" data-set-close>Done</button></footer>
    </div>`;

  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };
  root.querySelectorAll('[data-set-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('change', () => {
    const key = el.dataset.set;
    let val = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'weekStart') val = Number(val);
    store.setSetting(key, val);
  }));
  root.querySelectorAll('[data-set-do]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.setDo;
    if (act === 'export') doExport();
    else if (act === 'import') root.querySelector('#import-file').click();
    else if (act === 'reseed') { if (confirm('Reset everything and reload the original plan? Your logged progress will be lost.')) { doExport(); store.reseed(); appState.lastLevel = null; close(); toast('Backup exported, plan reseeded'); } }
    else if (act === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; close(); }
    else if (act === 'signin') { close(); auth.openAuthModal(); }
    else if (act === 'signout') { if (confirm('Sign out? Your data stays in the cloud and on this device.')) { auth.signOut(); close(); } }
    else if (act === 'strava-connect') { import('./strava-client.js').then((m) => m.connectStrava().catch((e) => toast(e.message || 'Strava connect failed'))); }
    else if (act === 'strava-disconnect') { import('./strava-client.js').then((m) => m.disconnectStrava().then(() => { toast('Strava disconnected'); openSettings(); })); }
    else if (act === 'strava-sync') { toast('Syncing from Strava…'); import('./strava-client.js').then((m) => m.syncNow().then((r) => { store.commit(); toast(`Strava sync: ${r.link || 0} linked, ${r.insert || 0} added`); }).catch((e) => toast(e.message || 'Sync failed'))); }
  }));
  root.querySelector('#import-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { store.importData(reader.result); appState.lastLevel = null; close(); toast('Data imported ✅'); }
      catch { toast('Import failed — invalid file.'); }
    };
    reader.readAsText(file);
  });
}

function doExport() {
  const blob = new Blob([store.exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moske-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exported ⬇');
}

// ---- account / sync UI ------------------------------------------------------

function accountSectionHtml() {
  if (!SYNC_ENABLED) return '';
  const u = auth.currentUser();
  const acct = u
    ? `<div class="signed-in"><div><b>☁️ Signed in</b><br><span class="muted small">${esc(u.email || 'your account')}</span></div>
         <button class="btn ghost" data-set-do="signout">Sign out</button></div>`
    : `<button class="btn primary block" data-set-do="signin">☁️ Sign in to sync across devices</button>`;
  const strava = (u && STRAVA_ENABLED)
    ? `<div class="strava-block">
         <div class="row">
           <button class="btn ghost" data-set-do="strava-connect">🔗 Connect Strava</button>
           <button class="btn ghost" data-set-do="strava-sync">↻ Sync now</button>
           <button class="btn ghost danger" data-set-do="strava-disconnect">Disconnect</button>
         </div>
         <div class="powered-by-strava">Powered by Strava</div>
       </div>`
    : '';
  return `<h3>Account</h3>${acct}${strava}<hr>`;
}

function renderSyncBanner() {
  const el = document.getElementById('sync-banner');
  if (!el) return;
  if (SYNC_ENABLED && !auth.currentUser() && !sessionStorage.getItem('tq-sync-dismissed')) {
    el.innerHTML = `<div class="sync-prompt">☁️ <span>Sign in to sync across your phone &amp; laptop.</span>
      <button class="link" data-action="open-auth">Sign in</button>
      <button class="icon-btn tiny" data-action="dismiss-sync" aria-label="Dismiss">✕</button></div>`;
  } else {
    el.innerHTML = '';
  }
}

function onAuthChange(user, opts = {}) {
  if (!opts.remote) appState.lastLevel = null; // don't fire a level-up toast on data swap
  render();
  const root = document.getElementById('modal-root');
  if (root && root.querySelector('[aria-label="Settings"]')) openSettings();
}

function handleRedirectParams() {
  const url = new URL(location.href);
  const strava = url.searchParams.get('strava');
  if (strava) {
    const msg = { connected: 'Strava connected ✅', denied: 'Strava connection cancelled',
      error: 'Strava connection failed', auth_failed: 'Connect failed — sign in first' }[strava];
    if (msg) setTimeout(() => toast(msg), 600);
    url.searchParams.delete('strava');
    history.replaceState({}, '', url.pathname + url.search);
    if (strava === 'connected') {
      setTimeout(() => import('./strava-client.js').then((m) => m.syncNow().then(() => store.commit()).catch(() => {})), 1200);
    }
  }
  if (location.hash.includes('access_token')) history.replaceState({}, '', location.pathname + location.search);
}

// ---- boot -------------------------------------------------------------------

async function boot() {
  await store.init();
  const today = todayISO();
  // Start the Week view on the plan's first week if we're not in the plan yet.
  appState.weekStart = diffDays(today, PLAN_START) < 0 ? mondayOf(PLAN_START) : mondayOf(today);

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('submit', onSubmit);
  document.getElementById('fab').addEventListener('click', () => openEditor(null, todayISO()));
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

  store.subscribe(render);
  render();
  appState.booted = true;

  handleRedirectParams();
  if (SYNC_ENABLED) auth.initAuth(onAuthChange);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

boot();
