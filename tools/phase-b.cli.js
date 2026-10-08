// phase-b.cli.js — Phase B motion checks + clips, run inside playwright-cli:
//   playwright-cli open --config=<cfg> --device="iPhone 15" http://localhost:8744/
//   playwright-cli run-code --filename=tools/phase-b.cli.js
// Asserts the feel layer works and returns a report; clips are recorded around
// it with video-start / video-stop.
async (page) => {
  const BASE = 'http://localhost:8744/';
  const out = {};
  await page.goto(BASE + '?demo=1');
  await page.evaluate(() => { localStorage.setItem('moske-onboarded', '1'); sessionStorage.setItem('tq-sync-dismissed', '1'); });
  await page.goto(BASE + '?demo=1');
  await page.waitForTimeout(800);

  // B1 — a view transition runs on tab change
  out.vtSupported = await page.evaluate(() => typeof document.startViewTransition === 'function');
  await page.evaluate(() => {
    window.__vt = 0;
    const orig = document.startViewTransition.bind(document);
    document.startViewTransition = (cb) => { window.__vt++; return orig(cb); };
  });
  await page.click('.tab[data-tab="journal"]');
  await page.waitForTimeout(400);
  out.vtOnTab = await page.evaluate(() => window.__vt);

  // B2 — meters: first sight fills from empty, unchanged re-render animates nothing
  await page.click('.tab[data-tab="home"]');
  await page.waitForTimeout(400);
  out.segNewFirst = await page.evaluate(() => document.querySelectorAll('.meter i.seg-new').length);
  await page.click('.tab[data-tab="journal"]'); await page.waitForTimeout(300);
  await page.click('.tab[data-tab="home"]'); await page.waitForTimeout(300);
  out.segNewUnchanged = await page.evaluate(() => document.querySelectorAll('.meter i.seg-new').length);

  // B2 — a value change rolls: verify one of this week's sessions, re-render
  const before = await page.evaluate(() => document.querySelector('[data-roll-key="goal-sessions"]')?.textContent);
  await page.evaluate(async () => {
    const s = await import('./js/app/store.js');
    const { todayISO, addDays } = await import('./js/core/dates.js');
    const t = todayISO();
    const w = s.getWorkouts().find((x) => !x.completed && x.date <= t && x.date >= addDays(t, -6) && x.type !== 'rest');
    if (w) s.updateWorkout ? s.updateWorkout(w.id, { completed: true, completedAt: new Date().toISOString(), strava_activity_id: 1 }) : null;
  });
  await page.waitForTimeout(700);
  out.rollBeforeAfter = [before, await page.evaluate(() => document.querySelector('[data-roll-key="goal-sessions"]')?.textContent)];

  // B3 — skeleton is shown before data (delay the RPC route), same height as rows
  await page.goto(BASE);
  await page.waitForTimeout(500);
  await page.click('.tab[data-tab="leaderboards"]');
  out.skRows = await page.evaluate(() => document.querySelectorAll('.lb-row.is-sk').length);
  out.skRowH = await page.evaluate(() => Math.round(document.querySelector('.lb-row.is-sk')?.getBoundingClientRect().height || 0));
  await page.goto(BASE + '?demo=1'); await page.waitForTimeout(500);
  await page.click('.tab[data-tab="leaderboards"]'); await page.waitForTimeout(400);
  out.realRowH = await page.evaluate(() => Math.round(document.querySelector('.lb-row:not(.is-sk)')?.getBoundingClientRect().height || 0));

  // B4 — busy state on a button
  out.busy = await page.evaluate(async () => {
    const { busy } = await import('./js/app/motion.js');
    const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Sync';
    document.getElementById('view').prepend(b);
    let during;
    await busy(b, async () => { during = [b.getAttribute('aria-busy'), b.disabled]; });
    const after = [b.getAttribute('aria-busy'), b.disabled]; b.remove();
    return { during, after };
  });
  return JSON.stringify(out);
}
