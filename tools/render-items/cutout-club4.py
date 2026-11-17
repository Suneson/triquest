"""cutout-club4.py: cut the club room's repainted four-side sheets into icons/Items/<item>-<a|b|c|d>.webp.

    python tools/render-items/cutout-club4.py "<repaint folder>" [--preview out.png]

Each sheet (sheets4.py, repainted in Gemini) is 2048 x 2048 on green: facing a top left, b top
right, c (the back of a) bottom left, d (the back of b) bottom right, one in each quarter. Where
the folder holds several repaints of one item (<item>.jpg, <item>_v2.jpg, ..) the latest is used.
Keyed as cutout-green.py does, its painted shadow kept as a soft black shadow.
"""
import importlib.util, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cg', os.path.join(HERE, 'cutout-green.py'))
cg = importlib.util.module_from_spec(spec); spec.loader.exec_module(cg)


def latest(folder):
    best = {}
    for f in os.listdir(folder):
        m = re.fullmatch(r'(.+?)(?:_v(\d+))?\.(jpe?g|png)', f, re.I)
        if not m: continue
        v = int(m[2] or 1)
        if m[1] not in best or v > best[m[1]][0]: best[m[1]] = (v, f)
    return {n: f for n, (v, f) in sorted(best.items())}


def main():
    folder = sys.argv[1]
    pv = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    done = []
    for name, f in latest(folder).items():
        rgb = np.asarray(Image.open(os.path.join(folder, f)).convert('RGB').resize((2048, 2048), Image.LANCZOS))
        obj, core, dark = cg.key(rgb)
        Q = 1024
        for i, side in enumerate('abcd'):
            ys, xs = slice((i // 2) * Q, (i // 2 + 1) * Q), slice((i % 2) * Q, (i % 2 + 1) * Q)
            if not core[ys, xs].any():
                print('empty', name, side); continue
            im = cg.one(rgb[ys, xs], obj[ys, xs], core[ys, xs], dark[ys, xs])
            im.save(os.path.join(cg.OUT, f'{name}-{side}.webp'), quality=88, method=6)
            done.append(im)
        print(name, f)
    if pv:
        cols, tile = 8, 200
        rows = (len(done) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * tile, rows * tile), (150, 165, 190))
        for i, im in enumerate(done):
            t = im.copy(); t.thumbnail((tile - 6, tile - 6), Image.LANCZOS)
            sheet.paste(t, (i % cols * tile + 3, i // cols * tile + 3), t)
        sheet.save(pv, quality=85)


if __name__ == '__main__':
    main()
