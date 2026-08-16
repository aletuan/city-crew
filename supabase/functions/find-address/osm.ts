// Reading Photon and Nominatim, which answer the same question in two
// different shapes.
//
// Pure on purpose, and in a file of its own for the reason `lib/batch.ts`
// is: no `fetch`, no `Deno`, nothing to stub. The half of this feature
// most likely to be wrong is the half that guesses at somebody else's
// field names, and it is the half a test can hold still — see
// `app/src/lib/osm.test.ts`, which reaches across for exactly that.
// `index.ts` next door does the network and nothing else.
//
// Beside that file rather than in `_shared/`: one function uses this, and
// `_shared` should mean shared.

/** One row, normalised, whichever service it came from. */
export type Row = {
  name: string;
  street: string;
  city: string;
  county: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
};

export const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * A coordinate, or null when there is not one.
 *
 * `Number("")` is 0, not NaN — so a row with a blank `lon`, which
 * Nominatim does emit, parsed cleanly to a point in the Gulf of Guinea and
 * put a pin there. A finite-number check alone does not catch it; the
 * blank has to be rejected before the conversion.
 */
export const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** A house number belongs in front of its street, and means nothing
 *  without one — "12" is not an address, and neither is "12, Hanoi". */
const addr = (house: string, road: string) => (house && road ? `${house} ${road}` : road);

/**
 * Photon's GeoJSON.
 *
 * Coordinates are `[lon, lat]`, which is GeoJSON's order and the reverse
 * of every other pair in this codebase — putting them back the right way
 * round is the one thing in here that silently produces a plausible wrong
 * answer instead of no answer.
 */
export function fromPhoton(body: unknown): Row[] {
  const feats = (body as { features?: unknown })?.features;
  if (!Array.isArray(feats)) return [];

  const out: Row[] = [];
  for (const f of feats) {
    const p = ((f as { properties?: unknown })?.properties ?? {}) as Record<string, unknown>;
    const c = (f as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = num(c[0]);
    const lat = num(c[1]);
    if (lat == null || lng == null) continue;
    const road = str(p.street);
    out.push({
      // Plenty of Photon rows are a street or a settlement rather than a
      // named thing, and those are still answers to "where should it
      // start?" — so they fall back rather than being dropped here.
      name: str(p.name) || road || str(p.city),
      street: addr(str(p.housenumber), road),
      city: str(p.city) || str(p.district),
      county: str(p.county),
      state: str(p.state),
      country: str(p.country),
      lat,
      lng,
    });
  }
  return out;
}

/**
 * Nominatim's jsonv2, with `addressdetails=1`.
 *
 * Its `lat`/`lon` are strings, not numbers — `Number()` rather than a cast
 * is doing real work on every row here.
 *
 * The administrative level a Vietnamese commune lands on varies by row:
 * `city`, `town`, `village` and `suburb` are all the same slot to a
 * reader, so they collapse to one. Same for `county` and `district`.
 */
export function fromNominatim(body: unknown): Row[] {
  if (!Array.isArray(body)) return [];

  const out: Row[] = [];
  for (const r of body as Record<string, unknown>[]) {
    const lat = num(r.lat);
    const lng = num(r.lon);
    if (lat == null || lng == null) continue;
    const a = ((r.address ?? {}) as Record<string, unknown>);
    out.push({
      // `name` is empty on a great many rows. The head of `display_name`
      // is the same string the row would be called, so it stands in.
      name: str(r.name) || str(str(r.display_name).split(",")[0]),
      street: addr(str(a.house_number), str(a.road)),
      city: str(a.city) || str(a.town) || str(a.village) || str(a.suburb),
      county: str(a.county) || str(a.district),
      state: str(a.state) || str(a.province),
      country: str(a.country),
      lat,
      lng,
    });
  }
  return out;
}

/**
 * Two providers' answers, best-first from each in turn.
 *
 * Not concatenation, and the difference was measured rather than guessed.
 * Asked for "Ủy ban nhân dân xã Quý Lộc", Photon returns four confident
 * and completely wrong rows — a police station in Gia Lâm, a committee in
 * Hồ Chí Minh City — while Nominatim, asked the neighbouring question,
 * returns the right commune. Appending would bury the good answer under
 * four bad ones; alternating puts each service's best guess in the top
 * two, where the reader can see both and pick.
 *
 * De-duplication is the caller's, by position — see `toSpots`.
 */
export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}
