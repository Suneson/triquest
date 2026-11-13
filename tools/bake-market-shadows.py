"""bake-market-shadows.py — the island's market pictures with their shadow drawn in.

On the island each market had a CSS drop-shadow, `drop-shadow(0 10px 8px rgba(10, 30, 20, .25))`.
A filter on a big picture is redrawn off screen at full size whenever it repaints (every zoom),
six times over. This bakes the same shadow into copies (icons/Market/island/market-N.webp), on a
canvas padded by PAD so the shadow fits. js/app/island-view.js takes the padding back off when it
places them (SHADOW_PAD), so each market stands exactly where it did.

The markets are drawn 651.2 px of the world wide from 720 px pictures, so the shadow's world px
are scaled by 720 / 651.2. A CSS blur of 8 px is a Gaussian of standard deviation 4 px.
Run again when a market picture changes:  python tools/bake-market-shadows.py
"""
import os

from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PAD = {'l': 16, 't': 16, 'r': 16, 'b': 32}   # keep in step with SHADOW_PAD in island-view.js
K = 720 / 651.2
DY = round(10 * K)
SIGMA = 4 * K
COLOUR = (10, 30, 20)
ALPHA = 0.25

os.makedirs(os.path.join(ROOT, 'icons', 'Market', 'island'), exist_ok=True)
for n in range(1, 9):
    src = Image.open(os.path.join(ROOT, 'icons', 'Market', f'market-{n}.webp')).convert('RGBA')
    W = src.width + PAD['l'] + PAD['r']
    H = src.height + PAD['t'] + PAD['b']
    mask = Image.new('L', (W, H), 0)
    mask.paste(src.getchannel('A'), (PAD['l'], PAD['t'] + DY))
    mask = mask.filter(ImageFilter.GaussianBlur(SIGMA)).point(lambda a: round(a * ALPHA))
    out = Image.new('RGBA', (W, H), COLOUR + (0,))
    out.putalpha(mask)
    out.alpha_composite(src, (PAD['l'], PAD['t']))
    out.save(os.path.join(ROOT, 'icons', 'Market', 'island', f'market-{n}.webp'), 'WEBP', quality=90, method=6)
    print(n, (W, H))
