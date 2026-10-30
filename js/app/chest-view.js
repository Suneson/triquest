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
import { chestArt, topTier, sessionBase, TIERS, CHEST_RULES } from '../core/rewards.js';
import { GEAR_RULES } from '../core/gear.js';
import { earnedBySession } from '../core/wallet.js';
import { toast, prefersReducedMotion } from './effects.js';
import { haptic } from './haptics.js';
import * as store from './store.js';
import { pendingChests, openChest, giftChest, previewChest, markAnnounced, unannounced } from './chests-state.js';
import { gearError } from './gear-state.js';
import { CUR_ART } from './shop-ui.js';

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

/** How long each clip runs, in seconds (the clips are 24 fps). */
const CLIP_SECONDS = { common: 3.04, uncommon: 4.05, rare: 3.04, epic: 4.05, legendary: 4.04, mythic: 5.04 };
/** Taps it takes to break a chest open. */
const TAPS = 3;

/**
 * The chest opening. `chest.preview` plays it without asking the server (the
 * admin preview and the simulated workout); otherwise the server opens it on
 * the first tap.
 *
 *   shut    the chest's first frame, rocking gently: "Tap to open" and three pips;
 *           each tap squashes it a step smaller with a hard wiggle
 *   play    the third tap: it springs back to full size and the clip and its sound
 *           start together (the first frame is the still, so nothing jumps)
 *   ready   the clip holds its last frame, the open chest, lit by the tier's rays
 *   coins, carbs, done   a tap each, the rewards rising on top of the open chest
 *
 * WebM where the browser draws its transparency; Safari (every iPhone browser)
 * plays the same clip as an animated WebP made from its frames.
 */
export function openChestModal(chest, { queue = [] } = {}) {
  const art = chestArt(chest.tier);
  const webm = alphaVideo();
  const calm = prefersReducedMotion();
  const color = TIER_COLOR[chest.tier];
  const seconds = CLIP_SECONDS[chest.tier] || 4;
  let phase = 'shut';
  let taps = 0;
  let opened = null;
  let animUrl = null;
  const timers = [];
  // the sound is made ready now, inside the tap that opened this, so the third tap can start it
  const audio = soundOn() ? Object.assign(new Audio(art.mp3), { preload: 'auto' }) : null;
  audio?.load();
  const root = openLayer('chest', {
    className: 'cx-layer', instant: true, reuse: false,
    onClose: () => { audio?.pause(); timers.forEach(clearTimeout); if (animUrl) URL.revokeObjectURL(animUrl); },
  });
  root.innerHTML = `<div class="cx tier-${chest.tier}${calm ? ' is-calm' : ''}" role="dialog" aria-modal="true" aria-labelledby="cx-title" style="--tc:${color}">
    <div class="cx-bg" aria-hidden="true"><i class="cx-rays"></i><i class="cx-flash"></i></div>
    <header class="cx-head">
      <p class="cx-from">${esc(fromLine(chest))}${chest.preview ? ` · <b>${t('chest.preview')}</b>` : ''}</p>
      <h2 id="cx-title" class="cx-tier"><span>${esc(tierName(chest.tier))}</span><small>${esc(boxName(chest.tier))}</small></h2>
    </header>
    <div class="cx-box">
      <div class="cx-squash"><div class="cx-wiggle">
        <img class="cx-still" src="${art.still}" width="448" height="448" alt="${esc(boxName(chest.tier))}" draggable="false">
        ${webm ? `<video class="cx-vid" src="${art.webm}" muted playsinline preload="auto" aria-hidden="true"></video>` : ''}
        <img class="cx-open" src="${art.open}" width="448" height="448" alt="" draggable="false" hidden>
      </div></div>
    </div>
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
  const vid = root.querySelector('.cx-vid');
  const openStill = root.querySelector('.cx-open');
  const loot = root.querySelector('.cx-loot');
  const hint = root.querySelector('.cx-hint span');
  const pips = root.querySelector('.cx-pips');
  const collect = root.querySelector('[data-cx-collect]');
  const skipBtn = root.querySelector('[data-cx-skip]');
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  // Safari's animation: fetched now, while the chest is being tapped; each opening
  // gets its own object URL so it starts from its first frame
  const animBlob = webm ? null : fetch(art.anim).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
  new Image().src = art.open;

  // the server opens the chest on the first tap (closing before that opens nothing)
  const openOnServer = () => {
    opened ||= chest.preview ? Promise.resolve(chest) : openChest(chest.id);
    opened.catch((err) => { toast(gearError(err), { icon: svg('warn') }); closeLayer(root); });
    return opened;
  };

  const toReady = () => {
    if (phase !== 'play') return;
    phase = 'ready';
    // the open chest stays: the clip on its last frame, or the same frame as a still
    if (!vid || !vid.ended) { openStill.hidden = false; wiggle.classList.add('is-ended'); }
    stage.classList.add('is-ready');
    hint.textContent = t('chest.hint.collect');
    haptic(['legendary', 'mythic'].includes(chest.tier) ? 'levelUp' : 'record');
  };

  const play = async () => {
    phase = 'play';
    pips.hidden = true;
    hint.textContent = '';
    squash.style.removeProperty('--sq');
    box.classList.add('is-pop');
    if (vid) {
      // the clip and its sound start together; if the clip had to wait for data,
      // the sound catches up with it the moment it plays
      vid.addEventListener('playing', () => {
        wiggle.classList.add('is-playing');
        if (audio && Math.abs(audio.currentTime - vid.currentTime) > 0.08) audio.currentTime = vid.currentTime;
      }, { once: true });
      vid.addEventListener('ended', toReady, { once: true });
      vid.addEventListener('error', () => { openStill.hidden = false; toReady(); }, { once: true });
      vid.play().catch(() => { openStill.hidden = false; toReady(); });
      audio?.play().catch(() => {});
      later(toReady, (seconds + 2) * 1000); // a clip that stalls still ends
      return;
    }
    audio?.play().catch(() => {});
    const blob = await animBlob;
    animUrl = blob ? URL.createObjectURL(blob) : `${art.anim}?t=${Date.now()}`;
    const anim = new Image();
    anim.className = 'cx-anim'; anim.alt = ''; anim.width = 448; anim.height = 448; anim.draggable = false;
    anim.onload = () => { wiggle.classList.add('is-playing'); if (audio) audio.currentTime = 0; };
    anim.src = animUrl;
    wiggle.appendChild(anim);
    // the animation runs once; at its end the open still (its last frame) takes over
    later(toReady, seconds * 1000);
  };

  const tap = () => {
    taps += 1;
    if (taps === 1) openOnServer();
    pips.children[taps - 1]?.classList.add('on');
    squash.style.setProperty('--sq', String(1 - taps * 0.08));
    wiggle.classList.remove('is-hit');
    void wiggle.offsetWidth; // restart the wiggle
    wiggle.classList.add('is-hit');
    haptic(taps >= TAPS ? 'record' : 'tick');
    if (taps >= TAPS) later(play, calm ? 0 : 260);
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
    haptic('tick');
  };
  const finish = () => {
    phase = 'done';
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
    vid?.pause();
    phase = 'play';
    pips.hidden = true;
    squash.style.removeProperty('--sq');
    wiggle.querySelector('.cx-anim')?.remove();
    if (vid) vid.hidden = true;
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
