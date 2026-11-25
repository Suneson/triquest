// sfx-bank.js: one-shot sounds from a folder of mp3s, played through Web Audio so a hit lands the moment it's asked
// for (the chest screen's audio/chests/, the base's audio/base/; ElevenLabs takes from chest-base-sounds.csv, made
// ready by tools/make-gel-sounds.py). They follow the app's Sound setting. A sound whose file isn't there yet plays
// its fallback instead (the old synth blip), or nothing.
import * as store from './store.js';

let ac = null; let master = null;
const soundOn = () => !!store.getSettings()?.sound;

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

/** A bank of sounds in `dir`: { name: volume 0-1 }. */
export function sfxBank(dir, volumes) {
  const buffers = new Map();   // name -> its AudioBuffer, or the Promise of one (null: no file)
  const load = (name) => {
    if (buffers.has(name)) return buffers.get(name);
    const p = fetch(`${dir}/${name}.mp3`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
      .then((buf) => { buffers.set(name, buf); return buf; })
      .catch(() => { buffers.set(name, Promise.resolve(null)); return null; });
    buffers.set(name, p);
    return p;
  };
  return {
    /** Fetch and decode them all (inside a tap, so the context may start). */
    warm(names = Object.keys(volumes)) {
      if (!soundOn() || !context()) return;
      names.forEach(load);
    },
    /**
     * Play one. `end` (s): line the sound's end up with that moment from now (a riser that peaks on the burst:
     * a longer sound starts part way in, a shorter one waits). `fallback` plays when the file isn't there.
     * Returns { stop() }.
     */
    play(name, { gain = 1, rate = 1, delay = 0, end = null } = {}, fallback = null) {
      const handle = { stopped: false, src: null, stop() { this.stopped = true; try { this.src?.stop(); } catch { /* not started */ } } };
      if (!soundOn()) return handle;
      if (!context()) { fallback?.(); return handle; }
      const t0 = ac.currentTime;
      const go = (buf) => {
        if (handle.stopped) return;
        if (!buf) { fallback?.(); return; }
        const src = ac.createBufferSource(); handle.src = src; src.buffer = buf; src.playbackRate.value = rate;
        const g = ac.createGain(); g.gain.value = (volumes[name] ?? 0.5) * gain;
        src.connect(g).connect(master);
        let at = t0 + delay; let offset = 0;
        if (end != null) {
          const len = buf.duration / rate;
          if (len > end) offset = (len - end) * rate; else at += end - len;
        }
        // a timed sound that comes in late (still loading) starts where it would be by now; a hit just plays
        const late = ac.currentTime - at;
        if (late > 0) { if (end != null) offset += late * rate; at = ac.currentTime; }
        if (offset >= buf.duration) return;
        src.start(at, offset);
      };
      const b = buffers.get(name);
      if (b instanceof AudioBuffer) go(b); else load(name).then(go);
      return handle;
    },
  };
}
