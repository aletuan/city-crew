// Finding a place by name, for the "where should it start?" sheet.
//
// POST { query, at?: { lat, lng }, limit? } → { rows: [...] }
//
// ── why this exists at all ──
//
// The sheet used to call the platform geocoder directly, which on iOS is
// `CLGeocoder.geocodeAddressString`. That resolves *addresses*: a street
// and a district in, a point out. It has no opinion about "Ủy ban nhân dân
// xã Quý Lộc", because that is a name, not an address — and the field
// said "Search an address or place" while being able to do only the first
// half of that. Apple's own search box does not use CLGeocoder either;
// it uses MKLocalSearch, which expo-location does not expose.
//
// ── why OpenStreetMap rather than Google ──
//
// Google Places would answer this well, and the app already pays for it
// in `fetch-place`. It cannot be used here. Places results may not be
// displayed on a map that is not Google's (Places ToS §5.3), and the map
// on this sheet is Apple's — that same clause is why MiniMap shows no
// places at all. OpenStreetMap's ODbL has no such clause, so its results
// and an Apple map can share a screen.
//
// ── why two providers, both every time ──
//
// They index the same OSM data and match it differently: Photon is built
// for search-as-you-type and is forgiving about word order and
// diacritics, Nominatim is stricter and resolves administrative names
// better. Both are asked at once and their answers alternate.
//
// The obvious cheaper design — Photon, and Nominatim only if it found
// nothing — was tried and measured, and it does not work. Photon almost
// never finds *nothing*; asked for "Ủy ban nhân dân xã Quý Lộc" it
// returns four confident wrong answers from two other provinces, so the
// fallback would never fire on exactly the queries that need it. "Found
// rows" is not "found the right rows", and only the reader can tell the
// difference — so both lists reach them.
//
// In parallel, so the pair costs the slower of the two rather than the
// sum.
//
// ── what it does not do ──
//
// No key, no billing, no secret: both endpoints are public. It still
// requires a signed-in caller, so this cannot be used as an open proxy by
// anyone who finds the URL.
//
// Attribution is the reader's side of ODbL and belongs in the UI, not
// here — see the note under the results list in StartSheet.

// Reading each provider's shape is next door and pure, so a Node process
// can hold it still — see the note at the top of it. Composing a display
// line out of the result is the client's job for the same reason.
import { fromNominatim, fromPhoton, interleave, num, str, type Row } from "./osm.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Both services ask to be told who is calling, and Nominatim's usage
// policy makes it a condition rather than a courtesy. A request with no
// identifiable agent is the kind they block.
const UA = "cityCrew/1.0 (https://github.com/aletuan/city-crew)";

// Long enough for a cold upstream, short enough that a hung provider does
// not hold the reader waiting. The same for both, because they run
// together: the pair costs whichever is slower, so giving one a tighter
// budget than the other would buy nothing and lose its answers.
//
// A provider that overruns is not an error — `getJson` turns it into an
// empty list and the other one's results still arrive.
const FETCH_MS = 6000;

async function getJson(url: string, ms: number): Promise<unknown | null> {
  const stop = AbortSignal.timeout(ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: stop,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // A provider that timed out, refused, or returned something that is
    // not JSON are the same event to the caller: this one has no answer.
    // The other one may.
    return null;
  }
}

async function photon(q: string, at: { lat: number; lng: number } | null, limit: number): Promise<Row[]> {
  const u = new URL("https://photon.komoot.io/api");
  u.searchParams.set("q", q);
  u.searchParams.set("limit", String(limit));
  // `default`, meaning the name as OSM holds it, rather than one of the
  // handful of languages Photon translates into. `lang=en` turns "Ủy ban
  // nhân dân xã Vĩnh Lộc" into "People's Committee of Vinh Loc commune" —
  // measured, both spellings from the same row — and the reader typing
  // the first of those does not want to be handed the second.
  u.searchParams.set("lang", "default");
  if (at) {
    // A bias, not a filter. Photon ranks nearer hits higher and still
    // returns distant ones, which is what a search box should do: the
    // reader who types a place in another province means that place.
    u.searchParams.set("lat", String(at.lat));
    u.searchParams.set("lon", String(at.lng));
  }
  return fromPhoton(await getJson(u.toString(), FETCH_MS));
}

async function nominatim(q: string, at: { lat: number; lng: number } | null, limit: number): Promise<Row[]> {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", q);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("addressdetails", "1");
  u.searchParams.set("limit", String(limit));
  if (at) {
    // Roughly half a degree each way — about 55 km — and deliberately
    // unbounded, so this ranks the neighbourhood up without hiding
    // anything outside it.
    const d = 0.5;
    u.searchParams.set(
      "viewbox",
      [at.lng - d, at.lat + d, at.lng + d, at.lat - d].join(","),
    );
    u.searchParams.set("bounded", "0");
  }
  return fromNominatim(await getJson(u.toString(), FETCH_MS));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Signed in, like every other function here. There is no key to protect
  // and no cost to run up, but an unauthenticated endpoint that makes
  // outbound requests on demand is a proxy, and this must not be one.
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user?.id) return json({ error: "not signed in" }, 401);

  let body: { query?: unknown; at?: unknown; limit?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const q = str(body.query);
  if (!q) return json({ rows: [] });

  // `num` rather than `Number`, for the reason given where it is defined:
  // `Number(null)` and `Number("")` are both 0, so a malformed `at` would
  // not fail — it would quietly bias every search towards the Gulf of
  // Guinea.
  const rawAt = body.at as { lat?: unknown; lng?: unknown } | null | undefined;
  const lat = num(rawAt?.lat);
  const lng = num(rawAt?.lng);
  const at = lat != null && lng != null ? { lat, lng } : null;

  const asked = num(body.limit);
  const limit = asked != null ? Math.min(Math.max(Math.trunc(asked), 1), 10) : 6;

  const [a, b] = await Promise.all([photon(q, at, limit), nominatim(q, at, limit)]);
  // Trimmed after interleaving, never before: the cap is on what the
  // reader is shown, and cutting either list first would be cutting it
  // before the two have been weighed against each other.
  return json({ rows: interleave(a, b).slice(0, limit), photon: a.length, nominatim: b.length });
});
