// i18n-scan.mjs — finds English that reaches the screen without going through
// t(). Used by tests/i18n.test.js and runnable on its own:
//   node tools/i18n-scan.mjs        → lists every hit as file:line  text
//
// It looks at what render code writes: text between tags in a template,
// user-facing attributes (aria-label, placeholder, title, alt), toast() /
// confirm() / alert() calls, and sentence-like string literals. Comments,
// imports and console calls are skipped. A line can opt out with
// `// i18n-ignore` when the English is deliberate (a brand, a unit), and a
// block with `// i18n-ignore-start` … `// i18n-ignore-end` (English that is
// data: what the AI reads, or messages a server sends that we match on).

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// files whose English is not interface text: fixtures and simulated content
// (demo), the plan seed (stored user data, translated at display time by
// plan-i18n), config, the locales themselves, icon/pose drawing data
export const EXEMPT = new Set([
  'js/app/demo.js', 'js/app/config.js', 'js/core/locales/en.js', 'js/core/locales/es.js',
  'js/core/icons.js', 'js/core/plan.js', 'js/core/i18n.js', 'js/core/locales/plan-es.js',
  // the English source of exercise names, cues and aliases (shown through ex.*,
  // muscle.*, equip.*, pose.*; the aliases are for matching free text)
  'js/core/exercises.js', 'js/core/poses.js',
]);

// stored values that are keys, not words on screen (muscle groups, a font name)
const KEYS = new Set(['Full body', 'Segoe UI']);

// words that read the same in both languages, or are brands / units
const ALLOW = /^(MOSKE|Strava|Powered by Strava|LVL|XP|FTP|RPE|ACWR|VO₂|PR|OK|km|mi|kg|min|h|s|bpm|W|kcal|Z\d|[A-Z]{1,3}|[\d\s.,:;×+\-–—/%·()'’"!?…#]+)$/;

const PATTERNS = [
  // text between tags: >Some words<
  { re: />\s*([A-Za-z¡¿][^<>`${}]*?[A-Za-z][^<>`${}]*?)\s*</g, kind: 'text' },
  // text after an interpolation: ${svg('play')} Start<
  { re: /\}\s+([A-Za-z][^<>`${}]*?[a-z][^<>`${}]*?)\s*</g, kind: 'text' },
  // text before an interpolation: >Superset ${…}  /  ${n} exercise${…}
  { re: />\s*([A-Za-z][^<>`${}]*?[a-z][^<>`${}]*?)\s*\$\{/g, kind: 'text' },
  { re: /\$\{[^}]*\}\s+([a-z]{3,}(?: [a-z]+)*)\$\{/g, kind: 'text' },
  // user-facing attributes with a literal value
  { re: /\b(?:aria-label|placeholder|title|alt)="([A-Za-z][^"$]*)"/g, kind: 'attr' },
  // toast / confirm / alert / prompt with a literal first argument
  { re: /\b(?:toast|confirm|alert|prompt)\(\s*(['`])([A-Za-z][^'`$]*)\1/g, kind: 'call', group: 2 },
  // sentence-like literals: a capital, a space and a lower-case word
  { re: /(['`])([A-Z][a-z’']*(?: [a-zA-Z’'][^'`$<>{}\n]*)+)\1/g, kind: 'literal', group: 2 },
];

const strip = (line) => line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');

function walk(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) return walk(rel);
    return d.name.endsWith('.js') ? [rel] : [];
  });
}

export function scanFile(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8').split('\n');
  const hits = [];
  let inBlock = false;
  let ignoring = false;
  src.forEach((raw, i) => {
    let line = raw;
    if (raw.includes('i18n-ignore-start')) { ignoring = true; return; }
    if (raw.includes('i18n-ignore-end')) { ignoring = false; return; }
    if (ignoring) return;
    if (inBlock) { if (line.includes('*/')) { inBlock = false; line = line.slice(line.indexOf('*/') + 2); } else return; }
    if (/^\s*\/\*/.test(line) && !line.includes('*/')) { inBlock = true; return; }
    if (/^\s*(\*|\/\/|import |export \{|console\.)/.test(line) || raw.includes('i18n-ignore')) return;
    line = strip(line);
    for (const p of PATTERNS) {
      for (const m of line.matchAll(p.re)) {
        const text = (m[p.group || 1] || '').trim();
        if (!text || ALLOW.test(text) || KEYS.has(text)) continue;
        // code that happens to sit between a > and a < (comparisons, arrow functions)
        if (p.kind === 'text' && /\w\(|\)\s*[.;?:]|=>|&&|\|\||\bMath\.|\w\.\w|\s[-+*]\s\w|^[a-z]+ [-+*]/.test(text)) continue;
        // ids, keys, selectors, class lists and URLs are not words for people
        if (/^[a-z0-9_.:/-]+$/.test(text) || /[=[\]]/.test(text) || /^(https?:|data:|#)/.test(text)) continue;
        if (p.kind === 'literal' && /^(Content-|Bearer |Authorization|Accept)/.test(text)) continue;
        hits.push({ file: rel, line: i + 1, kind: p.kind, text });
      }
    }
  });
  return hits;
}

export function scanAll() {
  return [...walk('js/app'), ...walk('js/core')].filter((f) => !EXEMPT.has(f)).flatMap(scanFile);
}

if (process.argv[1] && process.argv[1].endsWith('i18n-scan.mjs')) {
  const hits = scanAll();
  for (const h of hits) console.log(`${h.file}:${h.line}  [${h.kind}]  ${h.text}`);
  console.log(`\n${hits.length} untranslated`);
}
