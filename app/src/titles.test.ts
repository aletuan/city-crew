// A page reached from another wears its title at 20, one size for all of
// them (owner, 12 Nov 2026): a collection, a place, a trip, the pages
// inside Profile — and, the same day, the four still at 26: planning a
// trip, adding a place, a place's photographs and a trip invitation.
// `type.titleCompact` says why 20; `Screen`'s `compactTitle` draws it.
//
// ── the failure this exists to catch ──
//
// Each of those was its own one-line change, and four were missed the
// first time round: the size is a prop at every call site, so the next
// page pushed onto a stack comes out at 26 unless somebody remembers.
// So every `<Screen` with a back button is read here, and one without
// `compactTitle` fails. A tab's own root has no back button and keeps
// its 26.
//
// ── what this can and cannot see ──
//
// It reads the source, as `icons.test` does: each `<Screen` opening tag,
// up to the `>` that closes it outside any `{…}` — so a `() =>` in a
// prop does not end it early. `SketchingScreen` has no back button and is
// held by name: it is the step between the trip wizard and the plans,
// both at 20.
//
// ── and the forms, which it did not see (16 Nov 2026) ──
//
// "A page drawn through some other wrapper is not seen", this said, and
// the forms are drawn through `AuthHeader`: a collection's, the
// profile's and deleting the account stayed at 26 for four days, until
// the owner opened a collection's form from its page and saw the title
// grow. `<AuthHeader` is read the same way now. It always has a back
// button, so every one is held to 20 — but for the three ways in, named
// below, which the owner left at 26: where a reader arrives, not a room
// inside something. A page drawn through a third wrapper is still not
// seen.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = __dirname;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) out.push(p);
  }
  return out;
}

/** Every `<Name …>` opening tag in `code`, braces and line comments skipped. */
export function openTags(code: string, name: string): string[] {
  const tags: string[] = [];
  for (const m of code.matchAll(new RegExp(`<${name}\\b`, 'g'))) {
    let i = m.index! + m[0].length;
    let depth = 0;
    while (i < code.length) {
      const c = code[i];
      if (depth === 0 && c === '/' && code[i + 1] === '/') { i = code.indexOf('\n', i); continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
      i++;
    }
    tags.push(code.slice(m.index!, i + 1));
  }
  return tags;
}
export const screenTags = (code: string) => openTags(code, 'Screen');

/** The ways in, which keep the larger title — see the note above. */
const WAYS_IN = ['screens/ForgotPasswordScreen.tsx', 'screens/SignInScreen.tsx', 'screens/SignUpScreen.tsx'];

describe('page titles', () => {
  const tags = sources(ROOT).flatMap((f) => screenTags(readFileSync(f, 'utf8')).map((tag) => ({ f, tag })));

  it('finds the pages, so this cannot pass by finding nothing', () => {
    expect(tags.filter(({ tag }) => /\bonBack=/.test(tag)).length).toBeGreaterThanOrEqual(14);
  });

  it('draws every page with a back button at the compact size', () => {
    const big = tags
      .filter(({ tag }) => /\bonBack=/.test(tag) && !/\bcompactTitle\b/.test(tag))
      .map(({ f, tag }) => `${f.slice(ROOT.length + 1)}: ${tag.split('\n')[0]}`);
    expect(big).toEqual([]);
  });

  it('draws the planning step between the wizard and the plans at it too', () => {
    const sketching = screenTags(readFileSync(join(ROOT, 'screens/SketchingScreen.tsx'), 'utf8'));
    expect(sketching.length).toBeGreaterThan(0);
    expect(sketching.every((tag) => /\bcompactTitle\b/.test(tag))).toBe(true);
  });

  // The forms, drawn through `AuthHeader` (16 Nov 2026).
  describe('of the forms', () => {
    const forms = sources(ROOT).flatMap((f) => openTags(readFileSync(f, 'utf8'), 'AuthHeader')
      .map((tag) => ({ f: f.slice(ROOT.length + 1), tag })));
    const compact = ({ tag }: { tag: string }) => /\bcompactTitle\b/.test(tag);

    // Nine today: a collection's form, the profile's, deleting the
    // account, Activity, signing in, three steps of signing up and two of
    // a forgotten password.
    it('finds them, so this cannot pass by finding nothing', () => {
      expect(forms.length).toBeGreaterThanOrEqual(9);
      expect(forms.filter(compact).map(({ f }) => f)).toEqual(expect.arrayContaining([
        'screens/CollectionFormScreen.tsx', 'screens/EditProfileScreen.tsx', 'screens/DeleteAccountScreen.tsx',
      ]));
    });

    it('draws every form at the compact size, but for the ways in', () => {
      const big = forms.filter((x) => !compact(x)).map(({ f }) => f);
      expect([...new Set(big)].sort()).toEqual(WAYS_IN);
    });

    // The other half of the owner's ruling: a way in moved to 20 is a
    // decision, and this is where it gets written down.
    it('leaves every step of the ways in at the larger size', () => {
      expect(forms.filter((x) => WAYS_IN.includes(x.f) && compact(x))).toEqual([]);
    });
  });

  it('reads a tag to its end past an arrow function and a comment', () => {
    const [tag] = screenTags('<Screen\n  // a > in a comment\n  onBack={() => go()}\n  compactTitle\n>\n<Text/>');
    expect(tag).toContain('compactTitle');
    expect(tag.endsWith('>')).toBe(true);
    expect(tag).not.toContain('<Text');
  });
});
