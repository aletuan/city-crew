#!/usr/bin/env python3
"""Build the sign-in sheet's painting from the two source renders.

    python3 scripts/signin-art.py night.png day.png

Writes assets/signin-art-dark.webp and assets/signin-art-light.webp
(900×471, WebP with alpha) — see src/components/AuthSheet.tsx for how
the sheet shows them.

Each source is a 1448×1086 render of the two cats and the paper plane
on a flat ground: (15,16,18) for the night, (249,246,242) for the day.
The steps are those of `ideas-art.py`, keyed against the sheet rather
than the page, since that is what shows through:

  1. shift the whole image so the ground lands on the sheet colour
     exactly (`bgElevated`: #151614 dark, #FFFFFF light). Neither
     ground matched it; unkeyed, the day's cream reads as a card on a
     white sheet, and the night's is a faint rectangle on an OLED;
  2. crop one window from both, so the cats stand in the same place
     whichever scheme is on;
  3. resize, then key the ground to alpha with colour-to-alpha: the
     smallest alpha that reproduces each pixel over the sheet colour,
     zeroed within three units of it (grain) and ramped to full by ten.

The window is the paint's bounding box in both renders, measured at
more than twelve units off the ground: x 198–1259 and y 266–807 on the
night, x 215–1236 and y 265–777 on the day. Their union, with 16–22px
of ground around it so the fade at the edges is not cut, is 1100×576:
the frame's aspect. A new render needs it re-measured. Needs Pillow and
numpy.
"""

import os
import sys

import numpy as np
from PIL import Image

OUT = (900, 471)
BOX = (176, 248, 1276, 824)
# name, sheet colour
JOBS = [
    ('dark', (0x15, 0x16, 0x14)),
    ('light', (0xFF, 0xFF, 0xFF)),
]


def build(src_path, name, bg):
    src = np.array(Image.open(src_path).convert('RGB')).astype(int)
    corner = src[src.shape[0] // 2, 5]
    src = Image.fromarray(np.clip(src + (np.array(bg) - corner), 0, 255).astype(np.uint8))
    small = np.array(src.crop(BOX).resize(OUT, Image.LANCZOS)).astype(np.float32)

    b = np.array(bg, dtype=np.float32)
    d = np.abs(small - b).max(axis=2)
    up = np.where(small > b, (small - b) / np.maximum(255 - b, 1e-6), 0)
    dn = np.where(small < b, (b - small) / np.maximum(b, 1e-6), 0)
    alpha = np.clip(np.max(np.maximum(up, dn), axis=2), 0, 1) * np.clip((d - 3) / 7, 0, 1)
    colour = np.where(alpha[..., None] > 0, b + (small - b) / np.maximum(alpha[..., None], 1e-6), b)
    rgba = np.dstack([np.clip(colour, 0, 255), alpha * 255]).astype(np.uint8)

    out = os.path.join(os.path.dirname(__file__), '..', 'assets', f'signin-art-{name}.webp')
    Image.fromarray(rgba, 'RGBA').save(out, 'WEBP', quality=90, method=6)
    edge = max(alpha[0].max(), alpha[-1].max(), alpha[:, 0].max(), alpha[:, -1].max())
    print(f'{name}: {os.path.getsize(out) // 1024} KB; strongest alpha on the frame edge {edge:.2f}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    for path, (name, bg) in zip(sys.argv[1:], JOBS):
        build(path, name, bg)
