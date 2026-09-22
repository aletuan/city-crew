// Where a blurb came from. Run from dashboard/: node --test tests/
//
// The point of this module is that the two sources behave differently, and
// the difference is easy to get wrong in exactly one direction: crediting
// Google with an author name it never supplied. `import-place.ts` copies
// `editorialSummary`, which Google writes about the place — its field mask
// does not even ask for `reviews`. So a Google row has no author, and a
// panel that lets one be typed in invents a person. That is what
// `sourceProblem` and the disabled name box are both guarding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_OPTIONS, sourceCredit, sourceLink, sourceProblem, sniffSource,
} from '../src/lib/reviewer.js';

const POST = 'https://www.threads.com/@gowithchinne/post/DdeLnFwj10o';
const threads = (over = {}) => ({
  reviewer_source: 'threads', reviewer_name: 'gowithchinne', reviewer_url: POST, ...over,
});

test('SOURCE_OPTIONS leads with the empty option', () => {
  // The select is not a required field: "nobody recorded a source" has to be
  // reachable, and it has to be what an untouched row already shows.
  assert.equal(SOURCE_OPTIONS[0][0], '');
  assert.deepEqual(SOURCE_OPTIONS.map(([v]) => v), ['', 'threads', 'google']);
});

test('sourceCredit names the person for Threads and only the platform for Google', () => {
  assert.equal(sourceCredit(threads()), '@gowithchinne on Threads');
  assert.equal(sourceCredit({ reviewer_source: 'google', reviewer_name: null }), 'Google');
});

test('sourceCredit never invents a name Google did not supply', () => {
  // Even if a name somehow got stored against a Google row, it does not
  // render: an editorial summary has no author, and printing one would be a
  // fabricated attribution rather than a formatting bug.
  assert.equal(sourceCredit({ reviewer_source: 'google', reviewer_name: 'Someone' }), 'Google');
});

test('sourceCredit says nothing when there is no source', () => {
  assert.equal(sourceCredit({}), null);
  assert.equal(sourceCredit({ reviewer_source: null, reviewer_name: 'stray' }), null);
});

test('sourceCredit degrades to the raw source rather than blanking', () => {
  // A source added by a later migration should still render something —
  // this module is deliberately not a closed enum.
  assert.equal(sourceCredit({ reviewer_source: 'instagram', reviewer_name: 'x' }), 'x on instagram');
  assert.equal(sourceCredit({ reviewer_source: 'instagram' }), 'instagram');
});

test('sourceLink prefers the stored permalink', () => {
  assert.equal(sourceLink(threads()), POST);
});

test('sourceLink falls back to the Threads profile when the post is missing', () => {
  // Weaker than the permalink and deliberately so: the profile is real, and
  // a dead link would be worse than a less precise one.
  assert.equal(sourceLink(threads({ reviewer_url: null })), 'https://www.threads.com/@gowithchinne');
});

test('sourceLink builds the Google link from the place id rather than storing it', () => {
  assert.equal(
    sourceLink({ reviewer_source: 'google', google_place_id: 'ChIJabc' }),
    'https://www.google.com/maps/place/?q=place_id:ChIJabc',
  );
});

test('sourceLink returns null rather than a link to nowhere', () => {
  assert.equal(sourceLink({ reviewer_source: 'google' }), null);
  assert.equal(sourceLink({ reviewer_source: 'threads' }), null);
  assert.equal(sourceLink({}), null);
  assert.equal(sourceLink(null), null);
});

test('sniffSource fills the whole panel from a pasted permalink', () => {
  // The URL is the only thing an editor has in the clipboard, so it has to
  // be enough on its own.
  assert.deepEqual(sniffSource(POST), {
    reviewer_source: 'threads',
    reviewer_name: 'gowithchinne',
    reviewer_url: POST,
  });
});

test('sniffSource accepts the sloppy spellings of a permalink', () => {
  for (const input of [
    'threads.com/@GoWithChinne/post/DdeLnFwj10o',
    'https://threads.net/@gowithchinne/post/DdeLnFwj10o',
    `  ${POST}?xmt=AQG0  `,
  ]) {
    assert.equal(sniffSource(input)?.reviewer_url, POST, input);
  }
});

test('sniffSource declines anything that is not a permalink', () => {
  assert.equal(sniffSource('https://www.threads.com/@gowithchinne'), null);
  assert.equal(sniffSource('https://www.threads.com/share/GlHZeGwuC/'), null);
  assert.equal(sniffSource(''), null);
  assert.equal(sniffSource(undefined), null);
});

test('sourceProblem is silent on an empty panel', () => {
  assert.equal(sourceProblem({}), null);
});

test('sourceProblem catches a name or link with no source', () => {
  assert.match(sourceProblem({ reviewer_name: 'gowithchinne' }), /Pick a source/);
  assert.match(sourceProblem({ reviewer_url: POST }), /Pick a source/);
});

test('sourceProblem requires a handle for a Threads blurb', () => {
  assert.match(sourceProblem(threads({ reviewer_name: null })), /needs the handle/);
});

test('sourceProblem rejects a handle stored with its punctuation', () => {
  assert.match(sourceProblem(threads({ reviewer_name: '@gowithchinne' })), /bare and lowercase/);
});

test('sourceProblem rejects a share link', () => {
  // The specific failure this exists for: a share link redirects to the home
  // feed, so it resolves to a different post for whoever opens it later.
  const msg = sourceProblem(threads({ reviewer_url: 'https://www.threads.com/share/GlHZeGwuC/' }));
  assert.match(msg, /Share links/);
});

test('sourceProblem rejects a link that is not a post at all', () => {
  assert.match(sourceProblem(threads({ reviewer_url: 'https://www.threads.com/@gowithchinne' })), /permalink/);
});

test('sourceProblem catches a link by a different author than the credit', () => {
  // The mistake a copy-paste run makes: the right post, the previous place's
  // handle still in the box.
  assert.match(sourceProblem(threads({ reviewer_name: 'someoneelse' })), /different author/);
});

test('sourceProblem lets a Threads credit stand without a link', () => {
  assert.equal(sourceProblem(threads({ reviewer_url: null })), null);
});

test('sourceProblem refuses an author on a Google summary', () => {
  assert.match(sourceProblem({ reviewer_source: 'google', reviewer_name: 'Someone' }), /does not name the author/);
  assert.equal(sourceProblem({ reviewer_source: 'google' }), null);
});

test('sourceProblem passes an unknown source rather than blocking the save', () => {
  assert.equal(sourceProblem({ reviewer_source: 'instagram', reviewer_name: 'x' }), null);
});
