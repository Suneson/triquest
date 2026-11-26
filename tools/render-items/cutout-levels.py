"""cutout-levels.py: cut the item levels' repainted two-view sheets into icons/Items/<item>-lv<n>-<a|b>.webp.

    python tools/render-items/cutout-levels.py "<repaint folder>" [--preview out.jpg] [--only name,name]

Each repaint (from item-levels-repaint.csv / item-levels-up.csv, MOSKE APP/Island/ITEM-LEVELS.md) is one
item with facing a on the left and facing b on the right, on green. Gemini changes the canvas size, so the
two are split at the empty column between them, not at the middle. Where the folder holds several repaints
of one name (<name>.jpg, <name>_v2.jpg, ..) the latest is used. <name>-back (the four-sided pool start
block's other two sides) becomes facings c and d. Keyed as cutout-green.py does, painted shadow kept.
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
    only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
    done = []
    for name, f in latest(folder).items():
        if only and name not in only: continue
        im = Image.open(os.path.join(folder, f)).convert('RGB')
        # about 2048 wide, as the sheets were made
        k = 2048 / im.width
        rgb = np.asarray(im.resize((2048, round(im.height * k)), Image.LANCZOS))
        obj, core, dark = cg.key(rgb)
        try:
            at = cg.split_at(core)
        except SystemExit:
            at = rgb.shape[1] // 2
            print('no gap, split at the middle:', name)
        sides, out = ('cd', name[:-5]) if name.endswith('-back') else ('ab', name)
        for side, xs in zip(sides, (slice(0, at), slice(at, None))):
            if not core[:, xs].any():
                print('empty', name, side); continue
            piece = cg.one(rgb[:, xs], obj[:, xs], core[:, xs], dark[:, xs])
            piece.save(os.path.join(cg.OUT, f'{out}-{side}.webp'), quality=88, method=6)
            done.append(piece)
        print(name, f)
    if pv:
        cols, tile = 12, 160
        rows = (len(done) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * tile, rows * tile), (150, 165, 190))
        for i, im in enumerate(done):
            t = im.copy(); t.thumbnail((tile - 6, tile - 6), Image.LANCZOS)
            sheet.paste(t, (i % cols * tile + 3, i // cols * tile + 3), t)
        sheet.save(pv, quality=85)


if __name__ == '__main__':
    main()
