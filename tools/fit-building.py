"""fit-building.py: the main building's repainted floors, fitted onto the base's footprint.

    python tools/fit-building.py <repaint dir> [preview.jpg]

The repaints (MOSKE APP/Characters/Photos/Robots/Robots/Repaint/building/, made from
PromptQueue Prompts/repaint-main-building.csv) are on green and Gemini draws them a little off:
the roof's shape, the camera's slope, a touch of perspective, and walls taller than asked. The
rooms stand on the roofs, so each roof must be exactly the base's footprint (ISLAND_ART.foot);
the walls may be any height. Each face (the roof, the two walls, and the ground floor's plinth)
is moved separately from points measured on the repaint (POINTS, px of the repaint) onto where it
must be, keeping each floor's own wall height in proportion to its roof's width.

Writes icons/Island/base.webp (the ground floor on its plinth) and storey-1..4.webp, and in
js/core/island-art.js the base's piece, groundFloor (the ground floor's wall height, world px)
and storeys: [{ src, w, h, ax, ay, wall }] (ax, ay: where the storey's front bottom corner is in
the picture, world px).
"""
import json, os, sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'icons', 'Island')
ART_JS = os.path.join(REPO, 'js', 'core', 'island-art.js')
STORE = {'ground': 1.25, 'storey': 1.0}      # stored px per world px
MARGIN = 40                                   # world px each face reaches past its corners (cornices, rails)

# measured on each repaint: the roof's corners (T top, L left, R right, F front) and the wall's
# foot under L, F and R (BL, BF, BR); the ground floor also its plinth's corners (PL, PF, PR).
# Corners hidden or off the picture are worked out from the others.
POINTS = {
    'building-ground-floor': {'L': (300, 188), 'R': (2445, 188), 'F': (1388, 713),
                              'BL': (313, 713), 'BF': (1388, 1325), 'BR': (2425, 725),
                              'PL': (63, 838), 'PF': (1388, 1500), 'PR': (2655, 838)},
    'building-storey-1': {'T': (1200, 80), 'L': (105, 400), 'R': (2280, 400), 'F': (1200, 738),
                          'BL': (100, 1300), 'BF': (1200, 1712), 'BR': (2300, 1300)},
    'building-storey-2': {'T': (1250, 95), 'L': (113, 655), 'R': (2413, 655), 'F': (1250, 1195),
                          'BL': (88, 1050), 'BF': (1250, 1625), 'BR': (2420, 1025)},
    'building-storey-3': {'T': (1200, 88), 'L': (180, 583), 'R': (2220, 583), 'F': (1200, 1063),
                          'BL': (125, 1150), 'BF': (1200, 1725), 'BR': (2280, 1150)},
    'building-storey-4': {'T': (1250, 100), 'L': (113, 663), 'R': (2420, 655), 'F': (1263, 1195),
                          'BL': (88, 1025), 'BF': (1263, 1613), 'BR': (2430, 1025)},
}


def read_art():
    with open(ART_JS, encoding='utf-8') as f:
        t = f.read()
    return json.loads(t[t.index('{'):t.rindex('}') + 1])


def keyed(path):
    """The repaint with its green made clear (and the green spill on its edges taken out)."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    frac = (g - np.maximum(r, b)) / np.maximum(g, 1)
    alpha = np.clip((0.55 - frac) / 0.3, 0, 1)
    core = ndi.binary_opening(alpha > 0.9, iterations=2)
    lab, n = ndi.label(core)
    if n:
        sizes = ndi.sum(core, lab, range(1, n + 1))
        core = lab == (int(np.argmax(sizes)) + 1)
    alpha = np.where(ndi.binary_dilation(core, iterations=3), alpha, 0)
    g2 = np.minimum(g, np.maximum(r, b) * 1.04 + 4)
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return out


def tri_warp(src, canvas, s3, d3, poly):
    """Draw the triangle s3 of src onto canvas at d3 (an affine move), within dst polygon `poly`."""
    m = cv2.getAffineTransform(np.float32(s3), np.float32(d3))
    h, w = canvas.shape[:2]
    # premultiplied, so the edges don't pick up the clear pixels' colour
    pre = src.astype(np.float32)
    pre[..., :3] *= pre[..., 3:4] / 255
    wp = cv2.warpAffine(pre, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(mask, [np.round(np.float32(poly)).astype(np.int32)], 255)
    sel = mask > 0
    # over what's there already
    a = wp[..., 3:4] / 255
    canvas[sel] = wp[sel] + canvas[sel] * (1 - a[sel])


def push(p, c, d):
    v = np.subtract(p, c); n = np.hypot(*v) or 1
    return tuple(np.add(p, v / n * d))


def fit(img, src_pts, dst_pts, faces, size, hull_c, roof_fill=None):
    """Each face's triangles moved from src_pts to dst_pts on a canvas of `size` (dst px)."""
    canvas = np.zeros((size[1], size[0], 4), np.float32)
    for face in faces:
        for tri in face:
            s3 = [src_pts[k] for k in tri]; d3 = [dst_pts[k] for k in tri]
            poly = [push(dst_pts[k], hull_c, MARGIN_PX) if k in HULL else dst_pts[k] for k in tri]
            tri_warp(img, canvas, s3, d3, poly)
    if roof_fill:
        # the roof where the repaint was cut off: filled with the roof's own stone
        quad = np.round(np.float32([dst_pts[k] for k in roof_fill])).astype(np.int32)
        mask = np.zeros(canvas.shape[:2], np.uint8); cv2.fillPoly(mask, [quad], 255)
        inner = cv2.erode(mask, np.ones((25, 25), np.uint8)) > 0
        solid = inner & (canvas[..., 3] > 250)
        col = np.median(canvas[solid][:, :3] / (canvas[solid][:, 3:4] / 255), axis=0)
        holes = inner & (canvas[..., 3] < 250)
        a = canvas[holes][:, 3:4] / 255
        canvas[holes, :3] = canvas[holes, :3] + col * (1 - a)
        canvas[holes, 3] = 255
    # back from premultiplied
    a = canvas[..., 3:4]
    rgb = np.where(a > 0, canvas[..., :3] * 255 / np.maximum(a, 1e-3), 0)
    return Image.fromarray(np.dstack([rgb, a]).clip(0, 255).astype(np.uint8), 'RGBA')


HULL = set()
MARGIN_PX = MARGIN


def main():
    global HULL, MARGIN_PX
    rep = sys.argv[1]
    art = read_art()
    bx, by = art['plots']['base']; U = art['unit']; S = art['slope']; A0, A1 = art['foot']

    def on(a, b, up):
        return (bx + (a - b) * U, by + (a + b) * S * U - up)
    roof_w = (on(A1, A0, 0)[0] - on(A0, A1, 0)[0])

    def wall_of(p):
        """The repaint's wall height, in world px at the scale that makes its roof the footprint."""
        k = roof_w / (p['R'][0] - p['L'][0])
        h = np.mean([p['BL'][1] - p['L'][1], p['BF'][1] - p['F'][1], p['BR'][1] - p['R'][1]])
        return h * k

    # ---- the storeys: each in its own picture, its front bottom corner at (ax, ay) ----
    storeys = []
    for i in range(1, 5):
        name = f'building-storey-{i}'
        p = dict(POINTS[name]); p.setdefault('T', tuple(np.add(p['L'], p['R']) - np.array(p['F'])))
        wall = wall_of(p)
        k = STORE['storey']
        # world, with the storey's foot at up 0
        w = {'T': on(A0, A0, wall), 'L': on(A0, A1, wall), 'R': on(A1, A0, wall), 'F': on(A1, A1, wall),
             'BL': on(A0, A1, 0), 'BF': on(A1, A1, 0), 'BR': on(A1, A0, 0)}
        xs = [q[0] for q in w.values()]; ys = [q[1] for q in w.values()]
        x0, y0 = min(xs) - MARGIN - 10, min(ys) - MARGIN - 10
        x1, y1 = max(xs) + MARGIN + 10, max(ys) + MARGIN + 10
        d = {n: ((q[0] - x0) * k, (q[1] - y0) * k) for n, q in w.items()}
        size = (int(np.ceil((x1 - x0) * k)), int(np.ceil((y1 - y0) * k)))
        HULL = {'T', 'L', 'R', 'BL', 'BF', 'BR'}; MARGIN_PX = MARGIN * k
        c = tuple(np.mean([d[n] for n in HULL], axis=0))
        faces = [[('L', 'F', 'BF'), ('L', 'BF', 'BL')], [('F', 'R', 'BR'), ('F', 'BR', 'BF')], [('T', 'L', 'F'), ('T', 'F', 'R')]]
        im = fit(keyed(os.path.join(rep, name + '.jpg')), p, d, faces, size, c, roof_fill=('T', 'L', 'F', 'R'))
        bb = im.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox()
        im = im.crop(bb)
        out = f'storey-{i}'
        im.save(os.path.join(OUT, out + '.webp'), quality=84, alpha_quality=90, method=6)
        fx, fy = w['BF'][0] - x0 - bb[0] / k, w['BF'][1] - y0 - bb[1] / k
        storeys.append({'src': f'icons/Island/{out}.webp', 'w': round(im.width / k, 1), 'h': round(im.height / k, 1),
                        'ax': round(fx, 1), 'ay': round(fy, 1), 'wall': round(wall, 1)})
        print(out, im.size, 'wall', round(wall, 1))

    # ---- the ground floor on its plinth (the plinth is the plot, -1 to 1) ----
    name = 'building-ground-floor'
    p = dict(POINTS[name])
    p['T'] = tuple(np.add(p['L'], p['R']) - np.array(p['F']))
    p['PT'] = tuple(np.add(p['PL'], p['PR']) - np.array(p['PF']))
    p['BT'] = tuple(np.add(p['BL'], p['BR']) - np.array(p['BF']))
    gf = wall_of(p)
    k = STORE['ground']
    w = {'T': on(A0, A0, gf), 'L': on(A0, A1, gf), 'R': on(A1, A0, gf), 'F': on(A1, A1, gf),
         'BL': on(A0, A1, 0), 'BF': on(A1, A1, 0), 'BR': on(A1, A0, 0), 'BT': on(A0, A0, 0),
         'PL': on(-1, 1, 0), 'PF': on(1, 1, 0), 'PR': on(1, -1, 0), 'PT': on(-1, -1, 0)}
    xs = [q[0] for q in w.values()]; ys = [q[1] for q in w.values()]
    x0, y0 = min(xs) - MARGIN - 10, min(ys) - MARGIN - 10
    x1, y1 = max(xs) + MARGIN + 10, max(ys) + MARGIN + 40
    d = {n: ((q[0] - x0) * k, (q[1] - y0) * k) for n, q in w.items()}
    size = (int(np.ceil((x1 - x0) * k)), int(np.ceil((y1 - y0) * k)))
    img = keyed(os.path.join(rep, name + '.jpg'))
    MARGIN_PX = MARGIN * k
    # the plinth first (its thick edge reaches a little under its corners), then the building on it
    HULL = {'PL', 'PF', 'PR', 'PT'}
    c = tuple(np.mean([d[n] for n in HULL], axis=0))
    plinth = fit(img, p, d, [[('PT', 'PL', 'PF'), ('PT', 'PF', 'PR')]], size, c)
    HULL = {'T', 'L', 'R', 'BL', 'BF', 'BR'}
    c = tuple(np.mean([d[n] for n in HULL], axis=0))
    house = fit(img, p, d, [[('L', 'F', 'BF'), ('L', 'BF', 'BL')], [('F', 'R', 'BR'), ('F', 'BR', 'BF')], [('T', 'L', 'F'), ('T', 'F', 'R')]],
                size, c, roof_fill=('T', 'L', 'F', 'R'))
    plinth.alpha_composite(house)
    im = plinth
    bb = im.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox()
    im = im.crop(bb)
    im.save(os.path.join(OUT, 'base.webp'), quality=84, alpha_quality=90, method=6)
    base = {'src': 'icons/Island/base.webp', 'x': round(x0 + bb[0] / k, 1), 'y': round(y0 + bb[1] / k, 1),
            'w': round(im.width / k, 1), 'h': round(im.height / k, 1)}
    print('base', im.size, 'ground floor', round(gf, 1))

    art['pieces']['base'] = base
    art['groundFloor'] = round(gf, 1)
    art['storeys'] = storeys
    art.pop('storey', None)
    with open(ART_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write("// island-art.js: where the club grounds' pictures stand, in world px. Written by tools/cut-grounds.py.\n")
        f.write('export const ISLAND_ART = ' + json.dumps(art, indent=1) + ';\n')

    if len(sys.argv) > 2:
        # the whole building with every storey, over the map, to look at
        prev = Image.new('RGBA', (2600, 4200), (40, 40, 60, 255))
        ox, oy = bx - 1300, by - 3700
        bi = Image.open(os.path.join(OUT, 'base.webp')).convert('RGBA').resize((round(base['w']), round(base['h'])))
        prev.alpha_composite(bi, (round(base['x'] - ox), round(base['y'] - oy)))
        up = gf
        for st in storeys:
            fx, fy = on(A1, A1, up)
            si = Image.open(os.path.join(REPO, st['src'])).convert('RGBA').resize((round(st['w']), round(st['h'])))
            prev.alpha_composite(si, (round(fx - st['ax'] - ox), round(fy - st['ay'] - oy)))
            up += st['wall']
        # the top floor's slab outline: where the room stands
        from PIL import ImageDraw
        dr = ImageDraw.Draw(prev)
        dr.polygon([tuple(np.subtract(on(a, b, up), (ox, oy))) for a, b in ((A0, A0), (A1, A0), (A1, A1), (A0, A1))], outline=(255, 0, 0), width=4)
        prev.convert('RGB').save(sys.argv[2], quality=85)


if __name__ == '__main__':
    main()
