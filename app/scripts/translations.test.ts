// One English string, one translation — unless the difference is meant.
//
// `t(en, vi, ja, zh)` has no table behind it: every screen writes its own
// copy of "Cancel", "Done", "Shared with you", and nothing made two copies
// agree. When this was first measured (23 Nov 2026) 32 English strings were
// translated more than one way — "Huỷ" 11 times and "Hủy" 4, Trips as 旅程
// and as トリップ — and a reader sees the same word change under their thumb
// from one screen to the next. #1580 and #1581 brought it to 20, and fixing
// the two that were drift (Someone in Chinese, Saved places in Japanese) to
// 18; this is what keeps it there. It reads every `t()` call under `src/` the way
// `chinese.test.ts` does, groups them by English, and fails on a string that
// has more than one Vietnamese, Japanese or Simplified Chinese line.
//
// ── what a difference can mean ──
//
// Most of the 20 are one English word that stands for two things: the
// password meter's "Fair" is not the photo score's, and "Pending" is a
// review waiting on the desk in one place and an invitation waiting on a
// friend in the other. Those are DIFFERENT below, each with the reason, and
// a string is listed by its English argument exactly as written. The list
// is a ratchet in both directions: a string that diverges and is not listed
// fails, and so does a listed one that no longer diverges, so the list
// cannot go on saying "intentional" about something somebody has since made
// the same.
//
// ── what to do when this fails ──
//
// Make the new copy say what the old one says. If it truly means something
// else, say so here, beside the others, with the reason — a reader of this
// file should be able to tell the difference from the list alone.
//
// Only a call with literal arguments is read. A spread (`t(...def(kind).name)`)
// is a table's row, and the table is one place by construction.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** English as written → why its translations differ on purpose. */
const DIFFERENT: Record<string, string> = {
  New: 'a list just created (a card), a badge for something new, and the "create new" button',
  Cancel: 'dismissing a sheet, and withdrawing an invitation (ja only: キャンセル / 取り消す)',
  View: 'a button that opens a candidate, and the "view" mode switch',
  Show: 'show, and show again (a hidden photo coming back)',
  'opens ${at}': 'the map card is a few words wide; the sentence in lib/format is not',
  Search: 'a button in the start sheet, and the label of a tool',
  Pending: 'a review waiting on the desk, and an invitation waiting on a friend',
  Light: 'the light theme, and the light a photo was taken in',
  Weak: 'the password meter, and the photo score',
  Fair: 'the password meter, and the photo score',
  Good: 'the password meter, and the photo score',
  'Can’t make it': 'a status on the trip’s crew row, and the button that says it (ja only)',
  'Already have an account?': 'the Japanese sentence goes on into a link on the sign-up screen',
  '.': 'the end of a sentence, and a sentence’s tail that is part of a longer one',
  tonight: 'a plan heading: this evening, and today (a plan that has already started)',
  Clear: 'clear a text field, and clear a filter',
  'Check-ins': 'the heading of a list of places, and a count on the profile',
  List: 'a way of laying a collection out ("as a list"), and the list of places the map goes back to (vi only)',
  'Sign up': 'a link on the sign-in screen, and the button on the sign-up screen (ja only)',
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

type Call = { at: string; en: string; lines: string };

const read = (path: string): Call[] => {
  const file = relative(src, path);
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const calls: Call[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't'
      && node.arguments.length >= 4 && node.arguments.slice(0, 4).every((a) => ts.isStringLiteralLike(a) || ts.isTemplateExpression(a))) {
      const [en, vi, ja, zh] = node.arguments.map((a) => a.getText().slice(1, -1));
      calls.push({
        at: `${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
        en,
        lines: JSON.stringify([vi, ja, zh]),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return calls;
};

describe('one English string, one translation', () => {
  const calls = walk(src).flatMap(read);
  const byEn = new Map<string, Map<string, string[]>>();
  for (const c of calls) {
    const lines = byEn.get(c.en) ?? byEn.set(c.en, new Map()).get(c.en)!;
    (lines.get(c.lines) ?? lines.set(c.lines, []).get(c.lines)!).push(c.at);
  }
  const diverging = [...byEn].filter(([, v]) => v.size > 1);

  // A walk that found nothing would pass everything below vacuously.
  // 1,127 distinct strings, 18 of them diverging, on 24 Nov 2026.
  it('finds the strings it checks', () => {
    expect(byEn.size).toBeGreaterThan(1000);
    expect(diverging.length).toBeGreaterThan(10);
  });

  it('has one translation for each, but the ones listed as meant to differ', () => {
    const drift = diverging
      .filter(([en]) => !(en in DIFFERENT))
      .map(([en, v]) => `${JSON.stringify(en)}: ${[...v].map(([l, at]) => `${l} at ${at[0]}`).join('  vs  ')}`);
    expect(drift).toEqual([]);
  });

  it('lists nothing that no longer differs', () => {
    const live = new Set(diverging.map(([en]) => en));
    expect(Object.keys(DIFFERENT).filter((en) => !live.has(en))).toEqual([]);
  });
});
