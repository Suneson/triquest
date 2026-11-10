// sheet.js — the one header every sheet and screen uses.
//
// One row at a fixed height: the title, and at most one action on the right.
// The way out depends on what it heads:
//  - a full screen or a sheet over the base (`lead: 'back'`): no arrow up in the
//    corner, where a thumb can't reach. A wide Close button sits at the bottom
//    of the screen instead (css/polish.css .sh-close), and a sheet can also be
//    pulled down;
//  - a partial sheet (`lead: 'close'`): a close cross, and it pulls down too;
//  - a thread inside a tab (`arrow: true`): the back arrow, because the bottom
//    of that screen is where you type.
// Every layer opens through nav.js, so the button carries `data-layer-close`
// and needs no wiring of its own; pass `closeAttr` to keep a sheet's existing
// close hook (it runs as well).

import { svg } from '../core/icons.js';
import { t } from '../core/i18n.js';

/**
 * @param {object} o
 * @param {string} o.title      title HTML (escape it at the call site)
 * @param {string} [o.icon]     pixel icon name shown before the title
 * @param {'back'|'close'} [o.lead]  arrow (full screen) or cross (partial sheet)
 * @param {string} [o.label]    accessible name of the leading button
 * @param {string} [o.closeAttr] extra attribute for the leading button (legacy close hooks)
 * @param {string} [o.before]   HTML before the title text (an avatar)
 * @param {string} [o.after]    HTML after the title text (a level chip)
 * @param {string} [o.action]   one action on the right (HTML)
 * @param {string} [o.id]       id for the title, so the dialog can be labelled by it
 * @param {boolean} [o.noLead]  no way back here (a step that must be finished)
 * @param {boolean} [o.arrow]   keep the back arrow in the header (a thread inside a tab)
 */
export function sheetHead({ title, icon = '', lead = 'close', label, closeAttr = '', before = '', after = '', action = '', id = '', noLead = false, arrow = false }) {
  const name = label || (lead === 'back' ? t('sheet.back') : t('sheet.close'));
  // the Close button at the foot of a full screen: in the header's markup so every screen gets
  // it, pinned to the bottom of the layer by CSS
  if (lead === 'back' && !arrow && !noLead) {
    return `<header class="sh-head sh-head--back sh-head--foot">
    <span class="sh-lead-gap" aria-hidden="true"></span>
    <h2 class="sh-title"${id ? ` id="${id}"` : ''}>${before}${icon ? svg(icon) : ''}<span class="sh-title-text">${title}</span>${after}</h2>
    <div class="sh-act">${action}</div>
  </header>
  <button type="button" class="sh-close" data-layer-close ${closeAttr}><span>${t('sheet.close')}</span></button>`;
  }
  return `<header class="sh-head sh-head--${lead}">
    ${noLead ? '<span class="sh-lead-gap" aria-hidden="true"></span>'
      : `<button type="button" class="sh-lead" data-layer-close ${closeAttr} aria-label="${name}">${svg(lead === 'back' ? 'back' : 'close')}</button>`}
    <h2 class="sh-title"${id ? ` id="${id}"` : ''}>${before}${icon ? svg(icon) : ''}<span class="sh-title-text">${title}</span>${after}</h2>
    <div class="sh-act">${action}</div>
  </header>`;
}
