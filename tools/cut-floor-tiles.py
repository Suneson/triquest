"""cut-floor-tiles.py: the floor squares (PromptQueue floor-tiles.csv) made into the game's paint textures.

    python tools/cut-floor-tiles.py <Tiles dir>

Each 2048 square is evened out (its slow light falloff divided away, so a painted patch has no dark corners)
and, where the take needs it, made seamless (blended with itself shifted half a square, the shifted copy taking over near the edges,
so the edges match whatever the take drew there). Saved as icons/Tiles/<id>.webp (512 px, one texture
covers several floor tiles, js/core/floor-paint.js) and <id>-s.webp (112 px, the tray's swatch).
"""
import glob, os, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'icons', 'Tiles')


def flatten(a):
    """Divide away the slow light falloff (a blur much bigger than the pattern), keeping the mean colour."""
    img = Image.fromarray(a.astype(np.uint8))
    low = np.asarray(img.resize((16, 16), Image.BOX).resize(img.size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(40))).astype(float)
    mean = a.reshape(-1, 3).mean(0)
    return np.clip(a / np.maximum(low, 1) * mean, 0, 255)


def seamless(a):
    h, w, _ = a.shape
    s = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    # weight of the original: 1 in the middle, 0 at the edges (where the shifted copy's middle is)
    y = np.abs(np.linspace(-1, 1, h))[:, None]; x = np.abs(np.linspace(-1, 1, w))[None, :]
    d = np.maximum(x, y)
    wgt = np.clip((1 - d) / 0.35, 0, 1) ** 1.5
    return a * wgt[..., None] + s * (1 - wgt[..., None])


# the takes that need it: falloff evened on the plain surfaces with dark corners, the blend on organic ones
# (geometric patterns and lines are left as drawn: they already tile, and the blend would ghost them)
FLAT = {'clay-court', 'composite-deck', 'blue-track', 'rubber-track', 'club-parquet'}
SEAM = {'clay-court', 'grass-lush', 'gravel', 'pebbles', 'sand', 'flowerbed', 'club-terrazzo'}


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for p in sorted(glob.glob(os.path.join(src, 'tile-*.jpg'))):
        name = os.path.splitext(os.path.basename(p))[0][5:]
        a = np.asarray(Image.open(p).convert('RGB').resize((1024, 1024), Image.LANCZOS)).astype(float)
        if name in FLAT: a = flatten(a)
        if name in SEAM: a = seamless(a)
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        im.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, f'{name}.webp'), quality=82, method=6)
        im.resize((112, 112), Image.LANCZOS).save(os.path.join(OUT, f'{name}-s.webp'), quality=80, method=6)
        print(name)


if __name__ == '__main__':
    main()
