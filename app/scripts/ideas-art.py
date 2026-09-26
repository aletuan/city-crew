#!/usr/bin/env python3
"""Build the Ideas header paintings from the two source renders.

    python3 scripts/ideas-art.py night.png afternoon.png

Writes assets/ideas-art-dark.webp and assets/ideas-art-light.webp
(600×572, WebP with alpha) — see src/components/IdeasHeaderArt.tsx for
how they are laid out and why they are transparent.

Each source is a 1536×1024 render on a flat ground close to the page
colour, the painting in its right half. The steps, for each:

  1. shift the whole image so the ground lands on the page colour
     exactly (#0A0B0A for the night, #F5F1EA for the afternoon);
  2. crop a window of the frame's aspect (600:572) with the paint from
     30% to 97% of its height — the empty top is what keeps the rooftops
     from under a 59pt status bar; the ground's faintest fade runs off
     the bottom, which a page shows as nothing — padding with the ground
     colour where the window runs off the source;
  3. resize, then key the ground to alpha with colour-to-alpha: the
     smallest alpha that reproduces each pixel over the page colour,
     zeroed where the pixel is within three units of it (grain) and
     ramped to full weight by ten.

The crop windows below were chosen by measuring where the paint is
(alpha above 0.2 after keying, which is what the build prints) so it
fills 30%–97% of the frame's height; a new render with the cats elsewhere needs them
re-measured. Needs Pillow and numpy.
"""

import os
import sys

import numpy as np
from PIL import Image

OUT = (600, 572)
# name, page colour, crop window (x0, y0, x1, y1) on the 1536×1024 source
JOBS = [
    ('dark', (0x0A, 0x0B, 0x0A), (680, -237, 1536, 579)),
    ('light', (0xF5, 0xF1, 0xEA), (451, -273, 1536, 761)),
]


def build(src_path, name, bg, box):
    src = np.array(Image.open(src_path).convert('RGB')).astype(int)
    corner = src[src.shape[0] // 2, 5]
    src = np.clip(src + (np.array(bg) - corner), 0, 255).astype(np.uint8)
    src = Image.fromarray(src)

    x0, y0, x1, y1 = box
    canvas = Image.new('RGB', (x1 - x0, y1 - y0), bg)
    canvas.paste(
        src.crop((max(x0, 0), max(y0, 0), min(x1, src.width), min(y1, src.height))),
        (max(0, -x0), max(0, -y0)),
    )
    small = np.array(canvas.resize(OUT, Image.LANCZOS)).astype(np.float32)

    b = np.array(bg, dtype=np.float32)
    d = np.abs(small - b).max(axis=2)
    up = np.where(small > b, (small - b) / np.maximum(255 - b, 1e-6), 0)
    dn = np.where(small < b, (b - small) / np.maximum(b, 1e-6), 0)
    alpha = np.clip(np.max(np.maximum(up, dn), axis=2), 0, 1) * np.clip((d - 3) / 7, 0, 1)
    colour = np.where(alpha[..., None] > 0, b + (small - b) / np.maximum(alpha[..., None], 1e-6), b)
    rgba = np.dstack([np.clip(colour, 0, 255), alpha * 255]).astype(np.uint8)

    out = os.path.join(os.path.dirname(__file__), '..', 'assets', f'ideas-art-{name}.webp')
    Image.fromarray(rgba, 'RGBA').save(out, 'WEBP', quality=90, method=6)
    ys, xs = np.where(alpha > 0.2)
    print(f'{name}: {os.path.getsize(out) // 1024} KB; paint from {ys.min() / OUT[1]:.0%} to {ys.max() / OUT[1]:.0%} of the height, from {xs.min() / OUT[0]:.0%} of the width')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    for path, (name, bg, box) in zip(sys.argv[1:], JOBS):
        build(path, name, bg, box)
