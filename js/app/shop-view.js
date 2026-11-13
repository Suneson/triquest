// shop-view.js: the markets' screen (rules in js/core/shop.js, docs/MARKETS.md).
//
// Full screen, a back arrow at the top left. Laid out like a card game's deck screen:
//   - at the top, the deck: a tab for each of your six markets, the market's eight slots (locked
//     past its level), each an item card with a bar of the units left, and its buttons: Collect,
//     Restock all, a crate, Upgrade. Chips say what your training is doing for it now.
//   - below, the storeroom: Gym, Bike, Run and Swim, fifteen items each, with a bar of how many you
//     hold (of 1000). Each sport is its own shop: a rail with its kit hanging off it and its sign,
//     then its items on its own colour of quilt (icons/Market/shop/, tools/make-shop-quilts.py),
//     which scrolls with them. Picking a sport swipes the shop sideways; the rest stays still.
//   - tap an item: it lifts and Buy (a slider, in fives) and Restock float over the cards below it.
//   - Close at the foot, over everything, as well as the back arrow at the top; tapping the
//     market's picture closes it too.
//   - Restock sends it up to the market: pick a shelf (the item swaps in, what was there goes back
//     to the storeroom). An item stands on one shelf only: if it's already on one, that shelf
//     wiggles and the rest grey out; tapping it tops it up, or says it's full. The units fly into
//     the shelf one by one and its bar fills.
//   - Opening a market (or its tab) brings its eight shelves in one after another, scaling down
//     into place, and its picture with them, which then jiggles now and then.
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
import { myShop, shopsOpen, shopCall, walletNow, serverNow, gearError, onGear, refreshGear } from './gear-state.js';
import {
  SHOP_RULES, SHOP_ITEMS, SPORTS, shopItem, itemBuy, itemSell, itemPicture, marketPicture, shopLevel, shopNext,
  buildCostFor, demandAt, weekMinutes, trafficFor, brickDay, marketSales, soldIn, specialty, restockCost, cratesLeft,
} from '../core/shop.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';
const coinTag = (n, short = false) => `<span class="sv-price data-num${short ? ' is-short' : ''}">${fmtNum(n)}<img src="${COIN}" alt=""></span>`;
const itemName = (id) => t(`mkt.items.${id}`);
/** The kit hanging off each shop's rail: three each side of the sign. */
const RAIL = {
  gym: ['gym-kettlebell', 'gym-gloves', 'gym-rope', 'gym-dumbbells', 'gym-medball', 'gym-bands'],
  bike: ['bike-helmet', 'bike-bottle', 'bike-gloves', 'bike-pump', 'bike-shoes', 'bike-computer'],
  run: ['run-racers', 'run-cap', 'run-watch', 'run-flask', 'run-shades', 'run-headband'],
  swim: ['swim-goggles', 'swim-cap', 'swim-paddles', 'swim-fins', 'swim-buoy', 'swim-kickboard'],
};

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
  if (!shopAt(cur) && !(Number(spot) >= 1)) cur = Number(shop().shops.map((m) => Number(m.spot)).sort((a, b) => a - b)[0]) || 0;

  // ---- drawing ------------------------------------------------------------------------------------

  const tabs = () => Array.from({ length: SHOP_RULES.spots }, (_, i) => {
    const s = i + 1; const m = shopAt(s);
    return `<button type="button" class="sv-tab${s === cur ? ' is-on' : ''}${m ? '' : ' is-free'}" data-sv-tab="${s}" aria-pressed="${s === cur}"
      aria-label="${esc(t('mkt.market', { n: s }))}">${m ? `<b class="data-num">${s}</b>` : svg('plus')}</button>`;
  }).join('');

  const slotCard = (m, x, n, c, dup) => {
    const L = shopLevel(m.level);
    if (n > L.slots) {
      const need = SHOP_RULES.levels.find((l) => l.slots >= n)?.level || 8;
      return `<div class="sv-card sv-slot is-locked" data-slot="${n}"><span class="sv-art">${svg('lock')}</span><span class="sv-lock">${esc(t('mkt.locked', { n: need }))}</span></div>`;
    }
    // placing an item: every open shelf takes it, unless it's already on one, which then is the
    // only one (the rest grey out)
    const target = !!selling && shopItem(selling).tier <= Number(m.level) && (!dup || dup.slot === n);
    const off = selling && !target ? ' is-off' : '';
    if (!x?.item) {
      return `<button type="button" class="sv-card sv-slot is-empty${target ? ' is-target' : ''}${off}" data-slot="${n}" aria-label="${esc(t('mkt.empty'))}">
        <span class="sv-art">${svg('plus')}</span><span class="sv-bar" style="--f:0"><i></i><b class="data-num">0/${L.capacity}</b></span></button>`;
    }
    const left = x.units - soldIn(x, c.now, c.traffic.f);
    const it = shopItem(x.item);
    return `<button type="button" class="sv-card sv-slot is-${it.sport}${target ? ' is-target' : ''}${off}${c.demand.has(it.sport) ? ' is-hot' : ''}" data-slot="${n}" data-item="${x.item}"
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
    const dup = selling ? slots.find((x) => x.item === selling && x.slot <= L.slots) : null;
    const vipToday = shop().moves.some((x) => x.kind === 'vip' && String(x.day) === new Date(c.now).toISOString().slice(0, 10));
    const chips = [
      `<span class="sv-chip is-traffic is-${c.traffic.id}">${svg('user')}<b>${esc(t(`mkt.traffic.${c.traffic.id}`))}</b><small class="data-num">${esc(c.traffic.next
        ? t('mkt.trafficNext', { min: c.mins, next: c.traffic.next.min }) : t('mkt.trafficTop', { min: c.mins }))}</small></span>`,
      ...SPORTS.filter((s) => c.demand.has(s)).map((s) => `<span class="sv-chip is-hot is-${s}">${svg(s)}<b>${esc(t('mkt.demand'))}</b></span>`),
      spec ? `<span class="sv-chip is-spec">${svg('star')}<b>${esc(t('mkt.specialty'))}</b></span>` : '',
    ].join('');
    return `<nav class="sv-tabs" role="tablist">${tabs()}</nav>
      <div class="sv-head">
        <button type="button" class="sv-head-pic" data-sv-close aria-label="${esc(t('city.market.close'))}"><img src="${marketPicture(m.level)}" alt="" draggable="false"></button>
        <div class="sv-head-txt"><b>${esc(t('mkt.market', { n: cur }))}</b><span>${esc(t('mkt.levelInfo', { l: m.level, open: L.slots, cap: L.capacity }))}</span></div>
        ${next ? `<button type="button" class="sv-btn is-green sv-up" data-sv-upgrade>${svg('chevron')}<span>${esc(t('mkt.upgrade'))}</span>${coinTag(next.cost, coins < next.cost)}</button>`
          : `<span class="sv-top">${esc(t('mkt.top'))}</span>`}
      </div>
      <div class="sv-chips">${chips}</div>
      <div class="sv-slots${spec ? ' is-spec' : ''}">${Array.from({ length: 8 }, (_, i) => slotCard(m, slots.find((x) => x.slot === i + 1), i + 1, c, dup)).join('')}</div>
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
    // each card in a cell of its own size; the picked one's Buy and Sell float over the cards below,
    // so nothing moves
    return list.map((it, i) => {
      const card = itemCard(it, stock[it.id] || 0, lvl);
      if (picked !== it.id) return `<div class="sv-cell">${card}</div>`;
      return `<div class="sv-cell is-picked is-col${i % 4}">${card}
        <div class="sv-pop">
          <button type="button" class="sv-btn is-green" data-sv-buy="${it.id}"><span>${esc(t('mkt.buy'))}</span>${coinTag(itemBuy(it.id))}</button>
          <button type="button" class="sv-btn is-orange" data-sv-sell="${it.id}" ${(stock[it.id] || 0) && it.tier <= lvl ? '' : 'disabled'}><span>${esc(t('mkt.sell'))}</span></button>
        </div>
      </div>`;
    }).join('');
  };

  /** A sport's shop: its rail, kit and sign, then its items, on its quilt. */
  const pane = () => `<div class="sv-pane is-${sport}" data-sv-pane role="region" aria-label="${esc(t(`mkt.shops.${sport}`))}">
      <div class="sv-rail" aria-hidden="true">
        <i class="sv-rod"></i>
        ${RAIL[sport].map((id, i) => `<span class="sv-hang is-${i}" style="--i:${i}"><i></i><img src="${itemPicture(id)}" alt="" draggable="false"></span>`).join('')}
        <span class="sv-sign"><i></i><b>${esc(t(`mkt.shops.${sport}`))}</b></span>
      </div>
      <div class="sv-grid" data-sv-grid>${store()}</div>
    </div>`;

  const draw = () => {
    if (closed) return;
    const coins = walletNow(workouts()).coins;
    root.innerHTML = `<div class="fh-screen sv-screen" role="dialog" aria-modal="true" aria-labelledby="sv-title">
      ${sheetHead({ title: esc(t('mkt.title')), lead: 'back', arrow: true, foot: !selling, id: 'sv-title',
        action: `<span class="sv-wallet" data-sv-wallet>${coinTag(coins)}</span>` })}
      <section class="sv-deck" data-sv-deck>${shopsOpen() ? deck() : `<p class="sv-soon">${esc(t('mkt.soon'))}</p>`}</section>
      <nav class="sv-sports" role="tablist">${SPORTS.map((s) => `<button type="button" class="sv-sport is-${s}${s === sport ? ' is-on' : ''}" data-sv-sport="${s}" aria-pressed="${s === sport}">${svg(s)}<b>${esc(t(`mkt.sports.${s}`))}</b></button>`).join('')}</nav>
      <section class="sv-store" data-sv-store>${pane()}</section>
      ${selling ? '' : '<div class="sh-footbar" aria-hidden="true"></div>'}
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
  /** The shelves come in one after another, 1 to 8, scaling down into place; the picture too. */
  const enter = () => {
    if (prefersReducedMotion()) return;
    root.querySelectorAll('.sv-slots .sv-slot').forEach((el, i) => el.animate([
      { scale: '1.16', opacity: 0 }, { opacity: 1, offset: 0.35 }, { scale: '1', opacity: 1 },
    ], { duration: 280, delay: i * 32, easing: EASE_OUT, fill: 'backwards' }));
    root.querySelector('.sv-head-pic img')?.animate([{ scale: '1.25', opacity: 0 }, { opacity: 1, offset: 0.3 }, { scale: '1', opacity: 1 }],
      { ...springEasing(SPRING.pop), fill: 'backwards' });
  };
  draw();
  enter();
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

  /**
   * Up to eight of the item fly from `from` into the slot one after another, slow enough to see
   * each, then the slot pops. Resolves when the last lands, or after the time it should take
   * (an animation the browser drops never holds the screen up).
   */
  const fly = (from, slotEl, id, n) => new Promise((res) => {
    if (prefersReducedMotion() || !from || !slotEl) { res(); return; }
    const a = from.getBoundingClientRect(); const b = slotEl.getBoundingClientRect();
    const k = Math.max(1, Math.min(8, n));
    const DUR = 760; const GAP = 130;
    let left = k; let done = false;
    const finish = () => {
      if (done) return; done = true;
      slotEl.animate([{ scale: '1.12' }, { scale: '1' }], { ...springEasing(SPRING.pop) });
      res();
    };
    setTimeout(finish, DUR + GAP * (k - 1) + 400);
    for (let i = 0; i < k; i++) {
      const img = document.createElement('img');
      img.src = itemPicture(id); img.className = 'sv-fly'; img.alt = '';
      const size = Math.min(a.width, 64);
      Object.assign(img.style, { width: `${size}px`, height: `${size}px`, left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size / 2}px` });
      document.body.append(img);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2); const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const side = (i % 2 ? 1 : -1) * 18;
      // an arc, up and over, landing smaller in the slot; fully seen all the way
      const anim = img.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 0 },
        { transform: 'translate(0, -6px) scale(1.05)', opacity: 1, offset: 0.12 },
        { transform: `translate(${dx * 0.5 + side}px, ${dy * 0.5 - 70}px) scale(.9)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(.55)`, opacity: 1, offset: 0.94 },
        { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0 },
      ], { duration: DUR, delay: i * GAP, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'both' });
      const landed = () => {
        img.remove();
        if (!done) slotEl.animate([{ scale: '1.05' }, { scale: '1' }], { duration: 160, easing: EASE_OUT });
        if (--left === 0) finish();
      };
      anim.finished.then(landed, landed);
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
    // the shelf as the server has it now; if the read came back before it caught up, read again
    const shows = () => slotsOf(cur).some((x) => x.slot === n && x.item === id && x.units > 0);
    if (!shows()) await refreshGear();
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
    selling = id; picked = null;
    draw();
    root.querySelector('[data-sv-deck]')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    haptic('select');
  };

  const buySheet = (id) => {
    const held = shop().stock[id] || 0;
    const price = itemBuy(id);
    const coins = walletNow(workouts()).coins;
    const max = Math.max(0, Math.min(SHOP_RULES.stockMax - held, Math.floor(coins / price)));
    const sheet = openLayer('market-buy', { sheet: true, className: 'sv-buy-layer' });
    // in fives (ones when fewer than five fit)
    const step = max >= 5 ? 5 : 1;
    const top = max - (max % step);
    let n = Math.min(top, 10);
    const draw2 = () => {
      sheet.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
      <div class="modal sv-buy" role="dialog" aria-modal="true" aria-labelledby="sv-buy-title">
        ${sheetHead({ title: esc(t('mkt.buyTitle', { item: itemName(id) })), id: 'sv-buy-title' })}
        <div class="sv-buy-body">
          <div class="sv-card sv-item is-${shopItem(id).sport}"><span class="sv-art"><img src="${itemPicture(id)}" alt=""></span></div>
          <p class="sv-buy-note">${esc(t('mkt.each', { price, sell: itemSell(id) }))}<br>${esc(t('mkt.heldNow', { n: held }))}</p>
          ${max ? `<input type="range" class="sv-range" min="${step}" max="${top}" step="${step}" value="${n}" data-sv-range aria-label="${esc(t('mkt.howMany'))}">
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

  /** Another sport's shop slides in from the side its tab is on; the old one slides out. */
  let swiping = null;
  const swipeTo = (next) => {
    haptic('tick');
    const dir = SPORTS.indexOf(next) > SPORTS.indexOf(sport) ? 1 : -1;
    sport = next; picked = null;
    root.querySelectorAll('[data-sv-sport]').forEach((b) => {
      const on = b.dataset.svSport === sport;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
    });
    const host = root.querySelector('[data-sv-store]');
    if (!host) { draw(); return; }
    swiping?.();
    const old = host.querySelector('[data-sv-pane]');
    host.insertAdjacentHTML('beforeend', pane());
    const fresh = host.lastElementChild;
    if (!old || prefersReducedMotion()) { old?.remove(); return; }
    // the old one keeps its place over the top while the new one sets the height
    old.removeAttribute('data-sv-pane'); old.querySelector('[data-sv-grid]')?.removeAttribute('data-sv-grid');
    old.classList.add('is-leaving');
    const opts = { duration: 380, easing: EASE_OUT, fill: 'both' };
    old.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 100}%)` }], opts);
    const inn = fresh.animate([{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }], opts);
    fresh.classList.add('is-arriving');
    const done = () => { old.remove(); inn.cancel(); fresh.classList.remove('is-arriving'); swiping = null; };
    swiping = done;
    inn.finished.then(done, () => {});
  };

  root.addEventListener('click', async (e) => {
    const q = (s) => e.target.closest(s);
    let b;
    if (q('[data-sv-close]')) { haptic('tick'); closeLayer(root); return; }
    if ((b = q('[data-sv-tab]'))) {
      haptic('tick'); cur = Number(b.dataset.svTab); selling = null; draw(); enter(); return;
    }
    if ((b = q('[data-sv-sport]'))) { if (b.dataset.svSport !== sport) swipeTo(b.dataset.svSport); return; }
    if (q('[data-sv-cancel]')) { haptic('tick'); selling = null; draw(); return; }
    if ((b = q('[data-sv-buy]'))) { haptic('tick'); buySheet(b.dataset.svBuy); return; }
    if ((b = q('[data-sv-sell]'))) { sell(b.dataset.svSell); return; }
    if ((b = q('[data-sv-item]'))) {
      haptic('tick'); picked = picked === b.dataset.svItem ? null : b.dataset.svItem;
      root.querySelector('[data-sv-grid]').innerHTML = store();
      // Buy and Sell in view, clear of the Close bar
      root.querySelector('.sv-pop')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      return;
    }
    // a tap anywhere else puts a lifted item back down
    if (picked && !q('.sv-pop')) { picked = null; const g = root.querySelector('[data-sv-grid]'); if (g) g.innerHTML = store(); }
    if ((b = q('.sv-slot[data-slot]')) && selling) {
      if (!b.matches('.is-target')) { haptic('refuse'); return; }
      const n = Number(b.dataset.slot);
      const x = slotsOf(cur).find((r) => r.slot === n);
      if (x?.item === selling) {
        const c = ctxNow();
        if (x.units - soldIn(x, c.now, c.traffic.f) >= shopLevel(shopAt(cur).level).capacity) {
          haptic('refuse'); toast(esc(t('mkt.shelfFull'))); selling = null; draw(); return;
        }
      }
      stockSlot(n, selling); return;
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
        root.querySelector('.sv-head-pic img')?.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { ...springEasing(SPRING.pop) });
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
