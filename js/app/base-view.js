// base-view.js — the home base: the Profile tab's landing view (docs/LOOP.md §3).
//
// All four quadrants on one island, each a live miniature of its sport's
// scene with what you've built in it, its quadrant level, the sport level, its
// trophy board's count and anything in the workshop for it. Tapping one goes
// into that sport's full scene. Under the island, the answers to "what next":
// what's building, what you can nearly afford, the feat you're closest to and
// your blueprint. Plain facts; nothing here asks you to train on a given day.

import { esc, meter, stillCorners } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { sceneFor, rareById, propById } from '../core/scenes.js';
import { quadrantLevel } from '../core/workshop.js';
import { building, nearlyAffordable, closestFeat } from '../core/base.js';
import { blueprintState } from '../core/collections.js';
import { featsFor } from '../core/feats.js';
import { gearById } from '../core/gear.js';
import { gearState, gearEnabled, serverNow, walletNow, sportLevelOf, refreshGear, unseenFinished } from './gear-state.js';
import { featAwards } from './feats-state.js';
import { resourceBars, clockLeft } from './gear-view.js';
import { featValue } from './feats-view.js';
import { propsHtml, SWITCH } from './profile-game.js';
import * as store from './store.js';

const ISLAND = ['bike', 'swim', 'run', 'gym'];
const label = (sport) => t(`sport.${SWITCH.find(([s]) => s === sport)[1]}`);
const itemName = (id) => gearById(id)?.name || propById(id)?.name || rareById(id)?.name || id;
const itemSport = (id) => gearById(id)?.sport || propById(id)?.sport || null;

/** A still miniature of a sport's scene at a level, with its props (no motion, no board). */
function miniScene(sport, artLevel) {
  const scene = sceneFor(sport, artLevel);
  const e = scene.entry;
  const props = gearEnabled() ? propsHtml(sport, 'day') : { back: '', front: '', glow: '' };
  if (scene.kind === 'layered') {
    return `<span class="hb-world" aria-hidden="true">
      <img class="pg-layer pg-bg" src="${esc(e.bg)}" alt="" loading="lazy">
      <img class="pg-layer pg-platform" src="${esc(e.platform)}" alt="" loading="lazy">
      ${props.back}<img class="pg-char" src="${esc(e.char)}" alt="" loading="lazy">${props.front}
    </span>`;
  }
  const art = e.plate && e.char
    ? `<img class="pg-still-img" src="${esc(e.plate)}" width="${e.w}" height="${e.h}" alt="" loading="lazy">${props.back}<img class="pg-still-img pg-still-char" src="${esc(e.char)}" width="${e.w}" height="${e.h}" alt="" loading="lazy">`
    : `<img class="pg-still-img" src="${esc(e.src)}" width="${e.w}" height="${e.h}" alt="" loading="lazy">${props.back}`;
  return `<span class="hb-still" style="--ar:${e.w} / ${e.h}" aria-hidden="true">${art}${props.front}${stillCorners(e)}</span>`;
}

function quadTile(sport, ctx, s, now, wonIds) {
  const lv = sportLevelOf(sport, ctx.boost?.sportXp?.[sport] || 0);
  const q = quadrantLevel(sport, s.inventory);
  const feats = [...featsFor(sport), ...featsFor('cross')];
  const won = feats.filter((f) => wonIds.has(f.id)).length;
  const job = building(s.jobs, now).find((j) => itemSport(j.item_id) === sport);
  const end = job ? Date.parse(job.finishes_at) : 0;
  const stars = lv.stars ? `<span class="hb-stars" aria-hidden="true">${'★'.repeat(lv.stars)}</span>` : '';
  const aria = [
    t('loop.base.quadAria', { sport: label(sport), quad: t(`loop.quad.${sport}`), q: q.level, n: lv.level, won, total: feats.length }),
    lv.stars ? t('loop.prestige.starsAria', { n: lv.stars }) : '',
    job ? t('loop.base.buildingAria', { name: itemName(job.item_id) }) : '',
  ].filter(Boolean).join('. ');
  return `<button class="hb-quad is-${sport}" data-action="enter-scene" data-sport="${sport}" aria-label="${esc(aria)}">
    <span class="hb-art">${miniScene(sport, lv.artLevel)}${job ? `<span class="hb-job" aria-hidden="true">${svg('wrench')}<b data-ws-left="${end}" class="data-num">${clockLeft(end - now)}</b></span>` : ''}</span>
    <span class="hb-plate" aria-hidden="true"><b>${esc(t(`loop.quad.${sport}`))}</b><i class="data-num">${t('loop.quad.lv', { n: q.level })}</i></span>
    <span class="hb-meta" aria-hidden="true">
      <span class="hb-lvl">${svg(sport, `tint-${sport}`)}<b class="data-num">${t('loop.base.lvl', { n: lv.level })}</b>${stars}</span>
      <span class="hb-board">${svg('trophy')}<b class="data-num">${won}</b><small>/${feats.length}</small></span>
    </span>
  </button>`;
}

/** One "what next" row: an icon, a line, an optional detail and where it goes. */
const nextRow = ({ icon, head, body, detail = '', action, attrs = '' }) => `<li>
  <button class="hb-next-row" data-action="${action}"${attrs}>
    <span class="hb-next-ico" aria-hidden="true">${icon}</span>
    <span class="hb-next-txt"><small>${head}</small><b>${body}</b>${detail}</span>
    <span class="hb-next-go" aria-hidden="true">${svg('chevron')}</span>
  </button></li>`;

function whatNext(ctx, s, now, wonIds) {
  const rows = [];
  // what's building
  const live = building(s.jobs, now);
  if (live.length) {
    const j = live[0];
    const end = Date.parse(j.finishes_at);
    const more = live.length > 1 ? ` <span class="hb-more">${t('loop.base.more', { n: live.length - 1 })}</span>` : '';
    rows.push(nextRow({ icon: svg('wrench'), head: t('loop.base.building'), action: 'open-gear', attrs: ` data-sport="${itemSport(j.item_id) || 'bike'}"`,
      body: `${esc(itemName(j.item_id))}${more}`, detail: `<span class="hb-next-d"><span data-ws-left="${end}" class="data-num">${clockLeft(end - now)}</span> ${t('loop.ws.leftWord')}</span>` }));
  } else {
    rows.push(nextRow({ icon: svg('wrench'), head: t('loop.base.building'), action: 'open-gear', body: esc(t('loop.base.workshopFree')) }));
  }
  // what's nearly affordable
  const w = walletNow(ctx.workouts);
  const na = nearlyAffordable(s.inventory, s.jobs, w.coins, now);
  if (na.affordable || na.nearest) {
    const n = na.nearest;
    rows.push(nextRow({ icon: svg('coin'), head: t('loop.base.afford'), action: 'open-base', attrs: n ? ` data-sport="${n.item.sport}"` : '',
      body: na.affordable ? esc(t('loop.base.canBuy', { n: na.affordable })) : esc(n.item.name),
      detail: n ? `<span class="hb-next-d">${t('loop.base.short', { name: esc(n.item.name), n: `<b class="data-num">${fmtNum(n.short)}</b>` })}</span>` : '' }));
  }
  // the feat you're closest to
  const cf = closestFeat(ctx.workouts, [...wonIds]);
  if (cf) {
    rows.push(nextRow({ icon: svg('trophy'), head: t('loop.base.feat'), action: 'open-trophies', attrs: ` data-sport="${cf.feat.sport}"`,
      body: esc(cf.feat.name),
      detail: `<span class="hb-next-d">${meter(cf.progress, { segments: 10, cls: 'hb-meter', label: t('feat.ui.nearAria', { best: featValue(cf.feat, cf.nm.best), target: featValue(cf.feat, cf.nm.target) }) })}
        <span>${t('feat.ui.best', { best: `<b class="data-num">${esc(featValue(cf.feat, cf.nm.best))}</b>`, target: esc(featValue(cf.feat, cf.nm.target)) })}</span></span>` }));
  }
  // your blueprint
  const bp = blueprintState(s.quests, s.blueprints, store.getSettings().bpTarget);
  if (bp.target) {
    rows.push(nextRow({ icon: svg('scroll'), head: t('loop.bp.title'), action: 'open-base', attrs: ` data-sport="${bp.target.sport}" data-bp="1"`,
      body: esc(bp.target.name),
      detail: `<span class="hb-next-d">${meter(Math.min(1, bp.free / bp.target.fragments), { segments: 12, cls: 'hb-meter', label: t('loop.bp.progress', { n: Math.min(bp.free, bp.target.fragments), of: bp.target.fragments }) })}
        <span>${bp.left ? t('loop.bp.left', { n: `<b class="data-num">${bp.left}</b>` }) : t('loop.bp.ready')}</span></span>` }));
  } else {
    rows.push(nextRow({ icon: svg('scroll'), head: t('loop.bp.title'), action: 'open-base', attrs: ' data-bp="1"',
      body: esc(t('loop.bp.pickOne')), detail: `<span class="hb-next-d">${t('loop.bp.have', { n: `<b class="data-num">${bp.free}</b>` })}</span>` }));
  }
  return `<section class="hb-next" aria-labelledby="hb-next-h">
    <h2 id="hb-next-h" class="gw-row-h">${svg('target')} ${t('loop.base.next')}</h2>
    <ul>${rows.join('')}</ul>
  </section>`;
}

/** The Profile tab's landing view. */
export function renderBase(ctx, avatarBtn = '') {
  const s = gearState();
  const now = serverNow();
  const wonIds = new Set(featAwards().map((a) => a.featId));
  const ready = unseenFinished().length;
  return `<section class="hb-screen" data-hb>
    <header class="hb-top">
      <h1 class="hb-title">${svg('home')} ${t('loop.base.title')}</h1>
      ${avatarBtn}
    </header>
    ${resourceBars(ctx.workouts, { cls: 'on-base' })}
    <div class="hb-sea">
      <div class="hb-island" role="group" aria-label="${esc(t('loop.base.islandAria'))}">
        ${ISLAND.map((sp) => quadTile(sp, ctx, s, now, wonIds)).join('')}
      </div>
    </div>
    <p class="hb-hint">${t('loop.base.hint')}</p>
    ${gearEnabled() ? whatNext(ctx, s, now, wonIds) : ''}
    <div class="hb-acts">
      <button class="btn ghost hb-act" data-action="open-inventory"><img src="icons/Pixelart/GEAR/btn-inventory.png" width="128" height="128" alt=""><span>${t('gear.inventory')}</span></button>
      <button class="btn ghost hb-act" data-action="open-gear"><img src="icons/Pixelart/GEAR/btn-shop.png" width="128" height="128" alt=""><span>${t('gear.shop')}</span>${ready ? `<i class="pg-dot data-num" aria-label="${esc(t('loop.ws.readyN', { n: ready }))}">${ready}</i>` : ''}</button>
    </div>
  </section>`;
}

let tick = null;
/** Keep the base's countdowns running (by the server's clock); a finish asks the server. */
export function wireBase(view) {
  clearInterval(tick);
  if (!view.querySelector('[data-hb] [data-ws-left]')) return;
  tick = setInterval(() => {
    const els = view.querySelectorAll('[data-hb] [data-ws-left]');
    if (!els.length) { clearInterval(tick); return; }
    const now = serverNow();
    let done = false;
    els.forEach((el) => {
      const left = Number(el.dataset.wsLeft) - now;
      if (left <= 0) done = true;
      el.textContent = clockLeft(left);
    });
    if (done) { clearInterval(tick); refreshGear(); }
  }, 1000);
}
