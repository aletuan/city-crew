// Has the server ended this session, as opposed to merely not answering?
//
// ── why (owner, 23 Oct 2026) ──
//
// Signing out of the Data Desk on 23 Oct 2026 was a global sign-out —
// supabase-js's default — and ended the app's session on the phone too.
// The phone did not know. Its access token still had most of an hour to
// run, and every read that only checks the token's signature went on
// working, so Profile still wore the owner's name; only `fetch-place`,
// which asks auth whether the session exists, refused, and Search opened
// the sign-in sheet over a screen that said they were signed in. Auth's
// log that day: `GET /user` → 403 `session_not_found`.
//
// So a few answers mean the session is over and this device should sign
// out of it too. Everything else — no network, a timeout, a 500, a token
// a moment past its expiry — is not proof of that, and signing somebody
// out because the lift had no signal is worse than the bug this fixes.
//
// `refresh_token_already_used` is left out on purpose: two refreshes
// racing each other produce it while the session is fine.

/** Auth's own words for "there is no such session any more" — or none
 *  that may go on, `session_expired` being a time-boxed one that ran out. */
const GONE = new Set(['session_not_found', 'session_expired', 'user_not_found', 'refresh_token_not_found']);

export function sessionGone(e: { code?: string } | null | undefined): boolean {
  return !!e?.code && GONE.has(e.code);
}
