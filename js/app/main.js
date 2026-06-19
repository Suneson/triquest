// main.js — bootstrap, derived state, rendering orchestration and event wiring.

import * as store from './store.js';
import { computeStats } from '../core/scoring.js';
import { computeStreaks } from '../core/streaks.js';
import { evaluateBadges, BADGES } from '../core/badges.js';
import { PLAN_START } from '../core/plan.js';
import { addDays, diffDays } from '../core/dates.js';
import {
  renderHud, renderHome, renderProgress, eventBanner, mondayOf, esc,
} from './ui.js';
import { leaderboardShell, loadLeaderboard } from './leaderboard.js';
import { shopShell, loadShop } from './shop.js';
import { generateAIWorkoutPlan, stravaSummary } from './ai.js';
import { openPublicProfile } from './profile.js';
import { openEditor } from './editor.js';
import { confetti, playLevelUp, playBadge, toast, prefersReducedMotion } from './effects.js';
import { SYNC_ENABLED, STRAVA_ENABLED } from './config.js';
import * as auth from './auth.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

const appState = {
  tab: 'home',
  lbView: 'season',
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
    settings: store.getSettings(),
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
  document.getElementById('race-banner').innerHTML = eventBanner(ctx);
  renderSyncBanner();

  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === appState.tab));

  const view = document.getElementById('view');
  if (appState.tab === 'leaderboards') {
    view.innerHTML = leaderboardShell(appState.lbView, ctx.today);
    loadLeaderboard(appState.lbView, ctx.today);
  } else if (appState.tab === 'shop') {
    view.innerHTML = shopShell();
    loadShop();
  } else if (appState.tab === 'progress') {
    view.innerHTML = renderProgress(ctx);
  } else {
    view.innerHTML = renderHome(ctx, appState.weekStart);
  }

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
      localStorage.setItem('moske-tab', appState.tab);
      render();
      window.scrollTo(0, 0); // consistent across all tabs (incl. async-loaded ones)
      break;
    case 'lb-toggle': appState.lbView = el.dataset.view; render(); break;
    case 'open-profile': openPublicProfile({ uid: el.dataset.uid, name: el.dataset.name, rank: el.dataset.rank, xp: el.dataset.xp }); break;
    case 'edit-goals': openGoalEditor(); break;
    case 'ai-wizard': openAIWizard(); break;
    case 'clear-future': {
      if (!confirm('Clear all future AI/custom workouts from today onward?')) break;
      const t = todayISO();
      store.getWorkouts().filter((w) => w.source === 'custom' && w.date >= t).forEach((w) => store.deleteWorkout(w.id));
      toast('Future workouts cleared');
      break;
    }
    case 'shop-open': window.open(el.dataset.url, '_blank', 'noopener,noreferrer'); break;
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
  } else if (action === 'actual-field') {
    const w = store.workoutById(id);
    w.actual = w.actual || {};
    const v = el.value.trim();
    w.actual[el.dataset.field] = v === '' ? null : Number(v);
    store.touchWorkout(id); // stamps updated_at + persists/syncs (no re-render)
  }
}

function onSubmit(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();

  if (el.dataset.action === 'log-metric') {
    const date = el.dataset.date;
    const entry = { date };
    let any = false;
    ['weight', 'rhr', 'sleep'].forEach((k) => {
      const v = el.elements[k].value.trim();
      if (v !== '') { entry[k] = Number(v); any = true; }
    });
    if (!any) return;
    const log = (store.getSettings().bodyMetrics || []).filter((m) => m.date !== date);
    log.push({ ...((store.getSettings().bodyMetrics || []).find((m) => m.date === date) || {}), ...entry });
    store.setSetting('bodyMetrics', log);
    toast('Logged today’s metrics 📈');
    return;
  }

  const input = el.querySelector('input[type="text"]');
  const val = input ? input.value.trim() : '';
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
          <button class="btn ghost" data-set-do="export-ics">📅 Calendar (.ics)</button>
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
    else if (act === 'export-ics') doExportICS();
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

function doExportICS() {
  import('../core/calendar.js').then(({ toICS }) => {
    const blob = new Blob([toICS(store.getWorkouts())], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moske-training.ics';
    a.click();
    URL.revokeObjectURL(url);
    toast('Calendar exported 📅');
  });
}

function openGoalEditor() {
  const g = store.getSettings().goals || { sessions: 5, km: 50, hours: 8 };
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop" data-goal-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Edit weekly goals">
      <header class="modal-head"><h2>🎯 Weekly goals</h2><button class="icon-btn" data-goal-close aria-label="Close">✕</button></header>
      <div class="modal-body">
        <form data-goal-form>
          <label class="field"><span>Planned sessions</span><input type="number" name="sessions" min="0" step="1" value="${g.sessions}" required></label>
          <label class="field"><span>Distance / volume (km)</span><input type="number" name="km" min="0" step="1" value="${g.km}" required></label>
          <label class="field"><span>Training hours</span><input type="number" name="hours" min="0" step="0.5" value="${g.hours}" required></label>
          <button class="btn primary" type="submit">Save goals</button>
        </form>
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };
  root.querySelectorAll('[data-goal-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelector('[data-goal-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    store.setSetting('goals', {
      sessions: Math.max(0, Math.round(+e.target.sessions.value) || 0),
      km: Math.max(0, +e.target.km.value || 0),
      hours: Math.max(0, +e.target.hours.value || 0),
    });
    close(); render(); toast('Goals updated 🎯');
  });
}

function openAIWizard() {
  if (!auth.currentUser()) { auth.openAuthModal(); return; }
  const SPORTS = ['Gym', 'Cycling', 'Running', 'Swimming', 'Pilates', 'Hiking', 'Custom'];
  const state = { sports: [], days: 4, maxDoubles: 0, events: [{ title: '', date: '' }] };
  let page = 0;
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };
  const draw = () => {
    let bodyHtml = '';
    if (page === 0) {
      bodyHtml = `<h3>Which sports?</h3>${SPORTS.map((s) => `<label class="toggle"><span>${s}</span><input type="checkbox" data-sport="${s}" ${state.sports.includes(s) ? 'checked' : ''}></label>`).join('')}`;
    } else if (page === 1) {
      bodyHtml = `<h3>How many days a week?</h3>
        <label class="field"><span><b id="dn">${state.days}</b> days / week</span><input type="range" min="1" max="7" value="${state.days}" data-days></label>
        <label class="field"><span>Max double-training days per week: <b id="ddn">${state.maxDoubles}</b></span><input type="range" min="0" max="5" value="${state.maxDoubles}" data-doubles></label>`;
    } else {
      bodyHtml = `<h3>Upcoming events</h3>${state.events.map((e, i) => `<div class="row"><input class="grow" type="text" placeholder="Title" value="${esc(e.title)}" data-ev="${i}" data-f="title"><input type="date" value="${esc(e.date)}" data-ev="${i}" data-f="date"></div>`).join('')}<button class="btn tiny ghost" data-add-ev>+ Add more</button>`;
    }
    root.innerHTML = `<div class="modal-backdrop" data-wz-close></div>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Custom plan">
        <header class="modal-head"><h2>✨ Custom plan · ${page + 1}/3</h2><button class="icon-btn" data-wz-close aria-label="Close">✕</button></header>
        <div class="modal-body">${bodyHtml}<p class="auth-msg" role="status" hidden></p></div>
        <footer class="modal-foot">${page > 0 ? '<button class="btn ghost" data-wz-back>Back</button>' : ''}<span class="spacer"></span><button class="btn primary" data-wz-next>${page < 2 ? 'Next' : 'Generate ✨'}</button></footer>
      </div>`;
    root.querySelectorAll('[data-wz-close]').forEach((b) => b.addEventListener('click', close));
    root.querySelectorAll('[data-sport]').forEach((c) => c.addEventListener('change', () => {
      if (c.checked) state.sports.push(c.dataset.sport); else state.sports = state.sports.filter((x) => x !== c.dataset.sport);
    }));
    const rng = root.querySelector('[data-days]');
    if (rng) rng.addEventListener('input', () => { state.days = +rng.value; root.querySelector('#dn').textContent = rng.value; });
    const dbl = root.querySelector('[data-doubles]');
    if (dbl) dbl.addEventListener('input', () => { state.maxDoubles = +dbl.value; root.querySelector('#ddn').textContent = dbl.value; });
    root.querySelectorAll('[data-ev]').forEach((i) => i.addEventListener('input', () => { state.events[+i.dataset.ev][i.dataset.f] = i.value; }));
    root.querySelector('[data-add-ev]')?.addEventListener('click', () => { state.events.push({ title: '', date: '' }); draw(); });
    root.querySelector('[data-wz-back]')?.addEventListener('click', () => { page -= 1; draw(); });
    root.querySelector('[data-wz-next]').addEventListener('click', async (e) => {
      if (page < 2) { page += 1; draw(); return; }
      const btn = e.target; const msg = root.querySelector('.auth-msg');
      btn.disabled = true; btn.textContent = 'Generating…';
      try {
        const events = state.events.filter((ev) => ev.title && ev.date);
        store.setSetting('events', events); // power the dynamic Home "next event" banner
        const r = await generateAIWorkoutPlan({ sports: state.sports, daysPerWeek: state.days, max_double_days: state.maxDoubles, events }, stravaSummary(store.getWorkouts()));
        close();
        toast(`Added ${r.inserted} AI sessions to your calendar ✨`, { icon: '✨' });
        setTimeout(() => store.commit(), 1500); // realtime brings the new rows in
      } catch (err) { msg.hidden = false; msg.textContent = err.message; btn.disabled = false; btn.textContent = 'Generate ✨'; }
    });
  };
  draw();
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
  // NOTE: do NOT strip a #access_token / ?code here — the Supabase client
  // (detectSessionInUrl) needs to consume it first; it cleans the URL itself.
}

// ---- onboarding -------------------------------------------------------------

function maybeOnboard() {
  if (localStorage.getItem('moske-onboarded')) return;
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const cards = [
    { icon: '🛰️', t: 'Verified by Strava', b: 'Sessions complete automatically when a matching Strava activity is verified — earn XP, climb the leaderboard, keep your streak.' },
    { icon: '➕', t: 'Make it yours', b: 'Hit the + button to add a custom session for any day, with intervals, exercises and a packing list.' },
    { icon: '📲', t: 'Add to Home Screen', b: 'Install MOSKE for a fullscreen, offline app at the gym. Sign in to sync across devices.' },
  ];
  let i = 0;
  const draw = () => {
    const c = cards[i];
    root.innerHTML = `<div class="modal-backdrop"></div>
      <div class="modal onboard" role="dialog" aria-modal="true" aria-label="Welcome to MOSKE">
        <div class="modal-body onboard-body">
          <div class="onboard-icon">${c.icon}</div>
          <h2>${c.t}</h2><p class="muted">${c.b}</p>
          <div class="onboard-dots">${cards.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <footer class="modal-foot"><button class="btn ghost" data-ob="skip">Skip</button><span class="spacer"></span>
          <button class="btn primary" data-ob="next">${i === cards.length - 1 ? 'Start training' : 'Next'}</button></footer>
      </div>`;
    const done = () => { localStorage.setItem('moske-onboarded', '1'); root.innerHTML = ''; root.classList.remove('open'); };
    root.querySelector('[data-ob="skip"]').addEventListener('click', done);
    root.querySelector('[data-ob="next"]').addEventListener('click', () => { if (i === cards.length - 1) done(); else { i++; draw(); } });
  };
  draw();
}

// ---- boot -------------------------------------------------------------------

async function boot() {
  await store.init();
  const today = todayISO();
  // Home always opens on the current week (Mon–Sun); arrows navigate from there.
  appState.weekStart = mondayOf(today);
  // Restore last tab.
  const savedTab = localStorage.getItem('moske-tab');
  if (['home', 'leaderboards', 'shop', 'progress'].includes(savedTab)) appState.tab = savedTab;

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

  // Auto-focus the next (first incomplete) session when opening on Home.
  if (appState.tab === 'home') {
    requestAnimationFrame(() => document.querySelector('#view .card.is-next')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  maybeOnboard();
  handleRedirectParams();
  if (SYNC_ENABLED) auth.initAuth(onAuthChange);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

boot();
