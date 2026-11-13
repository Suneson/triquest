// gl-shared.js: one WebGL renderer for every 3D view in the app: the athletes on the base
// (runner3d.js, walker.js), the city's sign and truck (city3d.js), the wardrobe (wardrobe3d.js) and
// the stadium (stadium3d.js).
//
// Each view keeps a plain 2D canvas where it sits in the page, so it still pans, zooms and stacks
// with the art round it. Its scene is drawn by the one renderer, off screen, into a corner of the
// renderer's canvas, and copied from there onto the view's canvas. One WebGL context for the whole
// app (iPhone Safari keeps only a few), and every model and texture is uploaded once however many
// views show it.
//
// One loop draws them all, and it draws as little as it can:
//   - a view is drawn only when it asks to be (its `tick` says it moved, or it was told `draw()`);
//   - not while it is off screen, while the page is hidden, or while its `paused()` says so (a full
//     screen covers the base);
//   - at most `fps` times a second (30 by default);
//   - and the loop itself stops when no view wants drawing, until one asks again.
// Sharpness is capped: `ratio()` is at most 2 device pixels per CSS pixel.

/** The most device pixels a view draws per CSS pixel. */
export const MAX_RATIO = 2;
/** The device's pixel ratio times `k` (a view that is zoomed in asks for more), at most MAX_RATIO. */
export const ratio = (k = 1) => Math.min(MAX_RATIO, (window.devicePixelRatio || 1) * k);

let gl = null;          // { renderer, canvas, w, h }
const views = new Set();
let raf = 0;
let io = null;          // one IntersectionObserver for every view's canvas

function shared(THREE) {
  if (gl) return gl;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setScissorTest(true);
  gl = { renderer, canvas, w: 0, h: 0, THREE };
  return gl;
}

const observe = (v) => {
  io ||= new IntersectionObserver((entries) => {
    for (const e of entries) {
      const view = [...views].find((x) => x.canvas === e.target);
      if (!view) continue;
      view.onscreen = e.isIntersecting;
      if (view.onscreen) { view.dirty = true; wake(); }
    }
  }, { rootMargin: '64px' });
  io.observe(v.canvas);
};

function wake() { if (!raf) raf = requestAnimationFrame(loop); }
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { for (const v of views) v.dirty = true; wake(); } });
  // a full screen opening or closing over the base (nav.js puts `base-covered` on the body)
  new MutationObserver(() => { if (views.size) wake(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function loop(now) {
  raf = 0;
  if (document.hidden) return;
  let wanted = false;
  for (const v of views) {
    if (!v.canvas.isConnected || !v.onscreen || v.paused?.()) { v.last = 0; continue; }
    const live = v.live?.() ?? false;
    if (!live && !v.dirty) continue;
    wanted = true;
    if (v.last && now - v.last < 1000 / v.fps - 2 && !v.dirty) continue;
    const dt = v.last ? Math.min(0.1, (now - v.last) / 1000) : 0;
    v.last = now;
    v.tick?.(dt, now);
    v.dirty = false;
    draw(v);
    if (v.dirty) wanted = true;   // its tick asked for another
  }
  if (wanted) raf = requestAnimationFrame(loop);
}

function draw(v) {
  const { renderer, THREE } = gl;
  const w = v.canvas.width, h = v.canvas.height;
  if (!w || !h) return;
  if (w > gl.w || h > gl.h) {
    gl.w = Math.max(gl.w, w); gl.h = Math.max(gl.h, h);
    renderer.setSize(gl.w, gl.h, false);
  }
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.toneMapping = v.toneMapping ?? THREE.NoToneMapping;
  renderer.toneMappingExposure = v.exposure ?? 1;
  renderer.clear();
  renderer.render(v.scene, v.camera);
  // the drawn corner is the bottom left of the renderer's canvas (WebGL counts from the bottom)
  v.ctx.clearRect(0, 0, w, h);
  v.ctx.drawImage(gl.canvas, 0, gl.h - h, w, h, 0, 0, w, h);
  v.after?.();
}

/**
 * Add a view. `canvas`: the 2D canvas it shows on, sized in device pixels by its owner (`size`).
 *   scene, camera   what to draw
 *   tick(dt, now)   moves things on before a draw (the mixer, a walk); return nothing
 *   live()          true while it moves on its own (a clip plays): drawn every frame, at `fps`
 *   paused()        true while it can't be seen though it is on screen (a full screen covers the base)
 *   toneMapping, exposure   the renderer's tone mapping for this view
 *   after()         called after each draw (the stadium's tags follow its runners)
 * Returns { draw() (draw it once more), size(w, h) (its canvas, device px), renderer, dispose() }.
 */
export function addView(THREE, { canvas, scene, camera, tick = null, live = null, paused = null, fps = 30, toneMapping, exposure, after = null }) {
  const { renderer } = shared(THREE);
  const v = { canvas, ctx: canvas.getContext('2d'), scene, camera, tick, live, paused, fps, toneMapping, exposure, after, onscreen: true, dirty: true, last: 0 };
  views.add(v);
  listen();
  observe(v);
  wake();
  return {
    renderer,
    draw() { v.dirty = true; wake(); },
    size(w, h) {
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      v.dirty = true; wake();
    },
    /** Whether it is being drawn now (on screen, not paused). */
    shown: () => canvas.isConnected && v.onscreen && !v.paused?.() && !document.hidden,
    dispose() { views.delete(v); io?.unobserve(canvas); },
  };
}
