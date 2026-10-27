// base-view.js — "what's next" for the home base (docs/LOOP.md §3), opened from
// the compound's Next button as a sheet: what's building, what you can nearly
// afford, the feat you're closest to and your blueprint. Plain facts; nothing
// here asks you to train on a given day.

import { esc, meter } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { rareById, propById } from '../core/scenes.js';
import { building, nearlyAffordable, closestFeat } from '../core/base.js';
import { blueprintState } from '../core/collections.js';
import { gearById } from '../core/gear.js';
import { gearState, gearEnabled, serverNow, walletNow, refreshGear } from './gear-state.js';
import { featAwards } from './feats-state.js';
import { clockLeft } from './gear-view.js';
import { featValue } from './feats-view.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import * as store from './store.js';

const itemName = (id) => gearById(id)?.name || propById(id)?.name || rareById(id)?.name || id;
const itemSport = (id) => gearById(id)?.sport || propById(id)?.sport || null;

/** One "what next" row: an icon, a line, an optional detail and where it goes. */
const nextRow = ({ icon, head, body, detail = '', action, attrs = '' }) => `<li>
  <button class="hb-next-row" data-action="${action}"${attrs}>
    <span class="hb-next-ico" aria-hidden="true">${icon}</span>
    <span class="hb-next-txt"><small>${head}</small><b>${body}</b>${detail}</span>
    <span class="hb-next-go" aria-hidden="true">${svg('chevron')}</span>
  </button></li>`;

function whatNext(ctx, s, now, wonIds) {
  const rows = [];
  // what's building
  const live = building(s.jobs, now);
  if (live.length) {
    const j = live[0];
    const end = Date.parse(j.finishes_at);
    const more = live.length > 1 ? ` <span class="hb-more">${t('loop.base.more', { n: live.length - 1 })}</span>` : '';
    rows.push(nextRow({ icon: svg('wrench'), head: t('loop.base.building'), action: 'open-gear', attrs: ` data-sport="${itemSport(j.item_id) || 'bike'}"`,
      body: `${esc(itemName(j.item_id))}${more}`, detail: `<span class="hb-next-d"><span data-ws-left="${end}" class="data-num">${clockLeft(end - now)}</span> ${t('loop.ws.leftWord')}</span>` }));
  } else {
    rows.push(nextRow({ icon: svg('wrench'), head: t('loop.base.building'), action: 'open-gear', body: esc(t('loop.base.workshopFree')) }));
  }
  // what's nearly affordable
  const w = walletNow(ctx.workouts);
  const na = nearlyAffordable(s.inventory, s.jobs, w.coins, now);
  if (na.affordable || na.nearest) {
    const n = na.nearest;
    rows.push(nextRow({ icon: svg('coin'), head: t('loop.base.afford'), action: 'open-base', attrs: n ? ` data-sport="${n.item.sport}"` : '',
      body: na.affordable ? esc(t('loop.base.canBuy', { n: na.affordable })) : esc(n.item.name),
      detail: n ? `<span class="hb-next-d">${t('loop.base.short', { name: esc(n.item.name), n: `<b class="data-num">${fmtNum(n.short)}</b>` })}</span>` : '' }));
  }
  // the feat you're closest to
  const cf = closestFeat(ctx.workouts, [...wonIds]);
  if (cf) {
    rows.push(nextRow({ icon: svg('trophy'), head: t('loop.base.feat'), action: 'open-trophies', attrs: ` data-sport="${cf.feat.sport}"`,
      body: esc(cf.feat.name),
      detail: `<span class="hb-next-d">${meter(cf.progress, { segments: 10, cls: 'hb-meter', label: t('feat.ui.nearAria', { best: featValue(cf.feat, cf.nm.best), target: featValue(cf.feat, cf.nm.target) }) })}
        <span>${t('feat.ui.best', { best: `<b class="data-num">${esc(featValue(cf.feat, cf.nm.best))}</b>`, target: esc(featValue(cf.feat, cf.nm.target)) })}</span></span>` }));
  }
  // your blueprint
  const bp = blueprintState(s.quests, s.blueprints, store.getSettings().bpTarget);
  if (bp.target) {
    rows.push(nextRow({ icon: svg('scroll'), head: t('loop.bp.title'), action: 'open-base', attrs: ` data-sport="${bp.target.sport}" data-bp="1"`,
      body: esc(bp.target.name),
      detail: `<span class="hb-next-d">${meter(Math.min(1, bp.free / bp.target.fragments), { segments: 12, cls: 'hb-meter', label: t('loop.bp.progress', { n: Math.min(bp.free, bp.target.fragments), of: bp.target.fragments }) })}
        <span>${bp.left ? t('loop.bp.left', { n: `<b class="data-num">${bp.left}</b>` }) : t('loop.bp.ready')}</span></span>` }));
  } else {
    rows.push(nextRow({ icon: svg('scroll'), head: t('loop.bp.title'), action: 'open-base', attrs: ' data-bp="1"',
      body: esc(t('loop.bp.pickOne')), detail: `<span class="hb-next-d">${t('loop.bp.have', { n: `<b class="data-num">${bp.free}</b>` })}</span>` }));
  }
  return `<section class="hb-next"><ul>${rows.join('')}</ul></section>`;
}

/** The "what's next" sheet. */
export function openWhatNext(ctx) {
  const root = openLayer('what-next');
  const draw = () => {
    const wonIds = new Set(featAwards().map((a) => a.featId));
    root.innerHTML = `<div class="modal-backdrop" data-wn-close></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="wn-h">
        ${sheetHead({ icon: 'target', title: t('loop.base.next'), id: 'wn-h', closeAttr: 'data-wn-close' })}
        <div class="modal-body">${gearEnabled() ? whatNext(ctx, gearState(), serverNow(), wonIds) : `<p class="gw-note">${t('gear.signIn')}</p>`}</div>
      </div>`;
    root.querySelectorAll('[data-wn-close]').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
    // a row goes somewhere: the sheet steps aside first
    root.querySelectorAll('.hb-next-row').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
  };
  draw();
  const tick = setInterval(() => {
    if (!root.isConnected) { clearInterval(tick); return; }
    const now = serverNow();
    let done = false;
    root.querySelectorAll('[data-ws-left]').forEach((el) => {
      const left = Number(el.dataset.wsLeft) - now;
      if (left <= 0) done = true;
      el.textContent = clockLeft(left);
    });
    if (done) { clearInterval(tick); refreshGear().then(() => { if (root.isConnected) draw(); }); }
  }, 1000);
  return root;
}
