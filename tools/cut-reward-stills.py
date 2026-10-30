"""cut-reward-stills.py — the chest stills and Safari's animation (icons/AnimatedRewards/).

    python3 tools/cut-reward-stills.py                 key the painted JPGs in JPG/ into still/<Tier>.webp
    python3 tools/cut-reward-stills.py --frames <dir>  from the clip frames reward-stills.mjs captured
                                                       (<dir>/<Tier>/0000.png …, already clear): the shut
                                                       still, the open still and WEBP/<Tier>.webp

The JPGs are on a flat screen: green for most, pink #FF017E for one. The screen
colour is read from the image's border, so either works without saying which.
Only screen connected to the border is keyed (a green or pink detail inside the
object stays), with a soft edge and the screen's spill pulled back on it.
Output keeps the source's framing (padded to a square, never trimmed), 512 px:
the still replaces the clip's last frame in place, so it must line up with it.
Build-time only (Pillow, numpy, scipy).
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'icons', 'AnimatedRewards')
OUT = os.path.join(BASE, 'still')
SIZE = 448


def screen_colour(rgb):
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    return np.median(border, axis=0)


def key(rgb):
    """Alpha for a flat-screen image: distance from the screen colour, in chroma."""
    img = rgb.astype(np.float32)
    scr = screen_colour(img)
    # chroma distance (brightness-independent, so shading on the screen still keys)
    def chroma(a):
        s = a.sum(-1, keepdims=True) + 1e-3
        return a / s
    d = np.linalg.norm(chroma(img) - chroma(scr[None, None, :]), axis=-1) * 255
    near = d < 40
    labels, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    screen = np.isin(labels, edge[edge > 0])
    band = ndimage.binary_dilation(screen, iterations=4) & ~screen
    alpha = np.ones(screen.shape, np.float32)
    alpha[screen] = 0
    alpha[band] = np.clip((d[band] - 20) / 60, 0, 1)
    # spill: on the band, pull the screen's strongest channel back toward the others
    out = img.copy()
    k = int(np.argmax(scr))
    others = [i for i in range(3) if i != k]
    cap = np.max(img[..., others], axis=-1) * 1.02 + 4
    out[..., k] = np.where(band, np.minimum(img[..., k], cap), img[..., k])
    return out, alpha


def fit(im):
    w, h = im.size
    s = max(w, h)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - w) // 2, (s - h) // 2), im)
    return sq.resize((SIZE, SIZE), Image.LANCZOS)


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.webp')
    fit(im).save(path, 'WEBP', quality=88, method=6)
    print(path, os.path.getsize(path))


FPS = 24  # the clips' rate


def from_frames(root):
    anim_dir = os.path.join(BASE, 'WEBP')
    os.makedirs(anim_dir, exist_ok=True)
    for tier in sorted(os.listdir(root)):
        files = sorted(f for f in os.listdir(os.path.join(root, tier)) if f.endswith('.png'))
        frames = [fit(Image.open(os.path.join(root, tier, f)).convert('RGBA')) for f in files]
        save(frames[0], tier)
        save(frames[-1], tier + '-open')
        # the whole clip, once (loop=1), for Safari; the first frame is the shut still
        out = os.path.join(anim_dir, tier + '.webp')
        frames[0].save(out, 'WEBP', save_all=True, append_images=frames[1:], duration=round(1000 / FPS),
                       loop=1, quality=62, method=5, allow_mixed=True)
        print(out, len(frames), 'frames', os.path.getsize(out))


def main():
    if '--frames' in sys.argv:
        from_frames(sys.argv[sys.argv.index('--frames') + 1])
        return
    src = os.path.join(BASE, 'JPG')
    for f in sorted(os.listdir(src)):
        name, ext = os.path.splitext(f)
        if ext.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        rgb = np.asarray(Image.open(os.path.join(src, f)).convert('RGB'))
        img, alpha = key(rgb)
        im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)]), 'RGBA')
        save(im, name[:1].upper() + name[1:].lower())


if __name__ == '__main__':
    main()
