// gel-sounds.js: the gel stand's sounds and its music (audio/gels/, made by tools/make-gel-sounds.py from the
// ElevenLabs takes). Web Audio, so a hit plays the moment it's asked for and a loop repeats without a gap.
// Sounds follow the app's Sound setting; the music has its own switch in the stand's top bar (settings.gelMusic).
import * as store from './store.js';

const DIR = 'audio/gels';
// the coffee shop's own sounds (tools/make-sounds.py from coffee-sounds.csv) and its song
const COFFEE = { 'grinder-start': 0.55, 'pf-knock': 0.6, 'tamp-press': 0.7, 'pf-lock': 0.65, 'brew-button': 0.55, 'brew-stop': 0.5,
  'fridge-open': 0.55, 'fridge-close': 0.55, 'cup-down': 0.55, 'ice-drop': 0.55, 'syrup-pump': 0.6, 'cream-whip': 0.55,
  'cocoa-dust': 0.55, 'serve-hatch': 0.55, 'cafe-bell': 0.5 };
const COFFEE_LOOPS = { 'grinder-whirr': 0.5, 'espresso-pour': 0.6, 'hot-water': 0.55, 'milk-pour': 0.55, 'steam-wand': 0.5, 'latte-pour': 0.55 };
const dirOf = (name) => (name in COFFEE || name in COFFEE_LOOPS || name === 'coffee-theme' ? 'audio/coffee' : DIR);
const PAD = 0.1;   // s of each loop's own end before it and its start after it (tools/make-gel-sounds.py)

// name: volume (0-1), set by ear against each other
const HITS = {
  'caffeine-drop': 0.8, 'tap-fill': 0.55, 'pick-up': 0.5, 'put-down': 0.55, 'pouch-pick': 0.6, 'seal-press': 0.6,
  'scissors-snip': 0.55, 'bin-lid': 0.45, 'bin-dump': 0.6, 'step-good': 0.45, 'step-ok': 0.5, refuse: 0.4,
  star: 0.45, 'gel-done': 0.5, 'gel-record': 0.5, restock: 0.6, 'ui-tap': 0.35, ...COFFEE,
};
const LOOPS = {
  'powder-trickle': 0.5, 'powder-shake': 0.6, 'salt-shake': 0.55, 'glass-pour': 0.55, 'whisk-stir': 0.6, 'jug-pour': 0.6, ...COFFEE_LOOPS,
};
const MUSIC = 'gels-theme';
const MUSIC_GAIN = 0.32;

let ac = null; let master = null;
const buffers = new Map();   // name -> AudioBuffer | Promise
let music = null;            // { src, gain }

const soundOn = () => !!store.getSettings()?.sound;
export const musicOn = () => store.getSettings()?.gelMusic !== false;

function context() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function load(name) {
  if (buffers.has(name)) return buffers.get(name);
  const p = fetch(`${dirOf(name)}/${name}.mp3`).then((r) => r.arrayBuffer())
    .then((b) => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
    .then((buf) => { buffers.set(name, buf); return buf; })
    .catch(() => { buffers.delete(name); return null; });
  buffers.set(name, p);
  return p;
}

/** Fetch and decode everything the stand plays (on opening it: a tap, so the context may start). */
export function warmUp() {
  if (!soundOn() || !context()) return;
  [...Object.keys(HITS), ...Object.keys(LOOPS)].forEach(load);
}

/** A one-shot. `rate` > 1 plays it higher (the stars climb). */
export function play(name, { gain = 1, rate = 1, delay = 0 } = {}) {
  if (!soundOn() || !context()) return;
  const go = (buf) => {
    if (!buf) return;
    const src = ac.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ac.createGain(); g.gain.value = (HITS[name] ?? 0.5) * gain;
    src.connect(g).connect(master);
    src.start(ac.currentTime + delay);
  };
  const b = buffers.get(name);
  if (b instanceof AudioBuffer) go(b); else load(name).then(go);
}

/**
 * A loop held while something pours: { level(v), stop() }. level(0..1) fades it (0 = silent but still running,
 * so it can come back without a restart); stop() fades it out and ends it.
 */
export function loop(name, { level = 1 } = {}) {
  const none = { level() {}, stop() {} };
  if (!soundOn() || !context()) return none;
  const g = ac.createGain(); g.gain.value = 0; g.connect(master);
  let src = null; let want = level; let stopped = false;
  const vol = () => (LOOPS[name] ?? 0.5) * want;
  const start = (buf) => {
    if (!buf || stopped) return;
    src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    src.loopStart = PAD; src.loopEnd = buf.duration - PAD;
    src.connect(g);
    src.start(0, PAD + Math.random() * (buf.duration - 2 * PAD) * 0.8);   // never the same start twice
    g.gain.setTargetAtTime(vol(), ac.currentTime, 0.03);
  };
  const b = buffers.get(name);
  if (b instanceof AudioBuffer) start(b); else load(name).then(start);
  return {
    level(v) {
      if (stopped || Math.abs(v - want) < 0.02) return;
      want = v;
      if (src) g.gain.setTargetAtTime(vol(), ac.currentTime, 0.04);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (!src) return;
      g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      src.stop(ac.currentTime + 0.4);
    },
  };
}

/** The stand's music (or the coffee shop's song): on while it's open (if its switch is on), faded out when it closes. */
export function startMusic(song = MUSIC) {
  if (music || !soundOn() || !musicOn() || !context()) return;
  const mine = { src: null, gain: ac.createGain(), off: false };
  music = mine;
  mine.gain.gain.value = 0; mine.gain.connect(master);
  Promise.resolve(load(song)).then((buf) => {
    if (!buf || mine.off) return;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    src.loopStart = PAD; src.loopEnd = buf.duration - PAD;
    src.connect(mine.gain); src.start(0, PAD);
    mine.src = src;
    mine.gain.gain.setTargetAtTime(MUSIC_GAIN, ac.currentTime, 0.8);
  });
}
export function stopMusic() {
  if (!music) return;
  const m = music; music = null; m.off = true;
  if (!m.src) return;
  m.gain.gain.setTargetAtTime(0, ac.currentTime, 0.25);
  m.src.stop(ac.currentTime + 1.5);
}
/** The top bar's switch. Returns whether it's now on. */
export function toggleMusic() {
  const on = !musicOn();
  store.setSetting('gelMusic', on);
  if (on) startMusic(); else stopMusic();
  return on;
}
