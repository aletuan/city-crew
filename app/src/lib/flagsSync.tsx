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
// theme, not for this. But a switch that arrives a beat after the cards
// is not fine where it changes what a card is (owner, 25 Nov 2026: a
// person's page took its check-ins in at the top a moment after opening,
// and a visit's photo arrived after the place's cover). So the last
// answer is kept on the phone, put on as the app opens, and replaced by
// the table's when that lands (`Flags.restore`). A switch that never
// arrives leaves the app as it last was, or as it shipped on a first
// launch.
//
// Renders nothing, as `ReminderSync` does; mounted once, under the auth
// provider it reads.

import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from './auth';
import { appFlags } from './flags';
import { supabase } from './supabase';

/** Where the last answer is kept. Versioned in its name: a later shape
 *  is a new key, and the old one is simply never read. */
export const FLAGS_KEY = 'citycrew.flags.v1';

export function FlagsSync() {
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  useEffect(() => {
    AsyncStorage.getItem(FLAGS_KEY)
      .then((raw) => { if (raw) appFlags.restore(JSON.parse(raw)); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    void appFlags.load(supabase, me !== null).then((applied) => {
      if (applied) AsyncStorage.setItem(FLAGS_KEY, JSON.stringify(appFlags.snapshot())).catch(() => {});
    });
  }, [me]);
  return null;
}
