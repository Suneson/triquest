// city2d.js — what moves in the base's city (docs/CITY.md, "In the app"):
//
//   the sign       a street sign by the garage door, its white panel counting down to the next
//                  delivery; tap it for the list (delivery-view.js)
//   the truck      the MOSKE van: it drives in from the bottom right as a delivery's countdown runs
//                  out, waits at the garage door, and drives off
//
// Both are pictures in the world (icons/City/street/), so they pan and zoom with it at no cost.
// They were drawn from the 3D models (models/city/sign.glb, truck.glb) by the city's own camera
// (tools/bake-street.js): the sign once, the truck once for each way it faces on its road. Until
// 2026-11 they were live 3D on a canvas the size of the screen, redrawn every second for the
// clock and every frame while panning (docs/PERFORMANCE.md).
//
// The sign's countdown is ordinary text, skewed onto its panel. The truck moves by transform, and
// only while it drives. Driving, it's under the mall and the market (it goes behind them); parked,
// it's over everything round the garage.

import { ISLAND_ART } from '../core/island-art.js';

const SLOPE = 0.489;

// in px of the city picture (CITY in diorama.js; drawn in tiles, icons/City/layers/tiles/)
const [BASE_X, BASE_Y] = ISLAND_ART.plots.base;
export const SIGN_AT = [BASE_X + 161, BASE_Y + 367]; // on the pavement, left of the garage door
export const SIGN_HEIGHT = 170;                  // px tall on screen
// the truck's road: in from the bottom right, round the corner, to the garage door; then it
// turns round and drives off down the same road, out at the bottom
// The street grid (tools/compose-city.py) in px of the city picture: block (a, b) has its centre
// at C0 + (a − b) P across and (a + b) SLOPE P down; the roads run along a = ±½ and b = ±½.
const GRID = { c0: [BASE_X, BASE_Y], P: 1391 };
const lat = (a, b) => [GRID.c0[0] + (a - b) * GRID.P, GRID.c0[1] + (a + b) * SLOPE * GRID.P];
// in from the right along the road between the stadium and the pool (b = −½), round the corner
// by the stadium onto the road past the garage (a = ½), stopping at its door; then on down that
// road and out at the bottom. Each leg keeps to the lane on the tower's side.
const ROUTE_IN = [lat(1.7, -0.45), lat(0.45, -0.45), lat(0.45, 0.12)];
const ROUTE_OUT = [lat(0.45, 0.12), lat(0.45, 1.7)];
/** Where the truck stops at the garage door (px of the city picture): the parcels wait there. */
export const TRUCK_STOP = ROUTE_IN[ROUTE_IN.length - 1];
const TRUCK_LEN = 150;                    // px along the road
const SPEED = 150;                        // px of the city picture per second
const WAIT = 8;                           // s at the garage door


const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const routeLength = (r) => r.slice(1).reduce((s, p, i) => s + dist(r[i], p), 0);
const IN_S = routeLength(ROUTE_IN) / SPEED;     // how long the drive in takes
const OUT_S = routeLength(ROUTE_OUT) / SPEED;

/** Where along a route the truck is after `d` px, and which way it faces. */
function along(route, d) {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]; const b = route[i]; const l = dist(a, b);
    if (d <= l || i === route.length - 1) {
      const t = Math.min(1, Math.max(0, d / l));
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: [b[0] - a[0], b[1] - a[1]] };
    }
    d -= l;
  }
  return { p: route[route.length - 1], dir: [1, 0] };
}

/**
 * Where the truck is `t` seconds from a delivery's end (negative before it): driving in during
 * the last IN_S seconds, waiting WAIT seconds at the door, then driving off. null when it's
 * not on screen.
 */
/** How long after a delivery's end the truck is still on screen (s): it waits, then drives off. */
export const TRUCK_AFTER = WAIT + OUT_S;

export function truckAt(t) {
  if (t < -IN_S || t > WAIT + OUT_S) return null;
  if (t <= 0) return { ...along(ROUTE_IN, (t + IN_S) * SPEED), moving: t < 0 };
  if (t <= WAIT) { const a = along(ROUTE_IN, Infinity); return { p: a.p, dir: a.dir, moving: false }; }
  return { ...along(ROUTE_OUT, (t - WAIT) * SPEED), moving: true };
}

// The pictures, in px of the city: how big, and where their foot (the point on the ground) is.
const SIGN_PIC = { src: 'icons/City/street/sign.webp', w: 75.5, h: 187, ax: 37.6, ay: 184.1 };
// the sign's white panel: its top-left corner, and its top and left edges (px of the picture)
const PANEL = { at: [17.1, 35.4], u: [50.7, -24.8], v: [0, 31.2] };
const PANEL_BOX = [100, 50];   // the countdown's own box, before it's skewed onto the panel
// the truck facing up the screen (its first leg in) and down it (the corner, the door, the way out)
const TRUCK_PIC = {
  up: { src: 'icons/City/street/truck-in.webp', w: 208, h: 192, ax: 101, ay: 151 },
  down: { src: 'icons/City/street/truck-out.webp', w: 208, h: 217.5, ax: 101.2, ay: 180.5 },
};

let city = null;   // { sign, title, clock, truck, opts, shown }: the elements in this render's world
let timer = 0; let frame = 0;
const truck = { mode: 'off', t0: 0 };
const endsOf = (o) => (o.deliveries?.() || []).slice().sort((a, b) => a - b);

/**
 * The city's sign and truck in the world element `worldEl` (call it after the island's plots).
 *   deliveries()  when each delivery ends (epoch ms): those still coming and those just come
 *   now()         the server's time (epoch ms)
 *   label         { title, clock(ms) }: the sign's words and its countdown format
 *   parked()      true while a parcel waits at the door: the truck stays until it's opened
 *   reduced()     true under reduced motion: the truck only appears parked
 */
export function mountCity(worldEl, opts) {
  let sign = worldEl.querySelector('.dg-street-sign');
  let pic = worldEl.querySelector('.dg-truck');
  if (!sign) {
    sign = document.createElement('div');
    sign.className = 'dg-street-sign'; sign.setAttribute('aria-hidden', 'true');
    const [bw, bh] = PANEL_BOX;
    const m = [PANEL.u[0] / bw, PANEL.u[1] / bw, PANEL.v[0] / bh, PANEL.v[1] / bh, PANEL.at[0], PANEL.at[1]];
    sign.innerHTML = `<img src="${SIGN_PIC.src}" alt="" draggable="false" decoding="async">`
      + `<div class="dg-sign-panel" style="width:${bw}px;height:${bh}px;transform:matrix(${m.map((x) => +x.toFixed(4)).join(',')})"><small></small><b class="data-num"></b></div>`;
    Object.assign(sign.style, { left: `${SIGN_AT[0] - SIGN_PIC.ax}px`, top: `${SIGN_AT[1] - SIGN_PIC.ay}px`, width: `${SIGN_PIC.w}px`, height: `${SIGN_PIC.h}px` });
    worldEl.querySelector('.dg-items').before(sign);
  }
  if (!pic) {
    pic = document.createElement('img');
    pic.className = 'dg-truck'; pic.alt = ''; pic.draggable = false; pic.hidden = true;
    pic.setAttribute('aria-hidden', 'true');
    // among the island's pictures: just after the pool, so it's drawn over the pool and under the
    // mall and the market (styles.css)
    const pool = worldEl.querySelector('.dg-plots [data-plot="pool"]');
    if (pool) pool.after(pic); else worldEl.querySelector('.dg-items').before(pic);
  }
  city = { sign, title: sign.querySelector('small'), clock: sign.querySelector('b'), truck: pic, opts, shown: null };
  city.title.textContent = opts.label?.title || '';
  update();
  // the sign's countdown, and a truck setting off: looked at once a second
  if (!timer) timer = setInterval(update, 1000);
}

/** Take the sign and the truck out of a world that isn't the city's. */
export function unmountCity(worldEl) {
  worldEl?.querySelectorAll('.dg-street-sign, .dg-truck').forEach((el) => el.remove());
  city = null;
  clearInterval(timer); timer = 0;
  cancelAnimationFrame(frame); frame = 0;
}

/** Where the truck is at server time `t`, or null: { p, dir, moving }. */
function truckNow(o, t, ends) {
  const arriving = ends.find((e) => (t - e) / 1000 >= -IN_S && (t - e) / 1000 < 0);
  let at = null;
  if (arriving != null) { at = truckAt((t - arriving) / 1000); truck.mode = 'in'; }
  else if (o.parked?.()) { const a = along(ROUTE_IN, Infinity); at = { p: a.p, dir: a.dir, moving: false }; truck.mode = 'park'; }
  else if (truck.mode === 'in' || truck.mode === 'park') { truck.mode = 'out'; truck.t0 = performance.now(); }
  if (truck.mode === 'out') {
    const d = ((performance.now() - truck.t0) / 1000) * SPEED;
    if (d > routeLength(ROUTE_OUT)) truck.mode = 'off'; else at = { ...along(ROUTE_OUT, d), moving: true };
  }
  return at;
}

const covered = () => document.body.classList.contains('base-covered');

function update() {
  if (!city?.sign.isConnected || covered()) return;   // a full screen over the base (nav.js)
  const o = city.opts;
  const t = o.now?.() ?? Date.now();
  const ends = endsOf(o);
  const next = ends.find((e) => e > t);
  const text = next == null ? '—' : o.label?.clock(next - t) || '';
  if (text !== city.shown) { city.shown = text; city.clock.textContent = text; }
  placeTruck(o, t, ends);
}

function placeTruck(o, t, ends) {
  const el = city.truck;
  const at = truckNow(o, t, ends);
  const still = o.reduced?.();
  const show = !!at && (!still || !at.moving);
  el.hidden = !show;
  if (!show) return;
  // which way it faces: up the screen (its first leg in) or down it
  const pic = at.dir[1] < 0 ? TRUCK_PIC.up : TRUCK_PIC.down;
  if (el.getAttribute('src') !== pic.src) { el.src = pic.src; el.style.width = `${pic.w}px`; el.style.height = `${pic.h}px`; }
  el.style.transform = `translate(${(at.p[0] - pic.ax).toFixed(1)}px, ${(at.p[1] - pic.ay).toFixed(1)}px)`;
  el.classList.toggle('is-driving', at.moving);
  // while it drives it moves every frame, until it stops or leaves
  if (at.moving && !frame) {
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!city?.truck.isConnected || covered()) return;
      const o2 = city.opts;
      placeTruck(o2, o2.now?.() ?? Date.now(), endsOf(o2));
    });
  }
}
