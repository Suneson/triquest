"""sheets4.py: one repaint sheet per item with all four facings, two by two, same scale, on green.

    python tools/render-items/sheets4.py <renders dir> <out dir>

<renders dir> holds <item>-a.png .. -d.png (RGBA, from render-club4.py). The sheet is 2048 x 2048:
a top left, b top right, c bottom left, d bottom right, each standing on the bottom of its own
quarter and centred in it. <out>/<item>-sheet.jpg, plus <item>-sheet.json with where each view
sits, so the repainted sheet can be cut back into the four facings. Pillow, numpy.
"""
import glob, json, os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
S, PAD = 2048, 70          # the sheet, and the margin round each view inside its quarter
Q = S // 2

def trim(im):
    box = im.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox()
    return im.crop(box)

def on_green(im):
    a = np.asarray(im).astype(float) / 255; al = a[..., 3:4]
    return Image.fromarray(((a[..., :3] * al + np.array([0, 1, 0.0]) * (1 - al)) * 255).astype(np.uint8))

for f in sorted(glob.glob(os.path.join(src, '*-a.png'))):
    n = os.path.basename(f)[:-6]
    views = {k: trim(Image.open(os.path.join(src, f'{n}-{k}.png'))) for k in 'abcd'
             if os.path.exists(os.path.join(src, f'{n}-{k}.png'))}
    if len(views) < 4: print('skip', n, 'has', ''.join(views)); continue
    # one scale for all four, so they stay the same size as each other
    k = min(min((Q - 2 * PAD) / v.width, (Q - 2 * PAD) / v.height) for v in views.values())
    c = Image.new('RGBA', (S, S), (0, 0, 0, 0)); where = {}
    for i, (face, v) in enumerate(views.items()):
        v = v.resize((round(v.width * k), round(v.height * k)), Image.LANCZOS)
        qx, qy = (i % 2) * Q, (i // 2) * Q
        x, y = qx + (Q - v.width) // 2, qy + Q - PAD - v.height
        c.paste(v, (x, y), v); where[face] = [x, y, v.width, v.height]
    on_green(c).save(os.path.join(out, f'{n}-sheet.jpg'), quality=93)
    json.dump({'scale': k, 'views': where}, open(os.path.join(out, f'{n}-sheet.json'), 'w'))
    print(n)
