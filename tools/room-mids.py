"""room-mids.py: a half-size copy of every 32 x 32 room picture, for the app's normal zoom.

    python tools/room-mids.py

The room pictures (icons/Pixelart/NEW/<ROOM>/big-<level>.webp, tools/cut-rooms-32.py) are 3400 px
wide: about 26 MB each once a phone has decoded one, and 0.5 to 1.2 MB to fetch. At the zoom the
base opens at, a phone draws the room about 1200 px wide, so the app shows mid-<level>.webp
(1700 px, a quarter of the memory) and only fetches the full picture when you zoom in
(js/app/diorama-view.js). Run this again after cutting new rooms.
"""
import glob, os
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = 1700

total_big = total_mid = 0
for src in sorted(glob.glob(os.path.join(REPO, 'icons', 'Pixelart', 'NEW', '*', 'big-*.webp'))):
    im = Image.open(src).convert('RGBA')
    h = round(im.height * W / im.width)
    out = src.replace('big-', 'mid-')
    im.resize((W, h), Image.LANCZOS).save(out, quality=80, alpha_quality=90, method=6)
    total_big += os.path.getsize(src); total_mid += os.path.getsize(out)
    print(os.path.relpath(out, REPO), f'{os.path.getsize(out) // 1024} KB (full {os.path.getsize(src) // 1024} KB)')
print(f'full {total_big / 1e6:.1f} MB, mid {total_mid / 1e6:.1f} MB')
