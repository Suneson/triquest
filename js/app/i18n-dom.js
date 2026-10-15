// i18n-dom.js — the static page in the active language. index.html marks its
// words with data-i18n (text), data-i18n-aria (aria-label); this fills them
// and keeps <html lang>, the title and the description in step.

import { t, getLang } from '../core/i18n.js';

export function applyStatic(root = document) {
  document.documentElement.lang = getLang();
  document.title = t('app.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'));
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
}
