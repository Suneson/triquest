// pixel-chart.js — the telemetry chart pieces shared by the Fitness hub and the
// gym history sheet (DESIGN.md "Telemetry charts").

// Pixel telemetry charts: every line is a stepped path on a 2px grid (hold the
// value, then jump), dots are squares, and each plot carries dashed gridlines
// with + ticks at the corners. Returns the stroke path plus the point/scale
// geometry for fills, markers and bands.
export const PAD = 4;
export const snap = (v) => Math.round(v / 2) * 2;
export function wavePath(vals, W, H, maxOverride) {
  const max = Math.max(1, maxOverride ?? Math.max(...vals));
  const y = (v) => snap(H - PAD - (v / max) * (H - PAD * 2));
  const x = (i) => snap(PAD + (i / Math.max(1, vals.length - 1)) * (W - PAD * 2));
  const pts = vals.map((v, i) => [x(i), y(v)]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += ` H ${pts[i][0]} V ${pts[i][1]}`;
  return { d, max, x, y, pts, W, H };
}

/** A stepped band between two series (e.g. a safe-load zone). */
export function stepBand(x, topY, botY, n) {
  let d = `M ${x(0)} ${topY(0)}`;
  for (let i = 1; i < n; i++) d += ` H ${x(i)} V ${topY(i)}`;
  d += ` V ${botY(n - 1)}`;
  for (let i = n - 2; i >= 0; i--) d += ` V ${botY(i + 1)} H ${x(i)} V ${botY(i)}`;
  return `${d} Z`;
}

/** Dashed gridlines at quarter heights and + ticks at the plot corners. */
export function telemetryGrid(W, H) {
  const lines = [0.25, 0.5, 0.75].map((f) => {
    const gy = snap(PAD + f * (H - PAD * 2));
    return `<line class="fh-grid" x1="${PAD}" y1="${gy}" x2="${W - PAD}" y2="${gy}"/>`;
  }).join('');
  const ticks = [[PAD, PAD], [W - PAD, PAD], [PAD, H - PAD], [W - PAD, H - PAD]]
    .map(([cx, cy]) => `<path class="fh-cross" d="M ${cx - 4} ${cy} H ${cx + 4} M ${cx} ${cy - 4} V ${cy + 4}"/>`).join('');
  return lines + ticks;
}

/** A square marker (pixel dot). */
export const square = (cx, cy, s, attrs = '') => `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" ${attrs}/>`;

/** Block bars on the 2px grid, one per value. `cls(i, v)` picks each bar's class. */
export function blockBars(vals, W, H, max, cls) {
  const slot = (W - PAD * 2) / vals.length;
  const yOf = (v) => snap(H - PAD - (v / Math.max(1, max)) * (H - PAD * 2));
  return vals.map((v, i) => {
    const top = Math.min(H - PAD - 2, yOf(v));
    return `<rect class="fh-bar ${cls(i, v)}" x="${snap(PAD + i * slot)}" y="${top}" width="${Math.max(2, snap(slot) - 2)}" height="${H - PAD - top}"/>`;
  }).join('');
}

