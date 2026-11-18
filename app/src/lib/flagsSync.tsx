// The launch's switches, read again whenever who is signed in changes.
//
// `lib/flags.ts` has the why of the switches and of the ones that are on
// for one account alone. This is the when: once as the app opens — as
// nobody, or as whoever the phone remembers — and again on every sign
// in and sign out, because the answer is now a fact about the reader. A
// tester who signs out stops seeing what was theirs to test, and one who
// signs in sees it without relaunching.
//
// Not awaited by anything: the first frame is held for fonts and the
// theme, not for this, and a switch that arrives a beat after the cards
// do is fine. A switch that never arrives leaves the app as it shipped.
//
// Renders nothing, as `ReminderSync` does; mounted once, under the auth
// provider it reads.

import { useEffect } from 'react';
import { useSession } from './auth';
import { appFlags } from './flags';
import { supabase } from './supabase';

export function FlagsSync() {
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  useEffect(() => { void appFlags.load(supabase, me !== null); }, [me]);
  return null;
}
