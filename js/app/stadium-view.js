// stadium-view.js: the stadium's PVE race (the stadium on the island; rules in js/core/stadium.js).
//
// Seen from above: the boss runs his one lap of the track over the 72 hours, his km over his head.
// Before that, 10 hours of warm-up: he stretches and shows off on the start line, and the clock
// counts down to the start.
// The bar at the top (the HUD's gauge) fills with his km; the clock in the middle of the infield
// counts down to the end. The first time you come in to a race, the boss talks you through it:
// a line at a time, a different pose each, tap to go on. "Talk to <boss>" plays it again.
// The clan robot that races him comes next.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { haptic } from './haptics.js';
import { raceAt, bossKm, clock, INTRO_POSES, WARM_MS } from '../core/stadium.js';

const SEEN_KEY = 'moske-stadium-intro';
const SQUAD = 12;   // until clans queue: the full squad's race
const seen = () => { try { return Number(localStorage.getItem(SEEN_KEY)); } catch { return NaN; } };
const markSeen = (n) => { try { localStorage.setItem(SEEN_KEY, String(n)); } catch { /* private mode */ } };

export function openStadium({ now = () => Date.now() } = {}) {
  let stage = null, talk = null, closed = false, tick = 0;
  const race = raceAt(now());
  const boss = race.boss;
  const poses = boss.poses || INTRO_POSES;
  const total = bossKm(SQUAD);
  const root = openLayer('stadium', {
    className: 'st-layer', sheet: true,
    onClose: () => { closed = true; clearInterval(tick); stage?.dispose(); talk?.dispose(); },
  });

  root.innerHTML = `<div class="fh-screen st-screen" role="dialog" aria-modal="true" aria-labelledby="st-title">
    ${sheetHead({ title: esc(t('stadium.title', { boss: boss.name })), lead: 'back', noLead: true, id: 'st-title' })}
    <div class="st-bar dg-gauge is-km" role="img" data-st-bar>
      <span class="dg-track"><i class="dg-fill"></i><b class="dg-num" data-st-km></b></span>
      <span class="st-bar-ico" aria-hidden="true">${svg('flag')}</span>
    </div>
    <div class="st-stage" data-st-stage>
      <p class="wr-stage-msg" data-st-msg>${esc(t('wardrobe.loading'))}</p>
      <div class="st-clock" data-st-clock aria-live="off"><small data-st-label>${esc(t('stadium.left'))}</small><b class="data-num" data-st-time></b></div>
      <div class="st-tag" data-st-tag hidden><b>${esc(boss.name.split(' ').pop())}</b><span class="data-num" data-st-tagkm></span></div>
    </div>
    <div class="st-foot">
      <p class="st-note">${esc(t('stadium.robotSoon'))}</p>
      <button type="button" class="st-talk" data-st-talk>${svg('chat')}<span>${esc(t('stadium.talk', { boss: boss.name.split(' ').pop() }))}</span></button>
    </div>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const label = $('[data-st-label]'), tagName = $('[data-st-tag] b');
  const bar = $('[data-st-bar]'), kmEl = $('[data-st-km]'), timeEl = $('[data-st-time]'), tag = $('[data-st-tag]'), tagKm = $('[data-st-tagkm]'), clockEl = $('[data-st-clock]');

  // the numbers, once a second
  const update = () => {
    const r = raceAt(now());
    const km = r.p * total;
    bar.style.setProperty('--f', r.p.toFixed(5));
    bar.setAttribute('aria-label', t('stadium.kmAria', { boss: boss.name, km: fmtNum(Math.floor(km)), total }));
    kmEl.textContent = t('stadium.km', { km: km.toFixed(1), total });
    tagKm.textContent = r.warming ? t('stadium.warming') : t('stadium.tagKm', { km: km.toFixed(1) });
    label.textContent = r.warming ? t('stadium.startsIn') : t('stadium.left');
    timeEl.textContent = clock(r.warming ? r.startsIn : r.left);
    stage?.setWarm(r.warming);
    stage?.setLap(r.p);
  };
  update();
  tick = setInterval(update, 1000);

  // the tag over the boss's head and the clock on the infield follow the picture
  const follow = () => {
    if (!stage) return;
    const h = stage.bossHead(); tag.hidden = false;
    tag.style.transform = `translate(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px) translate(-50%, -100%)`;
    const c = stage.centre();
    clockEl.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px) translate(-50%, -50%)`;
  };

  import('./stadium3d.js').then(({ mountStadium }) => mountStadium($('[data-st-stage]'), boss)).then((s) => {
    if (closed) { s?.dispose(); return; }
    stage = s;
    if (!stage) { $('[data-st-msg]').textContent = t('wardrobe.noGl'); return; }
    $('[data-st-msg]').hidden = true;
    stage.onFrame(follow);
    update(); follow();
  }).catch(() => { $('[data-st-msg]').textContent = t('wardrobe.loadFailed'); });

  // ---- the boss's talk ----------------------------------------------------------------------
  const openTalk = () => {
    if (talk || closed) return;
    const box = document.createElement('div');
    box.className = 'st-talkbox';
    box.innerHTML = `<div class="st-boss" data-st-boss></div>
      <div class="st-bubble" role="dialog" aria-live="polite" aria-label="${esc(boss.name)}">
        <b class="st-who">${esc(boss.name)}</b>
        <p data-st-line></p>
        <span class="st-dots" data-st-dots></span>
        <button type="button" class="st-next" data-st-next></button>
      </div>`;
    root.querySelector('.st-screen').append(box);
    let i = 0, fig = null, gone = false;
    const line = box.querySelector('[data-st-line]'), next = box.querySelector('[data-st-next]'), dots = box.querySelector('[data-st-dots]');
    const say = () => {
      line.textContent = t(`stadium.intro.${i}`, { boss: boss.name, total, hours: 72, warm: WARM_MS / 3600e3 });
      dots.innerHTML = poses.map((_, k) => `<i class="${k === i ? 'is-on' : ''}"></i>`).join('');
      next.textContent = i === poses.length - 1 ? t('stadium.go') : t('stadium.next');
      line.classList.remove('is-in'); void line.offsetWidth; line.classList.add('is-in');
      fig?.play(poses[i]);
    };
    const end = () => { gone = true; markSeen(race.n); fig?.dispose(); box.remove(); talk = null; };
    box.addEventListener('click', () => {
      haptic('tick');
      if (i < poses.length - 1) { i++; say(); } else end();
    });
    talk = { dispose: () => { gone = true; fig?.dispose(); } };
    say();
    import('./wardrobe3d.js').then(({ mountWardrobe }) => mountWardrobe(box.querySelector('[data-st-boss]'), { editor: true })).then(async (s) => {
      if (gone || !s) { s?.dispose(); return; }
      fig = s;
      await s.show(boss.model, boss.clips, { skin: 'fair', eyes: 'brown' }, []);
      s.setView({ yaw: 0.25, focus: 'upper' }); s.setMoving(true);
      s.play(poses[i]);
    }).catch(() => {});
  };
  root.addEventListener('click', (e) => { if (e.target.closest('[data-st-talk]')) { haptic('tick'); openTalk(); } });
  if (seen() !== race.n) setTimeout(openTalk, 450);
  return root;
}

const WARN_KEY = 'moske-stadium-warmup';
/**
 * Once a race, while its boss warms up: a note that he is on the track and when the race starts,
 * with a button to go and watch. Called when the island comes up.
 */
export function warmupNotice({ now = () => Date.now() } = {}) {
  const r = raceAt(now());
  if (!r.warming) return;
  try { if (Number(localStorage.getItem(WARN_KEY)) === r.n) return; localStorage.setItem(WARN_KEY, String(r.n)); } catch { /* private mode */ }
  import('./effects.js').then(({ toast }) => toast(esc(t('stadium.warmToast', { boss: r.boss.name, time: clock(r.startsIn) })), {
    duration: 7000, icon: svg('flag'), actionLabel: t('stadium.watch'), onAction: () => openStadium({ now }),
  }));
}
