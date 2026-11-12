// shop-view.js: the markets' screen (rules in js/core/shop.js, docs/MARKETS.md).
//
// Full screen, a back arrow at the top left. Laid out like a card game's deck screen:
//   - at the top, the deck: a tab for each of your six markets, the market's eight slots (locked
//     past its level), each an item card with a bar of the units left, and its buttons: Collect,
//     Restock all, a crate, Upgrade. Chips say what your training is doing for it now.
//   - below, on the quilt, the storeroom: Gym, Bike, Run and Swim, fifteen items each, with a bar
//     of how many you hold (of 1000). Tap one: Buy (a slider) or Sell.
//   - Sell sends it up to the market: a slot that already has it fills straight away; otherwise
//     pick a slot (the item swaps in, what was there goes back to the storeroom). The units fly
//     into the slot and its bar fills.
// Everything is asked of the server (0035_shop.sql) and read back; the numbers between are worked
// out here from the same rules, once a second.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { haptic } from './haptics.js';
import { toast, prefersReducedMotion } from './effects.js';
import { EASE_OUT, SPRING, springEasing } from '../core/spring.js';
import { myShop, shopsOpen, shopCall, walletNow, serverNow, gearError, onGear } from './gear-state.js';
import {
  SHOP_RULES, SHOP_ITEMS, SPORTS, shopItem, itemBuy, itemSell, itemPicture, marketPicture, shopLevel, shopNext,
  buildCostFor, demandAt, weekMinutes, trafficFor, brickDay, marketSales, soldIn, specialty, restockCost, cratesLeft,
} from '../core/shop.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';
const coinTag = (n, short = false) => `<span class="sv-price data-num${short ? ' is-short' : ''}">${fmtNum(n)}<img src="${COIN}" alt=""></span>`;
const itemName = (id) => t(`mkt.items.${id}`);

/**
 * Open the markets' screen on market `spot` (the first one built when it's left out).
 * `workouts`: () => the sessions, for what training does to the markets.
 */
export function openMarket({ spot = 0, workouts = () => [] } = {}) {
  let cur = Number(spot) || 0;
  let sport = 'gym';
  let picked = null;        // the storeroom item showing Buy and Sell
  let selling = null;       // the item waiting for a slot
  let busy = false;         // an animation is running: hold the redraw till it ends
  let tick = 0, closed = false, off = null;

  const root = openLayer('markets', {
    className: 'sv-layer',
    onClose: () => { closed = true; clearInterval(tick); off?.(); },
  });

  const shop = () => myShop();
  const shopAt = (s) => shop().shops.find((m) => Number(m.spot) === Number(s)) || null;
  const slotsOf = (s) => shop().slots.filter((x) => Number(x.spot) === Number(s)).map((x) => ({ ...x, slot: Number(x.slot), units: Number(x.units) }));
  const ctxNow = () => {
    const now = serverNow(); const w = workouts() || [];
    const mins = weekMinutes(w, now);
    return { now, mins, traffic: trafficFor(mins), demand: demandAt(w, now), brick: brickDay(w, new Date(now).toISOString().slice(0, 10)) };
  };
  if (!shopAt(cur)) cur = Number(shop().shops.map((m) => Number(m.spot)).sort((a, b) => a - b)[0]) || 0;

  // ---- drawing ------------------------------------------------------------------------------------

  const tabs = () => Array.from({ length: SHOP_RULES.spots }, (_, i) => {
    const s = i + 1; const m = shopAt(s);
    return `<button type="button" class="sv-tab${s === cur ? ' is-on' : ''}${m ? '' : ' is-free'}" data-sv-tab="${s}" aria-pressed="${s === cur}"
      aria-label="${esc(t('mkt.market', { n: s }))}">${m ? `<b class="data-num">${s}</b>` : svg('plus')}</button>`;
  }).join('');

  const slotCard = (m, x, n, c) => {
    const L = shopLevel(m.level);
    if (n > L.slots) {
      const need = SHOP_RULES.levels.find((l) => l.slots >= n)?.level || 8;
      return `<div class="sv-card sv-slot is-locked" data-slot="${n}"><span class="sv-art">${svg('lock')}</span><span class="sv-lock">${esc(t('mkt.locked', { n: need }))}</span></div>`;
    }
    const target = selling && shopItem(selling).tier <= Number(m.level);
    if (!x?.item) {
      return `<button type="button" class="sv-card sv-slot is-empty${target ? ' is-target' : ''}" data-slot="${n}" aria-label="${esc(t('mkt.empty'))}">
        <span class="sv-art">${svg('plus')}</span><span class="sv-bar" style="--f:0"><i></i><b class="data-num">0/${L.capacity}</b></span></button>`;
    }
    const left = x.units - soldIn(x, c.now, c.traffic.f);
    const it = shopItem(x.item);
    return `<button type="button" class="sv-card sv-slot is-${it.sport}${target ? ' is-target' : ''}${c.demand.has(it.sport) ? ' is-hot' : ''}" data-slot="${n}" data-item="${x.item}"
      aria-label="${esc(`${itemName(x.item)}: ${left}/${L.capacity}`)}">
      <span class="sv-art"><img src="${itemPicture(x.item)}" alt="" draggable="false"></span>
      <span class="sv-bar" style="--f:${(left / L.capacity).toFixed(3)}"><i></i><b class="data-num" data-sv-left>${left}/${L.capacity}</b></span></button>`;
  };

  const deck = () => {
    const c = ctxNow(); const m = shopAt(cur);
    if (!m) {
      const owned = shop().shops.length; const cost = buildCostFor(owned);
      const coins = walletNow(workouts()).coins;
      return `<nav class="sv-tabs" role="tablist">${tabs()}</nav>
        <div class="sv-build">
          <img class="sv-build-pic" src="${marketPicture(1)}" alt="">
          <p>${esc(t('mkt.buildLead'))}</p>
          ${cost == null ? '' : `<button type="button" class="sv-btn is-green" data-sv-build>${esc(t('mkt.buildMarket', { n: cur || owned + 1 }))} ${coinTag(cost, coins < cost)}</button>`}
        </div>`;
    }
    const L = shopLevel(m.level); const next = shopNext(m.level);
    const slots = slotsOf(cur);
    const coins = walletNow(workouts()).coins;
    const waiting = marketSales(m.level, slots, c.now, { f: c.traffic.f, demand: c.demand }).coins;
    const stock = shop().stock;
    const rs = restockCost(m.level, slots, stock);
    const crates = cratesLeft(shop().chests, shop().moves);
    const spec = specialty(slots, m.level);
    const vipToday = shop().moves.some((x) => x.kind === 'vip' && String(x.day) === new Date(c.now).toISOString().slice(0, 10));
    const chips = [
      `<span class="sv-chip is-traffic is-${c.traffic.id}">${svg('user')}<b>${esc(t(`mkt.traffic.${c.traffic.id}`))}</b><small class="data-num">${esc(c.traffic.next
        ? t('mkt.trafficNext', { min: c.mins, next: c.traffic.next.min }) : t('mkt.trafficTop', { min: c.mins }))}</small></span>`,
      ...SPORTS.filter((s) => c.demand.has(s)).map((s) => `<span class="sv-chip is-hot is-${s}">${svg(s)}<b>${esc(t('mkt.demand'))}</b></span>`),
      spec ? `<span class="sv-chip is-spec">${svg('star')}<b>${esc(t('mkt.specialty'))}</b></span>` : '',
    ].join('');
    return `<nav class="sv-tabs" role="tablist">${tabs()}</nav>
      <div class="sv-head">
        <img class="sv-head-pic" src="${marketPicture(m.level)}" alt="">
        <div class="sv-head-txt"><b>${esc(t('mkt.market', { n: cur }))}</b><span>${esc(t('mkt.levelInfo', { l: m.level, open: L.slots, cap: L.capacity }))}</span></div>
        ${next ? `<button type="button" class="sv-btn is-green sv-up" data-sv-upgrade>${svg('chevron')}<span>${esc(t('mkt.upgrade'))}</span>${coinTag(next.cost, coins < next.cost)}</button>`
          : `<span class="sv-top">${esc(t('mkt.top'))}</span>`}
      </div>
      <div class="sv-chips">${chips}</div>
      <div class="sv-slots${spec ? ' is-spec' : ''}">${Array.from({ length: 8 }, (_, i) => slotCard(m, slots.find((x) => x.slot === i + 1), i + 1, c)).join('')}</div>
      <div class="sv-acts">
        <button type="button" class="sv-btn is-gold sv-collect" data-sv-collect ${waiting ? '' : 'disabled'}>${svg('coin')}<span>${esc(t('mkt.collect'))}</span><b class="data-num" data-sv-waiting>${fmtNum(waiting)}</b></button>
        <button type="button" class="sv-btn is-blue" data-sv-restock ${rs.units ? '' : 'disabled'}>${svg('sync')}<span>${esc(t('mkt.restock'))}</span>${rs.coins ? coinTag(rs.coins, coins < rs.coins) : ''}</button>
        <button type="button" class="sv-btn is-purple sv-crate" data-sv-crate aria-label="${esc(t('mkt.crate'))}" ${crates > 0 && slots.length ? '' : 'disabled'}>${svg('bag')}<b class="data-num">${Math.max(0, crates)}</b></button>
      </div>
      ${c.brick && !vipToday ? `<button type="button" class="sv-vip" data-sv-vip>${svg('trophy')}<span>${esc(t('mkt.vip'))}</span><b>${esc(t('mkt.vipGo'))}</b></button>` : ''}`;
  };

  const itemCard = (it, held, lvl) => {
    const locked = it.tier > lvl;
    return `<button type="button" class="sv-card sv-item is-${it.sport}${locked ? ' is-locked' : ''}${picked === it.id ? ' is-picked' : ''}" data-sv-item="${it.id}"
      aria-label="${esc(itemName(it.id))}">
      <span class="sv-sell">${coinTag(itemSell(it.id))}</span>
      <span class="sv-art"><img src="${itemPicture(it.id)}" alt="" loading="lazy" draggable="false"></span>
      ${locked ? `<span class="sv-lock">${svg('lock')}${esc(t('mkt.locked', { n: it.tier }))}</span>`
        : `<span class="sv-bar is-stock" style="--f:${(held / SHOP_RULES.stockMax).toFixed(3)}"><i></i><b class="data-num">${fmtNum(held)}/${fmtNum(SHOP_RULES.stockMax)}</b></span>`}
    </button>`;
  };

  const store = () => {
    const lvl = Number(shopAt(cur)?.level) || 0;
    const stock = shop().stock;
    const list = SHOP_ITEMS.filter((i) => i.sport === sport);
    return list.map((it) => {
      const card = itemCard(it, stock[it.id] || 0, lvl);
      if (picked !== it.id) return card;
      return `<div class="sv-pick">${card}
        <button type="button" class="sv-btn is-green" data-sv-buy="${it.id}"><span>${esc(t('mkt.buy'))}</span>${coinTag(itemBuy(it.id))}</button>
        <button type="button" class="sv-btn is-orange" data-sv-sell="${it.id}" ${(stock[it.id] || 0) && it.tier <= lvl ? '' : 'disabled'}><span>${esc(t('mkt.sell'))}</span></button>
      </div>`;
    }).join('');
  };

  const draw = () => {
    if (closed) return;
    const coins = walletNow(workouts()).coins;
    root.innerHTML = `<div class="fh-screen sv-screen" role="dialog" aria-modal="true" aria-labelledby="sv-title">
      ${sheetHead({ title: esc(t('mkt.title')), lead: 'back', arrow: true, id: 'sv-title',
        action: `<span class="sv-wallet" data-sv-wallet>${coinTag(coins)}</span>` })}
      <section class="sv-deck" data-sv-deck>${shopsOpen() ? deck() : `<p class="sv-soon">${esc(t('mkt.soon'))}</p>`}</section>
      <nav class="sv-sports" role="tablist">${SPORTS.map((s) => `<button type="button" class="sv-sport is-${s}${s === sport ? ' is-on' : ''}" data-sv-sport="${s}" aria-pressed="${s === sport}">${svg(s)}<b>${esc(t(`mkt.sports.${s}`))}</b></button>`).join('')}</nav>
      <section class="sv-store is-${sport}"><div class="sv-grid" data-sv-grid>${store()}</div></section>
      ${selling ? `<div class="sv-dock" data-sv-dock>
        <span class="sv-card sv-item is-${shopItem(selling).sport}" data-sv-from><span class="sv-art"><img src="${itemPicture(selling)}" alt=""></span></span>
        <p>${esc(t('mkt.pick'))}</p>
        <button type="button" class="sv-btn is-blue" data-sv-cancel>${esc(t('mkt.cancel'))}</button>
      </div>` : ''}
    </div>`;
  };

  // the numbers that move by themselves, once a second, without a redraw
  const live = () => {
    if (closed || busy) return;
    const m = shopAt(cur); if (!m) return;
    const c = ctxNow(); const L = shopLevel(m.level);
    const slots = slotsOf(cur);
    for (const x of slots) {
      const el = root.querySelector(`.sv-slot[data-slot="${x.slot}"][data-item]`);
      if (!el) continue;
      const left = x.units - soldIn(x, c.now, c.traffic.f);
      el.querySelector('.sv-bar').style.setProperty('--f', (left / L.capacity).toFixed(3));
      el.querySelector('[data-sv-left]').textContent = `${left}/${L.capacity}`;
    }
    const w = marketSales(m.level, slots, c.now, { f: c.traffic.f, demand: c.demand }).coins;
    const el = root.querySelector('[data-sv-waiting]');
    if (el && el.textContent !== fmtNum(w)) { el.textContent = fmtNum(w); el.closest('button').disabled = !w; }
  };

  const redraw = () => { if (!busy) { const y = root.querySelector('.sv-screen')?.scrollTop || 0; draw(); const s = root.querySelector('.sv-screen'); if (s) s.scrollTop = y; } };
  draw();
  tick = setInterval(live, 1000);
  off = onGear(() => redraw());

  // ---- doing ------------------------------------------------------------------------------------

  const ask = async (fn, args, ok) => {
    try {
      const r = await shopCall(fn, args);
      if (ok) ok(r);
      return r;
    } catch (e) { haptic('refuse'); toast(esc(gearError(e))); return null; }
  };

  /** Up to eight of the item fly from `from` into the slot, then the slot pops. */
  const fly = (from, slotEl, id, n) => new Promise((res) => {
    if (prefersReducedMotion() || !from || !slotEl) { res(); return; }
    const a = from.getBoundingClientRect(); const b = slotEl.getBoundingClientRect();
    const k = Math.max(1, Math.min(8, n));
    let left = k;
    for (let i = 0; i < k; i++) {
      const img = document.createElement('img');
      img.src = itemPicture(id); img.className = 'sv-fly'; img.alt = '';
      const size = Math.min(a.width, 72);
      Object.assign(img.style, { width: `${size}px`, height: `${size}px`, left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size / 2}px` });
      document.body.append(img);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2); const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      // an arc: up and over, landing small in the slot
      img.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(.85)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0.2 },
      ], { duration: 420, delay: i * 45, easing: EASE_OUT, fill: 'both' }).finished.then(() => {
        img.remove();
        if (--left === 0) {
          slotEl.animate([{ transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 300, easing: springEasing(SPRING.pop) });
          res();
        }
      });
    }
  });

  /** Coins burst from the Collect button up to the wallet. */
  const coinsUp = (from) => {
    const to = root.querySelector('[data-sv-wallet]');
    if (prefersReducedMotion() || !from || !to) return;
    const a = from.getBoundingClientRect(); const b = to.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      const img = document.createElement('img');
      img.src = COIN; img.className = 'sv-fly is-coin'; img.alt = '';
      Object.assign(img.style, { left: `${a.left + a.width / 2 - 14 + (i % 3 - 1) * 14}px`, top: `${a.top + a.height / 2 - 14}px` });
      document.body.append(img);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2); const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      img.animate([
        { transform: 'translate(0,0) scale(.6)', opacity: 0 },
        { transform: `translate(${(i % 3 - 1) * 30}px, -40px) scale(1.1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0.4 },
      ], { duration: 560, delay: i * 35, easing: EASE_OUT, fill: 'both' }).finished.then(() => img.remove());
    }
  };

  /** Put `id` in slot `n` of the current market, with the flight. */
  const stockSlot = async (n, id) => {
    const slotEl = root.querySelector(`.sv-slot[data-slot="${n}"]`);
    const from = root.querySelector('[data-sv-from]') || root.querySelector(`[data-sv-item="${id}"]`);
    busy = true;
    const call = shopCall('shop_stock_slot', { p_spot: cur, p_slot: n, p_item: id }).then((r) => ({ r }), (e) => ({ e }));
    const res = await call;
    if (res.e) { busy = false; haptic('refuse'); toast(esc(gearError(res.e))); selling = null; redraw(); return; }
    haptic('place');
    await fly(from, slotEl, id, res.r.put);
    busy = false; selling = null; picked = null;
    draw();
    toast(esc(t('mkt.put', { n: res.r.put, item: itemName(id) })), { icon: `<img src="${itemPicture(id)}" alt="" class="sv-toast-ico">`, duration: 2200 });
  };

  const sell = (id) => {
    const m = shopAt(cur);
    if (!m) { toast(esc(t('mkt.tapSpot'))); return; }
    const it = shopItem(id);
    if (it.tier > Number(m.level)) { haptic('refuse'); toast(esc(t('mkt.lockedToast', { n: it.tier }))); return; }
    if (!(shop().stock[id] > 0)) { haptic('refuse'); toast(esc(t('mkt.noneHeld'))); return; }
    const L = shopLevel(m.level);
    const same = slotsOf(cur).find((x) => x.item === id && x.slot <= L.slots && x.units < L.capacity);
    selling = id; picked = null;
    draw();
    root.querySelector('[data-sv-deck]')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    // a slot that already has it fills straight away
    if (same) setTimeout(() => stockSlot(same.slot, id), prefersReducedMotion() ? 0 : 380);
    else haptic('select');
  };

  const buySheet = (id) => {
    const held = shop().stock[id] || 0;
    const price = itemBuy(id);
    const coins = walletNow(workouts()).coins;
    const max = Math.max(0, Math.min(SHOP_RULES.stockMax - held, Math.floor(coins / price)));
    const sheet = openLayer('market-buy', { sheet: true, className: 'sv-buy-layer' });
    let n = Math.min(max, Math.max(1, Math.min(10, max)));
    const draw2 = () => {
      sheet.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
      <div class="modal sv-buy" role="dialog" aria-modal="true" aria-labelledby="sv-buy-title">
        ${sheetHead({ title: esc(t('mkt.buyTitle', { item: itemName(id) })), id: 'sv-buy-title' })}
        <div class="sv-buy-body">
          <div class="sv-card sv-item is-${shopItem(id).sport}"><span class="sv-art"><img src="${itemPicture(id)}" alt=""></span></div>
          <p class="sv-buy-note">${esc(t('mkt.each', { price, sell: itemSell(id) }))}<br>${esc(t('mkt.heldNow', { n: held }))}</p>
          ${max ? `<input type="range" class="sv-range" min="1" max="${max}" value="${n}" data-sv-range aria-label="${esc(t('mkt.howMany'))}">
            <div class="sv-buy-n"><b class="data-num" data-sv-n>${n}</b>${coinTag(n * price)}</div>
            <button type="button" class="sv-btn is-green is-wide" data-sv-buygo>${esc(t('mkt.buyGo', { n }))}</button>`
          : `<p class="sv-buy-note">${esc(t(held >= SHOP_RULES.stockMax ? 'mkt.storeFull' : 'gear.err.insufficient'))}</p>`}
        </div></div>`;
    };
    draw2();
    sheet.addEventListener('input', (e) => {
      if (!e.target.matches('[data-sv-range]')) return;
      n = Number(e.target.value);
      sheet.querySelector('[data-sv-n]').textContent = n;
      sheet.querySelector('.sv-buy-n .sv-price').innerHTML = `${fmtNum(n * price)}<img src="${COIN}" alt="">`;
      sheet.querySelector('[data-sv-buygo]').textContent = t('mkt.buyGo', { n });
    });
    sheet.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-sv-buygo]')) return;
      const b = e.target.closest('[data-sv-buygo]'); b.disabled = true;
      const r = await ask('buy_shop_stock', { p_item: id, p_units: n });
      if (r) { haptic('record'); closeLayer(); toast(esc(t('mkt.bought', { n, item: itemName(id) })), { icon: `<img src="${itemPicture(id)}" alt="" class="sv-toast-ico">`, duration: 2200 }); } else b.disabled = false;
    });
  };

  root.addEventListener('click', async (e) => {
    const q = (s) => e.target.closest(s);
    let b;
    if ((b = q('[data-sv-tab]'))) {
      haptic('tick'); cur = Number(b.dataset.svTab); selling = null; draw(); return;
    }
    if ((b = q('[data-sv-sport]'))) { haptic('tick'); sport = b.dataset.svSport; picked = null; draw(); return; }
    if (q('[data-sv-cancel]')) { haptic('tick'); selling = null; draw(); return; }
    if ((b = q('[data-sv-buy]'))) { haptic('tick'); buySheet(b.dataset.svBuy); return; }
    if ((b = q('[data-sv-sell]'))) { sell(b.dataset.svSell); return; }
    if ((b = q('[data-sv-item]'))) {
      haptic('tick'); picked = picked === b.dataset.svItem ? null : b.dataset.svItem;
      root.querySelector('[data-sv-grid]').innerHTML = store();
      return;
    }
    if ((b = q('.sv-slot[data-slot]')) && selling) {
      if (!b.matches('.is-target')) { haptic('refuse'); return; }
      stockSlot(Number(b.dataset.slot), selling); return;
    }
    if ((b = q('.sv-slot[data-item]'))) {
      // a filled slot: its item, picked in the storeroom below
      haptic('tick'); sport = shopItem(b.dataset.item).sport; picked = b.dataset.item; draw();
      root.querySelector(`[data-sv-item="${picked}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if ((b = q('.sv-slot.is-empty'))) {
      haptic('tick'); toast(esc(t('mkt.emptyHint'))); root.querySelector('.sv-sports')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
    }
    if ((b = q('[data-sv-build]'))) {
      b.disabled = true;
      const spot = cur || (Array.from({ length: SHOP_RULES.spots }, (_, i) => i + 1).find((s) => !shopAt(s)));
      await ask('build_shop', { p_spot: spot }, () => { cur = spot; haptic('record'); toast(esc(t('mkt.built', { n: spot }))); });
      return;
    }
    if ((b = q('[data-sv-upgrade]'))) {
      b.disabled = true;
      const lvl = Number(shopAt(cur)?.level) + 1;
      await ask('upgrade_shop', { p_spot: cur }, () => {
        haptic('record'); toast(esc(t('mkt.upgraded', { n: cur, l: lvl })), { icon: svg('star') });
        root.querySelector('.sv-head-pic')?.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 300, easing: springEasing(SPRING.pop) });
      });
      return;
    }
    if ((b = q('[data-sv-collect]'))) {
      b.disabled = true;
      const r = await ask('collect_shop', { p_spot: cur });
      if (r) { haptic('record'); coinsUp(b); toast(esc(r.coins ? t('mkt.collected', { n: r.coins }) : t('mkt.nothing')), { icon: `<img src="${COIN}" alt="" class="sv-toast-ico">`, duration: 2000 }); }
      return;
    }
    if ((b = q('[data-sv-restock]'))) {
      b.disabled = true;
      await ask('restock_shop', { p_spot: cur }, () => { haptic('place'); toast(esc(t('mkt.restocked'))); });
      return;
    }
    if ((b = q('[data-sv-crate]'))) {
      b.disabled = true;
      await ask('use_shop_crate', { p_spot: cur }, () => { haptic('record'); toast(esc(t('mkt.crateUsed')), { icon: svg('bag') }); });
      return;
    }
    if ((b = q('[data-sv-vip]'))) {
      b.disabled = true;
      const r = await ask('shop_vip', {});
      if (r) { haptic('record'); coinsUp(b); toast(esc(t('mkt.vipDone', { n: r.coins })), { icon: svg('trophy') }); }
    }
  });

  return root;
}
