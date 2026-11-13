"""make-room-items.py — smaller copies of the item pictures, for the rooms.

In a room an item is drawn at most about 200 px of the world wide, and the base zooms in to about
2 screen px per world px on a 3x phone: so 384 px on its longer side is as sharp as it ever shows.
The originals are 500-1000 px (the shop and the sheets show them big), and each one decoded is
1.5-2 MB. The room copy is about a fifth of that.

For every item picture (the keys of js/core/item-fit.js) bigger than SIDE, it writes
icons/room-items/<its path under icons/> and lists it in js/core/room-art.js, which the base
reads (roomCopy). Run it again when item art is added or changed:  python tools/make-room-items.py
"""
import json
import os
import re

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SIDE = 384

fit = open(os.path.join(ROOT, 'js', 'core', 'item-fit.js'), encoding='latin-1').read()   # it has a cp1252 dash
srcs = sorted(set(re.findall(r'"(icons/[^"]+\.webp)"', fit)))
made = []
before = after = 0
for src in srcs:
    path = os.path.join(ROOT, src)
    if not os.path.exists(path):
        continue
    im = Image.open(path)
    if max(im.size) <= SIDE:
        continue
    k = SIDE / max(im.size)
    small = im.convert('RGBA').resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = os.path.join(ROOT, 'icons', 'room-items', src[len('icons/'):])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    small.save(out, 'WEBP', quality=88, method=6)
    made.append(src)
    before += im.width * im.height * 4
    after += small.width * small.height * 4

js = """// room-art.js — the item pictures that have a smaller copy for the rooms (tools/make-room-items.py
// writes this file and the copies in icons/room-items/). Generated: don't edit by hand.

export const ROOM_COPIES = new Set(%s);

/** The picture to draw an item with in a room: its room copy when there is one. */
export const roomCopy = (src) => (ROOM_COPIES.has(src) ? src.replace(/^icons\\//, 'icons/room-items/') : src);
""" % json.dumps(made, indent=2)
open(os.path.join(ROOT, 'js', 'core', 'room-art.js'), 'w', encoding='utf-8', newline='\n').write(js)
print(f'{len(made)} copies; decoded {before / 1048576:.0f} MB -> {after / 1048576:.0f} MB')
