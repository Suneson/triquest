// gear-view.js — the gear shop and the inventory, both full layers opened
// from the buttons on the Profile scene (shop bottom-right, inventory
// bottom-left), plus the coins-and-carbs bars that sit top-right of the scene.
//
// Two currencies, both earned only by training and missions (wallet.js):
//   coins buy gear upgrades (a small permanent boost to one discipline) and clothes;
//   carbs buy fuel (gel, energy bar, pasta), which boosts the next few hours.
// Prices and effects are shown before you buy; the server does the buying and
// using (gear-state.js → buy_gear / use_gel). Not the merch Shop tab: its own
// name, a stall icon and a steel accent.

import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { esc, dialogue } from './ui.js';
import { rollNum, animateIn, busy } from './motion.js';
import { toast, playAccept } from './effects.js';
import { haptic } from './haptics.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import {
  SLOTS, SLOT_ICON, GEAR_RULES, KITS, FUELS, SPORTS, CATALOG, ownedTier, nextTier, ownedKits, gearById, tierId, kitArt, fuelById,
} from '../core/gear.js';
import { gearBoost, canUseFuel } from '../core/boosts.js';
import { gearState, gearEnabled, refreshGear, buyItem, useFuel, gearError, walletNow, onGear } from './gear-state.js';
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

function gearCard(sport, slot, inv, coins, fresh) {
  const tier = ownedTier(inv, sport, slot);
  const cur = gearById(tierId(sport, slot, tier));
  const next = nextTier(inv, sport, slot);
  const foot = !next
    ? `<p class="gw-max">${svg('star')} ${t('gear.maxed')}</p>`
    : `<div class="gw-next"><span class="gw-next-k">${t('gear.next')}</span><b>${esc(next.name)}</b><span class="gw-boost">${pctBp(next.boostBp)}</span></div>
       <div class="gw-act">${buyButton(next, 'coins', coins, t('gear.buyAria', { name: next.name, cost: next.cost, boost: pctBp(next.boostBp) }))}</div>`;
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

const fuelEffect = (f) => t('gear.fuelEffect', { pct: f.boostBp / 100, h: f.hours, n: f.perWindow });

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
        const name = g?.name || KITS.find((k) => k.id === id)?.name || fuelById(id)?.name || id;
        onBought?.(id);
        playAccept();
        haptic('record');
        toast(`<b>${esc(name)}</b><br>${g ? t('gear.boughtBoost', { boost: pctBp(g.boostBp) }) : t('gear.bought')}`, { icon: svg(fuelById(id) ? 'gel' : 'stall') });
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
        toast(`<b>${t('gear.fuelOn', { name: f.name, pct: f.boostBp / 100, h: f.hours })}</b>`, { icon: svg('gel') });
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

const SHOP_TABS = [['gear', 'wrench'], ['clothes', 'user'], ['fuel', 'gel']];

/** Open the shop: tab 'gear' (by discipline), 'clothes' or 'fuel'. */
export function openShop(ctx, { tab = 'gear', sport = 'bike' } = {}) {
  let off = null;
  const root = openLayer('shop-gear', { className: 'gear-layer', onClose: () => off?.() });
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
    if (view === 'gear') {
      const boost = gearBoost(s.inventory, current);
      panel = `${sportTabs(current)}
        <div class="gw-total"><span>${t('gear.disciplineBoost')}</span><b class="data-num">${pctBp(boost)}</b>
          <small>${t('gear.ofCap', { cap: pctBp(GEAR_RULES.sportCapBp) })}</small>
          <span class="gw-cap" style="--f:${(boost / GEAR_RULES.sportCapBp).toFixed(3)}" aria-hidden="true"><i></i></span></div>
        <div class="gw-grid" role="tabpanel"${loading ? ' aria-busy="true"' : ''}>${loading ? [0, 1, 2, 3].map(skCard).join('')
          : SLOTS[current].map((slot) => gearCard(current, slot, s.inventory, w.coins, fresh === slot)).join('')}</div>`;
    } else if (view === 'clothes') {
      const owned = new Set(ownedKits(s.inventory).map((k) => k.id));
      const worn = store.getSettings().kit || null;
      panel = `<p class="gw-note">${t('gear.clothesNote')}</p>
        <div class="gw-grid" role="tabpanel">${KITS.map((k) => kitCard(k, owned.has(k.id), worn === k.id, w.coins, 'shop')).join('')}</div>`;
    } else {
      panel = `<p class="gw-note">${t('gear.fuelNote')}</p>${gelChip(s.boosts, { cls: 'gw-gel-top' })}
        <div class="gw-grid" role="tabpanel">${FUELS.map((f) => fuelCard(f, s, w, { mode: 'shop', fresh: fresh === f.id })).join('')}</div>`;
    }
    shell(root, {
      title: t('gear.shop'), icon: 'stall', id: 'gw-title', workouts,
      body: `${online() ? '' : `<p class="gw-offline" id="gw-offline" role="status">${svg('cloud')} ${t('gear.offline')}</p>`}
        ${tabs}${panel}<p class="gw-note gw-honest">${svg('trophy')} ${t('gear.honest')}</p>`,
    });
    fresh = null;
  };

  off = onGear(() => { if (root.isConnected) draw(); });
  root.onclick = async (e) => {
    const tb = e.target.closest('[data-gear-tab]');
    if (tb) { view = tb.dataset.gearTab; draw(); return; }
    const sp = e.target.closest('[data-gear-sport]');
    if (sp) { current = sp.dataset.gearSport; draw(); return; }
    await handleCommon(e, draw, (id) => { fresh = gearById(id)?.slot || (fuelById(id) ? id : null); });
  };
  draw();
  if (gearEnabled()) refreshGear().then(() => { if (root.isConnected) draw(); });
  return root;
}
/** The earlier name, kept for callers. */
export const openGear = (ctx, sport) => openShop(ctx, { tab: 'gear', sport });

// ---- the inventory ------------------------------------------------------------------------

/** Open the inventory: fuel you hold (use it here), clothes you own, gear fitted. */
export function openInventory() {
  let off = null;
  const root = openLayer('inventory', { className: 'gear-layer', onClose: () => off?.() });
  const draw = () => {
    const workouts = store.getWorkouts();
    if (!gearEnabled()) { shell(root, { title: t('gear.inventory'), icon: 'backpack', id: 'inv-title', body: signInBody(), workouts }); return; }
    const s = gearState();
    const w = walletNow(workouts);
    const fuels = FUELS.filter((f) => (w.held[f.id] || 0) > 0);
    const kits = ownedKits(s.inventory);
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
          ${kits.length ? `<div class="gw-grid">${kits.map((k) => kitCard(k, true, worn === k.id, w.coins, 'inventory')).join('')}</div>` : empty(t('gear.invNoClothes'), 'clothes')}</section>
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
