// reward-bag.js — the bag opening modal: a bag's clip plays over the dimmed
// app with its sound, then its rarity is named and Continue closes it.
//
//   openRewardBag('legendary')                 → plays a legendary bag
//   openRewardBag('rare', { variant: 1 })      → a rarity's alternate clip
//   preloadRewardBag('mythic')                 → fetch ahead, so it starts at once
//
// Clip format by browser (core/reward-bags.js): VP9-alpha WebM where it
// renders, the animated WebP on Safari and iOS. Under reduced motion the
// bag's last frame is shown instead. Sound follows Settings → Sound.

import { bagClip, playsWebmAlpha, rarityRank } from '../core/reward-bags.js';
import { t } from '../core/i18n.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { getSettings } from './store.js';
import { confetti, prefersReducedMotion } from './effects.js';
import { haptic } from './haptics.js';
import { esc } from './ui.js';

const LOAD_TIMEOUT_MS = 8000; // a slow network shows the opened bag rather than an empty stage

let webmOk = null;
function useWebm() {
  if (webmOk === null) {
    const v = document.createElement('video');
    const can = !!v.canPlayType && v.canPlayType('video/webm; codecs="vp9"') !== '';
    webmOk = playsWebmAlpha(navigator.userAgent, can);
  }
  return webmOk;
}

// Animated WebPs are fetched once and shown through a fresh object URL each
// time: browsers share one animation timeline per image URL, so a bag that
// played once this session would otherwise open already on its last frame.
const webpBlobs = new Map();
function webpBlob(url) {
  if (!webpBlobs.has(url)) {
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.blob(); });
    p.catch(() => webpBlobs.delete(url)); // let a later open try again
    webpBlobs.set(url, p);
  }
  return webpBlobs.get(url);
}

/** Start downloading a rarity's clips (every variant) before the bag is opened. */
export function preloadRewardBag(rarity) {
  const first = bagClip(rarity, { variant: 0 });
  if (!first || prefersReducedMotion()) return;
  const n = 1 + (bagClip(rarity, { variant: 1 }).slug !== first.slug ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const c = bagClip(rarity, { variant: i });
    if (useWebm()) fetch(c.webm).catch(() => {});
    else webpBlob(c.webp).catch(() => {});
  }
}

/**
 * Open a reward bag. Returns the layer element, or null for an unknown rarity.
 * `onClose` runs once however the modal goes (Continue, back, swipe, Escape).
 */
export function openRewardBag(rarity, { variant = null, onClose = null } = {}) {
  const clip = bagClip(rarity, { variant });
  if (!clip) return null;
  const still = prefersReducedMotion();
  const name = t(`bag.rarity.${clip.rarity}`);
  let audio = null;
  let objectUrl = '';
  let revealTimer = 0;
  let loadTimer = 0;

  const root = openLayer('reward-bag', {
    reuse: false,
    onClose: () => {
      clearTimeout(revealTimer); clearTimeout(loadTimer);
      root.querySelector('video')?.pause();
      if (audio) { audio.pause(); audio = null; }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      onClose?.();
    },
  });
  root.innerHTML = `<div class="modal-backdrop" data-bag-close></div>
    <div class="modal bag-sheet" role="dialog" aria-modal="true" aria-labelledby="bag-title" style="--rar: var(--rar-${clip.rarity})">
      ${sheetHead({ id: 'bag-title', icon: 'bag', title: esc(t('bag.title')), closeAttr: 'data-bag-close' })}
      <div class="modal-body bag">
        <div class="bag-art" data-rarity="${clip.rarity}" aria-busy="true"></div>
        <p class="bag-name" aria-live="polite"><span class="sr">${esc(t('bag.opening'))}</span></p>
        <button class="btn primary" data-bag-close>${esc(t('main.continue'))}</button>
      </div>
    </div>`;
  root.querySelectorAll('[data-bag-close]').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
  const stage = root.querySelector('.bag-art');
  const alt = t('bag.alt', { rarity: name });

  const reveal = () => {
    if (!root.isConnected || stage.classList.contains('is-open')) return;
    stage.classList.add('is-open');
    stage.removeAttribute('aria-busy');
    root.querySelector('.bag-name').textContent = t('bag.found', { rarity: name });
    root.querySelector('.bag-sheet').classList.add('is-revealed');
    if (rarityRank(clip.rarity) >= rarityRank('legendary')) {
      const r = stage.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, rarityRank(clip.rarity) >= rarityRank('mythic') ? 140 : 90);
    }
    haptic(rarityRank(clip.rarity) >= rarityRank('rare') ? 'levelUp' : 'record');
  };

  // The sound starts with the first frame, and the name comes when the clip ends.
  const started = (e) => {
    // a clip replaced by the fallback (timeout or error) may still fire late
    if (!root.isConnected || (e?.target && !e.target.isConnected)) return;
    clearTimeout(loadTimer);
    stage.removeAttribute('aria-busy');
    if (getSettings()?.sound) {
      audio = new Audio(clip.mp3);
      audio.play().catch(() => {}); // blocked autoplay just means a silent bag
    }
    clearTimeout(revealTimer);
    revealTimer = setTimeout(reveal, clip.ms);
  };

  const showStill = () => {
    if (!root.isConnected) return;
    stage.querySelector('video')?.pause();
    stage.replaceChildren(Object.assign(new Image(), { src: clip.still, alt, className: 'bag-clip', decoding: 'async' }));
    started();
    clearTimeout(revealTimer);
    reveal();
  };

  const showWebp = () => {
    webpBlob(clip.webp).then((blob) => {
      if (!root.isConnected) return;
      objectUrl = URL.createObjectURL(blob);
      const img = Object.assign(new Image(), { alt, className: 'bag-clip' });
      img.addEventListener('load', started, { once: true });
      img.addEventListener('error', showStill, { once: true });
      img.src = objectUrl;
      stage.replaceChildren(img);
    }).catch(showStill);
  };

  const showWebm = () => {
    const v = document.createElement('video');
    Object.assign(v, { muted: true, playsInline: true, autoplay: true, preload: 'auto', className: 'bag-clip', src: clip.webm });
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-label', alt);
    v.addEventListener('playing', started, { once: true });
    v.addEventListener('ended', () => { if (v.isConnected) reveal(); }, { once: true });
    v.addEventListener('error', () => { if (v.isConnected) showWebp(); }, { once: true }); // a browser that fails the WebM still gets the WebP
    stage.replaceChildren(v);
    v.play?.().catch(() => {});
  };

  if (still) showStill();
  else {
    loadTimer = setTimeout(showStill, LOAD_TIMEOUT_MS);
    if (useWebm()) showWebm(); else showWebp();
  }
  return root;
}
