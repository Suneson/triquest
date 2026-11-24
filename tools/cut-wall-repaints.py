"""cut-wall-repaints.py: a theme's repainted walls back on the base, over their 3D shadows.

    python tools/cut-wall-repaints.py <themes dir> <theme> [side=k ...] [--tag t4] [--test]

  <themes dir>  MOSKE APP/Characters/Photos/Robots/Robots/Base/themes
  <theme>       e.g. 05-navy-club: its repaint/ folder holds what tools/bake-walls.html?repaint=1 rendered (layout.json,
                <side>-render.png, <side>-shade.png) and the repaints of it (<side>-paint-<k>.jpg|png, from
                MOSKE APP/Island/make-wall-repaint-csv.py)
  side=k        which repaint try to take for a side (1 by default), e.g. road=2
  --test        use the renders themselves as the repaints (checks the fitting)

Each repaint is scaled back onto its render, nudged to sit exactly on it (the best overlap of their outlines), keyed
off its green and cut to the render's outline (so nothing Gemini added sticks out), then laid over the side's own
shadow and trimmed. Writes icons/Plot/walls-<slug>-<side>-<tag>.webp and walls-<slug>-<tag>.json, which cut-walls.py
takes as that level's walls.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, 'icons', 'Plot')


def key(rgb):
    """Alpha off flat green (pure or a little shaded), and the green spill pulled back at the edge."""
    a = rgb.astype(float); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)
    bg = float(np.median(np.r_[d[:16, :16].ravel(), d[:16, -16:].ravel(), d[-16:, :16].ravel(), d[-16:, -16:].ravel()]))
    bg = max(bg, 120.0)
    alpha = np.clip((bg * 0.75 - d) / (bg * 0.25), 0, 1)
    g2 = np.where(alpha < 0.98, np.minimum(g, np.maximum(r, b) + 8), g)
    return np.dstack([r, g2, b]), alpha


def fit(mask_r, mask_p, reach=16):
    """The shift (dx, dy) of the repaint's outline that best overlaps the render's, at a quarter size."""
    k = 4
    a = mask_r[::k, ::k]; b = mask_p[::k, ::k]
    best = (-1, 0, 0); R = reach // k
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            s = np.roll(np.roll(b, dy, 0), dx, 1)
            iou = (a & s).sum() / max(1, (a | s).sum())
            if iou > best[0]: best = (iou, dx * k, dy * k)
    return best


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--') and '=' not in a]
    picks = dict(a.split('=') for a in sys.argv[1:] if '=' in a and not a.startswith('--'))
    tag = sys.argv[sys.argv.index('--tag') + 1] if '--tag' in sys.argv else 't4'
    test = '--test' in sys.argv
    src, theme = args[0], args[1]
    rp = os.path.join(src, theme, 'repaint')
    lay = json.load(open(os.path.join(rp, 'layout.json'), encoding='utf-8'))
    slug, store = lay['slug'], lay['store']
    info = {'theme': slug, 'back': [], 'front': []}
    for s in lay['sides']:
        side = s['side']; r = s['render']
        render = np.asarray(Image.open(os.path.join(rp, f'{side}-render.png')).convert('RGB'))
        _, ar = key(render)
        if test:
            paint = render
        else:
            k = picks.get(side, '1')
            f = next((os.path.join(rp, f'{side}-paint-{k}.{e}') for e in ('png', 'jpg', 'jpeg')
                      if os.path.exists(os.path.join(rp, f'{side}-paint-{k}.{e}'))), None)
            # a side with no repaint yet keeps its 3D render
            paint = np.asarray(Image.open(f).convert('RGB').resize((r['w'], r['h']), Image.LANCZOS)) if f else render
            if not f: print(side, 'no repaint', k, '- the render for now')
        rgb, ap = key(paint)
        iou, dx, dy = fit(ar > 0.5, ap > 0.5)
        if iou < 0.9:
            # Gemini moved or zoomed it: scale the repaint's outline box onto the render's, then fit again
            def bbox(m):
                ys, xs = np.nonzero(m); return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            rb, pb = bbox(ar > 0.5), bbox(ap > 0.5)
            piece = Image.fromarray(np.asarray(paint)[pb[1]:pb[3], pb[0]:pb[2]]).resize((rb[2] - rb[0], rb[3] - rb[1]), Image.LANCZOS)
            canvas = Image.new('RGB', (r['w'], r['h']), (0, 255, 0)); canvas.paste(piece, (rb[0], rb[1]))
            rgb, ap = key(np.asarray(canvas))
            iou, dx, dy = fit(ar > 0.5, ap > 0.5)
            print(side, 'refit by its outline box')
        rgb = np.roll(np.roll(rgb, dy, 0), dx, 1); ap = np.roll(np.roll(ap, dy, 0), dx, 1)
        # cut to the render's outline, a hair wider so the painted edge stays soft
        out_r = nd.binary_dilation(ar > 0.5, iterations=2)
        alpha = np.minimum(ap, nd.gaussian_filter(out_r.astype(float), 1.0))
        walls = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
        walls = walls[r['oy']:r['oy'] + r['sh'], r['ox']:r['ox'] + r['sw']]
        walls = Image.fromarray(walls, 'RGBA').resize((s['W'], s['H']), Image.LANCZOS)
        pic = Image.open(os.path.join(rp, f'{side}-shade.png')).convert('RGBA')
        pic.alpha_composite(walls)
        bb = pic.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox()
        pic = pic.crop(bb)
        name = f'walls-{slug}-{side}-{tag}.webp'
        pic.save(os.path.join(OUT, name), quality=86, method=6)
        info[s['layer']].append({'src': f'icons/Plot/{name}', 'x': round(s['x0'] + bb[0] / store, 1), 'y': round(s['y0'] + bb[1] / store, 1),
                                 'w': round(pic.width / store, 1), 'h': round(pic.height / store, 1)})
        print(side, 'fit %.3f' % iou, 'shift', dx, dy, pic.size)
    json.dump(info, open(os.path.join(OUT, f'walls-{slug}-{tag}.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
