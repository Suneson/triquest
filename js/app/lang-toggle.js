// lang-toggle.js — the EN / ES switch: a two-state pixel toggle. Tapping a side
// saves settings.lang (which syncs through the profile) and main.js redraws
// everything in the new language without a reload.

import { t, getLang, LANGS } from '../core/i18n.js';

export function langToggle() {
  const cur = getLang();
  const btn = (l) => `<button type="button" class="lang-tg-btn${cur === l ? ' on' : ''}" data-action="set-lang" data-lang="${l}"
      aria-pressed="${cur === l}" lang="${l}" aria-label="${t(`lang.${l}`)}">${l.toUpperCase()}</button>`;
  return `<div class="lang-row"><span class="lang-label">${t('lang.label')}</span>
    <div class="lang-tg" role="group" aria-label="${t('lang.label')}">${LANGS.map(btn).join('')}</div></div>`;
}
