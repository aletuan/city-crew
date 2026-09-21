#!/usr/bin/env python3
"""Draw the map's pins from the category table.

Run by hand, and rarely — only when a category is added or recoloured:

    cd app && python3 -m pip install --quiet Pillow && python3 scripts/map-pins.py

Not part of the build and not run in CI, which has no Python. What keeps
the assets honest is `pins.manifest.json` and the test in
`src/lib/taxonomy.test.ts` that reads it back against the table; forget to
run this after touching the table and that test goes red.

The table is parsed rather than copied, so there is one source of truth for
a category's fill. If the parse stops matching the file's shape this exits
non-zero rather than emitting a half-built set.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

APP = Path(__file__).resolve().parent.parent
CATEGORIES_TS = APP / 'src/lib/categories.ts'
VENDOR = APP / 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons'
TTF = VENDOR / 'Fonts/Ionicons.ttf'
GLYPHS = json.loads((VENDOR / 'glyphmaps/Ionicons.json').read_text())
OUT = APP / 'assets/pins'

# Points, not pixels. Every density is these numbers times its scale.
HEAD = 34          # the round head's diameter
HEIGHT = 44        # head plus tail
RING = 2.5         # the white ring that lifts a pin off any tile
GLYPH = 16
CHOSEN_SCALE = 1.28
DENSITIES = [(1, ''), (2, '@2x'), (3, '@3x')]
SS = 4             # supersample factor; ImageDraw does not antialias

WHITE = (255, 255, 255, 255)


def parse_table():
    """(key, icon, fill) for each category, in the file's own order."""
    src = CATEGORIES_TS.read_text()
    body = src.split('export const CATEGORIES', 1)[1]
    out = []
    for m in re.finditer(
        r"\n  (\w+): \{(.*?)\n  \},", body, re.S
    ):
        key, block = m.group(1), m.group(2)
        icon = re.search(r"icon: '([\w-]+)'", block)
        fill = re.search(r"pin: '(#[0-9A-F]{6})'", block)
        if not icon or not fill:
            sys.exit(f'categories.ts: {key} has no icon or no pin')
        out.append((key, icon.group(1), fill.group(1)))
    if len(out) != 9:
        sys.exit(f'categories.ts: parsed {len(out)} categories, expected 9')
    return out


def rgba(hexs):
    return tuple(int(hexs[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def draw(fill, icon, ink, scale, chosen=False):
    """One pin, at one density.

    No baked shadow. The white ring is what separates a pin from a tile —
    checked against a white road, a light park, the night ground and a dark
    park — and a shadow would push the tail's tip off the bottom edge,
    which is the point `anchor` resolves to.

    Drawn at SS times the wanted size and scaled back down, because
    `ImageDraw` has no antialiasing at all: a circle drawn straight to the
    output is visibly stepped along its rim, and on a pin whose whole job
    is a clean white ring that reads as a stair. Lanczos on the way down
    is what smooths it.
    """
    k = scale * (CHOSEN_SCALE if chosen else 1.0)
    w, h = round(HEAD * k), round(HEIGHT * k)
    W, H = w * SS, h * SS
    ring = max(1, round(RING * k))
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = ring * SS
    # Head, then tail, then head again: the tail is drawn over the head's
    # lower ring so the two read as one outline rather than a circle
    # sitting on a triangle.
    # The tail is the fill's triangle grown by the ring on every side, not
    # a thin spike with a white outline: at 34pt a one-ring-wide taper
    # reads as a needle stuck to a circle, and on the night map the white
    # swallows what little colour is left in it.
    tail = r * 1.9
    d.ellipse([0, 0, W - 1, W - 1], fill=WHITE)
    d.polygon([(W * 0.5 - tail - r, W * 0.70), (W * 0.5 + tail + r, W * 0.70), (W * 0.5, H - 1)], fill=WHITE)
    d.ellipse([r, r, W - 1 - r, W - 1 - r], fill=rgba(fill))
    d.polygon([(W * 0.5 - tail, W * 0.66), (W * 0.5 + tail, W * 0.66), (W * 0.5, H - 1 - r * 1.5)], fill=rgba(fill))
    im = im.resize((w, h), Image.LANCZOS)

    # The glyph is drawn after the downscale: FreeType antialiases type on
    # its own, and supersampling it too only softens it.
    px = round(GLYPH * k)
    font = ImageFont.truetype(str(TTF), px)
    g = Image.new('RGBA', (px * 2, px * 2), (0, 0, 0, 0))
    ImageDraw.Draw(g).text((px, px), chr(GLYPHS[icon]), font=font, fill=rgba(ink), anchor='mm')
    g = g.crop(g.getbbox())
    im.alpha_composite(g, ((w - g.width) // 2, (w - g.height) // 2))
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cats = parse_table()
    src = CATEGORIES_TS.read_text()

    def const(name):
        m = re.search(rf"export const {name} = '(#[0-9A-F]{{6}})'", src)
        if not m:
            sys.exit(f'categories.ts: no {name}')
        return m.group(1)

    neutral = const('MAP_PIN_NEUTRAL_FILL')
    coral = const('MAP_PIN_CHOSEN_FILL')
    ink = const('MAP_PIN_CHOSEN_INK')

    entries = [(k, i, f) for k, i, f in cats] + [('neutral', 'ellipse-outline', neutral)]
    manifest = {}
    for key, icon, fill in entries:
        for chosen in (False, True):
            name = f'{key}-chosen' if chosen else key
            f = coral if chosen else fill
            glyph_ink = ink if chosen else '#FFFFFF'
            for scale, suffix in DENSITIES:
                draw(f, icon, glyph_ink, scale, chosen).save(OUT / f'{name}{suffix}.png')
            manifest[name] = {'file': f'{name}.png', 'icon': icon, 'fill': f, 'ink': glyph_ink}

    (OUT / 'pins.manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    print(f'{len(manifest)} pins, {len(manifest) * 3} files → {OUT.relative_to(APP)}')


if __name__ == '__main__':
    main()
