// Take the check-in photos nothing points at out of Storage, and say how
// big the bucket is (K2 of `docs/checkin-photos-plan.md`).
//
// Where the orphans come from is written beside the function that finds
// them (`20261125000000_checkin_photo_orphans.sql`): a visit or an
// account removed, whose rows went by cascade and whose files a cascade
// cannot reach.
//
//   POST { dry?: true, limit?: n }
//   → { removed, would_remove?, kept, usage: { files, bytes, accounts }, dry }
//
// Unlike `prune-photos`, the caller names no paths: the bucket is private
// and nothing but this project writes it, so there is nothing a caller
// could know that the database does not. Each path the database hands
// over is asked about again before it goes — a row written since keeps
// its file — and only paths of the bucket's own shape are taken, so a
// mistake in the query cannot reach anything else.
//
// Daily, from `cron.sql`, with its ops token; or by an editor.

import { createClient } from "npm:@supabase/supabase-js@2";
import { opsOrEditor } from "../_shared/gate.ts";
import { http } from "../_shared/http.ts";

const { CORS, json } = http({ opsToken: true });

const TOKEN_NAME = "prune-checkin-photos";
const BUCKET = "checkin-photos";
/** `<owner>/<visit>/<photo>.jpg`, three ids: the only shape the bucket holds. */
const SHAPE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  if (!(await opsOrEditor(admin, req, TOKEN_NAME))) return json({ error: "not allowed" }, 403);

  let body: { dry?: unknown; limit?: unknown } = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const dry = body.dry === true;
  const limit = typeof body.limit === "number" ? body.limit : 100;

  const { data: found, error: findErr } = await admin.rpc("checkin_photo_orphans", { p_limit: limit });
  if (findErr) return json({ error: findErr.message }, 500);

  const kept: { path: string; why: string }[] = [];
  const going: string[] = [];
  for (const { name } of (found ?? []) as { name: string }[]) {
    if (!SHAPE.test(name)) { kept.push({ path: name, why: "shape" }); continue; }
    const { data: row, error } = await admin.from("checkin_photos").select("id").eq("path", name).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (row) kept.push({ path: name, why: "row" });
    else going.push(name);
  }

  if (!dry && going.length > 0) {
    const { error } = await admin.storage.from(BUCKET).remove(going);
    if (error) return json({ error: error.message, kept, would_remove: going }, 500);
  }

  const { data: usage, error: useErr } = await admin.rpc("checkin_photos_usage");
  if (useErr) return json({ error: useErr.message }, 500);

  return json({
    removed: dry ? 0 : going.length,
    would_remove: dry ? going : undefined,
    kept,
    usage: (usage as unknown[] | null)?.[0] ?? null,
    dry,
  });
});
