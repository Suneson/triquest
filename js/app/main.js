// main.js — bootstrap, derived state, rendering orchestration and event wiring.

import * as store from './store.js';
import { computeStats, xpStatus, earnsXp, levelFromTotalXp } from '../core/scoring.js';
import { boostedLedger } from '../core/boosts.js';
import { earnedBySession } from '../core/wallet.js';
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
import { renderProfileGame, openFitnessHub, openPublicFitness, SPORT_ORDER, avatarButton } from './profile-game.js';
import { openWhatNext } from './base-view.js';
import { renderDiorama, wireDiorama, resetDiorama } from './diorama-view.js';
import { refreshPlacements, onPlacements } from './placement-state.js';
import { PRESTIGE, canPrestige } from '../core/collections.js';
import { onSwipe, nextSport } from './swipe.js';
import { openOnboarding } from './onboarding.js';
import { svg } from '../core/icons.js';
import { openEditor } from './editor.js';
import { handleGymAction, finishView, startTicker, wireLogger } from './gym-logger.js';
import { routineRows, startRoutine, deleteRoutine, getRoutines } from './gym-routines.js';
import { chatShell, mountChat, openThread, openBell, paintBell, wireSocialUi, chatMode } from './chat.js';
import { startRoom, stopRoom } from './room.js';
import { startSocial, stopSocial, refreshSocial } from './social.js';
import { confetti, playLevelUp, playBadge, playQuest, playComplete, playRestDone, playAccept, toast, xpPop, typeLines, prefersReducedMotion } from './effects.js';
import { SYNC_ENABLED, STRAVA_ENABLED } from './config.js';
import * as auth from './auth.js';
import { syncQuestClaims } from './quest-sync.js';
import { openMissionBoard, maybeShowRecap, BOARD_ART } from './missions-view.js';
import { withTabTransition, rollNum, animateIn, busy } from './motion.js';
import { openSeasonPath } from './game.js';
import { openLayer, closeLayer, closeAllLayers, hasLayers, topLayerName, openRoute, leaveRoute } from './nav.js';
import { haptic } from './haptics.js';
import { enablePull } from './pull.js';
import { morph } from './vt.js';
import { stampRecord, firstStamp } from './stamp.js';
import { sheetHead } from './sheet.js';
import { t, setLang, onLang, pickLang, getLang } from '../core/i18n.js';
import { applyStatic } from './i18n-dom.js';
import { DISCIPLINES } from '../core/disciplines.js';
import { langToggle } from './lang-toggle.js';
import { planTitle, planItem } from '../core/plan-i18n.js';
import { openCheckinSheet } from './checkin.js';
import { gearState, refreshGear, onGear, onWorkshopFinish, sportLevelOf, takePrestige, gearError, gearEnabled, claimMissions } from './gear-state.js';
import { gearById } from '../core/gear.js';
import { propById } from '../core/scenes.js';
import { refreshFeats, onFeats } from './feats-state.js';
import { openTrophyCase, featWonText } from './feats-view.js';
import { refreshChallenges, stopChallenges, onChallenges } from './challenges-state.js';
import { settleText } from './challenges-view.js';
import { openGear, openInventory, openShop } from './gear-view.js';
import { startGelTicker } from './gel-chip.js';


// ?safe=34 fakes an iPhone's safe areas in a desktop browser or headless
// screenshots: 34px for the home indicator at the bottom and the status bar at
// the top (59px, Dynamic Island; ?safet= sets the top on its own).
{
  const q = new URLSearchParams(location.search);
  const fake = Number(q.get('safe'));
  const top = Number(q.get('safet')) || (fake > 0 ? 59 : 0);
  if (Number.isFinite(fake) && fake > 0) document.documentElement.style.setProperty('--safe-b', `${Math.min(80, fake)}px`);
  if (top > 0) document.documentElement.style.setProperty('--safe-t', `${Math.min(80, top)}px`);
}

const appState = {
  tab: 'home',
  lbView: 'season',
  journalDate: null, // ISO date selected in the Journal strip (null = today)
  pgSport: 'bike',   // which sport the Profile scene shows
  pgView: 'base',    // the Profile tab lands on the home base; 'scene' is one sport's scene (docs/LOOP.md §3)
  pgSlide: '',       // 'left' / 'right': the next scene slides in from that side
  weekOpen: localStorage.getItem('moske-week-open') === '1', // Home's week strip, opened
  questsOpen: false, // cleared quests unfolded (this session only)
  lastLevel: null,
  booted: false,
  // previous-render snapshots for feedback moments (null until first render)
  seen: null,
};

let deferredInstall = null;

// ---- derived context --------------------------------------------------------

// Your own XP with gear and gels (docs/GEAR.md): per discipline, and the
// account total. Ranks never sees these; they feed your levels and scenes.
function boostedXp(workouts, acctBase) {
  const gear = gearState();
  const rows = boostedLedger(workouts, gear.inventory, gear.boosts);
  const byId = new Map();
  const sportXp = {};
  const sportBase = {};
  let total = 0;
  for (const r of rows) {
    byId.set(r.w.id, r);
    sportXp[r.w.type] = (sportXp[r.w.type] || 0) + r.total;
    sportBase[r.w.type] = (sportBase[r.w.type] || 0) + r.base;
    total += r.total;
  }
  const acct = { ...levelFromTotalXp(total + acctBase.questXp), trainingXp: total, baseTrainingXp: acctBase.trainingXp, questXp: acctBase.questXp };
  return { byId, sportXp, sportBase, acct };
}

function buildCtx() {
  const today = todayISO();
  const workouts = store.getWorkouts();
  const settings = store.getSettings();
  const boost = boostedXp(workouts, accountProgress(workouts, settings, today));
  return {
    today,
    workouts,
    stats: computeStats(workouts),
    streaks: computeStreaks(workouts, today),
    units: settings.units,
    settings,
    unlockedBadges: store.getState().unlockedBadges,
    quests: questsFor(today, workouts, settings),
    acct: boost.acct,
    boost,
    ui: { weekOpen: appState.weekOpen, questsOpen: appState.questsOpen },
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
        if (b) setTimeout(() => { toast(`<b>${t('main.badgeUnlocked')}</b><br>${esc(b.name)}: ${esc(b.desc)}`, { icon: svg(b.icon) }); playBadge(); }, 400 + i * 600);
      });
    }
  }

  if (appState.lastLevel != null && ctx.acct.level > appState.lastLevel && appState.booted) {
    setTimeout(() => {
      toast(`<b>${t('main.accountLevel', { level: ctx.acct.level })}</b><br>${esc(MOMENT_LINES.accountLevel(ctx.acct.level))}`, { icon: svg('star') });
      playLevelUp();
      if (!prefersReducedMotion()) confetti(window.innerWidth / 2, 120, 140);
    }, 200);
  }
  appState.lastLevel = ctx.acct.level;
  feedbackMoments(ctx);
  syncQuestClaims(); // throttled; sends completed quests so they count in Ranks
  // a weekly mission that's done is paid without a tap (docs/LOOP.md §5.1)
  claimMissions(ctx.workouts).then((n) => {
    if (n) toast(`<b>${t('mission.ui.paidToast', { n })}</b>`, { icon: `<img src="${BOARD_ART}" width="28" height="28" alt="">` });
  });
}

// ---- feedback moments ----------------------------------------------------------
// Compares this render with the last one: newly verified sessions pop their
// XP, newly completed quests get a toast, and a sport level-up swaps that
// sport's scene with a level-up sheet. Nothing fires on the first render or
// when the whole data set was swapped (sign-in / import).

const SPORTS = ['bike', 'run', 'swim', 'gym'];
const isVerifiedW = (w) => earnsXp(w); // Strava proof, or a gym session logged in the app

function snapshot(ctx) {
  return {
    verified: new Set(ctx.workouts.filter(isVerifiedW).map((w) => w.id)),
    quests: new Set(ctx.quests.filter((q) => q.done).map((q) => q.id)),
    questDay: ctx.today,
    // after a prestige reset the level counts from the reset (a reset is never a "level-up")
    levels: Object.fromEntries(SPORTS.map((s) => [s, sportLevelOf(s, ctx.boost.sportXp[s] || 0).level])),
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
    // the boosted number flies; the base and the coins it earned sit underneath
    const b = ctx.boost.byId.get(w.id);
    const base = xpStatus(w, ctx.workouts).xp;
    const got = earnedBySession(w, ctx.workouts);
    const sub = [b && b.total !== base ? t('xp.baseN', { n: base }) : '', got.coins ? t('xp.coinsN', { n: got.coins }) : '', got.carbs ? t('xp.carbsN', { n: got.carbs }) : ''].filter(Boolean).join(' · ');
    xpPop(`+${b ? b.total : base} XP`, r ? r.left + r.width / 2 : window.innerWidth / 2, r ? r.top + 12 : window.innerHeight / 3, sub);
    playComplete();
  }, 300 + i * 500));

  // quests completed since the last render (same day only)
  if (prev.questDay === now.questDay) {
    const done = ctx.quests.filter((q) => q.done && !prev.quests.has(q.id));
    done.forEach((q) => ctx.freshQuests.add(q.id));
    if (done.length) {
      // several at once (one Strava sync can clear a few) → one toast, not a pile
      const xp = done.reduce((a, q) => a + q.xp, 0);
      const head = done.length === 1 ? t('main.questOne', { xp }) : t('main.questMany', { n: done.length, xp });
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

// the language follows settings.lang (saved on Profile, synced through the
// profile), or the device's language until one is chosen
function syncLang(settings) {
  const l = pickLang(settings?.lang, navigator.language);
  if (l !== getLang()) setLang(l);
}
// a language change redraws the static chrome and any sheet that is open;
// render() then redraws the view (the chat view rebuilds from scratch)
onLang(() => {
  applyStatic();
  const view = document.getElementById('view');
  if (view?.querySelector('#chat-root')) view.innerHTML = '';
  const top = topLayerName();
  if (top === 'settings') openSettings();
  else if (top === 'fitness') openFitnessHub(buildCtx());
});

function render() {
  const ctx = buildCtx();
  syncLang(ctx.settings);
  syncProgress(ctx);
  document.body.classList.toggle('rm', prefersReducedMotion());

  document.getElementById('race-banner').innerHTML = eventBanner(ctx);
  renderSyncBanner();

  // Header avatar: uploaded photo if set, otherwise the athlete's initial.
  const u = auth.currentUser?.();
  const name = (u?.user_metadata?.display_name || u?.email || 'A').trim(); // 'A' = athlete's initial fallback
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
    chip.setAttribute('aria-label', t('nav.accountLevelFull', { level: ctx.acct.level, toNext: ctx.acct.toNext }));
  }

  paintTabCursor();
  document.querySelectorAll('.tab').forEach((tab) => {
    // the calendar (route id 'journal') opens from Home, so Home stays lit while it's showing
    const on = tab.dataset.tab === appState.tab || (appState.tab === 'journal' && tab.dataset.tab === 'home');
    tab.classList.toggle('active', on);
    if (on) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  });

  // Profile tab is a sealed full-screen game viewport: hide app chrome, lock scroll.
  document.body.classList.toggle('pg-mode', appState.tab === 'progress');
  document.body.classList.toggle('chat-mode', appState.tab === 'chat'); // the + button would cover the composer

  const view = document.getElementById('view');
  if (appState.tab === 'leaderboards') {
    view.innerHTML = leaderboardShell(appState.lbView, ctx.today);
    loadLeaderboard(appState.lbView, ctx.today);
  } else if (appState.tab === 'shop') {
    view.innerHTML = shopShell();
    loadShop();
  } else if (appState.tab === 'progress' && appState.pgView === 'base') {
    view.innerHTML = renderDiorama(ctx, avatarButton(ctx));
    wireDiorama(view, ctx);
  } else if (appState.tab === 'progress') {
    view.innerHTML = renderProfileGame(ctx, appState.pgSport, appState.pgSlide);
    appState.pgSlide = '';
    startScene(view);
  } else if (appState.tab === 'journal') {
    view.innerHTML = renderJournal(ctx, appState.journalDate || ctx.today);
  } else if (appState.tab === 'chat') {
    // the chat view keeps itself live; a re-render for training data mustn't wipe a draft
    if (!view.querySelector('#chat-root')) view.innerHTML = chatShell();
    mountChat(view);
  } else {
    view.innerHTML = renderHome(ctx);
  }

  document.getElementById('storage-banner').hidden = store.isPersistent();
  animateIn(document);
}

// ---- tab bar: the gold cell slides to the new tab in four steps -----------------
// One cursor element behind the five tabs; its index is a CSS variable, so the
// move is a stepped transform. The tab you enter gives its icon a 2px hop.
let _tabIdx = -1;
function paintTabCursor() {
  const bar = document.querySelector('.tabs');
  if (!bar) return;
  let cur = bar.querySelector('.tab-cursor');
  if (!cur) { cur = document.createElement('span'); cur.className = 'tab-cursor'; cur.setAttribute('aria-hidden', 'true'); bar.prepend(cur); bar.classList.add('has-cursor'); }
  const tabs = [...bar.querySelectorAll('.tab')];
  const lit = appState.tab === 'journal' ? 'home' : appState.tab;
  const i = Math.max(0, tabs.findIndex((tab) => tab.dataset.tab === lit));
  bar.style.setProperty('--i', String(i));
  if (_tabIdx >= 0 && i !== _tabIdx) {
    const ico = tabs[i]?.querySelector('.tab-ico');
    if (ico) { ico.classList.remove('hop'); void ico.offsetWidth; ico.classList.add('hop'); }
  }
  _tabIdx = i;
}

// ---- Profile scene lifecycle --------------------------------------------------
// Switch sport from the buttons or a swipe; the new scene slides in from the
// side you're heading to (no slide under reduced motion: CSS drops it).
function setPgSport(sport) {
  if (!sport || sport === appState.pgSport) return;
  const from = SPORT_ORDER.indexOf(appState.pgSport);
  appState.pgSlide = SPORT_ORDER.indexOf(sport) > from ? 'left' : 'right';
  appState.pgSport = sport;
  try { localStorage.setItem('moske-pg-sport', sport); } catch { /* private mode */ }
  render();
}

// The home base → one sport's scene and back. The scene is a route, so the
// system back, Escape and the edge swipe return to the base like a layer.
function enterScene(sport) {
  if (!SPORT_ORDER.includes(sport)) return;
  appState.pgSport = sport;
  appState.pgSlide = '';
  try { localStorage.setItem('moske-pg-sport', sport); } catch { /* private mode */ }
  appState.pgView = 'scene';
  openRoute('pg-scene', { onClose: () => { appState.pgView = 'base'; if (appState.tab === 'progress') render(); } });
  render();
}
function leaveScene() {
  leaveRoute('pg-scene');
  appState.pgView = 'base';
  render();
}

// Scene motion is pure CSS; this only pauses it while the page is hidden.
function startScene(view) {
  const screen = view.querySelector('.pg-screen');
  if (screen) screen.classList.toggle('paused', document.hidden || !!appState.sceneHold);
}
document.addEventListener('visibilitychange', () => {
  document.querySelector('.pg-screen')?.classList.toggle('paused', document.hidden || !!appState.sceneHold);
});

// Level-up sheet: the previous level's art wipes away to reveal the new one.
function openLevelUp(sport, level) {
  // after a prestige reset the scenery stays where it was: no new art to reveal
  const stars = sportLevelOf(sport, buildCtx().boost.sportXp[sport] || 0).stars;
  const before = sceneFor(sport, stars ? Math.max(level, PRESTIGE.level) : level - 1);
  const after = sceneFor(sport, stars ? Math.max(level, PRESTIGE.level) : level);
  if (!after) return;
  const art = (s) => (s.kind === 'still' ? s.entry.src : s.entry.char);
  const ar = after.kind === 'still' ? `${after.entry.w} / ${after.entry.h}` : '768 / 624';
  const fresh = before && art(before) !== art(after);
  // the Profile scene underneath holds still until this moment is over
  appState.sceneHold = true;
  document.querySelector('.pg-screen')?.classList.add('paused');
  const root = openLayer('level-up', {
    reuse: false,
    onClose: () => { appState.sceneHold = false; document.querySelector('.pg-screen')?.classList.toggle('paused', document.hidden); },
  });
  root.innerHTML = `<div class="modal-backdrop" data-lu-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${t('main.levelUp')}">
      ${sheetHead({ icon: 'star', title: t('main.levelUp'), closeAttr: 'data-lu-close' })}
      <div class="modal-body lvlup">
        <div class="lvlup-art${fresh ? ' has-curtain' : ''}" style="--ar:${ar}">
          <img class="lvlup-new" src="${esc(art(after))}" alt="${esc(t('main.levelAlt', { sport: after.label, n: level }))}">
          ${fresh ? `<img src="${esc(art(before))}" alt="" class="lvlup-curtain is-l"><img src="${esc(art(before))}" alt="" class="lvlup-curtain is-r">` : ''}
          ${after.kind === 'still' ? stillCorners(after.entry) : ''}
        </div>
        <h2 aria-label="${t('main.levelAria', { n: level })}">LVL <span class="lvl-roll" aria-hidden="true"><i>${level - 1}</i><i>${level}</i></span></h2>
        ${dialogue({ text: `${MOMENT_LINES.sportLevel(after.label, level)}${after.level > after.maxArt ? t('main.newScenery') : ''}`, portrait: COACH.cheer || COACH.portrait })}
        <button class="btn primary" data-lu-close>${t('main.continue')}</button>
      </div>
    </div>`;
  root.querySelectorAll('[data-lu-close]').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
  typeLines(root);
  playLevelUp();
  haptic('levelUp');
  if (appState.tab === 'progress') { appState.pgSport = sport; render(); }
}

// Quest reset countdown on Home ticks once a minute (no per-second redraws).
function tickQuestReset() {
  const el = document.querySelector('[data-quest-reset]');
  if (el) el.textContent = t('ui.resetsIn', { time: formatCountdown(msUntilReset()) });
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
  toast(t('main.removed', { message, n }), { icon: svg('trash') });
  // Both buttons live in Settings — redraw it so its session counts aren't stale.
  if (topLayerName() === 'settings') openSettings();
  return n;
}

// ---- event handlers ---------------------------------------------------------

// scroll position per tab, so switching away and back lands where you were
// (tapping the tab you're already on goes to the top, as tab bars do)
const tabScroll = new Map();

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  if (handleGymAction(action, el, gymDeps, 'click')) return;

  switch (action) {
    case 'tab': {
      closeAllLayers(); // a tab is the root: nothing stays open over it
      const from = appState.tab;
      const view = document.getElementById('view'); // #view is the scroller
      tabScroll.set(from, view.scrollTop);
      appState.tab = el.dataset.tab;
      if (appState.tab === 'journal') appState.journalDate = todayISO(); // list anchors to Today
      localStorage.setItem('moske-tab', appState.tab);
      if (appState.tab === 'progress') { appState.pgView = 'base'; resetDiorama(); autoStravaSync(); } // lands on the base; silent background pull
      withTabTransition(from, appState.tab, () => {
        render();
        // each tab comes back where you left it; the calendar opens on today's row
        if (appState.tab === 'journal') document.querySelector('.jr-row.is-today')?.scrollIntoView({ block: 'start' });
        else if (appState.tab !== 'chat') view.scrollTo(0, from === appState.tab ? 0 : tabScroll.get(appState.tab) || 0);
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
      // the row's avatar and level travel into the profile header
      morph([
        { name: 'athlete-avatar', from: el.querySelector('.lb-avatar'), to: '[data-vt="athlete-avatar"]' },
        { name: 'athlete-level', from: el.querySelector('.lb-meta'), to: '[data-vt="athlete-level"]' },
      ], () => openPublicFitness({
        uid: el.dataset.uid,
        name: a?.display_name || el.dataset.name,
        avatar: a?.avatar || null,
        xp: a?.xp ?? el.dataset.xp,
      }));
      break;
    }
    case 'open-sport-levels': openSportLevels(el.dataset.sport); break;
    case 'open-lightbox': openLightbox(el.dataset.src, el.dataset.sport); break;
    case 'pg-profile': openFitnessHub(buildCtx()); break;
    case 'open-gear': openGear(buildCtx(), el.dataset.sport || appState.pgSport); break;
    case 'open-base': openShop(buildCtx(), { tab: 'base', sport: el.dataset.sport || appState.pgSport, focus: el.dataset.bp ? 'bp' : '' }); break;
    case 'enter-scene': enterScene(el.dataset.sport); break;
    case 'open-next': openWhatNext(buildCtx()); break;
    case 'open-missions': openMissionBoard(buildCtx()); break;
    case 'pg-base': leaveScene(); break;
    case 'open-inventory': openInventory(); break;
    case 'open-trophies': openTrophyCase(el.dataset.sport); break;
    case 'ai-onboard': startAIPlan(); break;
    case 'hub-signout':
      if (confirm(t('main.signOutConfirm'))) { auth.signOut(); closeAllLayers(); }
      break;
    case 'hub-strava-connect':
      import('./strava-client.js').then((m) => m.connectStrava().catch((e) => toast(e.message || t('main.stravaConnectFailed'))));
      break;
    case 'hub-strava-sync':
      busy(el, () => import('./strava-client.js').then((m) => m.syncNow())
        .then((r) => { store.commit(); toast(t('main.stravaSync', { link: r.link || 0, insert: r.insert || 0 }), { icon: svg('sync') }); })
        .catch((e) => toast(e.message || t('main.syncFailed'))));
      break;
    case 'hub-strava-disconnect':
      import('./strava-client.js').then((m) => m.disconnectStrava()
        .then(() => toast(t('main.stravaDisconnected'))).catch((e) => toast(e.message || t('main.disconnectFailed'))));
      break;
    case 'pg-sport': setPgSport(el.dataset.sport); break;
    case 'open-workout':
      // the card's title carries into the session sheet's header
      morph([{ name: 'session-title', from: el.querySelector('h3'), to: '.wd-modal .sh-title-text' }], () => openWorkoutDetail(id));
      break;
    case 'open-bell': openBell(); break;
    case 'routine-start': startRoutine(el.dataset.rt, el.dataset.date || todayISO()); break;
    case 'routine-delete': {
      const rt = getRoutines().find((r) => r.id === el.dataset.rt);
      if (rt && confirm(t('main.deleteRoutine', { name: rt.name }))) {
        deleteRoutine(rt.id);
        if (document.querySelector('[data-set-do="ai-plan"]')) openSettings();
      }
      break;
    }
    case 'edit-goals': openGoalEditor(); break;
    case 'toggle-week':
      appState.weekOpen = !appState.weekOpen;
      try { localStorage.setItem('moske-week-open', appState.weekOpen ? '1' : '0'); } catch { /* private mode */ }
      render();
      document.querySelector('[data-action="toggle-week"]')?.focus({ preventScroll: true });
      break;
    case 'toggle-quests':
      appState.questsOpen = !appState.questsOpen;
      render();
      break;
    case 'open-season': openSeasonPath(buildCtx()); break;
    case 'share-card': { const w = store.workoutById(id); if (w) import('./share.js').then((m) => m.openShareSheet(w, store.getWorkouts())); break; }
    case 'clear-future': {
      const from = todayISO();
      const n = prescribedSessions(from).length;
      if (!n) { toast(t('main.nothingToClear')); break; }
      if (!confirm(t('main.clearConfirm', { n }))) break;
      clearPrescribed(from, t('main.futureCleared'));
      break;
    }
    case 'reset-plan': {
      const n = prescribedSessions().length;
      if (!n) { toast(t('main.planEmpty')); break; }
      if (!confirm(t('main.resetConfirm', { n }))) break;
      clearPrescribed(null, t('main.planReset'));
      break;
    }
    case 'shop-open': window.open(el.dataset.url, '_blank', 'noopener,noreferrer'); break;
    case 'edit': openEditor(id); break;
    case 'duplicate': store.duplicateWorkout(id); toast(t('main.duplicated')); break;
    case 'delete':
      if (confirm(t('main.deleteConfirm'))) { store.deleteWorkout(id); if (_detailId === id) closeLayer('workout'); toast(t('main.deleted')); }
      break;
    case 'open-editor-new': openEditor(null, el.dataset.date); break;
    case 'remove-pack': {
      const w = store.workoutById(id);
      w.packing.splice(+el.dataset.pi, 1);
      store.commit();
      break;
    }
    case 'open-settings': openSettings(); break;
    case 'set-lang': if (el.dataset.lang !== getLang()) { store.setSetting('lang', el.dataset.lang); haptic('tick'); } break;
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

  if (handleGymAction(action, el, gymDeps, 'change')) return;
  if (action === 'toggle-preset-pack') {
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
  if (handleGymAction(action, el, gymDeps, 'input')) return;
  if (action === 'notes') {
    const w = store.workoutById(id);
    w.notes = el.value;
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
    toast(t('main.metricsLogged'), { icon: svg('check') });
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
    if (!target) { toast(t('main.noTomorrow')); return; }
    target.packing.push({ item: val, checked: false });
    store.commit();
  }
}

// ---- settings modal ---------------------------------------------------------

function openSettings() {
  const s = store.getSettings();
  const planned = prescribedSessions().length;
  const upcoming = prescribedSessions(todayISO()).length;
  const root = openLayer('settings');
  root.innerHTML = `
    <div class="modal-backdrop" data-set-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${t('main.settings')}">
      ${sheetHead({ icon: 'gear', title: t('main.settings'), closeAttr: 'data-set-close' })}
      <div class="modal-body">
        ${accountSectionHtml()}
        ${langToggle()}
        <button type="button" class="row-btn" data-set-do="checkin">${svg('pin')} <span>${t('checkin.settingsLabel')}</span><span class="spacer"></span><b>${s.gymCheckin ? t('checkin.stateOn') : t('checkin.stateOff')}</b></button>
        <label class="toggle"><span>${svg('sound')} ${t('main.sound')}</span><input type="checkbox" data-set="sound" ${s.sound ? 'checked' : ''}></label>
        <label class="toggle"><span>${svg('motion')} ${t('main.reduceMotion')}</span><input type="checkbox" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''}></label>
        <label class="toggle"><span>${svg('flag')} ${t('chx.directSetting')}</span><input type="checkbox" data-set="directChallenges" ${s.directChallenges === false ? '' : 'checked'}></label>
        <p class="muted small">${t('chx.directSettingNote')}</p>
        <label class="field"><span>${t('main.units')}</span><select data-set="units"><option value="metric" ${s.units === 'metric' ? 'selected' : ''}>${t('main.metric')}</option><option value="imperial" ${s.units === 'imperial' ? 'selected' : ''}>${t('main.imperial')}</option></select></label>
        <label class="field"><span>${t('main.weekStarts')}</span><select data-set="weekStart"><option value="1" ${s.weekStart === 1 ? 'selected' : ''}>${t('main.monday')}</option><option value="0" ${s.weekStart === 0 ? 'selected' : ''}>${t('main.sunday')}</option></select></label>

        <hr>
        <h3>${t('main.backup')}</h3>
        <p class="muted small">${auth.currentUser() ? t('main.backupSignedIn') : t('main.backupLocal')}</p>
        <div class="row">
          <button class="btn ghost" data-set-do="export">${svg('download')} ${t('main.export')}</button>
          <button class="btn ghost" data-set-do="import">${svg('upload')} ${t('main.import')}</button>
          <button class="btn ghost" data-set-do="export-ics">${svg('calendar')} ${t('main.calendarFile')}</button>
        </div>
        <input type="file" id="import-file" accept="application/json" hidden>

        ${deferredInstall ? `<hr><button class="btn primary" data-set-do="install">${svg('install')} ${t('main.install')}</button>` : ''}

        <hr>
        <h3>${t('main.trainingPlan')}</h3>
        <label class="field"><span>${t('main.ftp')}</span><input type="number" min="0" step="5" data-set="ftp" value="${s.ftp || 250}"></label>
        <p class="muted small">${t('main.plannedCount', { n: planned, upcoming })}</p>
        <div class="row">
          <button class="btn primary" data-set-do="ai-plan">${svg('spark')} ${t('main.aiPlan')}</button>
          <button class="btn ghost danger" data-action="clear-future">${svg('trash')} ${t('main.clearFuture')}</button>
        </div>
        <button class="btn ghost danger block" data-action="reset-plan">${svg('regen')} ${t('main.resetPlan')}</button>
        <p class="muted small">${t('main.clearNote')}</p>

        <hr>
        <h3>${t('main.routines')}</h3>
        ${routineRows({ withDelete: true }) || `<p class="muted small">${t('main.noRoutines')}</p>`}

        <hr>
        <h3>${t('main.packingPresets')}</h3>
        <div class="pack-presets">${['run', 'bike', 'swim', 'gym', 'brick', 'mobility', 'other'].map((k) =>
          `<label class="field"><span>${esc(DISCIPLINES[k].label)}</span><input type="text" data-pack-preset="${k}" value="${esc((s.packing?.[k] || []).map((x) => planItem(x, k)).join(', '))}" placeholder="${t('main.presetPh')}"></label>`).join('')}</div>

        <hr>
        <h3>${t('main.dangerZone')}</h3>
        <button class="btn ghost danger" data-set-do="reseed">${svg('regen')} ${esc(t('main.reseed'))}</button>
      </div>
      <footer class="modal-foot"><span class="spacer"></span><button class="btn primary" data-set-close>${t('main.done')}</button></footer>
    </div>`;

  const close = () => closeLayer(root);
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
    else if (act === 'reseed') { if (confirm(t('main.reseedConfirm'))) { doExport(); store.reseed(); appState.lastLevel = null; appState.seen = null; close(); toast(t('main.reseeded'), { icon: svg('regen') }); } }
    else if (act === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; close(); }
    else if (act === 'ai-plan') { close(); startAIPlan(); }
    else if (act === 'checkin') openCheckinSheet({ onChange: () => { if (topLayerName() === 'settings') openSettings(); } });
    else if (act === 'signin') { close(); auth.openAuthModal(); }
    else if (act === 'signout') { if (confirm(t('main.signOutConfirm'))) { auth.signOut(); close(); } }
    else if (act === 'strava-connect') { import('./strava-client.js').then((m) => m.connectStrava().catch((e) => toast(e.message || t('main.stravaConnectFailed')))); }
    else if (act === 'strava-disconnect') { import('./strava-client.js').then((m) => m.disconnectStrava().then(() => { toast(t('main.stravaDisconnected')); openSettings(); })); }
    else if (act === 'strava-sync') { busy(b, () => import('./strava-client.js').then((m) => m.syncNow()).then((r) => { store.commit(); toast(t('main.stravaSync', { link: r.link || 0, insert: r.insert || 0 }), { icon: svg('sync') }); }).catch((e) => toast(e.message || t('main.syncFailed')))); }
  }));
  root.querySelector('#import-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { store.importData(reader.result); appState.lastLevel = null; appState.seen = null; close(); toast(t('main.imported'), { icon: svg('upload') }); }
      catch { toast(t('main.importFailed')); }
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
  toast(t('main.exported'), { icon: svg('download') });
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
    toast(t('main.calExported'), { icon: svg('calendar') });
  });
}

function openGoalEditor() {
  const g = store.getSettings().goals || { sessions: 5, km: 50, hours: 8 };
  const root = openLayer('goals');
  root.innerHTML = `
    <div class="modal-backdrop" data-goal-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${t('main.goalsAria')}">
      ${sheetHead({ icon: 'target', title: t('main.goalsTitle'), closeAttr: 'data-goal-close' })}
      <div class="modal-body">
        <form data-goal-form>
          <label class="field"><span>${t('main.goalSessions')}</span><input type="number" name="sessions" min="0" step="1" value="${g.sessions}" required></label>
          <label class="field"><span>${t('main.goalKm')}</span><input type="number" name="km" min="0" step="1" value="${g.km}" required></label>
          <label class="field"><span>${t('main.goalHours')}</span><input type="number" name="hours" min="0" step="0.5" value="${g.hours}" required></label>
          <button class="btn primary" type="submit">${t('main.saveGoals')}</button>
        </form>
      </div>
    </div>`;
  const close = () => closeLayer(root);
  root.querySelectorAll('[data-goal-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelector('[data-goal-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    store.setSetting('goals', {
      sessions: Math.max(0, Math.round(+e.target.sessions.value) || 0),
      km: Math.max(0, +e.target.km.value || 0),
      hours: Math.max(0, +e.target.hours.value || 0),
    });
    close(); render(); toast(t('main.goalsUpdated'), { icon: svg('target') });
  });
}

// what the gym logger needs from the app
const gymDeps = {
  store,
  refresh: (id) => refreshDetail(id),
  close: () => closeLayer('workout'),
  toast: (msg, icon = 'warn') => toast(msg, { icon: svg(icon) }),
  onRecord: ({ name, prs, key, target }) => {
    if (key && !firstStamp(key)) return; // this record was celebrated already
    playBadge();
    haptic('record');
    const text = t('main.newRecord', { name, prs: prs.map((p) => p.label).join(' · ') });
    // the plaque stamps down and settles into the set; with reduced motion, a toast says it
    if (stampRecord({ name, prs, target })) announce(text);
    else toast(`<b>${esc(t('main.newRecordHead', { name }))}</b><br>${prs.map((p) => esc(p.label)).join(' · ')}`, { icon: svg('trophy') });
  },
  showFinish: (id) => {
    const body = document.getElementById('wd-body');
    const w = store.workoutById(id);
    if (body && w) { body.innerHTML = finishView(w, store.getWorkouts()); body.scrollTop = 0; }
    playComplete();
  },
};
// a polite screen-reader line for moments that are drawn, not written
function announce(text) {
  let live = document.getElementById('sr-live');
  if (!live) { live = document.createElement('div'); live.id = 'sr-live'; live.className = 'sr'; live.setAttribute('role', 'status'); document.body.appendChild(live); }
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 50);
}

function onRestDone() {
  playRestDone();
  haptic('restOver');
}

let _detailId = null;
function openWorkoutDetail(id) {
  const w = store.workoutById(id);
  if (!w) return;
  _detailId = id;
  // the session sheet and the gym logger inside it; closing it any way forgets
  // the open session (the gym ticker stops once no logger is open)
  const root = openLayer('workout', { reuse: false, onClose: () => { if (_detailId === id) _detailId = null; } });
  root.innerHTML = `<div class="modal-backdrop" data-wd-close></div>
    <div class="modal wd-modal" role="dialog" aria-modal="true" aria-label="${esc(planTitle(w.title))}">
      ${sheetHead({ title: `${esc(planTitle(w.title))}`, closeAttr: 'data-wd-close' })}
      <div class="modal-body" id="wd-body">${renderWorkoutDetail(w, store.getSettings().units, buildCtx())}</div>
    </div>`;
  root.querySelectorAll('[data-wd-close]').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
  typeLines(root);
  wireLogger(root, gymDeps);
  if (root.querySelector('[data-gl-bar]')) startTicker((wid) => store.workoutById(wid), onRestDone);
}
function openSportLevels(sport) {
  if (!sport) return;
  const xp = buildCtx().boost.sportXp[sport] || 0;
  const lv = sportLevelOf(sport, xp);
  const root = openLayer('levels');
  root.innerHTML = `<div class="modal-backdrop" data-wd-close></div>
    <div class="modal wd-modal lvl-sheet" role="dialog" aria-modal="true" aria-label="${esc(t('main.levelsAria', { sport: (DISCIPLINES[sport] || DISCIPLINES.other).label }))}">
      ${sheetHead({ icon: 'star', title: t('main.levels'), closeAttr: 'data-wd-close' })}
      <div class="modal-body">${sportLevelCarousel(sport, lv.artLevel)}${prestigePanel(sport, xp)}</div>
    </div>`;
  root.querySelectorAll('[data-wd-close]').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
  root.querySelector('[data-prestige]')?.addEventListener('click', async (e) => {
    const name = (DISCIPLINES[sport] || DISCIPLINES.other).label;
    if (!confirm(t('loop.prestige.confirm', { sport: name, lv: PRESTIGE.level, pct: PRESTIGE.bonusBp / 100 }))) return;
    await busy(e.currentTarget, async () => {
      try {
        await takePrestige(sport, xp);
        haptic('levelUp');
        toast(`<b>${t('loop.prestige.done', { sport: esc(name) })}</b>`, { icon: svg('star') });
        closeLayer(root);
        render();
      } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
    });
  });
  // Centre the current-level frame in the swipeable strip.
  const cur = root.querySelector('.lvl-frame.is-current');
  if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// Prestige (docs/LOOP.md §4.3): only here, in the levels sheet you opened, and
// only once you've reached the level or hold a star. Opt-in, said plainly,
// never suggested anywhere else.
function prestigePanel(sport, xp) {
  if (!gearEnabled()) return '';
  const lv = sportLevelOf(sport, xp);
  if (!lv.stars && lv.level < PRESTIGE.level) return '';
  const can = canPrestige(xp, gearState().prestige, sport);
  const name = (DISCIPLINES[sport] || DISCIPLINES.other).label;
  const stars = Array.from({ length: PRESTIGE.maxStars }, (_, i) => `<i class="${i < lv.stars ? 'on' : ''}">★</i>`).join('');
  const foot = can.ok
    ? `<button class="btn ghost" data-prestige>${svg('star')} ${t('loop.prestige.button', { sport: esc(name) })}</button>`
    : `<p class="gw-note">${can.reason === 'max' ? t('loop.prestige.max') : t('loop.prestige.next', { lv: PRESTIGE.level, n: lv.level })}</p>`;
  return `<section class="pr-panel" aria-labelledby="pr-h">
    <h3 id="pr-h" class="gw-row-h">${svg('star')} ${t('loop.prestige.title')}</h3>
    <p class="pr-stars" role="img" aria-label="${esc(t('loop.prestige.starsAria', { n: lv.stars }))}">${stars}</p>
    <p class="gw-note">${t('loop.prestige.what', { sport: esc(name), lv: PRESTIGE.level, pct: PRESTIGE.bonusBp / 100 })}</p>
    <p class="gw-note">${t('loop.prestige.keeps')}</p>
    ${foot}
  </section>`;
}

// Fullscreen immersive lightbox for a single level frame. Tapping anywhere fades it out.
function openLightbox(src, sport) {
  if (!src) return;
  const root = openLayer('lightbox', { reuse: false });
  root.innerHTML = `<div class="level-lightbox --${sport || 'other'}" role="dialog" aria-label="${t('main.artwork')}"><img src="${esc(src)}" alt="${t('main.artwork')}"></div>`;
  const box = root.firstElementChild;
  box.addEventListener('click', () => closeLayer(root));
  requestAnimationFrame(() => box.classList.add('show'));
}
function refreshDetail(id) {
  if (_detailId !== id) return;
  const body = document.getElementById('wd-body');
  const w = store.workoutById(id);
  if (!body || !w) return;
  const top = body.scrollTop;
  body.innerHTML = renderWorkoutDetail(w, store.getSettings().units, buildCtx());
  body.scrollTop = top;
  wireLogger(body, gymDeps);
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
      toast(t('main.stravaAuto', { link: r.link || 0, insert: r.insert || 0 }), { icon: svg('sync') });
    }
  } catch { /* silent — never interrupt the athlete */ }
}

// ---- account / sync UI ------------------------------------------------------

function accountSectionHtml() {
  if (!SYNC_ENABLED) return '';
  const u = auth.currentUser();
  const acct = u
    ? `<div class="signed-in"><div><b>${svg('cloud')} ${t('main.signedIn')}</b><br><span class="muted small">${esc(u.email || t('main.yourAccount'))}</span></div>
         <button class="btn ghost" data-set-do="signout">${t('main.signOut')}</button></div>`
    : `<button class="btn primary block" data-set-do="signin">${svg('cloud')} ${t('main.signInSync')}</button>`;
  const strava = (u && STRAVA_ENABLED)
    ? `<div class="strava-block">
         <div class="row">
           <button class="btn ghost" data-set-do="strava-connect">${svg('link')} ${t('main.connectStrava')}</button>
           <button class="btn ghost" data-set-do="strava-sync">${svg('sync')} ${t('main.syncNow')}</button>
           <button class="btn ghost danger" data-set-do="strava-disconnect">${t('main.disconnect')}</button>
         </div>
         <div class="powered-by-strava">${t('main.poweredByStrava')}</div>
       </div>`
    : '';
  return `<h3>${t('main.account')}</h3>${acct}${strava}<hr>`;
}

function renderSyncBanner() {
  const el = document.getElementById('sync-banner');
  if (!el) return;
  if (SYNC_ENABLED && !auth.currentUser() && !sessionStorage.getItem('tq-sync-dismissed')) {
    el.innerHTML = `<div class="sync-prompt">${svg('cloud')}<span>${esc(t('main.syncPrompt'))}</span>
      <button class="link" data-action="open-auth">${t('main.signIn')}</button>
      <button class="icon-btn tiny" data-action="dismiss-sync" aria-label="${t('main.dismiss')}">${svg('close')}</button></div>`;
  } else {
    el.innerHTML = '';
  }
}

function onAuthChange(user, opts = {}) {
  if (!opts.remote) { appState.lastLevel = null; appState.seen = null; } // no level-up or XP pops on a data swap
  if (user && !opts.remote) { autoStravaSync(); syncQuestClaims({ force: true }); }
  if (user) { startSocial(); startRoom(); refreshGear(); refreshFeats(); refreshChallenges(); } else { stopSocial(); stopRoom(); stopChallenges(); }
  paintBell();
  render();
  if (topLayerName() === 'settings') openSettings();
}

function handleRedirectParams() {
  const url = new URL(location.href);
  const strava = url.searchParams.get('strava');
  if (strava) {
    const sr = url.searchParams.get('sr'); // failure reason from the callback fn
    let msg = ['connected', 'denied', 'error', 'auth_failed'].includes(strava) ? t(`main.strava.${strava}`) : '';
    if (strava === 'error' && sr) msg += `: ${decodeURIComponent(sr)}`;
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
  const root = openLayer('welcome', { swipeBack: false, onClose: () => localStorage.setItem('moske-onboarded', '1') });
  const cards = [
    { icon: 'coach', img: COACH.full, k: 'coach' },
    { icon: 'plus', k: 'plus' },
    { icon: 'install', k: 'install' },
  ];
  let i = 0;
  const draw = () => {
    const c = cards[i];
    root.innerHTML = `<div class="modal-backdrop"></div>
      <div class="modal onboard" role="dialog" aria-modal="true" aria-label="${t('main.welcome.aria')}">
        <div class="modal-body onboard-body">
          <div class="onboard-icon">${c.img ? `<img class="onboard-coach" src="${esc(c.img)}" alt="${t('main.welcome.coachAlt')}" width="109" height="189">` : svg(c.icon)}</div>
          <h2>${t(`main.welcome.${c.k}T`)}</h2><p class="muted">${t(`main.welcome.${c.k}B`)}</p>
          <div class="onboard-dots">${cards.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <footer class="modal-foot"><button class="btn ghost" data-ob="skip">${t('main.welcome.skip')}</button><span class="spacer"></span>
          <button class="btn primary" data-ob="next">${i === cards.length - 1 ? t('main.welcome.start') : t('main.welcome.next')}</button></footer>
      </div>`;
    const done = () => closeLayer(root);
    root.querySelector('[data-ob="skip"]').addEventListener('click', done);
    root.querySelector('[data-ob="next"]').addEventListener('click', () => { if (i === cards.length - 1) done(); else { i++; draw(); } });
  };
  draw();
}

// ---- boot -------------------------------------------------------------------

async function boot() {
  // ?demo=1 only: a hook so screenshots and clips can show moments on demand
  if (new URLSearchParams(location.search).has('demo')) window.moskeDemo = { levelUp: (sport = 'run', level = 3) => openLevelUp(sport, level) };
  await store.init();
  syncLang(store.getSettings());
  applyStatic();
  const today = todayISO();
  appState.journalDate = today;
  // Restore last tab.
  const savedTab = localStorage.getItem('moske-tab');
  if (['home', 'journal', 'leaderboards', 'shop', 'chat', 'progress'].includes(savedTab)) appState.tab = savedTab;

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
  startTicker((wid) => store.workoutById(wid), onRestDone); // a rest started before a reload still beeps
  document.addEventListener('moske:open-workout', (e) => { closeAllLayers(); render(); openWorkoutDetail(e.detail); });
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
  // friends, chat and the bell: live once signed in
  wireSocialUi({ getTab: () => appState.tab });
  document.addEventListener('moske:open-chat', (e) => {
    closeAllLayers();
    const from = appState.tab;
    appState.tab = 'chat';
    localStorage.setItem('moske-tab', 'chat');
    withTabTransition(from, 'chat', () => { render(); openThread(e.detail); });
  });
  document.addEventListener('moske:open-athlete', (e) => {
    const a = athleteByUid(e.detail.uid); // the leaderboard's numbers when it has them
    morph([{ name: 'athlete-avatar', from: e.detail.from || null, to: '[data-vt="athlete-avatar"]' }],
      () => openPublicFitness({ uid: e.detail.uid, name: e.detail.name, avatar: e.detail.avatar || a?.avatar || null, xp: a?.xp ?? null }));
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSocial(); });
  // Home, Ranks and Chat: pull down from the top to refresh
  enablePull(document.getElementById('view'), {
    // (in General, scrolling to the top loads earlier messages instead)
    when: () => ['home', 'leaderboards', 'chat'].includes(appState.tab) && !hasLayers() && !(appState.tab === 'chat' && chatMode() === 'general'),
    onRefresh: async () => {
      if (appState.tab === 'leaderboards') { await loadLeaderboard(appState.lbView, todayISO()); return; }
      if (appState.tab === 'chat') { await refreshSocial(); return; }
      await Promise.all([store.refresh(), auth.currentUser() ? autoStravaSync() : null]);
      render();
    },
  });
  // Profile tab: swipe left / right to change sport, as well as the four buttons
  onSwipe(document.getElementById('view'), (dir) => setPgSport(nextSport(SPORT_ORDER, appState.pgSport, dir)), {
    when: () => appState.tab === 'progress' && appState.pgView === 'scene' && !document.querySelector('.layer'),
  });

  // gear and gels: re-render when the server copy changes; a gel running out redraws too
  onGear(() => render());
  // the stage's room buttons switch the room on the Profile tab
  document.addEventListener('dg-room', () => { if (appState.tab === 'progress') render(); });
  // where your compound items stand, from the server (another device may have moved them)
  onPlacements(() => { if (appState.tab === 'progress') render(); });
  refreshPlacements();
  // a season that closed while you were away leaves its recap card, once
  setTimeout(maybeShowRecap, 1500);
  // the workshop finished something: the stamp lands (once per job), then the toast
  onWorkshopFinish((jobs) => {
    const names = jobs.map((j) => gearById(j.item_id)?.name || propById(j.item_id)?.name).filter(Boolean);
    if (!names.length) return;
    const j = jobs[0];
    if (firstStamp(`ws:${j.id}:${j.finishes_at}`)) {
      stampRecord({ name: names[0], prs: [], kicker: t('loop.ws.fitted'), icon: 'wrench', target: document.querySelector('.pg-scene-btn.is-shop') });
    }
    toast(`<b>${t('loop.ws.fittedToast')}</b><br>${names.map(esc).join(' · ')}`, { icon: svg('wrench') });
    haptic('record');
    render();
  });
  // a feat just won: say so, then redraw the board
  onFeats((fresh) => {
    for (const a of fresh.slice(0, 3)) {
      const text = featWonText(a);
      if (text) toast(text, { icon: svg('trophy') });
    }
    if (fresh.length) haptic('levelUp');
    render();
  });
  // a challenge you're in just settled: where you came, and what came back
  onChallenges((why, done) => {
    if (why !== 'settled') return;
    for (const d of done.slice(0, 3)) {
      const text = settleText(d);
      if (text) toast(text, { icon: svg(d.row?.payout ? 'coin' : 'flag') });
    }
    if (done.some((d) => d.row?.payout && d.result.outcome === 'settled')) { playAccept(); haptic('record'); }
  });
  startGelTicker(() => render());

  if (SYNC_ENABLED) Promise.resolve(auth.initAuth(onAuthChange)).then(() => { autoStravaSync(); startSocial().then(() => paintBell()); startRoom(); });
  else { startSocial().then(() => paintBell()); startRoom(); } // demo mode

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

boot();
