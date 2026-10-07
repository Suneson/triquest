// moments.mjs — drives the feedback moments end to end in a headless browser:
// quest accepted (editor save), Strava verification (XP pops + quest toast), a
// burst of verified gym history (level-up sheet), and the reduce-motion switch.
// Dev-only. Usage: node tools/serve.mjs 8744 &  then  node tools/moments.mjs <out-dir>
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('Playwright not found — npm i -g playwright');
}
const { chromium } = loadPlaywright();
const OUT = process.argv[2] || 'docs/redesign/after/moments';
await mkdir(OUT, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem('i')) { sessionStorage.setItem('i', '1'); localStorage.clear(); localStorage.setItem('moske-onboarded', '1'); sessionStorage.setItem('tq-sync-dismissed', '1'); } });
await p.goto('http://localhost:8744/'); await p.waitForTimeout(900);

// 1) quest accepted: add a session through the editor
await p.click('#fab'); await p.waitForTimeout(300);
await p.fill('[data-field="title"]', 'Test tempo run');
await p.click('[data-do="save"]'); await p.waitForTimeout(500);
console.log('accepted toast:', await p.locator('.toast').first().innerText().catch(() => 'none'));
await p.screenshot({ path: `${OUT}/m1-quest-accepted.png` });
await p.waitForTimeout(4200);

// 2) Strava verifies today's sessions → XP pop + quest toasts
const before = await p.evaluate(() => [...document.querySelectorAll('.q-row')].map((r) => r.dataset.quest + ':' + r.classList.contains('done')));
console.log('quests before:', before.join(' '));
const pops = [];
await p.exposeFunction('notePop', (t) => pops.push(t));
await p.evaluate(() => new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList?.contains('xp-pop')) window.notePop(n.textContent); }))).observe(document.body, { childList: true }));
await p.evaluate(async () => {
  const s = await import('./js/app/store.js');
  const { todayISO } = await import('./js/core/dates.js');
  const t = todayISO();
  s.getWorkouts().filter((w) => w.date === t).forEach((w, i) => { w.completed = true; w.strava_activity_id = 7000 + i; w.durationMin = Math.max(w.durationMin, 30); });
  s.commit();
});
await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/m2-verified.png` });
await p.waitForTimeout(1200);
const after = await p.evaluate(() => [...document.querySelectorAll('.q-row')].map((r) => r.dataset.quest + ':' + r.classList.contains('done')));
console.log('quests after:', after.join(' '));
console.log('xp pops:', pops.join(', '));
console.log('toasts:', (await p.locator('.toast').allInnerTexts()).map((x) => x.replace(/\n/g, ' ')).join(' | '));
await p.screenshot({ path: `${OUT}/m3-quest-complete.png` });

// 3) a burst of verified gym history → gym level-up sheet
await p.evaluate(async () => {
  const s = await import('./js/app/store.js');
  let n = 0;
  for (let i = 1; i <= 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    s.getWorkouts().push({ id: `lu-${i}`, date: iso, type: 'gym', title: 'Strength', intensity: 'moderate', durationMin: 60, metrics: {}, completed: true, strava_activity_id: 8000 + i, source: 'strava', segments: [], exercises: [], packing: [], notes: '' });
    n++;
  }
  s.commit();
});
await p.waitForTimeout(2200);
console.log('level-up sheet:', await p.locator('.lvlup h2').innerText().catch(() => 'none'));
await p.screenshot({ path: `${OUT}/m4-level-up.png` });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/m5-level-up-typed.png` });

// 4) reduced motion switch
await p.evaluate(async () => { (await import('./js/app/store.js')).setSetting('reduceMotion', true); });
console.log('body.rm:', await p.evaluate(() => document.body.classList.contains('rm')));
console.log('errors:', errs.length ? errs.join(' / ') : 'none');
await b.close();
