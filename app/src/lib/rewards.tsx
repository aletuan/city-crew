// The reader's badges and level, worked out once for the whole app, and
// what the phone has already said about them.
//
// The rules are `lib/badges` and `lib/level`. This is the part that
// needs React: it reads the shared copies of the reader's lists,
// check-ins, friends and trips, asks for the three counts nothing else
// holds, and decides when there is something to say.
//
// ── one copy, at the root ──
//
// The banner is drawn over whichever screen is up, the dot is on the tab
// bar, and the sheet is on Profile. Each would otherwise work the badges
// out for itself, and the three would disagree for as long as their
// fetches took to land.
//
// ── when it speaks ──
//
// Only once every source has answered for the account that is signed in
// now, and none is being asked again. A count that is still on its way
// reads as zero, and comparing against zero would announce a badge on
// every launch — or, on a phone meeting the account for the first time,
// write down that it holds none and then announce each as it loaded.
//
// And only once the phone has read what it remembers for that account.
// The read starts over the moment the account changes (`useStored`
// resets in render), which is also what keeps one account from being
// read with the last one's counts: a plain fetch holds its last answer
// while the next is out, but by the time the new account's record has
// been read, that fetch is marked as being asked again.
//
// ── what it costs ──
//
// Three requests a launch for somebody signed in: the places they sent
// in, and the likes and copies other people gave their lists. All three
// are the reader's own rows under rules already in the database; a
// failure is read as none and asked again when the sheet opens.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useSession } from './auth';
import {
  NO_FACTS, earnedBadges, factsFrom, noticeOf, parseTold, sameTold, seenAll, toldAfter, unseenBadges,
  type BadgeFacts, type BadgeId, type Notice, type Told,
} from './badges';
import { useMyCheckins } from './checkins';
import { useCrew } from './crew';
import { fetchApplause, fetchCopies, useFetch } from './data';
import { fetchMySubmittedPlaces } from './data/export';
import { levelFromSaves } from './level';
import { useMyTrips } from './mytrips';
import { useMyLists } from './save';
import { useStored, type Codec } from './stored';

export type Rewards = {
  facts: BadgeFacts;
  /** The badges the reader holds, in the sheet's order. */
  earned: BadgeId[];
  /** Those the sheet has not been closed on — the dot. */
  unseen: BadgeId[];
  /** What the banner says now, or null. */
  notice: Notice | null;
  /** The banner has gone. */
  dismiss: () => void;
  /** The banner was pressed, and the sheet has not opened yet. */
  wanted: boolean;
  want: () => void;
  /** The sheet opened: the ask is answered, and the counts are asked
   *  again so it is not showing a launch-old figure. */
  opened: () => void;
  /** The sheet closed: everything held has been seen. */
  closed: () => void;
};

const NOTHING: Rewards = {
  facts: NO_FACTS, earned: [], unseen: [], notice: null,
  dismiss: () => {}, wanted: false, want: () => {}, opened: () => {}, closed: () => {},
};
const Ctx = createContext<Rewards>(NOTHING);

/** Everything, ever: the two functions take a window, and a badge is
 *  about the whole of it. */
const SINCE_EVER = '1970-01-01T00:00:00Z';

type Counts = { submitted: number; likes: number; copies: number };
const NO_COUNTS: Counts = { submitted: 0, likes: 0, copies: 0 };

/** How many rows, or none if it could not be asked. */
const count = (rows: Promise<readonly unknown[]>): Promise<number> => rows.then((r) => r.length, () => 0);

async function fetchCounts(me: string): Promise<Counts> {
  const [submitted, likes, copies] = await Promise.all([
    count(fetchMySubmittedPlaces(me)), count(fetchApplause(SINCE_EVER)), count(fetchCopies(SINCE_EVER)),
  ]);
  return { submitted, likes, copies };
}

const TOLD: Codec<Told | null> = {
  parse: (raw) => parseTold(raw),
  format: (value) => JSON.stringify(value),
};

/** Per account, so the next person on this phone is told their own. */
export const toldKey = (me: string | null) => (me ? `rewards:told:${me}` : null);

/** A copy that has answered, is not being asked again, and did not fail:
 *  a list that could not be fetched is not a reader with no lists. */
const settled = (f: { loaded: boolean; loading: boolean; error: string | null }) => (
  f.loaded && !f.loading && !f.error
);

export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const { ready: authReady, session } = useSession();
  const me = authReady ? session?.user?.id ?? null : null;
  const lists = useMyLists();
  const checkins = useMyCheckins();
  const { ships } = useCrew();
  const trips = useMyTrips();
  const fetcher = useCallback(() => (me ? fetchCounts(me) : Promise.resolve(NO_COUNTS)), [me]);
  const counts = useFetch(fetcher, NO_COUNTS);
  const [told, remember, origin] = useStored<Told | null>(toldKey(me), null, TOLD);

  // Signed out there is no key, and a read with no key never ends
  // (`useStored`): `origin` says "somebody is signed in" as well.
  const ready = origin !== 'reading'
    && settled(lists) && settled(checkins) && settled(ships) && settled(trips) && settled(counts);

  const facts = useMemo(() => (me ? factsFrom({
    me,
    lists: lists.data,
    checkins: checkins.data,
    ships: ships.data,
    trips: trips.data,
    submitted: counts.data.submitted,
    likes: counts.data.likes,
    copies: counts.data.copies,
  }) : NO_FACTS), [me, lists.data, checkins.data, ships.data, trips.data, counts.data]);
  const earned = useMemo(() => earnedBadges(facts), [facts]);
  const { level } = levelFromSaves(facts.saved);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [wanted, setWanted] = useState(false);
  // Nothing said to one account is left up for the next.
  useEffect(() => { setNotice(null); setWanted(false); }, [me]);

  useEffect(() => {
    if (!ready) return;
    const next = toldAfter(told, earned, level);
    if (sameTold(told, next)) return;
    const say = noticeOf(told, earned, level);
    if (say) setNotice(say);
    remember(next);
  }, [ready, told, earned, level, remember]);

  const dismiss = useCallback(() => setNotice(null), []);
  const want = useCallback(() => setWanted(true), []);
  const { reload } = counts;
  const opened = useCallback(() => { setWanted(false); reload(); }, [reload]);
  const closed = useCallback(() => {
    if (!told) return;
    const next = seenAll(told, earned);
    if (!sameTold(told, next)) remember(next);
  }, [told, earned, remember]);

  // Not held back for `ready`: asking the counts again as the sheet
  // opens would blink every dot out and in. Held back only until the
  // phone has said what it remembers, since before that everything
  // earned looks unseen.
  const read = origin !== 'reading';
  const unseen = useMemo(() => (read ? unseenBadges(earned, told) : []), [read, earned, told]);
  const value = useMemo<Rewards>(
    () => ({ facts, earned, unseen, notice, dismiss, wanted, want, opened, closed }),
    [facts, earned, unseen, notice, dismiss, wanted, want, opened, closed],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRewards = () => useContext(Ctx);
