"""Contact sheets for the photo-labels skill.

Reads a JSON list of {"id": ..., "uri": ...} (the query in SKILL.md, step
1), downloads each photograph, shrinks it to fit 448 px, and writes 3×3
sheets with a yellow number in each cell's corner. Prints one line per
sheet and writes index.json mapping each number back to its photo id.

448 px because that is what round 2 was answered from (17 Oct 2026):
96/100 agreement with the owner at that size, and a sheet of nine stays
one image to look at.

Usage: python3 sheets.py photos.json OUT_DIR
Needs Pillow; if it will not import, install it to a scratch folder and
put that on PYTHONPATH (see SKILL.md).
"""
import io
import json
import os
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont

CELL = 380
THUMB = 448


def main(src: str, out: str) -> None:
    photos = json.load(open(src))
    os.makedirs(os.path.join(out, 'thumbs'), exist_ok=True)
    index, missing = {}, []
    for n, p in enumerate(photos, 1):
        try:
            data = urllib.request.urlopen(p['uri'], timeout=30).read()
            im = Image.open(io.BytesIO(data)).convert('RGB')
            im.thumbnail((THUMB, THUMB))
            im.save(os.path.join(out, 'thumbs', f'{n:03d}.jpg'), quality=80)
            index[n] = p['id']
        except Exception as e:  # a photograph that will not load is reported, not guessed
            missing.append((n, p['id'], str(e)))
    font = ImageFont.load_default(20)
    numbers = sorted(index)
    for s in range(0, len(numbers), 9):
        sheet = Image.new('RGB', (CELL * 3, CELL * 3), (30, 30, 30))
        draw = ImageDraw.Draw(sheet)
        for k, n in enumerate(numbers[s:s + 9]):
            im = Image.open(os.path.join(out, 'thumbs', f'{n:03d}.jpg'))
            im.thumbnail((CELL - 8, CELL - 8))
            x0, y0 = (k % 3) * CELL, (k // 3) * CELL
            sheet.paste(im, (x0 + (CELL - im.width) // 2, y0 + (CELL - im.height) // 2))
            draw.rectangle([x0, y0, x0 + 46, y0 + 30], fill=(255, 230, 0))
            draw.text((x0 + 6, y0 + 6), str(n), fill=(0, 0, 0), font=font)
        path = os.path.join(out, f'sheet{s // 9 + 1:02d}.jpg')
        sheet.save(path, quality=85)
        print(path)
    json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=1)
    for n, pid, err in missing:
        print(f'MISSING {n} {pid}: {err}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
