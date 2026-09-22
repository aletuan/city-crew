// Where a blurb came from, and what a tap on it should open.
//
// The three columns behind this (`reviewer_source`, `reviewer_name`,
// `reviewer_url` — see
// `supabase/migrations/20260922170000_blurb_source_generalised.sql`) describe
// a source rather than a platform, because the two sources we have behave
// differently in exactly the way that matters:
//
//   Threads  a person wrote the words. There is a handle to credit and a
//            permalink that proves it.
//   Google   `import-place.ts` copies `editorialSummary`, which Google writes
//            about the place. Nobody to credit, and no per-summary link —
//            the place's Maps page is the closest thing, and it is already
//            derivable from `google_place_id`, so it is not stored.
//
// Which is why `reviewer_name` and `reviewer_url` are both optional and the
// source alone has to be enough to render a credit.

import { normalizeThreads, threadsUrl } from './threads.js';

const THREADS_POST = /^(?:https?:\/\/)?(?:www\.)?threads\.(?:net|com)\/@([a-z0-9._]{1,30})\/post\/([\w-]+)/i;

export const SOURCE_OPTIONS = [
  ['', '— none —'],
  ['threads', 'Threads post'],
  ['google', 'Google editorial summary'],
];

/**
 * The line under the blurb. Null when there is nothing honest to say.
 *
 * Google gets a bare "Google" because naming an author it never supplied
 * would be a fabricated credit, which is worse than none.
 */
export function sourceCredit({ reviewer_source, reviewer_name }) {
  if (!reviewer_source) return null;
  if (reviewer_source === 'threads') {
    return reviewer_name ? `@${reviewer_name} on Threads` : 'Threads';
  }
  if (reviewer_source === 'google') return 'Google';
  return reviewer_name ? `${reviewer_name} on ${reviewer_source}` : reviewer_source;
}

/**
 * What a tap opens, or null when there is nowhere to go.
 *
 * `reviewer_url` wins when it is set. Otherwise each source gets one chance
 * to derive a link: Threads from the handle (the profile, not the post —
 * weaker, but real), Google from the place id. A source with neither returns
 * null and the UI shows plain text instead of a dead link.
 */
export function sourceLink(place) {
  if (place?.reviewer_url) return place.reviewer_url;
  if (place?.reviewer_source === 'threads' && place.reviewer_name) {
    return threadsUrl(place.reviewer_name);
  }
  if (place?.reviewer_source === 'google' && place.google_place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${place.google_place_id}`;
  }
  return null;
}

/**
 * Pasting a Threads permalink should fill the whole panel, because that URL
 * is the only thing an editor actually has in the clipboard. Returns the
 * patch to merge, or null when the input is not a permalink.
 */
export function sniffSource(input) {
  const m = String(input ?? '').trim().match(THREADS_POST);
  if (!m) return null;
  return {
    reviewer_source: 'threads',
    reviewer_name: m[1].toLowerCase(),
    reviewer_url: `https://www.threads.com/@${m[1].toLowerCase()}/post/${m[2]}`,
  };
}

/**
 * Null when the panel is coherent, otherwise a sentence to show beside it.
 * Empty is always fine — most places have no recorded source, and inventing
 * one to fill the box is the failure this is guarding against.
 */
export function sourceProblem({ reviewer_source, reviewer_name, reviewer_url }) {
  if (!reviewer_source) {
    if (reviewer_name || reviewer_url) return 'Pick a source, or clear the name and link.';
    return null;
  }
  if (reviewer_source === 'threads') {
    if (!reviewer_name) return 'A Threads blurb needs the handle of whoever wrote it.';
    if (normalizeThreads(reviewer_name) !== reviewer_name) {
      return 'Store the handle bare and lowercase — no @, no URL.';
    }
    if (reviewer_url && /threads\.(?:net|com)\/share\//i.test(reviewer_url)) {
      return 'Share links expire into the home feed — paste the /@author/post/… permalink.';
    }
    if (reviewer_url && !THREADS_POST.test(reviewer_url)) {
      return 'Not a Threads post permalink (https://www.threads.com/@author/post/…).';
    }
    if (reviewer_url && !reviewer_url.toLowerCase().includes(`/@${reviewer_name}/`)) {
      return 'The link is by a different author than the handle above.';
    }
    return null;
  }
  if (reviewer_source === 'google') {
    if (reviewer_name) {
      return 'Google does not name the author of an editorial summary — leave the name empty.';
    }
    return null;
  }
  return null;
}
