// The crew — who you are tied to, the faces behind the ids, and the
// shared-taste numbers — fetched once for the whole app.
//
// Four places asked these questions separately: the tab bar counted the
// waiting requests, Profile counted the friends, Activity fetched the
// askers, and the Crew screen fetched all of it again — so the number
// Profile had just drawn was the answer Crew then spent seconds
// re-deriving in front of the reader, grey circles first. Same shape as
// the catalog, and the same cure: one copy, above the navigators, with
// the launch-cache trick the places query already uses — paint the last
// session's crew instantly, revalidate behind it.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Fetch, fetchFriendships, fetchMutualSaves, fetchMyBlocks, fetchProfilesById,
  usePersistedFetch, type FriendProfile,
} from './data';
import { CACHE_CATALOG, cacheKey, packCache, unpackCache } from './data/cache';
import { splitFriendships, type FriendshipRow } from './friends';
import { useAuth } from './auth';
import { shouldRefresh } from './stale';

type CrewData = {
  /** Every friendship edge that touches you, in every state. */
  ships: Fetch<FriendshipRow[]>;
  /** The account ids you have blocked. */
  blocks: Fetch<string[]>;
  /** Faces and names by account id, for everyone the edges mention. */
  people: Record<string, FriendProfile>;
  /** Shared-taste counts by friend id — the number the crew rows wear. */
  mutual: Record<string, number>;
  /**
   * Take in profiles a screen fetched for its own reasons — the
   * suggestion list, a handle search — so the next screen already has
   * the face. Merged over what is here, and carried into the snapshot.
   */
  absorb: (more: Record<string, FriendProfile>) => void;
};

const NO_FETCH: Fetch<never[]> = {
  loading: true, loaded: false, error: null, data: [], loadedAt: null, fromCache: false, reload: () => {},
};

const EMPTY: CrewData = {
  ships: NO_FETCH, blocks: NO_FETCH, people: {}, mutual: {}, absorb: () => {},
};

const Ctx = createContext<CrewData>(EMPTY);

export function CrewProvider({ children }: { children: React.ReactNode }) {
  const { ready, session } = useAuth();
  const meId = session?.user?.id ?? null;

  // Held, not answered, until auth has decided who is asking. The places
  // query never needs this because its signed-out fetch still crosses
  // the network and loses the race to the cache read — but "no session
  // yet" here would resolve to an empty crew instantly, stamp `loadedAt`,
  // and lock the snapshot out on the one launch it exists for.
  const shipsFetcher = useCallback(() => {
    if (!ready) return new Promise<FriendshipRow[]>(() => {});
    return meId ? fetchFriendships() : Promise.resolve([] as FriendshipRow[]);
  }, [ready, meId]);
  const ships = usePersistedFetch(
    CACHE_CATALOG && ready && meId ? cacheKey('friendships', 'all', meId) : null,
    shipsFetcher,
    [] as FriendshipRow[],
  );

  const blocksFetcher = useCallback(() => {
    if (!ready) return new Promise<string[]>(() => {});
    return meId ? fetchMyBlocks() : Promise.resolve([] as string[]);
  }, [ready, meId]);
  // Plain fetch, no snapshot: the list is tiny, nothing draws it at
  // launch, and the blocked screen can wait a round trip.
  const blocks = usePersistedFetch(null, blocksFetcher, [] as string[]);

  // ── the faces, and their snapshot ──
  //
  // `usePersistedFetch` holds one answer to one question; this map is an
  // accumulation — edges, suggestions, searches all pour in — so the
  // snapshot is kept by hand under the same envelope rules the cache
  // module already enforces. Stored as a `[people, mutual]` pair because
  // `unpackCache` trusts only lists.
  const facesKey = CACHE_CATALOG && ready && meId ? cacheKey('crewfaces', 'all', meId) : null;
  const [people, setPeople] = useState<Record<string, FriendProfile>>({});
  const [mutual, setMutual] = useState<Record<string, number>>({});
  // Mirrors, because the writes happen inside promise callbacks that
  // would otherwise close over a stale render's state.
  const peopleRef = useRef(people);
  const mutualRef = useRef(mutual);
  // True once any network answer has landed; the snapshot applies only
  // before — a fresh answer always wins, however slow the disk is.
  const freshFaces = useRef(false);
  const facesKeyRef = useRef(facesKey);
  facesKeyRef.current = facesKey;

  const save = useCallback(() => {
    if (facesKeyRef.current) {
      AsyncStorage.setItem(
        facesKeyRef.current,
        packCache([peopleRef.current, mutualRef.current], Date.now()),
      ).catch(() => {});
    }
  }, []);

  const absorb = useCallback((more: Record<string, FriendProfile>) => {
    if (!Object.keys(more).length) return;
    freshFaces.current = true;
    peopleRef.current = { ...peopleRef.current, ...more };
    setPeople(peopleRef.current);
    save();
  }, [save]);

  useEffect(() => {
    if (!facesKey) return;
    let live = true;
    AsyncStorage.getItem(facesKey)
      .then((raw) => {
        if (!live || freshFaces.current) return;
        const hit = unpackCache<[Record<string, FriendProfile>, Record<string, number>]>(raw, Date.now());
        if (!hit || hit.data.length !== 2) return;
        const [p, m] = hit.data;
        if (typeof p !== 'object' || p === null || typeof m !== 'object' || m === null) return;
        // Under, not over: anything already absorbed this session is
        // newer than the disk.
        peopleRef.current = { ...p, ...peopleRef.current };
        mutualRef.current = { ...m, ...mutualRef.current };
        setPeople(peopleRef.current);
        setMutual(mutualRef.current);
      })
      .catch(() => { /* an unreadable snapshot is no snapshot */ });
    return () => { live = false; };
  }, [facesKey]);

  // Fresh edges bring fresh faces. The hydrated pass is skipped — the
  // snapshot painted the faces that go with the cached edges, and the
  // real landing right behind it refreshes both.
  //
  // And only edges that actually CHANGED bring them: the Crew screen
  // recounts on every visit now, and a recount that comes back identical
  // used to re-run this whole wave anyway — faces, mutual saves, two
  // more setStates — settling the rows in front of the reader for
  // nothing (the flicker #353 first cured, resurrected by the recount).
  // The fingerprint makes the comment below literally true: the stamps
  // fire the effect, the ids decide whether there is anything to do.
  const lookedUp = useRef('');
  useEffect(() => {
    if (ships.loadedAt === null || ships.fromCache) return;
    const split = splitFriendships(ships.data, meId ?? '');
    const ids = [
      ...split.friends,
      ...split.incoming.map((r) => r.requester),
      ...split.outgoing.map((r) => r.addressee),
      ...blocks.data,
    ];
    const fingerprint = [...ids].sort().join(',');
    if (fingerprint === lookedUp.current) return;
    lookedUp.current = fingerprint;
    if (ids.length) fetchProfilesById(ids).then(absorb).catch(() => {});
    if (split.friends.length) {
      fetchMutualSaves(split.friends)
        .then((m) => { mutualRef.current = m; setMutual(m); save(); })
        .catch(() => {});
    }
  // The two loadedAt stamps are when there is something new to look up.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ships.loadedAt, blocks.loadedAt]);

  // Signing out takes the crew with it — the faces belong to the session,
  // and the reset re-arms hydration for whoever signs in next.
  useEffect(() => {
    if (ready && !meId) {
      freshFaces.current = false;
      lookedUp.current = '';
      peopleRef.current = {};
      mutualRef.current = {};
      setPeople({});
      setMutual({});
    }
  }, [ready, meId]);

  // Coming back to the app — same shape and same threshold as the
  // catalog: a request accepted on another device while the phone was in
  // a pocket should not wait for a pull nobody thinks to do.
  const latest = useRef({ ships, blocks });
  latest.current = { ships, blocks };
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const now = Date.now();
      for (const f of [latest.current.ships, latest.current.blocks]) {
        if (!f.loading && shouldRefresh(f.loadedAt, now)) f.reload();
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<CrewData>(() => ({
    ships, blocks, people, mutual, absorb,
  // Each field, not each wrapper: a Fetch object is new every render, so
  // depending on it would rebuild the context value — and re-render every
  // consumer — on renders where nothing loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    ships.data, ships.loading, ships.error, ships.loadedAt, ships.fromCache, ships.reload,
    blocks.data, blocks.loading, blocks.error, blocks.loadedAt, blocks.reload,
    people, mutual, absorb,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCrew = () => useContext(Ctx);
