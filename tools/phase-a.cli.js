// phase-a.cli.js — Phase A capture, run inside playwright-cli (iPhone 15 device):
//   playwright-cli open --config=<cfg> --device="iPhone 15" http://localhost:8744/
//   playwright-cli run-code --filename=tools/phase-a.cli.js
// Shoots every tab at 320/390/430 (with ?demo=1 so Ranks and Shop have data),
// the Run/Gym/Swim stage, and the ?safe=34 shell, into docs/redesign/after/phase-a.
async (page) => {
  const OUT = '/home/user/triquest/docs/redesign/after/phase-a';
  const BASE = 'http://localhost:8744/';
  const log = [];
  const prime = async (query) => {
    await page.goto(BASE + query);
    await page.evaluate(() => {
      localStorage.setItem('moske-onboarded', '1');
      sessionStorage.setItem('tq-sync-dismissed', '1');
      const key = 'triquest.v1';
      const s = JSON.parse(localStorage.getItem(key) || 'null');
      if (!s) return;
      const today = new Date().toISOString().slice(0, 10);
      let i = 0;
      for (const w of s.workouts) {
        if (w.date < today && ['bike', 'run', 'gym', 'swim', 'brick'].includes(w.type)) {
          w.completed = true; w.completedAt = `${w.date}T18:00:00Z`; w.strava_activity_id = 9000000 + i++;
        }
      }
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.goto(BASE + query);
    await page.waitForTimeout(900);
  };
  const tab = async (t) => { await page.click(`.tab[data-tab="${t}"]`); await page.waitForTimeout(700); };
  const shot = async (name) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${name}.png` }); log.push(name); };

  for (const w of [320, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 });
    await prime('?demo=1');
    for (const [t, n] of [['home', 'home'], ['journal', 'journal'], ['leaderboards', 'ranks'], ['shop', 'shop']]) {
      await tab(t); await shot(`${w}-${n}`);
    }
    await tab('progress');
    for (const s of ['run', 'gym', 'swim']) {
      await page.click(`.pg-sport[data-sport="${s}"]`); await page.waitForTimeout(500); await shot(`${w}-profile-${s}`);
    }
  }
  // iPhone home-indicator inset: bar must reach the bottom edge with no gap
  await page.setViewportSize({ width: 390, height: 844 });
  await prime('?demo=1&safe=34');
  await tab('home'); await shot('390-safe34-home');
  await tab('progress'); await shot('390-safe34-profile');
  const m = await page.evaluate(() => {
    const r = document.querySelector('.tabs').getBoundingClientRect();
    const tiny = [...document.querySelectorAll('.btn.tiny, .icon-btn.tiny')].slice(0, 1);
    return { tabsBottom: r.bottom, tabsH: r.height, vh: innerHeight };
  });
  log.push(JSON.stringify(m));
  return log.join('\n');
}
