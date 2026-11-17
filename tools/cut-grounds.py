"""cut-grounds.py: the club grounds, the one estate the base stands on (docs/CITY.md, "The club grounds").

    python tools/cut-grounds.py cut <map picture> <renders dir>
                                     the app's pictures, and js/core/island-art.js
    python tools/cut-grounds.py preview <out.jpg> [scale]

The ground is one painted map (MOSKE APP/Characters/Photos/Robots/Robots/World map/Map1_v2-upscale-1.5x.png,
7344 x 10570: Map1-upscale-1.5x.png (7344 x 7194) with sea added 778 px above and 2598 below, from screens/club-grounds-mock/map5-expanded.psd): the base on its lawn inside the track,
the forecourt with the club house's lower terrace down its left and the dock's stairs on its right,
the coliseum up on the right. The world is that picture at MAP_K, the scale at which its painted gym
lies exactly under the base's own picture (icons/Island/base.webp), so the base's plot, its upper
floor and the construction box are kept as they are. Ground units: a runs down-right, b down-left;
the base's plot is -1 to 1.
"""
import json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'icons', 'Island')
ART_JS = os.path.join(REPO, 'js', 'core', 'island-art.js')
SLOPE, UNIT = 0.489, 537
MAP_K = 1.0382                          # world px per px of the map: its gym's plinth is 2069 px across, the base's 2148
# Every spot below is in px of the first map (Map1-upscale-1.5x.png); the v2 map has it MAP_DY lower.
MAP_DY = 778
MAP_BASE = (3683.5, 3825.0 + MAP_DY)    # in px of the map: the plinth's left and right corners, halfway between
BASE = (round(MAP_BASE[0] * MAP_K, 1), round(MAP_BASE[1] * MAP_K - 5, 1))   # the middle of the base's plot
GRID = 6                                # the map in 6 tiles across (and as many down as keeps them square)
LAND_K, SEA_K = 0.75, 0.375             # stored px per px of the map: land tiles, and tiles of open sea
SMALL = 0.3                             # each tile's small copy, for a zoomed-out view: this much of its size
PAD = 8                                 # px of the map each tile overlaps its neighbours by

# the buildings on the map, rendered from their Tripo models (tools/render-items/render-grounds.py).
# Each stands with the front corner of its square footprint on its spot, its middle where it says
# (px of the map), and is as wide in the world as a square of `side` ground units.
#   club:   the club house on the lower terrace, turned so its door faces the bridge (yaw 90)
#   market: the kiosk, tucked in on the forecourt just right of the upper stairs
# The coliseum is painted on the map, so it only has a button.
BUILDINGS = {
    'club':   {'render': 'clubhouse-L4-bridge', 'mid': (2012, 5571), 'side': 0.84},   # in the middle of the terrace's gold square
    'market': {'render': 'shop-kiosk-L1-a', 'mid': (3800, 5060), 'side': 0.4},
}
# what brings the deliveries (js/app/city2d.js): pictures that move along a road, each anchored at
# its foot (the bike) or its middle on the water (the boat). `side` sizes them as the buildings.
#   boat: brings the room items. In from the south, alongside the dock's front, on out to the east
#   bike: brings the clothes. Over the bridge to the club house's door, then back the way it came
VEHICLES = {
    'boat':     {'render': 'delivery-boat-up', 'side': 0.85, 'afloat': True},
    'bike-in':  {'render': 'delivery-motorbike-in', 'side': 0.3},
    'bike-out': {'render': 'delivery-motorbike-out', 'side': 0.3},
}
# their roads, in px of the map; `stop` is the point it waits at
ROUTES = {
    'boat': {'path': [(-260, 9650), (5610, 6590), (7780, 5460)], 'stop': 1},
    'bike': {'path': [(-200, 6645), (1452, 5880), (1630, 5712)], 'stop': 2},
}
STORE_K = 0.75                           # stored px per world px
STADIUM = (4740, 1350, 6750, 2820)       # the coliseum's button: left, top, right, bottom
RUINS = ('club', 'market')               # these start in ruins: the same picture, grey and dark
# the six markets, like kennels on the lawn round the base: three down each front side, between
# the plinth (1.0) and the track's inner edge (about 1.48)
SHOP_SCALE = 0.6
SHOPS = [(-0.8, 1.24), (-0.2, 1.24), (0.4, 1.24), (1.24, -0.75), (1.24, -0.15), (1.24, 0.45)]


def pt(a, b, k=1.0):
    return ((BASE[0] + (a - b) * UNIT) * k, (BASE[1] + (a + b) * SLOPE * UNIT) * k)


def world(x, y):
    return (round(x * MAP_K, 1), round((y + MAP_DY) * MAP_K, 1))


def read_art():
    with open(ART_JS, encoding='utf-8') as f:
        return json.loads((t := f.read())[t.index('{'):t.rindex('}') + 1])


def save(im, name, quality=82):
    im.save(os.path.join(OUT, f'{name}.webp'), quality=quality, alpha_quality=88, method=6)


def ground(src):
    """The map in GRID tiles across, square-ish: land at LAND_K, open sea at SEA_K."""
    im = Image.open(src).convert('RGB')
    a = np.asarray(im.resize((im.width // 8, im.height // 8)), dtype=np.int16)
    # land: anything that isn't the sea's dark blue
    land = ~((a[..., 2] > a[..., 0] + 10) & (a[..., 0] + a[..., 1] + a[..., 2] < 330))
    xs = [round(im.width * i / GRID) for i in range(GRID + 1)]
    rows = round(GRID * im.height / im.width)
    ys = [round(im.height * i / rows) for i in range(rows + 1)]
    tiles = []
    for r in range(rows):
        for c in range(GRID):
            # each tile runs PAD px of the map on under its right and lower neighbours, so no seam shows
            box = (xs[c], ys[r], min(im.width, xs[c + 1] + PAD), min(im.height, ys[r + 1] + PAD))
            k = LAND_K if land[box[1] // 8:box[3] // 8, box[0] // 8:box[2] // 8].mean() > 0.04 else SEA_K
            t = im.crop(box)
            save(t.resize((round(t.width * k), round(t.height * k)), Image.LANCZOS), f'ground-{r}-{c}', 84)
            save(t.resize((round(t.width * k * SMALL), round(t.height * k * SMALL)), Image.LANCZOS), f'ground-{r}-{c}-s', 80)
            tiles.append({'src': f'icons/Island/ground-{r}-{c}.webp', 'small': f'icons/Island/ground-{r}-{c}-s.webp', 'x': round(box[0] * MAP_K, 1), 'y': round(box[1] * MAP_K, 1),
                          'w': round(t.width * MAP_K, 1), 'h': round(t.height * MAP_K, 1)})
    return tiles, (round(im.width * MAP_K), round(im.height * MAP_K))


def buildings(renders):
    """Each building's render, trimmed, scaled to its width and stood on its spot; and each
    vehicle's, with the point it's placed by (ax, ay: px of its box, in world px)."""
    pieces, plots = {}, {}
    for name, b in {**BUILDINGS, **VEHICLES}.items():
        vehicle = name in VEHICLES
        im = Image.open(os.path.join(renders, b['render'] + '.png')).convert('RGBA')
        a = np.asarray(im).copy()
        solid = a[..., 3] > 250                     # the model; less is its shadow on the floor
        if b.get('afloat'):
            # on water: no floor shadow, and its keel sunk a little under the waterline
            ys = np.where(solid.any(1))[0]
            cut = int(ys.max() - (ys.max() - ys.min()) * 0.1)
            a[..., 3] = np.where(solid, 255, 0); a[cut:, :, 3] = 0
            solid[cut:] = False
        else:
            # the shadow catcher leaves a faint veil over its whole floor: keep only the real shadow
            # and the sun's long shadow runs off the render's edge: fade it out near the model
            from scipy import ndimage as ndi
            ys, xs = np.where(solid)
            reach = 0.12 * max(np.ptp(ys), np.ptp(xs))
            fade = np.clip(1 - ndi.distance_transform_edt(~solid) / reach, 0, 1) ** 1.2
            sh = np.clip((a[..., 3].astype(np.float32) - 14) / (241 - 14), 0, 1) * fade * 0.8 * 255
            a[..., 3] = np.where(solid, a[..., 3], sh.astype(np.uint8))
        im = Image.fromarray(a, 'RGBA')
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox())
        a = np.asarray(im); solid = a[..., 3] > 250
        xs = np.where(solid.any(0))[0]
        w_world = 2 * b['side'] * UNIT
        k = w_world / (xs.max() - xs.min() + 1)      # world px per render px
        stored = STORE_K * k
        st = im.resize((round(im.width * stored), round(im.height * stored)), Image.LANCZOS)
        if vehicle:
            ys = np.where(solid.any(1))[0]
            if b.get('afloat'):
                fx, fy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
            else:
                fy = int(ys.max()); fx = float(np.where(solid[max(0, fy - 3):fy + 1].any(0))[0].mean())
            save(st, name)
            pieces[name] = {'src': f'icons/Island/{name}.webp', 'w': round(float(im.width * k), 1), 'h': round(float(im.height * k), 1),
                            'ax': round(float(fx * k), 1), 'ay': round(float(fy * k), 1)}
            print(name, st.size)
            continue
        mx, my = world(*b['mid'])
        if b.get('afloat'):
            ys = np.where(solid.any(1))[0]
            fx, fy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
            wx, wy = mx, my
        else:
            fy = int(np.where(solid.any(1))[0].max())
            fx = float(np.where(solid[max(0, fy - 3):fy + 1].any(0))[0].mean())
            wx, wy = mx, my + b['side'] * SLOPE * UNIT
        box = {'x': round(float(wx - fx * k), 1), 'y': round(float(wy - fy * k), 1), 'w': round(float(im.width * k), 1), 'h': round(float(im.height * k), 1)}
        save(st, name)
        pieces[name] = {'src': f'icons/Island/{name}.webp', **box}
        plots[name] = [round(float(wx), 1), round(float(wy), 1)]
        if name in RUINS:
            g = np.asarray(st).astype(np.float32)
            grey = g[..., :3].mean(-1, keepdims=True)
            g[..., :3] = (g[..., :3] * .25 + grey * .75) * .62
            save(Image.fromarray(g.clip(0, 255).astype(np.uint8), 'RGBA'), f'{name}-ruin')
            pieces[f'{name}-ruin'] = {'src': f'icons/Island/{name}-ruin.webp', **box}
        print(name, st.size)
    return pieces, plots


def cut(ground_src, renders):
    art = read_art()
    dx, dy = BASE[0] - art['plots']['base'][0], BASE[1] - art['plots']['base'][1]
    base = art['pieces']['base']
    pieces = {'base': {**base, 'x': round(base['x'] + dx, 1), 'y': round(base['y'] + dy, 1)}}
    built, plots = buildings(renders)
    pieces.update(built)
    x0, y0 = world(*STADIUM[:2]); x1, y1 = world(*STADIUM[2:])
    pieces['stadium'] = {'src': None, 'x': x0, 'y': y0, 'w': round(x1 - x0, 1), 'h': round(y1 - y0, 1)}
    plots['stadium'] = [round((x0 + x1) / 2, 1), y1]
    pieces['box'] = art['pieces']['box']
    tiles, (ww, wh) = ground(ground_src)
    data = {'world': {'w': ww, 'h': wh}, 'tiles': tiles, 'plots': {'base': list(BASE), **plots}, 'pieces': pieces,
            'routes': {n: {'path': [list(world(*q)) for q in r['path']], 'stop': r['stop']} for n, r in ROUTES.items()},
            'shops': [{'spot': i + 1, 'a': a, 'b': b} for i, (a, b) in enumerate(SHOPS)], 'shopScale': SHOP_SCALE,
            'storeys': art['storeys'], 'unit': UNIT, 'slope': SLOPE, 'foot': art['foot'], 'groundFloor': art['groundFloor']}
    with open(ART_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write("// island-art.js: where the club grounds' pictures stand, in world px. Written by tools/cut-grounds.py.\n")
        f.write('export const ISLAND_ART = ' + json.dumps(data, indent=1) + ';\n')
    for f in os.listdir(OUT):                       # tiles of the older 5 x 4 grid the new one doesn't overwrite
        m = re.fullmatch(r'ground-(\d+)-(\d+)(-s)?\.webp', f)
        if m and (int(m[2]) >= GRID or not any(t['src'].endswith(f) or t['small'].endswith(f) for t in tiles)):
            os.remove(os.path.join(OUT, f))
    for n, p in pieces.items():
        print(n, p)


def preview(out, k=0.3):
    """Everything put together as the app does, to look at."""
    art = read_art()
    k = float(k)
    im = Image.new('RGBA', (round(art['world']['w'] * k), round(art['world']['h'] * k)))

    def put(src, x, y, w, h):
        p = Image.open(os.path.join(REPO, src)).convert('RGBA').resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        im.alpha_composite(p, (round(x * k), round(y * k)))
    for t in art['tiles']:
        put(t['src'], t['x'], t['y'], t['w'], t['h'])
    put(**art['pieces']['base'])
    DA, DB, FOOT = 0.88, 0.53, 0.617                # the market pictures' pad (js/app/island-view.js)
    s = art['shopScale']
    for sp in sorted(art['shops'], key=lambda q: q['a'] + q['b']):
        src = 'icons/Market/island/market-3.webp'
        m = Image.open(os.path.join(REPO, src))
        pw, ph = m.width - 32, m.height - 48
        w = (DA + DB) * UNIT * s
        fx, fy = pt(sp['a'] + DA * s / .86 / 2, sp['b'] + DB * s / .86 / 2)
        kk = w / pw
        put(src, fx - FOOT * w - 16 * kk, fy - w * ph / pw + w * .02 - 16 * kk, m.width * kk, m.height * kk)
    for n in sorted((n for n in art['plots'] if n != 'base'), key=lambda n: art['plots'][n][1]):
        if art['pieces'][n]['src']:
            put(**art['pieces'][n])
    im.convert('RGB').save(out, quality=88)
    print(out, im.size)


if __name__ == '__main__':
    {'cut': cut, 'preview': preview}[sys.argv[1]](*sys.argv[2:])
