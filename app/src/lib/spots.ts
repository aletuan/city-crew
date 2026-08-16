// A search result from OpenStreetMap, as plain data.
//
// Split out of `lib/findplace` so a Node process can reach it: that file
// imports the Supabase client, which pulls in React Native, and the parts
// worth getting right here are the ones with the edge cases — a row whose
// city repeats its own name, a row that is nothing but a street, the same
// doorway arriving twice from two providers.
//
// Why the results are OSM at all, and not the Google Places search this
// app already pays for, is a licence question answered at the top of
// `supabase/functions/find-address/index.ts`.

/** One row as the Edge Function normalises it, from either provider. */
export type SpotRow = {
  name: string;
  street: string;
  city: string;
  county: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
};

/** A row once it is ready to be a list item. */
export type Spot = {
  name: string;
  /** Where it is, in one line — may be empty when the row carried nothing
   *  the name had not already said, which is a state the list wears by
   *  being one line tall. */
  label: string;
  lat: number;
  lng: number;
};

const norm = (s: string) => s.trim().toLowerCase();

/**
 * The place's address, as one line, without saying anything twice.
 *
 * Parts run outward — street, then city, then county, then state — and a
 * part is dropped when it repeats the name or a part already used. That
 * rule is not cosmetic. OSM rows for a commune office routinely carry the
 * commune as *both* the name and the city, so a plain join produces
 * "Ủy ban nhân dân xã Quý Lộc — Quý Lộc, Quý Lộc", which is three chances
 * to read the same word and none to tell two results apart.
 *
 * The country is left out on the same principle: every result worth
 * offering is in the same one, so it is the part that can never
 * disambiguate anything.
 */
export function spotLabel(r: SpotRow): string {
  const used = new Set([norm(r.name)]);
  const out: string[] = [];
  for (const part of [r.street, r.city, r.county, r.state]) {
    const p = part.trim();
    if (!p) continue;
    const key = norm(p);
    if (used.has(key)) continue;
    used.add(key);
    out.push(p);
  }
  return out.join(', ');
}

/**
 * Rows to list items: labelled, de-duplicated, and short of anything that
 * cannot be put on a map.
 *
 * Two providers over one dataset means the same building can arrive twice
 * with different spellings, so identity is the position rather than the
 * text. Four decimal places is about 11 m — close enough that two rows
 * rounding together are the same doorway, far enough apart that two
 * neighbouring shops stay two results.
 */
export function toSpots(rows: SpotRow[]): Spot[] {
  const seen = new Set<string>();
  const out: Spot[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const name = r.name.trim();
    // A row with no name is a pin with no label: nothing for the reader
    // to recognise, so nothing to offer them.
    if (!name) continue;
    const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, label: spotLabel(r), lat: r.lat, lng: r.lng });
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
