# Marker dạng ảnh có icon cho PlacesMap — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay marker mặc định của `react-native-maps` bằng PNG dựng sẵn mang icon category, để bản đồ nói được "đây là quán cà phê" chứ không chỉ "đây là màu nâu" — trên cả iOS lẫn Android.

**Architecture:** Ba lớp tách bạch. `lib/categories.ts` quyết định **category nào thắng** (thuần, đã có sẵn một nửa) và giữ màu nền PNG. `scripts/map-pins.py` đọc chính file đó rồi sinh 60 PNG + một manifest. `components/mapPins.ts` là bảng `import` tĩnh, không logic. `PlacesMap.tsx` bỏ `pinColor` và đặt `icon` — không phải đổi tên prop mà là thay hẳn, vì giữ `pinColor` sẽ ghi đè icon.

**Tech Stack:** React Native 0.86 (Expo SDK 57), `react-native-maps` 1.27.2, Python 3 + Pillow (chỉ để sinh asset, không nằm trong đường build), vitest + jsdom qua `react-native-web`, Maestro + `simctl` để verify.

**Spec:** `docs/superpowers/specs/2026-09-21-map-pin-images-design.md`

---

## Dữ kiện nền (đã kiểm, không cần kiểm lại)

| Dữ kiện | Nguồn |
|---|---|
| `Marker.icon` gán thẳng `_realMarker.icon` trên iOS; `Marker.image` dựng `UIImageView` → `_realMarker.iconView` (marker nền View). **Phải dùng `icon`.** | `node_modules/react-native-maps/ios/AirGoogleMaps/AIRGoogleMapMarker.m:345` (`setImageSrc`) vs `:417` (`setIconSrc`) |
| Trên Android hai prop là một: cùng gọi `view.setImage(source)` | `MapMarkerManager.java:216` và `:224` |
| `anchor` **đã mặc định** `{x: 0.5, y: 1.0}` — không có độ lệch nào phải sửa | `MapMarker.d.ts:20`, `MapMarkerManager.java:200-207` |
| **`pinColor` phải bị bỏ hẳn.** `setPinColor:` gán **vô điều kiện** `_realMarker.icon = markerImageWithColor:` — nó *ghi đè icon*. `didInsertInMap` áp lại `_pinColor` sau khi chèn marker, đồng bộ, trong khi `setIconSrc` nạp ảnh bất đồng bộ. `PlacesMap` lại truyền `pinColor` động theo `selectedSlug`, nên mỗi lần chạm một pin thì icon bị thay bằng pin mặc định của Google và **không** được khôi phục | `AIRGoogleMapMarker.m:470-473` và `:127-130` |
| Trên iOS pin **vô hình trong một hai khung hình đầu**: `setIconSrc` chèn `UIImage` rỗng rồi mới nạp ảnh qua `ImageLoader` bất đồng bộ | `AIRGoogleMapMarker.m:418-447` |
| `Platform` chỉ được dùng đúng một chỗ trong `PlacesMap.tsx` là `INK` (dòng 34), nên xoá `INK` thì phải xoá luôn import `Platform` | `PlacesMap.tsx:21, :34` |
| `neutralPin` **không tồn tại** trong repo — chỉ có `INK` và nhánh `?? INK` ở dòng 258 | `grep -rn neutralPin src/` không ra kết quả |
| Vitest phân giải được `import x from '*.png'` (Vite trả chuỗi URL). Tiền lệ đang chạy trong repo | `SignUpScreen.tsx:27`, `WelcomeSheet.tsx:68` + UI test của chúng |
| **Asset có kiểu khác nhau giữa hai môi trường**: trên RN, `import x from './a.png'` là một `number` (id module); dưới Vite nó là `string` (URL). Test so sánh `getAttribute()` (string) với `pinImage()` nên **phải bọc `String(...)`** — chạy thì đúng ở cả hai, nhưng viết trần sẽ lệch kiểu | quy ước RN + `vitest.config.ts` |
| Cổng coverage `include: ['src/lib/*.ts', 'src/lib/data/*.ts', 'src/screens/*.tsx']` — `components/mapPins.ts`, `PlacesMap.tsx`, `scripts/`, `assets/` **nằm ngoài**. Chỉ `lib/categories.ts` bị soi, và nó đang 100/100/100/100 | `vitest.config.ts` |
| Dưới một chip, **mọi** pin mặc màu chip — quyết định có chủ đích, không được xoá | `PlacesMap.tsx:87-96` (doc comment của prop `category`) |
| Chấm màu trên thẻ đáy bản đồ dùng cùng quy tắc chọn category | `ExploreScreen.tsx:1538` |
| Ionicons TTF + glyph map để sinh icon | `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf`, `.../glyphmaps/Ionicons.json` |
| Bubble cluster mang số đếm liên tục (tới 288) nên **buộc** phải là View — ngoài phạm vi | `PlacesMap.tsx:51-59` |
| Metro cần file gốc tồn tại mới phân giải được `@2x`/`@3x` | quy ước RN |
| Verify trên simulator: `eas env:exec production` cho Metro, đặt `simctl location` trước mỗi lần chạy, đổi theme qua Profile chứ không qua hệ thống | memory `google-maps-key-workflow`, `ios-simulator-verify-loop` |
| **Không kết luận gì về hiển thị mà không chụp màn hình và lấy mẫu pixel** — chính quy tắc này đã bác bỏ lần thử trước (nhánh `map-pin-weight`, đã xoá) | memory `map-pin-color-rendering` |

## Bảng màu đã chốt

| key | icon Ionicons | nền PNG | icon trắng vs nền |
|---|---|---|---|
| `cafes` | `cafe-outline` | `#B75F05` | 4.51 |
| `focus` | `laptop-outline` | `#6468E2` | 4.55 |
| `eats` | `restaurant-outline` | `#A45E2F` | 4.98 |
| `views` | `business-outline` | `#216572` | 6.63 |
| `heritage` | `library-outline` | `#DA3C28` | 4.51 |
| `nature` | `leaf-outline` | `#28881E` | 4.54 |
| `markets` | `bag-outline` | `#DB2190` | 4.53 |
| `nightlife` | `wine-outline` | `#8E54EE` | 4.51 |
| `fun` | `ticket-outline` | `#B93FC9` | 4.55 |
| neutral | `ellipse-outline` | `#5F5A4E` | 6.86 |
| được chọn | *(giữ icon category)* | `#FF6F5B` | icon **mực `#17150F`**, 6.67 |

Quy tắc chọn, theo đúng thứ tự ưu tiên — cần cả ba vế:

1. **hue trùng khít hue của chip** (vế nặng nhất: nó làm pin và chip thành *một* màu),
2. **saturation ≥ 55%**,
3. trong số còn lại, màu **sáng nhất** mà icon trắng vẫn ≥ 4.5:1.

Ba giá trị vượt ngưỡng (`views` 6.63, `eats` 4.98, neutral 6.86) **không phải nhầm — đừng "sửa"**. Trên hue của `views` có `#2A8192` sáng hơn và vẫn đạt 4.51, nhưng lệch hue 0.18°, còn `#216572` lệch 0.0000°: vế 1 thắng vế 3. Neutral là xám chọn tay, không nằm trên đường hue nào.

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `app/src/lib/categories.ts` (sửa) | Thêm `pinCategory(p, chip)` — category nào thắng, chip hay địa điểm. Thêm trường `pin` (màu nền PNG) cho 9 category, và `MAP_PIN_NEUTRAL_FILL` / `MAP_PIN_CHOSEN_FILL` / `MAP_PIN_CHOSEN_INK`. Viết lại `pinTint` trên nền `pinCategory`. |
| `app/src/lib/taxonomy.test.ts` (sửa) | Test `pinCategory`; bất biến bảng màu (hue giữ nguyên, icon trắng ≥ 4.5:1); manifest phủ hết `CATEGORY_ORDER` và khớp màu. |
| `app/scripts/map-pins.py` (tạo) | Đọc `categories.ts`, vẽ 60 PNG, ghi `pins.manifest.json`. Không chạy trong CI. |
| `app/assets/pins/*.png` (tạo) | 60 file. |
| `app/assets/pins/pins.manifest.json` (tạo) | Generator ghi ra; test đọc vào. |
| `app/src/components/mapPins.ts` (tạo) | `import` tĩnh 20 asset + `pinImage(place, chip, chosen)`. Không tính toán category — uỷ cho `lib`. |
| `app/src/components/PlacesMap.tsx` (sửa) | `pinColor` → `icon`; **bỏ hẳn `pinColor`**. Xoá `INK`, nhánh `?? INK`, và import `Platform`. |
| `app/src/components/PlacesMap.ui.test.tsx` (sửa) | Stub `Marker` ghi thêm `icon`; khẳng định ảnh theo category, theo chip, pin được chọn, neutral, `tracksViewChanges === false`. |
| `app/src/screens/ExploreScreen.ui.test.tsx` (sửa) | Stub Marker riêng ở dòng 126 phải ghi thêm `data-icon`; test chip chuyển từ `data-color` sang ảnh. Sửa trong **cùng commit** với Task 6. |

Không tạo thư viện mới. Không đụng `cluster.ts`, `mapStyle.ts`, `MiniMap.tsx`.

---

### Task 1: `pinCategory` — một quy tắc, hai cách đọc

Hôm nay `pinTint` trộn hai việc: chọn category *và* tra màu. Pin dạng ảnh cần đúng nửa đầu. Tách ra trước, để `pinTint` và `pinImage` không thể trôi khỏi nhau.

**Files:**
- Modify: `app/src/lib/categories.ts`
- Test: `app/src/lib/taxonomy.test.ts`

- [ ] **Step 1: Viết test đỏ**

Thêm vào `taxonomy.test.ts`, và thêm `pinCategory` vào khối `import` từ `./categories`:

```ts
describe('pinCategory', () => {
  // Dưới một chip, mọi địa điểm *là* loại đó rồi, nên chip là câu trả lời
  // duy nhất nói thêm được điều gì. Quy tắc này được bảo vệ ở doc comment
  // của prop `category` trong PlacesMap; nó sống ở đây để cái pin và cái
  // chấm trên thẻ không thể trả lời khác nhau.
  it('is the chip while a chip is asking', () => {
    expect(pinCategory({ categories: ['cafes'] }, 'focus')).toBe('focus');
  });

  it('is the place’s own first category at All, or under a chip nobody knows', () => {
    expect(pinCategory({ categories: ['cafes'] }, null)).toBe('cafes');
    expect(pinCategory({ categories: ['cafes'] })).toBe('cafes');
    expect(pinCategory({ categories: ['cafes'] }, 'street_food')).toBe('cafes');
  });

  it('picks the filter row’s order, not the stored order', () => {
    expect(pinCategory({ categories: ['views', 'cafes'] }, null)).toBe('cafes');
  });

  it('reaches the legacy fallback the same way categoriesOf does', () => {
    expect(pinCategory({ vibe_tags: ['food_tour'] }, null)).toBe('eats');
  });

  it('is nothing at all for a place nothing classifies', () => {
    expect(pinCategory({}, null)).toBeNull();
    expect(pinCategory({ categories: ['street_food'] }, null)).toBeNull();
  });

  // pinTint is now a reading of pinCategory rather than a second rule.
  it('is the rule pinTint reads', () => {
    for (const chip of [null, 'focus', 'street_food']) {
      const key = pinCategory({ categories: ['cafes'] }, chip);
      expect(pinTint({ categories: ['cafes'] }, chip)).toBe(key ? CATEGORIES[key].color : null);
    }
  });
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd app && npx vitest run src/lib/taxonomy.test.ts`
Expected: FAIL — `pinCategory is not a function` (hoặc lỗi import).

- [ ] **Step 3: Viết code tối thiểu**

Trong `categories.ts`, thay thân `pinTint` và thêm hàm mới ngay trên nó:

```ts
/**
 * Which category a place answers to where only one answer fits — the pin
 * on the map, the dot on the card.
 *
 * Under a chip it is the chip, because every place shown is already that
 * kind of place and painting each one what it is "most" says nothing: the
 * filter row says Focus while a dozen pins say café, because a place that
 * is both takes the earlier of the two. Otherwise it is the place's own
 * first category in the filter row's order.
 *
 * Null where nothing classifies it and no chip is asking; the caller draws
 * its own ink.
 *
 * This is the rule. `pinTint` and `pinImage` are two readings of it, and
 * they live apart so the map's pin and the strip card's dot cannot come to
 * disagree about which category a place is.
 */
export function pinCategory(p: Categorisable, chip?: string | null): string | null {
  if (chip && CATEGORIES[chip]) return chip;
  return chiefCategory(p);
}

export function pinTint(p: Categorisable, chip?: string | null): string | null {
  const key = pinCategory(p, chip);
  return key ? CATEGORIES[key].color : null;
}
```

`chiefCategory` chưa tồn tại — thêm nó và viết lại `categoryColor` trên nền nó:

```ts
/** The first of a place's categories in the filter row's order — what it
 *  is *most*, where a place can be several things. */
function chiefCategory(p: Categorisable): string | null {
  const cats = categoriesOf(p);
  return CATEGORY_ORDER.find((c) => cats.includes(c)) ?? null;
}

export function categoryColor(p: Categorisable): string | null {
  const key = chiefCategory(p);
  return key ? CATEGORIES[key].color : null;
}
```

- [ ] **Step 4: Chạy để thấy xanh**

Run: `cd app && npx vitest run src/lib/taxonomy.test.ts`
Expected: PASS, toàn bộ file.

- [ ] **Step 5: Kiểm cổng coverage chưa vỡ**

Run: `cd app && npm run coverage 2>&1 | grep "categories.ts"`
Expected: `categories.ts | 100 | 100 | 100 | 100`

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/categories.ts app/src/lib/taxonomy.test.ts
git commit -m "One rule about which category, two readings of it"
```

---

### Task 2: Màu nền PNG, và bất biến giữ nó trung thực

**Files:**
- Modify: `app/src/lib/categories.ts`
- Test: `app/src/lib/taxonomy.test.ts`

- [ ] **Step 1: Viết test đỏ**

Thêm vào `taxonomy.test.ts` (và thêm `MAP_PIN_CHOSEN_FILL`, `MAP_PIN_CHOSEN_INK`, `MAP_PIN_NEUTRAL_FILL` vào import):

```ts
// ── the fill behind a map pin's glyph ──
//
// A chip glyph is drawn on a surface this app chose with the category's
// name written beside it, so its colour is a third and redundant channel
// and is free to be quiet. A map pin carries a white glyph on a tile
// nobody here chose. Same hue — that is what makes it the same colour —
// at whatever weight the glyph needs.

/** sRGB relative luminance, per WCAG. */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

const WHITE = '#FFFFFF';

describe('the map pin palette', () => {
  it('gives every category in the filter row a fill', () => {
    for (const key of CATEGORY_ORDER) {
      expect(CATEGORIES[key].pin).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  // What makes the pin and the chip one colour rather than two that were
  // once related.
  it('keeps each category’s hue exactly', () => {
    for (const key of CATEGORY_ORDER) {
      expect(Math.abs(hue(CATEGORIES[key].pin) - hue(CATEGORIES[key].color))).toBeLessThan(0.5);
    }
  });

  // The glyph is the whole point of the change; a glyph nobody can read
  // is a pin that says less than the colour it replaced.
  it('carries a white glyph at 4.5:1 or better', () => {
    for (const key of CATEGORY_ORDER) {
      expect(contrast(CATEGORIES[key].pin, WHITE)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(MAP_PIN_NEUTRAL_FILL, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  // The chosen pin keeps the brand coral, which a white glyph cannot sit
  // on — hence the inversion. Darkening the coral instead would have
  // walked it onto `heritage`, whose hue it already shares to within a
  // degree.
  it('inverts the chosen pin’s glyph rather than darkening its coral', () => {
    expect(MAP_PIN_CHOSEN_FILL).toBe('#FF6F5B');
    expect(contrast(MAP_PIN_CHOSEN_FILL, WHITE)).toBeLessThan(3);
    expect(contrast(MAP_PIN_CHOSEN_FILL, MAP_PIN_CHOSEN_INK)).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd app && npx vitest run src/lib/taxonomy.test.ts -t "map pin palette"`
Expected: FAIL — `CATEGORIES.cafes.pin` là `undefined`.

- [ ] **Step 3: Viết code tối thiểu**

Trong `CategoryStyle`, thêm ngay dưới `color`:

```ts
  /**
   * The fill behind a map pin's glyph — the same colour as `color`, at the
   * weight a white glyph on a map tile needs.
   *
   * `color` is drawn literally, on a surface this app chose, with the
   * category's name spelled out beside it: a third and redundant channel,
   * free to be quiet. A pin has no label, carries a white glyph, and lands
   * on tiles nobody here chose. The pastels sit between 2.3:1 and 2.7:1
   * against white, under the 4.5:1 a glyph needs.
   *
   * Hue is identical to `color`, which is what makes this the same colour
   * rather than a second one. The value is the lightest step on that hue
   * whose glyph still clears 4.5:1 — solved against the glyph, never
   * against a fixed lightness, because blue and green carry more luminance
   * at the same HSL step and would hand `nature` a 2.32:1 glyph.
   * `taxonomy.test.ts` holds both halves.
   */
  pin: string;
```

Thêm `pin` vào từng entry (giá trị ở bảng trên), rồi ba hằng ở cuối file:

```ts
/**
 * The pin under the reader's thumb — the one whose card is open in the
 * strip.
 *
 * The app's own accent, unchanged, because the one pin the reader chose is
 * the one thing on the map that should be wearing it. Its glyph inverts to
 * ink rather than the white every other pin carries: white on coral reads
 * at 2.74:1, and darkening the coral until white worked walked it onto
 * `heritage`, which shares its hue to within a degree. Inverting keeps the
 * brand colour and gets 6.67:1.
 *
 * The category's own glyph stays, so the chosen pin still says what kind
 * of place it is. That is what finally retires the coral/Culture
 * collision: the glyph carries the category and the colour is free to mean
 * only "this one".
 */
export const MAP_PIN_CHOSEN_FILL = '#FF6F5B';
export const MAP_PIN_CHOSEN_INK = '#17150F';

/** A place no category claims. Grey rather than a guess — see
 *  `categoriesOf` on why nothing is the honest answer — dark enough to
 *  carry the same white glyph as the rest. */
export const MAP_PIN_NEUTRAL_FILL = '#5F5A4E';
```

- [ ] **Step 4: Chạy để thấy xanh**

Run: `cd app && npx vitest run src/lib/taxonomy.test.ts && npm run typecheck`
Expected: PASS cả hai.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/categories.ts app/src/lib/taxonomy.test.ts
git commit -m "The fill a white glyph can sit on, at each category's own hue"
```

---

### Task 3: Generator và 60 asset

Không có bước đỏ-xanh ở đây: đầu ra là ảnh nhị phân, và cái giữ nó trung thực là test manifest ở Task 4. Chạy generator **trước**, để Task 4 có cái để kiểm.

**Files:**
- Create: `app/scripts/map-pins.py`
- Create: `app/assets/pins/*.png` (60), `app/assets/pins/pins.manifest.json`

- [ ] **Step 1: Viết generator**

Tạo `app/scripts/map-pins.py`:

```python
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
```

- [ ] **Step 2: Chạy generator**

```bash
cd app && python3 -m pip install --quiet Pillow && python3 scripts/map-pins.py
```
Expected: `20 pins, 60 files → assets/pins`

- [ ] **Step 3: Nhìn tận mắt một cái**

Mở `app/assets/pins/cafes@3x.png` và `app/assets/pins/heritage-chosen@3x.png`.
Expected: giọt nước, vành trắng, icon ở giữa đọc rõ; bản `-chosen` to hơn rõ rệt và icon màu mực chứ không trắng. Đuôi nhọn chạm đúng cạnh dưới ảnh.

**Đừng hoảng khi mở bản `@1x`** (`cafes.png`, 34×44): ở cỡ đó glyph gần như không đọc được. Nó chỉ tồn tại để Metro phân giải được tên file — không thiết bị nào còn chạy @1x. Chỉ đánh giá bằng `@2x` và `@3x`.

Nếu icon bị lệch hoặc tràn, chỉnh `GLYPH` rồi chạy lại — đừng sửa tay file PNG.

- [ ] **Step 4: Commit**

```bash
git add app/scripts/map-pins.py app/assets/pins
git commit -m "Draw the pins from the table that already knows their colours"
```

---

### Task 4: Bất biến chặn trôi lệch

Rủi ro thật của asset sinh sẵn: thêm một category rồi quên chạy generator, và bản đồ im lặng vẽ thiếu một loại.

**Files:**
- Test: `app/src/lib/taxonomy.test.ts`

- [ ] **Step 1: Viết test đỏ**

```ts
// The assets are generated by hand (`scripts/map-pins.py`) and CI has no
// Python to regenerate them, so this is what stands between the table and
// a category that silently has no pin.
describe('the pin assets', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../assets/pins/pins.manifest.json', import.meta.url), 'utf8'),
  ) as Record<string, { file: string; icon: string; fill: string; ink: string }>;

  it('has a pin and a chosen pin for every category in the filter row', () => {
    for (const key of CATEGORY_ORDER) {
      expect(manifest[key], `no pin drawn for ${key} — run scripts/map-pins.py`).toBeDefined();
      expect(manifest[`${key}-chosen`]).toBeDefined();
    }
    expect(manifest.neutral).toBeDefined();
    expect(manifest['neutral-chosen']).toBeDefined();
  });

  it('drew each category in the colour and glyph the table declares', () => {
    for (const key of CATEGORY_ORDER) {
      expect(manifest[key].fill).toBe(CATEGORIES[key].pin);
      expect(manifest[key].icon).toBe(CATEGORIES[key].icon);
    }
    expect(manifest.neutral.fill).toBe(MAP_PIN_NEUTRAL_FILL);
  });

  it('drew the chosen pins in the accent, with the inverted glyph', () => {
    for (const key of [...CATEGORY_ORDER, 'neutral']) {
      expect(manifest[`${key}-chosen`].fill).toBe(MAP_PIN_CHOSEN_FILL);
      expect(manifest[`${key}-chosen`].ink).toBe(MAP_PIN_CHOSEN_INK);
      // The chosen pin keeps its category's glyph — the colour says "this
      // one", the glyph still says what kind of place it is.
      expect(manifest[`${key}-chosen`].icon).toBe(manifest[key].icon);
    }
  });

  it('drew nothing the table does not ask for', () => {
    const wanted = new Set([...CATEGORY_ORDER, 'neutral'].flatMap((k) => [k, `${k}-chosen`]));
    expect(Object.keys(manifest).sort()).toEqual([...wanted].sort());
  });
});
```

Thêm `import { readFileSync } from 'node:fs';` lên đầu file.

- [ ] **Step 2: Chạy**

Run: `cd app && npx vitest run src/lib/taxonomy.test.ts -t "pin assets"`
Expected: PASS (asset đã sinh ở Task 3).

- [ ] **Step 3: Chứng minh test này thật sự bắt được lỗi**

Không được bỏ bước này — một test luôn xanh không phải lưới an toàn. Sửa tạm `pins.manifest.json`, đổi `cafes.fill` thành `#000000`, chạy lại.
Expected: FAIL ở `drew each category in the colour and glyph the table declares`.
Hoàn tác: `git checkout app/assets/pins/pins.manifest.json`.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/taxonomy.test.ts
git commit -m "A category with no pin drawn for it is a red test, not a blank map"
```

---

### Task 5: Bảng tra ảnh

**Files:**
- Create: `app/src/components/mapPins.ts`
- Test: gián tiếp qua Task 6 (`PlacesMap.ui.test.tsx`)

- [ ] **Step 1: Viết module**

```ts
// The picture each pin is drawn from.
//
// Twenty static imports and a lookup, deliberately with no logic in it:
// which category a place answers to is `pinCategory`'s question and is
// tested as a pure function, while Metro needs every asset path to be a
// literal it can see at build time. A table it can read and a rule it
// cannot are different things and live apart.
//
// Drawn by `scripts/map-pins.py` from the same table `pinCategory` reads;
// `taxonomy.test.ts` holds the two together.

import { pinCategory, type Categorisable } from '../lib/categories';

import cafes from '../../assets/pins/cafes.png';
import cafesChosen from '../../assets/pins/cafes-chosen.png';
import eats from '../../assets/pins/eats.png';
import eatsChosen from '../../assets/pins/eats-chosen.png';
import focus from '../../assets/pins/focus.png';
import focusChosen from '../../assets/pins/focus-chosen.png';
import fun from '../../assets/pins/fun.png';
import funChosen from '../../assets/pins/fun-chosen.png';
import heritage from '../../assets/pins/heritage.png';
import heritageChosen from '../../assets/pins/heritage-chosen.png';
import markets from '../../assets/pins/markets.png';
import marketsChosen from '../../assets/pins/markets-chosen.png';
import nature from '../../assets/pins/nature.png';
import natureChosen from '../../assets/pins/nature-chosen.png';
import neutral from '../../assets/pins/neutral.png';
import neutralChosen from '../../assets/pins/neutral-chosen.png';
import nightlife from '../../assets/pins/nightlife.png';
import nightlifeChosen from '../../assets/pins/nightlife-chosen.png';
import views from '../../assets/pins/views.png';
import viewsChosen from '../../assets/pins/views-chosen.png';

const PLAIN: Record<string, number> = {
  cafes, eats, focus, fun, heritage, markets, nature, nightlife, views, neutral,
};
const CHOSEN: Record<string, number> = {
  cafes: cafesChosen, eats: eatsChosen, focus: focusChosen, fun: funChosen,
  heritage: heritageChosen, markets: marketsChosen, nature: natureChosen,
  nightlife: nightlifeChosen, views: viewsChosen, neutral: neutralChosen,
};

/**
 * The picture this place's pin is drawn from.
 *
 * `chip` is the category the reader is standing in, or null for the whole
 * catalog — under a chip every pin wears the chip's picture, which is
 * `pinCategory`'s rule and not this file's. A place nothing classifies
 * gets the neutral pin rather than a guess.
 */
export function pinImage(place: Categorisable, chip: string | null, chosen: boolean): number {
  const key = pinCategory(place, chip) ?? 'neutral';
  return (chosen ? CHOSEN : PLAIN)[key];
}
```

- [ ] **Step 2: Kiểm typecheck**

Run: `cd app && npm run typecheck`
Expected: PASS. Nếu TS than phiền về `import ... from '*.png'`, khai báo nằm ở `app/types/assets.d.ts`, đã có sẵn (`declare module '*.png' { const asset: number }`). Comment trong chính file đó cũng ghi rõ chuyện dưới test runner nó là chuỗi URL.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/mapPins.ts
git commit -m "Twenty pictures and a lookup, with the rule kept elsewhere"
```

---

### Task 6: Nối vào bản đồ

**Files:**
- Modify: `app/src/components/PlacesMap.tsx`
- Test: `app/src/components/PlacesMap.ui.test.tsx`

- [ ] **Step 1: Cho stub Marker ghi lại `icon`**

Trong `PlacesMap.ui.test.tsx`, sửa stub:

```tsx
  const Marker = (p: any) => R.createElement('button', {
    type: 'button', 'data-stub': 'Marker', 'data-slug': p.identifier,
    'data-color': p.pinColor ?? '', 'data-icon': p.icon ?? '',
    'data-anchor': p.anchor ? `${p.anchor.x},${p.anchor.y}` : '',
    'data-label': p.accessibilityLabel ?? '',
    'data-tracks': String(!!p.tracksViewChanges), onClick: p.onPress,
  }, p.children);
```

- [ ] **Step 2: Viết test đỏ**

Thay bốn test màu hiện có (`draws the chosen pin in the accent…`, `paints every pin in the chip's colour…`, `lets each pin speak for itself…`, `draws a pin nothing classifies in ink…`) bằng:

```tsx
  // A pin used to be a hue and nothing else — no glyph, no label, nine
  // categories on one channel. Now it is a picture, and the picture says
  // which kind of place it is.
  it('draws each place in its own category’s picture, and the chosen one in coral', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes']), place('b', 21.1, 105.1, ['cafes']), place('c', 21.2, 105.2, ['views'])]} selectedSlug="b" onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b, c] = markers();
    expect(a.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['cafes'] }, null, false)));
    expect(b.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['cafes'] }, null, true)));
    expect(c.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['views'] }, null, false)));
    expect(a.getAttribute('data-icon')).not.toBe(b.getAttribute('data-icon'));
  });

  it('paints every pin in the chip’s picture while a chip is selected', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes', 'focus']), place('b', 21.1, 105.1, ['focus']), place('c', 21.2, 105.2, ['focus'])]} selectedSlug="c" onSelect={() => {}} category="focus" origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b, c] = markers();
    const focusPin = String(pinImage({ categories: ['focus'] }, null, false));
    // The café that is also a place to work stops reading as the odd one
    // out under Focus.
    expect(a.getAttribute('data-icon')).toBe(focusPin);
    expect(b.getAttribute('data-icon')).toBe(focusPin);
    // The chosen pin is coral under a chip too — it is the one thing the
    // chip does not already say.
    expect(c.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['focus'] }, 'focus', true)));
  });

  it('lets each pin speak for itself under a chip the table has never heard of', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes']), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} category="street_food" origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b] = markers();
    expect(a.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['cafes'] }, null, false)));
    expect(b.getAttribute('data-icon')).toBe(String(pinImage({}, null, false)));
  });

  it('draws a place nothing classifies in the neutral pin, and no pin as chosen when the slug matches none', () => {
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug="zzz" onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const neutralImage = String(pinImage({}, null, false));
    for (const m of markers()) expect(m.getAttribute('data-icon')).toBe(neutralImage);
  });

  // `icon` and not `image`: on iOS `image` installs a UIImageView as the
  // marker's `iconView`, which is a view-backed marker — the thing this
  // file's `tracksViewChanges`/`SETTLE_MS` machinery exists to avoid, and
  // the reason 288 places can be a map rather than 288 Views.
  it('never redraws a place’s pin, because a picture is not a view', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes'])]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(markers()[0].getAttribute('data-tracks')).toBe('false');
    // The teardrop's tip is what stands on the coordinate.
    expect(markers()[0].getAttribute('data-anchor')).toBe('0.5,1');
  });
```

Thêm `import { pinImage } from './mapPins';` vào đầu file test.

- [ ] **Step 3: Chạy để thấy đỏ**

Run: `cd app && npx vitest run src/components/PlacesMap.ui.test.tsx`
Expected: FAIL — `data-icon` rỗng, `data-anchor` rỗng.

- [ ] **Step 4: Sửa `PlacesMap.tsx`**

Xoá ba thứ, không phải hai — **bỏ sót cái thứ ba sẽ làm `npm run lint` đỏ**:

1. hằng `INK` (dòng 34) và nhánh `?? INK` ở dòng 258;
2. import `Platform` (dòng 21) — `INK` là chỗ dùng `Platform` duy nhất trong file;
3. import `colors` (dòng 29) — `colors.accentFill` ở dòng 258 là chỗ dùng duy nhất, và dòng đó sắp biến mất.

Không có hàm `neutralPin` nào để xoá; nó chưa bao giờ tồn tại.

Thêm một import, và **không** import `MAP_PIN_NEUTRAL_FILL` vào file này — nó chỉ dùng cho generator và test:

```ts
import { pinImage } from './mapPins';
```

Thay prop trên marker của địa điểm:

```tsx
            // A picture, not a tint. `pinColor` never drew a pin: on iOS
            // Google's marker art imposes its own luminance and takes only
            // hue and some saturation from the prop, and on Android
            // `setPinColor` runs `Color.colorToHSV` and keeps `hsv[0]`
            // alone. Nine categories reached the map as nine hues, with no
            // glyph and no way to say more.
            //
            // `icon` rather than `image`: the two are one prop on Android,
            // but on iOS `image` installs a UIImageView as the marker's
            // `iconView` — a view-backed marker, which is what
            // `tracksViewChanges` and `SETTLE_MS` below exist to avoid.
            // `icon` sets `GMSMarker.icon` and stays a picture.
            icon={pinImage(p, category, p.slug === selectedSlug)}
            // Already the default; passed so that the tip of the teardrop
            // is written down as the thing standing on the coordinate. An
            // asset drawn to a different shape would have to revisit it.
            anchor={{ x: 0.5, y: 1 }}
            // No `pinColor`, and not as an oversight. `setPinColor:`
            // assigns `_realMarker.icon = markerImageWithColor:`
            // unconditionally — it *overwrites the icon* — and
            // `didInsertInMap` applies it again after the marker is in the
            // map, synchronously, while `setIconSrc` loads its bitmap
            // asynchronously. Since this prop used to vary with
            // `selectedSlug`, every tap would have sent it again and
            // replaced the picture with Google's default pin, with no
            // `icon` change to put it back. A fallback that erases the
            // thing it is meant to back up.
```

Sửa ghi chú ở đầu file cho khớp (pin giờ là ảnh có icon, không còn "ink on iOS and azure on Android").

- [ ] **Step 5: Sửa test màn hình Explore, trong cùng commit**

`ExploreScreen.ui.test.tsx` là hộ tiêu thụ thứ hai của cái marker vừa đổi, và Step 4 làm nó đỏ. Sửa ngay tại đây chứ không để sang task sau — một commit đẩy cả bộ test sang đỏ là một commit không bisect được.

File đó có **stub Marker riêng** ở dòng 126, chỉ ghi `data-color`. Thêm `data-icon`:

```tsx
  const Marker = (p: any) => R.createElement('button', { type: 'button', 'data-stub': 'Marker', 'data-slug': p.identifier, 'data-color': p.pinColor ?? '', 'data-icon': p.icon ?? '', onClick: p.onPress }, p.children);
```

Đổi tên test `paints the pins in the chip’s colour…` thành `…in the chip’s picture…`, thêm `import { pinImage } from '../components/mapPins';`, và thay ba khẳng định:

```tsx
    const pins = () => [...document.querySelectorAll('[data-stub="Marker"]')].map((m) => m.getAttribute('data-icon'));
    const cafesPin = String(pinImage({ categories: ['cafes'] }, null, false));
    const focusPin = String(pinImage({ categories: ['focus'] }, null, false));
    expect(pins()).toEqual([cafesPin, focusPin]);

    fireEvent.click(screen.getByText('Focus'));
    expect(pins()).toEqual([focusPin, focusPin]);

    fireEvent.click(screen.getByText('All'));
    expect(pins()).toEqual([cafesPin, focusPin]);
```

- [ ] **Step 6: Chạy toàn bộ**

Run: `cd app && npm test && npm run typecheck && npm run lint && npm run coverage`
Expected: PASS hết; `categories.ts` vẫn 100%; sàn `src/screens/*` không vỡ.

`lint` là bước dễ đỏ nhất ở đây — repo chạy `eslint . --max-warnings=0` với `no-unused-vars` ở mức `error`, nên bất kỳ import nào Step 4 bỏ lại sẽ chặn.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/PlacesMap.tsx app/src/components/PlacesMap.ui.test.tsx app/src/screens/ExploreScreen.ui.test.tsx
git commit -m "The map draws pictures now, and a picture can say café"
```

---

### Task 7: Xác minh trên simulator — cổng thật

Đây không phải thủ tục. Chính bước này đã bác bỏ lần thử trước (nhánh `map-pin-weight`), nơi mọi test đều xanh và thay đổi vẫn vô dụng. **Không kết luận gì về hiển thị mà không chụp màn hình và lấy mẫu pixel.**

**Files:** không sửa file nào; đây là cổng.

- [ ] **Step 1: Khởi động Metro với env production**

```bash
cd app && lsof -ti:8081 | xargs kill -9 2>/dev/null
npx eas env:exec production "npx expo start --dev-client"
```
Không có bước này thì bản đồ không vẽ — key Google Maps nằm ở EAS.

- [ ] **Step 2: Đặt vị trí rồi mở app**

```bash
SIM=$(xcrun simctl list devices booted | grep -o '[0-9A-F-]\{36\}' | head -1)
xcrun simctl location $SIM set 21.0285,105.8542
xcrun simctl terminate $SIM com.aletuan.citycrew; sleep 1
xcrun simctl launch $SIM com.aletuan.citycrew
```

- [ ] **Step 3: Chụp cả hai nền**

Chụp ở chế độ Dark, rồi đổi theme **qua Profile → Appearance** (không đổi theme của hệ thống — app có setting riêng), chụp lại ở Light.

- [ ] **Step 4: Lấy mẫu pixel, không phán bằng mắt**

Với mỗi ảnh chụp, lấy màu phổ biến nhất trong một ô nhỏ ở lõi đầu pin.
Expected:
- màu lõi **khớp** `CATEGORIES[key].pin` trong sai số khử răng cưa (±8 mỗi kênh). Đây là điều chưa từng đúng với `pinColor`, và là toàn bộ lý do của thay đổi này.
- icon đọc được ở cỡ thật.
- pin được chọn: coral, to hơn rõ rệt, icon màu mực.
- đuôi pin đứng đúng trên vị trí, không lệch xuống dưới.

- [ ] **Step 5: Nếu pin trông bẹt trên nền sáng**

Vành trắng được chọn thay cho đổ bóng để đuôi pin chạm đúng cạnh dưới ảnh. Nếu ở cỡ thật nó vẫn bẹt, thêm đổ bóng vào generator **và** cộng phần đệm dưới vào `anchor.y` cho khớp — hai thứ phải đi cùng nhau. Đừng thêm bóng mà giữ nguyên `anchor`.

- [ ] **Step 6: Trả simulator về trạng thái cũ**

Đổi theme về Dark, dừng Metro.

- [ ] **Step 7: Commit ảnh chứng cứ (tuỳ chọn) và mở PR**

```bash
git push -u origin map-pin-images
gh pr create --title "Map pins become pictures, because pinColor never drew them" --body "..."
```

---

## Điều kế hoạch này *không* làm

- Không đụng bubble cluster (số đếm liên tục, buộc phải là View).
- Không đổi hue category — icon đã tách kênh nên xung đột coral↔Culture tự tan.
- Không đổi `CATEGORIES[key].color`: chip và chấm trên thẻ giữ nguyên pastel.
- Không thêm dependency nào vào app. Pillow chỉ cần cho generator, chạy tay.
