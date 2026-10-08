// main.js — bootstrap, derived state, rendering orchestration and event wiring.

import * as store from './store.js';
import { computeStats, sportProgress, xpForWorkout } from '../core/scoring.js';
import { computeStreaks } from '../core/streaks.js';
import { evaluateBadges, BADGES } from '../core/badges.js';
import { questsFor, accountProgress, msUntilReset, formatCountdown } from '../core/quests.js';
import { sceneFor, COACH } from '../core/scenes.js';
import { MOMENT_LINES } from '../core/coach-lines.js';
import { PLAN_START } from '../core/plan.js';
import { addDays, diffDays, todayISO } from '../core/dates.js';
import {
  renderHome, renderJournal, eventBanner, renderWorkoutDetail, esc,
  sportLevelCarousel, stillCorners, dialogue, coachMini,
} from './ui.js';
import { leaderboardShell, loadLeaderboard, athleteByUid } from './leaderboard.js';
import { shopShell, loadShop } from './shop.js';
import { openPublicProfile } from './profile.js';
import { renderProfileGame, openFitnessHub, openPublicFitness } from './profile-game.js';
import { openOnboarding } from './onboarding.js';
import { svg } from '../core/icons.js';
import { openEditor } from './editor.js';
import { confetti, playLevelUp, playBadge, playQuest, playComplete, toast, xpPop, typeLines, prefersReducedMotion } from './effects.js';
import { SYNC_ENABLED, STRAVA_ENABLED } from './config.js';
import * as auth from './auth.js';
import { syncQuestClaims } from './quest-sync.js';
import { withTabTransition, rollNum, animateIn, busy } from './motion.js';
import { openSeasonPath } from './game.js';


// ?safe=34 fakes a bottom safe-area inset (home indicator) so the tab bar can be
// checked in a desktop browser or headless screenshots.
{
  const fake = Number(new URLSearchParams(location.search).get('safe'));
  if (Number.isFinite(fake) && fake > 0) document.documentElement.style.setProperty('--safe-b', `${Math.min(80, fake)}px`);
}

const appState = {
  tab: 'home',
  lbView: 'season',
  journalDate: null, // ISO date selected in the Journal strip (null = today)
  pgSport: 'bike',   // which sport the Profile scene shows
  lastLevel: null,
  booted: false,
  // previous-render snapshots for feedback moments (null until first render)
  seen: null,
};

let deferredInstall = null;

// ---- derived context --------------------------------------------------------

function buildCtx() {
  const today = todayISO();
  const workouts = store.getWorkouts();
  const settings = store.getSettings();
  return {
    today,
    workouts,
    stats: computeStats(workouts),
    streaks: computeStreaks(workouts, today),
    units: settings.units,
    settings,
    unlockedBadges: store.getState().unlockedBadges,
    quests: questsFor(today, workouts, settings),
    acct: accountProgress(workouts, settings, today),
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
        if (b) setTimeout(() => { toast(`<b>Badge unlocked</b><br>${esc(b.name)}: ${esc(b.desc)}`, { icon: svg(b.icon) }); playBadge(); }, 400 + i * 600);
      });
    }
  }

  if (appState.lastLevel != null && ctx.acct.level > appState.lastLevel && appState.booted) {
    setTimeout(() => {
      toast(`<b>Account level ${ctx.acct.level}</b><br>${esc(MOMENT_LINES.accountLevel(ctx.acct.level))}`, { icon: svg('star') });
      playLevelUp();
      if (!prefersReducedMotion()) confetti(window.innerWidth / 2, 120, 140);
    }, 200);
  }
  appState.lastLevel = ctx.acct.level;
  feedbackMoments(ctx);
  syncQuestClaims(); // throttled; sends completed quests so they count in Ranks
}

// ---- feedback moments ----------------------------------------------------------
// Compares this render with the last one: newly verified sessions pop their
// XP, newly completed quests get a toast, and a sport level-up swaps that
// sport's scene with a level-up sheet. Nothing fires on the first render or
// when the whole data set was swapped (sign-in / import).

const SPORTS = ['bike', 'run', 'swim', 'gym'];
const isVerifiedW = (w) => w.completed && (w.strava_activity_id || w.source === 'strava');

function snapshot(ctx) {
  return {
    verified: new Set(ctx.workouts.filter(isVerifiedW).map((w) => w.id)),
    quests: new Set(ctx.quests.filter((q) => q.done).map((q) => q.id)),
    questDay: ctx.today,
    levels: Object.fromEntries(SPORTS.map((s) => [s, sportProgress(ctx.workouts, s).level])),
  };
}

function feedbackMoments(ctx) {
  const now = snapshot(ctx);
  const prev = appState.seen;
  appState.seen = now;
  ctx.freshQuests = new Set();
  if (!prev || !appState.booted) return;

  // verified completions: "+XP" rises from the session (or the screen centre)
  const fresh = ctx.workouts.filter((w) => now.verified.has(w.id) && !prev.verified.has(w.id));
  fresh.slice(0, 3).forEach((w, i) => setTimeout(() => {
    const el = document.querySelector(`[data-id="${CSS.escape(w.id)}"]`);
    const r = el?.getBoundingClientRect();
    xpPop(`+${xpForWorkout(w)} XP`, r ? r.left + r.width / 2 : window.innerWidth / 2, r ? r.top + 12 : window.innerHeight / 3);
    playComplete();
  }, 300 + i * 500));

  // quests completed since the last render (same day only)
  if (prev.questDay === now.questDay) {
    const done = ctx.quests.filter((q) => q.done && !prev.quests.has(q.id));
    done.forEach((q) => ctx.freshQuests.add(q.id));
    if (done.length) {
      // several at once (one Strava sync can clear a few) → one toast, not a pile
      const xp = done.reduce((a, q) => a + q.xp, 0);
      const head = done.length === 1 ? `Quest complete +${xp} XP` : `${done.length} quests complete +${xp} XP`;
      setTimeout(() => {
        toast(`<b>${head}</b><br>${done.map((q) => esc(q.text)).join('<br>')}`, { icon: coachMini(), duration: 5200 });
        playQuest();
      }, 700);
    }
  }

  // sport level-ups: show the new scene
  const up = SPORTS.find((s) => now.levels[s] > prev.levels[s]);
  if (up) setTimeout(() => openLevelUp(up, now.levels[up]), 1200);
}

// ---- render -----------------------------------------------------------------

function render() {
  const ctx = buildCtx();
  syncProgress(ctx);
  document.body.classList.toggle('rm', prefersReducedMotion());

  document.getElementById('race-banner').innerHTML = eventBanner(ctx);
  renderSyncBanner();

  // Header avatar: uploaded photo if set, otherwise the athlete's initial.
  const u = auth.currentUser?.();
  const name = (u?.user_metadata?.display_name || u?.email || 'A').trim();
  const avatarEl = document.getElementById('header-avatar');
  if (avatarEl) {
    avatarEl.innerHTML = ctx.settings?.avatar
      ? `<img src="${esc(ctx.settings.avatar)}" alt="">`
      : (name[0] || 'A').toUpperCase();
  }

  const chip = document.getElementById('acct-chip');
  if (chip) {
    chip.hidden = false;
    chip.innerHTML = `LVL ${rollNum(ctx.acct.level, 'acct-lvl')}`;
    chip.setAttribute('aria-label', `Account level ${ctx.acct.level}, ${ctx.acct.toNext} XP to the next level`);
  }

  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === appState.tab;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });

  // Profile tab is a sealed full-screen game viewport: hide app chrome, lock scroll.
  document.body.classList.toggle('pg-mode', appState.tab === 'progress');

  const view = document.getElementById('view');
  if (appState.tab === 'leaderboards') {
    view.innerHTML = leaderboardShell(appState.lbView, ctx.today);
    loadLeaderboard(appState.lbView, ctx.today);
  } else if (appState.tab === 'shop') {
    view.innerHTML = shopShell();
    loadShop();
  } else if (appState.tab === 'progress') {
    view.innerHTML = renderProfileGame(ctx, appState.pgSport);
    startScene(view);
  } else if (appState.tab === 'journal') {
    view.innerHTML = renderJournal(ctx, appState.journalDate || ctx.today);
  } else {
    view.innerHTML = renderHome(ctx);
  }

  document.getElementById('storage-banner').hidden = store.isPersistent();
  animateIn(document);
}

// ---- Profile scene lifecycle --------------------------------------------------
// Scene motion is pure CSS; this only pauses it while the page is hidden.
function startScene(view) {
  const screen = view.querySelector('.pg-screen');
  if (screen) screen.classList.toggle('paused', document.hidden);
}
document.addEventListener('visibilitychange', () => {
  document.querySelector('.pg-screen')?.classList.toggle('paused', document.hidden);
});

// Level-up sheet: the previous level's art wipes away to reveal the new one.
function openLevelUp(sport, level) {
  const before = sceneFor(sport, level - 1);
  const after = sceneFor(sport, level);
  if (!after) return;
  const art = (s) => (s.kind === 'still' ? s.entry.src : s.entry.char);
  const ar = after.kind === 'still' ? `${after.entry.w} / ${after.entry.h}` : '768 / 624';
  const fresh = before && art(before) !== art(after);
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `<div class="modal-backdrop" data-lu-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Level up">
      <header class="modal-head"><h2>${svg('star')} Level up</h2><button class="icon-btn" data-lu-close aria-label="Close">${svg('close')}</button></header>
      <div class="modal-body lvlup">
        <div class="lvlup-art" style="--ar:${ar}">
          <img src="${esc(art(after))}" alt="${esc(after.label)} level ${level}">
          ${fresh ? `<img src="${esc(art(before))}" alt="" class="pg-wipe" style="background:none">` : ''}
          ${after.kind === 'still' ? stillCorners(after.entry) : ''}
        </div>
        <h2>LVL ${level}</h2>
        ${dialogue({ text: `${MOMENT_LINES.sportLevel(after.label, level)}${after.level > after.maxArt ? ' New scenery is on its way.' : ''}`, portrait: COACH.cheer || COACH.portrait, type: true })}
        <button class="btn primary" data-lu-close>Continue</button>
      </div>
    </div>`;
  root.querySelectorAll('[data-lu-close]').forEach((b) => b.addEventListener('click', closeModalRoot));
  typeLines(root);
  playLevelUp();
  if (!prefersReducedMotion()) confetti(window.innerWidth / 2, window.innerHeight / 3, 120);
  if (appState.tab === 'progress') { appState.pgSport = sport; render(); }
}

// Quest reset countdown on Home ticks once a minute (no per-second redraws).
function tickQuestReset() {
  const el = document.querySelector('[data-quest-reset]');
  if (el) el.textContent = `RESETS ${formatCountdown(msUntilReset())}`;
}

// ---- plan clearing ----------------------------------------------------------
// "Prescribed" = work the coach put on the calendar that the athlete has not
// done yet, whatever produced it (the seeded plan, the AI coach, or a manual
// entry). Completed and Strava-verified sessions are history and never cleared,
// so XP, levels, streaks and badges survive any reset.

function prescribedSessions(from = null) {
  return store.getWorkouts().filter((w) =>
    !w.completed && !w.strava_activity_id && (!from || w.date >= from));
}

function clearPrescribed(from, message) {
  const n = store.deleteWorkouts(prescribedSessions(from).map((w) => w.id));
  toast(`${message} · ${n} session${n === 1 ? '' : 's'} removed`, { icon: svg('trash') });
  // Both buttons live in Settings — redraw it so its session counts aren't stale.
  if (document.getElementById('modal-root').querySelector('[data-set-do="ai-plan"]')) openSettings();
  return n;
}

// ---- event handlers ---------------------------------------------------------

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  switch (action) {
    case 'tab': {
      closeModalRoot(); // full-screen overlays (fitness hub) must never trap navigation
      const from = appState.tab;
      appState.tab = el.dataset.tab;
      if (appState.tab === 'journal') appState.journalDate = todayISO(); // list anchors to Today
      localStorage.setItem('moske-tab', appState.tab);
      if (appState.tab === 'progress') autoStravaSync(); // silent background pull
      withTabTransition(from, appState.tab, () => {
        render();
        document.getElementById('view').scrollTo(0, 0); // #view is the scroller now
        // Journal opens on today's row rather than Monday
        if (appState.tab === 'journal') document.querySelector('.jr-row.is-today')?.scrollIntoView({ block: 'start' });
      });
      break;
    }
    case 'jr-week':
      appState.journalDate = addDays(appState.journalDate || todayISO(), Number(el.dataset.dir) * 7);
      render();
      break;
    case 'lb-toggle': appState.lbView = el.dataset.view; render(); break;
    case 'open-profile': openPublicProfile({ uid: el.dataset.uid, name: el.dataset.name, rank: el.dataset.rank, xp: el.dataset.xp }); break;
    case 'view-athlete-profile': {
      const a = athleteByUid(el.dataset.uid);
      openPublicFitness({
        uid: el.dataset.uid,
        name: a?.display_name || el.dataset.name,
        avatar: a?.avatar || null,
        xp: a?.xp ?? el.dataset.xp,
      });
      break;
    }
    case 'open-sport-levels': openSportLevels(el.dataset.sport); break;
    case 'open-lightbox': openLightbox(el.dataset.src, el.dataset.sport); break;
    case 'pg-profile': openFitnessHub(buildCtx()); break;
    case 'ai-onboard': startAIPlan(); break;
    case 'hub-signout':
      if (confirm('Sign out? Your data stays in the cloud and on this device.')) { auth.signOut(); closeModalRoot(); }
      break;
    case 'hub-strava-connect':
      import('./strava-client.js').then((m) => m.connectStrava().catch((e) => toast(e.message || 'Strava connect failed')));
      break;
    case 'hub-strava-sync':
      busy(el, () => import('./strava-client.js').then((m) => m.syncNow())
        .then((r) => { store.commit(); toast(`Strava sync: ${r.link || 0} linked, ${r.insert || 0} added`, { icon: svg('sync') }); })
        .catch((e) => toast(e.message || 'Sync failed')));
      break;
    case 'hub-strava-disconnect':
      import('./strava-client.js').then((m) => m.disconnectStrava()
        .then(() => toast('Strava disconnected')).catch((e) => toast(e.message || 'Disconnect failed')));
      break;
    case 'pg-sport':
      appState.pgSport = el.dataset.sport;
      localStorage.setItem('moske-pg-sport', appState.pgSport);
      render();
      break;
    case 'open-workout': openWorkoutDetail(id); break;
    case 'edit-goals': openGoalEditor(); break;
    case 'open-season': openSeasonPath(buildCtx()); break;
    case 'share-card': { const w = store.workoutById(id); if (w) import('./share.js').then((m) => m.openShareSheet(w, store.getWorkouts())); break; }
    case 'clear-future': {
      const t = todayISO();
      const n = prescribedSessions(t).length;
      if (!n) { toast('Nothing to clear — no upcoming planned sessions.'); break; }
      if (!confirm(`Clear ${n} upcoming planned session${n === 1 ? '' : 's'} from today onward?\n\nCompleted and Strava-verified sessions are kept.`)) break;
      clearPrescribed(t, 'Future workouts cleared');
      break;
    }
    case 'reset-plan': {
      const n = prescribedSessions().length;
      if (!n) { toast('Your plan is already empty — generate a new one below.'); break; }
      if (!confirm(`Reset your training plan?\n\nThis removes all ${n} planned session${n === 1 ? '' : 's'}, past and upcoming. Your completed and Strava-verified history, XP, levels and badges are kept.`)) break;
      clearPrescribed(null, 'Training plan reset. Build a new one with AI training plan');
      break;
    }
    case 'shop-open': window.open(el.dataset.url, '_blank', 'noopener,noreferrer'); break;
    case 'edit': openEditor(id); break;
    case 'duplicate': store.duplicateWorkout(id); toast('Session duplicated'); break;
    case 'delete':
      if (confirm('Delete this session?')) { store.deleteWorkout(id); if (_detailId === id) closeModalRoot(); toast('Session deleted'); }
      break;
    case 'open-editor-new': openEditor(null, el.dataset.date); break;
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

  const togglePacked = (w, item, on) => {
    const set = new Set(w.packed || []);
    if (on) set.add(item); else set.delete(item);
    w.packed = [...set];
    store.touchWorkout(id || w.id);
  };

  if (action === 'toggle-exercise') {
    const w = store.workoutById(id);
    w.exercises[+el.dataset.ex].done = el.checked;
    store.touchWorkout(id);
    refreshDetail(id);
  } else if (action === 'toggle-preset-pack') {
    togglePacked(store.workoutById(id), el.dataset.item, el.checked);
    refreshDetail(id);
  } else if (action === 'toggle-tomorrow-pack') {
    // Apply to every tomorrow session whose sport preset includes this item.
    const item = el.dataset.item;
    store.getWorkouts().filter((w) => w.date === el.dataset.date).forEach((w) => {
      if ((store.getSettings().packing?.[w.type] || []).includes(item)) togglePacked(w, item, el.checked);
    });
    render();
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
    toast('Logged today’s metrics', { icon: svg('check') });
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
  const planned = prescribedSessions().length;
  const upcoming = prescribedSessions(todayISO()).length;
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop" data-set-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Settings">
      <header class="modal-head"><h2>${svg('gear')} Settings</h2><button class="icon-btn" data-set-close aria-label="Close">${svg('close')}</button></header>
      <div class="modal-body">
        ${accountSectionHtml()}
        <label class="toggle"><span>${svg('sound')} Sound effects</span><input type="checkbox" data-set="sound" ${s.sound ? 'checked' : ''}></label>
        <label class="toggle"><span>${svg('motion')} Reduce motion</span><input type="checkbox" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''}></label>
        <label class="field"><span>Units</span><select data-set="units"><option value="metric" ${s.units === 'metric' ? 'selected' : ''}>Metric (km)</option><option value="imperial" ${s.units === 'imperial' ? 'selected' : ''}>Imperial (mi)</option></select></label>
        <label class="field"><span>Week starts on</span><select data-set="weekStart"><option value="1" ${s.weekStart === 1 ? 'selected' : ''}>Monday</option><option value="0" ${s.weekStart === 0 ? 'selected' : ''}>Sunday</option></select></label>

        <hr>
        <h3>Backup</h3>
        <p class="muted small">${auth.currentUser()
          ? 'Signed in — your data syncs across devices automatically. Export/import still works for an extra offline backup.'
          : 'Data is stored <b>per-device in this browser</b> (localStorage). It does <b>not</b> sync between your phone and laptop — sign in above, or use export/import to move it.'}</p>
        <div class="row">
          <button class="btn ghost" data-set-do="export">${svg('download')} Export</button>
          <button class="btn ghost" data-set-do="import">${svg('upload')} Import</button>
          <button class="btn ghost" data-set-do="export-ics">${svg('calendar')} Calendar</button>
        </div>
        <input type="file" id="import-file" accept="application/json" hidden>

        ${deferredInstall ? `<hr><button class="btn primary" data-set-do="install">${svg('install')} Install app</button>` : ''}

        <hr>
        <h3>Training plan</h3>
        <label class="field"><span>Bike FTP (Watts)</span><input type="number" min="0" step="5" data-set="ftp" value="${s.ftp || 250}"></label>
        <p class="muted small">${planned} planned session${planned === 1 ? '' : 's'} on your calendar (${upcoming} from today onward).</p>
        <div class="row">
          <button class="btn primary" data-set-do="ai-plan">${svg('spark')} AI training plan</button>
          <button class="btn ghost danger" data-action="clear-future">${svg('trash')} Clear future</button>
        </div>
        <button class="btn ghost danger block" data-action="reset-plan">${svg('regen')} Reset training plan</button>
        <p class="muted small">Clearing wipes upcoming sessions only; resetting wipes the whole plan, past and upcoming. Completed and Strava-verified sessions are always kept, so your XP, levels and badges are safe.</p>

        <hr>
        <h3>Packing presets</h3>
        <div class="pack-presets">${['run', 'bike', 'swim', 'gym', 'brick', 'mobility', 'other'].map((t) =>
          `<label class="field"><span>${t}</span><input type="text" data-pack-preset="${t}" value="${esc((s.packing?.[t] || []).join(', '))}" placeholder="item, item, …"></label>`).join('')}</div>

        <hr>
        <h3>Danger zone</h3>
        <button class="btn ghost danger" data-set-do="reseed">${svg('regen')} Reset &amp; reseed plan</button>
      </div>
      <footer class="modal-foot"><span class="spacer"></span><button class="btn primary" data-set-close>Done</button></footer>
    </div>`;

  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };
  root.querySelectorAll('[data-set-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('change', () => {
    const key = el.dataset.set;
    let val = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'weekStart') val = Number(val);
    if (key === 'ftp') val = Math.max(0, Number(val) || 0);
    store.setSetting(key, val);
  }));
  root.querySelectorAll('[data-pack-preset]').forEach((el) => el.addEventListener('change', () => {
    const packing = { ...(store.getSettings().packing || {}) };
    packing[el.dataset.packPreset] = el.value.split(',').map((x) => x.trim()).filter(Boolean);
    store.setSetting('packing', packing);
  }));
  root.querySelectorAll('[data-set-do]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.setDo;
    if (act === 'export') doExport();
    else if (act === 'export-ics') doExportICS();
    else if (act === 'import') root.querySelector('#import-file').click();
    else if (act === 'reseed') { if (confirm('Reset everything and reload the original plan? Your logged progress will be lost.')) { doExport(); store.reseed(); appState.lastLevel = null; appState.seen = null; close(); toast('Backup exported, plan reseeded', { icon: svg('regen') }); } }
    else if (act === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; close(); }
    else if (act === 'ai-plan') { close(); startAIPlan(); }
    else if (act === 'signin') { close(); auth.openAuthModal(); }
    else if (act === 'signout') { if (confirm('Sign out? Your data stays in the cloud and on this device.')) { auth.signOut(); close(); } }
    else if (act === 'strava-connect') { import('./strava-client.js').then((m) => m.connectStrava().catch((e) => toast(e.message || 'Strava connect failed'))); }
    else if (act === 'strava-disconnect') { import('./strava-client.js').then((m) => m.disconnectStrava().then(() => { toast('Strava disconnected'); openSettings(); })); }
    else if (act === 'strava-sync') { busy(b, () => import('./strava-client.js').then((m) => m.syncNow()).then((r) => { store.commit(); toast(`Strava sync: ${r.link || 0} linked, ${r.insert || 0} added`, { icon: svg('sync') }); }).catch((e) => toast(e.message || 'Sync failed'))); }
  }));
  root.querySelector('#import-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { store.importData(reader.result); appState.lastLevel = null; appState.seen = null; close(); toast('Data imported', { icon: svg('upload') }); }
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
  toast('Backup exported', { icon: svg('download') });
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
    toast('Calendar exported', { icon: svg('calendar') });
  });
}

function openGoalEditor() {
  const g = store.getSettings().goals || { sessions: 5, km: 50, hours: 8 };
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop" data-goal-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Edit weekly goals">
      <header class="modal-head"><h2>${svg('target')} Weekly goals</h2><button class="icon-btn" data-goal-close aria-label="Close">${svg('close')}</button></header>
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
    close(); render(); toast('Goals updated', { icon: svg('target') });
  });
}

let _detailId = null;
function openWorkoutDetail(id) {
  const w = store.workoutById(id);
  if (!w) return;
  _detailId = id;
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `<div class="modal-backdrop" data-wd-close></div>
    <div class="modal wd-modal" role="dialog" aria-modal="true" aria-label="${esc(w.title)}">
      <header class="modal-head"><h2>${esc(w.title)}</h2><button class="icon-btn" data-wd-close aria-label="Close">${svg('close')}</button></header>
      <div class="modal-body" id="wd-body">${renderWorkoutDetail(w, store.getSettings().units, buildCtx())}</div>
    </div>`;
  root.querySelectorAll('[data-wd-close]').forEach((b) => b.addEventListener('click', closeModalRoot));
  typeLines(root);
}
function openSportLevels(sport) {
  if (!sport) return;
  const level = sportProgress(store.getWorkouts(), sport).level;
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `<div class="modal-backdrop" data-wd-close></div>
    <div class="modal wd-modal lvl-sheet" role="dialog" aria-modal="true" aria-label="${esc(sport)} levels">
      <header class="modal-head"><h2>${svg('star')} Levels</h2><button class="icon-btn" data-wd-close aria-label="Close">${svg('close')}</button></header>
      <div class="modal-body">${sportLevelCarousel(sport, level)}</div>
    </div>`;
  root.querySelectorAll('[data-wd-close]').forEach((b) => b.addEventListener('click', closeModalRoot));
  // Centre the current-level frame in the swipeable strip.
  const cur = root.querySelector('.lvl-frame.is-current');
  if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// Fullscreen immersive lightbox for a single level frame. Tapping anywhere fades it out.
function openLightbox(src, sport) {
  if (!src) return;
  const box = document.createElement('div');
  box.className = `level-lightbox --${sport || 'other'}`;
  box.innerHTML = `<img src="${esc(src)}" alt="Level artwork">`;
  const dismiss = () => { box.classList.remove('show'); setTimeout(() => box.remove(), 200); };
  box.addEventListener('click', dismiss);
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('show'));
}
function refreshDetail(id) {
  if (_detailId !== id) return;
  const body = document.getElementById('wd-body');
  const w = store.workoutById(id);
  if (body && w) body.innerHTML = renderWorkoutDetail(w, store.getSettings().units, buildCtx());
}
function closeModalRoot() {
  _detailId = null;
  const root = document.getElementById('modal-root');
  root.innerHTML = ''; root.classList.remove('open');
}

// The single entry point to the AI coach — the multi-step onboarding wizard,
// used by both the home card and Settings so they can never drift apart.
function startAIPlan() {
  if (!auth.currentUser()) { auth.openAuthModal(); return; }
  openOnboarding({
    onDone: () => { appState.tab = 'home'; localStorage.setItem('moske-tab', 'home'); render(); },
  });
}

// ---- automated background Strava sync ----------------------------------------
// Runs silently on boot, sign-in, and Profile-tab mount: if the athlete has
// Strava connected, pull new activities and commit them (throttled to 5 min).
let _lastAutoSync = 0;
async function autoStravaSync() {
  if (!STRAVA_ENABLED || !auth.currentUser()) return;
  if (Date.now() - _lastAutoSync < 5 * 60 * 1000) return;
  _lastAutoSync = Date.now();
  try {
    const m = await import('./strava-client.js');
    const st = await m.stravaStatus();
    if (!st?.connected) return;
    const r = await m.syncNow();
    if ((r.insert || 0) + (r.link || 0) + (r.update || 0) > 0) {
      store.commit();
      toast(`Strava: ${r.link || 0} linked · ${r.insert || 0} imported`, { icon: svg('sync') });
    }
  } catch { /* silent — never interrupt the athlete */ }
}

// ---- account / sync UI ------------------------------------------------------

function accountSectionHtml() {
  if (!SYNC_ENABLED) return '';
  const u = auth.currentUser();
  const acct = u
    ? `<div class="signed-in"><div><b>${svg('cloud')} Signed in</b><br><span class="muted small">${esc(u.email || 'your account')}</span></div>
         <button class="btn ghost" data-set-do="signout">Sign out</button></div>`
    : `<button class="btn primary block" data-set-do="signin">${svg('cloud')} Sign in to sync</button>`;
  const strava = (u && STRAVA_ENABLED)
    ? `<div class="strava-block">
         <div class="row">
           <button class="btn ghost" data-set-do="strava-connect">${svg('link')} Connect Strava</button>
           <button class="btn ghost" data-set-do="strava-sync">${svg('sync')} Sync now</button>
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
    el.innerHTML = `<div class="sync-prompt">${svg('cloud')}<span>Sign in to sync across your phone &amp; laptop.</span>
      <button class="link" data-action="open-auth">Sign in</button>
      <button class="icon-btn tiny" data-action="dismiss-sync" aria-label="Dismiss">${svg('close')}</button></div>`;
  } else {
    el.innerHTML = '';
  }
}

function onAuthChange(user, opts = {}) {
  if (!opts.remote) { appState.lastLevel = null; appState.seen = null; } // no level-up or XP pops on a data swap
  if (user && !opts.remote) { autoStravaSync(); syncQuestClaims({ force: true }); }
  render();
  const root = document.getElementById('modal-root');
  if (root && root.querySelector('[aria-label="Settings"]')) openSettings();
}

function handleRedirectParams() {
  const url = new URL(location.href);
  const strava = url.searchParams.get('strava');
  if (strava) {
    const sr = url.searchParams.get('sr'); // failure reason from the callback fn
    let msg = { connected: 'Strava connected', denied: 'Strava connection cancelled',
      error: 'Strava connection failed', auth_failed: 'Connect failed — sign in first' }[strava];
    if (strava === 'error' && sr) msg += ` — ${decodeURIComponent(sr)}`;
    if (msg) setTimeout(() => toast(msg), 600);
    url.searchParams.delete('strava');
    url.searchParams.delete('sr');
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
    { icon: 'coach', img: COACH.full, t: 'Meet your coach', b: 'Sessions complete when Strava verifies them. That is what earns XP, clears daily quests and keeps your streak alive.' },
    { icon: 'plus', t: 'Make it yours', b: 'Tap the + button to add a session on any day, with intervals, exercises and a packing list.' },
    { icon: 'install', t: 'Add to Home Screen', b: 'Install MOSKE for a full-screen app that works offline at the gym. Sign in to sync across devices.' },
  ];
  let i = 0;
  const draw = () => {
    const c = cards[i];
    root.innerHTML = `<div class="modal-backdrop"></div>
      <div class="modal onboard" role="dialog" aria-modal="true" aria-label="Welcome to MOSKE">
        <div class="modal-body onboard-body">
          <div class="onboard-icon">${c.img ? `<img class="onboard-coach" src="${esc(c.img)}" alt="Your coach" width="109" height="189">` : svg(c.icon)}</div>
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
  appState.journalDate = today;
  // Restore last tab.
  const savedTab = localStorage.getItem('moske-tab');
  if (['home', 'journal', 'leaderboards', 'shop', 'progress'].includes(savedTab)) appState.tab = savedTab;

  // pixel icons for the static chrome (tab bar, FAB)
  document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = svg(el.dataset.icon); });
  const savedSport = localStorage.getItem('moske-pg-sport');
  if (['bike', 'run', 'swim', 'gym'].includes(savedSport)) appState.pgSport = savedSport;
  setInterval(tickQuestReset, 30000);
  // a new day (past local midnight) re-rolls the quests
  let lastDay = todayISO();
  setInterval(() => { if (todayISO() !== lastDay) { lastDay = todayISO(); render(); } }, 60000);

  // Enter / Space on a focusable non-button control (cards, rows) acts as a tap
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest?.('[role="button"][tabindex]');
    if (!el || el !== e.target || el.tagName === 'BUTTON') return;
    e.preventDefault();
    el.click();
  });
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('submit', onSubmit);
  document.getElementById('fab').addEventListener('click', () => openEditor(null, todayISO()));
  document.getElementById('settings-btn')?.addEventListener('click', openSettings); // gear now lives in the profile hub

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

  store.subscribe(render);
  render();
  appState.booted = true;

  maybeOnboard();
  handleRedirectParams();
  if (SYNC_ENABLED) Promise.resolve(auth.initAuth(onAuthChange)).then(() => autoStravaSync());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

boot();
