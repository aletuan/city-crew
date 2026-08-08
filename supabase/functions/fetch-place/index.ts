// Add-a-place from the phone: search Google Places (New) and import one
// result straight into the database as a pending, unpublished place —
// the mobile replacement for data/scripts/fetch-places.mjs.
//
// POST { action: "search", query, city? }              → { candidates: [...] }
// POST { action: "import", place_id, category, city? } → { slug }
//
// `city` is a cities.id ('hcmc' | 'hanoi' | 'danang' …); defaults to 'hcmc'
// so pre-multi-city clients keep working.
//
// Secrets (Edge Function settings): GOOGLE_MAPS_API_KEY.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// Callers must be signed in AND on the public.editors allow-list.

import { createClient } from "npm:@supabase/supabase-js@2";
import { cityBias, importPlace, resolveCity } from "../_shared/import-place.ts";

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

const MAX_API_CALLS = 20; // per request: 1 search or 1 details + ≤6 photo lookups

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
    const city = await resolveCity(admin, String(body.city ?? "hcmc"));

    if (body.action === "search") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ error: "query required" }, 400);
      const data = await gapi("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 5,
          locationBias: cityBias(city),
        }),
      });
      return json({
        candidates: (data.places ?? []).map((p: any) => ({
          place_id: p.id,
          name: p.displayName?.text ?? "",
          address: p.formattedAddress ?? "",
          rating: p.rating ?? null,
          rating_count: p.userRatingCount ?? null,
        })),
      });
    }

    if (body.action === "import") {
      const placeId = String(body.place_id ?? "");
      const category = body.category === "out" ? "out" : "food";
      if (!placeId) return json({ error: "place_id required" }, 400);

      const { data: dup } = await admin
        .from("places").select("slug").eq("google_place_id", placeId).maybeSingle();
      if (dup) return json({ error: `already imported as “${dup.slug}”`, slug: dup.slug }, 409);

      const { slug, photos } = await importPlace({
        admin, gapi, apiKey, placeId, category, cityId: city.id, maxPhotos: 6,
      });
      return json({ slug, photos });
    }

    return json({ error: `unknown action: ${body.action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
