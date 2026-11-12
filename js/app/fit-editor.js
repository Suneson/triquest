// fit-editor.js: place each accessory on each body by hand (admins and the demo, from the wardrobe's
// Accessories tab).
//
// The character stands at the top (wardrobe3d.js in editor mode), close up on the head or the feet,
// wearing one piece (and a hair style under glasses or nothing). Sliders move, size and turn the
// piece; each change is kept on this device at once (gear3d.js localFits), so the game shows it
// everywhere here. "Copy fits" puts every fit on the clipboard, to paste into js/core/gear-fit.js.

import { esc } from './ui.js';
import { t } from '../core/i18n.js';
import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { haptic } from './haptics.js';
import { toast } from './effects.js';
import { SLOTS, BODY_LOOKS, ACCESSORY_MODELS, modelFor, clipsFor, gearFor } from '../core/wardrobe.js';
import { cleanFit } from '../core/gear-fit.js';
import { localFits, saveLocalFits, fitFor } from './gear3d.js';

/** The sliders: key, range and step. Moves are in head heights (feet: foot lengths), turns in degrees. */
const SLIDERS = [
  { k: 'y', min: -0.6, max: 0.6, step: 0.005 },
  { k: 'z', min: -0.6, max: 0.6, step: 0.005 },
  { k: 'x', min: -0.4, max: 0.4, step: 0.005 },
  { k: 's', min: 0.5, max: 1.8, step: 0.005 },
  { k: 'rx', min: -60, max: 60, step: 0.5 },
  { k: 'ry', min: -60, max: 60, step: 0.5 },
  { k: 'rz', min: -60, max: 60, step: 0.5 },
];
const VIEWS = { front: 0, three: Math.PI / 4, side: Math.PI / 2, back: Math.PI };
const COVERS = new Set(['hat', 'helmet']);
const ITEMS = SLOTS.filter((s) => s.id !== 'watch').flatMap((s) => s.items.filter((id) => ACCESSORY_MODELS[id]).map((id) => ({ id, slot: s.id })));
const HAIRS = ITEMS.filter((i) => i.slot === 'hair').map((i) => i.id);

const blank = () => ({ x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, rz: 0 });
const shown = (k, v) => (k === 's' ? `×${v.toFixed(3)}` : k.startsWith('r') ? `${v.toFixed(1)}°` : v.toFixed(3));

/** Every fit: the code's, with this device's over it, tidied. */
export function allFits() {
  const out = {};
  for (const b of BODY_LOOKS) {
    out[b] = {};
    for (const { id } of ITEMS) { const f = fitFor(b, id); if (f) out[b][id] = f; }
  }
  return out;
}

/** `look`: the wardrobe's look (its body, outfit, skin and hair colour). `onClose` when done. */
export function openFitEditor(look, { onClose = null } = {}) {
  let stage = null, closed = false;
  const root = openLayer('fit-editor', { className: 'gear-layer wr-layer fe-layer', sheet: true, onClose: () => { closed = true; stage?.dispose(); onClose?.(); } });
  const st = {
    body: look.body,
    item: ITEMS.find((i) => i.slot === 'hat')?.id || ITEMS[0].id,
    hair: look.gear?.hair || '',
    view: 'side', moving: false,
  };
  const slotOf = (id) => ITEMS.find((i) => i.id === id)?.slot;
  const focus = () => (slotOf(st.item) === 'shoes' ? 'feet' : 'head');
  const fit = () => ({ ...blank(), ...(fitFor(st.body, st.item) || {}) });

  const option = (i) => {
    const done = !!fitFor(st.body, i.id);
    return `<option value="${i.id}"${i.id === st.item ? ' selected' : ''}>${done ? '✓ ' : ''}${esc(t(`wardrobe.item.${i.id}`))}</option>`;
  };
  const groups = () => SLOTS.filter((s) => ITEMS.some((i) => i.slot === s.id)).map((s) =>
    `<optgroup label="${esc(t(`wardrobe.slot.${s.id}`))}">${ITEMS.filter((i) => i.slot === s.id).map(option).join('')}</optgroup>`).join('');
  const chip = (attr, v, on, label) => `<button type="button" class="wr-chip${on ? ' is-on' : ''}" ${attr}="${v}" aria-pressed="${on}">${esc(label)}</button>`;

  root.innerHTML = `<div class="fh-screen gw-screen is-shop wr-screen fe-screen" role="dialog" aria-modal="true" aria-labelledby="fe-title">
    ${sheetHead({ title: esc(t('wardrobe.fit.title')), lead: 'back', noLead: true, id: 'fe-title' })}
    <div class="wr-stage fe-stage" data-fe-stage>
      <p class="wr-stage-msg" data-fe-msg>${esc(t('wardrobe.loading'))}</p>
      <div class="fe-views" data-fe-views></div>
    </div>
    <div class="wr-panel fe-panel" data-fe-panel></div>
  </div>`;
  const panel = root.querySelector('[data-fe-panel]');
  const views = root.querySelector('[data-fe-views]');
  const msg = root.querySelector('[data-fe-msg]');

  const drawViews = () => {
    views.innerHTML = Object.keys(VIEWS).map((v) => chip('data-fe-view', v, st.view === v, t(`wardrobe.fit.view.${v}`))).join('')
      + chip('data-fe-move', '1', st.moving, t('wardrobe.fit.move'));
  };
  const drawPanel = () => {
    const f = fit();
    const slot = slotOf(st.item);
    const hairRow = slot === 'hair' || COVERS.has(slot) ? '' : `<label class="fe-pick"><span>${esc(t('wardrobe.fit.hair'))}</span>
        <select data-fe-hair><option value="">${esc(t('wardrobe.none'))}</option>${HAIRS.map((h) => `<option value="${h}"${h === st.hair ? ' selected' : ''}>${esc(t(`wardrobe.item.${h}`))}</option>`).join('')}</select></label>`;
    panel.innerHTML = `<section class="wr-sec">
        <div class="wr-chips">${BODY_LOOKS.map((b) => chip('data-fe-body', b, st.body === b, t(`wardrobe.bodies.${b}`))).join('')}</div>
        <label class="fe-pick"><span>${esc(t('wardrobe.fit.item'))}</span><select data-fe-item>${groups()}</select></label>
        ${hairRow}
      </section>
      <section class="wr-sec fe-sliders">${SLIDERS.map(({ k, min, max, step }) => `<div class="fe-row">
          <span class="fe-label">${esc(t(`wardrobe.fit.key.${k}`))}</span>
          <button type="button" class="fe-step" data-fe-step="${k}:-1" aria-label="${esc(t('wardrobe.fit.less'))}">−</button>
          <input type="range" data-fe-key="${k}" min="${min}" max="${max}" step="${step}" value="${f[k]}" aria-label="${esc(t(`wardrobe.fit.key.${k}`))}">
          <button type="button" class="fe-step" data-fe-step="${k}:1" aria-label="${esc(t('wardrobe.fit.more'))}">+</button>
          <output data-fe-out="${k}">${shown(k, f[k])}</output>
        </div>`).join('')}</section>
      <section class="wr-sec fe-actions">
        <button type="button" class="fe-btn" data-fe-reset>${esc(t('wardrobe.fit.reset'))}</button>
        <button type="button" class="fe-btn is-main" data-fe-copy>${esc(t('wardrobe.fit.copy'))}</button>
        <p class="wr-note">${esc(t('wardrobe.fit.note'))}</p>
        <textarea class="fe-out" data-fe-text readonly hidden></textarea>
      </section>`;
  };

  // the character and the piece
  const dress = () => {
    if (!stage) return;
    const slot = slotOf(st.item);
    const gear = { [slot]: st.item };
    if (slot !== 'hair' && !COVERS.has(slot) && st.hair) gear.hair = st.hair;
    const l = { ...look, body: st.body, gear };
    const owned = [l.outfit];
    stage.show(modelFor(l, owned), clipsFor(l), l, gearFor(l, owned))
      .then(() => { msg.hidden = true; stage.setView({ yaw: VIEWS[st.view], focus: focus() }); stage.setMoving(st.moving); })
      .catch(() => { msg.hidden = false; msg.textContent = t('wardrobe.loadFailed'); });
  };

  /** Keep the piece's fit here and move it on the stage. */
  const setFit = (f) => {
    const local = localFits();
    const clean = cleanFit(f);
    local[st.body] = { ...(local[st.body] || {}) };
    // kept even when it's back at nothing, so it wins over the code's and a reset really resets
    local[st.body][st.item] = clean || {};
    saveLocalFits(local);
    stage?.retune(st.item, clean);
  };
  const setKey = (k, v) => {
    const s = SLIDERS.find((x) => x.k === k);
    const val = Math.min(s.max, Math.max(s.min, Math.round(v / s.step) * s.step));
    const f = { ...fit(), [k]: val };
    setFit(f);
    const input = panel.querySelector(`[data-fe-key="${k}"]`); if (input) input.value = String(val);
    const out = panel.querySelector(`[data-fe-out="${k}"]`); if (out) out.textContent = shown(k, val);
  };

  root.addEventListener('input', (e) => {
    const k = e.target.dataset?.feKey;
    if (k) setKey(k, Number(e.target.value));
  });
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-fe-item]')) { st.item = e.target.value; drawPanel(); dress(); haptic('tick'); }
    if (e.target.matches('[data-fe-hair]')) { st.hair = e.target.value; dress(); }
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.feStep) {
      const [k, dir] = b.dataset.feStep.split(':');
      const s = SLIDERS.find((x) => x.k === k);
      setKey(k, fit()[k] + Number(dir) * s.step * 2); haptic('tick');
    } else if (b.dataset.feBody) { st.body = b.dataset.feBody; drawPanel(); dress(); haptic('tick'); }
    else if (b.dataset.feView) { st.view = b.dataset.feView; drawViews(); stage?.setView({ yaw: VIEWS[st.view] }); haptic('tick'); }
    else if (b.hasAttribute('data-fe-move')) { st.moving = !st.moving; drawViews(); stage?.setMoving(st.moving); haptic('tick'); }
    else if (b.hasAttribute('data-fe-reset')) { setFit(null); drawPanel(); haptic('tick'); }
    else if (b.hasAttribute('data-fe-copy')) {
      const text = JSON.stringify(allFits(), null, 2);
      const area = panel.querySelector('[data-fe-text]');
      area.value = text; area.hidden = false;
      try { await navigator.clipboard.writeText(text); toast(t('wardrobe.fit.copied')); } catch { area.select(); toast(t('wardrobe.fit.copyFail')); }
    }
  });

  drawViews(); drawPanel();
  import('./wardrobe3d.js').then(({ mountWardrobe }) => mountWardrobe(root.querySelector('[data-fe-stage]'), { editor: true })).then((s) => {
    if (closed) { s?.dispose(); return; }
    stage = s;
    if (!stage) { msg.textContent = t('wardrobe.noGl'); return; }
    dress();
  }).catch(() => { msg.textContent = t('wardrobe.loadFailed'); });
  return root;
}
