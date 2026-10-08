// The number the profile's Activity row wears: how many likes and
// copies the feed holds right now — the same two reads the feed makes,
// over the same window, so the row and the screen behind it agree.
//
// A total, like the friends row's and the check-ins row's, and not
// "unseen". The first cut counted what had landed since the feed was
// last opened, which is what a badge on an inbox usually means — and
// read as nothing at all the moment the feed had been opened once,
// beside two rows whose numbers never go away. One shape, one meaning:
// the number on a row is the size of what is behind it.
//
// Asked on every focus of the profile, not once: a like can land while
// the reader is away on another tab, and a number that only ever read
// its mount would be stale by the afternoon.

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { windowStart } from './activityWindow';
import { fetchApplause, fetchCopies } from './data';
import { buildActivity } from './friends';

export function useActivityCount(me: string | null): number {
  const [n, setN] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!me) { setN(0); return undefined; }
    let live = true;
    const since = windowStart(new Date());
    Promise.all([
      fetchApplause(since).catch(() => []),
      fetchCopies(since).catch(() => []),
    ]).then(([applause, copies]) => {
      if (live) setN(buildActivity(applause, copies).length);
    });
    return () => { live = false; };
  }, [me]));
  return n;
}
