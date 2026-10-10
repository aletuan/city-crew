// A `dyn` colour on a border follows the phone's appearance, not the one
// the app set — React Native resolves a background against the view and a
// border against the process (see `bgHex` in theme.ts for the line). On a
// phone in Dark under the app's Light, the visited pill's `okSoft` border
// drew a charcoal ring round a pale green fill (10 Oct 2026).
//
// So no `dyn` colour goes on a border, read straight off the source: a
// border that only holds a fill's size takes `'transparent'`, one that must
// show takes a plain pair picked with `useScheme()` (`bgHex`,
// `bgElevatedHex`, `badgeSolidHex`). The names allowed below still ride the
// bug, each for a stated reason, and are what a native patch would fix.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { colors, PALETTES } from './theme';

const ROOT = __dirname;

/** Every .ts/.tsx under src/, minus the tests. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (/\.tsx?$/.test(e.name) && !e.name.includes('.test.')) out.push(p);
  }
  return out;
}

/**
 * The names in `colors` that go out as a `dyn` pair: those whose two sides
 * differ in the standard look, paper and charcoal. The other looks wear one
 * palette on both sides and so put no pair anywhere.
 */
function dynNames(): Set<string> {
  const { paper, charcoal } = PALETTES;
  return new Set((Object.keys(colors) as (keyof typeof paper)[]).filter((k) => paper[k] !== charcoal[k]));
}

/**
 * Still on borders, knowingly. Each pair's two sides are one hue at two
 * strengths, so the wrong side reads as a slightly off line rather than a
 * different colour — not right, not the visited pill either.
 */
const ALLOWED = new Set([
  // The hairlines on glass: 14%/8% ink on paper, 24%/16% tan on charcoal.
  'borderGlass', 'borderGlassSoft',
  // Selected and error rings: the paper coral beside the charcoal coral,
  // the paper red beside the charcoal red, and so on.
  'accent', 'ok', 'bad', 'textTertiary',
]);

const BORDER = /border(?:Top|Bottom|Left|Right)?Color:\s*colors\.([a-zA-Z]+)/g;

describe('borders', () => {
  const dyn = dynNames();

  it('reads the dynamic colours off the theme', () => {
    // A guard that finds nothing to guard is not one.
    expect(dyn.has('okSoft')).toBe(true);
    expect(dyn.has('bgElevated')).toBe(true);
    expect(dyn.has('accentLine')).toBe(false);
  });

  it('puts no dynamic colour on a border, outside the stated few', () => {
    const hits = sources(ROOT).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(BORDER)]
        .filter((m) => dyn.has(m[1]) && !ALLOWED.has(m[1]))
        .map((m) => `${f.slice(ROOT.length + 1)}: colors.${m[1]}`));
    expect(hits).toEqual([]);
  });

  it('allows nothing that is not a dynamic colour', () => {
    for (const name of ALLOWED) expect(dyn.has(name)).toBe(true);
  });
});
