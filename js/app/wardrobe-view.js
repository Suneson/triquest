// wardrobe-view.js: the wardrobe, full screen (the yellow button between the shop and the kit bag).
//
// The character stands at the top in 3D (wardrobe3d.js); below it three tabs, scrolling on their own:
//   Look         class, body, skin tone and eye colour
//   Outfits      every outfit: yours first, then the ones still to get, and how
//   Accessories  helmets, shoes, hats, glasses and watches, one per slot (hair is on Look)
// It rises almost to the top of the screen and has no Close button: pull it down (or tap its
// handle) to close it. The look is kept on this device for now (moske-look). Outfits and accessories without a model
// can't be put on yet: their cards say so. The rules are js/core/wardrobe.js's.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { haptic } from './haptics.js';
import { gearState } from './gear-state.js';
import {
  fitsBody, BODY_LOOKS, SKIN_TONES, EYE_COLOURS, HAIR_COLOURS, OUTFITS, SLOTS, ALL_OUTFITS, normaliseLook, outfitState, accessoryState, modelFor, clipsFor, gearFor,
} from '../core/wardrobe.js';
import { isChestAdmin } from './chests-state.js';
import { isDemo } from './demo.js';

const LOOK_KEY = 'moske-look';
const TABS = ['look', 'outfits', 'gear'];

// admins and the demo can try every outfit and accessory on, to check the models
const everything = () => { try { return isChestAdmin() || isDemo(); } catch { return false; } };
export const ownedIds = () => {
  let ids = [];
  try { ids = (gearState().inventory || []).map((r) => r.item_id); } catch { /* signed out */ }
  return everything() ? [...new Set([...ids, ...ALL_OUTFITS])] : ids;
};
export function loadLook() {
  try { return normaliseLook(JSON.parse(localStorage.getItem(LOOK_KEY) || 'null'), ownedIds()); } catch { return normaliseLook(null); }
}
const saveLook = (look) => { try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch { /* private mode */ } };

// ---- the little drawings on the cards (no outfit or accessory art yet) ----------------------

/** Top and bottom colours, from each outfit's line in BUILD-PLAN.md. */
const OUTFIT_COLOURS = {
  base: ['#EEC9B2', '#EEC9B2'], tracksuit: ['#C9CED6', '#3B4250'], 'starter-tee': ['#FFFFFF', '#16264D'],
  'navy-training': ['#16264D', '#6B7488'], 'white-gold': ['#F6F4EE', '#FFFFFF'], 'blue-half-zip': ['#0C4CAE', '#1D2433'],
  'sky-club': ['#6EA8FF', '#16264D'], 'road-racer': ['#FFFFFF', '#6EA8FF'], distance: ['#2C3E6B', '#22304F'],
  'iron-gym': ['#7E8592', '#16264D'], 'heavy-day': ['#16264D', '#7E8592'], 'aero-suit': ['#16264D', '#6EA8FF'],
  'tri-pro': ['#16264D', '#F2C14E'], 'storm-shell': ['#1E2E57', '#1E2E57'], 'gold-line': ['#15171C', '#15171C'],
  'marathon-elite': ['#FFFFFF', '#FFFFFF'], forge: ['#3A3F4A', '#0C4CAE'], 'first-finisher': ['#FFFFFF', '#16264D'],
  'streak-keeper': ['#123A8A', '#123A8A'], 'blomvelt-set': ['#D7263D', '#FFFFFF'], 'clan-champion': ['#1F4FC4', '#F2C14E'],
};
const ITEM_COLOUR = (id) => (/gold/.test(id) ? '#F2C14E' : /white|starter|cycling/.test(id) ? '#F4F6FA' : /blue|sky|visor|runner/.test(id) ? '#6EA8FF'
  : /aero|navy|beanie|lifter|casual|trail/.test(id) ? '#16264D' : /bucket|trainer|grey/.test(id) ? '#8A93A3' : '#2A2F3A');

const kitSvg = ([top, bottom]) => `<svg class="wr-kit" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M22 8l-12 7 5 11 6-3v19h22V23l6 3 5-11-12-7c-2 4-6 6-10 6s-8-2-10-6z" fill="${top}" stroke="#0B1630" stroke-width="2" stroke-linejoin="round"/>
  <path d="M21 44h22l2 14H34l-2-8-2 8H19z" fill="${bottom}" stroke="#0B1630" stroke-width="2" stroke-linejoin="round"/></svg>`;
const SLOT_PATH = {
  helmet: 'M10 40c0-14 10-24 24-24 12 0 20 8 22 20l-8 2H10z M18 30h8 M30 22l4 8',
  shoes: 'M8 40l4-14h12c2 5 8 8 16 9l14 3c3 1 4 3 4 6v2H8z M8 46h50',
  hat: 'M12 38c0-12 8-20 20-20s20 8 20 20z M10 38h44c4 0 6 2 6 4H8c0-2 1-4 2-4z',
  glasses: 'M6 28h52 M10 28c0 8 4 12 10 12s10-4 10-12 M34 28c0 8 4 12 10 12s10-4 10-12',
  watch: 'M24 6h16v12H24z M24 46h16v12H24z M20 18h24v28H20z M32 26v7l5 3',
  hair: 'M14 40c-2-16 6-28 18-28s20 12 18 28c-3-8-8-12-10-18-6 6-14 8-22 8-2 3-3 6-4 10z',
};
const slotSvg = (slot, colour) => `<svg class="wr-kit" viewBox="0 0 64 64" aria-hidden="true"><path d="${SLOT_PATH[slot]}" fill="${slot === 'glasses' ? 'none' : colour}"
  stroke="${slot === 'glasses' ? colour : '#0B1630'}" stroke-width="${slot === 'glasses' ? 4 : 2}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const noneSvg = `<svg class="wr-kit" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="4"/><path d="M19 45L45 19" stroke="currentColor" stroke-width="4"/></svg>`;

// ---- the panels -------------------------------------------------------------------------------

const chip = (attr, value, on, label) => `<button type="button" class="wr-chip${on ? ' is-on' : ''}" ${attr}="${value}" aria-pressed="${on}">${esc(label)}</button>`;
const swatch = (attr, s, on, label) => `<button type="button" class="wr-swatch${on ? ' is-on' : ''}" ${attr}="${s.id}" aria-pressed="${on}" aria-label="${esc(label)}" title="${esc(label)}" style="--sw:${s.hex}"></button>`;

function lookPanel(look) {
  // no class picker: endurance is the only class
  return `<section class="wr-sec"><h3>${esc(t('wardrobe.body'))}</h3>
      <div class="wr-chips">${BODY_LOOKS.map((b) => chip('data-wr-body', b, look.body === b, t(`wardrobe.bodies.${b}`))).join('')}</div></section>
    <section class="wr-sec"><h3>${esc(t('wardrobe.skin'))}</h3>
      <div class="wr-swatches">${SKIN_TONES.map((s) => swatch('data-wr-skin', s, look.skin === s.id, t(`wardrobe.skins.${s.id}`))).join('')}</div></section>
    <section class="wr-sec"><h3>${esc(t('wardrobe.eyes'))}</h3>
      <div class="wr-swatches is-eyes">${EYE_COLOURS.map((e) => swatch('data-wr-eyes', e, look.eyes === e.id, t(`wardrobe.eyeColours.${e.id}`))).join('')}</div></section>
    <section class="wr-sec"><h3>${esc(t('wardrobe.slot.hair'))}</h3>
      <div class="wr-swatches">${HAIR_COLOURS.map((h) => swatch('data-wr-hair', h, look.hairColour === h.id, t(`wardrobe.hairColours.${h.id}`))).join('')}</div>
      <div class="wr-grid">${slotCards(SLOTS.find((s) => s.id === 'hair'), look, [], HAIR_COLOURS.find((h) => h.id === look.hairColour)?.hex)}</div></section>`;
}

const STATE_ORDER = { owned: 0, soon: 1, locked: 2, class: 3 };
function stateLine(state, kind, look) {
  if (state === 'owned') return '';
  if (state === 'soon') return `<small class="wr-state is-soon">${esc(t('wardrobe.state.soon'))}</small>`;
  return `<small class="wr-state">${svg('lock')}${esc(t(`wardrobe.how.${kind}`))}</small>`;
}

function outfitsPanel(look, owned) {
  const rows = OUTFITS.map((o) => ({ o, state: outfitState(o.id, look, owned) }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  const card = ({ o, state }) => {
    const on = look.outfit === o.id;
    return `<button type="button" class="wr-card is-${state}${on ? ' is-on' : ''}" data-wr-outfit="${o.id}" aria-pressed="${on}" ${state === 'owned' ? '' : 'aria-disabled="true"'}>
      ${kitSvg(OUTFIT_COLOURS[o.id] || ['#8A93A3', '#16264D'])}
      <b>${esc(t(`wardrobe.outfit.${o.id}`))}</b>
      <span class="wr-tag is-${o.kind}">${esc(t(`wardrobe.kind.${o.kind}`))}</span>
      ${on ? `<small class="wr-state is-on">${svg('check')}${esc(t('wardrobe.state.wearing'))}</small>` : stateLine(state, o.kind, look)}
    </button>`;
  };
  return `<p class="wr-note">${esc(t('wardrobe.outfitsNote'))}</p><div class="wr-grid">${rows.map(card).join('')}</div>`;
}

/** A slot's cards: none, then each item. `colour` paints every icon (the hair colour), else each item's own. */
function slotCards(slot, look, owned, colour = null) {
  const cur = look.gear[slot.id];
  const none = `<button type="button" class="wr-card is-owned${cur ? '' : ' is-on'}" data-wr-gear="${slot.id}:" aria-pressed="${!cur}">
      ${noneSvg}<b>${esc(t('wardrobe.none'))}</b></button>`;
  return none + slot.items.filter((id) => fitsBody(id, look.body)).map((id) => {
    const state = accessoryState(id, owned);
    const on = cur === id;
    return `<button type="button" class="wr-card is-${state}${on ? ' is-on' : ''}" data-wr-gear="${slot.id}:${id}" aria-pressed="${on}" ${state === 'owned' ? '' : 'aria-disabled="true"'}>
        ${slotSvg(slot.id, colour || ITEM_COLOUR(id))}<b>${esc(t(`wardrobe.item.${id}`))}</b>
        ${state === 'soon' ? `<small class="wr-state is-soon">${esc(t('wardrobe.state.soon'))}</small>` : state === 'locked' ? `<small class="wr-state">${svg('lock')}${esc(t('wardrobe.how.shop'))}</small>` : ''}
      </button>`;
  }).join('');
}

function gearPanel(look, owned) {
  const tool = everything() ? `<button type="button" class="fe-open" data-wr-fit>${esc(t('wardrobe.fit.open'))}</button>` : '';
  return tool + SLOTS.filter((slot) => !slot.free).map((slot) =>
    `<section class="wr-sec"><h3>${esc(t(`wardrobe.slot.${slot.id}`))}${slot.buff ? ` <span class="wr-buff">${svg('bolt')}${esc(t('wardrobe.buff'))}</span>` : ''}</h3>
      <div class="wr-grid">${slotCards(slot, look, owned)}</div></section>`).join('');
}

// ---- the screen ------------------------------------------------------------------------------

export function openWardrobe() {
  let stage = null, closed = false;
  const root = openLayer('wardrobe', { className: 'gear-layer wr-layer', sheet: true, onClose: () => { closed = true; stage?.dispose(); } });
  let look = loadLook();
  let tab = 'look';
  const owned = ownedIds();

  root.innerHTML = `<div class="fh-screen gw-screen is-shop wr-screen" role="dialog" aria-modal="true" aria-labelledby="wr-title">
    ${sheetHead({ title: esc(t('wardrobe.title')), lead: 'back', noLead: true, id: 'wr-title' })}
    <div class="wr-stage" data-wr-stage>
      <p class="wr-stage-msg" data-wr-msg>${esc(t('wardrobe.loading'))}</p>
      <span class="wr-hint" aria-hidden="true">${esc(t('wardrobe.dragHint'))}</span>
    </div>
    <div class="wr-tabs" role="tablist" aria-label="${esc(t('wardrobe.title'))}">${TABS.map((v) =>
      `<button type="button" class="wr-tab" role="tab" id="wr-tab-${v}" data-wr-tab="${v}" aria-controls="wr-panel">${esc(t(`wardrobe.tab.${v}`))}</button>`).join('')}</div>
    <div class="wr-panel" id="wr-panel" role="tabpanel" data-wr-panel></div>
  </div>`;
  const panelEl = root.querySelector('[data-wr-panel]');
  const msg = root.querySelector('[data-wr-msg]');

  const draw = () => {
    for (const b of root.querySelectorAll('[data-wr-tab]')) {
      const on = b.dataset.wrTab === tab;
      b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    }
    panelEl.setAttribute('aria-labelledby', `wr-tab-${tab}`);
    panelEl.innerHTML = tab === 'look' ? lookPanel(look) : tab === 'outfits' ? outfitsPanel(look, owned) : gearPanel(look, owned);
  };
  // a new tab's panel slides in; a pick only redraws it, so the class comes off again
  let inTimer = 0;
  const slideIn = () => {
    panelEl.classList.remove('is-in'); void panelEl.offsetWidth; panelEl.classList.add('is-in');
    clearTimeout(inTimer); inTimer = setTimeout(() => panelEl.classList.remove('is-in'), 300);
  };
  const dress = () => {
    if (!stage) return;
    stage.show(modelFor(look, owned), clipsFor(look), look, gearFor(look, owned)).then(() => { msg.hidden = true; })
      .catch(() => { msg.hidden = false; msg.textContent = t('wardrobe.loadFailed'); });
  };
  const update = (next) => {
    look = normaliseLook(next, owned);
    saveLook(look);
    haptic('tick');
    draw(); dress();
  };

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.wrTab) { if (b.dataset.wrTab !== tab) { tab = b.dataset.wrTab; draw(); panelEl.scrollTop = 0; slideIn(); haptic('tick'); } return; }
    if (b.hasAttribute('data-wr-fit')) {
      import('./fit-editor.js').then(({ openFitEditor }) => openFitEditor(look, { onClose: () => stage?.refit() }));
      return;
    }
    if (b.dataset.wrBody) return update({ ...look, body: b.dataset.wrBody });
    if (b.dataset.wrSkin) return update({ ...look, skin: b.dataset.wrSkin });
    if (b.dataset.wrEyes) return update({ ...look, eyes: b.dataset.wrEyes });
    if (b.dataset.wrHair) return update({ ...look, hairColour: b.dataset.wrHair });
    if (b.dataset.wrOutfit && b.getAttribute('aria-disabled') !== 'true') return update({ ...look, outfit: b.dataset.wrOutfit });
    if (b.dataset.wrGear && b.getAttribute('aria-disabled') !== 'true') {
      const [slot, id] = b.dataset.wrGear.split(':');
      return update({ ...look, gear: { ...look.gear, [slot]: id || null } });
    }
  });
  // arrow keys move between the tabs, as in the app's other tab rows
  root.querySelector('.wr-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    tab = TABS[(TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    draw(); slideIn(); root.querySelector(`[data-wr-tab="${tab}"]`).focus();
  });

  draw();
  import('./wardrobe3d.js').then(({ mountWardrobe }) => mountWardrobe(root.querySelector('[data-wr-stage]'))).then((s) => {
    if (closed) { s?.dispose(); return; }
    stage = s;
    if (!stage) { msg.textContent = t('wardrobe.noGl'); return; }
    dress();
  }).catch(() => { msg.textContent = t('wardrobe.loadFailed'); });
  return root;
}
