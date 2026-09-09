// Give a place whose Google photos have gone stale a fresh set.
//
// ── why ──
//
// `rehost-photos` copies a photo by its `photo_ref`, and a `photo_ref`
// is not forever: Google retires them — the photo withdrawn, the place
// re-listed — and the media endpoint answers 400 "retrieve it from
// Places API endpoints" from then on. The first rehost found 355 such
// rows across 104 places, 82 of which were left with no picture at all,
// among them the Cathedral, Hỏa Lò and the Mausoleum.
//
// The only way back is the one Google's message names: ask Place
// Details for the place's current `photos` and take the refs from
// there. That is one details call per place, on the cheapest field
// tier, and then the same copy `rehost.ts` always makes.
//
// ── what happens to a row ──
//
// Each stale row of a place, in its sort order, takes the next fresh
// ref not already held by a row that works. It keeps its id, its sort
// order and its cover flag — so a collection cover keeps pointing where
// it did — and gets the new ref, the new attribution and the copy. A
// stale row for which no fresh ref is left is hidden, not deleted: the
// app never draws a hidden row and falls back to the first visible one
// for the cover, and an editor can still see what was there.
//
//   POST { place_ids: ["<uuid>", …] }         exactly these places
//   POST { limit?: 4, after?: "<uuid>" }      the next places with stale rows
//   → { places, refreshed, hidden, failed, cursor, errors: [{ place, error }] }
//
// Who may call it: an editor, or the database with the job's token —
// see `_shared/gate.ts`.

import { createClient } from "npm:@supabase/supabase-js@2";
import { opsOrEditor } from "../_shared/gate.ts";
import { rehostPhoto } from "../_shared/rehost.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ops-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const TOKEN_NAME = "refresh-photos";
/** Places per call. Each is one details call and up to six copies. */
const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 8;

type StaleRow = { id: string; photo_ref: string | null; sort_order: number };
type GooglePhoto = {
  name: string;
  authorAttributions?: { displayName?: string; uri?: string }[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return json({ error: "GOOGLE_MAPS_API_KEY secret is not set" }, 500);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  if (!(await opsOrEditor(admin, req, TOKEN_NAME))) return json({ error: "not allowed" }, 403);

  let body: { limit?: number; after?: string; place_ids?: string[] } = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit) || DEFAULT_LIMIT));

  // The places with work: a Google row that has a ref and no copy. Read
  // through the rows rather than the places, then grouped, because that
  // is the only table that knows which places are stale.
  let q = admin.from("place_photos")
    .select("place_id, places!inner(id, slug, google_place_id)")
    .eq("source", "google").is("storage_path", null).not("photo_ref", "is", null)
    .order("place_id");
  if (Array.isArray(body.place_ids)) q = q.in("place_id", body.place_ids.slice(0, MAX_LIMIT));
  if (body.after) q = q.gt("place_id", body.after);
  const { data: staleRows, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const places = new Map<string, { slug: string; google_place_id: string | null }>();
  for (const r of staleRows ?? []) {
    if (places.size >= limit && !places.has(r.place_id)) break;
    places.set(r.place_id, { slug: r.places.slug, google_place_id: r.places.google_place_id });
  }

  let refreshed = 0, hidden = 0;
  const errors: { place: string; error: string }[] = [];
  let cursor: string | null = null;

  for (const [placeId, place] of places) {
    cursor = placeId;
    try {
      if (!place.google_place_id) throw new Error("no google_place_id");

      const res = await fetch(`https://places.googleapis.com/v1/places/${place.google_place_id}`, {
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "photos" },
      });
      if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const fresh: GooglePhoto[] = ((await res.json()).photos ?? []);

      const { data: rows, error: rowsErr } = await admin.from("place_photos")
        .select("id, photo_ref, sort_order, storage_path, is_hidden")
        .eq("place_id", placeId).eq("source", "google")
        .order("sort_order");
      if (rowsErr) throw new Error(rowsErr.message);

      // A ref a working row already holds is not fresh for anyone else;
      // handing it out again would put the same picture in twice.
      const held = new Set((rows ?? []).filter((r: any) => r.storage_path).map((r: any) => r.photo_ref));
      const queue = fresh.filter((p) => !held.has(p.name));
      // A row an editor already hid is left alone: it is not shown, so
      // it needs no picture, and a fresh ref is better spent on one that is.
      const stale: StaleRow[] = (rows ?? []).filter((r: any) => !r.storage_path && r.photo_ref && !r.is_hidden);

      for (const row of stale) {
        const next = queue.shift();
        if (!next) {
          const { error: hideErr } = await admin.from("place_photos")
            .update({ is_hidden: true }).eq("id", row.id);
          if (hideErr) throw new Error(hideErr.message);
          hidden++;
          continue;
        }
        const attr = next.authorAttributions?.[0];
        const { error: updErr } = await admin.from("place_photos")
          .update({
            photo_ref: next.name,
            attribution_name: attr?.displayName ?? null,
            attribution_uri: attr?.uri ?? null,
          })
          .eq("id", row.id);
        if (updErr) throw new Error(updErr.message);
        await rehostPhoto(admin, apiKey, { id: row.id, photo_ref: next.name, slug: place.slug });
        refreshed++;
      }
    } catch (e) {
      errors.push({ place: place.slug, error: String((e as Error).message ?? e).slice(0, 200) });
    }
  }

  return json({ places: places.size, refreshed, hidden, failed: errors.length, cursor, errors });
});
