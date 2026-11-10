"""cut-rooms-32.py: the 32 x 32 room pictures for the game, keyed off their green and measured.

    python tools/cut-rooms-32.py <dir holding LOCKER/ GYM/ BIKE/ RUN/ POOL/>

Writes icons/Pixelart/NEW/<ROOM>/big-1..10.webp and js/core/room32-art.js. Gemini puts each floor a
little differently, so every room has its own corners, read by eye from the level 10 picture:
FLOORS holds them as x, y in a picture scaled to 2000 px wide.

Level 10 is <ROOM>/<room>-32-level-10.*; levels 1-9 are the x2 upscales in <ROOM>/upscaled/. Their
frames came out at slightly different shapes, and their walls at different heights and thicknesses,
so each one is laid onto level 10 by the one thing they share: the base slab. Its three lower
corners are read off each outline (slab) and matched, and one set of floor corners serves every level.

    python tools/cut-rooms-32.py <dir> [room...]     only these rooms; then run tools/room-mids.py
"""
import glob, json, os, re, sys
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
    # the screen in shadow (under a room's base) is darker than the key takes: any strongly green
    # patch that reaches the picture's edge through the background is background too
    hsv = cv2.cvtColor(a.clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV)
    hue, sat = hsv[..., 0].astype(np.float32) * 2, hsv[..., 1]
    screen = (hue >= 80) & (hue <= 160) & (sat > 80) & (s > 20)
    n, labels = cv2.connectedComponents(((alpha < .5) | screen).astype(np.uint8), connectivity=8)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    alpha = np.where(np.isin(labels, edge[edge > 0]) & screen, 0, alpha)
    # and the green light along the outline, walls and window frames: none of it is the room's own
    solid = (alpha > .5).astype(np.uint8)
    rim = (cv2.dilate(solid, np.ones((5, 5), np.uint8)) - cv2.erode(solid, np.ones((15, 15), np.uint8))) > 0
    g2 = np.where(rim & (g2 > np.maximum(r, b)), np.maximum(r, b), g2)
    # olive, where the green light mixed with a warm wall: grey it (gold trim is yellower, teal bluer)
    olive = rim & (hue >= 58) & (hue < 110) & (sat > 30)
    grey = .3 * r + .59 * g + .11 * b
    r, g2, b = (np.where(olive, grey, c) for c in (r, g2, b))
    return Image.fromarray(np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8), 'RGBA')


def source(src, room, n):
    if n == 10:
        return glob.glob(os.path.join(src, room.upper(), f'{room}-32-level-10.*'))[0]
    pat = re.compile(rf'{room}-32-level-{n}b?-upscale-2x\.(jpg|png)$')
    return [p for p in glob.glob(os.path.join(src, room.upper(), 'upscaled', '*')) if pat.search(p)][0]


def slab(im):
    """The three lower corners of a room's base slab, read off its outline: left, right, front.

    Every level stands on the same slab, and its two lower edges are the only part of the outline
    that no wall, light or trim ever changes. Each is a straight line: fitted to the lowest solid
    pixel of every column, they meet at the front corner and end at the left and right ones.
    """
    a = np.asarray(im.getchannel('A')) > 128
    cols = np.where(a.sum(0) > 0)[0]
    x0, x1 = int(cols[0]), int(cols[-1])
    xs = np.arange(x0, x1 + 1)
    low = np.array([np.where(a[:, x])[0][-1] if a[:, x].any() else -1 for x in xs], float)
    tip = xs[int(np.argmax(low))]
    span = x1 - x0

    def line(lo, hi):
        m = (xs >= lo) & (xs <= hi) & (low >= 0)
        X, Y = xs[m].astype(float), low[m]
        k, c = np.polyfit(X, Y, 1)
        for _ in range(4):                       # drop what isn't on the edge (a notch, a shadow speck)
            keep = np.abs(Y - (k * X + c)) < 3
            k, c = np.polyfit(X[keep], Y[keep], 1)
        return k, c
    kl, cl = line(x0 + .08 * span, tip - .08 * span)
    kr, cr = line(tip + .08 * span, x1 - .08 * span)
    fx = (cr - cl) / (kl - kr)
    return np.float32([[x0, kl * x0 + cl], [x1, kr * x1 + cr], [fx, kl * fx + cl]])


def fit(ref, im):
    """im's RGBA, moved onto ref's frame so the two rooms' slabs lie exactly on each other."""
    warp = cv2.getAffineTransform(slab(im), slab(ref))                      # im -> ref
    a = np.asarray(im).astype(np.float32)
    al = a[..., 3:] / 255
    pre = np.dstack([a[..., :3] * al, al * 255])                           # premultiplied, so edges stay clean
    out = cv2.warpAffine(pre, warp, ref.size, flags=cv2.INTER_LANCZOS4, borderValue=0).clip(0, 255)
    al = out[..., 3:] / 255
    rgb = np.where(al > 0, out[..., :3] / np.maximum(al, 1e-3), 0)
    res = Image.fromarray(np.dstack([rgb, out[..., 3]]).clip(0, 255).astype(np.uint8), 'RGBA')
    sx, sy = np.hypot(warp[0, 0], warp[1, 0]), np.hypot(warp[0, 1], warp[1, 1])
    return res, (sx, sy)


def main(src, only):
    art = 'js/core/room32-art.js'
    out = json.loads((lambda t: t[t.index('{'):t.rindex('}') + 1])(open(art, encoding='utf-8').read())) if only and os.path.exists(art) else {}
    for room, (back, right, left) in FLOORS.items():
        if only and room not in only:
            continue
        im = key(source(src, room, 10))
        k = im.width / 2000
        levels = {10: im}
        for n in range(1, 10):
            levels[n], (sx, sy) = fit(im, key(source(src, room, n)))
            print(f'  {room} level {n}: scaled {sx:.3f} x {sy:.3f}', flush=True)
        # one frame for all ten: the box that holds every level (some have taller or thicker walls)
        a = np.max([np.asarray(l.getchannel('A')) for l in levels.values()], axis=0) > 128
        xs = np.where(a.sum(0) > 40)[0]; ys = np.where(a.sum(1) > 40)[0]
        x0, x1, y0, y1 = max(0, int(xs[0]) - 6), min(im.width, int(xs[-1]) + 7), max(0, int(ys[0]) - 6), min(im.height, int(ys[-1]) + 7)
        W, H = x1 - x0, y1 - y0
        scale = OUT_W / W
        name = f'icons/Pixelart/NEW/{room.upper()}/big-10.webp'
        for n, lv in levels.items():
            lv.crop((x0, y0, x1, y1)).resize((OUT_W, round(H * scale)), Image.LANCZOS).save(
                f'icons/Pixelart/NEW/{room.upper()}/big-{n}.webp', quality=84, alpha_quality=90, method=6)
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


main(sys.argv[1], sys.argv[2:])
