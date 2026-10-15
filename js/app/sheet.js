// sheet.js — the one header every sheet and screen uses.
//
// One row at a fixed height: the way back on the left (an arrow on a full
// screen, a close cross on a partial sheet), the title, and at most one
// action on the right. Every layer opens through nav.js, so the leading
// button carries `data-layer-close` and needs no wiring of its own; pass
// `closeAttr` to keep a sheet's existing close hook (it runs as well).

import { svg } from '../core/icons.js';

/**
 * @param {object} o
 * @param {string} o.title      title HTML (escape it at the call site)
 * @param {string} [o.icon]     pixel icon name shown before the title
 * @param {'back'|'close'} [o.lead]  arrow (full screen) or cross (partial sheet)
 * @param {string} [o.label]    accessible name of the leading button
 * @param {string} [o.closeAttr] extra attribute for the leading button (legacy close hooks)
 * @param {string} [o.before]   HTML before the title text (an avatar)
 * @param {string} [o.action]   one action on the right (HTML)
 * @param {string} [o.id]       id for the title, so the dialog can be labelled by it
 * @param {boolean} [o.noLead]  no way back here (a step that must be finished)
 */
export function sheetHead({ title, icon = '', lead = 'close', label, closeAttr = '', before = '', action = '', id = '', noLead = false }) {
  const name = label || (lead === 'back' ? 'Back' : 'Close');
  return `<header class="sh-head sh-head--${lead}">
    ${noLead ? '<span class="sh-lead-gap" aria-hidden="true"></span>'
      : `<button type="button" class="sh-lead" data-layer-close ${closeAttr} aria-label="${name}">${svg(lead === 'back' ? 'back' : 'close')}</button>`}
    <h2 class="sh-title"${id ? ` id="${id}"` : ''}>${before}${icon ? svg(icon) : ''}<span class="sh-title-text">${title}</span></h2>
    <div class="sh-act">${action}</div>
  </header>`;
}
