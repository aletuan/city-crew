// Take the files nothing points at out of Storage.
//
// ── where they come from ──
//
// Three ways a file in `place-photos` ends up with no row:
//
//   · The Gallery's delete removes the `place_photos` row and leaves the
//     file — `removePlacePhoto` is one DELETE on the table and never asks
//     Storage. (It could not yet if it did: uploaders may delete their
//     own folder but have no select over it, and Storage removes only
//     what the caller can select — the trap the 10 Sep migration names
//     for editors.) Every photograph a reader has taken back since the
//     gallery shipped is still in the bucket.
//   · A re-import. `rehost.ts` writes `<slug>/<id>.<ext>`; when a place
//     is scanned again its old rows go and their files stay.
//   · An upload whose row never landed: the storage write succeeded, the
//     insert was refused, and `useAddPhoto` has no compensating remove.
//
// The migration of 10 Sep 2026 counted sixty-three of these and fixed the
// editor's path; on 6 Oct there were fifty-six again, 18.9 MB, most of
// them the first two kinds. They cost storage and nothing else — the
// bucket is public but a file no row names is a file no screen asks for.
//
// ── the shape of the run ──
//
// The database picks, the function acts, as `shrink-photos` does: only
// the database can see `storage.objects` beside `place_photos` and
// `cities`, so the SQL in `run.sql` computes the orphans and hands their
// paths over. The function does not trust the list. Before removing a
// path it asks the public tables again — a row written between the
// select and the call keeps its file — and it refuses the `cities/`
// folder outright, which holds the city heroes `cities.hero_photo_path`
// names and which no orphan query should ever return.
//
//   POST { paths: ["<slug>/<id>.jpg", …], dry?: true }
//   → { removed: n, kept: [{ path, why }], dry }
//
// `dry` is for the first call of a run: it answers what would go without
// going, and the caller reads the answer off `net._http_response`.
//
// Who may call it: an editor, or the database with the job's token —
// see `_shared/gate.ts`.

import { createClient } from "npm:@supabase/supabase-js@2";
import { opsOrEditor } from "../_shared/gate.ts";
import { BUCKET } from "../_shared/rehost.ts";

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

const TOKEN_NAME = "prune-photos";
/** Storage's `remove` takes a list; this keeps one call's list — and the
 *  three re-checks per path that precede it — inside a request's time. */
const MAX_PATHS = 50;
/** The folder `cities.hero_photo_path` writes into. Never pruned, whatever
 *  the caller says. */
const HERO_FOLDER = "cities/";

type Kept = { path: string; why: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  if (!(await opsOrEditor(admin, req, TOKEN_NAME))) return json({ error: "not allowed" }, 403);

  let body: { paths?: unknown; dry?: unknown } = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const dry = body.dry === true;
  const asked = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === "string") : [];
  if (asked.length === 0) return json({ error: "paths required" }, 400);
  if (asked.length > MAX_PATHS) return json({ error: `at most ${MAX_PATHS} paths` }, 400);

  const kept: Kept[] = [];
  const going: string[] = [];
  for (const path of asked) {
    if (path.startsWith("/") || path.includes("..") || path.startsWith(HERO_FOLDER)) {
      kept.push({ path, why: "refused" });
      continue;
    }
    // Asked again at the moment of removal. The caller's list was true
    // when it was made; a row written since keeps its file.
    const publicSuffix = `/${BUCKET}/${path}`;
    const [byPath, byUri, byCity] = await Promise.all([
      admin.from("place_photos").select("id").eq("storage_path", path).limit(1),
      admin.from("place_photos").select("id").like("photo_uri", `%${publicSuffix}`).limit(1),
      admin.from("cities").select("id").eq("hero_photo_path", path).limit(1),
    ]);
    const err = byPath.error ?? byUri.error ?? byCity.error;
    if (err) return json({ error: err.message }, 500);
    if (byPath.data?.length) kept.push({ path, why: "place_photos.storage_path" });
    else if (byUri.data?.length) kept.push({ path, why: "place_photos.photo_uri" });
    else if (byCity.data?.length) kept.push({ path, why: "cities.hero_photo_path" });
    else going.push(path);
  }

  if (!dry && going.length > 0) {
    const { error } = await admin.storage.from(BUCKET).remove(going);
    if (error) return json({ error: error.message, kept, would_remove: going }, 500);
  }

  return json({ removed: dry ? 0 : going.length, would_remove: dry ? going : undefined, kept, dry });
});
