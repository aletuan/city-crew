// Move Google place photos onto our own Storage, a batch at a time.
//
// See `_shared/rehost.ts` for why the copy exists. This is the door for
// the photos that predate it: every row whose picture still lives at a
// Google link — `source = 'google'`, no `storage_path` — is work, and a
// call takes the next `limit` of them in id order.
//
// ── who may call it ──
//
// An editor, with the same session check every desk function makes. Or
// the database itself: a `pg_net` loop or a `pg_cron` job carries no
// session, so it carries the `ops_tokens` row named for this job in an
// `x-ops-token` header instead — a secret the service role alone can
// read, made for the run and deleted after it. See the migration.
//
// ── the cursor ──
//
// A photo Google will not serve any more — the place deleted, the photo
// withdrawn — fails every time, and "the next N rows" would keep
// returning it at the head of the queue forever. So a call reports the
// last id it looked at and the caller passes it back as `after`; a
// failed row is left for another day rather than blocking the rest.
//
//   POST { limit?: 20, after?: "<uuid>" }
//   → { done, failed, cursor, remaining, errors: [{ id, error }] }

import { createClient } from "npm:@supabase/supabase-js@2";
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

/** Per call. Each photo is one Google media call plus one upload, and a
 *  function invocation has a wall-clock budget; twenty fits with room. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const TOKEN_NAME = "rehost-photos";

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

  // ── gate: an editor's session, or the job's own token ──
  let allowed = false;
  const opsToken = req.headers.get("x-ops-token");
  if (opsToken) {
    const { data: row } = await admin.from("ops_tokens")
      .select("token, expires_at").eq("name", TOKEN_NAME).maybeSingle();
    allowed = !!row && row.token === opsToken && new Date(row.expires_at) > new Date();
  } else {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: userData } = await admin.auth.getUser(jwt);
    const email = userData?.user?.email?.toLowerCase();
    if (email) {
      const { data: editor } = await admin.from("editors").select("email").eq("email", email).maybeSingle();
      allowed = !!editor;
    }
  }
  if (!allowed) return json({ error: "not allowed" }, 403);

  let body: { limit?: number; after?: string } = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit) || DEFAULT_LIMIT));

  let q = admin.from("place_photos")
    .select("id, photo_ref, places!inner(slug)")
    .eq("source", "google").is("storage_path", null).not("photo_ref", "is", null)
    .order("id").limit(limit);
  if (body.after) q = q.gt("id", body.after);
  const { data: rows, error } = await q;
  if (error) return json({ error: error.message }, 500);

  let done = 0;
  const errors: { id: string; error: string }[] = [];
  let cursor: string | null = null;
  for (const r of rows ?? []) {
    cursor = r.id;
    try {
      await rehostPhoto(admin, apiKey, { id: r.id, photo_ref: r.photo_ref, slug: r.places.slug });
      done++;
    } catch (e) {
      errors.push({ id: r.id, error: String((e as Error).message ?? e).slice(0, 200) });
    }
  }

  const { count } = await admin.from("place_photos")
    .select("id", { count: "exact", head: true })
    .eq("source", "google").is("storage_path", null);

  return json({ done, failed: errors.length, cursor, remaining: count ?? null, errors });
});
