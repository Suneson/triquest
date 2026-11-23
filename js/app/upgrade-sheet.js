// upgrade-sheet.js: taking a building up a level (jobs.js, docs/JOBS.md). The one sheet every upgrade on
// the base opens: what the next level costs and how long it takes, which builder does it, and while a
// builder is on it, how far along they are. Paid and timed by the server (start_builder_job).

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { nextLevel, jobOn, levelOf, maxLevel, crew, freeBuilder, whyNot, left, progress } from '../core/jobs.js';
import { myBuilds, buildsOpen, startBuild, walletNow, gearError, serverNow, gearState } from './gear-state.js';
import { openLayer, closeLayer } from './nav.js';
import { haptic } from './haptics.js';
import { toast } from './effects.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';
/** A builder's face (rendered from their model). */
export const face = (who) => `icons/Builders/face-${who}.webp`;
const ring = face;

/** "2 h 10 min", "4 min 10 s". */
export function timeLeft(ms) {
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  if (d) return t('jobs.dh', { d, h });
  if (h) return t('jobs.hm', { h, m });
  return t('jobs.ms', { m, s: s % 60 });
}
const hours = (h) => (h >= 24 && h % 24 === 0 ? t('jobs.days', { n: h / 24 }) : t('jobs.hours', { n: h }));

/** Tell the base, the gel stand and the coffee shop that a job started or finished. */
export const buildsChanged = () => document.dispatchEvent(new CustomEvent('builds-changed'));

/** A building's level now, from its builders' jobs. */
export const buildingLevel = (target) => levelOf(myBuilds(), target, serverNow());
/** The job running on a building: { to, left } (ms), or null. */
export function buildingJob(target) {
  const now = serverNow(); const j = jobOn(myBuilds(), target, now);
  return j ? { to: j.to_level, left: left(j, now), who: j.builder } : null;
}

/**
 * Open the upgrade sheet for a building.
 * @param {{ target: string, name: string, art: (level: number) => string }} o
 */
export function openUpgrade({ target, name, art }) {
  const root = openLayer('upgrade', { className: 'mk-layer up-layer', reuse: false, onClose: () => clearInterval(tick) });
  let pick = null;
  let last = buildingLevel(target);
  const draw = () => {
    const now = serverNow();
    const jobs = myBuilds();
    const inv = gearState().inventory;
    const level = levelOf(jobs, target, now);
    const job = jobOn(jobs, target, now);
    const next = nextLevel(jobs, target, now);
    const coins = walletNow([]).coins;
    const team = crew(jobs, inv, now);
    if (!pick || !team.find((c) => c.who === pick && c.hired && !c.job)) pick = freeBuilder(jobs, inv, now);
    let body;
    if (job) {
      body = `<div class="up-pics"><figure class="up-pic is-next"><img src="${art(job.to_level)}" alt="" draggable="false"></figure></div>
        <p class="up-lvl">${esc(t('jobs.building', { n: job.to_level }))}</p>
        <div class="up-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress(job, now) * 100)}"><i style="--f:${progress(job, now).toFixed(4)}"></i></div>
        <p class="up-who"><img src="${ring(job.builder)}" alt=""><span>${esc(t('jobs.onIt', { who: t(`jobs.who.${job.builder}`) }))}</span>
          <b class="data-num" data-up-left>${esc(timeLeft(left(job, now)))}</b></p>`;
    } else if (!next) {
      body = `<div class="up-pics"><figure class="up-pic"><img src="${art(level)}" alt="" draggable="false"></figure></div>
        <p class="up-lvl">${esc(t('jobs.top', { n: level }))}</p>`;
    } else {
      const why = !buildsOpen() ? 'closed' : !pick ? 'nobody' : whyNot({ jobs, inventory: inv, coins, target, builder: pick, now });
      const crewHtml = team.map((c) => {
        const state = !c.hired ? 'is-locked' : c.job ? 'is-busy' : c.who === pick ? 'is-on' : '';
        const note = !c.hired ? t('jobs.notHired') : c.job ? timeLeft(left(c.job, now)) : t('jobs.free');
        return `<button class="up-b ${state}" data-up-who="${c.who}" ${!c.hired || c.job ? 'disabled' : ''} aria-pressed="${c.who === pick}"
          aria-label="${esc(t('jobs.pickAria', { who: t(`jobs.who.${c.who}`), note }))}">
          <img src="${ring(c.who)}" alt="">${!c.hired ? `<span class="up-lock">${svg('lock')}</span>` : ''}<small>${esc(note)}</small></button>`;
      }).join('');
      const msg = why === 'closed' ? t('jobs.closed') : why === 'nobody' ? t('jobs.nobody') : why === 'gear:insufficient' ? t('gear.err.insufficient') : '';
      body = `<div class="up-pics">
          <figure class="up-pic"><img src="${art(level)}" alt="" draggable="false"><figcaption>${esc(t('jobs.level', { n: level }))}</figcaption></figure>
          <span class="up-arrow" aria-hidden="true">${svg('chevron')}</span>
          <figure class="up-pic is-next"><img src="${art(next.to)}" alt="" draggable="false"><figcaption>${esc(t('jobs.level', { n: next.to }))}</figcaption></figure>
        </div>
        <p class="up-time">${svg('clock')}<span>${esc(t('jobs.takes', { t: hours(next.hours) }))}</span></p>
        <p class="up-pick">${esc(t('jobs.pick'))}</p>
        <div class="up-crew">${crewHtml}</div>
        ${msg ? `<p class="up-msg">${esc(msg)}</p>` : ''}
        <button class="mk-up up-go" data-up-go ${why ? 'disabled' : ''}><b>${esc(t('jobs.go', { n: next.to }))}</b>
          <span class="data-num${coins < next.coins ? ' is-short' : ''}">${fmtNum(next.coins)}<img src="${COIN}" alt=""></span></button>`;
    }
    root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
      <div class="mk-info up" role="dialog" aria-modal="true" aria-labelledby="up-h">
        <header class="mk-info-head">
          <h2 id="up-h">${esc(name)}</h2>
          <button class="mk-x" data-layer-close aria-label="${esc(t('city.market.close'))}">×</button>
        </header>
        <div class="mk-info-body">
          <p class="up-of">${esc(t('jobs.of', { n: level, max: maxLevel(target) }))}</p>
          ${body}
        </div>
      </div>`;
    root.querySelectorAll('[data-up-who]').forEach((b) => b.addEventListener('click', () => { pick = b.dataset.upWho; haptic('tap'); draw(); }));
    root.querySelector('[data-up-go]')?.addEventListener('click', go);
  };
  const go = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    const who = pick;
    try {
      await startBuild(target, who);
      haptic('record');
      toast(esc(t('jobs.started', { who: t(`jobs.who.${who}`), name })), { icon: svg('check') });
      buildsChanged();
    } catch (err) {
      toast(esc(gearError(err)));
    }
    draw();
  };
  // the clock while it's open, and the level when the job's done
  const tick = setInterval(() => {
    if (!root.isConnected) { clearInterval(tick); return; }
    const lv = buildingLevel(target);
    if (lv !== last) { last = lv; haptic('levelUp'); buildsChanged(); draw(); return; }
    const j = jobOn(myBuilds(), target, serverNow());
    const el = root.querySelector('[data-up-left]');
    if (j && el) {
      el.textContent = timeLeft(left(j, serverNow()));
      root.querySelector('.up-bar i')?.style.setProperty('--f', progress(j, serverNow()).toFixed(4));
    }
  }, 1000);
  draw();
  return root;
}

/** Close the sheet if it's open (a building put away). */
export const closeUpgrade = () => { const el = document.querySelector('.up-layer'); if (el) closeLayer(el); };
