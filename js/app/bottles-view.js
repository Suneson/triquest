// bottles-view.js — the sports bottles in the inventory's Fuel tab (js/core/bottles.js, 0042_bottles.sql): a
// card for each bottle you hold or that's working, Drink on the card, and an (i) sheet with what it does and how
// often chests give it. Drinking asks the server (chests-state.js drinkBottle); Recovery Mix then fills the
// device's stamina, which is where the drills keep it.

import { t, fmtNum } from '../core/i18n.js';
import { svg } from '../core/icons.js';
import { esc } from './ui.js';
import { toast, playAccept } from './effects.js';
import { haptic } from './haptics.js';
import { busy } from './motion.js';
import { closeLayer } from './nav.js';
import * as store from './store.js';
import { BOTTLE_RULES, BOTTLE_IDS, bottleArt, canDrink, bottleOdds } from '../core/bottles.js';
import { TIERS, CHEST_RULES } from '../core/rewards.js';
import { STAMINA, staminaSet } from '../core/stamina.js';
import { bottlesState, drinkBottle, onChests } from './chests-state.js';
import { gearError } from './gear-state.js';
import { shopCard, actionButton, openShopInfo } from './shop-ui.js';

export const onBottles = onChests;

const left = (until) => {
  const m = Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

/** Is it working now? A text for it, or ''. */
function working(id, st) {
  const a = st.active?.[id];
  if (!a) return '';
  if (a === true) return t('bottle.charging');
  if (Date.parse(a) > Date.now()) return t('bottle.until', { t: left(a) });
  return '';
}

function why(id, st) {
  return canDrink(id, { held: st.held?.[id] || 0, active: Object.fromEntries(BOTTLE_IDS.map((b) => [b, !!working(b, st)])),
    fuelOn: !!st.fuel_on, jobsRunning: Number(st.jobs_running) || 0 });
}

function tapFor(id, st) {
  const name = t(`bottle.${id}.name`);
  const can = why(id, st);
  if (can.ok) return actionButton(t('bottle.drink'), `data-bottle-drink="${id}"`, { icon: 'bolt', aria: t('bottle.drinkAria', { name }) });
  return { kind: 'wait', tone: 'muted', tray: `${svg('bolt')}<b>${esc(t(`bottle.why.${can.reason}`))}</b>`, label: t(`bottle.whyLong.${can.reason}`) };
}

function card(id, st) {
  const n = st.held?.[id] || 0;
  return shopCard({
    id, kind: 'bottle', mode: 'use', title: t(`bottle.${id}.name`), art: bottleArt(id), st: {}, plate: 'green',
    counter: { label: t('bottle.held'), text: fmtNum(n), full: false }, badge: working(id, st) ? t('bottle.working') : '',
    button: tapFor(id, st),
  });
}

/** The Bottles block on top of the Fuel tab: '' when you have none and none is working. */
export function bottlesSection() {
  const st = bottlesState();
  const ids = BOTTLE_IDS.filter((id) => (st.held?.[id] || 0) > 0 || working(id, st));
  const notes = BOTTLE_IDS.map((id) => working(id, st) && `<li><img src="${bottleArt(id, true)}" width="96" height="96" alt="">
    <b>${esc(t(`bottle.${id}.name`))}</b><span>${esc(working(id, st))}</span></li>`).filter(Boolean).join('');
  return `<section class="bt-sec" aria-labelledby="bt-h">
    <h3 class="sc-row-h" id="bt-h"><img src="${bottleArt('electro-surge', true)}" width="96" height="96" alt="" class="bt-h-ico"> ${esc(t('bottle.title'))}</h3>
    ${notes ? `<ul class="bt-on" role="status">${notes}</ul>` : ''}
    ${ids.length ? `<div class="sc-grid">${ids.map((id) => card(id, st)).join('')}</div>` : `<p class="bt-none">${esc(t('bottle.none'))}</p>`}
  </section>`;
}

/** The (i) sheet: what it does, how many you hold, and which chests give it. */
export function bottleInfo(id, redraw) {
  const st = bottlesState();
  const b = BOTTLE_RULES.bottles[id];
  const tiers = TIERS.filter((x) => CHEST_RULES.enabled[x]);
  const odds = tiers.map((x) => `${t(`chest.tier.${x}`)} ${fmtNum(Math.round(bottleOdds(x).each[id] * 100))}%`).join(' · ');
  const rows = [
    [t('bottle.effect'), `<b>${esc(t(`bottle.${id}.effect`))}</b>`],
    [t('bottle.strength'), `<b class="bt-pips" aria-label="${b.strength} / 4">${'●'.repeat(b.strength)}${'○'.repeat(4 - b.strength)}</b>`],
    [t('bottle.held'), `<b class="data-num">${fmtNum(st.held?.[id] || 0)}</b>`],
  ];
  if (b.drops) rows.push([t('chest.bottles'), `<span class="bt-odds">${esc(odds)}</span>`]);
  return openShopInfo({
    title: t(`bottle.${id}.name`), art: bottleArt(id), rows, stack: true, plate: 'green',
    lore: `${t(`bottle.${id}.does`)} ${t(`bottle.${id}.blurb`)}`, note: esc(t('bottle.note')),
    button: tapFor(id, st),
    onClick: async (e, layer) => { if (await bottleClick(e, redraw)) closeLayer(layer); },
  });
}

/** A Drink tap (on a card or its sheet). True when it handled the click. */
export async function bottleClick(e, redraw) {
  const btn = e.target.closest('[data-bottle-drink]');
  if (!btn) return false;
  const id = btn.dataset.bottleDrink;
  await busy(btn, async () => {
    try {
      await drinkBottle(id);
      if (id === 'recovery-mix') {
        store.setSetting('stamina', staminaSet(STAMINA.max));
        document.dispatchEvent(new CustomEvent('drills-changed'));
      }
      playAccept();
      haptic('levelUp');
      toast(`<b>${esc(t(`bottle.${id}.name`))}</b><br>${esc(t(`bottle.${id}.drunk`))}`, { icon: `<img src="${bottleArt(id, true)}" width="96" height="96" alt="">` });
    } catch (err) { haptic('refuse'); toast(gearError(err), { icon: svg('warn') }); }
  });
  redraw?.();
  return true;
}
