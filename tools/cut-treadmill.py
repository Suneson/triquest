"""cut-treadmill.py — the run room's treadmill (icons/Pixelart/NEW/ITEMS/treadmill.webp).

    python3 tools/cut-treadmill.py

The painted source (ITEMS/src/treadmill.jpg) is on green with a stray painted
streak under the machine. The green is keyed out (cut-reward-stills.py's key),
then only the machine is kept: the largest solid piece, with its soft edge.
The green showing through its gaps is keyed too; its small green button stays.
Trimmed, 768 px wide. Build-time only (Pillow, numpy, scipy).
"""
import os, importlib.util
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('keyer', os.path.join(ROOT, 'tools', 'cut-reward-stills.py'))
keyer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(keyer)

SRC = os.path.join(ROOT, 'icons/Pixelart/NEW/ITEMS/src/treadmill.jpg')
OUT = os.path.join(ROOT, 'icons/Pixelart/NEW/ITEMS/treadmill.webp')

rgb = np.asarray(Image.open(SRC).convert('RGB'))
img, alpha = keyer.key(rgb, min_hole=4000)  # the gaps between the legs and in the cable loop
labels, n = ndimage.label(alpha > 0.6)
sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
machine = labels == (int(np.argmax(sizes)) + 1)
keep = ndimage.binary_dilation(machine, iterations=6)   # its own soft edge, nothing further
alpha = np.where(keep, alpha, 0)
im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)]), 'RGBA')
im = im.crop(Image.fromarray((alpha > 0.03).astype(np.uint8) * 255).getbbox())
w = 768
im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
im.save(OUT, 'WEBP', quality=90, method=6)
print(OUT, im.size, os.path.getsize(OUT))
