// The one request the sign-up form makes before anybody has an account:
// GoTrue's public settings, read for `mailer_autoconfirm`.
//
// The read lives here and its meaning next door, as `export.ts` splits
// with `data/export.ts`: `lib/signup.ts` decides what the answer is worth
// to the progress bar and turns every failure into "unknown". It sat in
// that file until 20 Oct 2026, when lint began holding `lib/*.ts` to not
// importing `./supabase` — for the address and the key, which the client
// library has no method to ask this question with.
//
// The response is returned untouched, rejection and all.
//
// Not re-exported from `index.ts`, like `export.ts`: its caller is a
// `lib/*.ts`, and the barrel carries the React hooks it must not load.

import { supabaseAnonKey, supabaseUrl } from '../supabase';

/** `GET /auth/v1/settings`, with the publishable key and nothing else. */
export function fetchAuthSettings(): Promise<Response> {
  return fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabaseAnonKey },
  });
}
