// shots.mjs — screenshot every tab and modal at iPhone size (390x844) for the
// redesign before/after record. Dev-only: needs Playwright + Chromium, which
// the app itself never loads.
//
// Usage: node tools/serve.mjs 8744 &   then   node tools/shots.mjs <out-dir> [baseUrl]
//
// Two data states are captured: a fresh install (seeded plan, nothing done) and
// a "progressed" athlete whose past bike/run/gym/swim sessions are marked
// completed in localStorage. That fixture exists only inside this headless
// browser so the level HUDs have something to show; it never touches a real
// account (Supabase is unreachable from a local preview anyway).

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('Playwright not found — npm i -g playwright');
}
const { chromium } = loadPlaywright();

const OUT = process.argv[2] || 'docs/redesign/before';
const BASE = process.argv[3] || 'http://localhost:8744/';
const VIEWPORT = { width: 390, height: 844 };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

const errors = [];
async function freshPage({ onboarded = true, tab = 'home', progressed = false } = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tab}: ${e.message}`));
  page.on('console', (m) => {
    // the sandbox can't reach Supabase/Shopify/CDN; those network failures are expected
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|supabase|fetch/i.test(m.text())) errors.push(`${tab}: console: ${m.text()}`);
  });
  await page.addInitScript(({ onboarded, tab }) => {
    if (sessionStorage.getItem('__shots_init')) return;
    sessionStorage.setItem('__shots_init', '1');
    localStorage.clear();
    if (onboarded) localStorage.setItem('moske-onboarded', '1');
    localStorage.setItem('moske-tab', tab);
    sessionStorage.setItem('tq-sync-dismissed', '1');
  }, { onboarded, tab });
  await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
  if (progressed) {
    await page.evaluate(() => {
      const key = 'triquest.v1';
      const s = JSON.parse(localStorage.getItem(key));
      const today = new Date().toISOString().slice(0, 10);
      for (const w of s.workouts) {
        if (w.date < today && ['bike', 'run', 'gym', 'swim', 'brick'].includes(w.type)) {
          w.completed = true; w.completedAt = `${w.date}T18:00:00Z`;
          w.strava_activity_id = 9000000 + Math.floor(Math.random() * 1e6); // as if Strava-verified
        }
      }
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  }
  await page.waitForTimeout(700);
  return { ctx, page };
}

async function shot(page, name) {
  await page.waitForTimeout(450);
  // a template that leaked through un-interpolated shows up as a literal "${"
  const leak = await page.evaluate(() => document.body.innerText.includes('${') || document.body.innerHTML.includes('${svg'));
  if (leak) errors.push(`${name}: un-interpolated template text on screen`);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log('✓', name);
}

// Run a module function inside the page (the app is plain ES modules).
const call = (page, mod, fn, arg) => page.evaluate(async ([mod, fn, arg]) => {
  const m = await import(mod);
  return m[fn](arg);
}, [mod, fn, arg]);

// ---- tabs --------------------------------------------------------------------
for (const [tab, name] of [['home', '01-home'], ['journal', '02-journal'], ['leaderboards', '03-leaderboards'],
  ['shop', '04-shop'], ['progress', '05-profile-cycling']]) {
  const { ctx, page } = await freshPage({ tab });
  await shot(page, name);
  if (tab === 'home') {
    await page.evaluate(() => document.getElementById('view').scrollTo(0, 9999));
    await shot(page, '01b-home-scrolled');
  }
  await ctx.close();
}

// Progressed athlete: Profile HUD at a real level + level carousel + Home rings.
{
  const { ctx, page } = await freshPage({ tab: 'progress', progressed: true });
  await shot(page, '06-profile-cycling-progressed');
  for (const s of ['swim', 'run', 'gym']) {
    await page.click(`.pg-sport[data-sport="${s}"]`);
    await shot(page, `06-profile-${s}`);
  }
  await page.click('.pg-sport[data-sport="bike"]');
  await page.evaluate(() => document.querySelector('[data-action="tab"][data-tab="home"]').click());
  await shot(page, '07-home-progressed');
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.dataset.action = 'open-sport-levels'; b.dataset.sport = 'gym';
    document.body.appendChild(b); b.click(); b.remove();
  });
  await shot(page, '08-modal-level-carousel-gym');
  await page.evaluate(() => document.querySelector('.lvl-frame.is-current .lvl-frame-art')?.click());
  await shot(page, '08b-level-lightbox');
  await ctx.close();
}

// ---- modals --------------------------------------------------------------------
{
  const { ctx, page } = await freshPage({ tab: 'home', progressed: true });
  const openType = async (type, name) => {
    const id = await page.evaluate(async (type) => {
      const s = await import('./js/app/store.js');
      const today = new Date().toISOString().slice(0, 10);
      const ws = s.getWorkouts().filter((w) => w.type === type).sort((a, b) => a.date.localeCompare(b.date));
      const w = ws.find((x) => x.date >= today && (type !== 'gym' || x.exercises?.length)) || ws[0];
      return w?.id;
    }, type);
    if (!id) return;
    await page.evaluate((id) => {
      const b = document.createElement('button');
      b.dataset.action = 'open-workout'; b.dataset.id = id;
      document.body.appendChild(b); b.click(); b.remove();
    }, id);
    await page.waitForTimeout(2600); // let the coach finish typing his line
    await shot(page, name);
    await page.evaluate(() => document.querySelector('.modal-body')?.scrollTo(0, 9999));
    await shot(page, `${name}-scrolled`);
    await page.evaluate(() => { const r = document.getElementById('modal-root'); r.innerHTML = ''; r.classList.remove('open'); });
  };
  await openType('bike', '10-modal-workout-bike');
  await openType('run', '11-modal-workout-run');
  await openType('gym', '12-modal-workout-gym');

  await page.click('#fab');
  await shot(page, '13-modal-editor-new');
  await page.evaluate(() => { const r = document.getElementById('modal-root'); r.innerHTML = ''; r.classList.remove('open'); });

  await page.click('[data-action="edit-goals"]');
  await shot(page, '14-modal-goals');
  await page.evaluate(() => { const r = document.getElementById('modal-root'); r.innerHTML = ''; r.classList.remove('open'); });

  await page.click('#header-avatar');
  await shot(page, '15-fitness-hub');
  await page.evaluate(() => document.querySelector('.fh-screen')?.scrollTo(0, 9999));
  await shot(page, '15b-fitness-hub-scrolled');
  await page.click('[data-fh-cardio]');
  await shot(page, '16-cardio-detail');
  await page.click('[data-fh-hub]');
  await page.click('[data-fh-activity]');
  await shot(page, '17-activity-history');
  await page.click('[data-fh-hub]');
  await page.click('[data-action="open-settings"]');
  await shot(page, '18-settings');
  await page.evaluate(() => document.querySelector('.modal-body')?.scrollTo(0, 9999));
  await shot(page, '18b-settings-scrolled');
  await page.evaluate(() => { const r = document.getElementById('modal-root'); r.innerHTML = ''; r.classList.remove('open'); });

  await call(page, './js/app/auth.js', 'openAuthModal');
  await shot(page, '19-auth');
  await page.evaluate(() => { const r = document.getElementById('modal-root'); r.innerHTML = ''; r.classList.remove('open'); });

  await call(page, './js/app/onboarding.js', 'openOnboarding', {});
  await shot(page, '20-ai-onboarding-step1');
  await page.evaluate(() => { const r = document.getElementById('modal-root'); r.innerHTML = ''; r.classList.remove('open'); });

  await page.evaluate(async () => {
    const { toast } = await import('./js/app/effects.js');
    const { svg } = await import('./js/core/icons.js');
    toast('<b>Quest complete +40 XP</b><br>Finish today’s planned session', { icon: svg('scroll'), duration: 8000 });
  });
  await shot(page, '21-toast');
  await ctx.close();
}

// First-run welcome carousel.
{
  const { ctx, page } = await freshPage({ onboarded: false });
  await shot(page, '22-welcome');
  await ctx.close();
}

await browser.close();
if (errors.length) { console.log('\nPage errors:'); errors.forEach((e) => console.log(' -', e)); }
