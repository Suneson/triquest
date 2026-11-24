// builder-info.js: a builder's info sheet (the "i" on a hut's menu), laid out like a builder game's hero
// window: on the left the builder in 3D, idling in front of their hut in its painted scene; on the right four
// stat tiles (their ability, what it does, how long it rests, and whether they're working), the job they're
// on with its progress, and who they are; along the bottom the big button that uses the ability (jobs.js
// ABILITIES): used while they're on a job, then resting for its cooldown. Paid for by nothing: the server
// shortens the jobs (use_builder_ability, 0041).

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { ABILITIES, abilityReadyAt, abilityWhyNot, jobOf, progress } from '../core/jobs.js';
import { BUILDERS, hasBuilder } from '../core/builders.js';
import { myBuilds, myAbilityUses, abilitiesOpen, useBuilderAbility, gearError, serverNow, gearState } from './gear-state.js';
import { openLayer } from './nav.js';
import { haptic } from './haptics.js';
import { toast } from './effects.js';
import { timeLeft, face, buildsChanged } from './upgrade-sheet.js';

const HOUR = 3600e3;
/** The background behind the builder: its painted scene, else the hut on grass (styles). */
const scene = (who) => `icons/Builders/scene-${who}.webp`;
const hut = (who) => `icons/Items/builder-${who}-2-a.webp`;
const charOf = (who) => ({ model: `models/chars/mechanic-${who}.glb`, clips: `models/chars/mechanic-${who === 'green' ? 'blue' : who}-clips.glb` });
const jobName = (target) => t(target === 'locker' ? 'cp.room.locker' : `cp.item.${target}`);

/** Open a builder's info sheet. */
export function openBuilderInfo(who) {
  if (!BUILDERS.some((b) => b.who === who)) return null;
  let stage = null;
  const root = openLayer('builder-info', { className: 'mk-layer bi-layer', reuse: false, onClose: () => { clearInterval(tick); stage?.dispose(); } });
  const name = t(`jobs.who.${who}`);
  const a = ABILITIES[who];
  const tile = (k, icon, label, value) => `<li class="bi-stat is-${k}" style="--i:${['ability', 'effect', 'rest', 'status'].indexOf(k)}">
      <span class="bi-stat-ico" aria-hidden="true">${svg(icon)}</span>
      <span class="bi-stat-txt"><small>${esc(label)}</small><b data-bi-v="${k}">${esc(value)}</b></span>
      ${k === 'ability' ? '<i class="bi-bar" data-bi-recharge aria-hidden="true"></i>' : ''}</li>`;
  root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
    <div class="mk-info bi is-${who}" role="dialog" aria-modal="true" aria-labelledby="bi-h">
      <header class="mk-info-head">
        <h2 id="bi-h">${esc(name)}</h2>
        <span class="bi-role">${esc(t(`crewInfo.role.${who}`))}</span>
        <button class="mk-x" data-layer-close aria-label="${esc(t('city.market.close'))}">×</button>
      </header>
      <div class="bi-body">
        <figure class="bi-stage is-${who}" data-bi-stage>
          <img class="bi-bg" src="${scene(who)}" alt="" draggable="false" onerror="this.remove()">
          <img class="bi-hut" src="${hut(who)}" alt="" draggable="false">
          <img class="bi-face" src="${face(who)}" alt="" draggable="false">
        </figure>
        <div class="bi-info">
          <ul class="bi-stats">
            ${tile('ability', 'spark', t('crewInfo.stat.ability'), t(`crewInfo.ability.${who}`))}
            ${tile('effect', 'clock', t('crewInfo.stat.effect'), t(`crewInfo.effect.${who}`))}
            ${tile('rest', 'moon', t('crewInfo.stat.rest'), t('jobs.hours', { n: a.cooldown }))}
            ${tile('status', 'wrench', t('crewInfo.stat.status'), '')}
          </ul>
          <section class="bi-job-card" aria-labelledby="bi-job-h"><h3 id="bi-job-h">${esc(t('crewInfo.jobHead'))}</h3><div data-bi-job></div></section>
          <p class="bi-about">${esc(t(`crewInfo.about.${who}`))}</p>
        </div>
      </div>
      <footer class="bi-foot">
        <p class="bi-does"><b>${esc(t(`crewInfo.ability.${who}`))}:</b> ${esc(t(`crewInfo.does.${who}`))} <span>${esc(t('crewInfo.rest', { t: t('jobs.hours', { n: a.cooldown }) }))}</span></p>
        <div class="bi-use-row" data-bi-use></div>
      </footer>
    </div>`;

  const draw = () => {
    const now = serverNow();
    const jobs = myBuilds(); const inv = gearState().inventory;
    const hired = hasBuilder(BUILDERS.find((b) => b.who === who), inv);
    const job = jobOf(jobs, who, now);
    root.querySelector('[data-bi-job]').innerHTML = !hired
      ? `<p class="bi-note">${esc(t('crewInfo.notHired'))}</p>`
      : job
        ? `<p class="bi-job"><b>${esc(jobName(job.target))}</b> <span>${esc(t('jobs.level', { n: job.to_level }))}</span><i class="data-num">${esc(timeLeft(Math.max(0, Date.parse(job.finishes_at) - now)))}</i></p>
           <i class="bi-bar is-job" style="--f:${progress(job, now).toFixed(3)}" role="progressbar" aria-label="${esc(jobName(job.target))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress(job, now) * 100)}"></i>`
        : `<p class="bi-note">${esc(t('crewInfo.noJob'))}</p>`;
    // the status tile: working, free, or not yours yet (a dot as well as the word, so it's not colour alone)
    const st = !hired ? 'off' : job ? 'busy' : 'free';
    const sv = root.querySelector('[data-bi-v="status"]');
    sv.textContent = t(`crewInfo.status.${st}`); sv.parentElement.parentElement.dataset.st = st;
    const why = !abilitiesOpen() ? 'soon' : abilityWhyNot({ jobs, inventory: inv, uses: myAbilityUses(), who, now });
    const ready = abilityReadyAt(myAbilityUses(), who, now);
    // the ability tile's bar fills back up while it rests
    const f = ready ? 1 - (ready - now) / (a.cooldown * HOUR) : 1;
    root.querySelector('[data-bi-recharge]').style.setProperty('--f', Math.max(0, Math.min(1, f)).toFixed(3));
    root.querySelector('.bi-stat.is-ability').classList.toggle('is-ready', !ready && hired);
    const note = why === 'soon' ? t('crewInfo.soon') : why === 'gear:not_hired' ? t('crewInfo.notHired')
      : why === 'gear:cooldown' ? t('crewInfo.again', { t: timeLeft(ready - now) }) : why === 'gear:idle' ? t('crewInfo.noJobNote') : '';
    // the button is built once and only changed in place, so a tap mid-second isn't lost
    const use = root.querySelector('[data-bi-use]');
    if (!use.firstChild) {
      use.innerHTML = '<button class="mk-up bi-use" data-bi-go><b></b></button><p class="bi-note" role="status" hidden></p>';
      use.querySelector('[data-bi-go]').addEventListener('click', go);
    }
    const btn = use.querySelector('[data-bi-go]');
    if (!busy) btn.disabled = !!why;
    btn.querySelector('b').textContent = why === 'gear:cooldown' ? t('crewInfo.again', { t: timeLeft(ready - now) })
      : t('crewInfo.useName', { name: t(`crewInfo.ability.${who}`) });
    const p = use.querySelector('.bi-note');
    p.hidden = !note || why === 'gear:cooldown' || why === 'gear:not_hired'; p.textContent = note;
  };
  let busy = false;
  const go = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; busy = true; btn.classList.add('is-busy');
    try {
      await useBuilderAbility(who);
      haptic('record');
      toast(esc(t('crewInfo.used', { who: name, name: t(`crewInfo.ability.${who}`) })), { icon: svg('check') });
      stage?.play?.('happy');
      const ab = root.querySelector('.bi-stat.is-ability');
      ab.classList.remove('is-used'); void ab.offsetWidth; ab.classList.add('is-used');
      buildsChanged();
    } catch (err) { toast(esc(gearError(err))); }
    busy = false; btn.classList.remove('is-busy'); draw();
  };
  const tick = setInterval(() => { if (!root.isConnected) clearInterval(tick); else draw(); }, 1000);
  draw();

  // the builder, idling in front of the hut (the face stays if the device can't draw 3D)
  const host = root.querySelector('[data-bi-stage]');
  import('./wardrobe3d.js').then(({ mountWardrobe }) => mountWardrobe(host, { editor: true })).then(async (s) => {
    if (!s || !root.isConnected) { s?.dispose(); return; }
    stage = s;
    const c = charOf(who);
    await s.show(c.model, c.clips, { skin: 'fair', eyes: 'brown' }, []);
    s.setView({ yaw: 0.35, focus: 'body' }); s.setMoving(true);
    host.classList.add('is-3d');
  }).catch(() => {});
  return root;
}
