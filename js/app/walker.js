// walker.js — your athlete on the floor of a room, walking tile to tile (docs/WALKING.md).
//
// The same 3D character as on the treadmill (runner3d.js), in a canvas of its own that stands on
// one tile of the floor and moves with it. It idles, now and then wanders a few tiles, and walks
// to a machine when you start training on it. Paths are js/core/walk.js.

import { mountRunner } from './runner3d.js';
import { findPath, wanderTile, facing } from '../core/walk.js';

/** Tiles a second: about the walk clip's own pace at this size. */
const SPEED = 2.5;
/** How long it stands before wandering again (seconds). */
const REST = [4, 10];
/** The canvas round the tile: 3 tiles each way, so the whole (twice-size) character fits above it. */
const FOOT = { w: 3, h: 3 };
/** The treadmill's athlete is this size too (placement.js RUNNER). */
const SPOT = { u: 1.5, v: 1.5, y: 0, scale: 2.52 };

/**
 * Stand the athlete on a tile in `layer` (the room's items layer).
 *   at      the tile it starts on, [u, v]
 *   toPx    (u, v) in tiles → [x, y] in the layer's px
 *   tile    one tile along u on screen, { ux, uy } px
 *   grid    () → the room's walkable grid now (js/core/walk.js floorGrid)
 *   char    the character (runner3d.js mountRunner)
 *   still   reduced motion: it stands, never wanders, and goes to places at once
 *   onMove  (tile) → called each time it reaches a tile
 * @returns {{ goTo(tile, done), jump(tile), wander(on), tile(), model, dispose() }}
 */
export function mountWalker(layer, { at, toPx, tile, grid, char, still = false, onMove = () => {} }) {
  const host = document.createElement('div');
  host.className = 'dg-walker';
  layer.append(host);
  const r3d = mountRunner(host, { tile, anchor: { x: 0, y: 0 }, foot: FOOT, spot: SPOT, char, clip: 'idle', still });
  let pos = [at[0], at[1]];        // where it is now, in tiles (fractions while walking)
  let path = []; let done = null;
  let yaw = 0.6; let want = yaw;   // a three-quarter turn to the camera to begin with
  let roam = !still; let restUntil = performance.now() + 1500;
  let raf = 0; let last = performance.now(); let gone = false;

  const place = () => {
    const [x, y] = toPx(pos[0] + 0.5, pos[1] + 0.5);
    // moved by transform: no layout work for the page while it walks
    host.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const z = String(Math.round(y) + 1);
    if (host.style.zIndex !== z) host.style.zIndex = z;
  };
  const here = () => [Math.round(pos[0]), Math.round(pos[1])];
  const rest = () => { restUntil = performance.now() + (REST[0] + Math.random() * (REST[1] - REST[0])) * 1000; };

  const frame = (now) => {
    if (gone) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!host.isConnected) return;
    if (path.length) {
      const [tu, tv] = path[0];
      const du = tu - pos[0]; const dv = tv - pos[1];
      const d = Math.hypot(du, dv);
      const step = SPEED * dt;
      if (d > 1e-6) want = facing(du, dv);
      if (d <= step) {
        pos = [tu, tv]; path.shift(); onMove(here());
        if (!path.length) { r3d.play('idle', { fade: 0.25 }); rest(); const cb = done; done = null; cb?.(); }
      } else pos = [pos[0] + (du / d) * step, pos[1] + (dv / d) * step];
      place();
    } else if (roam && now > restUntil) {
      // an item set down on its tile: step off to the nearest free one
      const g = grid();
      const t = g.free(...here()) ? wanderTile(g, here()) : null;
      if (t) go(t); else rest();
    }
    // turn smoothly towards where it's going
    let a = want - yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > 1e-3) { yaw += a * Math.min(1, dt * 10); r3d.setYaw(yaw); }
  };

  /** Walk to a tile; `cb` when it's there (at once if it can't get there or motion is off). */
  function go(t, cb = null) {
    const g = grid();
    const p = still ? null : findPath(g, here(), t);
    if (!p) { jump(t); cb?.(); return; }
    path = p.slice(1); done = cb;
    if (path.length) r3d.play('walk', { fade: 0.2 }); else { done = null; cb?.(); }
  }
  /** Stand on a tile at once. */
  function jump(t) {
    path = []; done = null; pos = [t[0], t[1]]; place(); onMove(here()); r3d.play('idle', { fade: 0 }); rest();
  }

  place();
  r3d.setYaw(yaw);
  if (!still) raf = requestAnimationFrame(frame);
  return {
    goTo: go,
    jump,
    /** Let it wander between rests, or keep it still (it's waiting at a machine). */
    wander: (on) => { roam = on && !still; rest(); },
    tile: here,
    walking: () => path.length > 0,
    model: char.key || char.model,
    dispose() { gone = true; cancelAnimationFrame(raf); r3d.dispose(); host.remove(); },
  };
}
