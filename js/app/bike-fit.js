// bike-fit.js: set how the athlete sits on the bike, by hand (admins and the demo, from the
// wardrobe's Accessories tab, under "Fit accessories").
//
// The bike and your athlete pedal at the top (bike-rider.js); sliders move the seat, the back, the
// shoulders, the hands and the feet, and close the hands round the bar. Each change is kept on this
// device at once. "Copy fit" puts the fit on the clipboard, to paste into js/core/bike-fit.js.
// The pose is one per body and fits every bike; a bike that sits a little off gets its own nudge.

import { esc } from './ui.js';
import { t } from '../core/i18n.js';
import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { haptic } from './haptics.js';
import { toast } from './effects.js';
import { BODY_LOOKS, modelFor, skinTint, eyeColour, hairColour } from '../core/wardrobe.js';
import { BIKE_LEVELS, BIKE_FIT, DEFAULT_POSE, cleanPose, cleanNudge } from '../core/bike-fit.js';

const LOCAL = 'moske-bike-fit';
const cm = { min: -0.25, max: 0.25, step: 0.005, unit: 'cm' };
const deg = (min, max) => ({ min, max, step: 0.5, unit: 'deg' });
const part = { min: 0, max: 1, step: 0.01, unit: '%' };
/** The sliders, in groups. */
const GROUPS = [
  ['seat', { seatF: cm, seatU: { ...cm, min: -0.1, max: 0.2 } }],
  ['back', { lean: deg(0, 85), headUp: deg(-20, 80) }],
  ['shoulders', { shDown: { ...cm, min: -0.1, max: 0.15 }, shFwd: { ...cm, min: -0.1, max: 0.15 } }],
  ['hands', { handF: cm, handU: cm, handW: { ...cm, min: -0.15, max: 0.15 }, elbowOut: { ...part, min: -1 }, elbowDown: { ...part, min: -1 } }],
  ['wrists', { wristB: deg(-80, 80), wristT: deg(-90, 90), wristS: deg(-60, 60) }],
  ['grip', { grip: { ...part, min: -0.3 }, thumb: { ...part, min: -0.5 } }],
  ['feet', { footF: cm, footU: { ...cm, min: -0.05, max: 0.2 }, toeU: { ...cm, min: -0.12, max: 0.12 }, kneeOut: { ...cm, min: -0.15, max: 0.15 } }],
  ['speed', { rpm: { min: 20, max: 120, step: 1, unit: 'rpm' } }],
];
const NUDGE = { x: { ...cm, min: -0.15, max: 0.15 }, y: { ...cm, min: -0.15, max: 0.15 }, z: { ...cm, min: -0.15, max: 0.15 }, s: { min: 0.8, max: 1.2, step: 0.005, unit: 'x' } };
const SLIDER = Object.assign({}, ...GROUPS.map(([, g]) => g));
/** Where the camera looks from: [yaw round from the rider's right, tilt down] in degrees, how much
 * it shows (half its height, metres), and what it looks at (the whole bike, or close on the hands). */
const VIEWS = { side: [0, 0, 0.98], front: [90, 0, 0.98], back: [-90, 8, 0.98], game: [45, 34.2, 1.05], hands: [35, 18, 0.3, 'hands'] };

const shown = (s, v) => s.unit === 'cm' ? `${(v * 100).toFixed(1)} cm` : s.unit === 'deg' ? `${v.toFixed(1)}°`
  : s.unit === '%' ? `${Math.round(v * 100)}%` : s.unit === 'x' ? `×${v.toFixed(3)}` : `${Math.round(v)}`;

function local() { try { return JSON.parse(localStorage.getItem(LOCAL)) || {}; } catch { return {}; } }
function saveLocal(v) { try { localStorage.setItem(LOCAL, JSON.stringify(v)); } catch { /* full or blocked */ } }

/** The pose in use for a body: this device's, else the one in the code. */
export function bikePose(body) {
  const mine = local().pose?.[body];
  return { ...DEFAULT_POSE, ...(mine || BIKE_FIT.pose[body] || {}) };
}
/** One bike's nudge: { x, y, z, s }. */
export function bikeNudge(level) {
  const mine = local().bikes?.[level];
  return { x: 0, y: 0, z: 0, s: 1, ...(mine || BIKE_FIT.bikes[level] || {}) };
}
/** Everything, tidied, for js/core/bike-fit.js. */
function allFits() {
  const pose = {}, bikes = {};
  for (const b of BODY_LOOKS) { const c = cleanPose(bikePose(b)); if (Object.keys(c).length) pose[b] = c; }
  for (const lv of BIKE_LEVELS) { const c = cleanNudge(bikeNudge(lv)); if (c) bikes[lv] = c; }
  return { pose, bikes };
}

/** `look`: the wardrobe's look. */
export function openBikeFit(look) {
  let stage = null, closed = false;
  const root = openLayer('bike-fit', { className: 'gear-layer wr-layer fe-layer', sheet: true, onClose: () => { closed = true; stage?.dispose(); } });
  const st = { body: BODY_LOOKS.includes(look.body) ? look.body : BODY_LOOKS[0], level: BIKE_LEVELS[BIKE_LEVELS.length - 1], view: 'side', playing: true };
  const chip = (attr, v, on, label) => `<button type="button" class="wr-chip${on ? ' is-on' : ''}" ${attr}="${v}" aria-pressed="${on}">${esc(label)}</button>`;
  const row = (k, s, v, attr) => `<div class="fe-row">
      <span class="fe-label">${esc(t(`wardrobe.bikeFit.key.${k}`))}</span>
      <button type="button" class="fe-step" data-bf-step="${attr}:${k}:-1" aria-label="${esc(t('wardrobe.fit.less'))}">−</button>
      <input type="range" data-bf-${attr}="${k}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}" aria-label="${esc(t(`wardrobe.bikeFit.key.${k}`))}">
      <button type="button" class="fe-step" data-bf-step="${attr}:${k}:1" aria-label="${esc(t('wardrobe.fit.more'))}">+</button>
      <output data-bf-out="${attr}:${k}">${shown(s, v)}</output>
    </div>`;

  root.innerHTML = `<div class="fh-screen gw-screen is-shop wr-screen fe-screen" role="dialog" aria-modal="true" aria-labelledby="bf-title">
    ${sheetHead({ title: esc(t('wardrobe.bikeFit.title')), lead: 'back', noLead: true, id: 'bf-title' })}
    <div class="wr-stage fe-stage bf-stage" data-bf-stage>
      <p class="wr-stage-msg" data-bf-msg>${esc(t('wardrobe.loading'))}</p>
      <div class="fe-views" data-bf-views></div>
    </div>
    <div class="wr-panel fe-panel" data-bf-panel></div>
  </div>`;
  const panel = root.querySelector('[data-bf-panel]');
  const views = root.querySelector('[data-bf-views]');
  const msg = root.querySelector('[data-bf-msg]');

  const drawViews = () => {
    views.innerHTML = Object.keys(VIEWS).map((v) => chip('data-bf-view', v, st.view === v, t(`wardrobe.bikeFit.view.${v}`))).join('')
      + chip('data-bf-play', '1', st.playing, t('wardrobe.bikeFit.play'));
  };
  const drawPanel = () => {
    const p = bikePose(st.body), n = bikeNudge(st.level);
    panel.innerHTML = `<section class="wr-sec">
        <div class="wr-chips">${BODY_LOOKS.map((b) => chip('data-bf-body', b, st.body === b, t(`wardrobe.bodies.${b}`))).join('')}</div>
        <label class="fe-pick"><span>${esc(t('wardrobe.bikeFit.bike'))}</span><select data-bf-level>${BIKE_LEVELS.map((lv) =>
          `<option value="${lv}"${lv === st.level ? ' selected' : ''}>${esc(t('wardrobe.bikeFit.level', { n: lv }))}</option>`).join('')}</select></label>
      </section>
      ${GROUPS.map(([g, keys]) => `<section class="wr-sec fe-sliders"><h3>${esc(t(`wardrobe.bikeFit.group.${g}`))}</h3>
        ${Object.entries(keys).map(([k, s]) => row(k, s, p[k], 'key')).join('')}</section>`).join('')}
      <section class="wr-sec fe-sliders"><h3>${esc(t('wardrobe.bikeFit.group.bike', { n: st.level }))}</h3>
        <p class="wr-note">${esc(t('wardrobe.bikeFit.bikeNote'))}</p>
        ${Object.entries(NUDGE).map(([k, s]) => row(k, s, n[k], 'nudge')).join('')}</section>
      <section class="wr-sec fe-actions">
        <button type="button" class="fe-btn" data-bf-reset>${esc(t('wardrobe.bikeFit.reset'))}</button>
        <button type="button" class="fe-btn is-main" data-bf-copy>${esc(t('wardrobe.bikeFit.copy'))}</button>
        <p class="wr-note">${esc(t('wardrobe.bikeFit.note'))}</p>
        <textarea class="fe-out" data-bf-text readonly hidden></textarea>
      </section>`;
  };

  const set = (attr, k, v) => {
    const s = attr === 'key' ? SLIDER[k] : NUDGE[k];
    const val = Math.min(s.max, Math.max(s.min, Math.round(v / s.step) * s.step));
    const l = local();
    if (attr === 'key') { l.pose = { ...(l.pose || {}) }; l.pose[st.body] = { ...bikePose(st.body), [k]: val }; }
    else { l.bikes = { ...(l.bikes || {}) }; l.bikes[st.level] = { ...bikeNudge(st.level), [k]: val }; }
    saveLocal(l);
    const input = panel.querySelector(`[data-bf-${attr}="${k}"]`); if (input) input.value = String(val);
    const out = panel.querySelector(`[data-bf-out="${attr}:${k}"]`); if (out) out.textContent = shown(s, val);
    stage?.refit();
  };
  const current = (attr, k) => (attr === 'key' ? bikePose(st.body)[k] : bikeNudge(st.level)[k]);

  root.addEventListener('input', (e) => {
    const d = e.target.dataset || {};
    if (d.bfKey) set('key', d.bfKey, Number(e.target.value));
    if (d.bfNudge) set('nudge', d.bfNudge, Number(e.target.value));
  });
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-bf-level]')) { st.level = Number(e.target.value); drawPanel(); stage?.show(); haptic('tick'); }
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    const d = b.dataset;
    if (d.bfStep) {
      const [attr, k, dir] = d.bfStep.split(':');
      const s = attr === 'key' ? SLIDER[k] : NUDGE[k];
      set(attr, k, current(attr, k) + Number(dir) * s.step * 2); haptic('tick');
    } else if (d.bfBody) { st.body = d.bfBody; drawPanel(); stage?.show(); haptic('tick'); }
    else if (d.bfView) { st.view = d.bfView; drawViews(); stage?.setView(); haptic('tick'); }
    else if (b.hasAttribute('data-bf-play')) { st.playing = !st.playing; drawViews(); stage?.refit(); haptic('tick'); }
    else if (b.hasAttribute('data-bf-reset')) {
      const l = local();
      if (l.pose) delete l.pose[st.body];
      if (l.bikes) delete l.bikes[st.level];
      saveLocal(l); drawPanel(); stage?.refit(); haptic('tick');
    } else if (b.hasAttribute('data-bf-copy')) {
      const text = JSON.stringify(allFits(), null, 2);
      const area = panel.querySelector('[data-bf-text]');
      area.value = text; area.hidden = false;
      try { await navigator.clipboard.writeText(text); toast(t('wardrobe.bikeFit.copied')); } catch { area.select(); toast(t('wardrobe.fit.copyFail')); }
    }
  });

  drawViews(); drawPanel();
  mountStage(root.querySelector('[data-bf-stage]'), look, st).then((s) => {
    if (closed) { s?.dispose(); return; }
    stage = s;
    if (!stage) { msg.textContent = t('wardrobe.noGl'); return; }
    stage.show().then(() => { msg.hidden = true; }).catch(() => { msg.textContent = t('wardrobe.loadFailed'); });
  }).catch(() => { msg.textContent = t('wardrobe.loadFailed'); });
  return root;
}

/** The 3D stage: the bike and the rider, a camera that turns round them. */
async function mountStage(host, look, st) {
  const { loadThree, webglOk } = await import('./runner3d.js');
  if (!webglOk()) return null;
  const [L, { spawnChar, letGo }, { loadBike, poseRider }, { addView, ratio }] = await Promise.all([
    loadThree(), import('./char3d.js'), import('./bike-rider.js'), import('./gl-shared.js')]);
  const { THREE } = L;
  const canvas = document.createElement('canvas');
  canvas.className = 'wr-canvas';
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x2a3550, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-1.6, 3, 2.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc4ff, 1.1); rim.position.set(2, 2.2, -2); scene.add(rim);
  const floor = new THREE.GridHelper(4, 40, 0x6ea8ff, 0x2a3e6e); floor.material.transparent = true; floor.material.opacity = 0.35; scene.add(floor);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const uniforms = { uSkin: { value: new THREE.Vector3(...skinTint(look.skin)) }, uEye: { value: new THREE.Vector3(...eyeColour(look.eyes)) } };
  const hold = new THREE.Group(); scene.add(hold);
  let bike = null, figure = null, want = '', angle = 0, yaw = 0, drag = null, gone = false;

  const fit = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1, r = ratio();
    view.size(w * r, h * r);
    const [y0, tilt, half, focus] = VIEWS[st.view], aspect = w / h;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    const a = (y0 * Math.PI) / 180 + yaw, tl = (tilt * Math.PI) / 180;
    const at = new THREE.Vector3(0, 0.9, 0.05);
    if (focus === 'hands' && bike) {
      bike.root.updateMatrixWorld(true);
      at.copy(bike.marks.hoodL.getWorldPosition(new THREE.Vector3())).add(bike.marks.hoodR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
      at.z -= 0.06; at.y += 0.02;
    }
    // yaw 0: from the rider's right (-X), looking across the bike
    camera.position.copy(at).add(new THREE.Vector3(-Math.cos(a) * Math.cos(tl), Math.sin(tl), Math.sin(a) * Math.cos(tl)).multiplyScalar(10));
    camera.lookAt(at);
    camera.updateProjectionMatrix();
  };
  const pose = () => {
    if (!bike || !figure) return;
    const n = bikeNudge(st.level);
    bike.root.position.set(n.x, n.y, n.z); bike.root.scale.setScalar(n.s);
    bike.spin(angle);
    poseRider(THREE, figure.root, bike, bikePose(st.body));
  };
  const tick = (dt) => {
    if (st.playing) angle += dt * (bikePose(st.body).rpm / 60) * Math.PI * 2;
    pose();
  };
  const view = addView(THREE, { canvas, scene, camera, tick, fps: 30, live: () => !!figure && (st.playing || !!drag),
    toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.05 });
  const ro = new ResizeObserver(fit); ro.observe(host);
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag) { yaw = drag.yaw + (e.clientX - drag.x) * 0.012; fit(); view.draw(); } });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  /** Put this body on this bike (the old ones stay until the new have loaded). */
  const show = async () => {
    const l = { ...look, body: st.body };
    const model = modelFor(l, [l.outfit]);
    const k = `${model}|${st.level}`;
    if (k === want) return;
    want = k;
    const [nb, nf] = await Promise.all([loadBike(L, st.level), spawnChar(L, { model, clips: null, uniforms, gear: [], hair: hairColour(look.hairColour) })]);
    if (gone || want !== k) { nf.dispose(); letGo(nf.urls); return; }
    if (bike) hold.remove(bike.root);
    if (figure) { hold.remove(figure.root); figure.dispose(); letGo(figure.urls); }
    bike = nb; figure = nf;
    hold.add(bike.root, figure.root);
    pose(); fit(); view.draw();
  };

  fit();
  return {
    show,
    setView: () => { yaw = 0; fit(); view.draw(); },
    refit: () => { pose(); view.draw(); },
    dispose() {
      gone = true; view.dispose(); ro.disconnect();
      if (figure) { figure.dispose(); letGo(figure.urls); }
      floor.geometry.dispose(); floor.material.dispose();
      canvas.remove();
    },
  };
}
