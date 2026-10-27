"""cut-art.py — turns the painted item art (docs/gear/ART-STYLE.md) into app icons.

Takes the raw images from the `art-raw` branch (checked out anywhere) and writes
256×256 PNGs with soft alpha into icons/Pixelart/...:

  - single images on flat green: the green is keyed out with a soft edge and
    the green spill on the edge is pulled back;
  - sheets on a grey studio background: the background is modelled as a smooth
    gradient from the border, removed where it connects to the border, and the
    sheet is split into its objects (left to right, top to bottom);
  - every object is trimmed, centred on a square with a little air, and
    resized to 256 px (smooth, not pixel-snapped: this art is painted).

    python3 tools/cut-art.py <art-raw dir> [--sheet docs/gear/art-sheet.png]

Build-time only (Pillow, numpy, scipy).
"""
import sys
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons', 'Pixelart')
SIZE = 256

# ---- removing the background ---------------------------------------------------------

def key_green(rgb):
    r, g, b = (rgb[..., i].astype(np.float32) for i in range(3))
    greenness = g - np.maximum(r, b)
    # 100+ is the screen; below 30 is the object; between is the soft edge
    alpha = np.clip((100 - greenness) / 70, 0, 1)
    # screen shows through gaps (trophy handles, goggle straps, paddle holes) as well
    # as around the object, so it is keyed everywhere; no item uses pure screen green
    # spill: on the soft edge, green can't exceed the other channels
    edge = (alpha < 1) | ndimage.binary_dilation(alpha < 1, iterations=2)
    g2 = np.where(edge, np.minimum(g, np.maximum(r, b) * 1.02 + 4), g)
    out = rgb.astype(np.float32).copy()
    out[..., 1] = g2
    return out, alpha


def key_grey(rgb):
    h, w, _ = rgb.shape
    img = rgb.astype(np.float32)
    sat = img.max(-1) - img.min(-1)
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = xx / w - 0.5, yy / h - 0.5
    r2 = u * u + v * v
    # a smooth background: quadratic plus a radial glow (studio light), fitted to
    # the background found so far, starting from the border and growing inward
    G = np.stack([np.ones_like(u), u, v, u * u, v * v, u * v, r2 * r2], -1).astype(np.float32)
    known = np.zeros((h, w), bool)
    known[:12], known[-12:], known[:, :12], known[:, -12:] = True, True, True, True
    for _ in range(4):
        ys, xs = np.nonzero(known)
        pick = np.random.default_rng(0).choice(len(ys), min(len(ys), 60000), replace=False)
        ys, xs = ys[pick], xs[pick]
        bg = np.zeros_like(img)
        for c in range(3):
            coef, *_ = np.linalg.lstsq(G[ys, xs], img[ys, xs, c], rcond=None)
            bg[..., c] = G @ coef
        dist = np.abs(img - bg).max(-1)
        like = (dist < 14) & (sat < 24)
        lab, _ = ndimage.label(like)
        border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        known = np.isin(lab, border[border > 0])
    outside = known.copy()
    # gaps enclosed by an object (inside a frame, between spokes) are background
    # too when they match it closely and aren't tiny
    sizes = ndimage.sum(np.ones_like(dist), lab, index=np.arange(lab.max() + 1))
    means = ndimage.mean(dist, lab, index=np.arange(lab.max() + 1))
    holes = (sizes > 0.0004 * h * w) & (means < 7)
    holes[0] = False
    outside |= holes[lab]
    outside = ndimage.binary_opening(outside, iterations=1)
    alpha = np.where(outside, 0.0, 1.0)
    ring = ndimage.binary_dilation(outside, iterations=2) & ~outside
    alpha = np.where(ring, np.clip((dist - 8) / 30, 0, 1), alpha)
    return img, alpha.astype(np.float32)


def background_of(rgb):
    c = rgb[4, 4].astype(int)
    return 'green' if c[1] - max(c[0], c[2]) > 120 else 'grey'

# ---- finding and exporting objects ------------------------------------------------------

def objects(alpha, min_frac=0.004, merge=24):
    """Bounding boxes of the objects, merged when parts sit close, in reading order."""
    solid = alpha > 0.5
    joined = ndimage.binary_dilation(solid, iterations=merge)
    lab, n = ndimage.label(joined)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        part = solid[sl] & (lab[sl] == i)
        if part.sum() < min_frac * alpha.size:
            continue
        boxes.append((sl, i))
    # rows: group by vertical centre, then left to right
    def centre(b):
        sl = b[0]
        return ((sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2)
    boxes.sort(key=lambda b: centre(b)[0])
    rows, cur = [], []
    for b in boxes:
        if cur and centre(b)[0] - centre(cur[-1])[0] > (cur[-1][0][0].stop - cur[-1][0][0].start) * 0.5:
            rows.append(cur); cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    return [b for row in rows for b in sorted(row, key=lambda b: centre(b)[1])], lab


def export(rgb, alpha, sl, lab, idx, path):
    mask = (lab[sl] == idx)
    a = alpha[sl] * mask
    ys, xs = np.nonzero(a > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = np.dstack([rgb[sl][y0:y1, x0:x1], a[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(crop, 'RGBA')
    side = int(max(im.size) * 1.08)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    sq = sq.resize((SIZE, SIZE), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sq.save(path, optimize=True)
    return path


def cut(src, names, dest_dir):
    """Cut one image into its objects; `names` in reading order (None skips one)."""
    rgb = np.asarray(Image.open(src).convert('RGB'))
    img, alpha = key_green(rgb) if background_of(rgb) == 'green' else key_grey(rgb)
    # parts of one object (a wheel pair, a bar and its chalk) join; separate objects
    # don't: try join distances from generous to tight until the count is right
    for merge in (40, 24, 16, 10, 6, 3):
        boxes, lab = objects(alpha, merge=merge)
        if len(boxes) == len(names):
            break
    else:
        raise SystemExit(f'{src}: found {len(boxes)} objects, expected {len(names)}')
    out = []
    for (sl, i), name in zip(boxes, names):
        if name:
            out.append(export(img, alpha, sl, lab, i, os.path.join(OUT, dest_dir, name + '.png')))
    return out

# ---- what goes where ------------------------------------------------------------------------

SHEETS = {
    '_extra/bike aero bars and frames and pedals.jpg': ('GEAR', [
        'bike-aerobars-t1', 'bike-aerobars-t2', 'bike-aerobars-t3', 'bike-frame-t2',
        'bike-frame-t1', 'bike-frame-t3', 'bike-power-t1', 'bike-power-t2']),
    '_extra/bike wheels with 3 levels.jpg': ('GEAR', ['bike-wheels-t1', 'bike-wheels-t2', 'bike-wheels-t3']),
    '_extra/inventory icon, shop, carbs and coin.jpg': ('GEAR', ['btn-inventory', 'btn-shop', 'carbs', 'coin']),
    '_extra/shop carbs and foods.jpg': ('GEAR', [
        'fuel-energy-bar', 'fuel-gel-caffeine', 'fuel-gel-race', 'fuel-gel',
        'fuel-pasta', 'fuel-recovery-shake', 'fuel-rice-cake', None]),
    # the bar-and-chalk and the barbell are spares (gym-bar t1–t3 came as single images)
    '_extra/6 more Gym equipment.jpg': ('GEAR', [
        None, None, 'gym-belt-t1', 'gym-belt-t2',
        'gym-belt-t3', 'gym-shoes-t1', 'gym-shoes-t2', 'gym-shoes-t3']),
}
# single images whose name differs from their file
RENAME = {'GEAR/run-shoes-t5.jpg': 'run-shoes-t3', 'GEAR/Roller-bike-trainer-8.jpg': 'bike-power-t3'}
SKIP = {f'GEAR/Roller-bike-trainer-{i}.jpg' for i in range(1, 8)} | {
    'GEAR/run-kit-black-moske-exclusive-bottoms.jpg', 'GEAR/run-kit-black-moske-exclusive-top.jpg'}
EXTRA_SINGLES = {f'_extra/{n}.jpg': n for n in ['challenge', 'podium', 'segment', 'stake-locked', 'stake-pot']}


def main():
    raw = sys.argv[1]
    done = []
    for rel, (dest, names) in SHEETS.items():
        done += cut(os.path.join(raw, rel), names, dest)
        print(f'{rel}: {sum(1 for n in names if n)} icons')
    for folder in ['GEAR', 'FEATS', 'FEATS/items']:
        for f in sorted(os.listdir(os.path.join(raw, folder))):
            rel = f'{folder}/{f}'
            if not f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) or rel in SKIP:
                continue
            name = RENAME.get(rel, os.path.splitext(f)[0])
            done += cut(os.path.join(raw, rel), [name], folder)
    for rel, name in EXTRA_SINGLES.items():
        done += cut(os.path.join(raw, rel), [name], 'FEATS')
    print(f'{len(done)} icons written')
    if '--sheet' in sys.argv:
        path = sys.argv[sys.argv.index('--sheet') + 1]
        cell, cols = 128, 12
        rows = (len(done) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * cell, rows * cell), (22, 38, 77, 255))
        for i, p in enumerate(done):
            im = Image.open(p).resize((cell - 8, cell - 8), Image.LANCZOS)
            sheet.paste(im, ((i % cols) * cell + 4, (i // cols) * cell + 4), im)
        sheet.save(path)
        print(f'sheet: {path}')


if __name__ == '__main__':
    main()
