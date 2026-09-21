// What a link says, as distinct from where it goes.
//
// The detail card shows three kinds of outside link — a website, an
// Instagram account, a Threads account — and every one of them had the same
// fault: it showed the reader a machine's version of an address. A website
// row read
//
//     facebook.com/people/magichastand/61567169829674/?mibextid=wwXIfr&rdi…
//
// because the only trimming it did was the scheme and the `www.`. Of the 413
// published places carrying a website, 70 were cut off mid-string like that;
// 56 of them were carrying a tracking query nobody typed and nobody reads.
//
// The split this module draws is between the label and the destination. The
// destination stays whole — the full URL, query and all, because that is what
// the venue handed out and a stripped one may 404. The label is the shortest
// true thing: a domain, or a handle with its @ back on.
//
// Longest host in the catalog is thirty characters, so a label made this way
// fits on one line in every case the app actually holds.

/**
 * The domain a website row shows.
 *
 * Deliberately loses the path. `radissonhotels.com` is less precise than
 * `radissonhotels.com/en-us/hotels/radisson-red-danang/restaurants-and-bars/
 * rooftop-bar`, and it is also the only one of the two a person can read at a
 * glance on a phone — the precise one is cut off after forty characters and
 * ends in an ellipsis. The tap still goes to the whole URL, which is where
 * the precision belongs.
 *
 * Parsed by hand rather than with `URL`, for two reasons: a good half of
 * these values have no scheme (`tinycafe.vn/cau-chuyen/?fbclid=…`), which
 * `URL` rejects outright; and this has to answer something for input that is
 * not a URL at all, because `website` is a free-text column an editor fills.
 */
export function hostOf(url: string | null | undefined): string {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  // Scheme, then credentials, then everything from the first delimiter on.
  // The order matters: an `@` inside a query string is not userinfo.
  const afterScheme = raw.replace(/^[a-z][a-z\d+.-]*:\/\//i, '');
  const authority = afterScheme.split(/[/?#]/)[0];
  const host = authority.includes('@') ? authority.slice(authority.lastIndexOf('@') + 1) : authority;
  return host
    .replace(/:\d+$/, '')   // a port is not part of a name
    .replace(/^www\./i, '')
    .replace(/\.$/, '')     // the root dot of a fully qualified name
    .toLowerCase();
}

/**
 * Where a handle points.
 *
 * Both hosts live here and only here, so they can move when Meta moves them
 * again — it has moved Threads once already, from .net to .com, which is why
 * `dashboard/src/lib/threads.js` keeps its own copy of this constant and says
 * the same thing.
 *
 * Handles are stored bare and lowercase (see the two `*_handle` migrations),
 * so the @ is punctuation this function and the renderer put back.
 */
export const instagramUrl = (handle: string): string =>
  `https://www.instagram.com/${handle}`;

export const threadsUrl = (handle: string): string =>
  `https://www.threads.com/@${handle}`;

/** A handle as it is written for a reader. */
export const atHandle = (handle: string): string => `@${handle}`;

/** The hosts that a handle row already covers. */
const INSTAGRAM = 'instagram.com';
const THREADS = ['threads.net', 'threads.com'];

/**
 * Whether the website row would repeat a handle row already on the card.
 *
 * Forty-seven of the catalog's websites are Instagram profile URLs, and the
 * column they sit in is the only record of where their handle came from — the
 * backfill reads it and deliberately leaves it alone. So the row is hidden
 * here rather than the data being destroyed there: the same account, said
 * twice, once as a name and once as a URL, is the card arguing with itself.
 *
 * Only when there is a handle to repeat. A profile URL on a place nobody has
 * looked up is still the one way to reach the venue, and hiding it would lose
 * the reader a link to save the card a row.
 */
export function websiteRepeatsHandle(
  website: string | null | undefined,
  handles: { instagram?: string | null; threads?: string | null },
): boolean {
  const host = hostOf(website);
  if (!host) return false;
  if (host === INSTAGRAM && handles.instagram) return true;
  if (THREADS.includes(host) && handles.threads) return true;
  return false;
}
