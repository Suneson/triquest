// fps-meter.js — a small frame meter for testing smoothness on a real phone. Open the app with
// ?fps=1 (it stays on till ?fps=0). Each second it shows the frames drawn, the slowest frame,
// and how many frames in the last 10 s took over 50 ms (a hitch you can feel).

const KEY = 'moske-fps';

export function maybeFpsMeter() {
  try {
    const q = new URLSearchParams(location.search).get('fps');
    if (q != null) localStorage.setItem(KEY, q === '1' ? '1' : '0');
    if (localStorage.getItem(KEY) !== '1') return;
  } catch { return; }
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:8px;top:calc(env(safe-area-inset-top) + 4px);z-index:99999;pointer-events:none;'
    + 'font:600 11px/1.3 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.65);padding:4px 6px;border-radius:6px;white-space:pre';
  document.body.append(el);
  let last = performance.now(); let n = 0; let worst = 0; let since = last;
  const hitches = [];
  const tick = (now) => {
    const dt = now - last; last = now; n++;
    if (dt > worst) worst = dt;
    if (dt > 50 && document.visibilityState === 'visible') hitches.push(now);
    if (now - since >= 1000) {
      while (hitches.length && now - hitches[0] > 10000) hitches.shift();
      el.textContent = `${Math.round((n * 1000) / (now - since))} fps  worst ${Math.round(worst)} ms\nhitches/10s ${hitches.length}`;
      n = 0; worst = 0; since = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
