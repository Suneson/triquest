"""cut-base-repaints.py: the Navy Club base's repainted sheets (a | b on green, from base-navy-repaint.csv),
keyed and fitted back onto their Blender renders, so tools/cut-plot.py can place them as it placed the renders.

    python tools/render-items/cut-base-repaints.py <repaint dir> <renders dir> <out dir>

<repaint dir>  Base/repaint: <name>.jpg (a newer <name>_v2.jpg wins), or Base/repaint2: tries <name>-<k>.png
[picks]        name-k,name-k: the try to use (default: the one whose shape is closest to the render)
<renders dir>  render-base-assets.py's <name>-<a|b>.png + .json
<out dir>      gets <name>-<a|b>.png (the repaint, in the render's frame) + a copy of its json

The repaint doesn't keep the render's frame exactly (Gemini changes the canvas), so each facing is fitted
by its bounding box (the same width, centred, on the same bottom line), and a pad, which is flat and drawn at a
slightly different angle, by a perspective warp of its four corners onto the render's.
"""
import glob, json, os, shutil, sys
import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
cg = importlib.import_module('cutout-green')
cg.MAX_SIDE = 100000   # no shrinking: the fit scales it

SOLID = 200  # alpha above this is the object, not its shadow


def solid_box(im):
    return im.getchannel('A').point(lambda v: 255 if v > SOLID else 0).getbbox()


def corners(im):
    """The object's top, right, bottom and left extremes (its solid part)."""
    a = np.asarray(im.getchannel('A')) > SOLID
    ys, xs = np.nonzero(a)
    return np.float32([(xs[np.argmin(ys)], ys.min()), (xs.max(), ys[np.argmax(xs)]), (xs[np.argmax(ys)], ys.max()), (xs.min(), ys[np.argmin(xs)])])


def warp_onto(im, ren):
    """A flat piece (a pad): its four extremes pulled onto the render's with a perspective warp, so a repaint
    drawn at a slightly different angle lines up with the grid."""
    H = cv2.getPerspectiveTransform(corners(im), corners(ren))
    pm = np.asarray(im).astype(np.float32); pm[..., :3] *= pm[..., 3:4] / 255
    out = cv2.warpPerspective(pm, H, ren.size, flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0, 0))
    a = np.clip(out[..., 3:4], 0, 255)
    out[..., :3] = np.where(a > 0.5, out[..., :3] * 255 / np.maximum(a, 1e-3), 0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def faces(f):
    rgb = np.asarray(Image.open(f).convert('RGB'))
    obj, core, dark = cg.key(rgb)
    x = cg.split_at(core)
    return {face: cg.one(rgb[:, sl], obj[:, sl], core[:, sl], dark[:, sl]) for face, sl in (('a', slice(0, x)), ('b', slice(x, None)))}


def shape_error(n, ims, renders):
    """How far a try's height/width is from the render's, worst facing (0.05 = 5%)."""
    worst = 0
    for face, im in ims.items():
        rb, pb = solid_box(Image.open(os.path.join(renders, f'{n}-{face}.png')).convert('RGBA')), solid_box(im)
        r = ((pb[3] - pb[1]) / (pb[2] - pb[0])) / ((rb[3] - rb[1]) / (rb[2] - rb[0]))
        worst = max(worst, abs(r - 1))
    return worst


def main():
    src, renders, out = sys.argv[1:4]
    picks = dict(p.rsplit('-', 1) for p in sys.argv[4].split(',')) if len(sys.argv) > 4 else {}
    os.makedirs(out, exist_ok=True)
    files = glob.glob(os.path.join(src, '*.jpg')) + glob.glob(os.path.join(src, '*.png'))
    tries = {}
    for f in files:
        b = os.path.basename(f)[:-4].replace('_v2', '')
        n, k = (b.rsplit('-', 1) if b.rsplit('-', 1)[-1].isdigit() else (b, ''))
        tries.setdefault(n, []).append((k, f))
    for n in sorted(tries):
        cands = []
        for k, f in sorted(tries[n]):
            ims = faces(f); e = shape_error(n, ims, renders)
            cands.append((e, k, f, ims))
            print(f'  {n} try {k or "-"}: shape off {e * 100:.1f}%')
        best = min(cands, key=lambda c: c[0])
        if n in picks: best = next(c for c in cands if c[1] == picks[n])
        if best[0] > 0.04: print(f'  ! {n}: the chosen try is {best[0] * 100:.1f}% off the render')
        for face, im in best[3].items():
            fit(n, best[2], face, im, renders, out)


def fit(n, f, face, im, renders, out):
        ren = Image.open(os.path.join(renders, f'{n}-{face}.png')).convert('RGBA')
        if n.startswith('pad-'):
            warp_onto(im, ren).save(os.path.join(out, f'{n}-{face}.png'))
            shutil.copy(os.path.join(renders, f'{n}-{face}.json'), os.path.join(out, f'{n}-{face}.json'))
            print(f'{n}-{face:1s} {os.path.basename(f):24s} warped onto the render')
            return
        rb, pb = solid_box(ren), solid_box(im)
        s = (rb[2] - rb[0]) / (pb[2] - pb[0])
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        pb = [v * s for v in pb]
        ox = round((rb[0] + rb[2]) / 2 - (pb[0] + pb[2]) / 2); oy = round(rb[3] - pb[3])
        canvas = Image.new('RGBA', ren.size, (0, 0, 0, 0))
        canvas.alpha_composite(im, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
        canvas.save(os.path.join(out, f'{n}-{face}.png'))
        shutil.copy(os.path.join(renders, f'{n}-{face}.json'), os.path.join(out, f'{n}-{face}.json'))
        print(f'{n}-{face:1s} {os.path.basename(f):24s} scale {s:.3f}  height render/repaint {(rb[3] - rb[1]) / (pb[3] - pb[1]):.3f}')


if __name__ == '__main__':
    main()
