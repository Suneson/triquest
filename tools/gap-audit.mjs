// gap-audit.mjs — measures the visible gap between neighbouring framed boxes
// (panels, cards, buttons, chips…) on every tab and reports any closer than
// the DESIGN.md minimum (16px). Visible = the box plus its 2px pixel border and
// its hard drop edge, which is how the eye reads the spacing.
//
// Usage: node tools/serve.mjs 8744 &  then  node tools/gap-audit.mjs [width] [query]

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('Playwright not found — npm i -g playwright');
}
const { chromium } = loadPlaywright();

const WIDTH = Number(process.argv[2]) || 390;
const QUERY = process.argv[3] || '?demo=1';
const MIN = 16;
// Segmented controls and chip runs read as one unit; their cells may sit closer.
const FRAMED = ['.card', '.dlg', '.btn', '.chip', '.tag', '.lb-row', '.shop-card', '.exercise', '.struct-row',
  '.move-pill', '.avp', '.ah-row', '.cs-row', '.pc-stat', '.lb-countdown', '.lb-banner', '.race-banner'];

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await (await browser.newContext({ viewport: { width: WIDTH, height: 844 }, serviceWorkers: 'block' })).newPage();
await page.addInitScript(() => { localStorage.setItem('moske-onboarded', '1'); sessionStorage.setItem('tq-sync-dismissed', '1'); });
await page.goto(`http://localhost:8744/${QUERY}`);
await page.waitForTimeout(800);

let total = 0;
for (const tab of ['home', 'journal', 'leaderboards', 'shop']) {
  await page.click(`.tab[data-tab="${tab}"]`);
  await page.waitForTimeout(700);
  const found = await page.evaluate(({ sel, min }) => {
    const view = document.getElementById('view');
    const els = [...view.querySelectorAll(sel.join(','))].filter((e) => e.offsetParent);
    const vis = els.map((e) => {
      const r = e.getBoundingClientRect();
      const eo = parseFloat(getComputedStyle(e).getPropertyValue('--eo')) || 4;
      return { e, l: r.left - 2, r: r.right + 2, t: r.top - 2, b: r.bottom + Math.max(2, eo - 2) };
    });
    const out = [];
    for (let i = 0; i < vis.length; i++) {
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i]; const b = vis[j];
        if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
        const xOverlap = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const yOverlap = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        let gap = null;
        if (xOverlap > 0) gap = Math.max(b.t - a.b, a.t - b.b);
        else if (yOverlap > 0) gap = Math.max(b.l - a.r, a.l - b.r);
        if (gap != null && gap < min) {
          const name = (x) => `${x.e.tagName.toLowerCase()}.${[...x.e.classList].slice(0, 2).join('.')}`;
          out.push(`${name(a)} ↔ ${name(b)}: ${Math.round(gap)}px`);
        }
      }
    }
    return [...new Set(out)];
  }, { sel: FRAMED, min: MIN });
  total += found.length;
  console.log(`${tab}: ${found.length ? `${found.length} too close` : 'ok'}`);
  found.slice(0, 12).forEach((f) => console.log(`   ${f}`));
}
await browser.close();
console.log(total ? `\n${total} pairs closer than ${MIN}px` : `\nall framed boxes ≥ ${MIN}px apart`);
