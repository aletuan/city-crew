// The two trace tables a preview build writes to — see docs/tracing.md.
//
// The inserts moved here from `tracereport.ts` and `decktrace.ts` on
// 20 Oct 2026, when lint began holding `lib/*.ts` to not importing the
// Supabase client. Both files still decide what a row says and whether it
// is sent at all; this only sends it.
//
// The reply is returned as supabase-js gave it. What a refusal means —
// a rejection that the reporter swallows, one attempt per launch or per
// visit — is the reporters' to decide, and is written down beside them.
//
// Not re-exported from `index.ts`, like `export.ts`: its callers are
// `lib/*.ts`, and the barrel carries the React hooks they must not load.

import type { TablesInsert } from '../database.types';
import { supabase } from '../supabase';

/** One launch's waterfall. */
export async function insertStartupTrace(row: TablesInsert<'startup_traces'>) {
  return supabase.from('startup_traces').insert(row);
}

/** One visit to the sketching deck. */
export async function insertDeckTrace(row: TablesInsert<'deck_traces'>) {
  return supabase.from('deck_traces').insert(row);
}
