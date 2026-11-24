"""cut-bottles.py: the MOSKE sports bottles (boosts, MOSKE APP/Island/BOTTLES.md), keyed off their green and
trimmed, as icons/Bottles/<id>.webp (384 px tall) with a 96 px small copy.

    python tools/cut-bottles.py <bottles dir>

  <bottles dir>  MOSKE APP/Characters/Photos/Robots/Robots/Items/Bottles (<id>-<k>.jpg|png)
"""
import importlib.util, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cutplot', os.path.join(HERE, 'cut-plot.py'))
cp = importlib.util.module_from_spec(spec); spec.loader.exec_module(cp)

OUT = os.path.join(cp.REPO, 'icons', 'Bottles')
# the picture picked for each bottle
PICK = {'build-brew': 'build-brew-1.jpg', 'electro-surge': 'electro-surge-2.jpg', 'recovery-mix': 'recovery-mix-2.jpg',
        'vo2-max': 'vo2-max-1.jpg', 'chest-charge': 'chest-charge-1.jpg'}
H = 384


def key(rgb):
    """RGBA off pure #00FF00: only what's nearly that green goes (an emerald bottle stays), and the green spill
    is pulled back only at the edge."""
    from scipy import ndimage as nd
    a = rgb.astype(float); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)                           # the background is about 230 and up
    alpha = np.clip((200 - d) / 50, 0, 1)
    solid = nd.binary_fill_holes(alpha > 0.5)          # inside the bottle nothing is see-through
    alpha = np.where(solid, np.maximum(alpha, nd.binary_erosion(solid, iterations=3)), alpha)
    alpha = nd.gaussian_filter(alpha, 0.6)
    edge = solid & ~nd.binary_erosion(solid, iterations=4)
    g2 = np.where(edge | (alpha < 0.98), np.minimum(g, np.maximum(r, b) + 10), g)
    return np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for bid, f in PICK.items():
        p = os.path.join(src, f)
        if not os.path.exists(p): print('missing', f); continue
        im = Image.fromarray(key(np.asarray(Image.open(p).convert('RGB'))), 'RGBA')
        bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        im = im.crop(bb)
        pad = round(im.height * 0.04)
        box = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad)); box.paste(im, (pad, pad))
        for h, tag in ((H, ''), (96, '-s')):
            w = round(box.width * h / box.height)
            box.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f'{bid}{tag}.webp'), quality=90, method=6)
        print(bid, box.size)


if __name__ == '__main__':
    main()
