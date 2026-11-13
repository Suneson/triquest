# cut-stadium.py: the stadium picture for the race (js/app/stadium3d.js), from the green-screen render.
#
#   python tools/cut-stadium.py "<MOSKE APP>/Rooms/Stadium/Run track-upscale-2x.jpg"
#
# Keys out the green, trims to the stadium, scales it to 2048 px wide and writes
# icons/Stadium/stadium.webp. Then it measures the track in the result (its centre, the inner
# kerb's half width and half height, the track's width across and down) and prints them for PIC in
# stadium3d.js. The picture looks down at the track at a slant: the track's width down the screen
# over its width across is sin(tilt).
import sys, os
import numpy as np
from PIL import Image

src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons', 'Stadium', 'stadium.webp')
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
# how green a pixel is beyond its red and blue: 0 on the stadium, high on the screen
spill = g - np.maximum(r, b)
a = np.clip(1 - (spill - 30) / 50, 0, 1)
# take the green cast off the soft edge
g2 = np.minimum(g, np.maximum(r, b) + 4)
rgba = np.dstack([r, np.where(a < 1, g2, g), b, a * 255]).clip(0, 255).astype(np.uint8)
ys, xs = np.where(a > 0.5)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
pic = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
W = 2048
k = W / pic.width
pic = pic.resize((W, round(pic.height * k)), Image.LANCZOS)
pic.save(out, 'WEBP', quality=86, method=6)
print('wrote', out, pic.size, f'{os.path.getsize(out) / 1024:.0f} KB')

# measure the track (its red) in the source, where it is sharpest, then bring it to the written size
track = (r > 170) & (g > 70) & (g < 140) & (b > 40) & (b < 110)
def runs(line):
    out, on, s = [], False, 0
    for i, v in enumerate(line):
        if v and not on: s = i
        if not v and on and i - s > 8: out.append((s, i - 1))
        on = v
    return out
# a column through the straights: [outer lane, inner lane] above the infield, the same below
col = runs(track[:, (x0 + x1) // 2])
top, inner_top, inner_bot, bot = col[0][0], col[1][1], col[2][0], col[3][1]
cy = (top + bot) / 2
row = runs(track[round(cy), :])
left, right = row[0][0], row[-1][1]
cx = (left + right) / 2
inner_x = row[-2][0] - cx            # the inner kerb's half width (row: two lanes each side)
inner_y = cy - inner_top             # and half height
across = right - row[-2][0]          # the track's width across, at a bend
down = inner_top - top               # and down, on a straight
m = lambda v: v * k
print(f'PIC = {{ w: {W}, h: {pic.height}, cx: {m(cx - x0):.1f}, cy: {m(cy - y0):.1f}, innerX: {m(inner_x):.1f}, innerY: {m(inner_y):.1f}, across: {m(across):.1f}, down: {m(down):.1f} }}; sin(tilt) {down / across:.4f}')
