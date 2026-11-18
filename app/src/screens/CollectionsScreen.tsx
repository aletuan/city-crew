// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, SectionList, StyleSheet, Text, type TextInput, type SectionListProps, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Glyph, ICON } from '../components/ui/glyph';
import {
  AmbientWarmth,
  Avatar,
  Card,
  Empty,
  fireHaptic,
  PressableScale,
  Screen,
  ScreenTitle,
  Skeleton,
  TABS_ROW_GAP,
  UnderlineChoice,
  UnderlineTabs,
  useTabBarClearance,
} from '../components/ui';
import SearchField from '../components/SearchField';
import { useDuckOnScroll, useTabBarDucked } from '../components/tabBarDuck';
import { DockOffer, DockSlot, useDockOffer } from '../components/DockSlot';
import { AddPill } from '../components/add';
import { createDuckTracker } from '../lib/duck';
import { useSession } from '../lib/auth';
import { useCityList, useCurrentCity } from '../lib/city';
import { cityShortById } from '../lib/cityName';
import {
  listsWord, pairUp, placesOf as placesCount, reasonFor as shelfReason, type ShelfRow,
} from '../lib/collectionShelf';
import ActionSheet from '../components/ActionSheet';
import { CityRow } from '../components/CityRow';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import {
  Collection, coverUriOf, fetchProfilesById, type FriendProfile, membersOf, useMyListShares, useSharedWithMe,
} from '../lib/data';
import { sharesByList, visibilityOf as seenOf } from '../lib/shares';
import { normalizeHandle } from '../lib/handle';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { useListRank } from '../lib/tasteProfile';
import { isNewList } from '../lib/newest';
import { leadingCity, mosaicCaption, mosaicGroups, mosaicRows, type MosaicEntry, type MosaicRow } from '../lib/collectionMosaic';
import { derivedKinds } from '../lib/collectionKinds';
import NewBadge from '../components/NewBadge';
import { COLLECTION_RECENTS_KEY, RECENTS_SHOWN, rememberSearch } from '../lib/recents';
import { NO_RECENTS, oneOf, RECENTS, useStored } from '../lib/stored';
import { cityInQuery, collectionKinds, siftCollections, type SiftMember } from '../lib/search';
import { useMyLists, useSaveActions } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { classifyLoadFail } from '../lib/loadfail';
import { LoadFailBanner, LoadFailEmpty } from '../components/loadFail';
import { colors, coverScrim, mosaicScrim, onPhoto, space } from '../theme';
import LikeHeart from '../components/LikeHeart';
import type { Nav } from '../nav';
import { GuestNotice, EmptyCover, FirstCollection, CommunityEmpty } from './collections/empties';
import { s } from './collections/styles';

type ListRow = ShelfRow<Collection> | MosaicRow<Collection>;

/** Yours keeps its two layouts; Community adds the editorial Mosaic. */
// Community's two looks, Mosaic first (owner, 5 Nov 2026). The list view
// went on 7 Nov 2026, from both tabs: Yours is the grid alone, with no
// switch, and a phone that remembered 'row' falls back to Mosaic here.
const COMMUNITY_VIEWS = oneOf('tile', 'mosaic');

/** A section of the list: yours, the lists friends shared with you, or
 *  the community's, with its rows. The rows are named here, not only by
 *  the list: React Native 0.88 types a section handed back to a render
 *  prop as possibly the extra fields alone. */
type Section = {
  own: boolean;
  data: ListRow[];
  city?: { id: string | null; count: number };
  /** The lists friends shared with you, and how many. */
  shared?: { count: number };
};

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
  const duckScroll = useDuckOnScroll();
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<SectionList<ListRow, Section>>(null);
  // Typed through, as on Explore: React Navigation's idea of a scrollable
  // and React Native 0.88's SectionList do not meet, though the list
  // answers `getScrollResponder` as it always did.
  useScrollToTop(scrollRef as unknown as Parameters<typeof useScrollToTop>[0]);
  const toTop = () => scrollRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });

  // Keep the natural header's geometry. The overlay pins only tabs and
  // layouts on descent; reversing reveals the full header in place.
  // The tab bar's tracker supplies hysteresis and overscroll clamping.
  const tabsYRef = useRef(0);
  const topHRef = useRef(0);
  const [headerTracker] = useState(() => createDuckTracker({ topSlack: 0 }));
  const [pinned, setPinned] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  // The city block under the pinned row, once its own heading has gone
  // under the row (see `onSeen`); null while a heading is in view. Its key
  // only — the city's id, '' for "elsewhere" — never the section's object:
  // see the freeze noted at `onSeen`.
  const [atKey, setAtKey] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  // How tall the pinned tabs are, so a jump lands its heading just
  // under them rather than behind them.
  const tabsHRef = useRef(0);
  const [deep, setDeep] = useState(false);
  const onShelfScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    duckScroll?.(e);
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
    const y = Math.min(maxY, Math.max(0, contentOffset.y));
    const direction = headerTracker.report(y, maxY);
    if (direction) setHeaderExpanded(direction === 'show');
    // Keep the revealed header until the natural one is fully at rest.
    const nowPinned = tabsYRef.current > 0 && (y >= tabsYRef.current || (pinned && y > 0));
    if (nowPinned !== pinned) setPinned(nowPinned);
    const nowDeep = topHRef.current > 0 && y >= topHRef.current;
    if (nowDeep !== deep) setDeep(nowDeep);
  };
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
  }, [route.params?.tab, route.params?.at]);
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
  const pickTab = (next: 'yours' | 'community') => {
    startedFromCommunity.current = null;
    setTab(next);
  };
  const startNew = () => {
    startedFromCommunity.current = onYours ? null : mine.data.length;
    navigation.navigate('CollectionForm');
  };

  // The search over what is already here. Everything it reads — both
  // lists, every member — is in memory, so this is a filter that runs on
  // the keystroke, offline, with no query behind it. It answers by a
  // list's own words, by the places inside it, by their city, and by
  // @handle; the arithmetic lives in `siftCollections`, under the gate,
  // beside the rules it shares with the search box on Explore.
  //
  // It was a glyph in the header and a field that existed only while
  // wanted. The owner's review (14 Oct 2026): the check-ins screen had
  // meanwhile grown a box under its title with a panel of chips behind
  // it, and a reader who had learned that screen looked for the same
  // thing here. So this is that box, with that panel — recent searches,
  // then the cities, then the kinds of place — opened by focus, folded by
  // a choice (see `answered`) and let go of by Cancel. One city and one
  // kind at a time, a chosen chip tapped again lets go.
  //
  // What the panel adds that the words could not: a chip asks about the
  // *places* in a list. Under "Cafés" a list is listed for the cafés in
  // it, and the card says how many of its places those are, because a
  // list of eight with three cafés and a list of three cafés are
  // different answers to the same chip.
  //
  // Since 25 Oct 2026 the cities and the kinds are two `UnderlineChoice`
  // rows, each with "All" first, where they were two wraps of chips (the
  // owner, on the review board that took Explore's boxes away). With
  // seven cities and nine kinds the wraps were five lines of chips; the
  // rows are two, and scroll, so the panel is a band under the box rather
  // than a sheet over the shelf.
  //
  // And later that day the owner moved them out of the panel altogether:
  // the city and the kind are a sheet from below now, opened by Explore's
  // filter glyph beside the title (a filter sheet), so the box was for
  // words and the glyph for narrowing, on both screens. On 7 Nov 2026 the
  // kinds came back under the box and the sheet went — see `searching`.
  const [query, setQuery] = useState('');
  const q = query.trim();
  const [panel, setPanel] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  // One way in for words and kinds since 7 Nov 2026 (owner): the box is
  // not on the page at rest. The dock opens it — a reader is offered the
  // search once they have scrolled into the shelf, and the 🔍 that stood
  // beside the title went the same day (owner: fewer things at the top;
  // a shelf too short to scroll is one read at a glance) — where it stood — under the tabs — with the kinds as a row under it
  // and what was searched before; results keep the shelf's own layout.
  // The filter glyph and its sheet went: a city was three ways in (the
  // sheet, the box, and Mosaic's blocks with their ▾), and the kind was a
  // second door to the same answer. A city is typed now — the sift
  // already reads members' cities — and Mosaic is drawn by city anyway.
  // The 25 Oct move of the filters out of the box is undone in part.
  // Open from the dock until Cancel, which also lets go of
  // the words and the kind: so while anything narrows the shelf, the box
  // that holds it is on the page.
  const [searching, setSearching] = useState(false);
  const open = searching;
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  // Cancel is the box's: it lets go of the words and the kind, and puts
  // the box away (7 Nov 2026 — they are one tool again).
  //
  // Before: Cancel let go of the words and closed the panel.
  // It let go of the city and the kind too while they were chosen in the
  // panel; since they moved to the sheet (25 Oct 2026) they are the
  // sheet's, shown under the box with a ✕ each, and outlive a search.
  const cancel = () => {
    setPanel(false); setQuery(''); setKind(null); setSearching(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };
  // A chip is an answer, and the keyboard asks for words. Tapped, it
  // puts the keyboard away (the owner, 14 Oct 2026: the keyboard stood
  // over the results of every chip) — and since 24 Oct the panel folds
  // with it, down to the chips that are on.
  //
  // It used to stay up until Cancel, for the reason VisitedScreen gives:
  // closing it on a blur would take the chips out from under the reader
  // mid-choice. Here that left the reader with no way to read the shelf.
  // The panel was not in the list then, as VisitedScreen's is, so it did
  // not scroll away; with seven cities and nine kinds it stood over all but
  // a fifth of the screen, and the only way out was Cancel, which let go
  // of the chips it was meant to keep (the owner's screenshot, 24 Oct
  // 2026). Folded, what it chose stays in sight under the box, so a
  // filter is never one nobody can see; the shelf gets the screen, and
  // the box opens the panel again for a second choice. Dragging the shelf
  // folds it too: that is the reader asking to read.
  //
  // The folded row was chips, each with a ✕, behind a "Filters" chip.
  // Since 25 Oct 2026 it is the review board's: Explore's filter glyph,
  // with no word beside it (the owner: the glyph says it), then what is
  // chosen as words with no ground, each a tap back into the panel and
  // each with its own ✕. Left from the board: its "Clear all", which
  // turned letting go of one of two choices into two taps (it shipped in
  // a draft and came out the same day — the owner asked why the ✕ had
  // gone; with two choices at most, a ✕ each is enough, and Cancel lets
  // go of everything); its filter sheet, a fourth way of choosing beside
  // the underline rows Explore, this panel and the visits panel now
  // share; and several cities at once, which the owner took out of every
  // filter on 24 Oct.
  const answered = () => { inputRef.current?.blur(); Keyboard.dismiss(); setPanel(false); };
  const fold = () => { if (panel) answered(); };
  // The dock: open the box (it takes focus as it mounts — see
  // `autoFocus` on it), or, open already, put the keyboard back in it.
  const openSearch = () => {
    if (open) inputRef.current?.focus();
    else setSearching(true);
  };

  // What this box remembered, in its own drawer — the visits screen's
  // mechanism, for its reasons: kept when a search *worked* (a card
  // opened, or the return key), never on a keystroke.
  const [recents, keepRecents] = useStored(COLLECTION_RECENTS_KEY, NO_RECENTS, RECENTS);
  const noteSearch = () => {
    const next = rememberSearch(recents, query);
    if (next !== recents) keepRecents(next);
  };
  const suggestions = recents
    .filter((term) => term.toLowerCase().includes(q.toLowerCase()) && term.trim() !== q)
    .slice(0, RECENTS_SHOWN);

  // Guests have one shelf and no switch; see the tabs below.
  const onYours = !!session && tab === 'yours';
  // Every member with the words a reader types for its city — the sift
  // matches "da nang" against a member's city as it does against its
  // name. Built once per catalog, not per keystroke.
  const pairOf = useCallback((c: Collection): { c: Collection; members: SiftMember[] } => ({
    c,
    members: membersOf(c, places).map((p): SiftMember => ({ ...p, city_name: cityName(p.city_id) })),
  }), [places, cityName]);
  // Yours is your own lists and then the ones shared with you, sifted as
  // one shelf so a search and a kind reach both, and split again into
  // their two sections (`sections`). Kept whole, an empty shared list
  // included, where Community drops its empty ones: a list somebody gave
  // you is not a dead end at the desk, and one missing would read as a
  // share that never arrived.
  const shelf = useMemo(
    () => (onYours ? [...mine.data, ...shared.data] : community).map(pairOf),
    // `community` is derived from `cols.data`, `me` and `places`, all listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onYours, mine.data, shared.data, cols.data, me, places, pairOf],
  );
  const sharedSlugs = useMemo(() => new Set(shared.data.map((c) => c.slug)), [shared.data]);
  // The kinds a shelf can offer: only what its lists actually hold, so no
  // kind leads to an empty shelf.
  const kindChoices = useMemo(() => collectionKinds(shelf), [shelf]);
  const asked = !!(q || kind);
  // A city typed whole is a city chosen (owner, 7 Nov 2026): "Đà Lạt" lists
  // the lists with a place there, not every list whose words begin "da"
  // and "lat" somewhere — "After Dark … until late" came back for it. It
  // stands in for the city filter that went the same day; anything more
  // or less than a city's name stays words.
  const cityAsked = useMemo(
    () => cityInQuery(q, cities.map((c) => ({ id: c.id, names: [c.short_en, c.short_vi, c.short_ja, c.name_en, c.name_vi, c.name_ja] }))),
    [q, cities],
  );
  const words = cityAsked ? '' : q;

  const hits = useMemo(
    () => siftCollections(shelf, { query: words, city: cityAsked, kind }),
    [shelf, words, cityAsked, kind],
  );
  const hitBy = useMemo(() => new Map(hits.map((h) => [h.c.slug, h])), [hits]);
  // The chips' own labels, as the cards' reasons print them. The words themselves are `lib/collectionShelf`'s.
  const chosen = [
    kind ? categoryLabel(kind, t) : null,
    cityAsked ? cityName(cityAsked) : null,
  ].filter((x): x is string => !!x);
  // Each kind's row figure: the lists the words so far would leave with
  // that kind chosen, so a kind that would empty the shelf says 0 and is
  // drawn off rather than hidden.
  const kindCounts = useMemo(
    () => new Map(kindChoices.map((k) => [k, siftCollections(shelf, { query: words, city: cityAsked, kind: k }).length])),
    [shelf, words, cityAsked, kindChoices],
  );
  const wordsCount = useMemo(() => siftCollections(shelf, { query: words, city: cityAsked, kind: null }).length, [shelf, words, cityAsked]);
  const placesOf = (n: number) => placesCount(n, t);
  // Who can see a list of yours: Public, Friends or Private
  // (`lib/shares.visibilityOf`), from its flag and its shares.
  const seenFor = (c: { id?: string; is_public?: boolean | null }) =>
    seenOf(!!c.is_public, sharesOf[c.id ?? '']?.length ?? 0);
  // The same, in words, for VoiceOver: on screen the mark says it, and a
  // glyph is not read out.
  const visibilityOf = (c: { id?: string; is_public?: boolean | null }) => ({
    public: t('Public', 'Công khai', '公開', '公开', '公開'),
    friends: t('Friends', 'Bạn bè', '友だち', '好友', '好友'),
    private: t('Private', 'Riêng tư', '非公開', '私密', '私密'),
  })[seenFor(c)];
  const reasonFor = (slug: string) => shelfReason(hitBy.get(slug), chosen, t);
  // `loaded`, not `!loading`: the focus refresh flips `loading` back on,
  // and hiding the list for that made a visit look like a double load.
  const mineReady = mine.loaded;
  // The shelf, as the sift ordered it — the catalog's own order, newest
  // first, when nothing is asked; lists found by their own words first
  // and then by hits when it is. Community at rest is not shown in this
  // order: the Mosaic ranks each city's block (`groups`) and the grid is
  // ranked whole (`sections`).
  // Memoised with `hits`: the city blocks and the sections are built from
  // it, and a new array every render rebuilt them every render — see the
  // freeze noted at `onSeen`.
  const sifted = useMemo(() => hits.map((h) => h.c), [hits]);

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
  // The sheet's rows are Explore's city rows (owner, 7 Nov 2026): it was
  // a menu of acts — a pin on every row saying the same thing six times,
  // "12 collections" under each name, a tick — beside an app whose other
  // city list is names on the left and figures in a column on the right,
  // the one on screen in the tint. "Elsewhere" goes last, under a rule,
  // and names the cities it gathers: a reader after Hội An could not know
  // to look in it.
  //
  // No figures (owner, the same day): the block's heading and the pinned
  // bar already say "12 collections", and nobody picks a city to jump to
  // by how many lists it holds.
  //
  // Rejected, on the owner's question: Explore's "Use my location" and
  // "Recent". This sheet is a jump within the shelf, not the app's city —
  // nothing chosen here is kept — and the reader's own city already
  // leads it (`mosaicGroups`' `home`), so "my location" would repeat the
  // first row, or else become a third place to set a city, which the
  // 6 Nov note above ruled out. "Recent" earns its room in a list of
  // dozens; here five or six rows are read at a glance, and a recent
  // section would repeat them and make the sheet longer than its list.
  const jumpRows = (groups ?? []).map((g, i) => {
    const there = g.city == null;
    return (
      <CityRow
        key={g.city ?? 'elsewhere'}
        title={cityWord(g.city)}
        sub={there && g.within?.length ? g.within.map(cityName).join(' · ') : null}
        active={atCity ? atCity.id === g.city : i === 0}
        divided={i > 0}
        onPress={() => jumpTo(i)}
        testID={`collections-jump-${g.city ?? 'elsewhere'}`}
      />
    );
  });
  const cityHead = (city: { id: string | null; count: number }, pinnedCopy: boolean) => (
    <PressableScale
      onPress={() => setJumpOpen(true)}
      contentStyle={pinnedCopy ? [s.cityBar, !session && s.cityBarAlone] : s.cityHead}
      // Under the tabs the bar takes their 14 below for its reach up, so
      // the target is 14 + the line + 12 — past 44 — with nothing of the
      // tabs' own under it.
      hitSlop={pinnedCopy && session ? { top: TABS_ROW_GAP } : undefined}
      testID={pinnedCopy ? 'collections-city-bar' : `collection-mosaic-city-${city.id ?? 'elsewhere'}`}
      accessibilityRole="button"
      accessibilityLabel={`${cityWord(city.id)}, ${listsWord(city.count, t)}`}
      accessibilityHint={t('Go to another city', 'Đến thành phố khác', '別の都市へ移動', '前往其他城市', '前往其他城市')}
    >
      <Text style={s.cityHeadName} numberOfLines={1}>{cityWord(city.id)}</Text>
      <Glyph name="chevron-down" size={ICON.text} color={colors.textSecondary} style={s.cityHeadChevron} />
      <Text style={s.cityHeadCount}>{listsWord(city.count, t)}</Text>
    </PressableScale>
  );

  // The heading over the lists friends shared with you (see `sections`):
  // a city block's heading in size and place, so Yours reads as one shelf
  // in two parts, but no ▾ — there is nowhere to jump to — and so not a
  // button. The count is lists, as a city's is.
  const sharedHead = (count: number) => (
    <View style={s.cityHead} testID="collections-shared-head">
      <Text style={s.cityHeadName} numberOfLines={1} accessibilityRole="header">
        {t('Shared with you', 'Được chia sẻ với bạn', 'あなたと共有', '与你共享', '與你共享')}
      </Text>
      <Text style={s.cityHeadCount}>{listsWord(count, t)}</Text>
    </View>
  );

  // Not while the panel is up: the box it would focus is already open.
  const dock = useDockOffer(ducked && deep && !panel && !holding && !(pinned && headerExpanded), navigation);
  // The dock's search: the box, at the top of the list, focused — which
  // opens the panel as a tap on it does.
  const findFromDock = () => { toTop(); openSearch(); };

  // The tab bar's own glyph for your shelf; the globe every public row
  // already wears for everyone else's. Guests have no library, so they
  // get the one half with no switch in front of it. Drawn twice: in the
  // list, where it is measured (`tabsY`), and as the pinned copy once
  // the list has carried it to the top — see `pinned`. The copy has no
  // test names, so a test finds exactly one of each.
  const tabsRow = (floating: boolean) => (session ? (
      <UnderlineTabs
        tabs={[
          { key: 'yours', icon: 'bookmark-outline', label: t('Yours', 'Của bạn', '自分の', '我的', '我的'), testID: floating ? undefined : 'collections-yours' },
          { key: 'community', testID: floating ? undefined : 'collections-community', icon: 'globe-outline', label: t('Community', 'Cộng đồng', 'みんなの', '社区', '社群') },
        ]}
        active={tab}
        onChange={pickTab}
        // Community's two looks; Yours is the grid and has no switch
        // (owner, 7 Nov 2026 — the list view went from both).
        right={onYours ? undefined : (
          <View style={s.viewToggle}>
            {(['tile', 'mosaic'] as const).map((v) => (
              <PressableScale
                key={v}
                contentStyle={[s.viewBtn, communityView === v && s.viewBtnOn]}
                scaleTo={0.9}
                haptic="selection"
                // Keep the capsule compact; extend the outer edges and the
                // vertical hit area without overlapping the other mode.
                hitSlop={v === 'tile'
                  ? { top: 11, bottom: 11, left: 18, right: 1 }
                  : { top: 11, bottom: 11, left: 1, right: 18 }}
                onPress={() => pickCommunityView(v)}
                accessibilityRole="button"
                accessibilityState={{ selected: communityView === v }}
                aria-selected={communityView === v}
                testID={floating ? undefined : `collections-view-${v}`}
                accessibilityLabel={v === 'mosaic'
                  ? t('Mosaic view', 'Dạng Mosaic', 'モザイク表示', '拼贴视图', '拼貼檢視')
                  : t('Tile view', 'Dạng lưới', 'タイル表示', '卡片视图', '卡片檢視')}
              >
                <Glyph
                  name={v === 'mosaic' ? 'albums-outline' : 'grid-outline'}
                  size={ICON.text}
                  color={communityView === v ? colors.accent : colors.textTertiary}
                />
              </PressableScale>
            ))}
          </View>
        )}
      />
  ) : null);

  // The kinds, under the box while it is open: a kind narrows the shelf
  // to lists holding that kind of place, and a card says how many of its
  // places those are. "All" first, Explore's row; a kind that would leave
  // nothing is drawn off, not hidden, so the row does not reflow as the
  // words change. A kind is an answer: tapped, the keyboard goes.
  const kindsRow = (floating: boolean) => (!holding && open && kindChoices.length > 0 ? (
    <View style={s.kinds}>
      <UnderlineChoice
        // The chosen kind stays in the row even where this shelf holds
        // none of it (carried over from the other tab), or it could be
        // on and nowhere in sight.
        items={(kind && !kindChoices.includes(kind) ? [...kindChoices, kind] : kindChoices).map((k) => ({
          key: k,
          label: categoryLabel(k, t),
          icon: CATEGORIES[k]?.icon,
          count: kindCounts.get(k) ?? 0,
          off: (kindCounts.get(k) ?? 0) === 0,
          testID: floating ? undefined : `collections-kind-${k}`,
        }))}
        chosen={kind}
        onPick={(k) => { setKind(k); answered(); }}
        all={t('All', 'Tất cả', 'すべて', '全部', '全部')}
        allCount={wordsCount}
        testID={floating ? undefined : 'collections-kinds'}
      />
    </View>
  ) : null);

  // Everything above the shelf, as the list's own header since 25 Oct
  // 2026 (owner): the title, the line under it, the tabs, the box and its
  // panel go up with the shelf, as Explore's hero does, and the tabs pin
  // at the top once they get there. Fixed, they took a third of the phone
  // from the lists. Measured, for the dock: past its foot is "deep".
  const top = (floating = false) => (
    <View
      onLayout={floating ? undefined : (e) => { topHRef.current = Math.round(e.nativeEvent.layout.height); }}
      testID={floating ? 'collections-floating-top' : 'collections-top'}
      // Preserve layout while exposing only one copy to touch and a11y.
      style={!floating && pinned && session ? [s.hiddenHeader, { height: topHRef.current }] : undefined}
      pointerEvents={!floating && pinned && session ? 'none' : 'auto'}
      accessibilityElementsHidden={!floating && pinned && !!session}
      importantForAccessibility={!floating && pinned && session ? 'no-hide-descendants' : 'auto'}
      aria-hidden={!floating && pinned && !!session}
    >
      <ScreenTitle
        title={t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')}
        right={session ? (
          <AddPill
            quiet
            label={t('New', 'Tạo mới', '新規', '新建', '新增')}
            onPress={startNew}
            accessibilityLabel={t('New collection', 'Bộ sưu tập mới', '新しいコレクション', '新建合集', '新增合集')}
            testID={floating ? 'collection-floating-new' : 'collection-new'}
          />
        ) : undefined}
      />
      {/* What the tab is, in a sentence — the two lines of 2 Nov 2026,
          back on 7 Nov (owner) after a day without them: at rest the
          screen went from the tabs straight into photographs, with
          nothing saying which shelf this was. Static now: the answer line
          a search once turned it into stays gone (the kinds row counts).
          In the body, as the Trips lede is, and not the header's `lede`:
          the header row aligns its right slot to the bottom of the title
          column, so a line in that column drops the pill a line below
          the title (14 Oct 2026). */}
      <Text style={s.scope} numberOfLines={1} testID={floating ? 'collections-floating-scope' : 'collections-scope'}>
        {onYours
          ? t('Your own favourite places.', 'Nơi chốn yêu thích của riêng bạn.', 'あなただけのお気に入りの場所。', '专属于你的心仪去处。', '專屬於你的心儀去處。')
          : t('Good corners, through the community’s eyes.', 'Những góc hay, qua lăng kính cộng đồng.', 'みんなの目で見つけた、いい場所。', '社区眼中的好去处。', '社群眼中的好去處。')}
      </Text>
      <View onLayout={floating ? undefined : (e) => { tabsYRef.current = Math.round(e.nativeEvent.layout.y); }} testID={floating ? 'collections-floating-tabs' : 'collections-tabs'}>
        {tabsRow(floating)}
      </View>
      {/* The box, and the panel it opens. It stood outside the list
          until 25 Oct 2026 — a box that scrolled away with the shelf was
          the one the owner's review of 14 Oct called hard to find — and
          goes up with the shelf now, because the dock brings it back from
          any depth (`findFromDock`) and the screen it took is the lists'.
          Since 7 Nov 2026 it is drawn only while open (see `searching`). */}
      {!holding && open && (
        <View style={s.searchRow}>
          <SearchField
            inputRef={!floating && pinned && headerExpanded && session ? undefined : inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setPanel(true)}
            // Opened by the dock, it comes up ready for words.
            // The pinned copy never takes focus of its own accord.
            autoFocus={!floating}
            onSubmitEditing={noteSearch}
            testID={{ input: floating ? 'collections-floating-input' : 'collections-input', cancel: floating ? 'collections-floating-cancel' : 'collections-cancel' }}
            // The four things it answers by, named in the box itself.
            // A person, not "@username" (owner, 21 Oct 2026): on a phone
            // the box cut it to "@use…", which read as nothing, and the
            // search finds a curator by the handle typed with or without
            // the @ anyway. No "or": a list of four needs no conjunction
            // to be read as one.
            placeholder={t('Name, place, city, user', 'Tên, địa điểm, thành phố, người dùng', '名前・スポット・都市・ユーザー', '名称、地点、城市、用户', '名稱、地點、城市、使用者')}
            // Inside the box, while the panel is up or anything it chose
            // is still on — see `SearchField`.
            // Always, while it is open: Cancel is how it is put away.
            cancel={{ shown: true, label: t('Cancel', 'Hủy', 'キャンセル', '取消', '取消'), onPress: cancel }}
          />
        </View>
      )}
      {kindsRow(floating)}
      {/* Drawn only when there is something in it: the box's own
          placeholder already says what it answers, and a hint under it
          saying the same was the owner's to strike (25 Oct 2026). */}
      {!holding && panel && suggestions.length > 0 && (
        <View style={s.panel} testID={floating ? 'collections-floating-panel' : 'collections-panel'}>
          {suggestions.length > 0 && (
            <Card style={s.recents}>
              <View style={s.legendRow}>
                <Text style={s.legend}>{t('Suggestions', 'Gợi ý', '候補', '推荐', '推薦')}</Text>
                <PressableScale
                  onPress={() => keepRecents([])}
                  scaleTo={0.92}
                  hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('Clear suggestions', 'Xóa gợi ý', '候補を消去', '清除推荐', '清除推薦')}
                >
                  <Text style={s.clear}>{t('Clear', 'Xóa', '消去', '清除', '清除')}</Text>
                </PressableScale>
              </View>
              {suggestions.map((term) => (
                <PressableScale
                  key={term}
                  contentStyle={s.suggestion}
                  scaleTo={0.97}
                  onPress={() => { setQuery(term); answered(); }}
                  accessibilityRole="button"
                  accessibilityLabel={term}
                >
                  <Glyph name="search-outline" size={ICON.action} color={colors.textTertiary} />
                  <Text style={s.suggestionText} numberOfLines={1}>{term}</Text>
                </PressableScale>
              ))}
            </Card>
          )}
        </View>
      )}
    </View>
  );

  const mosaicCard = ({ c, at }: MosaicEntry<Collection>, width: number, height: number, featured = false) => {
    const caption = mosaicCaption(c.slug);
    const below = caption === 'below';
    const uri = coverFor(c);
    const title = t(c.title_en, c.title_vi, c.title_ja);
    // Bare, beside a face (owner, 14 Nov 2026), as the collection page's
    // head and the activity rows have it: the `@` stays where a handle
    // stands in a sentence or under a real name, and a byline is neither.
    const author = c.curator_handle ? normalizeHandle(c.curator_handle) : '';
    const blurb = featured && !below ? t(c.desc_en, c.desc_vi, c.desc_ja)?.trim() : '';
    // "New" on the Mosaic as on a tile. Mosaic has been Community's own
    // view since #1257 and never drew the mark, so a list made this week
    // went unmarked on the screen most readers open (owner, 11 Nov 2026).
    // Top-left of the photograph as everywhere else — except where the
    // caption itself sits top-left, over the words' first line: there the
    // badge rides at the head of the caption, above the title, still in
    // the corner and over nothing.
    const fresh = isNewList(c, now);
    const words = (
      <View style={[
        s.mosaicWords,
        below && s.mosaicWordsBelow,
        featured && !below && s.mosaicWordsFeatured,
      ]}>
        {fresh && caption === 'top' ? <NewBadge style={s.mosaicBadgeInline} /> : null}
        <Text
          style={[s.gcardTitle, featured && s.mosaicTitleFeatured, below ? s.mosaicTitleBelow : s.mosaicInkShadow]}
          numberOfLines={2}
        >{title}</Text>
        {blurb ? <Text style={[s.mosaicBlurb, s.mosaicInkShadow]} numberOfLines={2}>{blurb}</Text> : null}
        {/* Who made it, said with a face, as the tiles say it (owner,
            14 Nov 2026): with the `@` gone, the face is what tells a name
            from one more word of the title. 16, not the tiles' 18: the
            words beside it are 12, not 13, and the face stays a little
            taller than their line. */}
        {author ? (
          <View style={s.mosaicBy} testID={`collection-mosaic-by-${c.slug}`}>
            <Avatar url={c.owner_id ? faces[c.owner_id]?.avatar_url : undefined} size={16} />
            <Text style={[s.mosaicAuthor, below ? s.mosaicAuthorBelow : s.mosaicInkShadow]} numberOfLines={1}>{author}</Text>
          </View>
        ) : null}
      </View>
    );
    return (
      <PressableScale
        key={c.slug}
        contentStyle={[s.mosaicCard, { width, height }]}
        onPress={() => { noteSearch(); navigation.navigate('CollectionDetail', { slug: c.slug }); }}
        testID={`collection-card-${at}`}
        accessibilityRole="button"
        accessibilityLabel={`${title}${fresh ? `, ${newWord}` : ''}${author ? `, ${author}` : ''}`}
      >
        <View style={s.mosaicPhoto} testID={`collection-mosaic-${c.slug}-${caption}`}>
          {uri
            ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <EmptyCover />}
          {fresh && caption !== 'top' ? <NewBadge /> : null}
          {!below ? (
            // The dark lives inside the caption, so it is exactly as long
            // as the words are, and the tail hangs off its far side into
            // the photograph — no measuring, no first frame without it.
            // Both run from the edge the caption sits on. See `mosaicScrim`.
            <View
              style={[s.mosaicOverlay, caption === 'top' ? s.mosaicWordsTop : s.mosaicWordsBottom]}
              pointerEvents="none"
              testID={`collection-mosaic-scrim-${c.slug}`}
            >
              <LinearGradient
                colors={mosaicScrim.body}
                start={{ x: 0, y: caption === 'top' ? 0 : 1 }}
                end={{ x: 0, y: caption === 'top' ? 1 : 0 }}
                style={StyleSheet.absoluteFill}
                testID={`collection-mosaic-body-${c.slug}`}
              />
              <LinearGradient
                colors={mosaicScrim.tail}
                locations={mosaicScrim.tailLocations}
                start={{ x: 0, y: caption === 'top' ? 0 : 1 }}
                end={{ x: 0, y: caption === 'top' ? 1 : 0 }}
                style={[s.mosaicTail, caption === 'top' ? s.mosaicTailBelow : s.mosaicTailAbove]}
                testID={`collection-mosaic-tail-${c.slug}`}
              />
              {words}
            </View>
          ) : null}
        </View>
        {below ? words : null}
      </PressableScale>
    );
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
        {holding || (colsFail && cols.data.length === 0) ? top() : null}
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
                {top()}
                {colsFail && cols.data.length > 0 ? (
                  <LoadFailBanner kind={colsFail} onRetry={cols.reload} testID="collections-load-banner" />
                ) : null}
                <GuestNotice navigation={navigation} />
              </>
            )}
            renderItem={({ item, section }) => {
              if (item.kind === 'mosaic') {
                const width = winW - space.page * 2;
                return (
                  <View style={s.gridRow} testID={`collection-mosaic-row-${item.layout}`}>
                    {item.layout === 'feature'
                      ? mosaicCard(item.items[0], width, Math.round(gcardW * 1.28), true)
                      : item.layout === 'stack' ? (
                        <>
                          {mosaicCard(item.items[0], gcardW, gcardH * 2 + space.cardGap)}
                          <View style={{ gap: space.cardGap }}>
                            {item.items.slice(1).map((entry) => mosaicCard(entry, gcardW, gcardH))}
                          </View>
                        </>
                      ) : item.items.map((entry) => mosaicCard(entry, gcardW, gcardH))}
                  </View>
                );
              }
              // Otherwise a pair of tiles: the only shape left besides the
              // Mosaic since the list view went (owner, 7 Nov 2026).
              return (
                <View style={s.gridRow}>
                  {item.pair.map((c, j) => {
                    const uri = coverFor(c);
                    const members = membersOf(c, places).length;
                    const reason = reasonFor(c.slug);
                    const my = !!c.id && myLikes.includes(c.id);
                    const fresh = isNewList(c, now);
                    return (
                      <PressableScale
                        key={c.slug}
                        contentStyle={[s.gcard, { width: gcardW, height: gcardH }]}
                        onPress={() => { noteSearch(); navigation.navigate('CollectionDetail', { slug: c.slug }); }}
                        testID={item.own ? undefined : `${section.shared ? 'collection-shared' : 'collection-card'}-${item.at + j}`}
                        accessibilityRole="button"
                        // A shared tile says whose it is, as the heading
                        // above it says it is not yours: the face is not
                        // read out, and the handle is the one fact that
                        // tells two friends' lists apart.
                        accessibilityLabel={item.own
                          ? `${t(c.title_en, c.title_vi, c.title_ja)}${fresh ? `, ${newWord}` : ''}, ${visibilityOf(c)}`
                          : `${t(c.title_en, c.title_vi, c.title_ja)}${fresh ? `, ${newWord}` : ''}${section.shared && c.curator_handle ? `, ${normalizeHandle(c.curator_handle)}` : ''}`}
                      >
                        {uri
                          ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                          : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
                        {/* The Explore shelf's scrim, the one `coverScrim`
                            — same object, same card language, second
                            surface. It began at 55% here once, to give the
                            picture back; that left a white photograph's
                            title at 2.5:1. See `coverScrim`. */}
                        <LinearGradient
                          colors={coverScrim.colors}
                          locations={coverScrim.locations}
                          style={StyleSheet.absoluteFill}
                          testID="collection-card-scrim"
                        />
                        {fresh ? <NewBadge /> : null}
                        {/* ── only the exception is marked (owner, 2 Nov 2026) ──
                            A private list of yours wears a padlock in the
                            top-right corner; a public one wears nothing.
                            The globe stood in every tile's foot, and most
                            of your lists are public (five of six on the
                            owner's screen), so it said the default on
                            nearly every tile. The padlock alone says the
                            one thing that differs, and its absence reads
                            as "anyone can see this".

                            In a 24pt disc of the card ground, the "New"
                            badge's own (top-left, 10pt in), so the two
                            marks on a photograph are one kind of thing:
                            a bare glyph under the scrim's 0.22 top was
                            lost on a white sky. VoiceOver still hears
                            Public or Private in the tile's name.

                            A private list shared with friends wears two
                            heads in the same disc instead (13 Nov 2026):
                            still the exception — it is not public — but
                            not "only me" either, and a padlock on a list
                            three friends are reading would be the tile
                            saying the opposite of the list's own page.

                            Both in outline, at 13 in the 24 disc (owner,
                            13 Nov 2026): the glyphs the list's own page
                            draws for the same two states, at its foot and
                            in its sheet, and the line the tab bar and the
                            place pin are drawn in. They were filled at
                            12 until then. A filled padlock is a solid
                            black block on a photograph, the loudest thing
                            on the tile after its title, and filled at 12
                            the two heads ran into one blob. The outline's
                            stroke is 32/512 of its size: 0.75pt at 12,
                            0.81 at 13, so the point gained gives back
                            some of the weight the fill took away. */}
                        {item.own && !c.is_public ? (
                          seenFor(c) === 'friends' ? (
                            <View style={s.gcardLock} testID="collection-tile-shared">
                              <Glyph name="people-outline" size={ICON.meta} color={colors.text} />
                            </View>
                          ) : (
                            <View style={s.gcardLock} testID="collection-tile-lock">
                              <Glyph name="lock-closed-outline" size={ICON.meta} color={colors.text} />
                            </View>
                          )
                        ) : null}
                        <View style={s.gcardText}>
                          <Text style={s.gcardTitle} numberOfLines={1}>
                            {t(c.title_en, c.title_vi, c.title_ja)}
                          </Text>
                          {/* One meta line, not two.
                              
                              The byline had a row and the count-and-heart
                              had another, and between them they put three
                              lines of text over 40% of the photograph —
                              in the view whose whole reason is the
                              photograph. They are one row now: who made
                              it on the left, the heart on the right.

                              Whose list this is, said with a face: the
                              avatar beside the handle carries the whole
                              of "by", so the word goes. The list rows do
                              the same now, and the detail screen did it
                              before either — three surfaces, one grammar,
                              no verb in any of them. On your own tab neither
                              appears — the byline would only say your own
                              name — and the padlock, which once led this
                              row, sits in the top corner now, private
                              lists only. */}
                          <View style={s.gcardFoot} testID="collection-tile-foot">
                            {!item.own && c.curator_handle ? (
                              <>
                                <Avatar url={c.owner_id ? faces[c.owner_id]?.avatar_url : undefined} size={18} />
                                <Text style={s.gcardBy} numberOfLines={1}>
                                  {normalizeHandle(c.curator_handle)}
                                </Text>
                              </>
                            ) : null}
                            {/* How many places, on your own tiles only.

                                Dropped from other people's tiles because
                                it is the weakest of the four things this
                                card can say: ten places against seven
                                rarely decides a tap, where who made it and
                                how many liked it do — and the like count
                                also explains the order the shelf is in.
                                The full number is still one tap away.

                                Zero is said in words rather than as a
                                count. A list you made and never filled is
                                the one size that changes what you do next
                                — and only yours can be empty here: the
                                community shelf drops empty lists before
                                they reach a tile (see `visible`). */}
                            {/* Narrowed, the reason stands in for the count
                                on every tile — the one time a community
                                tile says anything about its places, since
                                which of them the chip reached is what the
                                reader just asked. */}
                            {reason ? (
                              <Text style={s.gcardMeta} numberOfLines={1}>{reason}</Text>
                            ) : item.own && (members === 0 ? (
                              <Text style={s.gcardMeta} numberOfLines={1}>
                                {t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません', '还没有地点', '還沒有地點')}
                              </Text>
                            ) : (
                              // The pin and the figure (owner, 2 Nov 2026),
                              // as on the Explore shelf and the list's own
                              // card; spoken in full.
                              <View
                                style={s.gcardCount}
                                accessible
                                accessibilityLabel={placesOf(members)}
                                testID="collection-tile-count"
                              >
                                <Glyph name="location-outline" size={ICON.meta} color={onPhoto.textSecondary} />
                                <Text style={s.gcardMeta}>{members}</Text>
                              </View>
                            ))}
                            {/* Only where a like is possible: a private
                                list is one nobody may like, and a heart
                                on it would be an invitation to nothing.

                                On your own tile too, the same control
                                (owner, 17 Oct 2026): a curator may like
                                their own list, and it draws at any count
                                — the list nobody has liked yet is the
                                one that most needs the invitation. */}
                            {c.id && c.is_public ? (
                              <LikeHeart
                                tone="photo"
                                liked={my}
                                count={likes[c.slug] ?? 0}
                                onPress={() => onHeart(c)}
                                style={{ marginLeft: 'auto' }}
                                contentStyle={s.gcardLikes}
                                countStyle={s.gcardMeta}
                                hitSlop={{ top: 14, bottom: 14, left: 16, right: 12 }}
                              />
                            ) : null}
                          </View>
                        </View>
                      </PressableScale>
                    );
                  })}
                  {item.pair.length === 1 ? <View style={{ width: gcardW }} /> : null}
                </View>
              );
            }}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (section.shared ? sharedHead(section.shared.count) : !section.city ? null : section === sections[0]
              ? <View style={s.firstGap} testID="collections-first-gap" />
              : cityHead(section.city, false))}
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
            renderSectionFooter={({ section }) => {
              // Under a query, the only footer is the honest one: nothing
              // matched. The creation rows stay out of it — "start your
              // first collection" under a search that found nothing would
              // be answering a question nobody asked.
              if (asked) {
                // Once, and only when nothing anywhere matched: on Yours
                // the lists shared with you are a second section, and a
                // miss among your own above a hit among theirs is not
                // "nothing here".
                if (sections.some((x) => x.data.length > 0)) return null;
                return q
                  ? <Empty text={t(`Nothing here matches "${q}".`, `Không có gì khớp với "${q}".`, `「${q}」に一致するものはありません。`, `没有与“${q}”匹配的内容。`, `沒有與「${q}」相符的內容。`)} />
                  : <Empty text={t('No collections match that choice.', 'Không có bộ sưu tập nào khớp lựa chọn đó.', 'その条件に合うコレクションはありません。', '没有符合条件的合集。', '沒有符合條件的合集。')} />;
              }
              if (section.own) {
                return section.data.length === 0
                  ? <FirstCollection onPress={() => navigation.navigate('CollectionForm')} />
                  : null;
              }
              return section.data.length === 0
                ? (
                  <CommunityEmpty
                    signedIn={!!session}
                    onCreate={() => navigation.navigate('CollectionForm')}
                    onExplore={() => navigation.getParent()?.navigate('Explore')}
                  />
                )
                : null;
            }}
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
                {headerExpanded ? top(true) : tabsRow(true)}
              </View>
            ) : null}
            {groups && atCity ? cityHead(atCity, true) : null}
          </View>
        ) : null}
        <ActionSheet
          visible={jumpOpen}
          onClose={() => setJumpOpen(false)}
          header={<Text style={s.jumpTitle}>{t('Go to a city', 'Đến thành phố', '都市へ移動', '前往城市', '前往城市')}</Text>}
        >
          {/* No card around them, as Explore's list has none. */}
          <View>{jumpRows}</View>
        </ActionSheet>
      </View>
      {/* Explore's dock, with this screen's two actions: the whole island
          is the box (`findFromDock`), the pill a new list. "+ Bộ sưu tập",
          "+ Tạo mới", the word every pill that makes something wears, as
          this screen's own header pill does. Guests start no lists. */}
      <DockSlot visible={dock} onPress={findFromDock} accessibilityRole="button" testID="collections-dock">
        <DockOffer
          icon="search"
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
