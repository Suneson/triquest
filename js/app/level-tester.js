// level-tester.js: try the base's levels without earning them (admins and the demo).
//
// A "Levels" button on the base opens a sheet: the base level (the platform's theme, 1 to 10) and
// each levelled item's level (js/core/item-levels.js), stepped up and down. They're kept on this
// device only and override the real ones while set; "Back to real" clears them. Testers also own
// every levelled item, so each can be taken from the stash and set down to see it on the ground.

import { esc } from './ui.js';
import { t } from '../core/i18n.js';
import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { haptic } from './haptics.js';
import { isDemo } from './demo.js';
import { isChestAdmin } from './chests-state.js';
import { LEVEL_ITEMS, maxLevel, levelArt } from '../core/item-levels.js';

const KEY = 'moske-test-levels';

export const isTester = () => { try { return isChestAdmin() || isDemo(); } catch { return false; } };

function read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* blocked */ } }

/** The base level set for testing, or 0. */
export const testBaseLevel = () => (isTester() ? Number(read().base) || 0 : 0);
/** Each levelled item's test level: { id: n }. */
export const testItemLevels = () => (isTester() ? read().items || {} : {});
/** Every levelled item, owned (testers only), as inventory rows. */
export const testerItemRows = () => (isTester() ? LEVEL_ITEMS.map(([id]) => ({ item_id: id })) : []);

const redraw = () => document.dispatchEvent(new CustomEvent('dg-room', { bubbles: true }));

export function openTestLevels() {
  const root = openLayer('test-levels', { className: 'gear-layer tl-layer', sheet: true });
  const draw = () => {
    const s = read(), items = s.items || {};
    const step = (attr, id, n, max, label, pic = '') => `<div class="tl-row">
        ${pic ? `<img src="${pic}" alt="" width="44" height="44" loading="lazy" decoding="async">` : '<span></span>'}
        <span class="tl-name">${esc(label)}</span>
        <button type="button" class="fe-step" data-tl="${attr}:${id}:-1" aria-label="${esc(t('testLevels.down'))}"${n <= 1 ? ' disabled' : ''}>−</button>
        <b class="tl-n">${n}<small>/${max}</small></b>
        <button type="button" class="fe-step" data-tl="${attr}:${id}:1" aria-label="${esc(t('testLevels.up'))}"${n >= max ? ' disabled' : ''}>+</button>
      </div>`;
    const groups = ['core', 'machine', 'decor'];
    root.innerHTML = `<div class="fh-screen gw-screen is-shop tl-screen" role="dialog" aria-modal="true" aria-labelledby="tl-title">
      ${sheetHead({ title: esc(t('testLevels.title')), lead: 'back', noLead: true, id: 'tl-title' })}
      <p class="wr-note tl-note">${esc(t('testLevels.note'))}</p>
      <section class="wr-sec"><h3>${esc(t('testLevels.base'))}</h3>${step('base', 'base', Number(s.base) || 1, 10, t('testLevels.platform'))}</section>
      ${groups.map((g) => `<section class="wr-sec"><h3>${esc(t(`testLevels.group.${g}`))}</h3>
        ${LEVEL_ITEMS.filter((r) => r[4] === g).map(([id, , , unlock]) => {
          const n = Math.min(maxLevel(id), Number(items[id]) || 1);
          return step('item', id, n, maxLevel(id), `${t(`cp.item.${id}`)} · ${t('testLevels.unlocks', { n: unlock })}`, levelArt(id, n));
        }).join('')}</section>`).join('')}
      <section class="wr-sec fe-actions"><button type="button" class="fe-btn" data-tl-reset>${esc(t('testLevels.reset'))}</button></section>
    </div>`;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    const s = read();
    if (b.dataset.tl) {
      const [attr, id, dir] = b.dataset.tl.split(':');
      if (attr === 'base') s.base = Math.max(1, Math.min(10, (Number(s.base) || 1) + Number(dir)));
      else { s.items = { ...(s.items || {}) }; s.items[id] = Math.max(1, Math.min(maxLevel(id), (Number(s.items[id]) || 1) + Number(dir))); }
    } else if (b.hasAttribute('data-tl-reset')) { write({}); draw(); redraw(); haptic('tick'); return; }
    else return;
    write(s); draw(); redraw(); haptic('tick');
  });
  draw();
  return root;
}
