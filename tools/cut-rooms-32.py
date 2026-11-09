"""cut-rooms-32.py: the 32 x 32 room pictures for the game, keyed off their green and measured.

    python tools/cut-rooms-32.py <dir holding LOCKER/ GYM/ BIKE/ RUN/ POOL/>

Writes icons/Pixelart/NEW/<ROOM>/big-10.webp and js/core/room32-art.js. Gemini puts each floor a
little differently, so every room has its own corners, read by eye from the finished picture:
FLOORS holds them as x, y in a picture scaled to 2000 px wide.
"""
import glob, json, os, sys
import cv2
import numpy as np
from PIL import Image

OUT_W = 3400
ROOF_USED = 0.93      # how much of the roof's width the room's outer walls take
FLOORS = {  # back, right, left
    'locker': ((997, 312), (1891, 750), (103, 750)),
    'gym': ((1002, 325), (1936, 767), (67, 767)),
    'bike': ((1002, 328), (1930, 762), (68, 762)),
    'run': ((996, 316), (1936, 767), (65, 762)),
    'pool': ((1005, 326), (1945, 772), (60, 770)),
}
WATER = {'pool': ((1552, 688), (1768, 795), (1062, 1150), (838, 1046))}   # back, right, front, left


def key(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    s = g - np.maximum(r, b)
    alpha = 1 - np.clip((s - 125) / 70, 0, 1)
    # anything still greenish is the green showing in glass or on an edge: make it neutral
    g2 = np.where(s > 12, np.maximum(r, b) + 6, g)
    # only the room itself: darker specks of green at the picture's edge would count as solid
    n, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0.5).astype(np.uint8), connectivity=8)
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    near = cv2.dilate((labels == biggest).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    alpha = np.where(near, alpha, 0)
    return Image.fromarray(np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8), 'RGBA')


def main(src):
    out = {}
    for room, (back, right, left) in FLOORS.items():
        path = glob.glob(os.path.join(src, room.upper(), '*.jpg'))[0]
        im = key(path)
        k = im.width / 2000
        a = np.asarray(im.getchannel('A')) > 128
        xs = np.where(a.sum(0) > 40)[0]; ys = np.where(a.sum(1) > 40)[0]
        x0, x1, y0, y1 = int(xs[0]) - 6, int(xs[-1]) + 7, int(ys[0]) - 6, int(ys[-1]) + 7
        c = im.crop((x0, y0, x1, y1))
        W, H = c.size
        scale = OUT_W / W
        name = f'icons/Pixelart/NEW/{room.upper()}/big-10.webp'
        c.resize((OUT_W, round(H * scale)), Image.LANCZOS).save(name, quality=84, alpha_quality=90, method=6)
        pct = lambda p: [round((p[0] * k - x0) / W * 100, 2), round((p[1] * k - y0) / H * 100, 2)]
        entry = {'src': name, 'size': [OUT_W, round(H * scale)], 'back': pct(back), 'right': pct(right), 'left': pct(left)}
        floor_w = (right[0] - left[0]) * k
        entry['share'] = round(ROOF_USED * floor_w / W, 4)
        entry['blocked'] = []
        if room in WATER:
            B = np.array(back, float); U = (np.array(right, float) - B) / 32; V = (np.array(left, float) - B) / 32
            M = np.linalg.inv(np.column_stack([U, V]))
            t = np.array([M @ (np.array(p, float) - B) for p in WATER[room]])
            entry['blocked'] = [[int(np.floor(t[:, 0].min())), int(np.floor(t[:, 1].min())), int(np.ceil(t[:, 0].max())), int(np.ceil(t[:, 1].max()))]]
        out[room] = entry
        print(room, entry)
    with open('js/core/room32-art.js', 'w', encoding='utf-8', newline='\n') as f:
        f.write('// room32-art.js: written by tools/cut-rooms-32.py. Don\'t edit by hand.\n')
        f.write('export const ROOM32 = ' + json.dumps(out, indent=2) + ';\n')


main(sys.argv[1])
