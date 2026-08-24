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

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  const uid = userData?.user?.id;
  const email = userData?.user?.email?.toLowerCase();
  if (!uid || !email) return json({ error: "not signed in" }, 401);
  const { data: editor } = await admin
    .from("editors").select("email").eq("email", email).maybeSingle();
  if (!editor) return json({ error: `${email} is not on the editors list` }, 403);

  const body = await req.json().catch(() => ({}));
  const target = String(body.user_id ?? "");
  if (!target) return json({ error: "user_id required" }, 400);
  // The desk cannot lock itself out with a mistyped id.
  if (target === uid) return json({ error: "cannot suspend yourself" }, 400);

  const suspend = body.suspend !== false;
  const { error } = await admin.auth.admin.updateUserById(target, {
    ban_duration: suspend ? FOREVER : "none",
  });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, suspended: suspend });
});
