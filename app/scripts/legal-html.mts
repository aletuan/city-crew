// Writes the two public pages from `src/lib/legal.ts`.
//
//   npm run legal:build
//
// Run it after editing the words in `legal.ts`, and commit what it
// writes. `legalhtml.test.ts` fails if you forget, which is the whole
// point of the arrangement — see the note at the top of `legal.ts`.
//
// Plain Node, no bundler: `--experimental-strip-types` reads the TypeScript
// directly, which is why the imports carry their `.ts` extensions and why
// nothing in this chain may import React or anything from npm.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS } from '../src/lib/legal.ts';
import { renderDoc } from './legalhtml.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../dashboard/public');

for (const doc of DOCS) {
  const path = join(out, doc.file);
  writeFileSync(path, renderDoc(doc), 'utf8');
  console.log(`wrote ${path}`);
}
