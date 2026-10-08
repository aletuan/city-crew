// The React half of `activityFresh.ts`: the number the profile's
// Activity row wears, and the mark the feed leaves when opened.

import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { activitySeenKey, countFresh, freshSince } from './activityFresh';
import { fetchApplause, fetchCopies } from './data';
import { buildActivity } from './friends';

/** The feed was just opened: remember when. Best effort — a mark that
 *  fails to write means one more look at a number already seen. */
export async function markActivitySeen(uid: string, now: Date = new Date()): Promise<void> {
  await AsyncStorage.setItem(activitySeenKey(uid), now.toISOString()).catch(() => {});
}

/**
 * How many likes and copies landed since the feed was last opened.
 *
 * Asked on every focus of the screen that draws it, not once: the feed
 * is a screen pushed on top of the profile, and coming back from it is
 * exactly when the number has to read zero. Two small reads — the same
 * two the feed makes, from the last look rather than the window's start
 * — and a guest is answered zero off the network.
 */
export function useActivityFresh(me: string | null): number {
  const [n, setN] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!me) { setN(0); return undefined; }
    let live = true;
    (async () => {
      const seen = await AsyncStorage.getItem(activitySeenKey(me)).catch(() => null);
      const since = freshSince(seen, new Date());
      const [applause, copies] = await Promise.all([
        fetchApplause(since).catch(() => []),
        fetchCopies(since).catch(() => []),
      ]);
      if (!live) return;
      setN(countFresh(buildActivity(applause, copies), seen));
    })();
    return () => { live = false; };
  }, [me]));
  return n;
}
