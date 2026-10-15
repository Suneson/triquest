import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  t, tList, setLang, getLang, pickLang, setWarn, fmtDate, fmtNum, flatKeys, placeholders, dict, valueAt, has,
} from '../js/core/i18n.js';
import { scanAll } from '../tools/i18n-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLURAL = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const isPlural = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && 'other' in v && Object.keys(v).every((k) => PLURAL.has(k));

const sourceFiles = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
  const rel = `${dir}/${d.name}`;
  if (d.isDirectory()) return sourceFiles(rel);
  return d.name.endsWith('.js') ? [rel] : [];
});
const APP = [...sourceFiles('js/app'), ...sourceFiles('js/core')].filter((f) => !f.includes('/locales/'));

// ---- the dictionaries ---------------------------------------------------------------------

test('every English key has a Spanish one, and the other way round', () => {
  const en = new Set(flatKeys(dict('en')));
  const es = new Set(flatKeys(dict('es')));
  const missingEs = [...en].filter((k) => !es.has(k));
  const extraEs = [...es].filter((k) => !en.has(k));
  assert.deepEqual(missingEs, [], `missing in es: ${missingEs.join(', ')}`);
  assert.deepEqual(extraEs, [], `only in es: ${extraEs.join(', ')}`);
});

test('a key uses the same {placeholders} in both languages', () => {
  const bad = flatKeys(dict('en')).filter((k) => placeholders(valueAt('en', k)).join() !== placeholders(valueAt('es', k)).join());
  assert.deepEqual(bad, [], `placeholders differ: ${bad.join(', ')}`);
});

test('plurals have one and other in both; lists have the same length', () => {
  const bad = [];
  for (const k of flatKeys(dict('en'))) {
    const a = valueAt('en', k); const b = valueAt('es', k);
    if (isPlural(a) !== isPlural(b)) bad.push(`${k}: plural in one language only`);
    if (isPlural(a) && !(a.one && b.one && a.other && b.other)) bad.push(`${k}: a plural form is missing`);
    if (Array.isArray(a) !== Array.isArray(b)) bad.push(`${k}: list in one language only`);
    if (Array.isArray(a) && a.length !== b.length) bad.push(`${k}: ${a.length} vs ${b.length} items`);
    if (!isPlural(a) && !Array.isArray(a) && !(typeof a === 'string' && a.trim() && typeof b === 'string' && b.trim())) bad.push(`${k}: empty`);
  }
  assert.deepEqual(bad, []);
});

test('every literal key the code asks for exists', () => {
  const missing = [];
  for (const f of APP) {
    const src = readFileSync(join(ROOT, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    // t('a.b') / tr('a.b') / tList('a.b') / has('a.b') and data-i18n="a.b"
    for (const m of src.matchAll(/\b(?:t|tr|tList|has)\(\s*'([a-z][\w-]*(?:\.[\w-]+)+)'/g)) {
      if (!has(m[1])) missing.push(`${f}: ${m[1]}`);
    }
  }
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) if (!has(m[1])) missing.push(`index.html: ${m[1]}`);
  assert.deepEqual(missing, []);
});

// ---- the render paths ---------------------------------------------------------------------

test('no English reaches a render path without going through t()', () => {
  const hits = scanAll();
  assert.deepEqual(hits.map((h) => `${h.file}:${h.line} ${h.text}`), []);
});

test('nothing shadows t() in a file that translates', () => {
  const bad = [];
  for (const f of APP) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    const imp = src.match(/import \{([^}]*)\} from '[./]+(?:core\/)?i18n\.js'/);
    if (!imp || !imp[1].split(',').some((b) => b.trim() === 't')) continue;
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (/\(\s*t\s*(,[^)]*)?\)\s*=>|\bconst t\b|\blet t\b|\bfunction\s*\w*\s*\(\s*t\s*[,)]/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

// ---- t() itself ---------------------------------------------------------------------------

test('interpolation, plurals, lists', () => {
  setLang('en');
  assert.equal(t('ui.questsClearedSub', { xp: 120, time: '03:10' }), '+120 XP today · new ones in 03:10');
  assert.equal(t('ui.moreToday', { n: 1 }), '+ 1 more session today. See Calendar.');
  assert.equal(t('ui.moreToday', { n: 3 }), '+ 3 more sessions today. See Calendar.');
  assert.equal(tList('date.days').length, 7);
  setLang('es');
  assert.equal(t('ui.moreToday', { n: 1 }), '+ 1 sesión más hoy. Míralo en el calendario.');
  assert.equal(t('ui.moreToday', { n: 2 }), '+ 2 sesiones más hoy. Míralo en el calendario.');
  assert.equal(tList('date.days')[0], 'lunes');
  setLang('en');
});

test('a missing key falls back to English and says so; a key missing everywhere shows itself', () => {
  const warnings = [];
  setWarn((m) => warnings.push(m));
  setLang('es');
  assert.equal(t('nope.not.here'), 'nope.not.here');
  assert.ok(warnings.some((w) => w.includes('nope.not.here')));
  // the fallback path: an English-only key (simulated by asking es for a key es lacks)
  assert.equal(t('app.title', {}, 'xx'), t('app.title', {}, 'en'));
  setLang('en');
  setWarn(() => {});
});

test('the starting language: a saved choice wins, then the device', () => {
  assert.equal(pickLang('es', 'en-GB'), 'es');
  assert.equal(pickLang('en', 'es-ES'), 'en');
  assert.equal(pickLang(undefined, 'es-MX'), 'es');
  assert.equal(pickLang(null, 'sv-SE'), 'en');
  assert.equal(pickLang('fr', 'es'), 'es');
});

test('a language change notifies, and only when it changes', async () => {
  const { onLang } = await import('../js/core/i18n.js');
  const seen = [];
  const off = onLang((l) => seen.push(l));
  setLang('en'); setLang('es'); setLang('es'); setLang('en');
  off();
  assert.deepEqual(seen, ['es', 'en']);
  assert.equal(getLang(), 'en');
});

test('dates and numbers follow the language', () => {
  setLang('en');
  assert.equal(fmtDate('2026-10-15', { weekday: 'long' }), 'Thursday');
  assert.equal(fmtNum(1234.5, { maximumFractionDigits: 1 }), '1,234.5');
  setLang('es');
  assert.equal(fmtDate('2026-10-15', { weekday: 'long' }), 'jueves');
  assert.equal(fmtDate('2026-10-15', { month: 'long' }), 'octubre');
  assert.equal(fmtNum(12.5, { maximumFractionDigits: 1 }), '12,5');
  setLang('en');
});

// ---- data that is translated by id ----------------------------------------------------------

test('exercises: the id stays, the name and cues follow the language, Spanish names match', async () => {
  const { EXERCISES, exerciseById, matchExercise, exName } = await import('../js/core/exercises.js');
  setLang('es');
  const squat = exerciseById('back-squat');
  assert.equal(squat.name, 'Sentadilla trasera');
  assert.equal(squat.nameEn, 'Back Squat');
  assert.equal(squat.cues.length, 3);
  assert.equal(matchExercise('sentadilla búlgara'), 'bulgarian-split-squat');
  assert.equal(matchExercise('Back squat 4x5'), 'back-squat');
  assert.equal(exName({ libId: 'pull-up', name: 'Pull Up' }), 'Dominadas');
  assert.equal(exName({ name: 'My own lift' }), 'My own lift');
  for (const e of EXERCISES) assert.ok(has(`ex.${e.id}.name`), e.id);
  setLang('en');
  assert.equal(exerciseById('back-squat').name, 'Back Squat');
});

test('badges, quests and the coach speak the active language', async () => {
  const { BADGES } = await import('../js/core/badges.js');
  const { questsFor } = await import('../js/core/quests.js');
  const { dayLine } = await import('../js/core/coach-lines.js');
  setLang('es');
  assert.equal(BADGES.find((b) => b.id === 'first-workout').name, 'Primeros pasos');
  const qs = questsFor('2026-10-15', [{ id: 'a', date: '2026-10-15', type: 'run', durationMin: 50, source: 'plan' }], {});
  assert.ok(qs.length && qs.every((q) => has(`quest.${q.id}`) && q.text === t(`quest.${q.id}`)));
  assert.equal(dayLine({ planned: 0, verified: 0, questsDone: 0, questsTotal: 0, streak: 0 }), 'Día de descanso. Recuperar también es entrenar.');
  setLang('en');
});

test('the seeded plan reads in Spanish where it is shown', async () => {
  const { expandPlan, PLAN_PRINCIPLES } = await import('../js/core/plan.js');
  const { planTitle, planNotes, planWord } = await import('../js/core/plan-i18n.js');
  setLang('es');
  const missing = new Set();
  for (const w of expandPlan()) {
    if (planTitle(w.title) === w.title) missing.add(`title: ${w.title}`);
    if (w.notes && planNotes(w.notes) === w.notes) missing.add(`notes: ${w.notes}`);
    for (const p of w.packing || []) if (planWord(p.item) === p.item && p.item !== 'Bodyglide') missing.add(`item: ${p.item}`);
  }
  for (const p of PLAN_PRINCIPLES) if (planWord(p) === p) missing.add(`principle: ${p}`);
  assert.deepEqual([...missing], []);
  assert.equal(planTitle('Easy run (deload)'), 'Rodaje suave (descarga)');
  assert.equal(planTitle('My custom title'), 'My custom title');
  setLang('en');
  assert.equal(planTitle('Easy run (deload)'), 'Easy run (deload)');
});
