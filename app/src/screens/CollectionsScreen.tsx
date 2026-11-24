// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, Text, type SectionListProps, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTourAnchor } from '../components/SignupTour';
import {
  AmbientWarmth,
  fireHaptic,
  Screen,
  Skeleton,
  useTabBarClearance,
} from '../components/ui';
import { useTabBarDucked } from '../components/tabBarDuck';
import { DockOffer, DockSlot, useDockOffer } from '../components/DockSlot';
import { AddPill } from '../components/add';
import { useSession } from '../lib/auth';
import { useCityList, useCurrentCity } from '../lib/city';
import { cityShortById } from '../lib/cityName';
import {
  pairUp, placesOf as placesCount,
} from '../lib/collectionShelf';
import ActionSheet from '../components/ActionSheet';
import {
  Collection, coverUriOf, fetchProfilesById, type FriendProfile, membersOf, useMyListShares, useSharedWithMe,
} from '../lib/data';
import { sharesByList, visibilityOf as seenOf } from '../lib/shares';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { useListRank } from '../lib/tasteProfile';
import { leadingCity, mosaicGroups, mosaicRows } from '../lib/collectionMosaic';
import { derivedKinds } from '../lib/collectionKinds';
import { useCoverOpen } from '../lib/useCoverOpen';
import { oneOf, useStored } from '../lib/stored';
import { useMyLists, useSaveActions } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { classifyLoadFail } from '../lib/loadfail';
import { LoadFailBanner, LoadFailEmpty } from '../components/loadFail';
import { space } from '../theme';
import type { Nav } from '../nav';
import { GuestNotice } from './collections/empties';
import type { ShelfKit } from './collections/cards';
import { CityHead, JumpRows, SharedHead } from './collections/cityHeads';
import { type ListRow, type Section, ShelfFoot, ShelfRowView } from './collections/rows';
import { ShelfTop, TabsRow, type ShelfHead } from './collections/header';
import { useShelfSearch } from './collections/useShelfSearch';
import { useShelfScroll } from './collections/useShelfScroll';
import { useShelfSift } from './collections/useShelfSift';
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
/** What the list says is on screen — `onSeen` reads the city from it. */
type Seen = Parameters<NonNullable<SectionListProps<ListRow, Section>['onViewableItemsChanged']>>[0];

const COMMUNITY_VIEW_KEY = 'citycrew.collections.community.view';

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
  const { cities } = useCityList();
  const { city: here } = useCurrentCity();
  const cols = useCollections();
  const colsFail = classifyLoadFail(cols.error);
  // Shared with the save sheet — see SaveProvider. Reading it here through
  // its own hook is what let the two disagree.
  const mine = useMyLists();
  // Friends' lists shared with the reader (12 Nov 2026), drawn on Yours
  // under their own heading, after the reader's own — see `sections`.
  const shared = useSharedWithMe(session?.user?.id);
  // And who each list of yours is shared with (13 Nov 2026), for the one
  // mark a shared tile wears: one read for all your lists, the read a
  // list's page makes too (`useMyListShares`), filed by list here.
  const myShares = useMyListShares(session?.user?.id);
  const sharesOf = useMemo(() => sharesByList(myShares.data), [myShares.data]);
  const { askToSignIn } = useSaveActions();
  // One heart on every public list, yours included (owner, 17 Oct 2026):
  // a curator may like their own list, and the shelves rank on everyone's
  // likes but theirs (`rankLikes`, read by `useListRank`). It is the
  // control the Explore shelf taps, backed by the same provider, one copy
  // of the truth.
  const { likes, myLikes, toggleLike } = useLikes();
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

  const me = session?.user?.id;
  // Read once a render: a list that turns eight days old while the tab is
  // open keeps its badge until the next one, which is soon enough.
  const now = Date.now();
  const newWord = t('New', 'Mới', '新着', '新', '新');

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

  const coverFor = (c: Collection) => coverUriOf(c, membersOf(c, places));
  const cover = useCoverOpen((slug, from) => navigation.navigate('CollectionDetail', from ? { slug, from } : { slug }));

  // The faces behind the community tiles, fetched once per catalog load
  // through the same batched lookup the Crew screen uses. A miss leaves
  // the Avatar drawing its placeholder circle — the seat is always
  // there, which is what keeps a bare handle reading as a signature
  // rather than a stray word. The Mosaic's cards wear it too since
  // 14 Nov 2026, when the `@` came off both.
  // The friends behind the lists shared with you are asked in the same
  // batch: their tiles wear the same byline.
  const [faces, setFaces] = useState<Record<string, FriendProfile>>({});
  useEffect(() => {
    const ids = [...new Set([...cols.data, ...shared.data].map((c) => c.owner_id).filter(Boolean))] as string[];
    if (!ids.length) return;
    fetchProfilesById(ids).then((more) => setFaces((prev) => ({ ...prev, ...more }))).catch(() => {});
  // Each `data` is a new array every load; `loadedAt` is the honest tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols.loadedAt, shared.loadedAt]);

  // The same wiring as the Explore shelf: signed out, the tap is the
  // sign-in invitation; signed in, the provider owns the write and the
  // optimistic count, so a like made here shows there.
  const onHeart = useCallback((c: Collection) => {
    if (!c.id) return;
    if (!me) { askToSignIn('like'); return; }
    fireHaptic('light');
    void toggleLike({ id: c.id, slug: c.slug });
  }, [me, toggleLike, askToSignIn]);

  // The two halves were one scroll, and the second half lost: four owned
  // lists already pushed "Public collections" to the fold, and a library
  // that grows pushes it further every month. A tab each — the same
  // shape as the Crew screen, for the same reason: two questions, asked
  // at different moments. Guests skip the switch entirely; with no
  // library there is only the one half to show.
  //
  // "Community", not "Public": on this screen "Public" is already the
  // status word each owned row wears, and one word must not mean the tab
  // and the badge at once. It also pairs with "Yours" as an answer to
  // the same question — whose lists these are.
  const [tab, setTab] = useState<'yours' | 'community'>(route.params?.tab ?? 'yours');
  // Explore's "See all" aims here while the screen may already be
  // mounted, so a fresh param re-aims the switch. Keyed on `at` as well
  // as `tab`: the second "See all" carries the same tab as the first, and
  // a reader who had switched to Yours in between was left there, because
  // an unchanged value never re-ran this.
  //
  // And a fresh `at` starts the list from its top: the screen is the one
  // left behind when the reader went into a collection, still scrolled
  // to where they were, and a door that says "your collections" opens on
  // the first of them (UX-09).
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
    if (route.params?.at) scrollRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  // `scrollRef` is a ref, the same object every render (`useShelfScroll`).
  }, [route.params?.tab, route.params?.at, scrollRef]);
  // An empty library greets with the community shelf instead of an empty
  // room — decided once per visit, the first time the answer lands, and
  // never re-decided under the reader's thumb (the Crew screen's rule).
  //
  // A library is not empty while a friend has shared a list with you: it
  // is on Yours (see `sections`), and greeting a reader whose friend just
  // shared one with Community would hide the one thing they came for. So
  // the greeting waits for both answers.
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current || !session || !mine.loaded || !shared.loaded || route.params?.tab) return;
    greeted.current = true;
    if (mine.data.length === 0 && shared.data.length === 0) setTab('community');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.loaded, shared.loaded]);
  // A list started from Community lands on Yours, where it now is: the
  // form goes back to whichever tab sent it, and on Community the new
  // list is invisible until it is made public. Keyed on the count, not on
  // the return — a cancelled form adds nothing and leaves the reader where
  // they were. The count rather than the focus because the form's
  // `mine.reload()` lands after the screen is focused again. A tab the
  // reader picks by hand in between drops the errand.
  const startedFromCommunity = useRef<number | null>(null);
  useEffect(() => {
    if (startedFromCommunity.current === null || mine.data.length <= startedFromCommunity.current) return;
    startedFromCommunity.current = null;
    setTab('yours');
  }, [mine.data.length]);
  const pickTab = (next: 'yours' | 'community') => { startedFromCommunity.current = null; setTab(next); };
  // The sign-up guide's third step rings Community (`SignupTour`).
  const communityRef = useTourAnchor('community', () => pickTab('community'));
  const startNew = () => {
    startedFromCommunity.current = onYours ? null : mine.data.length;
    navigation.navigate('CollectionForm');
  };

  const {
    query, setQuery, q, panel, setPanel, kind, setKind, open, inputRef,
    cancel, answered, fold, openSearch, noteSearch, suggestions, keepRecents,
  } = useShelfSearch();

  // Guests have one shelf and no switch; see the tabs below.
  const onYours = !!session && tab === 'yours';
  const { sharedSlugs, kindChoices, asked, kindCounts, wordsCount, reasonFor, sifted } = useShelfSift({
    onYours, mine, shared, community, cols, me, places, cities, cityName, q, kind, t,
  });
  const placesOf = (n: number) => placesCount(n, t);
  // Who can see a list of yours: Public, Friends or Private
  // (`lib/shares.visibilityOf`), from its flag and its shares.
  const seenFor = (c: { id?: string; is_public?: boolean | null }) =>
    seenOf(!!c.is_public, sharesOf[c.id ?? '']?.length ?? 0);
  // The same, in words, for VoiceOver: on screen the mark says it, and a
  // glyph is not read out.
  const visibilityOf = (c: { id?: string; is_public?: boolean | null }) => ({
    public: t('Public', 'Công khai', '公開', '公开', '公開'),
    friends: t('Friends', 'Bạn bè', '友達', '好友', '好友'),
    private: t('Private', 'Riêng tư', '非公開', '私密', '私密'),
  })[seenFor(c)];
  // `loaded`, not `!loading`: the focus refresh flips `loading` back on,
  // and hiding the list for that made a visit look like a double load.
  const mineReady = mine.loaded;

  // Community explores by default and remembers a switch to the grid;
  // Yours is the grid. Guests explore in Mosaic too.
  const { width: winW } = useWindowDimensions();
  const gcardW = Math.round((winW - space.page * 2 - space.cardGap) / 2);
  const gcardH = Math.round(gcardW * 1.18);
  const [communityView, pickCommunityView] = useStored<'tile' | 'mosaic'>(COMMUNITY_VIEW_KEY, 'mosaic', COMMUNITY_VIEWS);

  // Tiles pack two to a row-item; see `ShelfRow` for why every row-item
  // carries whose it is and where it sits in the whole list.
  //
  // The Community Mosaic at rest is one block a city, each under its name
  // (owner, 5 Nov 2026); see `mosaicGroups` for the order and for what was
  // ruled out. Asked anything, it is one shelf again, in the answer's
  // order — a chip already says which city, and a search ranks by hits.
  const groups = useMemo(() => (onYours || communityView !== 'mosaic' || asked ? null : mosaicGroups(sifted, {
    cityOf: (c) => leadingCity(membersOf(c, places).map((p) => p.city_id), c.city_id),
    kindOf: (c) => derivedKinds(membersOf(c, places))[0] ?? null,
    rank,
    home: here?.id,
  })), [onYours, communityView, asked, sifted, places, rank, here?.id]);
  // Memoised: a new array here makes the list reset what it has reported
  // in view and report it again — see the freeze noted at `onSeen`.
  //
  // ── shared with you (12 Nov 2026) ──
  //
  // On Yours, after your own lists and under a heading of its own: a list
  // a friend shared is one you keep coming back to, which is what Yours
  // is for, but it is not yours — no padlock, no count, a byline instead
  // — and mixed in among your own it would read as one you made. After
  // yours, not before: your own are what the tab opens for. Not on
  // Community, which answers "what does everyone see"; a shared list is
  // private, and everyone does not. The heading only when something is
  // in the section, so a reader nobody has shared with sees the tab as
  // it was.
  const sections: Section[] = useMemo(() => {
    if (onYours) {
      if (!mineReady) return [];
      const lent = sifted.filter((c) => sharedSlugs.has(c.slug));
      const own: Section = { own: true, data: pairUp(sifted.filter((c) => !sharedSlugs.has(c.slug)), true) };
      return lent.length ? [own, { own: false, shared: { count: lent.length }, data: pairUp(lent, false) }] : [own];
    }
    return groups?.length
      ? groups.map((g) => ({ own: false, data: g.rows, city: { id: g.city, count: g.count } }))
      // The grid has no city blocks, so at rest it is one shelf and is
      // ranked as one, every city's lists measured against each other.
      // It was the catalog's order, newest first.
      : [{ own: false, data: communityView === 'mosaic' ? mosaicRows(sifted) : pairUp(asked ? sifted : rank(sifted), false) }];
  }, [onYours, mineReady, sifted, sharedSlugs, groups, communityView, asked, rank]);
  const atCity = atKey == null ? null : sections.find((x) => x.city && (x.city.id ?? '') === atKey)?.city ?? null;

  // ── the city you are in, pinned, and a way to the others (owner,
  // 6 Nov 2026) ──
  //
  // Six blocks, the first sixteen lists long: a reader after Huế scrolled
  // past thirty cards to find it, and half-way down nothing on screen said
  // which city the cards were in. The block's heading now rides under the
  // pinned tabs once its own has gone up past them, and either heading
  // opens the list of cities to jump to.
  //
  // Rejected, from the same reference: a "preferred city" setting of this
  // tab's own. The reader's city already leads, and a third place to pick
  // a city — after the app's city and the filter's — would leave nobody
  // sure which one decides what. A jump does the job without being a
  // setting.
  //
  // Which block is under the row is read from what the list says is in
  // view: the section of the first row on screen. While that block's own
  // heading is still in view — it is the header token of the same section,
  // ahead of its rows — the pinned copy stays away, so the name is never
  // printed twice.
  //
  // ── the freeze it shipped with (6 Nov 2026) ──
  //
  // The state is the city's key, a string, which React drops when it is
  // unchanged, and the sections are memoised, so a render the list did not
  // cause hands it the same data: a list given new `data` reports what is
  // in view again (`resetViewableIndices`), and an object in state would
  // turn every report into a render. These were the first guess at the
  // 6 Nov freeze and did not cure it — the cause was `rowKey`'s, above —
  // but they keep the report from costing a render it does not need.
  //
  // The first block draws no heading of its own (see `renderSectionHeader`),
  // so its slot in view says nothing: its rows count as the first city's
  // from the top, and the pinned bar names it as soon as the tabs pin.
  const firstSection = useRef<Section | undefined>(undefined);
  firstSection.current = sections[0];
  const onSeen = useRef(({ viewableItems }: Seen) => {
    const sectionOf = (v: Seen['viewableItems'][number]) => v.section as Section | undefined;
    const row = viewableItems.find((v) => v.index != null && sectionOf(v)?.city);
    const heading = row && row.section !== firstSection.current
      && viewableItems.find((v) => v.index == null && v.section === row.section);
    setAtKey(row && !heading ? (sectionOf(row)!.city!.id ?? '') : null);
  }).current;
  // One retry per jump, never a chase: a block the list still cannot
  // reach after it has scrolled near it stays where the scroll left it.
  const jumpRetried = useRef(false);
  const jumpTo = (sectionIndex: number, again = false) => {
    jumpRetried.current = again;
    setJumpOpen(false);
    scrollRef.current?.scrollToLocation({
      sectionIndex, itemIndex: 0, viewOffset: pinned ? tabsHRef.current : 0, animated: true,
    });
  };
  const cityWord = (id: string | null) => (id
    ? cityName(id)
    : t('Elsewhere', 'Nơi khác', 'その他の街', '其他城市', '其他城市'));
  // Not while the panel is up: the box it would focus is already open.
  const dock = useDockOffer(ducked && deep && !panel && !holding && !(pinned && headerExpanded), navigation);
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
  const kit: ShelfKit = {
    coverFor,
    open: (slug, uri) => { noteSearch(); cover.open(slug, uri); },
    coverRef: cover.ref,
    faces,
    now,
    newWord,
    membersOf: (c) => membersOf(c, places).length,
    reasonFor,
    myLikes,
    likes,
    onHeart,
    visibilityOf,
    seenFor,
    placesOf,
  };

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
        {holding || (colsFail && cols.data.length === 0) ? <ShelfTop h={head} /> : null}
        {holding && (
          <View>
            <GuestNotice navigation={navigation} />
            {/* The grid it is about to be — the only shape the shelf has
                drawn since the list view went (7 Nov 2026). */}
            {[0, 1].map((i) => (
              <View key={i} style={s.gridRow}>
                {[0, 1].map((j) => <Skeleton key={j} style={[s.gcard, { width: gcardW, height: gcardH }]} />)}
              </View>
            ))}
          </View>
        )}
        {/* A failed read is the body only when there is nothing under it.
            With a shelf already in hand — the launch cache, or the last
            fetch that worked — it is a banner above the shelf, and the
            shelf stays; see `components/loadFail`. */}
        {!holding && colsFail && cols.data.length === 0 && (
          <LoadFailEmpty kind={colsFail} onRetry={cols.reload} testID="collections-load-fail" />
        )}
        {!holding && !(colsFail && cols.data.length === 0) && (
          <SectionList
            testID={cols.loaded && !cols.loading && !cols.fromCache && !cols.error && placesLoaded && !placesLoading ? 'collections-ready' : undefined}
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
        {/* The tabs, pinned: a copy over the shelf rather than a sticky
            header, as Explore's filter row is, so nothing it does can
            move a row or eat a tap meant for one. */}
        {pinned && !holding && (session || (groups && atCity)) ? (
          <View style={s.pinned} testID="collections-pinned">
            {session ? (
              <View onLayout={(e) => { tabsHRef.current = Math.round(e.nativeEvent.layout.height); }}>
                {headerExpanded ? <ShelfTop h={head} floating /> : <TabsRow h={head} floating />}
              </View>
            ) : null}
            {groups && atCity ? <CityHead city={atCity} pinnedCopy signedIn={!!session} cityWord={cityWord} onPress={() => setJumpOpen(true)} /> : null}
          </View>
        ) : null}
        <ActionSheet
          visible={jumpOpen}
          onClose={() => setJumpOpen(false)}
          header={<Text style={s.jumpTitle}>{t('Go to a city', 'Đến thành phố', '都市へ移動', '前往城市', '前往城市')}</Text>}
        >
          {/* No card around them, as Explore's list has none. */}
          <JumpRows groups={groups} atCity={atCity} cityWord={cityWord} cityName={cityName} onJump={jumpTo} />
        </ActionSheet>
      </View>
      {/* Explore's dock, with this screen's two actions: the whole island
          is the box (`findFromDock`), the pill a new list. "+ Bộ sưu tập",
          "+ Tạo mới", the word every pill that makes something wears, as
          this screen's own header pill does. Guests start no lists. */}
      <DockSlot visible={dock} onPress={findFromDock} accessibilityRole="button" testID="collections-dock">
        <DockOffer
          icon="search-outline"
          title={t('Find a collection', 'Tìm bộ sưu tập', 'コレクションを探す', '查找合集', '查詢合集')}
          // Short, for one line beside the pill: about 23 characters fit
          // there (CollectionDetail's dock measured it, 17 Oct 2026).
          sub={t('By name or place', 'Theo tên hoặc địa điểm', '名前やスポットで', '按名称或地点', '按名稱或地點')}
        />
        {session ? (
          <AddPill
            label={t('New', 'Tạo mới', '新規', '新建', '新增')}
            accessibilityLabel={t('New collection', 'Bộ sưu tập mới', '新しいコレクション', '新建合集', '新增合集')}
            onPress={startNew}
            testID="collections-dock-new"
          />
        ) : null}
      </DockSlot>
    </Screen>
  );
}
