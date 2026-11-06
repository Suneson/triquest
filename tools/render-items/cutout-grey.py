import sys, os, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
S = sys.argv[1]
MAP = {'01':'coffee-machine-t2-a','02':'coffee-machine-t2-b','03':'coffee-machine-t3-a','04':'coffee-machine-t3-b',
       '05':'treadmill-t1-a','06':'treadmill-t1-b','07':'treadmill-t2-a','08':'treadmill-t2-b',
       '09':'road-bike-rollers-t1-a','10':'road-bike-rollers-t1-b','11':'road-bike-stand-b','12':'road-bike-stand-a',
       '13':'trophy-gold-mountain-a','14':'trophy-gold-mountain-b','15':'coffee-machine-t1-a','16':'coffee-machine-t1-b'}
os.makedirs(f'{S}/items/cut', exist_ok=True)
def lum(a): return a[...,0]*0.299 + a[...,1]*0.587 + a[...,2]*0.114
for k, name in MAP.items():
    g = Image.open(f'{S}/items/gem/{k}.jpg').convert('RGB')
    r = Image.open(f'{S}/items/send/{name}.png').convert('RGBA')
    ra = np.asarray(r.getchannel('A')).astype(float) / 255
    a = np.asarray(g).astype(float)
    H, W = a.shape[:2]
    border = np.concatenate([a[:6].reshape(-1,3), a[-6:].reshape(-1,3), a[:, :6].reshape(-1,3), a[:, -6:].reshape(-1,3)])
    bg = np.median(border, 0); bL = lum(bg)
    L = lum(a); chroma = a.max(2) - a.min(2); d = np.abs(a - bg).sum(2)
    # background or shadow: neutral, not much lighter than the background, not darker than a shadow gets
    soft = (chroma < 16) & (L > bL * 0.5) & (L < bL + 14)
    lab, n = ndi.label(soft)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    # align the render to this picture: the render's object (alpha ~1) and all it covers (with shadow)
    fg = ~outside
    best = None
    for s in np.linspace(0.8, 1.2, 21):
        rw, rh = int(r.width * s * W / r.width * (r.width / r.width)), 0
    # scale so the render's height fills like the picture's foreground: search scale and shift
    ys, xs = np.where(fg); gy0, gy1, gx0, gx1 = ys.min(), ys.max(), xs.min(), xs.max()
    obj_r = ra > 0.97
    ys2, xs2 = np.where(obj_r)
    ry0, ry1, rx0, rx1 = ys2.min(), ys2.max(), xs2.min(), xs2.max()
    # the picture's object box ~ the render object's box
    sc = ((gy1 - gy0) / (ry1 - ry0) + (gx1 - gx0) / (rx1 - rx0)) / 2
    big = r.resize((round(r.width * sc), round(r.height * sc)), Image.LANCZOS)
    ba = np.asarray(big.getchannel('A')).astype(float) / 255
    ox = gx0 - round(rx0 * sc); oy = gy0 - round(ry0 * sc)
    guide = np.zeros((H, W))
    y0, x0 = max(0, oy), max(0, ox); y1, x1 = min(H, oy + ba.shape[0]), min(W, ox + ba.shape[1])
    guide[y0:y1, x0:x1] = ba[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    gobj = ndi.binary_erosion(guide > 0.97, iterations=3)
    # enclosed soft regions (between spokes, inside a handle loop): background unless the render says object
    holes = np.zeros_like(outside)
    for lb in range(1, n + 1):
        if lb in edge: continue
        m = lab == lb
        if m.sum() < 60: continue
        flat = (d[m].mean() < 14 and d[m].std() < 8) or (d[m].std() < 9 and chroma[m].mean() < 9 and bL * 0.72 < L[m].mean() < bL + 4)   # the background or its shadow, showing through
        if flat or (gobj[m]).mean() < 0.35: holes |= m
    clear = outside | holes
    obj = ~clear
    obj = ndi.binary_opening(obj, iterations=1)
    # keep the biggest pieces only (drop specks)
    ol, on = ndi.label(obj); sizes = ndi.sum(obj, ol, range(1, on + 1))
    keep = np.isin(ol, [i + 1 for i, z in enumerate(sizes) if z > 0.002 * obj.sum()])
    obj = keep
    soft_a = np.clip(ndi.gaussian_filter(obj.astype(float), 0.8), 0, 1)
    shadow = np.where(clear, np.clip(1 - L / bL, 0, 1) * 1.0, 0)
    shadow[shadow < 0.07] = 0
    # a shadow only on the ground near the object
    reach = ndi.binary_dilation(obj, iterations=max(8, int(0.12 * obj.shape[0])))
    shadow = np.where(reach, shadow, 0)
    alpha = np.maximum(soft_a, shadow)
    rgb = np.where(obj[..., None], a, 0) * (soft_a[..., None] / np.maximum(alpha[..., None], 1e-6))
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA'); bb = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox(); im = im.crop(bb)
    im.save(f'{S}/items/cut/{name}.png')
    print(name, im.size, 'iou', round(((guide > 0.97) & obj).sum() / max(1, ((guide > 0.97) | obj).sum()), 3))
