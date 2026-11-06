"""cut-room.py — a repainted room on a green screen into the app's picture.

    python tools/cut-room.py <repaint> <out.webp> back=x,y right=x,y left=x,y [width=2200]

back, right and left are the floor's corners in px of the repaint, where the floor meets the walls.
Prints the corners as % of the cut picture and its size, for ROOM_GEOMETRY and ROOM_SIZE in
js/core/placement.js. Build-time only (Pillow, numpy).
"""
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1:3]
opts = dict(a.split('=') for a in sys.argv[3:])
corners = {k: tuple(float(n) for n in opts[k].split(',')) for k in ('back', 'right', 'left')}
width = int(opts.get('width', 2200))
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
top = np.maximum(r, b)
alpha = np.clip((0.62 - (g - top) / np.maximum(g, 1)) / 0.34, 0, 1)
rgb[..., 1] = np.where(alpha < 0.98, np.minimum(g, top * 1.02 + 4), g)
im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
x0, y0, x1, y1 = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
im = im.crop((x0, y0, x1, y1))
W, H = im.size
im = im.resize((width, round(H * width / W)), Image.LANCZOS)
im.save(out, quality=88, method=6)
print('ROOM_SIZE', list(im.size))
for k, (x, y) in corners.items():
    print(k, [round((x - x0) / W * 100, 2), round((y - y0) / H * 100, 2)])
