// Every string the app writes has a Simplified Chinese line, and this is
// the proof it still does.
//
// Chinese arrived in steps (21 Oct 2026): step 1 made the language exist
// and fall back to English, step 2 translated the interface a group of
// screens at a time (2a Explore and Search, 2b Collections, 2c the
// profile and the account, 2d trips, the crew and the rest), and step 3
// is the catalog's own rows. `t(en, vi, ja?, zh?)` takes the Chinese last
// and optional — 887 strings were written with three — so a string added
// without one compiles, passes every other test, and reaches a Chinese
// reader in English without anybody noticing. This reads every `t()` call
// under `src/` and fails on one that has no fourth argument.
//
// Until step 2 was done it read a list of the translated files, which
// grew in each PR. With the last group translated the list was every file
// that writes a string, so it reads all of them: a new screen is checked
// from the day it is written, not from the day somebody remembers to add
// it here.
//
// The exception is a row from the database that has no Chinese of its
// own, and two kinds of those are meant to stay that way. Place names —
// a city's, a neighbourhood's — are kept as they are, in Latin letters:
// the owner's rule (21 Oct 2026), because they are the names on the
// signs and the map a visitor reads. A collection's title and
// description are kept in the words its author wrote them in. Both are
// named below, so the list says what is English on purpose.
//
// It also fails on kana in a Chinese string. The two languages share
// characters, and a Japanese line pasted into the Chinese slot looks right
// at a glance and is not Chinese.
//
// The terms and the privacy policy are not here, because they are not
// written with `t()`: a policy binds in the words it was written in, and
// `LegalSheet` shows Chinese readers the English, as it does Japanese.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

/** Rows with no Chinese column, on purpose, by the English argument. */
const ROWS = new Set([
  // Place names: a city's, a neighbourhood's, a place's own.
  'c.short_en', 'city.short_en', 'r.en', "hit.place.name_en ?? ''",
  // What a collection's author wrote.
  'item.collection.title_en', 'c.title_en', 'c.desc_en', 'col.title_en', 'col.desc_en', 'own.title_en', 'own.desc_en',
]);

const KANA = /[぀-ヿ]/;

type Call = { at: string; args: string[] };

const calls = (path: string): Call[] => {
  const file = relative(src, path);
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Call[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      out.push({ at: `${file}:${line}`, args: node.arguments.map((a) => a.getText()) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
};

describe('the app in Chinese', () => {
  const all = walk(src).flatMap(calls);

  // A walk that stopped finding files would pass everything below
  // vacuously. 1,160 calls on 21 Oct 2026.
  it('finds the strings it checks', () => {
    expect(all.length).toBeGreaterThan(1000);
  });

  // A call spread from a table (`t(...def(kind).name)`) is checked by
  // the compiler instead: the table's tuple type names four languages.
  it('gives every string a Chinese line', () => {
    const missing = all
      .filter((c) => c.args.length < 4 && !ROWS.has(c.args[0]) && !c.args[0].startsWith('...'))
      .map((c) => `${c.at} ${c.args[0]}`);
    expect(missing).toEqual([]);
  });

  it('writes no Chinese line in Japanese', () => {
    const kana = all
      .filter((c) => c.args.length >= 4 && KANA.test(c.args[3]))
      .map((c) => `${c.at} ${c.args[3]}`);
    expect(kana).toEqual([]);
  });
});
