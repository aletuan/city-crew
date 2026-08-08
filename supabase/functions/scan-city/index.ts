// Batch city scan: run one curated Google Places query per category for a
// city and import the new results as pending, unpublished places for review.
// The dashboard calls "scan" once per category, sequentially, so each
// invocation stays well under the edge-function wall clock and the UI can
// show live per-category progress.
//
// POST { action: "categories" }               → { categories: [...] }
// POST { action: "scan", city, category_key } → { city, category_key, query, found,
//                                                 imported: [{slug,name}], skipped_existing, errors }
//
// Secrets: GOOGLE_MAPS_API_KEY. Callers must be signed-in editors.

import { createClient } from "npm:@supabase/supabase-js@2";
import { cityBias, importPlace, resolveCity, SCAN_CATEGORIES } from "../_shared/import-place.ts";

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

// Worst case: 1 search + 8 places × (1 details + 3 photo lookups) = 33.
const MAX_API_CALLS = 45;
const MAX_IMPORTS_PER_SCAN = 8;
const PHOTOS_PER_PLACE = 3;

const CATEGORIES = SCAN_CATEGORIES;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return json({ error: "GOOGLE_MAPS_API_KEY secret is not set" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── editor gate: valid session + email on the allow-list ──
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase();
  if (!email) return json({ error: "not signed in" }, 401);
  const { data: editor } = await admin
    .from("editors").select("email").eq("email", email).maybeSingle();
  if (!editor) return json({ error: `${email} is not on the editors list` }, 403);

  let apiCalls = 0;
  const gapi = async (url: string, init?: RequestInit) => {
    if (++apiCalls > MAX_API_CALLS) throw new Error(`API call cap (${MAX_API_CALLS}) reached`);
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
    return res.json();
  };

  try {
    const body = await req.json();

    if (body.action === "categories") {
      return json({ categories: CATEGORIES.map(({ q: _q, ...c }) => c) });
    }

    if (body.action === "scan") {
      const cat = CATEGORIES.find((c) => c.key === body.category_key);
      if (!cat) return json({ error: `unknown category_key: ${body.category_key}` }, 400);
      const city = await resolveCity(admin, String(body.city ?? ""));

      const query = cat.q.replace("{en}", city.name_en).replace("{vi}", city.name_vi);
      const data = await gapi("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 10,
          locationBias: cityBias(city),
        }),
      });
      const found = (data.places ?? []) as any[];

      const ids = found.map((p) => p.id);
      const { data: existing } = ids.length
        ? await admin.from("places").select("google_place_id").in("google_place_id", ids)
        : { data: [] };
      const known = new Set((existing ?? []).map((r: any) => r.google_place_id));

      const fresh = found.filter((p) => !known.has(p.id)).slice(0, MAX_IMPORTS_PER_SCAN);
      const imported: { slug: string; name: string }[] = [];
      const errors: string[] = [];
      for (const p of fresh) {
        try {
          const { slug } = await importPlace({
            admin, gapi, apiKey,
            placeId: p.id,
            category: cat.category,
            cityId: city.id,
            vibeTags: [...cat.vibes],
            maxPhotos: PHOTOS_PER_PLACE,
          });
          imported.push({ slug, name: p.displayName?.text ?? slug });
        } catch (err) {
          errors.push(`${p.displayName?.text ?? p.id}: ${(err as Error).message}`);
        }
      }

      return json({
        city: city.id,
        category_key: cat.key,
        query,
        found: found.length,
        imported,
        skipped_existing: known.size,
        errors,
      });
    }

    return json({ error: `unknown action: ${body.action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
