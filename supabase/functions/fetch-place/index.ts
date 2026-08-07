// Add-a-place from the phone: search Google Places (New) and import one
// result straight into the database as a pending, unpublished place —
// the mobile replacement for data/scripts/fetch-places.mjs.
//
// POST { action: "search", query }            → { candidates: [...] }
// POST { action: "import", place_id, category } → { slug }
//
// Secrets (Edge Function settings): GOOGLE_MAPS_API_KEY.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// Callers must be signed in AND on the public.editors allow-list.

import { createClient } from "npm:@supabase/supabase-js@2";

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

const HCMC = { latitude: 10.7769, longitude: 106.7009 };
const MAX_API_CALLS = 20; // per request: 1 search or 1 details + ≤6 photo lookups
const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "place";

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
          locationBias: { circle: { center: HCMC, radius: 25000 } },
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

      const d = await gapi(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "id,displayName,formattedAddress,location,rating,userRatingCount,"
            + "priceLevel,regularOpeningHours,websiteUri,internationalPhoneNumber,photos",
        },
      });

      const name = d.displayName?.text ?? "Unnamed place";
      let slug = slugify(name);
      const { data: taken } = await admin
        .from("places").select("slug").like("slug", `${slug}%`);
      if (taken?.some((r: any) => r.slug === slug)) slug = `${slug}-${(taken?.length ?? 0) + 1}`;

      const priceLevel = PRICE_LEVELS[d.priceLevel as string] ?? null;
      const { data: placeRow, error: insErr } = await admin
        .from("places")
        .insert({
          slug,
          google_place_id: d.id,
          name_en: name,
          name_vi: name,
          category,
          is_featured: false,
          vibe_tags: [],
          address: d.formattedAddress ?? null,
          lat: d.location?.latitude ?? null,
          lng: d.location?.longitude ?? null,
          rating: d.rating ?? null,
          rating_count: d.userRatingCount ?? null,
          price_level: priceLevel,
          price_display: priceLevel ? "₫".repeat(priceLevel) : null,
          opening_hours: d.regularOpeningHours?.weekdayDescriptions ?? null,
          website: d.websiteUri ?? null,
          phone: d.internationalPhoneNumber ?? null,
          saved_count: 0,
          emoji: "📍",
          is_published: false,
          review_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .select("id, slug")
        .single();
      if (insErr) throw new Error(insErr.message);

      // Up to 6 photos — resolve each photo resource to a servable URI.
      const photos = (d.photos ?? []).slice(0, 6);
      const rows = [];
      for (const [i, ph] of photos.entries()) {
        try {
          const media = await gapi(
            `https://places.googleapis.com/v1/${ph.name}/media`
            + `?maxWidthPx=1600&skipHttpRedirect=true&key=${apiKey}`,
          );
          const attr = ph.authorAttributions?.[0];
          rows.push({
            place_id: placeRow.id,
            photo_ref: ph.name,
            photo_uri: media.photoUri,
            source: "google",
            attribution_name: attr?.displayName ?? null,
            attribution_uri: attr?.uri ?? null,
            sort_order: i,
            is_cover: i === 0,
            is_hidden: false,
          });
        } catch (_) { /* photo lookups are best-effort */ }
      }
      if (rows.length) {
        const { error: phErr } = await admin.from("place_photos").insert(rows);
        if (phErr) throw new Error(phErr.message);
      }

      return json({ slug, photos: rows.length });
    }

    return json({ error: `unknown action: ${body.action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
