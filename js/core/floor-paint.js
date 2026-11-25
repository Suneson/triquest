// floor-paint.js — floor squares painted on the lawn and the club room floor (docs/FLOOR-PAINT.md). Pure.
//
// A floor's paint is a sparse map of tile to material: { '12,30': 'gravel' }; a tile not in it shows the
// floor as painted (the lawn). Each material is one seamless texture (icons/Tiles/<id>.webp,
// tools/cut-floor-tiles.py) spread over REPEAT tiles, so its pattern runs on across neighbouring tiles.

/** Tiles one texture covers, each way. */
export const REPEAT = 4;

/** The materials for each kind of floor, in the tray's order. */
export const MATERIALS = {
  garden: ['grass-lush', 'turf-stripes', 'gravel', 'stone-paving', 'cobble', 'slate', 'pebbles', 'composite-deck',
    'pool-deck', 'sand', 'clay-court', 'rubber-track', 'blue-track', 'flowerbed'],
  club: ['club-parquet', 'club-carpet', 'club-green-carpet', 'club-terrazzo', 'stone-paving', 'slate'],
};
/** Which materials a floor takes: the club room's own, else the garden's. */
export const kindOf = (geom) => (String(geom).startsWith('club') ? 'club' : 'garden');
export const texture = (mat) => `icons/Tiles/${mat}.webp`;
export const swatch = (mat) => `icons/Tiles/${mat}-s.webp`;

export const keyOf = (u, v) => `${u},${v}`;
const parse = (k) => k.split(',').map(Number);

/**
 * Can this tile be painted? On the floor's grid, not blocked (the pool's water, the platform's body, the
 * huts' pads), and not on a raised part (the platform has its own floor).
 */
export function paintable(g, u, v) {
  if (!g || u < 0 || v < 0 || u >= (g.limit ?? g.cols) || v >= (g.limit ?? g.rows)) return false;
  const inBox = ([u0, v0, u1, v1]) => u >= u0 && u < u1 && v >= v0 && v < v1;
  if ((g.blocked || []).some(inBox)) return false;
  if (g.raised && inBox(g.raised.top || g.raised.box)) return false;
  return true;
}

/** A paint map made safe: only known materials on paintable tiles. */
export function clean(paint, g, kind) {
  const ok = new Set(MATERIALS[kind] || []);
  const out = {};
  for (const [k, m] of Object.entries(paint || {})) {
    const [u, v] = parse(k);
    if (ok.has(m) && Number.isInteger(u) && Number.isInteger(v) && paintable(g, u, v)) out[k] = m;
  }
  return out;
}

/**
 * The tiles along a stroke from a to b (whole tiles, both ends included), so a fast finger leaves no gaps.
 * Each tile shares a side with the one before (a diagonal step gets the tile at its corner too): a path
 * of tiles that only touch at their corners would look dotted.
 */
export function line(a, b) {
  const out = [];
  const n = Math.max(Math.abs(b.u - a.u), Math.abs(b.v - a.v), 1);
  for (let i = 0; i <= n; i += 1) {
    const u = Math.round(a.u + ((b.u - a.u) * i) / n); const v = Math.round(a.v + ((b.v - a.v) * i) / n);
    const p = out[out.length - 1];
    if (p && p[0] === u && p[1] === v) continue;
    if (p && p[0] !== u && p[1] !== v) out.push([u, p[1]]);
    out.push([u, v]);
  }
  return out;
}

/** The tiles of a rectangle from corner a to corner b. */
export function rect(a, b) {
  const out = [];
  for (let u = Math.min(a.u, b.u); u <= Math.max(a.u, b.u); u += 1) for (let v = Math.min(a.v, b.v); v <= Math.max(a.v, b.v); v += 1) out.push([u, v]);
  return out;
}

/**
 * What to draw, in tile units: for each material, one SVG path of its tiles' squares; and one path of the
 * edges where a painted tile meets a different floor (drawn as a soft dark line, so patches read as laid).
 */
export function shapes(paint) {
  const by = {};
  const edges = [];
  for (const [k, m] of Object.entries(paint || {})) {
    const [u, v] = parse(k);
    (by[m] ||= []).push(`M${u} ${v}h1v1h-1z`);
    const other = (du, dv) => paint[keyOf(u + du, v + dv)] !== m;
    if (other(0, -1)) edges.push(`M${u} ${v}h1`);
    if (other(1, 0)) edges.push(`M${u + 1} ${v}v1`);
    if (other(0, 1)) edges.push(`M${u} ${v + 1}h1`);
    if (other(-1, 0)) edges.push(`M${u} ${v}v1`);
  }
  return { fills: Object.fromEntries(Object.entries(by).map(([m, d]) => [m, d.join('')])), edges: edges.join('') };
}
