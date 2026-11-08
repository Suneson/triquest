"""room-32.py — makes a 32 x 32 room picture out of a 16 x 16 one, without stretching it.

    python3 tools/room-32.py <16 x 16 art.webp> <32 x 32 art.webp>

Every tile keeps its size in the picture and the walls keep their height, so the room is twice as
long each way and half as tall for its size (a bigger room, not a blown-up one). It is built per
pixel, by reading each point of the new picture from a point of the old one:

  the floor   its outer 8 tiles each way stay where they are against the borders; the middle walks
              back over the pattern and forth again (FOLD), so no seam shows anywhere.
  the left wall   whole panels are repeated, with the logo and the gold plaque once, in the middle.
  the right wall  the window bays are repeated between the same two gold pillars, a little narrower
                  so a whole number of them fit.

The numbers below are the locker room's (ROOM_GEOMETRY['locker-16'] measured on model-10.webp):
a new room of the same shape needs its own PANELS and pillars.
"""
import json, sys
import numpy as np
import cv2
from PIL import Image

# the 16 x 16 picture
SRC = (2200, 1576)
BACK = np.array([50.15 * 22, 28.87 * 15.76])
E_U = np.array([(98.97 - 50.15) * 22, (62.19 - 28.87) * 15.76]) / 16      # one tile along u (to the right corner)
E_V = np.array([(1.33 - 50.15) * 22, (62.19 - 28.87) * 15.76]) / 16       # one tile along v (to the left corner)
OUT_W = 3400
SLOPE = E_U[1] / E_U[0]

# the left wall, in px across from the back corner: 11 panels, the first join PHASE from the corner.
# The 22 of the new wall, each naming the old panel it shows: the logo (4, 5) at the middle
PHASE, PANEL = 7.7, 97.13
STEP = 16 * E_U[0] / 11      # the shifts add up to exactly 16 tiles at the far end
PANELS = [0, 1, 2, 1, 2, 1, 2, 1, 2, 3, 4, 5, 6, 7, 8, 7, 8, 7, 8, 7, 9, 10]
# above the panels' lights: where the new wall's top band reads from (the plaque is 355-641 of the old)
BAND = 312
BAND_TO = [0, 941, 1227, 2148]
BAND_FROM = [0, 355, 641, 1074]
# the right wall: the centres of its two gold pillars, px across from the back corner
PILLAR_A, PILLAR_B = 538.0, 840.0
BAYS = 5                     # how many times the three bays between them come round in the new wall


def fold(t):
    """A tile coordinate of the 32 floor (0..32) in the 16 floor (0..16): continuous, 8 -> 14 -> 6 -> 8 in the middle."""
    return np.select([t < 14, t < 22], [t, 28 - t], t - 16)


def left_x(d):
    """Px across from the back corner along the left wall: the new wall's d in the old."""
    k = np.clip(np.floor((d - PHASE) / PANEL).astype(int), 0, len(PANELS) - 1)
    return d - (k - np.array(PANELS)[k]) * STEP


def right_x(d):
    """The same along the right wall."""
    span = 16 * E_U[0]
    P = PILLAR_B - PILLAR_A
    end = PILLAR_B + span
    scale = BAYS * P / (end - PILLAR_A)
    bays = PILLAR_A + np.mod((d - PILLAR_A) * scale, P)
    return np.select([d < PILLAR_A, d < end], [d, bays], d - span)


def main():
    src, out = sys.argv[1:3]
    im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255
    im[..., :3] *= im[..., 3:]
    shift_x = 16 * E_U[0]
    W, H = int(round(SRC[0] + 2 * shift_x)), int(round(SRC[1] + 32 * E_U[1]))  # 16 more tiles each way
    back = BACK + np.array([shift_x, 0])
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    px, py = xx - back[0], yy - back[1]
    # the floor's coordinates of every point of the new picture
    det = E_U[0] * E_V[1] - E_U[1] * E_V[0]
    u = (px * E_V[1] - py * E_V[0]) / det
    v = (py * E_U[0] - px * E_U[1]) / det
    fu, fv = fold(u), fold(v)
    mx = BACK[0] + fu * E_U[0] + fv * E_V[0]
    my = BACK[1] + fu * E_U[1] + fv * E_V[1]
    # the walls: slid along themselves, so what stands on them keeps its height
    right = (v < 0) & (px >= 0)
    left = (u < 0) & (px < 0)
    # the render's walls lean a little: their tops fall less steeply than their feet, so the slope a
    # point slides along depends on how high up the wall it is (measured from the top edge)
    alpha = im[..., 3] > .5
    def top_slope(x0, x1):
        xs = np.arange(int(x0), int(x1))
        ys = np.array([np.argmax(alpha[:, x]) for x in xs])
        return float(np.polyfit(xs, ys, 1)[0]), float(BACK[1] - ys[np.argmin(np.abs(xs - BACK[0]))])
    d = right_x(px)
    s_r = abs(top_slope(BACK[0] + 60, BACK[0] + 16 * E_U[0] - 60)[0]); wall_h = BACK[1] - np.argmax(alpha[:, int(BACK[0]) + 60]) + 60 * s_r
    foot_h = (px * SLOPE - py).clip(0, wall_h)
    k = foot_h / wall_h
    mx = np.where(right, BACK[0] + d, mx)
    my = np.where(right, py + BACK[1] - (px - d) * (SLOPE + (s_r - SLOPE) * k), my)
    # the plain band along the top of the left wall has no joins in it: one long smooth slide, the
    # plaque once, so the panels' slightly different shading doesn't show as blocks
    d = left_x(-px)
    foot_h = (-px * SLOPE - py).clip(0, 1e4)
    d = np.where(foot_h > BAND, np.interp(-px, BAND_TO, BAND_FROM), d)
    s_l = abs(top_slope(BACK[0] - 16 * E_U[0] + 60, BACK[0] - 60)[0])
    foot_h = (-px * SLOPE - py).clip(0, wall_h)
    k = foot_h / wall_h
    mx = np.where(left, BACK[0] - d, mx)
    my = np.where(left, py + BACK[1] - (-px - d) * (SLOPE + (s_l - SLOPE) * k), my)
    print('wall slopes', round(SLOPE, 4), round(s_r, 4), round(s_l, 4), 'height', round(float(wall_h)))
    a = cv2.remap(im, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    h = round(H * OUT_W / W)
    a = cv2.resize(a, (OUT_W, h), interpolation=cv2.INTER_AREA).clip(0, 1)
    al = a[..., 3:].clip(1e-4, 1)
    a[..., :3] = (a[..., :3] / al).clip(0, 1)
    Image.fromarray((a * 255 + .5).astype(np.uint8), 'RGBA').save(out, quality=90, method=6)
    pct = lambda p: [round(float(p[0]) / W * 100, 2), round(float(p[1]) / H * 100, 2)]
    print(json.dumps({'size': [OUT_W, h], 'back': pct(back), 'right': pct(back + 32 * E_U), 'left': pct(back + 32 * E_V)}))


if __name__ == '__main__':
    main()
