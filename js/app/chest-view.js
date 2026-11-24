// chest-view.js — reward chests on screen (docs/REWARDS.md): the banner that
// slides down when a session leaves a chest, the Home card while one waits, the
// opening (the chest's clip and sound, then its rewards one tap at a time), and
// the admin tools that preview or gift a chest.
//
// The opening (openChestModal() has the beats): three taps break the chest open,
// its clip and sound play together, and its rewards rise on top of the open
// chest one tap at a time. The server is asked to open the chest on the first
// tap, so the numbers are ready by the time they're shown; a preview asks
// nothing and pays nothing.

import { openLayer, closeLayer } from './nav.js';
import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum, fmtDate } from '../core/i18n.js';
import { DISCIPLINES } from '../core/disciplines.js';
import { mountChest3d } from './chest3d.js';
import { chestArt, topTier, sessionBase, TIERS, CHEST_RULES } from '../core/rewards.js';
import { GEAR_RULES } from '../core/gear.js';
import { earnedBySession } from '../core/wallet.js';
import { toast, prefersReducedMotion } from './effects.js';
import { haptic } from './haptics.js';
import * as store from './store.js';
import { pendingChests, openChest, giftChest, previewChest, markAnnounced, unannounced } from './chests-state.js';
import { gearError } from './gear-state.js';
import { CUR_ART } from './shop-ui.js';
import { makeChestFx } from './chest-fx.js';

export const TIER_COLOR = { common: '#E6D7BD', uncommon: '#4CC38A', rare: '#5B9BFF', epic: '#B57BFF', legendary: '#FFC94A', mythic: '#6FF0FF' };
const ENABLED = TIERS.filter((x) => CHEST_RULES.enabled[x]);

/**
 * Can this browser draw a WebM clip with its transparency? Chromium and Firefox
 * can; Safari (every browser on iPhone) plays WebM but ignores the alpha, so it
 * plays the same clip as an animated WebP instead.
 */
export function alphaVideo() {
  if (typeof document === 'undefined') return false;
  const v = document.createElement('video');
  if (!v.canPlayType || !v.canPlayType('video/webm; codecs="vp9"')) return false;
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
  return !(ios || safari);
}

const soundOn = () => !!store.getSettings()?.sound;
const workoutOf = (c) => (c.workout_id ? store.getWorkouts().find((w) => w.id === c.workout_id) : null);
const tierName = (tier) => t(`chest.tier.${tier}`);
const boxName = (tier) => t(`chest.box.${tier}`);

/** "Hard ride · Tue 4 Nov", or "A gift" for a chest that isn't from a session. */
function fromLine(c) {
  if (c.source === 'gift') return t('chest.gift');
  const w = workoutOf(c);
  const type = w?.type || c.type;
  const sport = type ? (DISCIPLINES[type] || DISCIPLINES.other).label : '';
  const parts = [c.difficulty ? t(`chest.diff.${c.difficulty}`) : '', sport, c.day ? fmtDate(c.day, { weekday: 'short', day: 'numeric', month: 'short' }) : ''];
  return parts.filter(Boolean).join(' · ');
}

/**
 * What the session itself earned (paid when it synced) and the chest's bonus on
 * top. The session's share comes from the device's copy of it; when that isn't
 * here (not synced yet, or the demo), from the XP the server recorded for it.
 */
function rewardsOf(c) {
  const w = workoutOf(c);
  const est = sessionBase(c.xp);
  const base = w ? earnedBySession(w, store.getWorkouts())
    : { coins: Math.min(GEAR_RULES.dailyCoinCap, est.coins), carbs: Math.min(GEAR_RULES.dailyCarbCap, est.carbs) };
  return {
    coins: { base: Math.max(0, base.coins), bonus: Number(c.coins) || 0 },
    carbs: { base: Math.max(0, base.carbs), bonus: Number(c.carbs) || 0 },
  };
}

// ---- the Home card ---------------------------------------------------------------------------

/** "Your last session rewards are ready", while any chest waits (renderHome). */
export function homeChestCard() {
  const p = pendingChests();
  if (!p.length) return '';
  const top = topTier(p);
  const latest = p[0];
  const sub = p.length > 1 ? t('chest.home.more', { n: p.length, box: boxName(latest.tier) }) : `${boxName(latest.tier)} · ${fromLine(latest)}`;
  return `<section class="cx-home" data-action="open-chests" role="button" tabindex="0" style="--tc:${TIER_COLOR[top]}"
      aria-label="${esc(t('chest.home.aria', { n: p.length }))}">
    <span class="cx-home-art" aria-hidden="true"><img src="${chestArt(top).still}" width="512" height="512" alt="" draggable="false"></span>
    <span class="cx-home-text"><small>${t('chest.home.eyebrow')}</small><b>${t('chest.home.title')}</b><span>${esc(sub)}</span></span>
    <span class="cx-home-go" aria-hidden="true">${t('chest.open')}</span>
    ${p.length > 1 ? `<i class="cx-home-count" aria-hidden="true">${p.length}</i>` : ''}
  </section>`;
}

// ---- the chest on the base ------------------------------------------------------------------

/** The waiting chest, floating at the bottom middle of the base (renderDiorama): it bobs, now and
 *  then it rattles as if something inside wants out, and a tap opens the queue. Updated in place
 *  when the chests change (main.js onChests), so the base isn't drawn again. */
export function chestFloat() {
  const p = pendingChests();
  if (!p.length) return '';
  const top = topTier(p);
  return `<button type="button" class="cx-float" data-action="open-chests" style="--tc:${TIER_COLOR[top]}"
      aria-label="${esc(t('chest.home.aria', { n: p.length }))}">
    <span class="cx-float-glow" aria-hidden="true"></span>
    <span class="cx-float-art" aria-hidden="true"><img src="${chestArt(top).still}" width="448" height="448" alt="" draggable="false"></span>
    <b class="cx-float-go">${t('chest.open')}</b>
    ${p.length > 1 ? `<i class="cx-float-n" aria-hidden="true">${p.length}</i>` : ''}
  </button>`;
}
/** Put the floating chest right after the chests changed (it's only drawn with the base). */
export function refreshChestFloat() {
  document.querySelectorAll('[data-cx-float]').forEach((el) => { el.innerHTML = chestFloat(); });
}

// ---- the banner --------------------------------------------------------------------------------

let bannerTimer = null;
/** The pill that slides down when a session has left a chest. Each chest is announced once. */
export function showChestBanner(chests = unannounced()) {
  if (!chests.length) return;
  markAnnounced(chests.map((c) => c.id));
  document.querySelector('.cx-banner')?.remove();
  clearTimeout(bannerTimer);
  const c = chests[0];
  const el = document.createElement('div');
  el.className = 'cx-banner';
  el.setAttribute('role', 'status');
  el.style.setProperty('--tc', TIER_COLOR[c.tier]);
  el.innerHTML = `<button class="cx-banner-main" data-cx-open>
      <span class="cx-banner-badge" aria-hidden="true"><img src="${chestArt(c.tier).still}" width="512" height="512" alt=""><i></i></span>
      <span class="cx-banner-text"><b>${t('chest.banner.title')}</b><small>${esc(chests.length > 1 ? t('chest.banner.many', { n: chests.length }) : t('chest.banner.one', { box: boxName(c.tier) }))}</small></span>
      <span class="cx-banner-go">${t('chest.open')} ${svg('chevron')}</span>
    </button>
    <button class="cx-banner-x" data-cx-dismiss aria-label="${t('main.dismiss')}">${svg('close')}</button>`;
  const hide = () => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260); clearTimeout(bannerTimer); };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-cx-dismiss]')) { hide(); return; }
    if (e.target.closest('[data-cx-open]')) { el.remove(); clearTimeout(bannerTimer); openChestQueue(chests[0].preview ? chests : null); }
  });
  document.body.appendChild(el);
  haptic('request');
  // ignored: it folds away after a while; the Home card keeps the chest
  bannerTimer = setTimeout(hide, 12000);
}

// ---- the opening ------------------------------------------------------------------------------

/** Open the waiting chests one after another, newest first (or the given ones). */
export function openChestQueue(list = null) {
  const queue = list ? [...list] : [...pendingChests()];
  if (!queue.length) return null;
  return openChestModal(queue.shift(), { queue });
}

const tween = (el, to, ms) => {
  if (prefersReducedMotion() || !to) { el.textContent = fmtNum(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = fmtNum(Math.round(to * (1 - (1 - k) ** 3)));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

/** A shower of coins (or carbs) from the chest to its row. */
function shower(stage, from, to, src, n = 14) {
  if (prefersReducedMotion()) return;
  const s = stage.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const x0 = a.left + a.width / 2 - s.left; const y0 = a.top + a.height * 0.45 - s.top;
  const x1 = b.left + b.width / 2 - s.left; const y1 = b.top + b.height / 2 - s.top;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('img');
    p.className = 'cx-spark';
    p.src = src; p.alt = ''; p.width = 32; p.height = 32;
    const spread = (Math.random() - 0.5) * 220;
    p.style.cssText = `left:${x0}px;top:${y0}px;--mx:${spread}px;--my:${-60 - Math.random() * 120}px;--dx:${x1 - x0}px;--dy:${y1 - y0}px;animation-delay:${i * 28}ms`;
    stage.appendChild(p);
    setTimeout(() => p.remove(), 1100 + i * 28);
  }
}

/** How long the build-up before the burst runs, by tier: the rarer, the longer the wait (ms). */
const CHARGE_MS = { common: 480, uncommon: 600, rare: 760, epic: 960, legendary: 1200, mythic: 1450 };
/** How big the burst is, by tier. */
const BURST = { common: 0.8, uncommon: 1, rare: 1.2, epic: 1.45, legendary: 1.8, mythic: 2.1 };
/** Taps it takes to break a chest open. */
const TAPS = 3;

/**
 * The chest opening. `chest.preview` plays it without asking the server (the
 * admin preview and the simulated workout); otherwise the server opens it on
 * the first tap. All of it is drawn in code from the shut and open stills, so it
 * answers every tap (chest-fx.js draws the sparks):
 *
 *   shut    the shut chest, rocking now and then: "Tap to open" and three pips; each
 *           tap squashes it a step smaller, kicks it with a hard wiggle, throws a few
 *           sparks, and lights it a little more from inside
 *   charge  the third tap: it rises and shakes faster and faster while light is pulled
 *           into it; the rarer the chest, the longer the wait
 *   burst   a flash, the stage jolts, the open still takes over in a squash-and-stretch
 *           pop, shards and stars fly out
 *   ready   the open chest breathes, lit by the tier's rays, sparkles rising from it
 *   coins, carbs, done   a tap each, the rewards rising on top of the open chest
 */
export function openChestModal(chest, { queue = [] } = {}) {
  const art = chestArt(chest.tier);
  const calm = prefersReducedMotion();
  const color = TIER_COLOR[chest.tier];
  let phase = 'shut';
  let taps = 0;
  let opened = null;
  let fx = null;
  const timers = [];
  // the sound is made ready now, inside the tap that opened this, so the third tap can start it
  const audio = soundOn() ? Object.assign(new Audio(art.mp3), { preload: 'auto' }) : null;
  audio?.load();
  const root = openLayer('chest', {
    className: 'cx-layer', instant: true, reuse: false,
    onClose: () => { audio?.pause(); fx?.stop(); c3d?.dispose(); timers.forEach(clearTimeout); },
  });
  root.innerHTML = `<div class="cx tier-${chest.tier}${calm ? ' is-calm' : ''}" role="dialog" aria-modal="true" aria-labelledby="cx-title" style="--tc:${color}">
    <div class="cx-bg" aria-hidden="true"><i class="cx-rays"></i><i class="cx-glow"></i><i class="cx-flash"></i></div>
    <header class="cx-head">
      <p class="cx-from">${esc(fromLine(chest))}${chest.preview ? ` · <b>${t('chest.preview')}</b>` : ''}</p>
      <h2 id="cx-title" class="cx-tier"><span>${esc(tierName(chest.tier))}</span><small>${esc(boxName(chest.tier))}</small></h2>
    </header>
    <div class="cx-box">
      <div class="cx-squash"><div class="cx-wiggle">
        <img class="cx-still" src="${art.still}" width="448" height="448" alt="${esc(boxName(chest.tier))}" draggable="false">
        <img class="cx-open" src="${art.open}" width="448" height="448" alt="" draggable="false" hidden>
      </div></div>
    </div>
    <canvas class="cx-fx" aria-hidden="true"></canvas>
    <i class="cx-white" aria-hidden="true"></i>
    <div class="cx-loot" aria-live="polite"></div>
    <p class="cx-hint"><span>${t('chest.hint.open')}</span><i class="cx-pips" aria-hidden="true">${'<b></b>'.repeat(TAPS)}</i></p>
    <footer class="cx-foot">
      <button class="cx-skip" data-cx-skip>${t('chest.skip')}</button>
      <button class="sc-buy cx-collect" data-cx-collect hidden>${queue.length ? t('chest.next', { n: queue.length }) : t('chest.collect')}</button>
    </footer>
  </div>`;
  const stage = root.querySelector('.cx');
  const box = root.querySelector('.cx-box');
  const squash = root.querySelector('.cx-squash');
  const wiggle = root.querySelector('.cx-wiggle');
  const openStill = root.querySelector('.cx-open');
  const loot = root.querySelector('.cx-loot');
  const hint = root.querySelector('.cx-hint span');
  const pips = root.querySelector('.cx-pips');
  const collect = root.querySelector('[data-cx-collect]');
  const skipBtn = root.querySelector('[data-cx-skip]');
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  fx = makeChestFx(root.querySelector('.cx-fx'), color, { calm });
  // the chest in 3D where the phone draws it (chest3d.js): it drops in, flips on each tap, and opens under a
  // white flash; the stills stay under it till it's drawn, and take over where it can't be
  const c3d = calm ? null : mountChest3d(wiggle, chest.tier, color);
  let has3d = false;
  c3d?.ready.then((ok) => {
    if (!ok || !stage.isConnected) return;
    has3d = true; stage.classList.add('has-3d');
    if (phase === 'shut' && !taps) c3d.drop(); else if (phase !== 'shut') c3d.open(true);
  });
  // a point of the chest, in the stage's px (where the sparks come from): dy up from its middle, in its heights
  const mid = (dy = 0) => {
    const a = stage.getBoundingClientRect(); const b = box.getBoundingClientRect();
    return [b.left + b.width / 2 - a.left, b.top + b.height * (0.5 + dy) - a.top];
  };
  new Image().src = art.open;

  // the server opens the chest on the first tap (closing before that opens nothing)
  const openOnServer = () => {
    opened ||= chest.preview ? Promise.resolve(chest) : openChest(chest.id);
    opened.catch((err) => { toast(gearError(err), { icon: svg('warn') }); closeLayer(root); });
    return opened;
  };

  const toReady = () => {
    if (phase !== 'play' && phase !== 'burst') return;
    phase = 'ready';
    openStill.hidden = false; wiggle.classList.add('is-ended');
    stage.classList.remove('is-charging');
    stage.classList.add('is-ready');
    hint.textContent = t('chest.hint.collect');
    const [x, y] = mid(-0.12);
    fx.drift(x, y, box.offsetWidth * 0.4);
  };

  // the build-up, then the burst
  const burst = () => {
    if (phase !== 'play') return;
    phase = 'burst';
    stage.classList.remove('is-charging');
    stage.classList.add('is-burst');
    openStill.hidden = false; wiggle.classList.add('is-ended');
    box.classList.remove('is-pop'); void box.offsetWidth; box.classList.add('is-burst');
    if (has3d) c3d.open();
    const [x, y] = mid(-0.05);
    fx.burst(x, y, BURST[chest.tier] || 1);
    haptic(['epic', 'legendary', 'mythic'].includes(chest.tier) ? 'levelUp' : 'record');
    later(toReady, calm ? 0 : 520);
  };
  const play = () => {
    phase = 'play';
    audio?.play().catch(() => {});
    if (calm) { burst(); return; }
    const ms = CHARGE_MS[chest.tier] || 700;
    stage.style.setProperty('--charge-ms', `${ms}ms`);
    stage.classList.add('is-charging');
    if (has3d) c3d.charge(ms);
    const [x, y] = mid();
    fx.charge(x, y, ms);
    // the shakes quicken: a tick at a half and three quarters of the wait
    later(() => haptic('tick'), ms * 0.5); later(() => haptic('tick'), ms * 0.78);
    later(burst, ms);
  };

  // after the third tap the chest finishes its shake and springs back to its size, and only
  // then does the clip start: it begins on the chest's own first frame, at rest
  const settle = (el, event, ms) => new Promise((res) => {
    let done = false; const end = () => { if (!done) { done = true; res(); } };
    el.addEventListener(event, end, { once: true }); later(end, ms);
  });
  const arm = async () => {
    phase = 'arming';
    pips.hidden = true;
    hint.textContent = '';
    if (has3d) await new Promise((res) => later(res, 640));   // its last flip lands
    else if (!calm) await settle(wiggle, 'animationend', 450);
    if (phase !== 'arming') return;
    box.classList.add('is-pop');
    squash.style.removeProperty('--sq');
    if (!calm && !has3d) await settle(squash, 'transitionend', 360);
    if (phase !== 'arming') return;
    play();
  };
  const tap = () => {
    if (taps >= TAPS) return;
    taps += 1;
    if (taps === 1) openOnServer();
    pips.children[taps - 1]?.classList.add('on');
    squash.style.setProperty('--sq', String(1 - taps * 0.08));
    wiggle.classList.remove('is-hit');
    void wiggle.offsetWidth; // restart the wiggle
    wiggle.classList.add('is-hit');
    stage.style.setProperty('--lit', String(taps / TAPS));
    if (has3d) c3d.tap(taps);
    const [x, y] = mid(-0.2);
    fx.puff(x, y, 6 + taps * 4);
    haptic('tick');
    if (taps >= TAPS) arm();
  };

  const row = (cur, r) => `<div class="cx-row is-${cur}${r.base ? '' : ' is-flat'}">
      <img class="cx-ico" src="${CUR_ART[cur]}" width="64" height="64" alt="">
      <span class="cx-amt"><b class="cx-total data-num">0</b>${cur === 'carbs' ? '<i class="cx-unit">g</i>' : ''}
        <small>${t(`chest.${cur}`)} · ${r.base ? t('chest.fromSession', { n: fmtNum(r.base) }) : t('chest.bonusOnly')}</small></span>
      <span class="cx-bonus"><b>+${fmtNum(r.bonus)}</b><small>${t('chest.bonus')}</small></span>
    </div>`;
  const reveal = async (cur, { quick = false } = {}) => {
    const c = await openOnServer();
    const r = rewardsOf(c)[cur];
    loot.insertAdjacentHTML('beforeend', row(cur, r));
    const el = loot.lastElementChild;
    if (quick) { el.querySelector('.cx-total').textContent = fmtNum(r.base + r.bonus); el.classList.add('is-in', 'has-bonus'); return; }
    requestAnimationFrame(() => el.classList.add('is-in'));
    tween(el.querySelector('.cx-total'), r.base + r.bonus, 900);
    later(() => el.classList.add('has-bonus'), 520);
    shower(stage, box, el.querySelector('.cx-ico'), CUR_ART[cur]);
    const [x, y] = mid(-0.15);
    fx.burst(x, y, 0.45);
    haptic('tick');
  };
  const finish = () => {
    phase = 'done';
    fx.stopDrift();
    stage.classList.add('is-done');
    hint.textContent = '';
    skipBtn.hidden = true;
    collect.hidden = false;
    collect.focus({ preventScroll: true });
  };
  const advance = async () => {
    if (phase === 'shut') { tap(); return; }
    if (phase === 'ready') { phase = 'coins'; stage.classList.add('is-open'); hint.textContent = t('chest.hint.more'); await reveal('coins'); return; }
    if (phase === 'coins') { phase = 'carbs'; await reveal('carbs'); later(finish, 700); }
  };
  const skip = async () => {
    if (phase === 'done') return;
    timers.forEach(clearTimeout);
    audio?.pause();
    phase = 'play';
    pips.hidden = true;
    squash.style.removeProperty('--sq');
    if (has3d) c3d.open(true);
    toReady();
    stage.classList.add('is-open');
    if (!loot.querySelector('.is-coins')) await reveal('coins', { quick: true });
    if (!loot.querySelector('.is-carbs')) await reveal('carbs', { quick: true });
    finish();
  };
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-cx-skip]')) { skip(); return; }
    if (e.target.closest('[data-cx-collect]')) {
      closeLayer(root);
      if (queue.length) setTimeout(() => openChestModal(queue.shift(), { queue }), 120);
      return;
    }
    advance();
  });
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) { e.preventDefault(); advance(); }
  });
  return root;
}

// ---- admin tools (Settings) ------------------------------------------------------------------------

/** Admins only: play any tier (pays nothing), gift yourself a real one, or fake a finished workout. */
export function adminChestTools() {
  return `<hr><h3>${svg('bag')} ${t('chest.admin.title')}</h3>
    <p class="muted small">${t('chest.admin.note')}</p>
    <div class="cx-admin">${ENABLED.map((tier) => `<div class="cx-admin-row" style="--tc:${TIER_COLOR[tier]}">
        <img src="${chestArt(tier).still}" width="512" height="512" alt="">
        <b>${esc(tierName(tier))}</b>
        <button class="btn tiny ghost" data-cx-admin="preview" data-tier="${tier}" aria-label="${esc(t('chest.admin.previewAria', { tier: tierName(tier) }))}">${svg('play')} ${t('chest.admin.preview')}</button>
        <button class="btn tiny" data-cx-admin="gift" data-tier="${tier}" aria-label="${esc(t('chest.admin.giftAria', { tier: tierName(tier) }))}">${t('chest.admin.gift')}</button>
      </div>`).join('')}</div>
    <button class="btn ghost block" data-cx-admin="simulate">${svg('bolt')} ${t('chest.admin.simulate')}</button>`;
}

export function wireAdminTools(root, { onGift } = {}) {
  root.querySelectorAll('[data-cx-admin]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.cxAdmin;
    if (act === 'preview') { openChestModal(previewChest(b.dataset.tier)); return; }
    if (act === 'simulate') {
      // a made-up hard session: the banner as a real one would show it (nothing is paid)
      closeLayer(root);
      setTimeout(() => showChestBanner([previewChest(null, { difficulty: 'hard' })]), 200);
      return;
    }
    if (act === 'gift') {
      b.disabled = true;
      try {
        const c = await giftChest(b.dataset.tier);
        toast(t('chest.admin.gifted', { tier: tierName(c.tier) }), { icon: svg('bag') });
        onGift?.(c);
      } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
      b.disabled = false;
    }
  }));
}
