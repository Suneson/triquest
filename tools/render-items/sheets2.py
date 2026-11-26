"""sheets2.py: one repaint sheet per base item with its two facings side by side, same scale, on green.

    python tools/render-items/sheets2.py <renders dir> <out dir>

<renders dir> holds <item>-a.png and -b.png (RGBA, render-levels.py). The sheet is 2048 x 1024: a on the left,
b on the right, each centred in its half and both standing on the same line. <out>/<item>-sheet.jpg, plus
<item>-sheet.json with where each view sits, so the repainted sheet can be cut back apart. Pillow, numpy.
"""
import glob, json, os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
W, H, PAD = 2048, 1024, 60
HALF = W // 2

def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox())

def on_green(im):
    a = np.asarray(im).astype(float) / 255; al = a[..., 3:4]
    return Image.fromarray(((a[..., :3] * al + np.array([0, 1, 0.0]) * (1 - al)) * 255).astype(np.uint8))

for f in sorted(glob.glob(os.path.join(src, '*-a.png'))):
    n = os.path.basename(f)[:-6]
    b = os.path.join(src, f'{n}-b.png')
    if not os.path.exists(b): continue
    views = {'a': trim(Image.open(f)), 'b': trim(Image.open(b))}
    # one scale for both, so the item is the same size in each
    s = min(min((HALF - 2 * PAD) / v.width, (H - 2 * PAD) / v.height) for v in views.values())
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    info = {'size': [W, H], 'scale': s, 'views': {}}
    for i, (k, v) in enumerate(views.items()):
        v = v.resize((max(1, round(v.width * s)), max(1, round(v.height * s))), Image.LANCZOS)
        x = i * HALF + (HALF - v.width) // 2; y = H - PAD - v.height
        sheet.alpha_composite(v, (x, y))
        info['views'][k] = [x, y, v.width, v.height]
    on_green(sheet).save(os.path.join(out, f'{n}-sheet.jpg'), quality=94)
    json.dump(info, open(os.path.join(out, f'{n}-sheet.json'), 'w'), indent=1)
    print(n)
