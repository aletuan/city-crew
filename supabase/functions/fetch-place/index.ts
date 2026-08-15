// Add-a-place from the phone: search Google Places (New) and import one
// result straight into the database as a pending, unpublished place —
// the mobile replacement for data/scripts/fetch-places.mjs.
//
// POST { action: "search",  query, city? }              → { candidates: [...] }
// POST { action: "import",  place_id, category, city? } → { slug }   (desk)
// POST { action: "suggest", place_id, category, city? } → { slug }   (anyone)
//
// `city` is a cities.id ('hcmc' | 'hanoi' | 'danang' …); defaults to 'hcmc'
// so pre-multi-city clients keep working.
//
// Secrets (Edge Function settings): GOOGLE_MAPS_API_KEY.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
//
// Every caller must be signed in. `import` additionally requires a place
// on the public.editors allow-list; `search` and `suggest` do not.
//
// `suggest` exists rather than `import` being opened up, and the reason
// is that the desk's tool is live and this must not be able to break it —
// a new action cannot regress an old one. The two callers also genuinely
// differ: one stamps a submitter and carries a daily cap, the other has
// neither. What they share is the row they build, which is shared code
// on purpose: a place suggested from a phone and one imported at the desk
// should differ in who is on it and in nothing else.

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

// Suggestions per account per day. Generous against any real use — a
// person who has found ten missing places in a day has been unusually
// diligent — and small enough that the review queue cannot be buried by
// one account. Editors are not counted; importing in bulk is their job.
const DAILY_SUGGESTIONS = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return json({ error: "GOOGLE_MAPS_API_KEY secret is not set" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── who is calling ──
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  const uid = userData?.user?.id;
  const email = userData?.user?.email?.toLowerCase();
  if (!uid || !email) return json({ error: "not signed in" }, 401);
  const { data: editor } = await admin
    .from("editors").select("email").eq("email", email).maybeSingle();
  const isEditor = !!editor;

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

    // Open to any signed-in caller, because the phone's Add-a-place
    // screen cannot work without it.
    //
    // Worth naming rather than leaving implicit: this is one Google call
    // per press, uncapped per account. A cap would need a record of
    // searches, which is state with nothing else to justify it, and the
    // exposure is bounded by needing an account at all. If the bill ever
    // shows it, the answer is a counter table — not a smaller field mask.
    if (body.action === "search") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ error: "query required" }, 400);
      const data = await gapi("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          // `places.location` sits in the same Pro field tier as
          // `formattedAddress`, which this mask already asks for, and the
          // mask already reaches Enterprise via `rating` — so the SKU
          // this call bills at does not move. The coordinate is what lets
          // the app tell three shops with the same name apart without a
          // map: see `fmtDistance`.
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
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
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
          rating: p.rating ?? null,
          rating_count: p.userRatingCount ?? null,
        })),
      });
    }

    if (body.action === "import" || body.action === "suggest") {
      const fromDesk = body.action === "import";
      if (fromDesk && !isEditor) {
        return json({ error: `${email} is not on the editors list` }, 403);
      }

      const placeId = String(body.place_id ?? "");
      const category = body.category === "out" ? "out" : "food";
      if (!placeId) return json({ error: "place_id required" }, 400);

      // The cap is counted off the rows themselves — `places.created_at`
      // is already there, so there is no window to keep, no counter to
      // reset, and nothing that can drift out of step with what was
      // actually submitted. Editors are exempt: importing in bulk is the
      // job.
      if (!fromDesk) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await admin
          .from("places")
          .select("id", { count: "exact", head: true })
          .eq("submitted_by", uid)
          .gte("created_at", since);
        if ((count ?? 0) >= DAILY_SUGGESTIONS) {
          return json({ error: "daily_limit", limit: DAILY_SUGGESTIONS }, 429);
        }
      }

      // The duplicate answer differs by who is asking, because a pending
      // place is nobody's business but its submitter's. The desk sees the
      // slug either way; a user is told the place is already known and,
      // only if it is actually live, where to find it. Anything else
      // would either leak somebody's pending suggestion or send a person
      // to a page that would 404 for them.
      const { data: dup } = await admin
        .from("places")
        .select("slug, is_published, review_status")
        .eq("google_place_id", placeId)
        .maybeSingle();
      if (dup) {
        const live = dup.is_published && dup.review_status === "approved";
        if (fromDesk) {
          return json({ error: `already imported as “${dup.slug}”`, slug: dup.slug }, 409);
        }
        return json({ error: "already_known", live, slug: live ? dup.slug : null }, 409);
      }

      const { slug, photos } = await importPlace({
        admin, gapi, apiKey, placeId, category, cityId: city.id, maxPhotos: 6,
        submittedBy: fromDesk ? null : uid,
      });
      return json({ slug, photos });
    }

    return json({ error: `unknown action: ${body.action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
