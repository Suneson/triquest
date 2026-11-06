"""sheets.py — one repaint sheet per item: facing a on the left, b on the right, same scale, on green.

    python3 tools/render-items/sheets.py <renders dir> <out dir>

<renders dir> holds <item>-a.png and <item>-b.png (RGBA, from render-batch2.py). Pillow, numpy.
"""
import glob, os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
W, H, PAD, GAP = 2048, 1024, 60, 120

def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox())

def on_green(im):
    a = np.asarray(im).astype(float) / 255; al = a[..., 3:4]
    return Image.fromarray(((a[..., :3] * al + np.array([0, 1, 0.0]) * (1 - al)) * 255).astype(np.uint8))

for f in sorted(glob.glob(os.path.join(src, '*-a.png'))):
    n = os.path.basename(f)[:-6]
    A, B = trim(Image.open(f)), trim(Image.open(os.path.join(src, f'{n}-b.png')))
    k = min((H - 2 * PAD) / max(A.height, B.height), (W - 2 * PAD - GAP) / (A.width + B.width))
    A = A.resize((round(A.width * k), round(A.height * k)), Image.LANCZOS)
    B = B.resize((round(B.width * k), round(B.height * k)), Image.LANCZOS)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x0 = (W - A.width - GAP - B.width) // 2
    c.paste(A, (x0, H - PAD - A.height), A); c.paste(B, (x0 + A.width + GAP, H - PAD - B.height), B)
    on_green(c).save(os.path.join(out, f'{n}.jpg'), quality=93)
    print(n)
