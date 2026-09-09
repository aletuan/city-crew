// Who may run a batch job.
//
// The desk functions check one thing: a signed-in session whose email is
// on the `editors` allow-list. The batch jobs — `rehost-photos`,
// `shrink-photos` — need a second door, because the caller that drives
// them is the database itself: a `pg_net` loop carries no session. It
// carries the `ops_tokens` row named for the job in an `x-ops-token`
// header instead — a secret only the service role can read, minted for
// the run and deleted after it. See the `ops_tokens` migration.
//
// One function so the two jobs cannot drift on what "allowed" means.

/** True when the request carries a live ops token for `tokenName`, or
 *  an editor's session. */
export async function opsOrEditor(admin: any, req: Request, tokenName: string): Promise<boolean> {
  const opsToken = req.headers.get("x-ops-token");
  if (opsToken) {
    const { data: row } = await admin.from("ops_tokens")
      .select("token, expires_at").eq("name", tokenName).maybeSingle();
    return !!row && row.token === opsToken && new Date(row.expires_at) > new Date();
  }
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(jwt);
  const email = userData?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: editor } = await admin.from("editors").select("email").eq("email", email).maybeSingle();
  return !!editor;
}
