// Two ways a screen of other people's news is made current: when it comes
// into view, and when the reader pulls it down.
//
// ── why the trip screens needed them (owner, 21 Nov 2026) ──
//
// Whether a friend has said yes is the one thing on a trip that somebody
// else changes. The invitations provider refreshed it only when the phone
// came back from the background after two minutes (`shouldRefresh`), so an
// owner who stayed in the app watched "waiting" on a face whose answer had
// landed, until they left the app and came back. The Trips tab reloaded
// the trips on every focus and never the invitations, and neither the tab
// nor a trip's own page could be pulled. This is the shape the Crew and
// Activity pages already had, written once.
//
// ── every focus reloads, even one already out ──
//
// `TripsScreen` reloaded the trips this way before this file existed, and
// its note stands: the first focus of a session is exactly the moment
// after saving the session's first trip, in another tab, and a skip for
// "just mounted" left that trip missing. A reload keeps showing what is on
// screen while it runs, so the second request costs nothing the reader
// sees. (`CrewScreen` guards its own, because its edges drop an answer on
// its way when a reload starts over — #353; a plain `useFetch` does not.)
//
// ── the spinner belongs to the pull ──
//
// Armed by the gesture, disarmed when everything it waited on has settled,
// and never lit by a focus reload or the provider's return-to-app refresh:
// the same rule as the collection page's, so a screen that reloads in the
// background does not look as though the reader asked. A fetch already in
// flight is left alone and waited for, rather than started over.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/** What a pull needs of a fetch: whether one is out, and a way to ask. */
export type Reloadable = { loading: boolean; reload: () => void };

/** Reload each of these every time the screen comes into focus. */
export function useFocusReload(fetches: readonly Reloadable[]): void {
  const latest = useRef(fetches);
  latest.current = fetches;
  useFocusEffect(useCallback(() => {
    for (const f of latest.current) f.reload();
  }, []));
}

/** `RefreshControl`'s two props, for a pull that reloads all of these. */
export function usePull(fetches: readonly Reloadable[]): { pulling: boolean; pull: () => void } {
  const busy = fetches.some((f) => f.loading);
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !busy) setPulling(false);
  }, [pulling, busy]);
  const pull = () => {
    setPulling(true);
    for (const f of fetches) if (!f.loading) f.reload();
  };
  return { pulling, pull };
}

/**
 * Both at once, as the control a `ScrollView` takes: the screen says what
 * to read on focus and what to read on a pull, and gets the spinner back.
 * One call, because a screen that is already near its size ceiling
 * (`oversize.js`) cannot afford three lines for a refresh.
 */
export function useKeepCurrent(onFocus: readonly Reloadable[], onPull: readonly Reloadable[]) {
  useFocusReload(onFocus);
  const { pulling, pull } = usePull(onPull);
  return <RefreshControl refreshing={pulling} onRefresh={pull} />;
}
