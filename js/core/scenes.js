// scenes.js — the Profile scene manifest: which art each sport shows at each
// level, and where the code-driven motion overlays sit on it. Pure data plus
// one lookup; no DOM. All coordinates are percentages of the image (0–100).
//
// Two scene kinds:
//   layered — background + platform + animated character (Cycling).
//   still   — one flat image with the athlete baked in (Run, Gym, Swim). Its
//             `backdrop` colours (sampled from the image's own edges) fill the
//             screen around it so the art melts into the phone.
//
// Only real art is listed. A level above the last entry shows the last entry
// (the HUD still shows the true level). An entry's `src` is only ever used as
// an <img src>, so an animated .webp or .gif can replace a .png here with no
// code change.

const ART = 'icons/Pixelart';

// Every 512×512 still carries a level label bottom-left and a generator mark
// bottom-right. These iso-sloped triangles (the dioramas' own edge angle) cover
// both; they're filled with the image's corner colour so they vanish.
const CORNERS = [
  { side: 'left', from: 86, to: 26 },   // y% where the cut meets the edge → x% where it meets the bottom
  { side: 'right', from: 85, to: 72 },
];

// ---- Gym ---------------------------------------------------------------------
// Hanging lamps sit in the same spots from level 2 up; level 1 is lit by its
// windows instead.
const GYM_LAMPS = [
  { x: 9, y: 22, w: 10, h: 18 },
  { x: 28, y: 14, w: 10, h: 18 },
  { x: 62, y: 11, w: 10, h: 18 },
  { x: 79, y: 18, w: 10, h: 18 },
];
const GYM_WINDOWS = [
  { x: 39, y: 6, w: 9, h: 22 },
  { x: 52, y: 4, w: 9, h: 22 },
];
const GYM_EDGE = ['#353c43', '#383c42', '#343a3e', '#353a3e', '#32393c', '#2f373a', '#2f3739', '#2d3637', '#2b3335'];

const gym = Array.from({ length: 9 }, (_, i) => ({
  src: `${ART}/GYM/GYM_LVL${i + 1}.png`,
  w: 512, h: 512,
  backdrop: { top: GYM_EDGE[i], bottom: GYM_EDGE[i] },
  corners: CORNERS,
  fx: { glow: i === 0 ? GYM_WINDOWS : GYM_LAMPS, dust: i === 0 ? GYM_WINDOWS : GYM_LAMPS },
}));

// ---- Run -----------------------------------------------------------------------
const RUN_FILES = ['RUNGENERAL_LVL1.png', 'RUNLVL2.png', 'RUNLVL3.png', 'RUNLVL4.png', 'RUNLVL5.png',
  'RUNLVL6.png', 'RUNLVL7.png', 'RUNLVL8.png', 'RUNLVL9.png', 'RUNLVL10.png'];
const RUN_SKY = ['#5c5f64', '#5f5f64', '#9fabab', '#a2abad', '#a7bfc1', '#adc5c9', '#d1e4e3', '#82ccfc', '#82cdfd', '#56aaec'];
const RUN_GROUND = ['#3d3d3f', '#3b3b3d', '#4f5154', '#505054', '#474547', '#424142', '#41413f', '#40423c', '#3c3e38', '#3a3d37'];
// The run art's sky and ground are vertical gradients, so a flat backdrop
// leaves a seam. These are 24 bands sampled down the image's side edges (trees
// skipped and interpolated over), packed as 6-hex-digit colours top to bottom;
// the screen extends them sideways as stepped stripes.
const RUN_BANDS = [
  '5d5f645f6166787c807b7f837e8285767b7e5f6260474843302f252e2d242b2b222e2f2832332e353834383c393c403f3f44453e40423d3e403c3c3e3c3c3e3d3d3f3d3d3f3d3d3f',
  '5d5f635e6064767b7c797d7f7c8082757a7b7075766b7071656a6b6065665b6061565b5c5156574c5152464b4c4146473c41423b3e3f3a3b3d3b3b3d3b3b3d3b3b3d3a3a3c3a3a3c',
  '9fabab9eaaaabdc8c3bacacabececdb6c5c4adbcbba4b3b29caaa994a1a08b9897828f8e7a8685727d7c697473606b6a586261545c5b5056555052555052565052565052564f5154',
  'a1aaaba0a8a8bec7c5bdcacbbfcbcbb6c2c2aeb9b9a5b0b09da7a7949e9e8c9695838d8c7a8483727b7a69727161696858605f545c5a515555515155525255515155515155504f53',
  'a6bec1a7bec0c2cfcfa8b3b6a2adaf9ca7a897a1a1919b9b8b9594858f8d808a867a847f747e786e787269726b636c645d665d565b544e504b494647484547474548484647464546',
  'adc5caadc5c9c9d6d8adbabda7b3b5a0adae9aa6a694a09f8d9997879390818c887b8681747f796e797268726a616c635b655b545a534b4f49454343444243434142434142424242',
  'cfe3e2cee0decddbd8ccd6d1c3cdc7bac5beb2bcb4a9b3aba0aba197a2988f998e8690857d887b747f726c7668636e5f5a6555545b504b4f4844434143424043423f43413f40413e',
  '81cdfb81cdfa88d1f992d6f89bdbf895d1eb8fc7de89bcd283b2c57da8b8779eab72949e6c8992667f856075785a6b6b54605f4e5652484c4541423d41423d41423d41423d3f423c',
  '82ccfc83ccfa89d1f993d6f89ddcf897d2eb91c7de8abdd184b2c47ea8b7789daa72939d6b8990657e835f7476596969525f5c4c544f464a423f403a3d3e393d3e383d3e383b3f38',
  '55a9eb7abeeea0d3f18ecbee7bc3eb77badf73b1d36fa8c76b9fba6796ae638da25f84965b7c8a57737e536a724f61654b5859474f4d4346413b3d373b3c373b3d373b3d373a3e37',
];
// Leaf colour follows the season the art shows: dry autumn at the start,
// green once the trees have filled in.
const RUN_LEAF = ['#8a5a32', '#8a5a32', '#9a7a3a', '#9a7a3a', '#7d8f3a', '#7d8f3a', '#5c9a3a', '#5c9a3a', '#5c9a3a', '#5c9a3a'];
const RUN_TREES = [{ x: 14, y: 4, w: 22, h: 22 }, { x: 88, y: 24, w: 12, h: 16 }];

const run = RUN_FILES.map((f, i) => ({
  src: `${ART}/RUN/${f}`,
  w: 512, h: 512,
  backdrop: { top: RUN_SKY[i], bottom: RUN_GROUND[i], bands: RUN_BANDS[i] },
  corners: CORNERS,
  fx: {
    clouds: { x: 0, y: 0, w: 100, h: 13 },
    leaves: { from: RUN_TREES, color: RUN_LEAF[i] },
    // the lap clock (levels 1–6) / LED level board (7–10) by the track
    clock: { x: 45, y: 63, w: 8, h: 6 },
  },
}));

// ---- Swim -------------------------------------------------------------------------
const swim = [{
  src: `${ART}/SWIM/SWIM_LVL1.png`,
  w: 512, h: 454,
  backdrop: { top: '#0f1626', bottom: '#111727' },
  corners: [],
  fx: {
    // the pool's water surface, as a diamond (x%, y% pairs)
    shimmer: [[9, 55], [49, 31], [92, 54], [50, 81]],
    ripples: { x: 47, y: 57 },
  },
}];

// ---- Bike (layered) -----------------------------------------------------------------
const bike = Array.from({ length: 10 }, (_, i) => ({
  bg: `${ART}/BIKE/BACKGROUND/background.png`,
  // platform filenames carry an inverted index: level 1 → _0009_, level 10 → _0000_
  platform: `${ART}/BIKE/PLATFORMS/BIKE1BLUE_${String(9 - i).padStart(4, '0')}_Layer-${i + 1}.png`,
  char: `${ART}/BIKE/CHARACTERS/bikelvl${i + 1}_char.webp`,
}));

export const SCENES = {
  bike: { kind: 'layered', label: 'Cycling', levels: bike },
  run: { kind: 'still', label: 'Running', levels: run },
  gym: { kind: 'still', label: 'Gym', levels: gym },
  swim: { kind: 'still', label: 'Swimming', levels: swim },
};

export const SCENE_SPORTS = ['bike', 'swim', 'run', 'gym'];

/**
 * Scene entry for a sport at a level. Clamps to the highest real art.
 * @returns {{sport, kind, label, level, artLevel, maxArt, entry} | null}
 */
export function sceneFor(sport, level) {
  const s = SCENES[sport];
  if (!s) return null;
  const real = Math.max(1, Math.floor(Number(level)) || 1);
  const maxArt = s.levels.length;
  const artLevel = Math.min(real, maxArt);
  return { sport, kind: s.kind, label: s.label, level: real, artLevel, maxArt, entry: s.levels[artLevel - 1] };
}

/** Every art file the manifest references (for tests and precaching). */
export function sceneFiles() {
  const out = [];
  for (const s of Object.values(SCENES)) {
    for (const e of s.levels) {
      if (s.kind === 'layered') out.push(e.bg, e.platform, e.char);
      else out.push(e.src);
    }
  }
  return [...new Set(out)];
}

/** CSS for a still's side backdrop: its packed edge bands as hard-stop
 *  stripes, or a flat top/bottom split when it has none. */
export function backdropCss(backdrop) {
  const hex = backdrop?.bands || '';
  if (hex.length < 6 || hex.length % 6) return `linear-gradient(${backdrop.top} 0 50%, ${backdrop.bottom} 50% 100%)`;
  const cols = hex.match(/.{6}/g);
  const step = 100 / cols.length;
  const r = (v) => Math.round(v * 100) / 100;
  return `linear-gradient(${cols.map((c, i) => `#${c} ${r(i * step)}% ${r((i + 1) * step)}%`).join(', ')})`;
}

/** Stepped (staircase) clip-path polygon for an iso corner cut, in %.
 *  Steps of `step`% keep the edge pixel-looking instead of a smooth diagonal. */
export function cornerPolygon({ side, from, to }, step = 2) {
  const pts = [];
  // walk from the edge point (x=0|100, y=from) down to the bottom point (x=to, y=100)
  const span = side === 'left' ? to : 100 - to;
  const n = Math.max(1, Math.round(span / step));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const xOff = span * t;
    const x = side === 'left' ? xOff : 100 - xOff;
    const y = from + (100 - from) * t;
    pts.push([x, y]);
    if (k < n) {
      const nextX = side === 'left' ? span * ((k + 1) / n) : 100 - span * ((k + 1) / n);
      pts.push([nextX, y]);
    }
  }
  pts.push(side === 'left' ? [0, 100] : [100, 100]);
  const r = (v) => Math.round(v * 100) / 100;
  return `polygon(${pts.map(([x, y]) => `${r(x)}% ${r(y)}%`).join(', ')})`;
}

// The trainer who speaks the app's training messages. Each frame stays null
// until real art lands (see docs/redesign/ART-BRIEF.md); with no portrait the
// dialogue box shows his name and a whistle icon instead of a picture. With
// `blink` / `talk` frames as well, he blinks and "speaks" while a line types.
export const COACH = {
  name: 'Coach',
  portrait: null, // 'icons/trainer/portrait.png'
  blink: null,    // 'icons/trainer/blink.png'
  talk: null,     // 'icons/trainer/talk.png'
  cheer: null,    // 'icons/trainer/cheer.png'
};
