// The motion rules (js/core/spring.js): how long things take, which way they ease, where a squash
// starts from, and a drag that keeps its speed when it's let go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DUR, EASE_IN, EASE_OUT, SPRING, zeta, springAt, springSettle, springSamples, springEasing } from '../js/core/spring.js';
import { releaseSpeed, SPEED_MAX } from '../js/core/gesture.js';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);

test('rule 1: a tap, a toggle and a released sheet are done inside 150–300 ms', () => {
  assert.ok(DUR.pressDown + springSettle({ ...SPRING.press, from: 0, to: 1 }, 0.01) <= 400);   // down, then back
  for (const k of ['toggle', 'enter', 'sheetIn']) assert.ok(DUR[k] >= 150 && DUR[k] <= 300, k);
  for (const [name, s] of Object.entries(SPRING)) assert.ok(springSettle({ ...s, from: 0, to: 1 }, 0.01) <= 300, name);
  // a sheet let go 300 px down, still moving away at a fast flick, is home by the ceiling
  assert.ok(springSamples({ ...SPRING.sheetBack, from: 300, to: 0, v0: 1.5 }).duration <= 300);
  assert.ok(DUR.staggerMax <= 150 && DUR.stagger >= 30 && DUR.stagger <= 80);
});

test('rule 2: arriving eases out or springs past; leaving eases in and is shorter', () => {
  assert.equal(EASE_OUT, 'cubic-bezier(0.16, 1, 0.3, 1)');
  assert.equal(EASE_IN, 'cubic-bezier(0.7, 0, 0.84, 0)');
  for (const k of ['exit', 'sheetOut']) assert.ok(DUR[k] >= 100 && DUR[k] <= 180, k);
  assert.ok(DUR.exit < DUR.enter && DUR.sheetOut < DUR.sheetIn);
  // under-damped where something pops, and it shows: the curve goes past 1
  for (const k of ['press', 'pop', 'sheetBack']) {
    assert.ok(zeta(SPRING[k]) < 1, k);
    assert.ok(Math.max(...springSamples({ ...SPRING[k], from: 0, to: 1 }, { rest: 0.01 }).values) > 1.03, k);
  }
  // a sheet flung away doesn't bounce: nothing is there to bounce off
  assert.ok(Math.max(...springSamples({ ...SPRING.sheetAway, from: 0, to: 1 }, { rest: 0.01 }).values) <= 1);
});

test('rule 4: the spring starts where the finger was and at the speed it had', () => {
  const cfg = { ...SPRING.sheetBack, from: 180, to: 0, v0: 0.9 };
  const start = springAt(0, cfg);
  near(start.x, 180); near(start.v, 0.9);
  // let go while moving down: it carries on down for a moment before it turns
  assert.ok(springAt(16, cfg).x > 180);
  // every kind of spring, the same promise
  for (const s of Object.values(SPRING)) { const a = springAt(0, { ...s, from: 5, to: 50, v0: -0.4 }); near(a.x, 5); near(a.v, -0.4); }
  near(springAt(2000, cfg).x, 0, 1e-3);
});

test('rule 4: a spring caught mid-flight and let go again carries straight on', () => {
  const cfg = { ...SPRING.sheetBack, from: 240, to: 0, v0: 0.3 };
  const caught = springAt(70, cfg);
  const resumed = { ...SPRING.sheetBack, from: caught.x, to: 0, v0: caught.v };
  for (const t of [10, 40, 120]) near(springAt(t, resumed).x, springAt(70 + t, cfg).x, 1e-6);
});

test('the speed handed over is kept to what a hand can do', () => {
  assert.equal(releaseSpeed(1.2), 1.2);
  assert.equal(releaseSpeed(40), SPEED_MAX);
  assert.equal(releaseSpeed(-40), -SPEED_MAX);
  assert.equal(releaseSpeed(NaN), 0);
});

test('the stylesheet carries the same numbers', () => {
  const css = read('css/polish.css');
  assert.ok(css.includes(`--ease-out: ${EASE_OUT}`));
  assert.ok(css.includes(`--ease-in: ${EASE_IN}`));
  const pop = springEasing(SPRING.pop); const press = springEasing(SPRING.press);
  assert.ok(css.includes(`--spring-pop: ${pop.easing}`), 'the pop spring in polish.css is not SPRING.pop');
  assert.ok(css.includes(`--spring-press: ${press.easing}`), 'the press spring in polish.css is not SPRING.press');
  assert.ok(css.includes(`--pop-ms: ${pop.duration}ms`) && css.includes(`--press-ms: ${press.duration}ms`));
  assert.ok(css.includes(`--t-exit: ${DUR.exit}ms var(--ease-in)`) && css.includes(`--t-enter: ${DUR.enter}ms var(--ease-out)`));
  assert.ok(css.includes(`--stagger: ${DUR.stagger}ms`));
});

test('nothing in the polish sheet that plays once runs past 300 ms', () => {
  const css = read('css/polish.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const ms = (v) => (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000);
  for (const decl of css.match(/(?:animation|transition)(?:-duration)?\s*:[^;}]+/g) || []) {
    for (const part of decl.slice(decl.indexOf(':') + 1).split(/,(?![^(]*\))/)) {
      if (/infinite/.test(part)) continue;   // what idles in a loop
      const first = part.match(/(?<![\w.-])(\d*\.?\d+m?s)\b/);   // the first time in a part is its duration
      if (first) assert.ok(ms(first[1]) <= 300, `${part.trim()} runs ${first[1]}`);
    }
  }
});

test('rule 3: a button squashes from its foot, a card gives around the finger', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem() {} };
  globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });
  const { pressShape, anchorShift } = await import('../js/app/press.js');
  const button = pressShape(120, 56);
  assert.equal(button.anchor, 'foot');
  assert.ok(button.y < 1 && button.x > 1);   // shorter and wider: a squash, not a shrink
  const rect = { left: 100, top: 400, width: 120, height: 56 };
  const s = anchorShift(button, rect, 150, 420);
  // its bottom edge stays where it is: centre + half the scaled height + the shift
  near(rect.top + rect.height / 2 + (rect.height / 2) * button.y + s.ty, rect.top + rect.height);
  const card = pressShape(340, 120);
  assert.equal(card.anchor, 'finger');
  const c = anchorShift(card, { left: 0, top: 0, width: 340, height: 120 }, 300, 100);
  // the point under the finger doesn't move
  near(170 + (300 - 170) * card.x + c.tx, 300); near(60 + (100 - 60) * card.y + c.ty, 100);
  const css = read('css/polish.css');
  assert.match(css, /\.sh-close \{[^}]*transform-origin: 50% 100%/);
});
