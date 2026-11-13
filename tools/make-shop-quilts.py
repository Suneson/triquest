# make-shop-quilts.py: the market's four shop backgrounds (gym purple, run red, bike yellow,
# swim blue) from the app's blue quilt (icons/UI/bg/quilt-src.jpg).
#
# The quilt repeats every ~245.4 px down and ~186.2 px across. It is stretched a hair so those
# become whole pixels, and a band exactly 8 repeats tall is cut out, so the tile repeats down the
# shop with no seam. Each copy is then recoloured: the quilt's light and shade mapped from its own
# dark and light blue onto the sport's.
#   python tools/make-shop-quilts.py   -> icons/Market/shop/quilt-<sport>.webp
from PIL import Image
import numpy as np

SRC = 'icons/UI/bg/quilt-src.jpg'
PY, PX = 1963 / 8, 1117 / 6          # measured repeats
TY, TX = 245, 186                     # whole-pixel repeats
OUT_W = 720
SPORTS = {                            # dark, light
    'gym':  ((0x4E, 0x27, 0x8C), (0xA9, 0x7A, 0xEE)),
    'run':  ((0x92, 0x1C, 0x28), (0xF2, 0x6B, 0x6F)),
    'bike': ((0xC2, 0x84, 0x0C), (0xFF, 0xDB, 0x5E)),
    'swim': ((0x1C, 0x56, 0xA6), (0x62, 0xB2, 0xF6)),
}

im = Image.open(SRC).convert('RGB')
W, H = im.size
im = im.resize((round(W * TX / PX), round(H * TY / PY)), Image.LANCZOS)
W, H = im.size
top = (H - 8 * TY) // 2
band = np.asarray(im.crop((0, top, W, top + 8 * TY))).astype(float)
g = band.mean(2)
lo, hi = np.percentile(g, [1, 99])
t = np.clip((g - lo) / (hi - lo), 0, 1)[..., None]
h = round(OUT_W * band.shape[0] / band.shape[1])
for sport, (dark, light) in SPORTS.items():
    d, l = np.array(dark, float), np.array(light, float)
    out = Image.fromarray((d + (l - d) * t).astype(np.uint8)).resize((OUT_W, h), Image.LANCZOS)
    out.save(f'icons/Market/shop/quilt-{sport}.webp', quality=82, method=6)
    print(sport, out.size)
