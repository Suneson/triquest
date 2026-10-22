// gear-view.js — GEAR, the training workshop (MATERIAL in Spanish). A full
// layer opened from the Profile top bar. Coins earned by training buy gear,
// which adds a small permanent boost to its discipline, and gels, which boost
// the next few hours. Prices and effects are shown before you buy; the server
// does the buying (gear-state.js → buy_gear / use_gel). Nothing here is the
// merch Shop: different name, icon and accent.

import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { esc, dialogue } from './ui.js';
import { rollNum, animateIn, busy } from './motion.js';
import { toast, playAccept } from './effects.js';
import { haptic } from './haptics.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { SLOTS, SLOT_ICON, GEAR_RULES, KITS, GEL, ownedTier, nextTier, ownedKits, gearById, tierId } from '../core/gear.js';
import { gearBoost, activeGel, canUseGel } from '../core/boosts.js';
import { gelsHeld } from '../core/wallet.js';
import { gearState, gearEnabled, refreshGear, buyItem, useGel, gearError, walletNow } from './gear-state.js';
import { gelChip, pctBp } from './gel-chip.js';
import { SWITCH } from './profile-game.js';
import * as store from './store.js';

const coin = (n, key = '') => `<span class="coin-amt">${svg('coin', 'coin-ico')}<b class="data-num">${key ? rollNum(n, key) : fmtNum(n)}</b></span>`;

// ---- workshop pieces -------------------------------------------------------------

const ART_READY = new Set(); // item ids whose PNG has landed (Phase 5 fills this)

function artTile(sport, slot, tier, { locked = false, fresh = false } = {}) {
  const id = tierId(sport, slot, tier);
  const inner = ART_READY.has(id)
    ? `<img src="${esc(gearById(id).art)}" width="128" height="128" loading="lazy" alt="">`
    : svg(SLOT_ICON[`${sport}-${slot}`] || sport);
  return `<span class="gw-art t${tier}${locked ? ' is-locked' : ''}${fresh ? ' is-fresh' : ''}" aria-hidden="true">${inner}<i class="gw-tier">T${tier}</i></span>`;
}

function pips(tier, fresh) {
  return `<span class="gw-pips" role="img" aria-label="${esc(t('gear.tierOf', { n: tier, of: 3 }))}">${[1, 2, 3]
    .map((n) => `<i class="${n <= tier ? 'on' : ''}${fresh && n === tier ? ' is-new' : ''}" style="--d:${n - 1}"></i>`).join('')}</span>`;
}

function itemCard(sport, slot, inv, bal, { online, fresh }) {
  const tier = ownedTier(inv, sport, slot);
  const cur = gearById(tierId(sport, slot, tier));
  const next = nextTier(inv, sport, slot);
  let foot;
  if (!next) {
    foot = `<p class="gw-max">${svg('star')} ${t('gear.maxed')}</p>`;
  } else {
    const short = next.cost - bal;
    const btn = short > 0
      ? `<button class="btn tiny gw-buy is-short" disabled aria-describedby="need-${next.id}">${coin(next.cost)}</button>
         <span class="gw-need" id="need-${next.id}">${t('gear.needMore', { n: fmtNum(short) })}</span>`
      : `<button class="btn tiny primary gw-buy" data-gear-buy="${next.id}"${online ? '' : ' disabled aria-describedby="gw-offline"'}
           aria-label="${esc(t('gear.buyAria', { name: next.name, cost: next.cost, boost: pctBp(next.boostBp) }))}">${coin(next.cost)}</button>`;
    foot = `<div class="gw-next">
        <span class="gw-next-k">${t('gear.next')}</span>
        <b>${esc(next.name)}</b>
        <span class="gw-boost">${pctBp(next.boostBp)}</span>
      </div>
      <div class="gw-act">${btn}</div>`;
  }
  return `<article class="gw-card${fresh ? ' is-bought' : ''}" data-slot="${slot}">
    ${artTile(sport, slot, Math.max(tier, 0), { locked: tier === 0, fresh })}
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

function consumables(s, bal, online) {
  const held = gelsHeld(s.spends, s.boosts);
  const now = Date.now();
  const can = canUseGel(s.boosts, held, now);
  const active = activeGel(s.boosts, now);
  const why = !can.ok && can.reason !== 'none' ? `<span class="gw-need">${t(`gear.gelWhy.${can.reason}`)}</span>` : '';
  const full = held >= GEAR_RULES.gel.maxHeld;
  const buy = full
    ? `<span class="gw-need">${t('gear.gelFull', { n: GEAR_RULES.gel.maxHeld })}</span>`
    : bal < GEL.cost
      ? `<button class="btn tiny is-short" disabled>${coin(GEL.cost)}</button><span class="gw-need">${t('gear.needMore', { n: fmtNum(GEL.cost - bal) })}</span>`
      : `<button class="btn tiny primary" data-gear-buy="gel"${online ? '' : ' disabled'} aria-label="${esc(t('gear.buyGelAria', { cost: GEL.cost }))}">${coin(GEL.cost)}</button>`;
  return `<section class="gw-row gw-gels" aria-labelledby="gw-gels-h">
    <h3 id="gw-gels-h" class="gw-row-h">${svg('gel')} ${t('gear.consumables')}</h3>
    <div class="gw-gel">
      <span class="gw-art gel-art" aria-hidden="true">${svg('gel')}<i class="gw-tier">×${held}</i></span>
      <div class="gw-body">
        <h4 class="gw-slot">${esc(GEL.name)}</h4>
        <p class="gw-blurb">${t('gear.gelBlurb', { pct: GEAR_RULES.gel.boostBp / 100, h: GEAR_RULES.gel.hours, n: GEAR_RULES.gel.perWindow })}</p>
        ${active ? gelChip(s.boosts, { cls: 'in-card' }) : ''}
      </div>
      <div class="gw-foot gw-gel-act">
        <button class="btn tiny" data-gear-gel${can.ok && online ? '' : ' disabled'}>${svg('bolt')} ${t('gear.useGel')}</button>${why}
        ${buy}
      </div>
    </div>
  </section>`;
}

function kitsRow(s, bal, online) {
  const owned = new Set(ownedKits(s.inventory).map((k) => k.id));
  const worn = store.getSettings().kit || null;
  const swatch = (k) => `<span class="gw-swatch" aria-hidden="true">${['jersey', 'shorts', 'shoes']
    .map((p) => `<i style="background:${k.ramps[p][2]}"></i>`).join('')}</span>`;
  const row = (k) => {
    const has = owned.has(k.id);
    const act = has
      ? `<button class="btn tiny ${worn === k.id ? 'primary' : ''}" data-gear-wear="${k.id}" aria-pressed="${worn === k.id}">${worn === k.id ? t('gear.wearing') : t('gear.wear')}</button>`
      : bal < k.cost
        ? `<button class="btn tiny is-short" disabled>${coin(k.cost)}</button><span class="gw-need">${t('gear.needMore', { n: fmtNum(k.cost - bal) })}</span>`
        : `<button class="btn tiny primary" data-gear-buy="${k.id}"${online ? '' : ' disabled'}>${coin(k.cost)}</button>`;
    return `<li class="gw-kit">${swatch(k)}<b>${esc(k.name)}</b><span class="gw-act">${act}</span></li>`;
  };
  return `<section class="gw-row" aria-labelledby="gw-kits-h">
    <h3 id="gw-kits-h" class="gw-row-h">${svg('user')} ${t('gear.kits')}</h3>
    <p class="gw-note">${t('gear.kitsNote')}</p>
    <ul class="gw-kits">${KITS.map(row).join('')}</ul>
  </section>`;
}

// ---- the layer ------------------------------------------------------------------------

/** Open the workshop on a discipline. */
export function openGear(ctx, sport = 'bike') {
  const root = openLayer('gear', { className: 'gear-layer' });
  let current = SLOTS[sport] ? sport : 'bike';
  let fresh = null; // the slot just bought, for the workshop moment

  const draw = () => {
    const s = gearState();
    const enabled = gearEnabled();
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    const loading = enabled && !s.at;
    const w = walletNow(store.getWorkouts());
    const bal = w.balance;
    const boost = gearBoost(s.inventory, current);
    const head = sheetHead({
      lead: 'back', icon: 'wrench', title: t('gear.title'), id: 'gw-title',
      action: enabled ? `<span class="gw-wallet" aria-label="${esc(t('gear.balanceAria', { n: bal }))}">${coin(bal, 'gear-bal')}</span>` : '',
    });
    let body;
    if (!enabled) {
      body = dialogue({ who: t('gear.title'), icon: 'wrench', text: t('gear.signIn'), cls: 'empty-dlg' })
        + `<button class="btn primary block" data-action="open-auth">${svg('cloud')} ${t('main.signInSync')}</button>`;
    } else {
      body = `
        ${online ? '' : `<p class="gw-offline" id="gw-offline" role="status">${svg('cloud')} ${t('gear.offline')}</p>`}
        ${gelChip(s.boosts, { cls: 'gw-gel-top' })}
        ${sportTabs(current)}
        <div class="gw-total">
          <span>${t('gear.disciplineBoost')}</span>
          <b class="data-num">${pctBp(boost)}</b><small>${t('gear.ofCap', { cap: pctBp(GEAR_RULES.sportCapBp) })}</small>
          <span class="gw-cap" style="--f:${(boost / GEAR_RULES.sportCapBp).toFixed(3)}" aria-hidden="true"><i></i></span>
        </div>
        <div class="gw-grid" role="tabpanel" aria-label="${esc(t(`sport.${SWITCH.find(([x]) => x === current)[1]}`))}" ${loading ? 'aria-busy="true"' : ''}>
          ${loading ? [0, 1, 2, 3].map(skCard).join('')
            : SLOTS[current].map((slot) => itemCard(current, slot, s.inventory, bal, { online, fresh: fresh === slot })).join('')}
        </div>
        ${loading ? '' : consumables(s, bal, online)}
        ${loading ? '' : kitsRow(s, bal, online)}
        <p class="gw-note gw-honest">${svg('trophy')} ${t('gear.honest')}</p>`;
    }
    root.innerHTML = `<div class="fh-screen gw-screen" role="dialog" aria-modal="true" aria-labelledby="gw-title">${head}${body}</div>`;
    animateIn(root);
    fresh = null;
  };

  root.onclick = async (e) => {
    const tab = e.target.closest('[data-gear-sport]');
    if (tab) { current = tab.dataset.gearSport; draw(); return; }
    const buyBtn = e.target.closest('[data-gear-buy]');
    if (buyBtn) {
      const id = buyBtn.dataset.gearBuy;
      await busy(buyBtn, async () => {
        try {
          await buyItem(id);
          const item = gearById(id);
          fresh = item?.slot || null;
          playAccept();
          haptic('record');
          toast(`<b>${esc(item ? item.name : (KITS.find((k) => k.id === id) || GEL).name)}</b><br>${item ? t('gear.boughtBoost', { boost: pctBp(item.boostBp) }) : t('gear.bought')}`, { icon: svg(id === 'gel' ? 'gel' : 'wrench') });
        } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
      });
      draw();
      return;
    }
    const gel = e.target.closest('[data-gear-gel]');
    if (gel) {
      await busy(gel, async () => {
        try {
          await useGel();
          playAccept();
          haptic('levelUp');
          toast(`<b>${t('gear.gelOn', { pct: GEAR_RULES.gel.boostBp / 100, h: GEAR_RULES.gel.hours })}</b>`, { icon: svg('gel') });
        } catch (err) { toast(gearError(err), { icon: svg('warn') }); }
      });
      draw();
      return;
    }
    const wear = e.target.closest('[data-gear-wear]');
    if (wear) {
      const id = wear.dataset.gearWear;
      store.setSetting('kit', store.getSettings().kit === id ? null : id);
      draw();
    }
  };

  draw();
  if (gearEnabled()) refreshGear().then(() => { if (root.isConnected) draw(); });
  return root;
}

