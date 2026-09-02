// A venue's Threads handle: the shape the desk accepts, and the arithmetic
// behind the filter row. Run from dashboard/: node --test tests/
//
// `normalizeThreads` is tested here because it is one half of a pair — the
// other is `stamp_threads_handle` in
// supabase/migrations/20260901140000_place_threads_handle.sql. If the two
// disagree the desk sends a value the table's check constraint refuses, and
// nothing in between would catch it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THREADS_FILTERS, countThreads, normalizeThreads, threadsProblem, threadsUrl,
} from '../src/lib/threads.js';

const place = (threads_handle) => ({ slug: 's', threads_handle });

test('countThreads splits the catalog and keys by the filter value', () => {
  const rows = [place('arata.pasta_saigon'), place(null), place(null)];
  assert.deepEqual(countThreads(rows), { yes: 1, no: 2 });
  // The keys are what the chips look themselves up by — if these drift from
  // THREADS_FILTERS the counts silently render as 0.
  for (const [value] of THREADS_FILTERS) {
    assert.ok(value in countThreads(rows), `no count for filter "${value}"`);
  }
});

test('countThreads counts an empty string as missing, not as filled', () => {
  // The editor clears the box rather than deleting the place: onBlur sends
  // null, but a row written by a seed script or a direct RLS write can still
  // arrive as ''. Both mean "nobody has looked this one up".
  assert.deepEqual(countThreads([place(''), place('moncoeur.bakery')]), { yes: 1, no: 1 });
});

test('countThreads survives the first render, before any rows exist', () => {
  assert.deepEqual(countThreads(undefined), { yes: 0, no: 0 });
  assert.deepEqual(countThreads([]), { yes: 0, no: 0 });
});

test('normalizeThreads takes the handle out of whatever was pasted', () => {
  const bare = 'salem_socialbar_thaodien';
  for (const input of [
    bare,
    `@${bare}`,
    `https://www.threads.com/@${bare}`,
    `https://threads.net/@${bare}`,
    `threads.com/${bare}`,
    `https://www.threads.com/@${bare}?xmt=abc`,
    `  @${bare.toUpperCase()}  `,
  ]) {
    assert.equal(normalizeThreads(input), bare, `failed on: ${input}`);
  }
});

test('normalizeThreads returns empty for nothing, so the field can be cleared', () => {
  for (const input of ['', '   ', null, undefined, '@']) {
    assert.equal(normalizeThreads(input), '');
  }
});

test('the shape rule is Instagram\'s, not the one we use on our own handles', () => {
  // Every handle in the first batch would fail ^[a-z0-9_]{3,20}$ — on a dot,
  // or on length. That is the whole reason this rule exists separately.
  for (const ok of ['arata.pasta_saigon', 'moncoeur.bakery', 'salem_socialbar_thaodien']) {
    assert.equal(threadsProblem(ok), null, `rejected a real handle: ${ok}`);
  }
  assert.match(threadsProblem('a'.repeat(31)), /30/);
  assert.match(threadsProblem('Not Lowercase'), /lowercase/);
  // Empty is a real answer: "this venue has no Threads account".
  assert.equal(threadsProblem(''), null);
});

test('threadsUrl puts back the @ the column does not store', () => {
  assert.equal(threadsUrl('moncoeur.bakery'), 'https://www.threads.com/@moncoeur.bakery');
});
