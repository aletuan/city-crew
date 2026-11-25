// What the page is drawn from: the list itself, out of the three catalogs
// it can be in, its places, and the facts every part of the screen asks
// about it — yours, public, lent to you — with the pull that asks again.
// And the heart, which needs the same row.
//
// Out of `CollectionDetailScreen` on 25 Nov 2026, the fifth step of F1 in
// the 22 Nov code review. The reasoning moved with the code unchanged.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fireHaptic } from '../../components/ui';
import { useSession } from '../../lib/auth';
import { useCollections, useLikes, usePlaces } from '../../lib/catalog';
import { askCommentsAgain } from '../../lib/commentsChanged';
import {
  membersOf, unseenMembers, useCopyCountsQuery, useCountView, usePrefetchOwnListActivity,
  useSharedWithMe, type Collection,
} from '../../lib/data';
import { useMyLists, type useSaveActions } from '../../lib/save';

/** The pull's spinner: armed by the gesture, let go when `loading` is. */
function usePullSpinner(loading: boolean) {
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !loading) setPulling(false);
  }, [pulling, loading]);
  return [pulling, setPulling] as const;
}

/**
 * The three figures under the card, asked again on a pull (owner, 21 Nov
 * 2026): a pull that brought back the places but left the hearts, the
 * comments and the copies at what they were when the page opened looked
 * as if it had not reached the server. None holds the spinner; each
 * lands when it lands. The hearts' counts and your own set together
 * (`reloadLikes`), every thread's count (`askCommentsAgain`), and the
 * copies' figures, which every card on a feed shares.
 */
function useReloadFigures() {
  const { reloadLikes } = useLikes();
  const { reload: reloadCopies } = useCopyCountsQuery();
  return () => { reloadLikes(); askCommentsAgain(); reloadCopies(); };
}

export function useListPage(slug: string) {
  // `userId` keys what the phone keeps per reader (`readerKey`), and is
  // known a storage read into the launch where the session can be a
  // round trip away.
  const { session, userId } = useSession();
  const uid = session?.user?.id;
  const cols = useCollections();
  // Both catalogs, because a list of your own that is still private is in
  // neither the public query nor anywhere else: without `mine` it would
  // open on "Collection not found". The owned half comes from the shared
  // copy, so a place saved from anywhere shows here. A published list of
  // your own is now in both, and `find` takes the first — `mine`, which
  // is the fuller row.
  const mine = useMyLists();
  // And a friend's list shared with you (12 Nov 2026): private, so in
  // neither of the other two either. Its own fetch rather than the save
  // provider's — see `useSharedWithMe`.
  const shared = useSharedWithMe(uid ?? userId);
  const { data: places, loading: placesLoading, reload: placesReload } = usePlaces();
  // Shared before public: a list that is both is the same row either way,
  // and the shared copy names its owner (`fetchSharedWithMe`).
  const col = useMemo(
    () => [...mine.data, ...shared.data, ...cols.data].find((c) => c.slug === slug),
    [mine.data, shared.data, cols.data, slug],
  );
  const members = useMemo(() => (col ? membersOf(col, places) : []), [col, places]);
  // This open, counted for the list's statistics (owner, 13 Nov 2026):
  // anybody's, the owner's own and a guest's included, once for this
  // mount and not again on a pull or on the way back from a place — see
  // `useCountView`. The server keeps a number per list per day and
  // nothing about who (`legal.ts` says so), and nothing is said here if
  // the count does not land.
  useCountView(col?.id ?? null);
  const loading = cols.loading || mine.loading || shared.loading || placesLoading;
  // Pull to reload (owner, 23 Oct 2026). Until then this screen reloaded
  // only after a write of its own, so a place the desk approved, or a
  // change made to the list on another phone, waited for a trip back to
  // the Collections tab and a pull there. Every catalog, because the
  // screen is drawn from all of them: the list from `mine`, `shared` or
  // `cols`, a community list's places from `places`. A pull is also how a
  // friend's list that was unshared since goes: it leaves `shared`, and
  // the screen says the list is not found.
  //
  // The spinner belongs to the pull, as on Collections and Explore: armed
  // by the gesture, disarmed when the fetches settle, and never lit by a
  // background revalidate nobody asked to watch.
  const [pulling, setPulling] = usePullSpinner(loading);
  // And the figures under the card — see `useReloadFigures`.
  const reloadFigures = useReloadFigures();
  // Everything this hook asked for, and the spinner armed. The shares'
  // own list is asked again by the screen, beside this (`pull`): it
  // belongs to `useListVisibility`, which needs what this returns.
  const reload = () => {
    setPulling(true); cols.reload(); mine.reload(); shared.reload(); placesReload(); reloadFigures();
  };
  const owned = !!col?.owner_id && col.owner_id === uid;
  // The owner's activity, asked for here so that "View activity ›" opens
  // on it rather than on a spinner (owner, 13 Nov 2026): the round trip
  // starts with this page instead of with the tap, and the activity page
  // draws the kept answer on its first render — see the header of
  // `CollectionActivityScreen`. Your own list only, which the hook
  // decides (`usePrefetchOwnListActivity`); and nothing drawn here from
  // it, so its landing does
  // not re-render this page (`prefetchShared`). Not asked again within
  // two minutes of the last answer (`lib/stale`), so a list opened over
  // and over while it is edited costs one ask, not one per visit.
  usePrefetchOwnListActivity(uid, col);
  const isPublic = !!col?.is_public;
  /*
   * A friend's list, shared with you and not public (12 Nov 2026).
   *
   * Read off the row rather than off which query found it: every list
   * this screen can hold that is neither yours nor public came through a
   * share — the public query has only public rows and `mine` only yours —
   * so the two facts are the whole test. A list that is public and also
   * shared is simply public (the migration's own words), and offers what
   * any public list offers.
   *
   * What it changes is what the screen offers, by the owner's call the
   * day sharing shipped: you may read it and plan from it, and that is
   * all — and, since 17 Nov 2026, like it: a list shared with a group is
   * liked by the group (`shares.likeable`). No "Save a copy", at either of its doors (`canCopy`):
   * the list was lent to you to read, and the app does not offer to make
   * it yours. No Report: moderation never reaches a private list
   * (`legal.ts`, "nothing there can reach a private collection"), so the
   * row would send the desk something it has promised not to read. And
   * no Share: its sentence tells the owner where the switch to publish
   * is, which a friend does not have, and who sees the list is the
   * owner's to decide.
   */
  const sharedToMe = !!col && !owned && !isPublic;
  // What everyone else will not see of this list, counted rather than
  // asserted. Derived from the members every time the screen opens, so
  // it is right after a review lands without anything having to be told
  // — and it disappears by itself when the last one clears, which is a
  // truer signal than a message would be.
  //
  // Only the owner can compute this, and only because they are the one
  // person allowed to see their own unreviewed places. That is the same
  // permission the sentence exists to explain.
  const unseen = useMemo(() => unseenMembers(members), [members]);
  return {
    uid, userId, cols, mine, col, members, loading, pulling, reload, owned, isPublic, sharedToMe, unseen,
  };
}

/** The heart on the card's foot: whether it is lit, the tally, the tap. */
export function useListHeart({ col, uid, askToSignIn }: {
  col: Collection | null | undefined;
  uid: string | undefined;
  askToSignIn: ReturnType<typeof useSaveActions>['askToSignIn'];
}) {
  // Liking needs three things and refuses without any of them: an account
  // to attribute the like to, the row's id — the likes table keys on it,
  // not on the slug everything user-facing uses — and a list that is
  // public, since a private one has no shelf to be ordered on. A list no
  // longer public still shows the likes it kept, as a figure (`keptHeart`).
  const { likes, myLikes, toggleLike } = useLikes();
  const liked = !!col?.id && myLikes.includes(col.id);
  // The write, the refetch, and the in-flight guard all live on the
  // provider now — a like taken from the shelf has to show here too, and
  // a copy of this per screen could not do that. What is left here is the
  // haptic, which is the one part that belongs to the tap rather than to
  // the fact.
  const onHeart = useCallback(() => {
    // Signed out the heart is an invitation rather than a dead control —
    // the same answer Explore's shelf gives to the same tap. It used to
    // not be drawn at all here, which was defensible while it was a 44pt
    // button in the header; in the byline it sits beside a tally everyone
    // can see, and a heart drawn next to a number the reader cannot join
    // has to do something when pressed.
    if (!uid) { askToSignIn('like'); return; }
    if (!col?.id) return;
    fireHaptic('light');
    void toggleLike({ id: col.id, slug: col.slug });
  }, [uid, askToSignIn, col?.id, col?.slug, toggleLike]);
  return { liked, likes, onHeart };
}
