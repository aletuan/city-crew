// A search result from Google Places, as plain data.
//
// Split out of `lib/findplace` so a Node process can reach it: that file
// imports the Supabase client, which pulls in React Native, and the parts
// worth getting right here are the ones with the edge cases — an address
// that repeats the name it sits under, a result with no coordinates, the
// same business arriving twice.
//
// Why the results are Google's, and not the OpenStreetMap search this
// sheet used to run, is a licence question answered at the top of
// `components/MiniMap.tsx`.

import type { Candidate } from './suggest';

/** A result once it is ready to be a list item. */
export type Spot = {
  name: string;
  /** Where it is, in one line — may be empty when the address carried
   *  nothing the name had not already said, which is a state the list
   *  wears by being one line tall. */
  label: string;
  lat: number;
  lng: number;
};

const norm = (s: string) => s.trim().toLowerCase();

/** Folded country names an address may end with. Google writes the
 *  country in the request's language, so the reader's three are here. */
const COUNTRY = new Set(['vietnam', 'viet nam', 'việt nam', 'ベトナム']);

/**
 * The result's address, as one line, without saying anything twice.
 *
 * Google's `formattedAddress` runs outward — street, ward, district,
 * city, postcode, country — and two parts of it are noise on this sheet.
 * The country, because every result worth offering is in the same one, so
 * it is the part that can never tell two results apart. And any part
 * that repeats the name: a result for a ward or a district carries its
 * own name as the first segment of its address, and "Hoàn Kiếm — Hoàn
 * Kiếm, Hà Nội" is two chances to read the same word.
 *
 * The city stays, unlike on the place detail screen (`shortAddress`),
 * because this search may leave the city on purpose and the reader
 * picking between a commune in Thanh Hóa and a street in Hanoi needs the
 * segment that says which is which.
 */
export function spotLabel(c: Pick<Candidate, 'name' | 'address'>): string {
  const parts = c.address.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1 && COUNTRY.has(norm(parts[parts.length - 1]))) parts.pop();
  const name = norm(c.name);
  return parts.filter((p) => norm(p) !== name).join(', ');
}

/**
 * Candidates to list items: labelled, de-duplicated, and short of anything
 * that cannot be put on a map.
 *
 * Identity is the place id, which is what Google's is. A function
 * deployed before the field mask asked for coordinates answers `lat`/`lng`
 * as null, and a result with no point is a pin with nowhere to go, so it
 * is dropped rather than offered — as is a row with no name, which is a
 * pin the reader cannot recognise.
 */
export function fromCandidates(rows: readonly Candidate[]): Spot[] {
  const seen = new Set<string>();
  const out: Spot[] = [];
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const name = (r.name ?? '').trim();
    if (!name) continue;
    const key = r.place_id || `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, label: spotLabel({ name, address: r.address ?? '' }), lat: r.lat, lng: r.lng });
  }
  return out;
}

/**
 * What the sheet's one big button should do right now.
 *
 * There is a single primary button and two things the reader could mean by
 * pressing it, which is a trap unless the button picks the right one. Text
 * sitting in the field that has never been searched is an intention that
 * has not happened yet; committing over it threw it away silently and
 * started the day somewhere else entirely — you typed "cau giay", pressed
 * the biggest, warmest thing on the screen, and got Ba Đình.
 *
 * So the button follows the field. Unresolved text means the reader's next
 * move is to search it; anything else means they are done choosing.
 *
 * `settled` is the query as of the last search or the last result picked —
 * not merely "has a search happened". Picking a result writes its name
 * back into the field, so a plain has-searched flag would leave the button
 * saying "Search" over text that is already an answer. And editing after a
 * search makes the text unresolved again, which is why this compares the
 * strings rather than counting events.
 */
export function ctaMode(query: string, settled: string): 'search' | 'commit' {
  const q = query.trim();
  // An empty field asks nothing, so there is nothing to resolve.
  if (!q) return 'commit';
  return q === settled.trim() ? 'commit' : 'search';
}
