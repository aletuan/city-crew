// Every button in the app stands on the scale: 52, 44 or 32, by name.
//
// The scale is `CONTROL_H`, `SECONDARY_CONTROL_H` and `CHIP_H` in
// `src/components/ui/layout.tsx` (owner, 28 Oct 2026), and it exists
// because nothing held the heights before: measured that day, buttons
// stood at nine of them, each a padding tuned around its own label. A
// review does not catch a 37 — it looks like a button — so this reads
// the source and fails on one.
//
// What it reads: every `Pressable`, `PressableScale` and
// `TouchableOpacity`, and each `s.<style>` used inside one, resolved in
// the file's own `StyleSheet` or the `styles` module it imports `s` from.
// A style is a button's face when it has a shape (`borderRadius`) and a
// vertical size of its own (`height`, `minHeight` or `paddingVertical`).
// Its height must then come from one of the three names.
//
// What it leaves alone, by rule rather than by list:
//   - a fixed `width` (a number or a constant, not a percentage) — a disc
//     or a square well: the icon buttons and thumbnails, a family of their
//     own and not on this scale yet;
//   - a `minWidth` — a count badge, which grows sideways, not a button;
//   - `radius.card` itself — a card or a row that happens to be pressable.
//
// A face put together outside the element is not seen: `AddPill` builds
// its style as `face` above its JSX, and `add.ui.test` holds that one.
// Anything else that is not a button is named below, with why.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const NOT_BUTTONS: Record<string, string> = {
  'components/ReviewBadge.tsx pill': 'a label on a card; the card is the button',
  'components/ThemeSwitcher.tsx word': 'the "Popular" / "New" flag on a look card',
  'components/SearchField.tsx cancel': 'sits inside the 44pt field, which is the control the eye measures',
  'components/ui/controls.tsx tile': 'a grid tile, sized by its cell',
  'screens/CollectionDetailScreen.tsx banner': 'a full-width banner; the banner is a row, not a button',
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.test\.|\.d\.ts$/.test(name) ? [path] : [];
  });

/** The top-level entries of every `StyleSheet.create({...})` in a file. */
const stylesOf = (code: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const m of code.matchAll(/StyleSheet\.create\(\{/g)) {
    let i = m.index! + m[0].length;
    let depth = 1;
    const start = i;
    while (depth) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') depth--;
      i++;
    }
    const body = code.slice(start, i - 1);
    for (const e of body.matchAll(/\n {2}([A-Za-z0-9_]+): \{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) out.set(e[1], e[2]);
  }
  return out;
};

const files = walk(src);
const sheets = new Map(files.map((f) => [f, stylesOf(readFileSync(f, 'utf8'))]));

/** Every button face in the app: `file style` → the style's body. */
const faces = (): Map<string, string> => {
  const found = new Map<string, string>();
  for (const file of files.filter((f) => f.endsWith('.tsx'))) {
    const code = readFileSync(file, 'utf8');
    const styles = new Map(sheets.get(file));
    for (const m of code.matchAll(/import \{([^}]*)\} from '(\.\.?\/[^']+)'/g)) {
      if (!m[1].split(',').map((n) => n.trim()).includes('s')) continue;
      const base = resolve(dirname(file), m[2]);
      for (const ext of ['.ts', '.tsx']) for (const [k, v] of sheets.get(base + ext) ?? []) styles.set(k, v);
    }
    for (const m of code.matchAll(/<(PressableScale|Pressable|TouchableOpacity)\b/g)) {
      let element = code.slice(m.index!, m.index! + 1500);
      const close = element.indexOf(`</${m[1]}>`);
      element = element.slice(0, close > 0 ? close : 900);
      for (const [, name] of element.matchAll(/\bs\.([A-Za-z0-9_]+)/g)) {
        const body = styles.get(name);
        if (!body || !/borderRadius/.test(body)) continue;
        if (/(?<![A-Za-z])width:\s*[^\s']/.test(body) || /minWidth/.test(body) || /borderRadius:\s*radius\.card\s*[,}\n]/.test(body)) continue;
        if (!/(?<![A-Za-z])(height|minHeight|paddingVertical):/.test(body)) continue;
        found.set(`${relative(src, file)} ${name}`, body);
      }
    }
  }
  return found;
};

const SCALE = /(?<![A-Za-z])(minHeight|height):[^,\n}]*\b(CONTROL_H|SECONDARY_CONTROL_H|CHIP_H)\b/;

describe('the button scale', () => {
  const all = faces();

  it('finds the buttons it is meant to hold', () => {
    // A reader that silently found nothing would pass everything: these
    // are on the three steps, one each at least, and must be seen.
    for (const known of [
      'components/ui/controls.tsx cta', 'screens/explore/Hero.tsx heroCta', 'components/ui/controls.tsx chip',
      'components/ExploreFilterSheet.tsx segment', 'screens/profile/AccountProfile.tsx signOutBtn',
    ]) {
      expect(all.has(known), known).toBe(true);
    }
    expect(all.size).toBeGreaterThan(25);
  });

  it('gives every button its height by one of the three names', () => {
    const off = [...all].filter(([key, body]) => !(key in NOT_BUTTONS) && !SCALE.test(body)).map(([key]) => key);
    expect(off).toEqual([]);
  });

  // A name below that no longer matches a face has outlived its reason.
  it('names only things that are still there', () => {
    expect(Object.keys(NOT_BUTTONS).filter((key) => !all.has(key))).toEqual([]);
  });
});
