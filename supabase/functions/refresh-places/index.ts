// Ask Google again about a handful of places, and write what it says.
//
// The door the daily job (`cron.sql`, beside this file) knocks on. What a
// refresh may and may not overwrite is `_shared/refresh-place.ts`; why it
// exists at all is C1 in `docs/tech-eval-app-store.md`.
//
//   POST { ids: ["<uuid>", …] }   exactly these places
//   POST { limit?: 10 }           the places Google answered for longest ago
//   → { refreshed, not_found, failed, errors: [{ id, error }] }
//
// A place that fails — Google refuses, the write is refused — keeps its old
// `google_refreshed_at` and is simply first in line tomorrow. One bad row
// never stops the rest of a batch.
//
// Who may call it: an editor, or the database with the job's token — see
// `_shared/gate.ts`.

import { createClient } from "npm:@supabase/supabase-js@2";
import { opsOrEditor } from "../_shared/gate.ts";
import { refreshPlace, type RefreshRow } from "../_shared/refresh-place.ts";

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

const TOKEN_NAME = "refresh-places";
const DEFAULT_LIMIT = 10;
/** Each place is one Google call and one write, a few hundred ms together;
 *  twenty keeps a request well inside the function's time limit. */
const MAX_LIMIT = 20;

const COLS = "id, google_place_id, website, phone, google_website, google_phone, desc_en, reviewer_source";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  if (!(await opsOrEditor(admin, req, TOKEN_NAME))) return json({ error: "not allowed" }, 403);

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return json({ error: "GOOGLE_MAPS_API_KEY secret is not set" }, 500);

  let body: { limit?: number; ids?: string[] } = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit) || DEFAULT_LIMIT));

  let q = admin.from("places").select(COLS).not("google_place_id", "is", null);
  if (Array.isArray(body.ids)) q = q.in("id", body.ids.slice(0, MAX_LIMIT));
  else q = q.order("google_refreshed_at", { ascending: true, nullsFirst: true }).limit(limit);
  const { data: rows, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const now = new Date();
  let refreshed = 0, notFound = 0;
  const errors: { id: string; error: string }[] = [];
  for (const row of (rows ?? []) as RefreshRow[]) {
    try {
      const outcome = await refreshPlace(admin, apiKey, row, now);
      if (outcome === "not_found") notFound++; else refreshed++;
    } catch (e) {
      errors.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ refreshed, not_found: notFound, failed: errors.length, errors });
});
