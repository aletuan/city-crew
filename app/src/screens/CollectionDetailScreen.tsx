import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, useWindowDimensions, View } from 'react-native';
import {
  AmbientWarmth, Empty, Screen,
  fireHaptic, useTabBarClearance,
} from '../components/ui';
import { useEdgeSwipeBack, useListDrag } from '../components/useListDrag';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { AddCell } from '../components/add';
import { useProfile, useSession } from '../lib/auth';
import { narrowTo } from '../lib/collectionKinds';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { askCommentsAgain } from '../lib/commentsChanged';
import {
  membersOf, unseenMembers, useCopyCountsQuery, useCountView, usePrefetchOwnListActivity,
  useSharedWithMe,
} from '../lib/data';
import ShareSheet from '../components/ShareSheet';
import { useCurrentCity } from '../lib/city';
import { useReport } from '../components/reportFlow';
import { useMyLists, useSaveActions } from '../lib/save';
import { readerKey, COLLECTION_VIEW_KEY } from '../lib/readerPrefs';
import { oneOf, useStored } from '../lib/stored';
import { useNoteEvent } from '../lib/tasteProfile';
import { useI18n } from '../lib/i18n';
import { colors, space } from '../theme';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';
import { LiftCell, LiftedCard } from './collectionDetail/cells';
import { GRID_GAP, s } from './collectionDetail/styles';
import { useKindFilter } from './collectionDetail/useKindFilter';
import { useReorderDraft } from './collectionDetail/useReorderDraft';
import { useListVisibility } from './collectionDetail/useListVisibility';
import { useCopyRemove } from './collectionDetail/useCopyRemove';
import { useListMenu } from './collectionDetail/useListMenu';
import { ListCurator, ListFoot, ListHead, ownTagOf } from './collectionDetail/head';
import { chipFor, KindRow, ListDock, ListEmpty, MenuSheet, placeCell, WhoSeesSheet } from './collectionDetail/body';
import { useCuratorFace } from './collectionDetail/useCuratorFace';
import { usePlanDock } from './collectionDetail/usePlanDock';


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
  // The curator's face, for a list somebody else made: `useCuratorFace`.
  const { curatorAvatar, holdForFace, found } = useCuratorFace(owned, col);
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
  // The kinds, the count, and "4 of 11 · Clear" under them: `KindRow`.
  const kindRow = (
    <KindRow
      members={members} kinds={kinds} filters={filters} chosen={chosen}
      narrowed={narrowed} pick={pick} kept={kept} setPicked={setPicked}
    />
  );
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






  // Planning a trip from the list, and the dock that offers it once the
  // card has scrolled away: `usePlanDock`, which has the argument.
  const { plan, canPlan, dock, onListScroll, onCardLayout } = usePlanDock({
    col, members, navigation, duckScroll, onScrolled, lift,
  });
  // The ⋯'s sheet: its rows, the two views, and the presses only it and
  // the card make (Add place, Edit). `useListMenu`, the second step of F1.
  const { viewRows, addPlace, edit, actsBefore, actsAfter, commentsSetting } = useListMenu({
    col, owned, sharedToMe, grid, pickView, title, desc, navigation, t,
    canPlan, plan, canCopy, copy, remove, canReport, report,
  });

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
          found={found} seen={seen} seenWord={seenWord} onWhoSees={() => setWhoSees(true)} navigation={navigation}
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
            renderItem={({ item, index: at }) => (item === ADD_CELL ? addCell(tile) : placeCell({
              item, index: at - lead, grid, canArrange, count: drafted.length, tile, styleOf,
              openPlace, step, onLift, onRelease, onPitch, chip: narrowed ? chipFor(item, kinds, chosen) : null,
            }))}
            ListEmptyComponent={!loading && col ? <ListEmpty owned={owned} onAdd={addPlace} /> : undefined}
            ListHeaderComponent={introCard || (adding && !grid) ? (
              <>
                {introCard && (
                  <View
                    testID="collection-intro"
                    onLayout={onCardLayout}
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

      <MenuSheet
        title={title} menu={menu} setMenu={setMenu} actsBefore={actsBefore} viewRows={viewRows} actsAfter={actsAfter}
      />
      <ListDock dock={dock} plan={plan} owned={owned} canCopy={canCopy} addPlace={addPlace} copy={copy} />
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
      <WhoSeesSheet whoSees={whoSees} setWhoSees={setWhoSees} whoSees3={whoSees3} />
      {commentsSetting.node}
    </Screen>
  );
}
