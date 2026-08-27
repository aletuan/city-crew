// Every invitation the reader can see, fetched once for the whole app.
//
// Three places ask the same question and would otherwise ask it three
// times: the tab bar counts what is waiting, the Trips screen draws the
// rail and splits the list, and a trip's own screen draws its crew. That
// is the shape `crew.tsx` was pulled out of, and its essay applies here
// unchanged — the number the tab bar has just drawn should not be a fetch
// the next screen repeats in front of the reader.
//
// Smaller than the crew copy in two ways, both deliberate. There is no
// launch snapshot: an invitation is a decision somebody else is waiting on
// an answer to, and painting a cached one would risk offering an answer to
// something already answered — the badge going briefly wrong at launch is
// the better failure than a stale invitation opening a screen that cannot
// act. And there is no `absorb`: the faces come from the crew copy, which
// already holds everyone a friendship touches, and an invitation can only
// ever name a friend.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import { type Fetch, fetchCrewCounts, fetchInvites, useFetch } from './data';
import { useAuth } from './auth';
import { shouldRefresh } from './stale';
import { waitingCount, type InviteRow } from './invites';

type Invitations = {
  /** Both sides of the table: rows where the reader was asked, and rows on
   *  trips they own. `lib/invites` tells them apart. */
  invites: Fetch<InviteRow[]>;
  /** Unanswered invitations addressed to the reader — the badge. */
  waiting: number;
  /** Accepted heads per trip the reader was asked onto, batched from
   *  `trip_crew_counts` the moment the invitations answer — the RPC takes
   *  an array for exactly this. Fetched here, at the list, so the detail
   *  and answer screens open already holding their number instead of
   *  asking for it in front of the reader (the flicker the owner caught:
   *  the failure sentence wearing the loading state's clothes). A missing
   *  key is still being asked; null means the batch failed for it. */
  crewCounts: Record<string, number | null>;
};

const NO_FETCH: Fetch<never[]> = {
  loading: true, loaded: false, error: null, data: [], loadedAt: null, fromCache: false, reload: () => {},
};

const Ctx = createContext<Invitations>({ invites: NO_FETCH, waiting: 0, crewCounts: {} });

export function InvitationsProvider({ children }: { children: React.ReactNode }) {
  const { ready, session } = useAuth();
  const meId = session?.user?.id ?? null;

  // Held, not answered, until auth has decided who is asking — the same
  // trap `crew.tsx` documents: "no session yet" resolving instantly to an
  // empty list would stamp `loadedAt` and make the first real answer look
  // like a refresh of a list that was never fetched.
  const fetcher = useCallback(() => {
    if (!ready) return new Promise<InviteRow[]>(() => {});
    return meId ? fetchInvites() : Promise.resolve([] as InviteRow[]);
  }, [ready, meId]);
  const invites = useFetch(fetcher, [] as InviteRow[]);

  // Coming back to the app. An invitation answered on another device, or
  // one that arrived while the phone was in a pocket, should not wait for
  // a pull nobody thinks to do — and this is the one list in the app whose
  // contents another person changes.
  const latest = useRef(invites);
  latest.current = invites;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const f = latest.current;
      if (!f.loading && shouldRefresh(f.loadedAt, Date.now())) f.reload();
    });
    return () => sub.remove();
  }, []);

  const mine = useMemo(
    () => (meId ? invites.data.filter((i) => i.invitee_id === meId) : []),
    [invites.data, meId],
  );

  // The trips the reader stands on somebody else's side of: pending rows
  // feed the answer screen's "you'd be N in all", accepted ones the
  // detail's crew row. A declined trip is unreadable and unasked.
  const askedOn = useMemo(
    () => [...new Set(mine.filter((i) => i.status !== 'declined').map((i) => i.trip_id))],
    [mine],
  );

  const [crewCounts, setCrewCounts] = useState<Record<string, number | null>>({});
  useEffect(() => {
    if (!askedOn.length) return;
    let live = true;
    fetchCrewCounts(askedOn)
      .then((m) => {
        if (!live) return;
        setCrewCounts((prev) => {
          const next = { ...prev };
          for (const id of askedOn) next[id] = m[id]?.accepted ?? 0;
          return next;
        });
      })
      .catch(() => {
        if (!live) return;
        // Only a trip that was never answered is marked failed: a number
        // already on screen outlives one failed refresh.
        setCrewCounts((prev) => {
          const next = { ...prev };
          for (const id of askedOn) if (next[id] === undefined) next[id] = null;
          return next;
        });
      });
    return () => { live = false; };
  }, [askedOn]);

  const value = useMemo<Invitations>(() => ({
    invites,
    waiting: waitingCount(mine),
    crewCounts,
  // Each field rather than the wrapper: a Fetch object is new every
  // render, so depending on it would re-render every consumer on renders
  // where nothing loaded. Same reasoning as `crew.tsx`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    invites.data, invites.loading, invites.error, invites.loadedAt,
    invites.fromCache, invites.reload, mine,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useInvitations = () => useContext(Ctx);
