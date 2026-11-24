// chest-fx.js: the particles of a chest opening (chest-view.js openChestModal), on one canvas over the stage.
//
//   puff(x, y)      a tap on the shut chest: a few sparks jump off it
//   charge(x, y, ms) the build-up: sparks are pulled into the chest from all round
//   burst(x, y, k)  the chest breaks open: a ring of shards and glowing sparks, k = how big (by tier)
//   drift(x, y)     the open chest: sparkles keep rising out of it until stop()
//
// Drawn additively ('lighter'), so they glow over the dark stage; only transform-free canvas drawing, one
// requestAnimationFrame loop that stops when nothing's left. Nothing at all with reduced motion.

export function makeChestFx(canvas, color, { calm = false } = {}) {
  const ctx = canvas.getContext('2d');
  const parts = [];
  let raf = 0; let last = 0; let drifting = null; let dead = false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  };
  size();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
  ro?.observe(canvas);
  const tint = [color, '#FFFFFF', '#FFF3C4'];

  const add = (p) => { if (!calm && !dead) { parts.push(p); if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } } };
  const spark = (x, y, a, v, o = {}) => add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: o.life ?? 0.7 + Math.random() * 0.5,
    r: o.r ?? 2 + Math.random() * 3, c: o.c ?? tint[(Math.random() * tint.length) | 0], g: o.g ?? 900, drag: o.drag ?? 1.6,
    kind: o.kind ?? 'dot', spin: (Math.random() - 0.5) * 12, rot: Math.random() * 6, to: o.to });

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (drifting && Math.random() < dt * drifting.rate) {
      spark(drifting.x + (Math.random() - 0.5) * drifting.w, drifting.y, -Math.PI / 2 + (Math.random() - 0.5) * 0.5, 60 + Math.random() * 90,
        { g: -40, drag: 0.4, life: 1.4 + Math.random(), r: 1.5 + Math.random() * 2.5, kind: Math.random() < 0.35 ? 'star' : 'dot' });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      if (p.to) {             // pulled in: eased toward the chest
        const k = Math.min(1, p.life / p.max) ** 2;
        p.x = p.sx + (p.to.x - p.sx) * k; p.y = p.sy + (p.to.y - p.sy) * k;
      } else {
        p.vx *= Math.exp(-p.drag * dt); p.vy = p.vy * Math.exp(-p.drag * dt) + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      p.rot += p.spin * dt;
      const t = p.life / p.max;
      ctx.globalAlpha = p.to ? Math.min(1, t * 3) : (1 - t) ** 1.4;
      ctx.fillStyle = p.c;
      const r = p.r * (p.kind === 'shard' ? 1 : 1 - t * 0.4);
      if (p.kind === 'dot') {
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2); ctx.fill();
      } else {               // a four-point star, or a long shard
        const L = p.kind === 'shard' ? r * 4 : r * 2.4; const w = p.kind === 'shard' ? r * 0.7 : r * 0.55;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.kind === 'shard' ? Math.atan2(p.vy, p.vx) : p.rot);
        ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(0, w); ctx.lineTo(-L, 0); ctx.lineTo(0, -w); ctx.closePath(); ctx.fill();
        if (p.kind === 'star') { ctx.beginPath(); ctx.moveTo(0, L); ctx.lineTo(w, 0); ctx.lineTo(0, -L); ctx.lineTo(-w, 0); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    raf = parts.length || drifting ? requestAnimationFrame(step) : 0;
  }

  return {
    puff(x, y, n = 10) {
      for (let i = 0; i < n; i++) spark(x + (Math.random() - 0.5) * 60, y, -Math.PI / 2 + (Math.random() - 0.5) * 2.2, 220 + Math.random() * 260, { life: 0.5 + Math.random() * 0.3 });
    },
    charge(x, y, ms) {
      const n = Math.round(ms / 22);
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          const a = Math.random() * Math.PI * 2; const d = 140 + Math.random() * 120;
          const sx = x + Math.cos(a) * d; const sy = y + Math.sin(a) * d;
          add({ x: sx, y: sy, sx, sy, to: { x, y }, life: 0, max: 0.45, r: 1.5 + Math.random() * 2.5, c: tint[i % 3], kind: 'dot', rot: 0, spin: 0 });
        }, (i / n) * ms * 0.85);
      }
    },
    burst(x, y, k = 1) {
      const n = Math.round(40 * k);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        spark(x, y, a, (380 + Math.random() * 520) * Math.sqrt(k), { kind: i % 3 === 0 ? 'shard' : 'dot', r: 2.5 + Math.random() * 3.5, g: 520, drag: 2.2, life: 0.8 + Math.random() * 0.6 });
      }
      for (let i = 0; i < 14 * k; i++) spark(x, y, -Math.PI / 2 + (Math.random() - 0.5) * 1.6, 500 + Math.random() * 500, { kind: 'star', r: 3 + Math.random() * 3, g: 700, life: 1.1 + Math.random() * 0.5 });
    },
    drift(x, y, w = 120, rate = 14) { drifting = { x, y, w, rate }; add({ x, y, vx: 0, vy: 0, life: 0, max: 0.01, r: 0, c: color, g: 0, drag: 0, kind: 'dot', rot: 0, spin: 0 }); },
    stopDrift() { drifting = null; },
    stop() { dead = true; drifting = null; parts.length = 0; cancelAnimationFrame(raf); raf = 0; ro?.disconnect(); },
  };
}
