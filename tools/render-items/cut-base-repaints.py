"""cut-base-repaints.py: the Navy Club base's repainted sheets (a | b on green, from base-navy-repaint.csv),
keyed and fitted back onto their Blender renders, so tools/cut-plot.py can place them as it placed the renders.

    python tools/render-items/cut-base-repaints.py <repaint dir> <renders dir> <out dir>

<repaint dir>  Base/repaint: <name>.jpg (a newer <name>_v2.jpg wins)
<renders dir>  render-base-assets.py's <name>-a.png + <name>-a.json
<out dir>      gets <name>-a.png (the repaint, in the render's frame) + a copy of <name>-a.json

The repaint doesn't keep the render's frame exactly (Gemini changes the canvas), so facing a's object is fitted
by its bounding box: the same width, centred, standing on the same bottom line.
"""
import glob, json, os, shutil, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
cg = importlib.import_module('cutout-green')
cg.MAX_SIDE = 100000   # no shrinking: the fit scales it

SOLID = 200  # alpha above this is the object, not its shadow


def solid_box(im):
    return im.getchannel('A').point(lambda v: 255 if v > SOLID else 0).getbbox()


def main():
    src, renders, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    names = sorted({os.path.basename(f)[:-4].replace('_v2', '') for f in glob.glob(os.path.join(src, '*.jpg'))})
    for n in names:
        f = os.path.join(src, f'{n}_v2.jpg')
        f = f if os.path.exists(f) else os.path.join(src, f'{n}.jpg')
        rgb = np.asarray(Image.open(f).convert('RGB'))
        obj, core, dark = cg.key(rgb)
        x = cg.split_at(core)
        im = cg.one(rgb[:, :x], obj[:, :x], core[:, :x], dark[:, :x])
        ren = Image.open(os.path.join(renders, f'{n}-a.png')).convert('RGBA')
        rb, pb = solid_box(ren), solid_box(im)
        s = (rb[2] - rb[0]) / (pb[2] - pb[0])
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        pb = [v * s for v in pb]
        ox = round((rb[0] + rb[2]) / 2 - (pb[0] + pb[2]) / 2); oy = round(rb[3] - pb[3])
        canvas = Image.new('RGBA', ren.size, (0, 0, 0, 0))
        canvas.alpha_composite(im, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
        canvas.save(os.path.join(out, f'{n}-a.png'))
        shutil.copy(os.path.join(renders, f'{n}-a.json'), os.path.join(out, f'{n}-a.json'))
        print(f'{n:18s} {os.path.basename(f):24s} scale {s:.3f}  height render/repaint {(rb[3] - rb[1]) / (pb[3] - pb[1]):.3f}')


if __name__ == '__main__':
    main()
