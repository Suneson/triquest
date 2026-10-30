// chest-view.js — reward chests on screen (docs/REWARDS.md): the banner that
// slides down when a session leaves a chest, the Home card while one waits, the
// opening (the chest's clip and sound, then its rewards one tap at a time), and
// the admin tools that preview or gift a chest.
//
// The opening, in four beats:
//   1. the chest plays its clip and sound (or, where a browser can't draw a clip
//      with transparency, its still drops in to the same sound);
//   2. it rests on its still, lit by its tier's colour: "Tap to open";
//   3. a tap: coins rise out of it, the total counting up, the chest's bonus beside it;
//   4. a tap: carbs, the same; then Collect (or the next chest).
// The server is asked to open the chest at the first beat, so the numbers are
// ready by the third; a preview asks nothing and pays nothing.

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
 * gets the still and the sound instead.
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

/**
 * The chest opening. `chest.preview` plays it without asking the server (the
 * admin preview and the simulated workout); otherwise the server opens it.
 */
export function openChestModal(chest, { queue = [] } = {}) {
  const art = chestArt(chest.tier);
  const clip = alphaVideo() && !prefersReducedMotion();
  const color = TIER_COLOR[chest.tier];
  let phase = 'play';
  let audio = null;
  const root = openLayer('chest', { className: 'cx-layer', instant: true, reuse: false, onClose: () => { audio?.pause(); } });
  root.innerHTML = `<div class="cx tier-${chest.tier}" role="dialog" aria-modal="true" aria-labelledby="cx-title" style="--tc:${color}">
    <div class="cx-bg" aria-hidden="true"><i class="cx-rays"></i><i class="cx-flash"></i></div>
    <header class="cx-head">
      <p class="cx-from">${esc(fromLine(chest))}${chest.preview ? ` · <b>${t('chest.preview')}</b>` : ''}</p>
      <h2 id="cx-title" class="cx-tier"><span>${esc(tierName(chest.tier))}</span><small>${esc(boxName(chest.tier))}</small></h2>
    </header>
    <div class="cx-box">
      <img class="cx-still" src="${art.still}" width="512" height="512" alt="${esc(boxName(chest.tier))}" draggable="false">
      ${clip ? `<video class="cx-vid" src="${art.webm}" muted playsinline preload="auto" aria-hidden="true"></video>` : ''}
    </div>
    <div class="cx-loot" aria-live="polite"></div>
    <p class="cx-hint">${t('chest.hint.wait')}</p>
    <footer class="cx-foot">
      <button class="cx-skip" data-cx-skip>${t('chest.skip')}</button>
      <button class="sc-buy cx-collect" data-cx-collect hidden>${queue.length ? t('chest.next', { n: queue.length }) : t('chest.collect')}</button>
    </footer>
  </div>`;
  const stage = root.querySelector('.cx');
  const box = root.querySelector('.cx-box');
  const vid = root.querySelector('.cx-vid');
  const loot = root.querySelector('.cx-loot');
  const hint = root.querySelector('.cx-hint');
  const collect = root.querySelector('[data-cx-collect]');
  const skipBtn = root.querySelector('[data-cx-skip]');

  // ask the server now, so the numbers are there by the time they're shown
  const opened = chest.preview ? Promise.resolve(chest) : openChest(chest.id);
  opened.catch((err) => { toast(gearError(err), { icon: svg('warn') }); closeLayer(root); });

  if (soundOn()) {
    audio = new Audio(art.mp3);
    audio.play().catch(() => {});
  }
  const toReady = () => {
    if (phase !== 'play') return;
    phase = 'ready';
    stage.classList.add('is-ready');
    if (vid) vid.classList.add('is-done');
    hint.textContent = t('chest.hint.open');
    haptic(['legendary', 'mythic'].includes(chest.tier) ? 'levelUp' : 'record');
  };
  if (vid) {
    vid.addEventListener('ended', toReady, { once: true });
    vid.addEventListener('error', toReady, { once: true });
    vid.play().catch(toReady);
  } else {
    box.classList.add(prefersReducedMotion() ? 'is-calm' : 'is-drop');
  }
  // whatever happens to the clip, the chest is ready after it would have ended
  const longest = { common: 3.1, uncommon: 4.1, rare: 3.1, epic: 4.1, legendary: 4.1, mythic: 5.1 }[chest.tier] || 4;
  setTimeout(toReady, prefersReducedMotion() ? 300 : (vid ? longest + 1.5 : Math.min(longest, 2.6)) * 1000);

  const row = (cur, r) => `<div class="cx-row is-${cur}${r.base ? '' : ' is-flat'}">
      <img class="cx-ico" src="${CUR_ART[cur]}" width="64" height="64" alt="">
      <span class="cx-amt"><b class="cx-total data-num">0</b>${cur === 'carbs' ? '<i class="cx-unit">g</i>' : ''}
        <small>${t(`chest.${cur}`)} · ${r.base ? t('chest.fromSession', { n: fmtNum(r.base) }) : t('chest.bonusOnly')}</small></span>
      <span class="cx-bonus"><b>+${fmtNum(r.bonus)}</b><small>${t('chest.bonus')}</small></span>
    </div>`;
  const reveal = async (cur, { quick = false } = {}) => {
    const c = await opened;
    const r = rewardsOf(c)[cur];
    loot.insertAdjacentHTML('beforeend', row(cur, r));
    const el = loot.lastElementChild;
    if (quick) { el.querySelector('.cx-total').textContent = fmtNum(r.base + r.bonus); el.classList.add('is-in', 'has-bonus'); return; }
    requestAnimationFrame(() => el.classList.add('is-in'));
    tween(el.querySelector('.cx-total'), r.base + r.bonus, 900);
    setTimeout(() => el.classList.add('has-bonus'), 520);
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
    if (phase === 'ready') { phase = 'coins'; stage.classList.add('is-open'); hint.textContent = t('chest.hint.more'); await reveal('coins'); return; }
    if (phase === 'coins') { phase = 'carbs'; await reveal('carbs'); setTimeout(finish, 700); }
  };
  const skip = async () => {
    if (phase === 'done') return;
    vid?.pause();
    if (phase === 'play') toReady();
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
