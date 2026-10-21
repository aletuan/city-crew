// Writes the Traditional Chinese into the source, from the Simplified.
//
//   npm run hant
//
// Run it after adding or editing a Chinese string, or a correction in
// `hant.ts`, and commit what it writes. `chinese.test.ts` fails if you
// forget. It writes two things, and nothing else:
//
// - every `t(en, vi, ja, zh)` gains its fifth argument, and every fifth
//   argument that no longer matches its fourth is rewritten;
// - every object with a `zh` string gains a `hant` beside it — the
//   tables of categories, vibes, themes and the rest.
//
// Plain Node, as `legal-html.mts` is. A pass can leave work for the next
// (a call nested in a string it just copied), so it runs to a fixpoint.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { chineseTable, hantOf } from './hant.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

type Edit = { from: number; to: number; text: string };

function edits(path: string, code: string): Edit[] {
  const sf = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Edit[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't'
      && node.arguments.length >= 4 && !ts.isSpreadElement(node.arguments[0])) {
      const [, , , zh, hant] = node.arguments;
      const want = hantOf(zh);
      if (!hant) out.push({ from: zh.getEnd(), to: zh.getEnd(), text: `, ${want}` });
      else if (hant.getText() !== want) out.push({ from: hant.getStart(), to: hant.getEnd(), text: want });
    }
    const table = ts.isObjectLiteralExpression(node) && chineseTable(node);
    if (table) {
      const want = hantOf(table.zh);
      if (!table.hant) out.push({ from: table.zh.getEnd(), to: table.zh.getEnd(), text: `, hant: ${want}` });
      else if (table.hant.getText() !== want) out.push({ from: table.hant.getStart(), to: table.hant.getEnd(), text: want });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // An edit inside a range another edit replaces is the next pass's.
  return out.filter((e) => !out.some((o) => o !== e && o.from < o.to && o.from <= e.from && e.to <= o.to));
}

let files = 0;
for (const path of walk(src)) {
  const before = readFileSync(path, 'utf8');
  let code = before;
  for (let pass = 0; ; pass += 1) {
    const todo = edits(path, code).sort((a, b) => b.from - a.from);
    if (!todo.length) break;
    if (pass > 5) throw new Error(`${relative(src, path)}: no fixpoint`);
    for (const e of todo) code = code.slice(0, e.from) + e.text + code.slice(e.to);
  }
  if (code !== before) { writeFileSync(path, code); files += 1; }
}
console.log(`hant: ${files} file(s) written`);
