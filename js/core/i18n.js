// i18n.js — the app's words in English and Spanish. Pure: no DOM.
//
//   t('home.calendar')                       → "Calendar" / "Calendario"
//   t('quests.cleared', { xp: 100 })         → "+100 XP today"
//   t('chat.unread', { n: 3 })               → plural forms: { one, other }
//
// Locales are plain modules (js/core/locales/en.js, es.js) holding nested
// objects; keys are dot paths. A key missing in the active language falls
// back to English (and warns in development); a key missing everywhere
// returns the key itself, so a gap is visible instead of blank.
//
// Dates and numbers go through fmtDate / fmtNum so weekday and month names,
// decimal separators and relative times follow the language.

import en from './locales/en.js';
import es from './locales/es.js';

export const LANGS = ['en', 'es'];
const DICTS = { en, es };
const TAGS = { en: 'en-GB', es: 'es-ES' };

let lang = 'en';
const listeners = new Set();
let warn = (msg) => {
  const dev = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (dev) console.warn(msg);
};

/** Replace the warning sink (tests use it to catch fallbacks). */
export function setWarn(fn) { warn = fn; }

export const getLang = () => lang;
export const localeTag = (l = lang) => TAGS[l] || TAGS.en;

/** Pick the starting language: a saved choice, else the device language. */
export function pickLang(saved, navigatorLang = '') {
  if (LANGS.includes(saved)) return saved;
  return String(navigatorLang).toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function setLang(l) {
  const next = LANGS.includes(l) ? l : 'en';
  if (next === lang) return;
  lang = next;
  listeners.forEach((fn) => { try { fn(lang); } catch { /* a listener went away */ } });
}

export function onLang(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function lookup(dict, key) {
  let v = dict;
  for (const part of key.split('.')) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[part];
  }
  return v;
}

// a plural is { one, other } (and the other CLDR forms) holding strings only;
// a namespace that happens to have an `other` key (sport.other) is not one
const PLURAL_FORMS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const isPlural = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && 'other' in v
  && Object.entries(v).every(([k, x]) => PLURAL_FORMS.has(k) && typeof x === 'string');

function interpolate(s, vars) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
}

/** Translate `key` in the active language. `vars.n` picks a plural form. */
export function t(key, vars = {}, l = lang) {
  let v = lookup(DICTS[l], key);
  if (v === undefined && l !== 'en') {
    warn(`[i18n] missing "${key}" in ${l}`);
    v = lookup(DICTS.en, key);
  }
  if (v === undefined) { warn(`[i18n] missing "${key}"`); return key; }
  if (isPlural(v)) {
    const n = Number(vars.n ?? vars.count ?? 0);
    const cat = new Intl.PluralRules(localeTag(l)).select(n);
    v = v[cat] ?? v.other;
  }
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? interpolate(x, vars) : x));
  return typeof v === 'string' ? interpolate(v, vars) : v;
}

/** Does the key exist (in the active language or English)? */
export const has = (key, l = lang) => lookup(DICTS[l], key) !== undefined || lookup(DICTS.en, key) !== undefined;

/** A list of strings (cues, steps) in the active language. */
export const tList = (key, vars = {}) => {
  const v = t(key, vars);
  return Array.isArray(v) ? v : [];
};

// ---- formatting --------------------------------------------------------------------------

const toDate = (d) => (d instanceof Date ? d : typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d));

/** A date in the active language: fmtDate('2026-10-15', { weekday: 'long' }) → "Thursday" / "jueves". */
export const fmtDate = (d, opts = {}, l = lang) => toDate(d).toLocaleDateString(localeTag(l), opts);

/** A time of day: "14:05". */
export const fmtTime = (d, opts = { hour: '2-digit', minute: '2-digit' }, l = lang) => toDate(d).toLocaleTimeString(localeTag(l), opts);

/** A number with the active language's separators: 1,234.5 / 1234,5. */
export const fmtNum = (n, opts = {}, l = lang) => Number(n || 0).toLocaleString(localeTag(l), opts);

/** "Thursday", capitalised the way a heading wants it (Spanish weekday names are lower case). */
export const capFirst = (s) => (s ? s.charAt(0).toLocaleUpperCase(localeTag()) + s.slice(1) : s);

// ---- checks used by the tests ------------------------------------------------------------

/** Every leaf key in a locale (plural objects count as one leaf). */
export function flatKeys(dict, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(dict || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !isPlural(v)) out.push(...flatKeys(v, key));
    else out.push(key);
  }
  return out;
}

/** The {placeholders} a value uses (all plural forms / list items together). */
export function placeholders(v) {
  const text = isPlural(v) ? Object.values(v).join(' ') : Array.isArray(v) ? v.join(' ') : String(v ?? '');
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

export const dict = (l) => DICTS[l];
export const valueAt = (l, key) => lookup(DICTS[l], key);
