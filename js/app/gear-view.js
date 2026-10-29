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

import { openLayer, closeLayer } from './nav.js';
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
import { featById } from '../core/feats.js';
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
import { shopCard, cardButton, actionButton, walletBar, openShopInfo, priceText } from './shop-ui.js';
import { cardState } from '../core/shop-cards.js';

const CUR_ICON = { coins: 'icons/Pixelart/GEAR/coin.png', carbs: 'icons/Pixelart/GEAR/carbs.png' };
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

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

const skCard = (i) => `<article class="gw-card is-sk" style="--sk-i:${i}" aria-hidden="true">
    <span class="gw-art sk-tile"></span>
    <div class="gw-body"><i class="sk-line" style="width:60%"></i><i class="sk-line" style="width:80%"></i><i class="sk-line" style="width:40%"></i></div>
    <div class="gw-foot"><i class="sk-line" style="width:50%"></i></div>
  </article>`;

function sportTabs(sport) {
  return `<div class="pg-sports gw-sports" role="tablist" aria-label="${t('gear.disciplines')}">${SWITCH.map(([s, key]) => {
    const on = s === sport;
    return `<button class="pg-sport ${on ? 'active' : ''}" role="tab" aria-selected="${on}" data-gear-sport="${s}"${on ? '' : ' tabindex="-1"'}>${svg(s)}<span>${t(`sport.${key}`)}</span></button>`;
  }).join('')}</div>`;
}

/** A fuel on the shop's card grid: name, picture, held of max, price. */
function fuelShopCard(f, w, fresh) {
  const st = cardState({ cost: f.cost, balance: w.carbs, held: w.held[f.id] || 0, max: f.maxHeld });
  return shopCard({
    id: f.id, kind: 'fuel', title: f.name, art: f.art, st, fresh,
    button: cardButton(f, 'carbs', st, { label: t('gear.buyFuelAria', { name: f.name, cost: f.cost }) }),
  });
}

/** The Use button for fuel you hold: mint when it can go on, else grey with the reason under it. */
function useButton(f, s, w) {
  const can = canUseFuel(f.id, s.boosts, w.held[f.id] || 0, Date.now());
  if (can.ok) return actionButton(t('gear.use'), `data-gear-use="${f.id}" aria-label="${esc(t('shop.useAria', { name: f.name }))}"`, { icon: 'bolt', variant: 'mint' });
  const why = t(`gear.fuelWhy.${can.reason}`);
  return `<button class="sc-buy is-locked" disabled aria-label="${esc(`${f.name} · ${why}`)}">${svg('bolt')}<span>${t('gear.use')}</span></button>
    <small class="sc-need" aria-hidden="true">${esc(why)}</small>`;
}

/** Fuel you hold, on the inventory's grid: how many, and Use. */
function fuelInvCard(f, s, w) {
  const st = cardState({ cost: f.cost, balance: w.carbs, held: w.held[f.id] || 0, max: f.maxHeld });
  return shopCard({ id: f.id, kind: 'fuel', mode: 'use', title: f.name, art: f.art, st, plate: 'blue', button: useButton(f, s, w) });
}

/**
 * Everything a fuel card leaves out: the boost, when it works, the weekly
 * limit, storage, the story. In the shop it sells; in the inventory it's used.
 */
function fuelInfo(f, s, w, redraw, mode = 'buy') {
  const st = cardState({ cost: f.cost, balance: w.carbs, held: w.held[f.id] || 0, max: f.maxHeld });
  const rows = [
    [t('shop.fact.boost'), `<b class="data-num">+${fmtNum(f.boostBp / 100)}% XP</b>`],
    [t('shop.fact.when'), esc(f.nextWorkout ? t('shop.fact.nextWorkout') : t('shop.fact.forHours', { h: f.hours }))],
    [t('shop.fact.limit'), esc(t('shop.fact.perWeek', { n: f.perWindow }))],
    [t('shop.storage'), `<b class="data-num">${st.storage.n}/${st.storage.max}</b>`],
    [t('shop.fact.price'), `<b class="data-num">${priceText(f.cost, 'carbs')}</b>`],
  ];
  return openShopInfo({
    title: f.name, art: f.art, rows, lore: t(`gear.fuel.${f.id}.blurb`), note: esc(t('shop.fuelNote')),
    button: mode === 'use' ? useButton(f, s, w) : cardButton(f, 'carbs', st, { label: t('gear.buyFuelAria', { name: f.name, cost: f.cost }) }),
    onClick: async (e, layer) => { if (await handleCommon(e, () => {})) { closeLayer(layer); redraw(); } },
  });
}

function shell(root, { title, icon, id, body, workouts, cls = '', bars = true, foot = '' }) {
  const head = sheetHead({ lead: 'back', icon, title, id, action: '' });
  // a redraw (a tab, a purchase) keeps the page where it was: same scroll, no jump
  const top = root.querySelector('.fh-screen')?.scrollTop || 0;
  root.innerHTML = `<div class="fh-screen gw-screen ${cls}" role="dialog" aria-modal="true" aria-labelledby="${id}">${head}
    ${bars ? resourceBars(workouts, { cls: 'in-sheet' }) : ''}${body}</div>${foot}`;
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
// each tab's picture (tools/gen-shop-ui.mjs) and the currency it spends
const TAB_ART = (v) => `icons/UI/tabs/tab-${v}.webp`;
const TAB_CUR = { stall: 'coins', gear: 'coins', base: 'coins', clothes: 'coins', fuel: 'carbs' };


// ---- the card grid for gear, base, kit and the stall (docs/SHOP.md, phases 3–4) ----------

/** A card's state for something the workshop may hold: building (with its clock), owned, or to buy. */
function wsCardState(s, id, cost, balance, owned) {
  if (owned) return cardState({ cost, balance, owned: true });
  const j = jobFor(s.jobs, id, serverNow());
  if (!j) return cardState({ cost, balance });
  const end = Date.parse(j.finishes_at);
  return jobPhase(j, serverNow()) === 'fitting'
    ? { state: 'building', short: 0, storage: null, end, left: clockLeft(end - serverNow()) }
    : { state: 'building', short: 0, storage: null, queued: t('shop.startsAt', { time: fmtTime(j.started_at) }) };
}
const tierCounter = (tier) => ({ label: t('shop.tier'), text: `${tier}/3`, full: tier >= 3 });

/** A gear slot: the next tier's picture, the tier you're on, its price (or the workshop's clock). */
function gearShopCard(sport, slot, s, w, fresh) {
  const tier = ownedTier(s.inventory, sport, slot);
  const cur = gearById(tierId(sport, slot, tier));
  const next = nextTier(s.inventory, sport, slot);
  const show = next || cur;
  const st = next ? wsCardState(s, next.id, next.cost, w.coins, false) : cardState({ cost: 0, balance: 0, owned: true });
  return shopCard({
    id: `${sport}:${slot}`, kind: 'gear', title: cur.slotName, art: ART_READY.has(show.id) ? show.art : cur.art,
    st, fresh, counter: tierCounter(tier), badge: next ? `T${next.tier}` : `T${tier}`,
    button: cardButton(next || cur, 'coins', st, { owned: t('gear.maxed'), label: next ? t('gear.buyAria', { name: next.name, cost: next.cost, boost: pctBp(next.boostBp) }) : '' }),
  });
}
function gearInfo(sport, slot, s, w, redraw) {
  const tier = ownedTier(s.inventory, sport, slot);
  const cur = gearById(tierId(sport, slot, tier));
  const next = nextTier(s.inventory, sport, slot);
  const st = next ? wsCardState(s, next.id, next.cost, w.coins, false) : cardState({ cost: 0, balance: 0, owned: true });
  const rows = [
    [t('shop.fact.now'), `${esc(cur.name)} · <b class="data-num">${tier ? pctBp(cur.boostBp) : t('gear.noBoost')}</b>`],
    ...(next ? [
      [t('shop.fact.next'), `${esc(next.name)} · <b class="data-num">${pctBp(next.boostBp)}</b>`],
      [t('shop.fact.fit'), esc(fitText(fitMinutes(next.id)))],
      [t('shop.fact.price'), `<b class="data-num">${priceText(next.cost, 'coins')}</b>`],
    ] : [[t('shop.fact.next'), esc(t('gear.maxed'))]]),
    [t('gear.disciplineBoost'), `<b class="data-num">${pctBp(gearBoost(s.inventory, sport))}</b> ${esc(t('gear.ofCap', { cap: pctBp(GEAR_RULES.sportCapBp) }))}`],
  ];
  openShopInfo({
    title: cur.slotName, art: ART_READY.has((next || cur).id) ? (next || cur).art : cur.art, rows, lore: (next || cur).blurb,
    button: cardButton(next || cur, 'coins', st, { owned: t('gear.maxed'), label: next ? t('gear.buyAria', { name: next.name, cost: next.cost, boost: pctBp(next.boostBp) }) : '' }),
    onClick: async (e, layer) => { if (await handleCommon(e, () => {})) { closeLayer(layer); redraw(); } },
  });
}

/** A prop for the base. */
function propShopCard(p, s, w) {
  const st = wsCardState(s, p.id, p.cost, w.coins, s.inventory.some((r) => r.item_id === p.id));
  return shopCard({
    id: p.id, kind: 'prop', title: p.name, art: p.art, st, pixel: true,
    counter: { label: t('shop.points'), text: `+${p.points}` },
    button: cardButton(p, 'coins', st, { owned: t('loop.prop.built'), label: t('loop.prop.buyAria', { name: p.name, cost: p.cost }) }),
  });
}
function propInfo(p, s, w, redraw) {
  const st = wsCardState(s, p.id, p.cost, w.coins, s.inventory.some((r) => r.item_id === p.id));
  openShopInfo({
    title: p.name, art: p.art, lore: p.blurb,
    rows: [
      [t('shop.points'), `<b class="data-num">+${p.points}</b>`],
      [t('shop.fact.fit'), esc(fitText(p.fitMin))],
      [t('shop.fact.price'), `<b class="data-num">${priceText(p.cost, 'coins')}</b>`],
      ...(p.glow ? [[t('shop.fact.light'), esc(t('loop.prop.glows'))]] : []),
    ],
    button: cardButton(p, 'coins', st, { owned: t('loop.prop.built'), label: t('loop.prop.buyAria', { name: p.name, cost: p.cost }) }),
    onClick: async (e, layer) => { if (await handleCommon(e, () => {})) { closeLayer(layer); redraw(); } },
  });
}

/** A rare piece, built from blueprint fragments. */
function rareShopCard(p, bp) {
  const built = bp.built.has(p.id);
  const on = bp.target?.id === p.id;
  const st = { state: built ? 'owned' : 'buy', short: 0, storage: null };
  let button;
  if (built) button = cardButton(p, 'coins', st, { owned: t('loop.prop.built') });
  else if (bp.free >= p.fragments) button = actionButton(t('loop.bp.build'), `data-bp-build="${p.id}"`, { icon: 'wrench', variant: 'gold' });
  else if (on) button = actionButton(t('loop.bp.aiming'), `data-bp-target="${p.id}"`, { icon: 'target', pressed: true, disabled: true, variant: 'mint' });
  else button = actionButton(t('loop.bp.aim'), `data-bp-target="${p.id}"`, { icon: 'target', pressed: false, variant: 'mint' });
  return shopCard({
    id: p.id, kind: 'rare', title: p.name, art: p.art, st, pixel: true,
    counter: built ? null : { label: t('shop.fragments'), text: `${Math.min(bp.free, p.fragments)}/${p.fragments}`, full: bp.free >= p.fragments },
    button,
  });
}
function rareInfo(p, bp) {
  const sportName = t(`sport.${SWITCH.find(([x]) => x === p.sport)[1]}`);
  openShopInfo({
    title: p.name, art: p.art, lore: p.blurb, note: esc(t('loop.bp.note', { n: COLLECTION_RULES.fragmentPerMission })),
    rows: [
      [t('shop.fact.where'), esc(sportName)],
      [t('shop.points'), `<b class="data-num">+${p.points}</b>`],
      [t('shop.fragments'), `<b class="data-num">${Math.min(bp.free, p.fragments)}/${p.fragments}</b>`],
    ],
  });
}

/** Wear (mint) or Wearing (gold, pressed): one kit at a time. */
const wearButton = (id, worn) => actionButton(worn ? t('gear.wearing') : t('gear.wear'), `data-gear-wear="${id}"`, { pressed: worn, variant: worn ? 'gold' : 'mint', icon: worn ? 'check' : '' });

/** A kit you can buy and wear. */
function kitShopCard(k, owned, worn, w) {
  const st = cardState({ cost: k.cost, balance: w.coins, owned });
  const button = owned
    ? wearButton(k.id, worn)
    : cardButton(k, 'coins', st, { label: t('gear.buyKitAria', { name: k.name, cost: k.cost }) });
  return shopCard({ id: k.id, kind: 'kit', title: k.name, art: kitArt(k.id), st, plate: 'blue', button });
}
function kitInfo(k, owned, worn, w, redraw) {
  const st = cardState({ cost: k.cost, balance: w.coins, owned });
  openShopInfo({
    title: k.name, art: kitArt(k.id), lore: t('gear.kitsNote'),
    rows: [[t('shop.fact.price'), `<b class="data-num">${priceText(k.cost, 'coins')}</b>`]],
    button: owned ? wearButton(k.id, worn) : cardButton(k, 'coins', st, { label: t('gear.buyKitAria', { name: k.name, cost: k.cost }) }),
    onClick: async (e, layer) => { if (await handleCommon(e, () => {})) { closeLayer(layer); redraw(); } },
  });
}

/** An item only a feat gives: locked until won, then wearable (cycling kits) or simply yours. */
function featShopCard(it, won, worn) {
  const st = { state: won ? 'owned' : 'buy', short: 0, storage: null };
  const button = won && it.wearable
    ? wearButton(it.id, worn)
    : won ? cardButton(it, 'coins', st, { owned: t('feat.ui.itemOwned') })
      : actionButton(t('shop.locked'), '', { icon: 'lock', variant: 'locked', disabled: true });
  return shopCard({ id: it.id, kind: 'feat', title: it.name, art: it.art, st, plate: won ? 'blue' : 'grey', button, badge: won ? won.season : '' });
}
function featInfo(it, won, worn, redraw) {
  const feats = it.feats.map(featById).filter(Boolean);
  openShopInfo({
    title: it.name, art: it.art, lore: t(won ? 'feat.ui.itemWon' : 'feat.ui.itemHow'),
    rows: feats.map((f) => [f.name, esc(f.blurb)]), stack: true,
    note: esc(t('feat.ui.itemsNote')),
    button: won && it.wearable ? wearButton(it.id, worn) : '',
    onClick: async (e, layer) => { if (await handleCommon(e, () => {})) { closeLayer(layer); redraw(); } },
  });
}

/** A season colourway: won with weekly missions in its season, never sold. */
function seasonKitShopCard(k, owned, worn) {
  const st = { state: owned ? 'owned' : 'buy', short: 0, storage: null };
  const name = t('season.kit', { name: t(`season.name.${k.theme}`) });
  const button = owned
    ? wearButton(k.id, worn)
    : actionButton(t('shop.locked'), '', { icon: 'lock', variant: 'locked', disabled: true });
  return shopCard({ id: k.id, kind: 'skit', title: name, art: kitArt(k.id), st, plate: owned ? 'blue' : 'grey', button });
}
function seasonKitInfo(k, owned, worn, redraw) {
  const nowTheme = seasonInfo(todayISO()).theme.id;
  openShopInfo({
    title: t('season.kit', { name: t(`season.name.${k.theme}`) }), art: kitArt(k.id), lore: t('season.kitBlurb'),
    rows: [[t('shop.fact.how'), esc(t(k.theme === nowTheme ? 'season.kitHowNow' : 'season.kitHowLater', { n: SEASON_RULES.kitMissions }))]],
    note: esc(t('season.kitsNote', { n: SEASON_RULES.kitMissions })),
    button: owned ? wearButton(k.id, worn) : '',
    onClick: async (e, layer) => { if (await handleCommon(e, () => {})) { closeLayer(layer); redraw(); } },
  });
}

/** The day's stall item. */
function stallShopCard(it, s, w) {
  const owned = s.inventory.some((r) => r.item_id === it.id);
  const st = cardState({ cost: it.cost, balance: w.coins, owned });
  return shopCard({
    id: it.id, kind: 'stall', title: t(`cp.item.${it.id}`), art: it.art, st, wide: true,
    counter: { label: t('shop.size'), text: `${it.w}×${it.h}` },
    button: cardButton(it, 'coins', st, { buyAttr: 'data-stall-buy', owned: t('stall.owned', { room: t(`cp.room.${it.home}`) }), label: t('stall.buyAria', { name: t(`cp.item.${it.id}`), cost: it.cost }) }),
  });
}
function stallInfo(it, s, w, redraw) {
  const owned = s.inventory.some((r) => r.item_id === it.id);
  const st = cardState({ cost: it.cost, balance: w.coins, owned });
  openShopInfo({
    title: t(`cp.item.${it.id}`), art: it.art, lore: t(`stall.blurb.${it.id}`), note: esc(t('stall.fair')),
    rows: [
      [t('shop.size'), esc(t('stall.size', { w: it.w, h: it.h }))],
      [t('shop.fact.where'), esc(t(`cp.room.${it.home}`))],
      [t('shop.fact.price'), `<b class="data-num">${priceText(it.cost, 'coins')}</b>`],
    ],
    button: cardButton(it, 'coins', st, { buyAttr: 'data-stall-buy', owned: t('stall.owned', { room: t(`cp.room.${it.home}`) }), label: t('stall.buyAria', { name: t(`cp.item.${it.id}`), cost: it.cost }) }),
    onClick: (e, layer) => {
      const b = e.target.closest('[data-stall-buy]');
      if (b) { closeLayer(layer); redraw(b.dataset.stallBuy); }
    },
  });
}

/** Today's stall on the card grid, and the next three days. */
function stallCards(s, w) {
  const now = serverNow();
  const day = stallDay(now);
  const it = stallFor(day);
  if (!it) return `<p class="gw-note">${t('stall.soon')}</p>`;
  const ahead = stallAhead(day, 3);
  return `<div class="sc-strip"><span>${svg('clock')} ${t('stall.turns', { time: `<b data-st-left="${now + msToNextStall(now)}">${clockLeft(msToNextStall(now))}</b>` })}</span></div>
    <div class="sc-grid">${stallShopCard(it, s, w)}</div>
    <h3 class="sc-row-h">${t('stall.next')}</h3>
    <ul class="sc-ahead">${ahead.map((a) => `<li><img src="${esc(a.item.art)}" width="96" height="96" alt="">
      <span><small>${esc(fmtDate(a.day, { weekday: 'short' }))}</small><b>${esc(t(`cp.item.${a.item.id}`))}</b></span>
      <i class="sc-ahead-price"><b class="data-num">${fmtNum(a.item.cost)}</b><img src="icons/Pixelart/GEAR/coin.png" width="32" height="32" alt=""></i></li>`).join('')}</ul>`;
}

/**
 * The (i) on any card, in the shop or the inventory: open its sheet. A redraw
 * replaces the card, so focus goes back to the new card's (i) when it closes.
 */
function cardInfo(btn, draw, stallBuy) {
  const w = walletNow(store.getWorkouts());
  const s = gearState();
  const id = btn.dataset.shopInfo;
  const kind = btn.dataset.kind;
  const worn = store.getSettings().kit || null;
  const host = btn.closest('.gear-layer');
  const redraw = () => {
    draw();
    host?.querySelector(`[data-shop-info="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  };
  switch (kind) {
    case 'fuel': fuelInfo(fuelById(id), s, w, redraw, btn.dataset.mode); break;
    case 'gear': { const [sp, sl] = id.split(':'); gearInfo(sp, sl, s, w, redraw); break; }
    case 'prop': propInfo(propById(id), s, w, redraw); break;
    case 'rare': rareInfo(rareById(id), blueprintState(s.quests, s.blueprints, store.getSettings().bpTarget || null)); break;
    case 'kit': kitInfo(KITS.find((k) => k.id === id), ownedKits(s.inventory).some((k) => k.id === id), worn === id, w, redraw); break;
    case 'feat': featInfo(featItemById(id), featItems().find((i) => i.id === id), worn === id, redraw); break;
    case 'skit': seasonKitInfo(SEASON_KITS.find((k) => k.id === id), s.inventory.some((r) => r.item_id === id), worn === id, redraw); break;
    case 'stall': stallInfo(stallFor(stallDay(serverNow())), s, w, stallBuy); break;
    default: break;
  }
}

// ---- the daily stall (docs/LOOP.md §5.3) --------------------------------------------------

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
    const tabs = `<div class="gw-tabs sh-tabs" role="tablist" aria-label="${t('gear.shop')}">${SHOP_TABS.map(([v]) =>
      `<button class="gw-tab sh-tab${v === view ? ' active' : ''}" role="tab" id="shop-tab-${v}" aria-selected="${v === view}" aria-controls="shop-panel" data-gear-tab="${v}"${v === view ? '' : ' tabindex="-1"'}>
        <img src="${TAB_ART(v)}" width="128" height="128" alt="" draggable="false"><span>${t(`gear.tab.${v}`)}</span></button>`).join('')}</div>`;
    let panel;
    if (view === 'stall') {
      panel = stallCards(s, w);
    } else if (view === 'gear') {
      const boost = gearBoost(s.inventory, current);
      panel = `${sportTabs(current)}
        <div class="gw-total sc-total"><span>${t('gear.disciplineBoost')}</span><b class="data-num">${pctBp(boost)}</b>
          <small>${t('gear.ofCap', { cap: pctBp(GEAR_RULES.sportCapBp) })}</small>
          <span class="gw-cap" style="--f:${(boost / GEAR_RULES.sportCapBp).toFixed(3)}" aria-hidden="true"><i></i></span></div>
        <div class="sc-grid"${loading ? ' aria-busy="true"' : ''}>${loading ? [0, 1, 2, 3].map(skCard).join('')
          : SLOTS[current].map((slot) => gearShopCard(current, slot, s, w, fresh === slot)).join('')}</div>`;
    } else if (view === 'base') {
      const bp = blueprintState(s.quests, s.blueprints, store.getSettings().bpTarget || null);
      panel = `${sportTabs(current)}${quadHead(current, s.inventory)}
        <div class="sc-grid">${propsFor(current).map((p) => propShopCard(p, s, w)).join('')}</div>
        ${collectionRow(current, s.inventory)}
        <section class="bp-row" id="bp-row" aria-labelledby="bp-h">
          <h3 id="bp-h" class="sc-row-h">${svg('scroll')} ${t('loop.bp.title')} <small class="bp-have">${t('loop.bp.have', { n: `<b class="data-num">${bp.free}</b>` })}</small></h3>
          <div class="sc-grid">${RARE_PROPS.map((p) => rareShopCard(p, bp)).join('')}</div>
        </section>`;
    } else if (view === 'clothes') {
      const owned = new Set(ownedKits(s.inventory).map((k) => k.id));
      const worn = store.getSettings().kit || null;
      const wonItems = new Map(featItems().map((i) => [i.id, i]));
      panel = `<div class="sc-grid">${KITS.map((k) => kitShopCard(k, owned.has(k.id), worn === k.id, w)).join('')}</div>
        <h3 class="sc-row-h">${svg('trophy')} ${t('feat.ui.itemsTitle')}</h3>
        <div class="sc-grid">${FEAT_ITEMS.map((it) => featShopCard(it, wonItems.get(it.id), worn === it.id)).join('')}</div>
        <h3 class="sc-row-h">${svg('star')} ${t('season.kitsTitle')}</h3>
        <div class="sc-grid">${SEASON_KITS.map((k) => seasonKitShopCard(k, s.inventory.some((r) => r.item_id === k.id), worn === k.id)).join('')}</div>`;
    } else {
      // fuel: the card grid, two to a row (docs/SHOP.md)
      panel = `${gelChip(s.boosts, { cls: 'gw-gel-top' })}
        <div class="sc-grid">${FUELS.map((f) => fuelShopCard(f, w, fresh === f.id)).join('')}</div>`;
    }
    const cur = TAB_CUR[view] || 'coins';
    shell(root, {
      title: t('gear.shop'), icon: 'stall', id: 'gw-title', workouts, cls: 'is-shop', bars: false,
      foot: walletBar(cur, w[cur], w.cap),
      body: `${online() ? '' : `<p class="gw-offline" id="gw-offline" role="status">${svg('cloud')} ${t('gear.offline')}</p>`}
        ${tabs}<div id="shop-panel" role="tabpanel" aria-labelledby="shop-tab-${view}">${panel}</div>${['gear', 'base'].includes(view) && (s.jobs || []).some((j) => j.state !== 'cancelled') ? workshopCard(s, w) : ''}<p class="gw-note gw-honest">${svg('trophy')} ${t('gear.honest')}</p>`,
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
  root.addEventListener('keydown', (e) => tabKeys(e, root));
  root.onclick = async (e) => {
    const tb = e.target.closest('[data-gear-tab]');
    if (tb) { view = tb.dataset.gearTab; draw(); root.querySelector(`[data-gear-tab="${view}"]`)?.focus({ preventScroll: true }); return; }
    const info = e.target.closest('[data-shop-info]');
    if (info) {
      cardInfo(info, draw, (buyId) => {
        if (buyId) root.querySelector(`[data-stall-buy="${buyId}"]`)?.click(); else draw();
      });
      return;
    }
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
    if (sp) { current = sp.dataset.gearSport; draw(); root.querySelector(`[data-gear-sport="${current}"]`)?.focus({ preventScroll: true }); return; }
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

const INV_TABS = ['fuel', 'clothes', 'gear'];

/** A fitted gear slot in the inventory: its tier and picture, and that it's on. */
function gearInvCard(sport, slot, tier) {
  const e = gearById(tierId(sport, slot, tier));
  const st = cardState({ cost: 0, balance: 0, owned: true });
  return shopCard({
    id: `${sport}:${slot}`, kind: 'gear', title: e.slotName, art: e.art, st, plate: 'blue',
    counter: tierCounter(tier), badge: `T${tier}`,
    button: cardButton(e, 'coins', st, { owned: t('loop.ws.fitted') }),
  });
}

/**
 * Open the inventory: what you hold, on the shop's cards (docs/SHOP.md,
 * phase 5). Fuel to use, clothes to wear, gear fitted, one tab each.
 */
export function openInventory({ tab = 'fuel' } = {}) {
  let off = null;
  const root = openLayer('inventory', { className: 'gear-layer', instant: true, onClose: () => off?.() });
  let view = INV_TABS.includes(tab) ? tab : 'fuel';
  const draw = () => {
    const workouts = store.getWorkouts();
    if (!gearEnabled()) { shell(root, { title: t('gear.inventory'), icon: 'backpack', id: 'inv-title', body: signInBody(), workouts }); return; }
    const s = gearState();
    const w = walletNow(workouts);
    const empty = (txt, to) => `<div class="sc-empty"><p>${txt}</p>${actionButton(t('gear.toShop'), `data-inv-shop="${to}"`, { icon: 'stall', variant: 'gold' })}</div>`;
    const tabs = `<div class="gw-tabs sh-tabs is-three" role="tablist" aria-label="${t('gear.inventory')}">${INV_TABS.map((v) =>
      `<button class="gw-tab sh-tab${v === view ? ' active' : ''}" role="tab" id="inv-tab-${v}" aria-selected="${v === view}" aria-controls="inv-panel" data-inv-tab="${v}"${v === view ? '' : ' tabindex="-1"'}>
        <img src="${TAB_ART(v)}" width="128" height="128" alt="" draggable="false"><span>${t(`gear.tab.${v}`)}</span></button>`).join('')}</div>`;
    let panel;
    if (view === 'fuel') {
      const fuels = FUELS.filter((f) => (w.held[f.id] || 0) > 0);
      panel = `${gelChip(s.boosts, { cls: 'gw-gel-top' })}
        ${fuels.length ? `<div class="sc-grid">${fuels.map((f) => fuelInvCard(f, s, w)).join('')}</div>` : empty(t('gear.invNoFuel'), 'fuel')}`;
    } else if (view === 'clothes') {
      const worn = store.getSettings().kit || null;
      const kits = ownedKits(s.inventory);
      const won = featItems();
      const seasonal = SEASON_KITS.filter((k) => s.inventory.some((r) => r.item_id === k.id));
      const cards = [
        ...kits.map((k) => kitShopCard(k, true, worn === k.id, w)),
        ...won.map((i) => featShopCard(featItemById(i.id), i, worn === i.id)),
        ...seasonal.map((k) => seasonKitShopCard(k, true, worn === k.id)),
      ];
      panel = cards.length ? `<div class="sc-grid">${cards.join('')}</div>` : empty(t('gear.invNoClothes'), 'clothes');
    } else {
      const groups = SPORTS.map((sport) => {
        const slots = SLOTS[sport].map((slot) => ({ slot, tier: ownedTier(s.inventory, sport, slot) })).filter((r) => r.tier > 0);
        if (!slots.length) return '';
        const label = t(`sport.${SWITCH.find(([x]) => x === sport)[1]}`);
        return `<h3 class="sc-row-h">${svg(sport)} ${esc(label)} <small class="sc-row-boost data-num">${pctBp(gearBoost(s.inventory, sport))}</small></h3>
          <div class="sc-grid">${slots.map(({ slot, tier }) => gearInvCard(sport, slot, tier)).join('')}</div>`;
      }).filter(Boolean).join('');
      panel = groups || empty(t('gear.invNoGear'), 'gear');
    }
    const cur = view === 'fuel' ? 'carbs' : 'coins';
    shell(root, {
      title: t('gear.inventory'), icon: 'backpack', id: 'inv-title', workouts, cls: 'is-shop is-inv', bars: false,
      foot: walletBar(cur, w[cur], w.cap),
      body: `${tabs}<div id="inv-panel" role="tabpanel" aria-labelledby="inv-tab-${view}">${panel}</div>`,
    });
  };
  off = onGear(() => { if (root.isConnected) draw(); });
  root.onclick = async (e) => {
    const tb = e.target.closest('[data-inv-tab]');
    if (tb) { view = tb.dataset.invTab; draw(); root.querySelector(`[data-inv-tab="${view}"]`)?.focus({ preventScroll: true }); return; }
    const go = e.target.closest('[data-inv-shop]');
    if (go) { openShop(null, { tab: go.dataset.invShop }); return; }
    const info = e.target.closest('[data-shop-info]');
    if (info) { cardInfo(info, draw); return; }
    await handleCommon(e, draw);
  };
  root.addEventListener('keydown', (e) => tabKeys(e, root));
  draw();
  if (gearEnabled()) refreshGear().then(() => { if (root.isConnected) draw(); });
  return root;
}

/** Arrow keys, Home and End move along a tab row (the WAI-ARIA tabs pattern) and open the tab. */
function tabKeys(e, root) {
  const tab = e.target.closest('[role="tab"]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const all = [...tab.parentElement.querySelectorAll('[role="tab"]')];
  const i = all.indexOf(tab);
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
  e.preventDefault();
  const key = Object.keys(all[to].dataset).find((k) => /Tab$|Sport$/.test(k));
  all[to].click();
  root.querySelector(`[data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${all[to].dataset[key]}"]`)?.focus({ preventScroll: true });
}
