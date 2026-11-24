// Delete the caller's own account — the whole of it, now.
//
// The App Store requires it (5.1.1(v): an app that creates accounts must
// let a person delete one in the app), and decency required it first. The
// heavy lifting is the schema's, decided long before this function: every
// personal table references auth.users with `on delete cascade` — the
// profile, their collections and likes, their trips and preferences, the
// friendship edges and blocks on either side — so one delete takes all of
// it. The two exceptions are deliberate and predate this function too:
// `places.submitted_by` and `places.added_by` are `on delete set null`,
// because a café somebody added to the catalog is the catalog's now, and
// deleting your account is leaving the room, not burning the library.
//
// The avatar lives in storage rather than a table, so the cascade cannot
// reach it; it is removed here, best-effort — an orphaned jpeg must not
// be what stands between a person and their right to leave. The photos on
// their check-ins too, since 25 Nov 2026.
//
// No confirmation happens here. The server cannot know whether a tap was
// meant; the app asks twice before calling, and by the time this runs,
// asking again would be theatre. The one check that matters is identity:
// the account deleted is the one the token proves, never one named in a
// body.

import { createClient } from "npm:@supabase/supabase-js@2";
import { http } from "../_shared/http.ts";

const { CORS, json } = http();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  const uid = userData?.user?.id;
  if (!uid) return json({ error: "not signed in" }, 401);

  // Best-effort, before the account goes: afterwards nothing owns the files.
  // The face and the page's cover (docs/wall-plan.md) share the person's
  // folder; one call takes both, and a name with no file behind it is not
  // an error to Storage.
  await admin.storage.from("avatars").remove([`${uid}/avatar.jpg`, `${uid}/wall.jpg`]).catch(() => {});

  // The photos on their check-ins (docs/checkin-photos-plan.md), named by
  // their rows while the rows still exist — the cascade takes the rows,
  // and nothing could name the files after it. Best-effort for the same
  // reason as the face: a file left behind is an orphan the daily
  // `prune-checkin-photos` takes, not a reason to keep anybody.
  try {
    const { data: photos } = await admin.from("checkin_photos").select("path").eq("user_id", uid);
    const paths = ((photos ?? []) as { path: string }[]).map((p) => p.path);
    if (paths.length > 0) await admin.storage.from("checkin-photos").remove(paths);
  } catch (_) { /* see above */ }

  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
