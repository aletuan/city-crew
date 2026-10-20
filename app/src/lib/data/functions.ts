// The two Edge Functions the app calls by name, and nothing else.
//
// `fetch-place` (Google search, suggestion, reverse geocoding) and
// `plan-assist` (Claude reading a sentence, Claude narrating a plan) were
// called from `suggest.ts`, `findplace.ts` and `assist.ts` directly until
// 20 Oct 2026, which put the Supabase client inside the pure half of
// `lib/`. Lint now holds `lib/*.ts` to not importing it, so the call
// itself lives here and everything around it stays where it was.
//
// Deliberately dumber than its neighbours: the reply comes back exactly as
// supabase-js gave it — `{ data, error }`, or a throw when the request
// never left the phone. Every caller reads that reply differently, and
// that reading is the logic: `searchPlaces` turns a 401 into
// `SignedOutError` by reading `error.context`, `findSpots` turns the same
// throw into an empty list, `narrate` into a plan with no lines of its
// own. A wrapper that threw on `error`, the way the table writes here do,
// would have flattened the one field the first of those needs.
//
// Not re-exported from `index.ts`, like `export.ts`: its callers are
// `lib/*.ts`, and the barrel carries the React hooks they must not load.

import { supabase } from '../supabase';

/** `fetch-place`, with the body its `action` asks for. */
export function invokeFetchPlace(body: Record<string, unknown>) {
  return supabase.functions.invoke('fetch-place', { body });
}

/** `plan-assist`, with the body its `action` asks for. */
export function invokePlanAssist(body: Record<string, unknown>) {
  return supabase.functions.invoke('plan-assist', { body });
}
