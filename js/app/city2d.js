// city2d.js — what moves in the base's city (docs/CITY.md, "In the app"):
//
//   the sign       a street sign by the garage door, its white panel counting down to the next
//                  delivery; tap it for the list (delivery-view.js)
//   the bike       the MOSKE courier: it brings the clothes (gear and kit). In over the bridge to the
//                  club house's door, waits there with the parcel over its head, back the way it came
//   the boat       brings everything else (room items): in from the south, alongside the dock's
//                  front, waits there, then sails on out to the east
//
// All are pictures in the world (icons/City/street/ and icons/Island/), so they pan and zoom with
// it at no cost. The bike and the boat were rendered from their Tripo models
// (tools/render-items/render-grounds.py) and their roads are drawn in tools/cut-grounds.py.
// Each moves by transform, and only while it moves. They're drawn over the grounds' buildings.

import { ISLAND_ART } from '../core/island-art.js';

const ART = ISLAND_ART;
const [BASE_X, BASE_Y] = ART.plots.base;
export const SIGN_AT = [BASE_X + 161, BASE_Y + 367]; // on the pavement, left of the garage door
export const SIGN_HEIGHT = 170;                  // px tall on screen

const SPEED = { bike: 260, boat: 170 };   // px of the city picture per second
const WAIT = 8;                           // s at its stop

const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const routeLength = (r) => r.slice(1).reduce((n, p, i) => n + dist(r[i], p), 0);

/** The two that deliver: their roads in and out, and their pictures. */
export const VEHICLES = Object.fromEntries(['bike', 'boat'].map((kind) => {
  const { path, stop } = ART.routes[kind];
  const routeIn = path.slice(0, stop + 1);
  // the bike turns round and goes back over the bridge; the boat carries straight on
  const routeOut = kind === 'bike' ? [...routeIn].reverse() : path.slice(stop);
  const pics = kind === 'bike' ? { in: ART.pieces['bike-in'], out: ART.pieces['bike-out'] } : { in: ART.pieces.boat, out: ART.pieces.boat };
  return [kind, { kind, routeIn, routeOut, pics, stop: path[stop], inS: routeLength(routeIn) / SPEED[kind], outS: routeLength(routeOut) / SPEED[kind] }];
}));
/** How long after a delivery's end its vehicle is still on screen (s): it waits, then leaves. */
export const TRUCK_AFTER = Math.max(...Object.values(VEHICLES).map((v) => WAIT + v.outS));

/** Where along a route a vehicle is after `d` px, and which way it's heading. */
function along(route, d) {
  for (let i = 1; i < route.length; i++) {
    const p = route[i - 1]; const q = route[i]; const l = dist(p, q);
    if (d <= l || i === route.length - 1) {
      const t = Math.min(1, Math.max(0, d / l));
      return { p: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], dir: [q[0] - p[0], q[1] - p[1]] };
    }
    d -= l;
  }
  return { p: route[route.length - 1], dir: [1, 0] };
}

/**
 * Where vehicle `kind` is `t` seconds from a delivery's end (negative before it): coming in during
 * the last inS seconds, waiting WAIT seconds at its stop, then leaving. null when it's not on
 * screen. `out` is true once it's leaving.
 */
export function truckAt(t, kind = 'bike') {
  const v = VEHICLES[kind];
  if (t < -v.inS || t > WAIT + v.outS) return null;
  if (t <= 0) return { ...along(v.routeIn, (t + v.inS) * SPEED[kind]), moving: t < 0, out: false };
  if (t <= WAIT) { const a = along(v.routeIn, Infinity); return { p: a.p, dir: a.dir, moving: false, out: false }; }
  return { ...along(v.routeOut, (t - WAIT) * SPEED[kind]), moving: true, out: true };
}

// The pictures, in px of the city: how big, and where their foot (the point on the ground) is.
const SIGN_PIC = { src: 'icons/City/street/sign.webp', w: 75.5, h: 187, ax: 37.6, ay: 184.1 };
// the sign's white panel: its top-left corner, and its top and left edges (px of the picture)
const PANEL = { at: [17.1, 35.4], u: [50.7, -24.8], v: [0, 31.2] };
const PANEL_BOX = [100, 50];   // the countdown's own box, before it's skewed onto the panel
let city = null;   // { sign, title, clock, pics: { bike, boat }, opts, shown }: this render's world
let timer = 0; let frame = 0;
const state = { bike: { mode: 'off', t0: 0 }, boat: { mode: 'off', t0: 0 } };
const endsOf = (o, kind) => (o.deliveries?.(kind) || []).slice().sort((a, b) => a - b);

/**
 * The city's sign, bike and boat in the world element `worldEl` (call it after the island's plots).
 *   deliveries(kind)  when each of that vehicle's deliveries ends (epoch ms); no kind: all of them
 *   now()         the server's time (epoch ms)
 *   label         { title, clock(ms) }: the sign's words and its countdown format
 *   parked(kind)  true while its parcel waits: it stays until it's opened
 *   reduced()     true under reduced motion: they only appear parked
 */
export function mountCity(worldEl, opts) {
  let sign = worldEl.querySelector('.dg-street-sign');
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
  const pics = {};
  for (const kind of ['bike', 'boat']) {
    let pic = worldEl.querySelector(`.dg-truck[data-kind="${kind}"]`);
    if (!pic) {
      pic = document.createElement('img');
      pic.className = 'dg-truck'; pic.dataset.kind = kind; pic.alt = ''; pic.draggable = false; pic.hidden = true;
      pic.setAttribute('aria-hidden', 'true');
      // among the grounds' pictures, after the buildings, so it's drawn over them (styles.css)
      const plots = worldEl.querySelector('.dg-plots');
      if (plots) plots.append(pic); else worldEl.querySelector('.dg-items').before(pic);
    }
    pics[kind] = pic;
  }
  city = { sign, title: sign.querySelector('small'), clock: sign.querySelector('b'), pics, opts, shown: null };
  city.title.textContent = opts.label?.title || '';
  update();
  // the sign's countdown, and a vehicle setting off: looked at once a second
  if (!timer) timer = setInterval(update, 1000);
}

/** Take the sign and the vehicles out of a world that isn't the city's. */
export function unmountCity(worldEl) {
  worldEl?.querySelectorAll('.dg-street-sign, .dg-truck').forEach((el) => el.remove());
  city = null;
  clearInterval(timer); timer = 0;
  cancelAnimationFrame(frame); frame = 0;
}

/** Where vehicle `kind` is at server time `t`, or null: { p, dir, moving, out }. */
function vehicleNow(o, t, ends, kind) {
  const v = VEHICLES[kind]; const st = state[kind];
  const arriving = ends.find((e) => (t - e) / 1000 >= -v.inS && (t - e) / 1000 < 0);
  let at = null;
  if (arriving != null) { at = truckAt((t - arriving) / 1000, kind); st.mode = 'in'; }
  else if (o.parked?.(kind)) { const a = along(v.routeIn, Infinity); at = { p: a.p, dir: a.dir, moving: false, out: false }; st.mode = 'park'; }
  else if (st.mode === 'in' || st.mode === 'park') { st.mode = 'out'; st.t0 = performance.now(); }
  if (st.mode === 'out') {
    const d = ((performance.now() - st.t0) / 1000) * SPEED[kind];
    if (d > routeLength(v.routeOut)) st.mode = 'off'; else at = { ...along(v.routeOut, d), moving: true, out: true };
  }
  return at;
}

const covered = () => document.body.classList.contains('base-covered');

function update() {
  if (!city?.sign.isConnected || covered()) return;   // a full screen over the base (nav.js)
  const o = city.opts;
  const t = o.now?.() ?? Date.now();
  const next = endsOf(o).find((e) => e > t);
  const text = next == null ? '—' : o.label?.clock(next - t) || '';
  if (text !== city.shown) { city.shown = text; city.clock.textContent = text; }
  place(o, t);
}

function place(o, t) {
  let moving = false;
  for (const kind of ['bike', 'boat']) {
    const el = city.pics[kind];
    const at = vehicleNow(o, t, endsOf(o, kind), kind);
    const show = !!at && (!o.reduced?.() || !at.moving);
    el.hidden = !show;
    if (!show) continue;
    const pic = at.out ? VEHICLES[kind].pics.out : VEHICLES[kind].pics.in;
    if (el.getAttribute('src') !== pic.src) { el.src = pic.src; el.style.width = `${pic.w}px`; el.style.height = `${pic.h}px`; }
    el.style.transform = `translate(${(at.p[0] - pic.ax).toFixed(1)}px, ${(at.p[1] - pic.ay).toFixed(1)}px)`;
    el.classList.toggle('is-driving', at.moving);
    moving ||= at.moving;
  }
  // while one moves it's placed every frame, until they've stopped or left
  if (moving && !frame) {
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!city?.sign.isConnected || covered()) return;
      place(city.opts, city.opts.now?.() ?? Date.now());
    });
  }
}
