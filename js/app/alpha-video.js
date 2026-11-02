// alpha-video.js — a see-through video clip that plays smoothly on iPhone.
//
// Safari can't draw a WebM's transparency, and the animated WebP it fell back to is decoded
// frame by frame on the CPU, which stutters. Here the clip is an ordinary H.264 MP4 (which
// every iPhone decodes in hardware) with the colour in its top half and the transparency, as
// grey, in its bottom half (tools: see docs/REWARDS.md). A tiny WebGL shader puts the two back
// together into a transparent canvas, one video frame at a time.

const VS = `attribute vec2 p; varying vec2 uv;
void main() { uv = vec2((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision mediump float; varying vec2 uv; uniform sampler2D t;
void main() {
  vec3 c = texture2D(t, vec2(uv.x, uv.y * 0.5)).rgb;
  float a = texture2D(t, vec2(uv.x, 0.5 + uv.y * 0.5)).r;
  gl_FragColor = vec4(c * a, a);
}`;

/** Can this device draw the clip (WebGL in a canvas)? */
export function alphaVideoOk() {
  try { return !!document.createElement('canvas').getContext('webgl', { premultipliedAlpha: true }); } catch { return false; }
}

/**
 * A canvas showing `src` (a stacked MP4), `size` px square on the page.
 * Returns { canvas, video, play() → Promise, stop() }. `onEnded` runs when the clip ends,
 * `onFirstFrame` once its first frame is drawn.
 */
export function makeAlphaVideo(src, { size = 448, onEnded = null, onFirstFrame = null } = {}) {
  const video = document.createElement('video');
  Object.assign(video, { src, muted: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
  // kept in the page (iPhone won't decode a detached or display:none video) but invisible
  Object.assign(video.style, { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = canvas.height = Math.round(size * dpr);
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  const sh = (type, code) => { const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]
    .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);

  let running = false; let drawn = false;
  const draw = () => {
    if (video.readyState < 2) return;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!drawn) { drawn = true; onFirstFrame?.(); }
  };
  // one draw per video frame where the browser can say when one is ready; else every screen frame
  const loop = () => {
    if (!running) return;
    draw();
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(loop); else requestAnimationFrame(loop);
  };
  video.addEventListener('ended', () => { running = false; draw(); onEnded?.(); });
  return {
    canvas, video,
    play() {
      running = true;
      const p = video.play();
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(loop); else requestAnimationFrame(loop);
      return p;
    },
    stop() { running = false; video.pause(); },
  };
}
