// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  AmbientWarmth,
  Screen,
  useTabBarClearance,
} from '../components/ui';
import { useTabBarDucked } from '../components/tabBarDuck';
import { useDockOffer } from '../components/DockSlot';
import { useSession } from '../lib/auth';
import { useCityList, useCurrentCity } from '../lib/city';
import { cityShortById } from '../lib/cityName';
import ActionSheet from '../components/ActionSheet';
import { membersOf, useMyListShares, useSharedWithMe } from '../lib/data';
import { sharesByList } from '../lib/shares';
import { useCollections, usePlaces } from '../lib/catalog';
import { useListRank } from '../lib/tasteProfile';
import { oneOf, useStored } from '../lib/stored';
import { useMyLists } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { classifyLoadFail } from '../lib/loadfail';
import { LoadFailBanner, LoadFailEmpty } from '../components/loadFail';
import { space } from '../theme';
import type { Nav } from '../nav';
import { GuestNotice } from './collections/empties';
import { PinnedBar, ShelfDock, ShelfSkeleton } from './collections/chrome';
import { CityHead, JumpRows, SharedHead } from './collections/cityHeads';
import { type ListRow, type Section, ShelfFoot, ShelfRowView } from './collections/rows';
import { ShelfTop, type ShelfHead } from './collections/header';
import { useShelfSearch } from './collections/useShelfSearch';
import { useShelfScroll } from './collections/useShelfScroll';
import { useShelfKit } from './collections/useShelfKit';
import { useCityJump, useShelfSections } from './collections/useShelfSections';
import { useShelfSift } from './collections/useShelfSift';
import { useShelfTab } from './collections/useShelfTab';
import { s } from './collections/styles';


/** Yours keeps its two layouts; Community adds the editorial Mosaic. */
// Community's two looks, Mosaic first (owner, 5 Nov 2026). The list view
// went on 7 Nov 2026, from both tabs: Yours is the grid alone, with no
// switch, and a phone that remembered 'row' falls back to Mosaic here.
const COMMUNITY_VIEWS = oneOf('tile', 'mosaic');

/**
 * A row's key — and a section's, because the list asks for both.
 *
 * With `onViewableItemsChanged` set, React Native's VirtualizedSectionList
 * runs every token it reports through `_convertViewable`, which calls this
 * extractor on the token's item. For a section's heading or footer that
 * item is the section itself, not a row (`_getItem` returns the section
 * for those two indices). The first build read `row.c.slug` on it and
 * threw on the list's first report — the heading of the first block is
 * always in view — and the app froze on opening this tab, the tab bar
 * included (6 Nov 2026). Measured on the simulator with flow 21: red on
 * every build carrying the city tracker, green with only this guard
 * added, its log showing the throw "on a section" and never on a row.
 * vitest never saw it: jsdom has no layout, so the list never reports.
 */
const rowKey = (row: ListRow | Section): string => {
  // What the key says does not matter — the list keys its own cells; this
  // one only labels the token handed back — only that it is a string.
  if ('data' in row) return `section:${row.city?.id}`;
  return row.kind === 'mosaic' ? `mosaic-${row.items[0].c.slug}` : row.pair[0].slug;
};

const COMMUNITY_VIEW_KEY = 'citycrew.collections.community.view';

/** The name the simulator flows wait on: everything fetched, nothing in
 *  flight, and no launch-cache copy standing in for the catalog. */
const READY_TESTID = 'collections-ready';
const readyID = (cols: ReturnType<typeof useCollections>, placesLoaded: boolean, placesLoading: boolean) =>
  (cols.loaded && !cols.loading && !cols.fromCache && !cols.error && placesLoaded && !placesLoading ? READY_TESTID : undefined);

/** The dock, once the tab bar has ducked and the reader is past the
 *  header — but not while the panel is up (the box it would focus is
 *  already open), while the shelf is still loading, or while the whole
 *  header has come back down over the shelf. */
const dockWanted = (o: { ducked: boolean; deep: boolean; panel: boolean; holding: boolean; pinned: boolean; headerExpanded: boolean }) =>
  o.ducked && o.deep && !o.panel && !o.holding && !(o.pinned && o.headerExpanded);

/**
 * The last row of your own section: a slot rather than a thing.
 *
 * It sits at the end of the list because that is where you are looking
 * when you have just decided the list is missing something — the same
 * moment, and now the same row, as the one under Explore's places.
 */

export default function CollectionsScreen({ navigation, route }: {
  navigation: Nav;
  route: { params?: { tab?: 'yours' | 'community'; at?: number } };
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id;
  const { cities } = useCityList();
  const { city: here } = useCurrentCity();
  const cols = useCollections();
  const colsFail = classifyLoadFail(cols.error);
  // A failed read with nothing under it is the body; with a shelf in hand
  // it is a banner above the shelf (see the body below). The kind, when
  // it is the body; null when the shelf stands.
  const failedEmpty = colsFail && cols.data.length === 0 ? colsFail : null;
  // Shared with the save sheet — see SaveProvider. Reading it here through
  // its own hook is what let the two disagree.
  const mine = useMyLists();
  // Friends' lists shared with the reader (12 Nov 2026), drawn on Yours
  // under their own heading, after the reader's own — see `sections`.
  const shared = useSharedWithMe(me);
  // And who each list of yours is shared with (13 Nov 2026), for the one
  // mark a shared tile wears: one read for all your lists, the read a
  // list's page makes too (`useMyListShares`), filed by list here.
  const myShares = useMyListShares(me);
  const sharesOf = useMemo(() => sharesByList(myShares.data), [myShares.data]);
  // The order of a Community shelf at rest (owner, 14 Nov 2026;
  // `docs/collection-ranking.md`). Yours keeps its own order, and an
  // asked shelf keeps the answer's.
  const rank = useListRank();
  const { data: places, loading: placesLoading, loaded: placesLoaded, reload: placesReload } = usePlaces();
  const tabClearance = useTabBarClearance();
  const {
    scrollRef, toTop, tabsYRef, topHRef, tabsHRef, pinned, headerExpanded,
    atKey, setAtKey, jumpOpen, setJumpOpen, deep, onShelfScroll,
  } = useShelfScroll<ListRow, Section>();
  const ducked = useTabBarDucked();
  // Counting and filtering need the places catalog — until it's in, hold
  // the skeleton rather than showing raw DB membership numbers.
  //
  // "In" means `loaded`, not `!loading` — the same distinction `mineReady`
  // below spells out, and it stopped being decorative when the catalog
  // started hydrating from the launch cache: hydrated data arrives with
  // its background refresh still in flight.
  const holding = !cols.loaded || !placesLoaded;
  const loading = cols.loading || placesLoading;
  // The pull spinner belongs to the pull — same rule and same repair as
  // the Explore list beside this one. `loading` also covers the launch
  // cache's background pass and the return-to-app revalidate, neither of
  // which is anybody's pull; the old `!fromCache` guard silenced only
  // the first. Armed by the gesture, disarmed when the fetch settles.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !loading) setPulling(false);
  }, [pulling, loading]);

  // Reload on return: creating a collection happens on another screen, and
  // without this you would come back to the list you left. Every focus
  // reloads, including the first — Collections is not the launch tab, so
  // the first time it is ever focused in a session can just as easily be
  // right after creating the session's first list elsewhere as it can be
  // an ordinary visit, and there is no way to tell those apart from here.
  // See TripsScreen for the full argument; the fix that came from it.
  //
  // The lists shared with you as well: a friend shares one from their
  // phone, and coming back to the tab is when you would look for it.
  //
  // And who your lists are shared with: a page of one of them is where
  // that changes, and coming back here from it is when the tile should
  // say so.
  useFocusEffect(useCallback(() => {
    mine.reload();
    shared.reload();
    myShares.reload();
  // The reloads are stable; each `Fetch` is a new object on every load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.reload, shared.reload, myShares.reload]));

  const cityName = useCallback(
    (id: string | null | undefined) => cityShortById(cities, id, t) ?? (id ?? ''),
    [cities, t],
  );

  // A public collection with nothing at all is a dead end, so it stays
  // hidden. Your own are not: an empty one is new — `mine` is not
  // filtered by it.
  //
  // ── every city, as Yours is (owner, 15 Oct 2026) ──
  //
  // This shelf was scoped to the app's city, Yours to none, and nothing
  // on the screen said the two differed until a subtitle did. The owner
  // asked for Community to show every city by default, as Yours does: a
  // reader in Saigon planning a week in Hanoi is the reader most in need
  // of Hanoi's lists, and the city chip still narrows to one. The
  // members come embedded whole (`withMembers`), so a list from another
  // city has its places and its cover without that city's catalog.
  //
  // Your own published lists are on this shelf too, as everyone sees
  // them. They were filtered out here (a list under both tabs reads as
  // two lists), and the owner's review (14 Oct 2026) found what that
  // cost: on Hội An the one public list was the owner's, so Community
  // read "0 collections · Hội An" and the empty card promised that a
  // list set to Public "shows up here" — which, under that filter, it
  // never would. The two tabs answer two questions, "what do I keep" and
  // "what does everyone see here", and a list that is the answer to both
  // belongs on both. A curator's own card wears their own byline, and the
  // same heart as everybody else's.
  const community = cols.data.filter((c) => membersOf(c, places).length > 0);


  const { tab, onYours, pickTab, communityRef, startNew } = useShelfTab({ route, session, mine, shared, scrollRef, navigation });

  const {
    query, setQuery, q, panel, setPanel, kind, setKind, open, inputRef,
    cancel, answered, fold, openSearch, noteSearch, suggestions, keepRecents,
  } = useShelfSearch();

  const { sharedSlugs, kindChoices, asked, kindCounts, wordsCount, reasonFor, sifted } = useShelfSift({
    onYours, mine, shared, community, cols, me, places, cities, cityName, q, kind, t,
  });
  // `loaded`, not `!loading`: the focus refresh flips `loading` back on,
  // and hiding the list for that made a visit look like a double load.
  const mineReady = mine.loaded;

  // Community explores by default and remembers a switch to the grid;
  // Yours is the grid. Guests explore in Mosaic too.
  const { width: winW } = useWindowDimensions();
  const gcardW = Math.round((winW - space.page * 2 - space.cardGap) / 2);
  const gcardH = Math.round(gcardW * 1.18);
  const [communityView, pickCommunityView] = useStored<'tile' | 'mosaic'>(COMMUNITY_VIEW_KEY, 'mosaic', COMMUNITY_VIEWS);

  const { groups, sections, atCity } = useShelfSections({
    onYours, communityView, asked, sifted, places, rank, here, mineReady, sharedSlugs, atKey,
  });

  const { onSeen, jumpRetried, jumpTo } = useCityJump({ sections, setAtKey, setJumpOpen, scrollRef, pinned, tabsHRef });
  const cityWord = (id: string | null) => (id
    ? cityName(id)
    : t('Elsewhere', 'Nơi khác', 'その他の街', '其他城市', '其他城市'));
  // Not while the panel is up: the box it would focus is already open.
  const dock = useDockOffer(dockWanted({ ducked, deep, panel, holding, pinned, headerExpanded }), navigation);
  // The dock's search: the box, at the top of the list, focused — which
  // opens the panel as a tap on it does.
  const findFromDock = () => { toTop(); openSearch(); };




  // What the header reads of the screen — see `collections/header`.
  const head: ShelfHead = {
    session, pinned, topHRef, tabsYRef, startNew, onYours, holding, open, headerExpanded, inputRef,
    query, setQuery, setPanel, noteSearch, cancel, panel, suggestions, keepRecents, answered,
    community, mine, shared, communityRef, tab, pickTab, communityView, pickCommunityView,
    kindChoices, kind, kindCounts, setKind, wordsCount,
  };

  // What the cards read of the screen — see `collections/cards`.
  const kit = useShelfKit({ navigation, cols, shared, places, me, sharesOf, reasonFor, noteSearch, t });

  return (
    // The door to a new list is the Trips screen's pill, in the header's
    // right, on both tabs for every signed-in reader. It was a dashed row at
    // the foot of the list, on the argument that the tab always showed
    // one door and a "New" pill on the heading was the same action a
    // third time. True at four lists and wrong at fifteen: the owner's
    // review (14 Oct 2026) found the row only by scrolling past every
    // list to reach it. The empty library keeps its own card and button,
    // as Trips keeps its first-trip card, and until 26 Oct 2026 the pill
    // stood down beside it so as not to be a second door. The owner saw
    // what that cost: the header lost the pill's height, and the title
    // and the tabs under it sat higher on an empty Yours than on
    // Community. Two doors to one room is the smaller fault.
    //
    // On Community it shows for every signed-in reader, lists or none
    // (owner, 16 Oct 2026): browsing other people's lists is when the idea
    // for one of your own arrives, and the pill coming and going with the
    // tab moved the title under the reader's thumb. It was hidden there on
    // the argument that Community's lists are not yours to add to — true,
    // but the pill never added to them; it starts one of yours, and
    // `startNew` takes the reader to Yours once it exists. Guests have no
    // library, so no pill.
    <Screen
      title={t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')}
      // The title is the list's to draw, and goes up with it — see `top`.
      titleScrolls
    >
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {holding || failedEmpty ? <ShelfTop h={head} /> : null}
        {holding && <ShelfSkeleton navigation={navigation} gcardW={gcardW} gcardH={gcardH} />}
        {/* A failed read is the body only when there is nothing under it.
            With a shelf already in hand — the launch cache, or the last
            fetch that worked — it is a banner above the shelf, and the
            shelf stays; see `components/loadFail`. */}
        {!holding && failedEmpty && (
          <LoadFailEmpty kind={failedEmpty} onRetry={cols.reload} testID="collections-load-fail" />
        )}
        {!holding && !failedEmpty && (
          <SectionList
            testID={readyID(cols, placesLoaded, placesLoading)}
            ref={scrollRef}
            sections={sections}
            keyExtractor={rowKey}
            onScroll={onShelfScroll}
            onScrollBeginDrag={fold}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            // The banner under the title rather than over it, now that the
            // title is the list's.
            ListHeaderComponent={(
              <>
                <ShelfTop h={head} />
                {colsFail && cols.data.length > 0 ? (
                  <LoadFailBanner kind={colsFail} onRetry={cols.reload} testID="collections-load-banner" />
                ) : null}
                <GuestNotice navigation={navigation} />
              </>
            )}
            renderItem={({ item, section }) => (
              <ShelfRowView item={item} section={section} winW={winW} gcardW={gcardW} gcardH={gcardH} kit={kit} />
            )}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (section.shared ? <SharedHead count={section.shared.count} /> : !section.city ? null : section === sections[0]
              ? <View style={s.firstGap} testID="collections-first-gap" />
              : <CityHead city={section.city} pinnedCopy={false} signedIn={!!session} cityWord={cityWord} onPress={() => setJumpOpen(true)} />)}
            onViewableItemsChanged={onSeen}
            // A jump to a block not yet drawn: go near it on the average
            // row, which draws it, then land on its heading.
            onScrollToIndexFailed={(info) => {
              if (jumpRetried.current) return;
              scrollRef.current?.getScrollResponder()?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
              setTimeout(() => {
                const sectionIndex = sections.findIndex((x, i) => sections.slice(0, i).reduce((n, y) => n + y.data.length + 2, 0) === info.index);
                if (sectionIndex >= 0) jumpTo(sectionIndex, true);
              }, 100);
            }}
            renderSectionFooter={({ section }) => (
              <ShelfFoot
                section={section} sections={sections} asked={asked} q={q} signedIn={!!session}
                onCreate={() => navigation.navigate('CollectionForm')}
                onExplore={() => navigation.getParent()?.navigate('Explore')}
              />
            )}
            contentContainerStyle={{ paddingBottom: tabClearance }}
            showsVerticalScrollIndicator={false}
            // The catalog too (owner, 23 Oct 2026): a community list draws
            // its places from it, so a place the desk approved since the
            // last load stayed missing from every list holding it until
            // the catalog happened to revalidate on its own.
            onRefresh={() => { setPulling(true); cols.reload(); mine.reload(); shared.reload(); placesReload(); myShares.reload(); }}
            refreshing={pulling}
          />
        )}
        <PinnedBar
          shown={pinned && !holding} head={head} signedIn={!!session} headerExpanded={headerExpanded} tabsHRef={tabsHRef}
          city={groups && atCity ? atCity : null} cityWord={cityWord} onCity={() => setJumpOpen(true)}
        />
        <ActionSheet
          visible={jumpOpen}
          onClose={() => setJumpOpen(false)}
          header={<Text style={s.jumpTitle}>{t('Go to a city', 'Đến thành phố', '都市へ移動', '前往城市', '前往城市')}</Text>}
        >
          {/* No card around them, as Explore's list has none. */}
          <JumpRows groups={groups} atCity={atCity} cityWord={cityWord} cityName={cityName} onJump={jumpTo} />
        </ActionSheet>
      </View>
      <ShelfDock visible={dock} signedIn={!!session} onFind={findFromDock} onNew={startNew} />
    </Screen>
  );
}
