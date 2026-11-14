// Every way back on the page's ground is the chevron alone.
//
// The owner took the glass disc off the back control one screen at a time
// from 12 Nov 2026 ("reduce the noise of blocks"), and on 14 Nov asked for
// the rest: the forms, the sign-in flow, the error page and the gallery
// still wore it. `bare` is opt-in on `Screen`, `AuthHeader` and
// `BackButton`, so a screen written tomorrow gets the disc back by
// default; a review does not catch a disc, it looks like a back button.
// This reads the source and fails on one.
//
// What it reads: every `<Screen`, `<AuthHeader` and `<BackButton` element
// in `src`. A `Screen` or `AuthHeader` that is given `onBack` must also be
// given `backBare`; a `BackButton` must be given `bare`. A round control
// over a photograph is not a `BackButton` (that is `photoDisc`), so it is
// not read here.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(p).isDirectory()) return files(p);
  return /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n) ? [p] : [];
});

/** Each opening tag of `name` in `code`, whole: from `<name` to the `>`
 *  that closes it, skipping any `>` inside a `{…}` (an arrow's `=>`). */
function tagsOf(code: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  for (let m = re.exec(code); m; m = re.exec(code)) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push(code.slice(m.index, i + 1));
  }
  return out;
}

describe('tagsOf', () => {
  it('reads a tag whole, past the arrows inside its props', () => {
    const code = '<Screen title="a" onBack={() => go()}\n  backBare>\n<Screen title="b" />';
    expect(tagsOf(code, 'Screen')).toEqual(['<Screen title="a" onBack={() => go()}\n  backBare>', '<Screen title="b" />']);
  });

  it('does not read a longer name as the one asked for', () => {
    expect(tagsOf('<ScreenTitle title="x" /><ScreenBoundary>', 'Screen')).toEqual([]);
  });
});

describe('the way back', () => {
  const offenders: string[] = [];
  for (const f of files(src)) {
    const code = readFileSync(f, 'utf8');
    const at = relative(src, f);
    for (const name of ['Screen', 'AuthHeader']) {
      for (const tag of tagsOf(code, name)) {
        if (/\bonBack=/.test(tag) && !/\bbackBare\b/.test(tag)) offenders.push(`${at} <${name}>`);
      }
    }
    for (const tag of tagsOf(code, 'BackButton')) {
      if (!/\bbare\b/.test(tag)) offenders.push(`${at} <BackButton>`);
    }
  }

  it('is the chevron alone on every screen that has one', () => {
    expect(offenders).toEqual([]);
  });
});
