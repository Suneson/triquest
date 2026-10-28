// gear-view.js — the gear shop and the inventory, both full layers opened
// from the buttons on the Profile scene (shop bottom-right, inventory
// bottom-left), plus the coins-and-carbs bars that sit top-right of the scene.
//
// Two currencies, both earned only by training and missions (wallet.js):
//   coins buy gear upgrades (a small permanent boost to one discipline) and clothes;
//   carbs buy fuel: a gel boosts your next workout, food the next few hours.
// Prices and effects are shown before you buy; the server does the buying and
// using (gear-state.js → buy_gear / use_gel). Not the merch Shop tab: its own
// name, a stall icon and a steel accent.

import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { esc, dialogue, meter } from './ui.js';
import { rollNum, animateIn, busy } from './motion.js';
import { toast, playAccept } from './effects.js';
import { haptic } from './haptics.js';
import { svg } from '../core/icons.js';
import { t, fmtNum, fmtTime, fmtDate } from '../core/i18n.js';
import {
  SLOTS, SLOT_ICON, GEAR_RULES, KITS, FUELS, SPORTS, CATALOG, FEAT_ITEMS, featItemById, ownedTier, nextTier, ownedKits, gearById, tierId, kitArt, fuelById,
} from '../core/gear.js';
import { featById, seasonHue } from '../core/feats.js';
import { featItems } from './feats-state.js';
import { gearBoost, canUseFuel } from '../core/boosts.js';
import { gearState, gearEnabled, refreshGear, buyItem, useFuel, gearError, walletNow, onGear, serverNow, cancelJob, skipJob, markWorkshopSeen, buildBlueprint, buyStall } from './gear-state.js';
import { stallFor, stallAhead, stallDay, msToNextStall } from '../core/stall.js';
import { SEASON_KITS, SEASON_RULES, seasonInfo } from '../core/seasons.js';
import { todayISO } from '../core/dates.js';
import { jobPhase, jobFor, cancelRefund, fitMinutes, quadrantLevel, WORKSHOP_RULES } from '../core/workshop.js';
import { propsFor, propById, rareById, RARE_PROPS } from '../core/scenes.js';
import { collectionsFor, blueprintState, COLLECTION_RULES } from '../core/collections.js';
import { gelChip, pctBp } from './gel-chip.js';
import { SWITCH } from './profile-game.js';
import * as store from './store.js';

const CUR_ICON = { coins: 'icons/Pixelart/GEAR/coin.png', carbs: 'icons/Pixelart/GEAR/carbs.png' };
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** "850 coins" / "120 g carbs" as a price chip. */
const price = (n, cur) => `<span class="cur-amt is-${cur}">${svg(cur === 'carbs' ? 'carbs' : 'coin', 'cur-ico')}<b class="data-num">${fmtNum(n)}</b>${cur === 'carbs' ? '<small>g</small>' : ''}</span>`;

// ---- coins and carbs, top right of the scene ------------------------------------------

/**
 * Two storage bars, a base-building game's way: each fills from the icon end
 * (right to left) toward the cap (10,000), with the amount on the bar. The cap
 * isn't printed; a full bar says it.
 */
export function resourceBars(workouts, { cls = '' } = {}) {
  if (!gearEnabled()) return '';
  const w = walletNow(workouts);
  const bar = (cur, n) => {
    const f = Math.max(0, Math.min(1, n / w.cap));
    return `<div class="res-bar is-${cur}${f >= 1 ? ' is-full' : ''}" style="--f:${f.toFixed(4)}">
      <span class="res-track"><i class="res-fill"></i><b class="data-num">${rollNum(n, `res-${cur}`)}${cur === 'carbs' ? '<span class="res-unit">g</span>' : ''}</b></span>
      <img class="res-ico" src="${CUR_ICON[cur]}" width="32" height="32" alt="">
    </div>`;
  };
  return `<div class="res-bars ${cls}" role="group" aria-label="${esc(t('gear.res.aria', { coins: fmtNum(w.coins), carbs: fmtNum(w.carbs), cap: fmtNum(w.cap) }))}">
    ${bar('coins', w.coins)}${bar('carbs', w.carbs)}</div>`;
}

// ---- shop pieces -------------------------------------------------------------------

// every bought tier has its picture (tools/gen-items.mjs); the free starter shows the slot's icon
const ART_READY = new Set(CATALOG.filter((e) => e.tier > 0).map((e) => e.id));

function artTile(sport, slot, tier, { locked = false, fresh = false } = {}) {
  const id = tierId(sport, slot, tier);
  const inner = ART_READY.has(id)
    ? `<img src="${esc(gearById(id).art)}" width="128" height="128" loading="lazy" alt="">`
    : svg(SLOT_ICON[`${sport}-${slot}`] || sport);
  return `<span class="gw-art t${tier}${locked ? ' is-locked' : ''}${fresh ? ' is-fresh' : ''}" aria-hidden="true">${inner}<i class="gw-tier">T${tier}</i></span>`;
}
const imgTile = (src, badge = '', cls = '') => `<span class="gw-art has-img ${cls}" aria-hidden="true"><img src="${esc(src)}" width="128" height="128" loading="lazy" alt="">${badge ? `<i class="gw-tier">${badge}</i>` : ''}</span>`;

function pips(tier, fresh) {
  return `<span class="gw-pips" role="img" aria-label="${esc(t('gear.tierOf', { n: tier, of: 3 }))}">${[1, 2, 3]
    .map((n) => `<i class="${n <= tier ? 'on' : ''}${fresh && n === tier ? ' is-new' : ''}" style="--d:${n - 1}"></i>`).join('')}</span>`;
}

/** A buy button, or why you can't yet: never a dead button with no explanation. */
function buyButton(item, cur, have, label) {
  const short = item.cost - have;
  if (short > 0) {
    return `<button class="btn tiny gw-buy is-short" disabled aria-describedby="need-${item.id}">${price(item.cost, cur)}</button>
      <span class="gw-need" id="need-${item.id}">${t(cur === 'carbs' ? 'gear.needCarbs' : 'gear.needMore', { n: fmtNum(short) })}</span>`;
  }
  return `<button class="btn tiny primary gw-buy" data-gear-buy="${item.id}"${online() ? '' : ' disabled aria-describedby="gw-offline"'}
      aria-label="${esc(label)}">${price(item.cost, cur)}</button>`;
}

// ---- the workshop (docs/LOOP.md §1) ----------------------------------------------------

/** "2:14:05" / "9:05": what's left, by the server's clock. */
export function clockLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
/** "10 min" / "4 h" / "1 h 30 min": a fitting time. */
export function fitText(min) {
  const h = Math.floor(min / 60); const m = min % 60;
  return h ? (m ? t('loop.ws.hMin', { h, m }) : t('loop.ws.h', { h })) : t('loop.ws.min', { m });
}
const itemName = (id) => gearById(id)?.name || propById(id)?.name || rareById(id)?.name || id;
function itemTile(id) {
  const g = gearById(id);
  if (g) return artTile(g.sport, g.slot, g.tier);
  const p = propById(id);
  return p ? imgTile(p.art, '', 'is-prop') : '';
}
// the gel kinds you hold that can finish a job, cheapest first
const skipKind = (w) => WORKSHOP_RULES.skipKinds.find((k) => (w.held[k] || 0) > 0) || null;

/** The workshop: each bay with what it's fitting, the queue behind, and what just finished. */
function workshopCard(s, w) {
  const now = serverNow();
  const jobs = (s.jobs || []).filter((j) => j.state !== 'cancelled');
  const bays = Math.max(1, s.bays || 1);
  const bayRows = Array.from({ length: bays }, (_, i) => {
    const bay = i + 1;
    const on = jobs.find((j) => j.bay === bay && jobPhase(j, now) === 'fitting');
    if (!on) return `<div class="ws-bay is-free"><span class="ws-bay-n">${t('loop.ws.bay', { n: bay })}</span><p>${t('loop.ws.free')}</p></div>`;
    const start = Date.parse(on.started_at); const end = Date.parse(on.finishes_at);
    const f = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
    const kind = skipKind(w);
    const back = cancelRefund(on, s.jobs, now).refund;
    return `<div class="ws-bay is-busy">
      <span class="ws-bay-n">${t('loop.ws.bay', { n: bay })}</span>
      ${itemTile(on.item_id)}
      <div class="ws-body">
        <b>${esc(itemName(on.item_id))}</b>
        <span class="ws-left"><span data-ws-left="${end}" class="data-num">${clockLeft(end - now)}</span> ${t('loop.ws.leftWord')}</span>
        <span class="ws-bar" aria-hidden="true" data-ws-bar="${start}:${end}" style="--f:${f.toFixed(3)}"><i></i></span>
      </div>
      <div class="ws-acts">
        <button class="btn tiny primary" data-ws-skip="${on.id}" data-kind="${kind || ''}"${kind && online() ? '' : ' disabled'}>${svg('gel')} ${t('loop.ws.skip')}</button>
        <button class="btn tiny ghost" data-ws-cancel="${on.id}" data-refund="${back}" data-cost="${on.cost}"${online() ? '' : ' disabled'}>${t('loop.ws.cancel')}</button>
      </div>
      ${kind ? '' : `<p class="ws-note">${t('loop.ws.needGel')}</p>`}
    </div>`;
  }).join('');
  const waiting = jobs.filter((j) => jobPhase(j, now) === 'waiting').sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  const done = jobs.filter((j) => jobPhase(j, now) === 'done' && now - Date.parse(j.finishes_at) < 24 * 3600e3);
  const queue = waiting.length ? `<ol class="ws-queue" aria-label="${esc(t('loop.ws.queue'))}">${waiting.map((j) => `<li>
      ${itemTile(j.item_id)}<span><b>${esc(itemName(j.item_id))}</b><small>${t('loop.ws.startsAt', { time: fmtTime(j.started_at), bay: j.bay })}</small></span>
      <button class="btn tiny ghost" data-ws-cancel="${j.id}" data-refund="${j.cost}" data-cost="${j.cost}" aria-label="${esc(t('loop.ws.removeAria', { name: itemName(j.item_id) }))}"${online() ? '' : ' disabled'}>${t('loop.ws.remove')}</button></li>`).join('')}</ol>` : '';
  const fitted = done.length ? `<ul class="ws-done">${done.map((j) => `<li>${svg('check')} <b>${esc(itemName(j.item_id))}</b> <small>${t('loop.ws.fittedAt', { time: fmtTime(j.finishes_at) })}</small></li>`).join('')}</ul>` : '';
  return `<section class="ws-card" aria-labelledby="ws-h">
    <h3 id="ws-h" class="gw-row-h">${svg('wrench')} ${t('loop.ws.title')} <small>${t('loop.ws.bays', { n: bays })}</small></h3>
    ${bayRows}${queue}${fitted}
    <p class="ws-note">${t('loop.ws.rules', { pct: WORKSHOP_RULES.cancelRefundBp / 100 })}</p>
  </section>`;
}

/** What a shop card says about an item in the workshop (or null when it isn't). */
function inWorkshop(s, id) {
  const j = jobFor(s.jobs, id, serverNow());
  if (!j) return null;
  const end = Date.parse(j.finishes_at);
  return jobPhase(j, serverNow()) === 'fitting'
    ? `<p class="gw-inws">${svg('wrench')} ${t('loop.ws.fittingCard')} <span data-ws-left="${end}" class="data-num">${clockLeft(end - serverNow())}</span></p>`
    : `<p class="gw-inws">${svg('clock')} ${t('loop.ws.queuedCard', { time: fmtTime(j.started_at) })}</p>`;
}

function gearCard(sport, slot, inv, coins, fresh, s) {
  const tier = ownedTier(inv, sport, slot);
  const cur = gearById(tierId(sport, slot, tier));
  const next = nextTier(inv, sport, slot);
  const ws = next && s ? inWorkshop(s, next.id) : null;
  const foot = !next
    ? `<p class="gw-max">${svg('star')} ${t('gear.maxed')}</p>`
    : `<div class="gw-next"><span class="gw-next-k">${t('gear.next')}</span><b>${esc(next.name)}</b><span class="gw-boost">${pctBp(next.boostBp)}</span></div>
       ${ws || `<p class="gw-fit">${svg('clock')} ${t('loop.ws.fitsIn', { time: fitText(fitMinutes(next.id)) })}</p>
       <div class="gw-act">${buyButton(next, 'coins', coins, t('gear.buyAria', { name: next.name, cost: next.cost, boost: pctBp(next.boostBp) }))}</div>`}`;
  return `<article class="gw-card${fresh ? ' is-bought' : ''}" data-slot="${slot}">
    ${artTile(sport, slot, tier, { locked: tier === 0, fresh })}
    <div class="gw-body">
      <h3 class="gw-slot">${esc(cur.slotName)}</h3>
      <p class="gw-cur">${esc(cur.name)}</p>
      <div class="gw-now">${pips(tier, fresh)}<span class="gw-boost ${tier ? '' : 'is-zero'}">${tier ? pctBp(cur.boostBp) : t('gear.noBoost')}</span></div>
      <p class="gw-blurb">${esc(cur.blurb)}</p>
    </div>
    <div class="gw-foot">${foot}</div>
  </article>`;
}

/** A prop for the base: built, in the workshop, or its price and fitting time. */
function propCard(p, s, w) {
  const owned = s.inventory.some((r) => r.item_id === p.id);
  const ws = owned ? null : inWorkshop(s, p.id);
  const act = owned ? `<p class="gw-max">${svg('check')} ${t('loop.prop.built')}</p>`
    : ws || `<p class="gw-fit">${svg('clock')} ${t('loop.ws.fitsIn', { time: fitText(p.fitMin) })} · ${t('loop.prop.points', { n: p.points })}</p>
      <div class="gw-act">${buyButton(p, 'coins', w.coins, t('loop.prop.buyAria', { name: p.name, cost: p.cost }))}</div>`;
  return `<article class="gw-card gw-prop${owned ? ' is-owned' : ''}" data-prop="${p.id}">
    ${imgTile(p.art, owned ? '✓' : '', 'is-prop')}
    <div class="gw-body">
      <h3 class="gw-slot">${esc(p.name)}</h3>
      <p class="gw-blurb">${esc(p.blurb)}</p>
      ${p.glow ? `<p class="gw-cur">${svg('bolt')} ${t('loop.prop.glows')}</p>` : ''}
    </div>
    <div class="gw-foot">${act}</div>
  </article>`;
}

/** The quadrant's level, and what the next one takes. */
function quadHead(sport, inventory) {
  const q = quadrantLevel(sport, inventory);
  const name = t(`loop.quad.${sport}`);
  return `<div class="quad-head">
    <span class="quad-name">${esc(name)}</span><b class="quad-lv data-num">${t('loop.quad.lv', { n: q.level })}</b>
    ${meter(q.next == null ? 1 : q.points / q.next, { segments: 12, cls: 'quad-meter', label: q.next == null ? t('loop.quad.top') : t('loop.quad.toNext', { n: q.toNext, lv: q.level + 1 }) })}
    <small>${q.next == null ? t('loop.quad.top') : t('loop.quad.toNext', { n: q.toNext, lv: q.level + 1 })}</small>
    <p class="gw-note">${t('loop.quad.note')}</p>
  </div>`;
}

// ---- collections and blueprints (docs/LOOP.md §4) --------------------------------------

const SET_NAME = ['', 'bronze', 'silver', 'gold'];

/** A sport's three sets as frames: empty from the start, each slot filling in as you fit it. */
function collectionRow(sport, inventory) {
  const frames = collectionsFor(sport, inventory).map((c) => {
    const cells = c.slots.map(({ slot, done }) => {
      const g = gearById(tierId(sport, slot, c.tier));
      return done
        ? `<span class="col-cell is-on"><img src="${esc(g.art)}" width="128" height="128" loading="lazy" alt=""></span>`
        : `<span class="col-cell" title="${esc(g.slotName)}">${svg(SLOT_ICON[`${sport}-${slot}`] || sport)}</span>`;
    }).join('');
    const state = c.done
      ? `<p class="col-paid">${svg('check')} ${t('loop.col.paid', { n: fmtNum(c.coins), date: esc(fmtDateShort(c.at)) })}</p>`
      : `<p class="col-bonus">${t('loop.col.bonus', { n: fmtNum(c.coins) })}</p>`;
    return `<article class="col-frame is-${SET_NAME[c.tier]}${c.done ? ' is-done' : ''}" aria-label="${esc(t('loop.col.aria', { set: t(`loop.col.${SET_NAME[c.tier]}`), n: c.have, of: c.slots.length }))}">
      <header><span class="col-plaque">${t(`loop.col.${SET_NAME[c.tier]}`)}</span><b class="data-num">${c.have}/${c.slots.length}</b></header>
      <div class="col-cells" aria-hidden="true">${cells}</div>
      ${state}
    </article>`;
  }).join('');
  return `<section class="col-row" aria-labelledby="col-h">
    <h3 id="col-h" class="gw-row-h">${svg('medal')} ${t('loop.col.title')}</h3>
    <p class="gw-note">${t('loop.col.note')}</p>
    <div class="col-frames">${frames}</div>
  </section>`;
}
const fmtDateShort = (iso) => fmtDate(iso, { day: 'numeric', month: 'short' });

/** Every rare prop, its price in fragments, and the one you're working towards. */
function blueprintRow(s) {
  const target = store.getSettings().bpTarget || null;
  const bp = blueprintState(s.quests, s.blueprints, target);
  const cards = RARE_PROPS.map((p) => {
    const built = bp.built.has(p.id);
    const on = bp.target?.id === p.id;
    const sportName = t(`sport.${SWITCH.find(([x]) => x === p.sport)[1]}`);
    let act;
    if (built) act = `<p class="gw-max">${svg('check')} ${t('loop.prop.built')}</p>`;
    else if (bp.free >= p.fragments) act = `<div class="gw-act"><button class="btn tiny primary" data-bp-build="${p.id}"${online() ? '' : ' disabled'}>${svg('wrench')} ${t('loop.bp.build')}</button></div>`;
    else if (on) {
      act = `${meter(bp.free / p.fragments, { segments: 12, cls: 'bp-meter', label: t('loop.bp.progress', { n: bp.free, of: p.fragments }) })}
        <p class="gw-need">${t('loop.bp.left', { n: `<b class="data-num">${p.fragments - bp.free}</b>` })}</p>`;
    } else act = `<div class="gw-act"><button class="btn tiny" data-bp-target="${p.id}" aria-pressed="false">${svg('target')} ${t('loop.bp.aim')}</button></div>`;
    return `<article class="gw-card gw-prop bp-card${built ? ' is-owned' : ''}${on ? ' is-target' : ''}" data-rare="${p.id}">
      ${imgTile(p.art, built ? '✓' : String(p.fragments), 'is-prop is-rare')}
      <div class="gw-body">
        <h3 class="gw-slot">${esc(p.name)}</h3>
        <p class="gw-cur">${svg(p.sport, `tint-${p.sport}`)} ${esc(sportName)} · ${t('loop.prop.points', { n: p.points })}</p>
        <p class="gw-blurb">${esc(p.blurb)}</p>
        <p class="gw-cur">${svg('scroll')} ${t('loop.bp.price', { n: p.fragments })}${on ? ` · <b>${t('loop.bp.aiming')}</b>` : ''}</p>
      </div>
      <div class="gw-foot">${act}</div>
    </article>`;
  }).join('');
  return `<section class="bp-row" id="bp-row" aria-labelledby="bp-h">
    <h3 id="bp-h" class="gw-row-h">${svg('scroll')} ${t('loop.bp.title')} <small class="bp-have">${t('loop.bp.have', { n: `<b class="data-num">${bp.free}</b>` })}</small></h3>
    <p class="gw-note">${t('loop.bp.note', { n: COLLECTION_RULES.fragmentPerMission })}</p>
    <div class="gw-grid">${cards}</div>
  </section>`;
}

const skCard = (i) => `<article class="gw-card is-sk" style="--sk-i:${i}" aria-hidden="true">
    <span class="gw-art sk-tile"></span>
    <div class="gw-body"><i class="sk-line" style="width:60%"></i><i class="sk-line" style="width:80%"></i><i class="sk-line" style="width:40%"></i></div>
    <div class="gw-foot"><i class="sk-line" style="width:50%"></i></div>
  </article>`;

function sportTabs(sport) {
  return `<div class="pg-sports gw-sports" role="tablist" aria-label="${t('gear.disciplines')}">${SWITCH.map(([s, key]) => {
    const on = s === sport;
    return `<button class="pg-sport ${on ? 'active' : ''}" role="tab" aria-selected="${on}" data-gear-sport="${s}">${svg(s)}<span>${t(`sport.${key}`)}</span></button>`;
  }).join('')}</div>`;
}

const fuelEffect = (f) => (f.nextWorkout
  ? t('gear.fuelEffectNext', { pct: f.boostBp / 100, n: f.perWindow })
  : t('gear.fuelEffect', { pct: f.boostBp / 100, h: f.hours, n: f.perWindow }));

function fuelCard(f, s, w, { mode, fresh }) {
  const held = w.held[f.id] || 0;
  let act;
  if (mode === 'shop') {
    act = held >= f.maxHeld
      ? `<span class="gw-need">${t('gear.fuelFull', { n: f.maxHeld })}</span>`
      : buyButton(f, 'carbs', w.carbs, t('gear.buyFuelAria', { name: f.name, cost: f.cost }));
  } else {
    const can = canUseFuel(f.id, s.boosts, held, Date.now());
    act = `<button class="btn tiny ${can.ok ? 'primary' : ''}" data-gear-use="${f.id}"${can.ok && online() ? '' : ' disabled'}>${svg('bolt')} ${t('gear.use')}</button>
      ${can.ok ? '' : `<span class="gw-need">${t(`gear.fuelWhy.${can.reason}`)}</span>`}`;
  }
  return `<article class="gw-card gw-fuel${fresh ? ' is-bought' : ''}" data-fuel="${f.id}">
    ${imgTile(f.art, `×${held}`, `fuel-${f.id}${fresh ? ' is-fresh' : ''}`)}
    <div class="gw-body">
      <h3 class="gw-slot">${esc(f.name)}</h3>
      <p class="gw-cur">${esc(fuelEffect(f))}</p>
      <p class="gw-blurb">${esc(t(`gear.fuel.${f.id}.blurb`))}</p>
    </div>
    <div class="gw-foot"><div class="gw-act">${act}</div></div>
  </article>`;
}

// an item only a feat gives: a locked plate in the shop with its condition
// spelled out, or (once won) the item in the colourway of its season
function featItemCard(it, won, worn) {
  const feats = it.feats.map(featById).filter(Boolean);
  const how = feats.map((f) => `<li><b>${esc(f.name)}</b> ${esc(f.blurb)}</li>`).join('');
  const logged = feats.some((f) => f.logged);
  const act = won && it.wearable
    ? `<button class="btn tiny ${worn ? 'primary' : ''}" data-gear-wear="${it.id}" aria-pressed="${worn}">${worn ? t('gear.wearing') : t('gear.wear')}</button>`
    : won ? `<span class="gw-need">${t('feat.ui.itemOwned')}</span>`
      : `<span class="gw-need">${svg('lock')} ${t(logged ? 'feat.ui.itemLockedLogged' : 'feat.ui.itemLocked')}</span>`;
  return `<article class="gw-card gw-feat-item${won ? ' is-won' : ' is-locked'}" data-feat-item="${it.id}"${won ? ` style="--hue:${seasonHue(won.season)}deg"` : ''}>
    <span class="gw-art is-feat has-img" aria-hidden="true"><img src="${esc(it.art)}" width="256" height="256" loading="lazy" alt="">${won ? `<i class="gw-tier">${esc(won.season)}</i>` : ''}</span>
    <div class="gw-body">
      <h3 class="gw-slot">${esc(it.name)}</h3>
      <p class="gw-cur">${t(won ? 'feat.ui.itemWon' : 'feat.ui.itemHow')}</p>
      <ul class="gw-feat-how">${how}</ul>
    </div>
    <div class="gw-foot"><div class="gw-act">${act}</div></div>
  </article>`;
}

function kitCard(k, owned, worn, coins, mode) {
  let act;
  if (owned) {
    act = `<button class="btn tiny ${worn ? 'primary' : ''}" data-gear-wear="${k.id}" aria-pressed="${worn}">${worn ? t('gear.wearing') : t('gear.wear')}</button>`;
  } else if (mode === 'shop') {
    act = buyButton(k, 'coins', coins, t('gear.buyKitAria', { name: k.name, cost: k.cost }));
  } else return '';
  return `<article class="gw-card gw-kitcard" data-kit="${k.id}">
    ${imgTile(kitArt(k.id))}
    <div class="gw-body">
      <h3 class="gw-slot">${esc(k.name)}</h3>
      <p class="gw-blurb">${t('gear.kitsNote')}</p>
    </div>
    <div class="gw-foot"><div class="gw-act">${act}</div></div>
  </article>`;
}

function shell(root, { title, icon, id, body, workouts }) {
  const head = sheetHead({ lead: 'back', icon, title, id, action: '' });
  // a redraw (a tab, a purchase) keeps the page where it was: same scroll, no jump
  const top = root.querySelector('.fh-screen')?.scrollTop || 0;
  root.innerHTML = `<div class="fh-screen gw-screen" role="dialog" aria-modal="true" aria-labelledby="${id}">${head}
    ${resourceBars(workouts, { cls: 'in-sheet' })}${body}</div>`;
  if (top) root.querySelector('.fh-screen').scrollTop = top;
  animateIn(root);
}

const signInBody = () => dialogue({ who: t('gear.shop'), icon: 'stall', text: t('gear.signIn'), cls: 'empty-dlg' })
  + `<button class="btn primary block" data-action="open-auth">${svg('cloud')} ${t('main.signInSync')}</button>`;

async function handleCommon(e, draw, onBought) {
  const buyBtn = e.target.closest('[data-gear-buy]');
  if (buyBtn) {
    const id = buyBtn.dataset.gearBuy;
    await busy(buyBtn, async () => {
      try {
        await buyItem(id);
        const g = gearById(id);
        const name = g?.name || propById(id)?.name || KITS.find((k) => k.id === id)?.name || fuelById(id)?.name || id;
        onBought?.(id);
        playAccept();
        haptic('record');
        // gear and props go to the workshop: say when they'll be ready
        const job = jobFor(gearState().jobs, id, serverNow());
        const line = job
          ? (jobPhase(job, serverNow()) === 'fitting'
            ? t('loop.ws.startedToast', { time: fmtTime(job.finishes_at) })
            : t('loop.ws.queuedToast', { start: fmtTime(job.started_at), time: fmtTime(job.finishes_at) }))
          : g ? t('gear.boughtBoost', { boost: pctBp(g.boostBp) }) : t('gear.bought');
        toast(`<b>${esc(name)}</b><br>${line}`, { icon: svg(fuelById(id) ? 'gel' : job ? 'wrench' : 'stall') });
      } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
    });
    draw();
    return true;
  }
  const use = e.target.closest('[data-gear-use]');
  if (use) {
    const f = fuelById(use.dataset.gearUse);
    await busy(use, async () => {
      try {
        await useFuel(f.id);
        playAccept();
        haptic('levelUp');
        toast(`<b>${t(f.nextWorkout ? 'gear.fuelOnNext' : 'gear.fuelOn', { name: f.name, pct: f.boostBp / 100, h: f.hours })}</b>`, { icon: svg('gel') });
      } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
    });
    draw();
    return true;
  }
  const skip = e.target.closest('[data-ws-skip]');
  if (skip) {
    await busy(skip, async () => {
      try {
        await skipJob(Number(skip.dataset.wsSkip), skip.dataset.kind);
        haptic('levelUp');
      } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
    });
    draw();
    return true;
  }
  const cancel = e.target.closest('[data-ws-cancel]');
  if (cancel) {
    const refund = Number(cancel.dataset.refund); const cost = Number(cancel.dataset.cost);
    const job = gearState().jobs.find((j) => j.id === Number(cancel.dataset.wsCancel));
    // mid-fit cancels ask first and say what comes back; removing a queued job is free and needs no question
    if (job && jobPhase(job, serverNow()) === 'fitting'
      && !confirm(refund < cost ? t('loop.ws.cancelPart', { n: fmtNum(refund), cost: fmtNum(cost) }) : t('loop.ws.cancelFull', { n: fmtNum(refund) }))) return true;
    await busy(cancel, async () => {
      try {
        await cancelJob(Number(cancel.dataset.wsCancel));
        toast(t('loop.ws.cancelled', { n: fmtNum(refund) }), { icon: svg('coin') });
      } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
    });
    draw();
    return true;
  }
  const wear = e.target.closest('[data-gear-wear]');
  if (wear) {
    const id = wear.dataset.gearWear;
    store.setSetting('kit', store.getSettings().kit === id ? null : id);
    draw();
    return true;
  }
  return false;
}

// ---- the shop --------------------------------------------------------------------------

const SHOP_TABS = [['stall', 'stall'], ['gear', 'wrench'], ['base', 'flag'], ['clothes', 'user'], ['fuel', 'gel']];

// ---- the daily stall (docs/LOOP.md §5.3) --------------------------------------------------

const ROOM_WORD = { locker: 'locker', bike: 'bike', pool: 'pool', run: 'run', gym: 'gym' };
/** Today's stall: one thing for your rooms, the same for everyone, and the next few days. */
function stallPanel(s, w) {
  const now = serverNow();
  const day = stallDay(now);
  const it = stallFor(day);
  if (!it) return `<p class="gw-note">${t('stall.soon')}</p>`;
  const owned = s.inventory.some((r) => r.item_id === it.id);
  const name = t(`cp.item.${it.id}`);
  const act = owned ? `<span class="gw-need">${svg('check')} ${t('stall.owned', { room: t(`cp.room.${ROOM_WORD[it.home]}`) })}</span>`
    : buyButton(it, 'coins', w.coins, t('stall.buyAria', { name, cost: it.cost })).replace('data-gear-buy=', 'data-stall-buy=');
  const ahead = stallAhead(day, 3);
  return `<section class="st-today" aria-labelledby="st-h">
      <h3 id="st-h" class="gw-row-h">${svg('stall')} ${t('stall.today')} <span class="st-left">${t('stall.turns', { time: `<b data-st-left="${now + msToNextStall(now)}">${clockLeft(msToNextStall(now))}</b>` })}</span></h3>
      <article class="gw-card st-card${owned ? ' is-owned' : ''}">
        <span class="gw-art has-img st-art" aria-hidden="true"><img src="${esc(it.art)}" width="192" height="192" alt=""></span>
        <div class="gw-body"><h3 class="gw-slot">${esc(name)}</h3>
          <p class="gw-blurb">${t(`stall.blurb.${it.id}`)}</p>
          <p class="gw-cur">${t('stall.size', { w: it.w, h: it.h })}</p></div>
        <div class="gw-foot"><div class="gw-act">${act}</div></div>
      </article>
      <p class="gw-note">${t('stall.fair')}</p>
    </section>
    <section class="st-ahead" aria-labelledby="st-next">
      <h3 id="st-next" class="gw-row-h">${t('stall.next')}</h3>
      <ul>${ahead.map((a) => `<li><img src="${esc(a.item.art)}" width="56" height="56" alt=""><span><small>${esc(fmtDate(a.day, { weekday: 'short' }))}</small><b>${esc(t(`cp.item.${a.item.id}`))}</b></span>${price(a.item.cost, 'coins')}</li>`).join('')}</ul>
    </section>`;
}

// season kits: won with weekly missions, never sold (docs/LOOP.md §5.2)
function seasonKitCard(k, owned, worn) {
  const nowTheme = seasonInfo(todayISO()).theme.id;
  const act = owned
    ? `<button class="btn tiny ${worn ? 'primary' : ''}" data-gear-wear="${k.id}" aria-pressed="${worn}">${worn ? t('gear.wearing') : t('gear.wear')}</button>`
    : `<span class="gw-need">${svg('lock')} ${t(k.theme === nowTheme ? 'season.kitHowNow' : 'season.kitHowLater', { n: SEASON_RULES.kitMissions })}</span>`;
  return `<article class="gw-card gw-kitcard${owned ? '' : ' is-locked'}" data-kit="${k.id}">
    ${imgTile(kitArt(k.id))}
    <div class="gw-body"><h3 class="gw-slot">${esc(t('season.kit', { name: t(`season.name.${k.theme}`) }))}</h3>
      <p class="gw-blurb">${t('season.kitBlurb')}</p></div>
    <div class="gw-foot"><div class="gw-act">${act}</div></div>
  </article>`;
}

/** Open the shop: tab 'gear' (by discipline), 'base' (props), 'clothes' or 'fuel'. */
export function openShop(ctx, { tab = 'gear', sport = 'bike', focus = '' } = {}) {
  let off = null;
  const root = openLayer('shop-gear', { className: 'gear-layer', instant: true, onClose: () => { off?.(); clearInterval(tick); } });
  let current = SLOTS[sport] ? sport : 'bike';
  let view = tab;
  let fresh = null;

  const draw = () => {
    const workouts = store.getWorkouts();
    if (!gearEnabled()) { shell(root, { title: t('gear.shop'), icon: 'stall', id: 'gw-title', body: signInBody(), workouts }); return; }
    const s = gearState();
    const w = walletNow(workouts);
    const loading = !s.at;
    const tabs = `<div class="gw-tabs" role="tablist" aria-label="${t('gear.shop')}">${SHOP_TABS.map(([v, ic]) =>
      `<button class="gw-tab${v === view ? ' active' : ''}" role="tab" aria-selected="${v === view}" data-gear-tab="${v}">${svg(ic)}<span>${t(`gear.tab.${v}`)}</span>
        <small>${svg(v === 'fuel' ? 'carbs' : 'coin', 'cur-ico')}</small></button>`).join('')}</div>`;
    let panel;
    if (view === 'stall') {
      panel = stallPanel(s, w);
    } else if (view === 'gear') {
      const boost = gearBoost(s.inventory, current);
      panel = `${sportTabs(current)}
        <div class="gw-total"><span>${t('gear.disciplineBoost')}</span><b class="data-num">${pctBp(boost)}</b>
          <small>${t('gear.ofCap', { cap: pctBp(GEAR_RULES.sportCapBp) })}</small>
          <span class="gw-cap" style="--f:${(boost / GEAR_RULES.sportCapBp).toFixed(3)}" aria-hidden="true"><i></i></span></div>
        <div class="gw-grid" role="tabpanel"${loading ? ' aria-busy="true"' : ''}>${loading ? [0, 1, 2, 3].map(skCard).join('')
          : SLOTS[current].map((slot) => gearCard(current, slot, s.inventory, w.coins, fresh === slot, s)).join('')}</div>`;
    } else if (view === 'base') {
      panel = `${sportTabs(current)}${quadHead(current, s.inventory)}
        <div class="gw-grid" role="tabpanel">${propsFor(current).map((p) => propCard(p, s, w)).join('')}</div>
        ${collectionRow(current, s.inventory)}${blueprintRow(s)}`;
    } else if (view === 'clothes') {
      const owned = new Set(ownedKits(s.inventory).map((k) => k.id));
      const worn = store.getSettings().kit || null;
      const wonItems = new Map(featItems().map((i) => [i.id, i]));
      panel = `<p class="gw-note">${t('gear.clothesNote')}</p>
        <div class="gw-grid" role="tabpanel">${KITS.map((k) => kitCard(k, owned.has(k.id), worn === k.id, w.coins, 'shop')).join('')}</div>
        <h3 class="gw-row-h gw-feat-h">${svg('trophy')} ${t('feat.ui.itemsTitle')}</h3>
        <p class="gw-note">${t('feat.ui.itemsNote')}</p>
        <div class="gw-grid">${FEAT_ITEMS.map((it) => featItemCard(it, wonItems.get(it.id), worn === it.id)).join('')}</div>
        <h3 class="gw-row-h gw-feat-h">${svg('star')} ${t('season.kitsTitle')}</h3>
        <p class="gw-note">${t('season.kitsNote', { n: SEASON_RULES.kitMissions })}</p>
        <div class="gw-grid">${SEASON_KITS.map((k) => seasonKitCard(k, s.inventory.some((r) => r.item_id === k.id), worn === k.id)).join('')}</div>`;
    } else {
      panel = `<p class="gw-note">${t('gear.fuelNote')}</p>${gelChip(s.boosts, { cls: 'gw-gel-top' })}
        <div class="gw-grid" role="tabpanel">${FUELS.map((f) => fuelCard(f, s, w, { mode: 'shop', fresh: fresh === f.id })).join('')}</div>`;
    }
    shell(root, {
      title: t('gear.shop'), icon: 'stall', id: 'gw-title', workouts,
      body: `${online() ? '' : `<p class="gw-offline" id="gw-offline" role="status">${svg('cloud')} ${t('gear.offline')}</p>`}
        ${tabs}${['gear', 'base'].includes(view) && (s.jobs || []).some((j) => j.state !== 'cancelled') ? workshopCard(s, w) : ''}${panel}<p class="gw-note gw-honest">${svg('trophy')} ${t('gear.honest')}</p>`,
    });
    fresh = null;
    markWorkshopSeen();
  };
  // the countdowns tick by the server's clock; a finish redraws (and asks the server)
  const tick = setInterval(() => {
    if (!root.isConnected) { clearInterval(tick); return; }
    const now = serverNow();
    let finished = false;
    root.querySelectorAll('[data-ws-left]').forEach((el) => {
      const left = Number(el.dataset.wsLeft) - now;
      if (left <= 0) finished = true;
      el.textContent = clockLeft(left);
    });
    // the stall turns over at midnight UTC: show the next one
    root.querySelectorAll('[data-st-left]').forEach((el) => {
      const left = Number(el.dataset.stLeft) - now;
      if (left <= 0) finished = true;
      el.textContent = clockLeft(left);
    });
    root.querySelectorAll('[data-ws-bar]').forEach((el) => {
      const [a, b] = el.dataset.wsBar.split(':').map(Number);
      el.style.setProperty('--f', Math.min(1, Math.max(0, (now - a) / Math.max(1, b - a))).toFixed(3));
    });
    if (finished) { draw(); if (gearEnabled()) refreshGear(); }
  }, 1000);

  off = onGear(() => { if (root.isConnected) draw(); });
  root.onclick = async (e) => {
    const tb = e.target.closest('[data-gear-tab]');
    if (tb) { view = tb.dataset.gearTab; draw(); return; }
    const sb = e.target.closest('[data-stall-buy]');
    if (sb) {
      const id = sb.dataset.stallBuy;
      await busy(sb, async () => {
        try {
          await buyStall(id);
          playAccept();
          haptic('record');
          toast(`<b>${esc(t(`cp.item.${id}`))}</b><br>${t('stall.boughtToast')}`, { icon: svg('stall') });
        } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
      });
      draw();
      return;
    }
    const sp = e.target.closest('[data-gear-sport]');
    if (sp) { current = sp.dataset.gearSport; draw(); return; }
    const aim = e.target.closest('[data-bp-target]');
    if (aim) { store.setSetting('bpTarget', aim.dataset.bpTarget); haptic('tick'); draw(); return; }
    const build = e.target.closest('[data-bp-build]');
    if (build) {
      const id = build.dataset.bpBuild;
      await busy(build, async () => {
        try {
          await buildBlueprint(id);
          if (store.getSettings().bpTarget === id) store.setSetting('bpTarget', null);
          playAccept();
          haptic('levelUp');
          toast(`<b>${esc(rareById(id).name)}</b><br>${t('loop.bp.builtToast')}`, { icon: svg('scroll') });
        } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
      });
      draw();
      return;
    }
    await handleCommon(e, draw, (id) => { fresh = gearById(id)?.slot || (fuelById(id) ? id : null); });
  };
  draw();
  if (focus === 'bp') root.querySelector('#bp-row')?.scrollIntoView({ block: 'start' });
  if (gearEnabled()) refreshGear().then(() => { if (root.isConnected) draw(); });
  return root;
}
/** The earlier name, kept for callers. */
export const openGear = (ctx, sport) => openShop(ctx, { tab: 'gear', sport });

// ---- the inventory ------------------------------------------------------------------------

/** Open the inventory: fuel you hold (use it here), clothes you own, gear fitted. */
export function openInventory() {
  let off = null;
  const root = openLayer('inventory', { className: 'gear-layer', instant: true, onClose: () => off?.() });
  const draw = () => {
    const workouts = store.getWorkouts();
    if (!gearEnabled()) { shell(root, { title: t('gear.inventory'), icon: 'backpack', id: 'inv-title', body: signInBody(), workouts }); return; }
    const s = gearState();
    const w = walletNow(workouts);
    const fuels = FUELS.filter((f) => (w.held[f.id] || 0) > 0);
    const kits = ownedKits(s.inventory);
    const won = featItems();
    const worn = store.getSettings().kit || null;
    const gearRows = SPORTS.map((sport) => {
      const rows = SLOTS[sport].map((slot) => ({ slot, tier: ownedTier(s.inventory, sport, slot) })).filter((r) => r.tier > 0);
      if (!rows.length) return '';
      const label = t(`sport.${SWITCH.find(([x]) => x === sport)[1]}`);
      return `<li class="inv-sport"><h4>${svg(sport, `tint-${sport}`)} ${esc(label)} <span class="gw-boost">${pctBp(gearBoost(s.inventory, sport))}</span></h4>
        <ul>${rows.map(({ slot, tier }) => {
          const e = gearById(tierId(sport, slot, tier));
          return `<li class="inv-gear">${artTile(sport, slot, tier)}<span><b>${esc(e.name)}</b><small>${esc(e.slotName)}</small></span>${pips(tier)}</li>`;
        }).join('')}</ul></li>`;
    }).filter(Boolean).join('');
    const empty = (txt, tab) => `<p class="gw-note inv-empty">${txt} <button class="link" data-inv-shop="${tab}">${t('gear.toShop')}</button></p>`;
    shell(root, {
      title: t('gear.inventory'), icon: 'backpack', id: 'inv-title', workouts,
      body: `${gelChip(s.boosts, { cls: 'gw-gel-top' })}
        <section class="gw-row" aria-labelledby="inv-fuel"><h3 id="inv-fuel" class="gw-row-h">${svg('gel')} ${t('gear.tab.fuel')}</h3>
          ${fuels.length ? `<div class="gw-grid">${fuels.map((f) => fuelCard(f, s, w, { mode: 'inventory' })).join('')}</div>` : empty(t('gear.invNoFuel'), 'fuel')}</section>
        <section class="gw-row" aria-labelledby="inv-clothes"><h3 id="inv-clothes" class="gw-row-h">${svg('user')} ${t('gear.tab.clothes')}</h3>
          ${kits.length || won.length ? `<div class="gw-grid">${kits.map((k) => kitCard(k, true, worn === k.id, w.coins, 'inventory')).join('')}${won.map((i) => featItemCard(featItemById(i.id), i, worn === i.id)).join('')}</div>` : empty(t('gear.invNoClothes'), 'clothes')}</section>
        <section class="gw-row" aria-labelledby="inv-gear"><h3 id="inv-gear" class="gw-row-h">${svg('wrench')} ${t('gear.tab.gear')}</h3>
          ${gearRows ? `<ul class="inv-list">${gearRows}</ul>` : empty(t('gear.invNoGear'), 'gear')}</section>`,
    });
  };
  off = onGear(() => { if (root.isConnected) draw(); });
  root.onclick = async (e) => {
    const go = e.target.closest('[data-inv-shop]');
    if (go) { openShop(null, { tab: go.dataset.invShop }); return; }
    await handleCommon(e, draw);
  };
  draw();
  if (gearEnabled()) refreshGear().then(() => { if (root.isConnected) draw(); });
  return root;
}
