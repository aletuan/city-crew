// Ejecting an account — the sharp end of a report.
//
// The store's rule about user content asks for two things when
// something offensive is reported: remove the content, and remove the
// person who posted it "where warranted". The desk can do the first
// with the tools it already has (unpublish a collection, clear a
// profile field). This is the second, and it needs the service role,
// because banning an account is an auth-schema act no RLS policy can
// grant.
//
// POST { user_id, suspend: true | false } → { ok: true }
//
// Editors only: the caller's token is read, their email checked against
// the editors table — the same gate `is_editor()` applies inside the
// database, restated here because a service-role function has no RLS
// standing over it.
//
// A ban rather than a delete. Deleting would take the person's own
// collections and trips with them and leave the report pointing at
// nothing; a ban stops them signing in while their rows stay where the
// desk can still read them. And it is reversible, which matters: the
// desk is people, and people misjudge.
//
// Every ban and every lift is written to `moderation_log`, and no editor
// can ban another; see the notes where each is done.
//
// A ban hides every check-in photo of the account, and a lift puts back
// what the ban hid (K5 of docs/checkin-photos-plan.md): a photo is the
// one thing of theirs other people see without the account signing in
// again, and the store's rule is to remove the person "where warranted",
// not to leave their pictures up. Collections stay, as above — the desk
// hides one of those on its own when it has to. What the desk hid for
// itself stays hidden through a lift (`checkin_photos_suspended`).
//
// POST … → { ok: true, suspended, photos } — how many photos moved.

import { createClient } from "npm:@supabase/supabase-js@2";
import { http } from "../_shared/http.ts";
import { callerOf } from "../_shared/gate.ts";

const { CORS, json } = http();

/** A hundred years, which is what Supabase's API takes for "until we
 *  say otherwise" — there is no unbounded ban, so this is the idiom. */
const FOREVER = "876000h";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const caller = await callerOf(admin, req);
  if (!caller) return json({ error: "not signed in" }, 401);
  const { uid, email } = caller;
  if (!caller.editor) return json({ error: `${email} is not on the editors list` }, 403);

  const body = await req.json().catch(() => ({}));
  const target = String(body.user_id ?? "");
  if (!target) return json({ error: "user_id required" }, 400);
  // The desk cannot lock itself out with a mistyped id.
  if (target === uid) return json({ error: "cannot suspend yourself" }, 400);

  const suspend = body.suspend !== false;

  const { data: targetData, error: lookupError } = await admin.auth.admin.getUserById(target);
  if (lookupError || !targetData?.user) return json({ error: "no such account" }, 404);
  const targetEmail = targetData.user.email?.toLowerCase() ?? "";

  // One editor cannot lock another out. The desk's power is over readers'
  // accounts; a dispute between editors is not something one of them
  // should be able to settle by pressing a button. Lifting a ban stays
  // open, so a ban made before this rule can still be undone.
  if (suspend && targetEmail) {
    const { data: targetIsEditor } = await admin
      .from("editors").select("email").eq("email", targetEmail).maybeSingle();
    if (targetIsEditor) return json({ error: "cannot suspend an editor" }, 403);
  }

  // Written down first, then done. A ban nobody can trace is the failure
  // this record exists to prevent, so the line goes in before the act; if
  // the act then fails, the line comes out again. Should that removal fail
  // too, the log shows one attempt too many — the safe direction to be
  // wrong in. See the moderation_log migration.
  const { data: line, error: logError } = await admin
    .from("moderation_log")
    .insert({
      actor: uid,
      actor_email: email,
      action: suspend ? "suspend" : "unsuspend",
      target_id: target,
      detail: { target_email: targetEmail },
    })
    .select("id")
    .single();
  if (logError || !line) return json({ error: "could not record the action; nothing was changed" }, 500);

  const { error } = await admin.auth.admin.updateUserById(target, {
    ban_duration: suspend ? FOREVER : "none",
  });
  if (error) {
    await admin.from("moderation_log").delete().eq("id", (line as { id: number }).id);
    return json({ error: error.message }, 500);
  }

  // After the ban, not before: a photo hidden for a ban that then failed
  // would be a punishment nobody recorded. A failure here leaves the ban
  // in place and says so — pressing the button again does both again.
  const { data: photos, error: photoError } = await admin.rpc("checkin_photos_suspended", {
    p_user: target, p_hide: suspend, p_by: uid,
  });
  if (photoError) {
    return json({
      error: suspend
        ? `suspended, but the check-in photos were not hidden: ${photoError.message}`
        : `restored, but the check-in photos were not put back: ${photoError.message}`,
    }, 500);
  }

  return json({ ok: true, suspended: suspend, photos: typeof photos === "number" ? photos : 0 });
});
