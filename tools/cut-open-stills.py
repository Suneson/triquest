"""cut-open-stills.py: the open chests (painted on a flat colour) as the chest screen's open stills.

    python tools/cut-open-stills.py <dir with open-<n>-<tier>.jpg>

The open still shows where the 3D chest can't run (reduced motion, no WebGL). Each picture is keyed off its
flat background (whatever colour it is: sampled from the corners), its soft glow kept by unmixing the background
out of it rather than cutting it, despilled, faded out toward the top so light that ran off the picture doesn't end on a
hard edge, then sized like the shut still and saved as icons/AnimatedRewards/still/<Tier>-open-2.webp.
"""
import glob, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
STILL = os.path.join(os.path.dirname(HERE), 'icons', 'AnimatedRewards', 'still')
SIZE = 448


def key(rgb):
    a = rgb.astype(float) / 255
    h, w, _ = a.shape
    corners = np.concatenate([a[:24, :24].reshape(-1, 3), a[:24, -24:].reshape(-1, 3), a[-24:, :24].reshape(-1, 3), a[-24:, -24:].reshape(-1, 3)])
    bg = np.median(corners, 0)
    d = np.linalg.norm(a - bg, axis=2)
    alpha = np.clip((d - 0.12) / 0.38, 0, 1)
    # unmix: what's left of the colour once the background behind a soft pixel is taken out
    fg = (a - (1 - alpha[..., None]) * bg) / np.maximum(alpha[..., None], 1e-3)
    fg = np.clip(fg, 0, 1)
    # despill: take out the background's colour where it leaked into the glow and the edges
    r, g, b = fg[..., 0], fg[..., 1], fg[..., 2]
    if bg[1] > max(bg[0], bg[2]):          # green screen: no pixel greener than its red or blue
        g[:] = np.minimum(g, np.maximum(r, b))
    elif min(bg[0], bg[2]) > bg[1]:        # magenta: no pixel more magenta than its green allows
        m = np.clip(np.minimum(r, b) - g, 0, None)
        r -= m; b -= m
        # and the pink haze painted into the glow (the chest has no reds or pinks): turned the glow's gold
        pink = (r - g > 0.15) & (b > g * 0.85)
        g[pink] = np.maximum(g[pink], r[pink] * 0.8); b[pink] = np.minimum(b[pink], g[pink] * 0.75)
    # light that runs off the top: fade it out over the top twelfth
    ramp = np.clip(np.arange(h) / (h * 0.08), 0, 1) ** 1.5
    alpha *= ramp[:, None]
    return np.dstack([fg * 255, alpha * 255]).astype(np.uint8)


def main():
    for f in sorted(glob.glob(os.path.join(sys.argv[1], 'open-*.jpg'))):
        tier = os.path.basename(f).split('-', 2)[2].rsplit('.', 1)[0]
        name = tier[0].upper() + tier[1:]
        pic = Image.fromarray(key(np.asarray(Image.open(f).convert('RGB'))), 'RGBA')
        # sized as the shut still: the chest's box as wide as there (glow may spill past it)
        shut = Image.open(os.path.join(STILL, f'{name}.webp')).convert('RGBA')
        sb = shut.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
        ob = pic.getchannel('A').point(lambda v: 255 if v > 200 else 0).getbbox()
        k = (sb[2] - sb[0]) / (ob[2] - ob[0])
        pic = pic.resize((round(pic.width * k), round(pic.height * k)), Image.LANCZOS)
        ob = [round(v * k) for v in ob]
        out = Image.new('RGBA', (SIZE, SIZE))
        # bottoms and middles lined up with the shut chest
        out.paste(pic, ((sb[0] + sb[2]) // 2 - (ob[0] + ob[2]) // 2, sb[3] - ob[3]), pic)
        out.save(os.path.join(STILL, f'{name}-open-2.webp'), quality=88, method=6)
        print(name, 'scale %.3f' % k)


if __name__ == '__main__':
    main()
