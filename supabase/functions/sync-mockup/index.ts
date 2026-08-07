// "Sync mockup" from the phone: dispatches the repo's sync-mockup.yml
// GitHub Actions workflow, which exports the snapshot from the database,
// re-injects the mockup HTML, and commits the result.
//
// Secrets (Edge Function settings):
//   GH_PAT   — fine-grained GitHub token, Actions: read & write on the repo
//   GH_REPO  — optional, defaults to aletuan/city-crew
//
// Callers must be signed in AND on the public.editors allow-list.
// (Optional: without this function, the same workflow can be run by hand
// from the GitHub mobile app — Actions → Sync mockup → Run workflow.)

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const pat = Deno.env.get("GH_PAT");
  if (!pat) return json({ error: "GH_PAT secret is not set" }, 500);
  const repo = Deno.env.get("GH_REPO") ?? "aletuan/city-crew";

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase();
  if (!email) return json({ error: "not signed in" }, 401);
  const { data: editor } = await admin
    .from("editors").select("email").eq("email", email).maybeSingle();
  if (!editor) return json({ error: `${email} is not on the editors list` }, 403);

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/sync-mockup.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "citycrew-sync",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (res.status !== 204) {
    return json({ error: `GitHub dispatch failed (${res.status}): ${await res.text()}` }, 502);
  }
  return json({ ok: true, message: "Sync workflow started — the mockup commit lands in ~1 minute" });
});
