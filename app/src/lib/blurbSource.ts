// Where the blurb came from, as the detail screen needs to know it.
//
// The desk's half of this is `dashboard/src/lib/reviewer.js`; the columns are
// `supabase/migrations/20260922170000_blurb_source_generalised.sql`. What
// matters here is that the two sources are not the same shape:
//
//   Threads  a person wrote the words. There is a handle to credit and a
//            permalink to open, and the credit is the point — the sentences
//            on the screen are theirs, lifted from their post.
//   Google   `import-place.ts` copies `editorialSummary`, which Google writes
//            about the place. Its field mask does not ask for `reviews`, so
//            there is no author and there never will be one from that path.
//            The place's Maps page is the closest thing to a source, and it
//            is derivable from `google_place_id` rather than stored twice.
//   Editorial the desk wrote it. Recorded in the database so that "we wrote
//            this" and "nobody has looked" are answerable apart, and drawn
//            nowhere: "City Crew" under City Crew's own paragraph, inside
//            City Crew, is a line that costs a reader attention and returns
//            nothing. So this returns null for it, exactly as it does for a
//            source nobody recorded.
//
// Which is why this returns a discriminated shape rather than a string: the
// screen owns the wording in three languages, and a module that returned
// "Google" would own it in one.

import type { Place } from './types';

export type BlurbCredit =
  | { kind: 'threads'; name: string | null }
  | { kind: 'google' }
  | { kind: 'other'; source: string; name: string | null };

/**
 * What to put under the blurb, or null when nothing was recorded.
 *
 * A Google credit carries no name even if the column somehow holds one —
 * printing an author Google never supplied would be a fabricated
 * attribution, which is worse than the plain platform name.
 */
export function blurbCredit(place: Pick<Place, 'reviewer_source' | 'reviewer_name'>): BlurbCredit | null {
  const source = place.reviewer_source?.trim();
  if (!source || source === 'editorial') return null;
  const name = place.reviewer_name?.trim() || null;
  if (source === 'threads') return { kind: 'threads', name };
  if (source === 'google') return { kind: 'google' };
  return { kind: 'other', source, name };
}

/**
 * Where a tap goes, or null when there is nowhere — in which case the credit
 * renders as plain text rather than as a link that does nothing.
 *
 * The stored permalink wins. Failing that each source gets one derivation:
 * the Threads profile from the handle (weaker than the post, but real), and
 * the Maps page from the place id.
 */
export function blurbLink(
  place: Pick<Place, 'reviewer_source' | 'reviewer_name' | 'reviewer_url' | 'google_place_id'>,
): string | null {
  const url = place.reviewer_url?.trim();
  if (url) return url;
  const source = place.reviewer_source?.trim();
  if (source === 'editorial') return null;
  const name = place.reviewer_name?.trim();
  if (source === 'threads' && name) return `https://www.threads.com/@${name}`;
  if (source === 'google' && place.google_place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${place.google_place_id}`;
  }
  return null;
}

/**
 * The mark that stands for a source, or null when we have none.
 *
 * The glyph is what makes the platform legible at a glance, and it lets the
 * line stop spelling out what it already shows: "@gowithchinne" under the
 * Threads mark says everything "@gowithchinne on Threads" does, in half a
 * line of a 320pt screen. The wording stays with the screen, which owns the
 * three languages; only the choice of mark is here, where the shape of each
 * source already lives.
 *
 * Null for `other` on purpose. That branch is a source recorded before this
 * app knew about it, and a wrong mark is worse than none: the text still
 * names it, so nothing is lost.
 */
export function blurbIcon(credit: BlurbCredit): 'logo-threads' | 'logo-google' | null {
  if (credit.kind === 'threads') return 'logo-threads';
  if (credit.kind === 'google') return 'logo-google';
  return null;
}
