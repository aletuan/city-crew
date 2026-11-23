import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent, Pressable, Text, useWindowDimensions, View,
} from 'react-native';
import { Glyph, ICON } from '../components/ui/glyph';
import { KindPills } from '../components/KindPill';
import {
  AmbientWarmth, Empty, Screen,
  fireHaptic, useTabBarClearance,
} from '../components/ui';
import { useEdgeSwipeBack, useListDrag } from '../components/useListDrag';
import { useDuckOnScroll, useTabBarDucked } from '../components/tabBarDuck';
import { DockOffer, DockSlot, useDockOffer } from '../components/DockSlot';
import { AddCell, AddPill } from '../components/add';
import { useProfile, useSession } from '../lib/auth';
import { categoriesOf } from '../lib/categories';
import { narrowTo } from '../lib/collectionKinds';
import { useCollections, useCuratorAvatar, useLikes, usePlaces } from '../lib/catalog';
import { askCommentsAgain } from '../lib/commentsChanged';
import {
  membersOf, unseenMembers, useCopyCountsQuery, useCountView, usePrefetchOwnListActivity,
  useProfileByHandle, useSharedWithMe,
} from '../lib/data';
import ShareSheet from '../components/ShareSheet';
import { normalizeHandle } from '../lib/handle';
import { useCurrentCity } from '../lib/city';
import { useReport } from '../components/reportFlow';
import ActionSheet, { SheetRows } from '../components/ActionSheet';
import { useMyLists, useSaveActions } from '../lib/save';
import { readerKey, COLLECTION_VIEW_KEY } from '../lib/readerPrefs';
import { oneOf, useStored } from '../lib/stored';
import { useNoteEvent } from '../lib/tasteProfile';
import { useI18n } from '../lib/i18n';
import { colors, space } from '../theme';
import type { Place } from '../lib/types';
import { goTo, type Nav, type RootRoute } from '../nav';
import { DraggableCard, DraggableTile, LiftCell, LiftedCard, StillCard, StillTile } from './collectionDetail/cells';
import { OwnEmpty } from './collectionDetail/OwnEmpty';
import { sendRows, ShareHead } from './collectionDetail/Share';
import { GRID_GAP, s } from './collectionDetail/styles';
import { useKindFilter } from './collectionDetail/useKindFilter';
import { useReorderDraft } from './collectionDetail/useReorderDraft';
import { useListVisibility } from './collectionDetail/useListVisibility';
import { useCopyRemove } from './collectionDetail/useCopyRemove';
import { useListMenu } from './collectionDetail/useListMenu';
import { ListCurator, ListFoot, ListHead, ownTagOf } from './collectionDetail/head';


/**
 * A card's pitch before it has reported its size: a 16:10 photograph the
 * width of a phone, the two lines under it, and the gap below. Only ever
 * used for the first frame, or on a platform that does not report layout.
 * After that each card's own height is used, gap included (the card's
 * `marginBottom` sits inside the view that is measured).
 */
const PITCH_GUESS = 320;

/**
 * The two ways a list is looked at: the cards, or a grid of three to a row
 * (owner, 22 Oct 2026; `PlaceTile` says what a tile keeps and drops).
 *
 * One choice for every list, kept on the phone as Collections keeps its
 * tile/row choice (`citycrew.collections.view`): how a reader likes to
 * look at a list is theirs, not the list's, and a choice made per list
 * would be forty-five choices to make.
 *
 * The grid is the default (owner, the same day, once a tile could be
 * dragged and the list scrolled under it): a list is mostly photographs,
 * and the grid shows a list of twenty at a glance. A reader who chose the
 * cards before that keeps them — the default stands in only where nobody
 * has chosen.
 *
 * Kept per reader, not per phone (`readerKey`, owner, 22 Oct 2026): a
 * second account on the same phone opened on the first one's cards.
 */
const LIST_OR_GRID = oneOf('list', 'grid');

/** Tiles to a row. Three, the reference's and every photo app's: at 393pt
 *  a tile is 111pt, which still carries a name in 12pt across most of it. */
const GRID_COLUMNS = 3;
/** The grid's first cell on your own list, which holds "Add place" rather
 *  than a place. Not a slug: slugs never carry a "+". */
const ADD_CELL = '+add' as const;


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

export default function CollectionDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'CollectionDetail'> }) {
  const { t } = useI18n();
  // `userId` keys what the phone keeps per reader (`readerKey`), and is
  // known a storage read into the launch where the session can be a
  // round trip away.
  const { session, userId } = useSession();
  const { profile } = useProfile();
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
  const { askToSignIn } = useSaveActions();
  // Reporting, raised from the overflow menu — see components/reportFlow.
  const { report, canReport, node: reportSheet } = useReport();
  const { data: places, loading: placesLoading, reload: placesReload } = usePlaces();
  const { city } = useCurrentCity();
  // Liking needs three things and refuses without any of them: an account
  // to attribute the like to, the row's id — the likes table keys on it,
  // not on the slug everything user-facing uses — and a list that is
  // public, since a private one has no shelf to be ordered on. A list no
  // longer public still shows the likes it kept, as a figure (`keptHeart`).
  const { likes, myLikes, toggleLike } = useLikes();
  // Shared before public: a list that is both is the same row either way,
  // and the shared copy names its owner (`fetchSharedWithMe`).
  const col = useMemo(
    () => [...mine.data, ...shared.data, ...cols.data].find((c) => c.slug === route.params.slug),
    [mine.data, shared.data, cols.data, route.params.slug],
  );
  const members = useMemo(() => (col ? membersOf(col, places) : []), [col, places]);
  // This open, counted for the list's statistics (owner, 13 Nov 2026):
  // anybody's, the owner's own and a guest's included, once for this
  // mount and not again on a pull or on the way back from a place — see
  // `useCountView`. The server keeps a number per list per day and
  // nothing about who (`legal.ts` says so), and nothing is said here if
  // the count does not land.
  useCountView(col?.id ?? null);
  const note = useNoteEvent();
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
  const pull = () => {
    setPulling(true); cols.reload(); mine.reload(); shared.reload(); placesReload(); listShares.reload(); reloadFigures();
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
  // Who sees the list, and the three ways of changing it: the word under
  // your handle, the sheet it opens, the friends picker and the writes
  // behind all three. `useListVisibility` (23 Nov 2026, the first step of
  // F1 in the code review): it was a quarter of this function.
  const {
    listShares, sharedWith, seen, seenWord, people, friendIds, blocks,
    publishing, picking, setPicking, saveShares, whoSees, setWhoSees, whoSees3,
  } = useListVisibility({
    col, uid, owned, isPublic, mine, cols, unseen, navigation, t, arrived: route.params.seen,
  });
  /**
   * The curator's face, for a list somebody else made.
   *
   * `normalizeHandle` before the lookup, and it is not belt-and-braces:
   * `profileByHandle` matches with `ilike`, and the editorial rows were
   * seeded with the `@` written into the value — `@hanoicrew` — so the
   * raw column would find nothing and find it silently. `lib/handle`
   * states the rule this follows: never trust the stored form.
   *
   * Null for your own list, which is not an optimisation but the correct
   * answer: the byline below says nothing about you either, and asking
   * would spend a request to be told what `useAuth` already holds.
   *
   * Nothing here has a failure state to draw. A handle with no profile
   * behind it is the normal case, not an error — every editorial list is
   * one, their handles living in `reserved_handles` with no `profiles`
   * row anywhere — and a request that fails leaves the byline exactly as
   * it reads today. So the face is the only thing conditional on this,
   * and it simply does not appear.
   */
  const curatorHandle = !owned && col?.curator_handle
    ? normalizeHandle(col.curator_handle) || null
    : null;
  /*
   * The shelf already fetched this, so the common path spends no request
   * at all and the face is there on the first paint. The lookup stays for
   * the cold one — a deep link into a list whose shelf has not loaded —
   * and is skipped entirely when the map already answered.
   */
  const cachedAvatar = useCuratorAvatar(curatorHandle);
  const lookup = useProfileByHandle(cachedAvatar ? null : curatorHandle);
  const curatorAvatar = cachedAvatar ?? (lookup.data?.avatar_url || null);
  /*
   * Whether the byline holds a place for a face.
   *
   * While the answer is still coming, yes — so the line is laid out once
   * and the face lands in a slot that was already there, rather than
   * pushing the handle sideways as it arrives. Once the lookup has come
   * back empty, no: an editorial handle has no person behind it, and a
   * permanent grey disc there would be the screen inventing one.
   */
  const holdForFace = !!curatorAvatar || (!!curatorHandle && !cachedAvatar && lookup.loading);
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
  const tabClearance = useTabBarClearance();
  // The same scroll etiquette the tab home screens keep: reading down a
  // long list tucks the bar away, the first pull back up recalls it. A
  // collection with thirty places is as much a reading surface as the
  // Explore feed, and it was the one long list where the bar refused to
  // move. Navigation still surfaces the bar on arrival (FloatingTabBar
  // keys on the nav state), so this can only ever hide it mid-read.
  const duckScroll = useDuckOnScroll();

  const title = col ? t(col.title_en, col.title_vi, col.title_ja) : '';
  const desc = col ? t(col.desc_en, col.desc_vi, col.desc_ja) : '';
  // The list's chips and the one the reader has narrowed to: `useKindFilter`.
  const { kinds, filters, chosen, narrowed, pick, kept, setPicked } = useKindFilter(members);
  /* ── the count, at the end of the kinds' row (owner, 13 Nov 2026) ──
     How many places, beside what kinds they are: the two say what is in
     the list, so they share a row, the count fixed at its right edge and
     the kinds wrapping in the column to its left — a fourth kind goes to
     a second line under the first, never under the count. One place for
     the figure, for the owner and a visitor alike: it had been the foot's
     on somebody else's list and the "Add place" cell's corner on yours,
     and the foot is now the activity row, the heart and, on your own
     list, the way to its activity (`activity`).

     The list's whole count, whatever a chip has narrowed it to: the grid
     shows what the chip kept, and the line under the row says "4 of 11"
     while one is chosen. Its box is a pill's box — the same rule, clear,
     when the kinds are a filter — so the figure sits on the first line's
     baseline by construction rather than by a guessed offset.

     Its pin and figure, never the word (owner, 31 Oct 2026); a screen
     reader hears the word. On a list with no places there is no count:
     "Nothing here yet" is the card's whole answer.

     A faint upright hairline before the pin, while there are kinds
     beside it (owner, 13 Nov 2026). The kinds say what is in the list
     and, with two or more, are a filter; the figure counts and is not
     pressed. Air alone left the figure reading as one more kind once the
     kinds reached across the row. The rule is a place card's own
     separator ("4.5 ★ | $$ | 1.2 km"), not the "·" this card uses to
     join two of a kind ("12/11 · Private", "4 of 11 · Clear"), which
     would have made the count one more item of the kinds. Inside the
     count's own box, so it centres on the count's line — the kinds'
     first — however many lines the kinds wrap to; and not drawn when
     the count stands alone, with nothing to be told apart from. */
  const placesWord = t(members.length === 1 ? 'place' : 'places', 'địa điểm', 'スポット', '个地点', '個地點');
  const placeCount = members.length > 0 ? (
    <View
      style={[s.placeCount, filters && s.placeCountRule]}
      accessible
      accessibilityLabel={`${members.length} ${placesWord}`}
      testID="collection-count"
    >
      {kinds.length > 0 ? <View style={s.countRule} testID="collection-count-rule" /> : null}
      <Glyph name="location-outline" size={ICON.meta} color={colors.textTertiary} />
      <Text style={s.placeCountText}>{members.length}</Text>
    </View>
  ) : null;
  const kindRow = kinds.length > 0 || placeCount ? (
    <View style={s.kindsBlock}>
      <View style={s.kindsLine}>
        <View style={s.kindsLeft}>
          {kinds.length > 0 ? (
            <KindPills
              kinds={kinds}
              chosen={chosen}
              onPick={filters ? pick : undefined}
              bare
              testID="collection-kinds"
            />
          ) : null}
        </View>
        {placeCount}
      </View>
      {narrowed ? (
        <View style={s.filterCount}>
          <Text style={s.filterCountText} testID="collection-filter-count">
            {t(
              `${kept} of ${members.length} places`,
              `${kept} trên ${members.length} địa điểm`,
              `${members.length}件中${kept}件`,
              `${members.length} 个地点中的 ${kept} 个`, `${members.length} 個地點中的 ${kept} 個`,
            )}
          </Text>
          <Text style={s.filterCountText}>·</Text>
          <Pressable
            onPress={() => setPicked([])}
            hitSlop={12}
            accessibilityRole="button"
            testID="collection-filter-clear"
          >
            <Text style={s.filterClear}>{t('Clear', 'Bỏ lọc', '解除', '清除', '清除')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  ) : null;
  // Whether the ⋯'s sheet is up — see `menuSheet`.
  const [menu, setMenu] = useState(false);
  const [view, pickView] = useStored<'list' | 'grid'>(
    readerKey(COLLECTION_VIEW_KEY, userId), 'grid', LIST_OR_GRID,
  );
  const grid = view === 'grid';


  // Putting the list in order: the order on screen, the write a beat
  // after the last move, and the move itself are `useReorderDraft`.
  const { drafted, shuffle } = useReorderDraft({ col, members, mine, cols, t });

  // The places on screen: the whole list, or the kinds chosen on the
  // card (see "the chips are the filter").
  const shown = narrowed ? narrowTo(drafted, chosen) : drafted;

  // Only your own list, and only one with an order to change: a single
  // place has none, and a card that lifts to go nowhere is a gesture
  // that seems broken. Not while narrowed: a move among the places on
  // screen would be a move among places the reader cannot see, and the
  // list's real order is the one that saves.
  const canArrange = owned && drafted.length > 1 && !narrowed;
  // A tile dragged right is not a way back — see `useEdgeSwipeBack`.
  useEdgeSwipeBack(navigation, canArrange);
  const { width: winW } = useWindowDimensions();
  const tile = Math.floor((winW - space.page * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

  // ── the card in the finger ──
  //
  // The hold, the drag and the drop are `useListDrag`'s, shared with the
  // plan editor; landing calls `shuffle`, the same move VoiceOver's
  // actions make, and saves the same way. The pitch guess is a 16:10
  // photograph the width of a phone, the two lines under it, and the gap
  // below — only ever used for the first frame.
  //
  // On the grid the same hook drags tiles: a cell is a tile and the gap
  // after it, across and down alike, since the rows are spaced by the gap
  // the tiles are.
  //
  // Near either end of the list the list scrolls itself under the held
  // card (owner, 22 Oct 2026), so a card can reach a place off screen in
  // one drag. The foot's edge starts at the floating bar's top, which lies
  // over the list's last few points.
  //
  // On your own list the grid's first cell is "Add place" (below), so the
  // tiles stand one cell on from their place in the order: `lead`.
  const adding = owned && members.length > 0;
  const lead = grid && adding ? 1 : 0;
  const listRef = useRef<FlatList<Place | typeof ADD_CELL>>(null);
  const barCovers = useTabBarClearance(0);
  const { lift, panHandlers, onLift, onRelease, onPitch, styleOf, areaRef, onScrolled, onContentSizeChange } = useListDrag({
    keys: drafted.map((p) => p.slug),
    onMove: shuffle,
    pitchGuess: PITCH_GUESS,
    grid: grid ? { cols: GRID_COLUMNS, pitch: tile + GRID_GAP, lead } : null,
    scroll: {
      to: (offset) => listRef.current?.scrollToOffset({ offset, animated: false }),
      coveredBelow: barCovers,
    },
  });

  // ── drawn again only when it moved ──
  //
  // The screen draws again on a save anywhere (it reads your lists), on
  // every slot a held card passes, and on a chip; each card used to be
  // handed a fresh open and a fresh up and down every time, so every card
  // drew again to show what it already showed (owner, 30 Oct 2026). The
  // cards are behind `memo` now and handed these, which hold still: a
  // step reads the order through `latest`, so a card not drawn since the
  // last move still moves the place where it stands now.
  const latest = useRef(shuffle);
  useEffect(() => { latest.current = shuffle; });
  const openPlace = useCallback((slug: string) => navigation.navigate('PlaceDetail', { slug }), [navigation]);
  const step = useCallback((index: number, by: -1 | 1) => latest.current(index, index + by), []);

  // Saving a copy of a list and deleting your own: `useCopyRemove`, the
  // second step of F1 (23 Nov 2026). `copy` opens three doors — the ⋯,
  // the dock, the activity row — and `canCopy` says whether they show.
  const { canCopy, copy, remove } = useCopyRemove({
    col, uid, tabCityId: city?.id, sharedToMe, members, title, mine, cols, note, askToSignIn, navigation, t,
  });






  /* ── the list's two actions: the dock, and the menu ──
     (owner, 16 Oct 2026). Planning a trip from the list is what a reader
     does with it once read, owner or not; adding a place is the owner's
     everyday edit. Both were out of reach: Plan at the very end of the
     list, under every photograph, and Add only in the ⋯ menu.

     For a build they also ended the intro card. The owner took them out
     again the same evening: the card introduces the list — whose it is,
     what it is, how it is doing — and a pair of buttons there made it a
     toolbar. So the two live where a reader is when they want them:

     - In the dock, once the card has scrolled away and the tab bar has
       ducked — `DockSlot`, the slot Explore lends "Not finding it?" — in
       thumb reach however deep the list goes.
     - In the ⋯ menu, always: Add place as before, and Plan a trip beside
       it. That row is not a second door for its own sake. A list of two
       or three places is too short to scroll, so the bar never ducks and
       the dock never comes; without the row, Plan would be on no screen
       at all for a short list.

     Plan only once there is a list to plan from: an empty one seeds
     nothing, and its own card is already asking for the first place.
     The planner decides the city (see IdeasScreen's `from`); `at` makes a
     second press on the same list a new ask. The paw is the planner's own
     mark. Add, until the in-place picker exists, goes to Explore, where
     saving a place already offers this list by name.

     ── the dock, as Explore's (owner, 17 Oct 2026) ──
     The two docks are one design now. Explore's says what it offers in a
     glyph and two lines, the whole island answering to that, and the
     gradient "+ Địa điểm" at its right end. Here the sentence is the
     plan — the paw, "Lên kế hoạch", and what it is for — and the pill is
     the second act: "+ Địa điểm" for the owner, "Lưu bản sao" for a
     visitor, so there is always one gradient pill, at the right,
     whoever is reading.

     It undoes a call of 16 Oct, and says why. Plan was the gradient and
     Add the quiet glass beside it, on the reading that the gradient
     belongs to what the list exists for; as a sentence that fills the
     island, Plan is no smaller than it was, and the owner wanted one
     dock to learn, not two.

     The pill's word is the noun on both docks (owner, 17 Oct 2026).
     The first cut said "Thêm", Explore's word then; beside a sentence
     about planning, "Thêm" alone read as "add to the plan", and the
     owner moved both docks to "+ Địa điểm" rather than let them differ.
     The glyph says add; the word says what. VoiceOver hears the whole
     "Thêm địa điểm", which is what the ⋯ menu's row says too.

     Explore's pill became "+ Tạo mới" on 25 Oct 2026, the word for a
     pill that makes something. This one stays the noun: it puts a place
     the catalog already has into the list, and "Tạo mới" beside "Lên kế
     hoạch" would read as "a new plan".

     A list with no city has no copy to offer (see the ⋯ menu), and a
     friend's list shared with you offers none (`sharedToMe`), so a
     visitor's dock there is the sentence alone. */
  const plan = () => {
    if (!col) return;
    goTo('Ideas', { screen: 'IdeasHome', params: { from: col.slug, at: Date.now() } });
  };
  const canPlan = !!col && members.length > 0;
  // The ⋯'s sheet: its rows, the two views, and the presses only it and
  // the card make (Add place, Edit). `useListMenu`, the second step of F1.
  const { viewRows, addPlace, edit, actsBefore, actsAfter, commentsSetting } = useListMenu({
    col, owned, sharedToMe, grid, pickView, title, desc, navigation, t,
    canPlan, plan, canCopy, copy, remove, canReport, report,
  });
  // Where the card ends in the list's content, measured, so the dock waits
  // until it has actually gone rather than guessing from a row count.
  const cardEnd = useRef(Number.POSITIVE_INFINITY);
  const [pastCard, setPastCard] = useState(false);
  const pastRef = useRef(false);
  const onListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    duckScroll?.(e);
    onScrolled(e.nativeEvent);
    const past = e.nativeEvent.contentOffset.y > cardEnd.current;
    if (past !== pastRef.current) {
      pastRef.current = past;
      setPastCard(past);
    }
  };
  const ducked = useTabBarDucked();
  // Not while a card is held: the dock would rise under the finger.
  const dock = useDockOffer(canPlan && ducked && pastCard && !lift, navigation);

  /* ── the description, in a card ──
      It was bare grey body text under the header, and read as one
      more line of the header. The owner's review (15 Oct 2026) put it
      in a card on `surfaceCard` — the surface the place screen's
      address card and its "City Crew chọn" card already wear, so it
      follows the look chosen in Profile and adds no colour of its
      own. Not the accent as a surface: that is for state the reader
      just made (`theme.ts`), and a description is not one.

      ── the corner (owner, 13 Nov 2026) ──
      From 15 Oct the owner's corner held a pencil that opened the same
      form as the menu's "Edit collection", and from 27 Oct a visitor's
      held "Save a copy" — each a second door to a row of the menu, on
      the card it was about. The ⋯ has the corner now (`more`), and the
      rows are the one door to each: a pencil or a copy beside the ⋯
      would have been two controls in one corner for acts the ⋯ already
      holds.

      ── the note glyph (owner, 15 Oct 2026) ──
      On somebody else's list nothing said whose words these were, and
      the card could read as the app's own copy. The page with lines
      says "a note", which is the one fact it adds. 20pt in
      `textSecondary`, the card's one secondary ink. The curator's face
      took its place on 16 Oct; it stays only on your own list with no
      handle yet.

      ── the face, the foot (owner, 16 Oct 2026) ──
      On somebody else's list the curator's face and handle now lead
      the card where the note glyph was (see `curatorRow`), and every
      card ends in a foot with the place count and the heart, both
      moved down from the header. So the card is drawn on every list, a
      visitor's included. Your own list leads with your own face (see
      `ownTag`); the note glyph returns only without a handle. Since
      13 Nov 2026 the count is at the end of the kinds' row, and the
      foot is the activity row (`activity`), drawn on every card.

      An owner's list with no description still invites one: the line
      opens the form.

      Checked on the text `t` picks, not on a hand-listed pair of
      columns: that left a Japanese-only description never drawn.

      ── the chips (owner, 15 Oct 2026) ──
      Under the words, in the same card, because they answer the same
      question — what is this list — and one form edits both. They
      are every kind the places carry, most places first
      (`lib/collectionKinds`), drawn as `KindPill` — the
      pill a place's card and page wear, a dot in the category's
      colour and its word. They are also the list's filter (see "the
      chips are the filter"), lit in the accent while chosen. */
  /* ── in the list, not over it (owner, 16 Oct 2026) ──
     The card scrolls away with the places now. Held above the list it
     kept a sixth of the screen — a third with a long note — for words
     read once on arrival, and every place card paid for it. The title
     stays in the header, so the reader never loses which list this is.
     The chips go with it: you filter first and then read, and a filter
     row pinned over the places would be the same tax again. */
  /* ── "Add place" in the list (owner, 22 Oct 2026) ──
     From the owner's two mockups: in the grid the first cell, dashed, a
     tile among tiles; in the list a dashed row over the first card. Adding
     a place is the owner's everyday edit, and until now it lived in the ⋯
     menu and in the dock — which only rises once the card has scrolled
     away. Here it is where the places are, on arrival.

     First, not last. A list of twenty would put the last cell seven rows
     down, and the reader who wants to add has just opened the list. It
     leaves with the card as the list scrolls, which is about when the
     dock's "+ Địa điểm" comes up: the one offer hands over to the other.

     Only on your own list, and not on an empty one: there the card
     under the header already hands you the way (`OwnEmpty`), and two
     offers of one act read as two acts. While a filter narrows the list
     it stays: the place you add is added whatever is shown. It goes
     where the ⋯ menu's row and the dock's pill go, `addPlace`. */
  // The list's count rode the cell from 2 Nov; since 13 Nov it is on the
  // card, at the end of the kinds' row — see `kindRow`.
  const addCell = (size?: number) => (
    <AddCell
      label={t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點')}
      onPress={addPlace}
      size={size}
      testID="collection-add-cell"
    />
  );
  const introCard = (
    <ListHead
      col={col} owned={owned} ownTag={owned ? ownTagOf(profile) : ''} desc={desc}
      members={members} from={route.params.from} onEdit={edit} onMore={() => setMenu(true)}
      onCoverChanged={() => { mine.reload(); if (col?.is_public) cols.reload(); }}
      kinds={kindRow}
      curator={(
        <ListCurator
          col={col} owned={owned} profile={profile} curatorAvatar={curatorAvatar} holdForFace={holdForFace}
          found={!!lookup.data} seen={seen} seenWord={seenWord} onWhoSees={() => setWhoSees(true)} navigation={navigation}
        />
      )}
      foot={(
        <ListFoot
          col={col} uid={uid} owned={owned} isPublic={isPublic} sharedCount={sharedWith.length} liked={liked}
          likes={likes} onHeart={onHeart} title={title} canCopy={canCopy} copy={copy} seen={seen}
          onWhoSees={() => setWhoSees(true)} navigation={navigation}
        />
      )}
    />
  );

  const menuSheet = (
    <>
      <SheetRows actions={actsBefore} onClose={() => setMenu(false)} />
      <Text style={s.menuSection} accessibilityRole="header">
        {t('View', 'Chế độ xem', '表示', '视图', '檢視')}
      </Text>
      <SheetRows actions={viewRows} onClose={() => setMenu(false)} />
      <SheetRows actions={actsAfter} onClose={() => setMenu(false)} />
    </>
  );

  return (
    <Screen
      title={title}
      onBack={() => navigation.goBack()}
      backTestID="collection-back"
      backBare compactTitle
    >
      <AmbientWarmth />
      {loading && members.length === 0 && <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />}
      {!loading && !col && <Empty text={t('Collection not found.', 'Không tìm thấy bộ sưu tập.', 'コレクションが見つかりません。', '找不到这个合集。', '找不到這個合集。')} />}
      {/* On the grid a cell of the list is a row of tiles, so it is the
          lifted tile's row that is raised. */}
      <LiftedCard.Provider value={lift ? (grid ? Math.floor((lift.from + lead) / GRID_COLUMNS) : lift.from) : -1}>
        <View ref={areaRef} style={s.dragArea} testID="collection-drag-area" {...panHandlers}>
          <FlatList
            ref={listRef}
            data={lead ? [ADD_CELL, ...shown] : shown}
            keyExtractor={(p) => (p === ADD_CELL ? ADD_CELL : p.slug)}
            // A list cannot change its columns once drawn, so each view is
            // a list of its own.
            key={view}
            numColumns={grid ? GRID_COLUMNS : 1}
            columnWrapperStyle={grid ? s.gridRow : undefined}
            // Held still while a card is in the finger: the drag and the scroll
            // would otherwise both answer the same drag.
            scrollEnabled={!lift}
            onRefresh={pull}
            refreshing={pulling}
            CellRendererComponent={LiftCell}
            onScroll={onListScroll}
            onContentSizeChange={onContentSizeChange}
            scrollEventThrottle={16}
            renderItem={({ item, index: at }) => {
              if (item === ADD_CELL) return addCell(tile);
              const index = at - lead;
              if (grid) {
                return canArrange
                  ? (
                    <DraggableTile
                      place={item}
                      index={index}
                      count={drafted.length}
                      size={tile}
                      style={styleOf(index)}
                      onOpen={openPlace}
                      onStep={step}
                      onLift={onLift}
                      onRelease={onRelease}
                    />
                  )
                  : <StillTile place={item} index={index} size={tile} onOpen={openPlace} />;
              }
              return canArrange
                ? (
                  <DraggableCard
                    place={item}
                    index={index}
                    count={drafted.length}
                    style={styleOf(index)}
                    onOpen={openPlace}
                    onStep={step}
                    onLift={onLift}
                    onRelease={onRelease}
                    onPitch={onPitch}
                  />
                )
                // By position, mine or not, so a smoke flow opens the first
                // place whichever card shape the list is drawn with.
                // Narrowed, the card names the chosen kind it answers to —
                // the first of them in the card's order — as the pin and
                // card do under a chip on Explore.
                : (
                  <StillCard
                    place={item}
                    index={index}
                    onOpen={openPlace}
                    chip={narrowed ? kinds.find((k) => chosen.includes(k) && categoriesOf(item).includes(k)) : null}
                  />
                );
            }}
            ListEmptyComponent={!loading && col
              ? (owned
                // One message, not two. The reference stacks "No places in this
                // collection yet." above a card that says the same thing again.
                ? <OwnEmpty onAdd={addPlace} />
                : <Empty text={t(
                  'No places in this collection yet.',
                  'Bộ sưu tập này chưa có địa điểm nào.',
                  'このコレクションにはまだスポットがありません。',
                  '这个合集里还没有地点。', '這個合集裡還沒有地點。',
                )} />)
              : undefined}
            ListHeaderComponent={introCard || (adding && !grid) ? (
              <>
                {introCard && (
                  <View
                    testID="collection-intro"
                    onLayout={(e) => {
                      const { y, height } = e.nativeEvent.layout;
                      cardEnd.current = y + height;
                    }}
                  >
                    {introCard}
                  </View>
                )}
                {adding && !grid && addCell()}
              </>
            ) : undefined}
            ListHeaderComponentStyle={s.headerAbove}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: tabClearance }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </LiftedCard.Provider>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        header={<Text style={s.sheetTitle} numberOfLines={2} accessibilityRole="header">{title}</Text>}
      >
        {menuSheet}
      </ActionSheet>
      <DockSlot visible={dock} onPress={plan} accessibilityRole="button" testID="collection-dock">
        <DockOffer
          icon="paw"
          title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')}
          // Short enough for one line beside the widest pill. "Dùng danh
          // sách này cho chuyến đi" was cut to "…cho ch…" beside "Lưu bản
          // sao" on the owner's phone (17 Oct 2026): about 23 characters
          // fit there, fewer on a 375pt screen. "Danh sách này" was the
          // part the screen already says.
          sub={t('Use it for a trip', 'Dùng cho chuyến đi', '旅の計画に使う', '用于规划行程', '用於規劃行程')}
        />
        {owned ? (
          <AddPill
            label={t('Place', 'Địa điểm', 'スポット', '地点', '地點')}
            accessibilityLabel={t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點')}
            onPress={addPlace}
            testID="collection-dock-add"
          />
        ) : canCopy ? (
          <AddPill
            icon="copy-outline"
            label={t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')}
            onPress={copy}
            testID="collection-dock-copy"
          />
        ) : null}
      </DockSlot>
      {reportSheet}
      {col && owned ? (
        <ShareSheet
          open={picking}
          isPublic={isPublic}
          friendIds={friendIds}
          blocked={blocks.data}
          people={people}
          shared={sharedWith}
          sending={publishing}
          onClose={() => setPicking(false)}
          onSave={(add, remove) => saveShares(col, add, remove)}
          history={listShares.data}
        />
      ) : null}
      <ActionSheet
        visible={whoSees}
        onClose={() => setWhoSees(false)}
        header={<ShareHead />}
      >
        <SheetRows actions={whoSees3} onClose={() => setWhoSees(false)} />
        <SheetRows actions={sendRows(t)} onClose={() => setWhoSees(false)} />
      </ActionSheet>
      {commentsSetting.node}
    </Screen>
  );
}
