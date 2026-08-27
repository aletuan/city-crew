// The calendar wears one colour, everywhere it means "this is the day".
//
// ── the failure this exists to catch ──
//
// `calendar-outline` is drawn in seven places, and it drifted into three
// colours: coral on a trip card, `textSecondary` in a trip's own header,
// `textTertiary` on an invitation card — and the invitation card renders
// in the *same scroll view* as the trip card it disagreed with. Nobody
// chose that. Each site picked the colour of whatever text it happened to
// sit beside, which reads as a rule right up until two of the sites end
// up a card apart.
//
// It is the failure `RoundIconButton` already has a note about: "the same
// gesture wore two colours on two screens". That one was found by eye,
// months after it shipped, which is the argument for checking it here
// instead.
//
// ── the rule ──
//
// The calendar is the fact a plan turns on — is this today, is it over —
// and it is the one meta glyph in the app allowed the accent. The pin and
// the walker beside it stay tertiary; they label where and how far, which
// are not decisions. So: every calendar is `colors.accent`, and a grey one
// is a bug rather than a local choice.
//
// ── what this can and cannot see ──
//
// It reads the source with a regular expression, the same trade `nav.test`
// takes and for the same reason: the literal `<Ionicons name="..." />`
// that every direct call site in this app is written as. A glyph name held
// in a variable would go unseen. Two indirections do hold one — the
// header's `IconSubtitle` and Profile's `RoundIcon` — so `IconSubtitle`,
// the one that draws a dateline, gets its own assertion below. `RoundIcon`
// is not checked here: it is already accent for every glyph it takes, and
// it labels a settings row rather than a day.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = __dirname;

/** Every .tsx under src/, minus the tests. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) out.push(p);
  }
  return out;
}

/** `<Ionicons name="calendar-outline" … color={X} …/>`, X captured. */
const CALENDAR = /<Ionicons\s+[^>]*?name="calendar-outline"[^>]*?color=\{([^}]+)\}/g;

describe('the calendar glyph', () => {
  const files = sources(ROOT);

  it('is drawn somewhere, so this test cannot pass by finding nothing', () => {
    const hits = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(CALENDAR)]);
    expect(hits.length).toBeGreaterThan(3);
  });

  it('is the accent at every call site', () => {
    const wrong: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(CALENDAR)) {
        if (m[1].trim() !== 'colors.accent') {
          wrong.push(`${f.slice(ROOT.length + 1)}: color={${m[1].trim()}}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('is the accent in the header subtitle too, which holds its name in a prop', () => {
    const ui = readFileSync(join(ROOT, 'components/ui.tsx'), 'utf8');
    const body = /export function IconSubtitle\([\s\S]*?\n\}\n/.exec(ui)?.[0];
    expect(body).toBeTruthy();
    expect(body).toMatch(/<Ionicons\s+name=\{icon\}[^>]*?color=\{colors\.accent\}/);
  });
});
