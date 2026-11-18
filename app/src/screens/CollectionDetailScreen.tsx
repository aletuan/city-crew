import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent, Pressable, Text, useWindowDimensions, View,
} from 'react-native';
import { Glyph, ICON } from '../components/ui/glyph';
import MoreText from '../components/MoreText';
import { KindPills } from '../components/KindPill';
import {
  AmbientWarmth, Avatar, CHIP_SLOP, Card, Empty, PressableScale, Screen,
  fireHaptic, successHaptic, useTabBarClearance,
} from '../components/ui';
import { useEdgeSwipeBack, useListDrag } from '../components/useListDrag';
import { useDuckOnScroll, useTabBarDucked } from '../components/tabBarDuck';
import { DockOffer, DockSlot, useDockOffer } from '../components/DockSlot';
import { AddCell, AddPill } from '../components/add';
import { useProfile, useSession } from '../lib/auth';
import { categoriesOf } from '../lib/categories';
import { narrowTo } from '../lib/collectionKinds';
import { useCollections, useCuratorAvatar, useLikes, usePlaces } from '../lib/catalog';
import { likesWorthShowing } from '../lib/likes';
import {
  deleteCollection, isNotShareable, membersOf, setCollectionPublic, setShares,
  unseenMembers, unseenSentence, useCountView, useMyListShares, usePrefetchOwnListActivity, useProfileByHandle, useSharedWithMe,
  type Collection,
} from '../lib/data';
import { useCrew } from '../lib/crew';
import { splitFriendships } from '../lib/friends';
import LikeHeart from '../components/LikeHeart';
import { likeable, namesBriefly, readerMark, SEEN_GLYPH, seenName, sharesByList, visibilityOf } from '../lib/shares';
import ShareSheet from '../components/ShareSheet';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useCurrentCity } from '../lib/city';
import { useReport } from '../components/reportFlow';
import ActionSheet, { SheetRows, type SheetAction } from '../components/ActionSheet';
import { useMyLists, useSaveActions } from '../lib/save';
import { readerKey, COLLECTION_VIEW_KEY } from '../lib/readerPrefs';
import { oneOf, useStored } from '../lib/stored';
import { useNoteEvent } from '../lib/tasteProfile';
import { useI18n } from '../lib/i18n';
import { ageWord, listAgeOf } from '../lib/listAge';
import { colors, space } from '../theme';
import type { Place } from '../lib/types';
import { goTo, type Nav, type RootRoute } from '../nav';
import { DraggableCard, DraggableTile, LiftCell, LiftedCard, StillCard, StillTile } from './collectionDetail/cells';
import { OwnEmpty } from './collectionDetail/OwnEmpty';
import { ReaderSeen, readerWord, sendRows, ShareButton, ShareHead, whoHint } from './collectionDetail/Share';
import { CommentsDoor } from './collectionDetail/CommentsDoor';
import { ACT_GLYPH, ACTIVITY_CHEVRON, BYLINE_SLOP, FACE, GRID_GAP, s } from './collectionDetail/styles';
import { useKindFilter } from './collectionDetail/useKindFilter';
import { useReorderDraft } from './collectionDetail/useReorderDraft';

/** What a change of who-sees-it says to VoiceOver: published, private
 *  again, or shared with this many people — see `said`. */
type Said = 'public' | 'private' | { shared: number };

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

/* ── the way to your own page, from your own list (owner, 16 Nov 2026) ──
   Somebody else's head opens their page, the whole of it one press. Your
   own could not be that: its second line holds a control — who sees the
   list — and a press around a control swallows it. So on your own list
   the face is a press and the handle is a press, each on its own, and the
   line under them is left alone.

   It was no press at all for a morning. The head had only ever opened a
   sheet to report or block, which nobody does to themselves, and when
   its destination became a page the "not your own" stayed: the owner was
   signed in as the author of the list they tried it on, and nothing
   happened. Your own page is the one worth opening first — it is how
   everybody else sees you.

   Outside the screen's function, which is at its ceiling (`oversize.js`). */
const ownDoor = (navigation: Nav, owned: boolean, handle: string) =>
  (owned && handle ? () => navigation.navigate('Person', { handle }) : undefined);

function FaceDoor({ url, onPress }: { url: string | null; onPress?: () => void }) {
  const { t } = useI18n();
  return (
    <PressableScale
      onPress={onPress}
      // The face is 40; two more each way makes the 44 a thumb is owed.
      hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={t('Your page', 'Trang của bạn', 'あなたのページ', '你的主页', '你的主頁')}
      testID="collection-own-face"
    >
      <Avatar url={url} size={FACE} />
    </PressableScale>
  );
}

export default function CollectionDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'CollectionDetail'> }) {
  const { t, lang } = useI18n();
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
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !loading) setPulling(false);
  }, [pulling, loading]);
  const pull = () => { setPulling(true); cols.reload(); mine.reload(); shared.reload(); placesReload(); listShares.reload(); };
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
  /*
   * Who your list is shared with (13 Nov 2026), and so which of three
   * words the line under your handle says — `lib/shares.visibilityOf`:
   * Public, Friends (not public, shared with somebody) or Private.
   *
   * Read for every list you own at once, the read the Collections tab's
   * tiles make too (`useMyListShares`), and remembered between launches,
   * so a shared list opens saying Friends rather than Private-then-Friends.
   * Somebody else's list asks nothing: who it is shared with is its
   * owner's business, and the policy would show you only your own row.
   *
   * The crew is the picker's: accepted friends in the crew's own order,
   * and the faces that name them on the sheet's Friends row.
   */
  const listShares = useMyListShares(owned ? uid : null);
  const sharedWith = useMemo(
    () => (col?.id ? sharesByList(listShares.data)[col.id] ?? [] : []),
    [listShares.data, col?.id],
  );
  const seen = visibilityOf(isPublic, sharedWith.length);
  const seenWord = seenName(seen, t);
  const { ships, blocks, people } = useCrew();
  const friendIds = useMemo(() => (uid ? splitFriendships(ships.data, uid).friends : []), [ships.data, uid]);
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
  const someUnseen = unseen.pending + unseen.flagged > 0;
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
  /*
   * The two views, in either menu: how a list is looked at is the
   * reader's, whoever made the list. A choice of two under its own name,
   * the one in force ticked, as iOS's own Files does it (owner, 22 Oct
   * 2026, from the reference). It was one row naming where it went —
   * "List view" while in the grid — which said nothing about where you
   * were.
   *
   * In the sheet since 13 Nov 2026 they are a card of their own under
   * the name, between the acts above and below them: a tick among verbs
   * would read as one more thing done, and `SheetAction.selected` is for
   * a choice between states, which these two are and the rest are not.
   *
   * ── the grid notice, removed (owner, 12 Nov 2026) ──
   * From 22 Oct a banner under the card said lists now open as a grid
   * and pointed here, with a ring pulsing round ⋯, until the reader
   * closed it. Three weeks on it was news to almost nobody it reached:
   * 59 of 107 accounts had joined after the grid became the default and
   * never knew the cards as one, and 55 of the 61 active in the last
   * fortnight had never closed it, so it stood over the photographs on
   * every list. The way back to the cards is still here, in this menu.
   * `preferences.grid_notice_closed_at` stays in the table: dropping it
   * is a live migration that would change nothing a reader sees.
   */
  const viewRows: SheetAction[] = [
    {
      key: 'grid',
      icon: 'grid-outline',
      title: t('Grid', 'Dạng lưới', 'グリッド', '网格', '網格'),
      selected: grid,
      onPress: () => pickView('grid'),
      testID: 'collection-menu-grid',
    },
    {
      key: 'list',
      icon: 'list-outline',
      title: t('List', 'Dạng danh sách', 'リスト', '列表', '列表'),
      selected: !grid,
      onPress: () => pickView('list'),
      testID: 'collection-menu-list',
    },
  ];

  // Search, opened for this list (owner, 23 Oct 2026). It used to be the
  // Explore tab, where saving a place offered this list by name: a trip
  // out of the list, a sheet per place, and a way back that was not the
  // one the reader came by. Search in this tab's own stack puts a ⊕ for
  // this list on every place it finds, and back is back to the list.
  const addPlace = () => {
    if (col) navigation.navigate('Search', { addTo: col.slug });
  };

  const edit = () => {
    if (!col) return;
    navigation.navigate('CollectionForm', { slug: col.slug, title, desc });
  };

  /**
   * Publish, or take it back.
   *
   * No confirmation, and since 17 Oct 2026 no Undo either (owner: the
   * banner looked busy with it). An alert asking "are you sure" before a
   * reversible act is a toll on everyone who meant it. The Undo was the
   * way back while the switch was one tap in the ⋯ menu, where a slip
   * was easy; it is two deliberate taps now — the word under your handle
   * at the card's head, then the answer in the sheet — and the way back
   * is the same two taps on the same word, which stays on screen.
   *
   * Both catalogs are reloaded because the row moves between them: it
   * leaves nothing in `mine`, which returns everything you own either
   * way, but it enters and leaves the public query, and that query is
   * what the other section is drawn from.
   *
   * ── three answers, and what each does to the other two ──
   *
   * Since 13 Nov 2026 a list can also be shared with chosen friends, and
   * the three answers are written to two places — `is_public` and the
   * share rows — so each says what it does to the column it is not named
   * after (owner's calls, the same day):
   *
   * - Public keeps the shares. The migration's rule: a list that is
   *   public and shared is simply public, and its shares wait, applying
   *   again if it goes private. The card says Public.
   * - Friends on a public list makes it private as well — a shared list
   *   is a private list with a guest list — and the picker's subtitle
   *   says so before the press (`saveShares`).
   * - Private takes every share off, the waiting ones behind a public
   *   list included. It is the owner's "only me", and leaving the shares
   *   would make it Friends the moment it stopped being public — the
   *   answer they did not choose.
   */
  const [publishing, setPublishing] = useState(false);
  // No check for places under review here: a list goes public with them
  // in, and they stay out of everyone else's sight until they are live
  // (`*_lists_stay_public_around_unlive_places.sql`). The Public row says
  // how many (see `whoSeesRows`).
  const publish = () => {
    if (!col || publishing) return;
    setPublishing(true);
    setCollectionPublic(col.slug, true)
      .then(() => {
        mine.reload();
        cols.reload();
        said('public');
      })
      .catch((e: Error) => Alert.alert(
        t('Could not publish', 'Không công khai được', '公開できませんでした', '无法公开', '無法公開'),
        e.message,
      ))
      .finally(() => setPublishing(false));
  };
  const cannotMakePrivate = () => t('Could not make private', 'Không chuyển riêng tư được', '非公開にできませんでした', '无法设为私密', '無法設為私密');
  /* Only you: the shares off first, then the flag. In that order so that
     no moment in between shows the list to more people than before —
     the other order would, for a public list with shares waiting, hand
     it to those friends the instant it went private. `setShares` asks
     nothing when there is nobody to take off.

     The id is there whenever there is a share to take off: the shares
     are filed by it (`sharedWith`). */
  const makePrivate = () => {
    if (!col || publishing) return;
    const wasPublic = isPublic;
    setPublishing(true);
    setShares(col.id as string, [], sharedWith)
      .then(() => (wasPublic ? setCollectionPublic(col.slug, false) : undefined))
      .then(() => {
        listShares.reload();
        if (wasPublic) { mine.reload(); cols.reload(); }
        said('private');
      })
      .catch((e: Error) => Alert.alert(cannotMakePrivate(), e.message))
      .finally(() => setPublishing(false));
  };
  /* The picker's press: share with the ticked, take it from the
     unticked, and — for a public list being shared — make it private,
     after the shares, for the reason `setShares` gives. Nobody ticked is
     the picker's Keep private, which only a list that is not public
     offers (`shareCta`), so it never unpublishes.

     The catalogs reload only when the flag moved: shares are not in
     them, and the public query is the heaviest read the app makes.

     A refusal of a friend is the crew having moved on their phone — an
     unfriend or a block since the crew was read. Nothing was written
     (the insert fails whole, and the removal comes after it), so the
     sheet stays open with its ticks, the crew is read again so the name
     goes, and the alert says why rather than relaying a policy. */
  const [picking, setPicking] = useState(false);
  const saveShares = (list: Collection, add: string[], remove: string[]) => {
    const n = sharedWith.length + add.length - remove.length;
    const unpublish = n > 0 && isPublic;
    setPublishing(true);
    setShares(list.id as string, add, remove)
      .then(() => (unpublish ? setCollectionPublic(list.slug, false) : undefined))
      .then(() => {
        listShares.reload();
        if (unpublish) { mine.reload(); cols.reload(); }
        setPicking(false);
        said(n > 0 ? { shared: n } : 'private');
      })
      .catch((e: Error) => {
        if (isNotShareable(e)) ships.reload();
        Alert.alert(
          n > 0 ? t('Could not share', 'Không chia sẻ được', '共有できませんでした', '无法分享', '無法分享') : cannotMakePrivate(),
          isNotShareable(e)
            ? t(
              'Someone you ticked is no longer in your crew, so nothing was shared. Try again without them.',
              'Có người bạn chọn không còn trong nhóm, nên chưa chia sẻ gì cả. Hãy thử lại không có họ.',
              '選んだ人の中に、もう仲間ではない人がいるため共有されませんでした。その人を外してもう一度お試しください。',
              '你勾选的人中有人已不在你的好友里，所以没有分享。请去掉对方后再试一次。', '你勾選的人中有人已不在你的好友裡，所以沒有分享。請去掉對方後再試一次。',
            )
            : e.message,
        );
      })
      .finally(() => setPublishing(false));
  };

  /* A change that landed: a success tick under the thumb, and the
     sentence to VoiceOver. Nothing drawn — the word under your handle
     has already changed, and it is the record (owner, 13 Nov 2026).

     Rejected, and removed that day: a banner above the card for three
     seconds ("Bộ sưu tập này đã riêng tư trở lại"). It said again what
     the card's word said and kept saying, and it sat in the flow, so it
     pushed the card and the grid down by its height and margin (11 +
     a 20pt line + 11, then 12: about 54pt; 51 on the owner's screenshot)
     and pulled them back up three seconds later — two moves of the whole
     page for news the reader had just made. It earned its row while it
     held the only Undo; the Undo went on 17 Oct, and the way back is the
     same word, which stays. A toast floating over the list was not the
     answer either: it would hide part of the list to report on it.

     The sentence stays for VoiceOver because a reader who cannot see the
     card's word change would otherwise hear nothing at all —
     `accessibilityLiveRegion` is Android's alone. Failures still alert:
     those are what the reader cannot see for themselves. */
  const saidText = (which: Said) => which === 'public'
    ? t('This collection is now public', 'Bộ sưu tập này giờ đã công khai', 'このコレクションは公開されました', '这个合集已公开', '這個合集已公開')
    : which === 'private'
      ? t('This collection is private again', 'Bộ sưu tập này đã riêng tư trở lại', 'このコレクションは非公開に戻りました', '这个合集已改回私密', '這個合集已改回私密')
      : t(
        `Shared with ${which.shared} ${which.shared === 1 ? 'person' : 'people'}`,
        `Đã chia sẻ với ${which.shared} người`,
        `${which.shared}人と共有しました`,
        `已与 ${which.shared} 人分享`, `已與 ${which.shared} 人分享`,
      );
  const said = (which: Said) => {
    successHaptic();
    AccessibilityInfo.announceForAccessibility(saidText(which));
  };

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

  /**
   * Take this list into your own collections.
   *
   * The answer to a question the app could not answer before: you find a
   * list you like, and the only things you can do with it are like it and
   * leave. Liking is a compliment. This is the one that lets you use it —
   * your copy, your order, your additions, and the original untouched.
   *
   * ── through the form, not on the spot ──
   *
   * Nothing is created here. The row hands the source's facts to the
   * collection form — the title (which the form offers back as "Copy of
   * X", editable before anything exists), the description as the curator
   * wrote it, the members in the curator's order — and the copy is
   * born only when the reader saves there. Backing out of the form
   * creates nothing, so a curious tap costs nothing to undo.
   *
   * ── the credit, kept out of the text ──
   *
   * The copy used to carry a "Copied from @curator" line appended to its
   * description, back when that was the only record of where a copy came
   * from. It no longer is: the form writes `copied_from` onto the new row
   * (see `CollectionFormScreen`), and the curator hears about the copy in
   * Activity through `copies_of_mine`. The line had become a stamp in
   * somebody else's words — the copier's first edit was to delete it, it
   * was written in whichever language the copier happened to read, and
   * the form saved that one string into every language column. So the
   * description now carries only what the curator wrote, and where the
   * copy came from lives in the data, not on the screen (owner, 15 Oct
   * 2026).
   *
   * ── the city, from the list rather than from the tab ──
   *
   * `col.city_id`, falling back to the city on screen. The fallback
   * exists for the legacy select that omits the column. The public query
   * is no longer city-scoped (a list appears in every city it has a place
   * in — see `fetchCollections`), so the stamp can differ from the tab;
   * the copy takes the original's stamp, not the tab's.
   */
  const copyCityId = col?.city_id || city?.id;
  // Where the copy's two doors open — the ⋯'s sheet and the dock's pill
  // (the card's corner was a third until 13 Nov 2026): with a city to
  // file it under, and never on a list lent to you (`sharedToMe`).
  const canCopy = !!copyCityId && !sharedToMe;
  const copyRef = useRef<() => void>(() => {});
  const copy = () => {
    if (!col) return;
    // Signed out this is the sheet, not an error: wanting somebody's list
    // is a good moment to be offered an account, and a disabled row would
    // have explained nothing.
    // Signed in, the copy is finished on the reader's return: the form
    // opens and waits for them, so nothing is written unasked. Through
    // the ref because the `copy` that runs must be a render that knows
    // the reader is signed in — this one does not.
    if (!uid) { askToSignIn('copy', () => copyRef.current()); return; }
    const cityId = copyCityId;
    if (!cityId) return;
    const sourceDesc = t(col.desc_en, col.desc_vi, col.desc_ja)?.trim() || '';
    navigation.navigate('CollectionForm', {
      copyFrom: {
        sourceId: col.id,
        cityId,
        title,
        desc: sourceDesc,
        // The order on screen, which is `sort_order` already resolved by
        // `membersOf` — copying the list means copying the sequence the
        // curator chose, not the order the rows happen to come back in.
        placeSlugs: members.map((p) => p.slug),
      },
    });
  };
  copyRef.current = copy;

  const remove = () => Alert.alert(
    t('Delete this collection?', 'Xoá bộ sưu tập này?', 'このコレクションを削除しますか？', '删除这个合集？', '刪除這個合集？'),
    t(`"${title}" will be gone for good.`, `"${title}" sẽ mất hẳn.`, `「${title}」は完全に削除されます。`, `“${title}”将被永久删除。`, `「${title}」將被永久刪除。`),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除', '删除', '刪除'),
        style: 'destructive',
        onPress: () => {
          if (!col) return;
          deleteCollection(col.slug)
            // Leaving first: the screen is about a row that no longer
            // exists, and the list behind it is where the outcome shows.
            //
            // The members left the saved set with the list, and the taste
            // profile has to hear it — without these, their last recorded
            // verb stays `save` forever and a thrown-away list keeps
            // counting as liked (#315). After the delete, never before:
            // a failed delete must not leave false events behind.
            .then(() => {
              for (const m of members) note(m.slug, 'unsave');
              navigation.goBack();
              // Both catalogs, as publish and reorder do: a public list
              // also lives in the public query, and without this it stays
              // on the Explore shelf and in search after it is gone.
              mine.reload();
              cols.reload();
            })
            .catch((e: Error) => Alert.alert(t('Could not delete', 'Không xoá được', '削除できませんでした', '无法删除', '無法刪除'), e.message));
        },
      },
    ],
  );

  /* Who can see this list, and the place to change it (owner, 16 Oct
     2026). It sat under the title as a line of its own and was changed
     from the ⋯ menu, which split one fact across two places: the header
     said what it was, a menu row said how to make it the other thing.
     The header lost it so the title stands alone the way a visitor's
     does, and the menu lost its row so the way to the switch is the word
     that names the state — tap "Private" to choose who sees it.

     ── under your handle (owner, 13 Nov 2026) ──
     From 16 Oct it stood at the card's foot, after the heart. It is on
     the line under your handle now, after the list's age — "2h · 🔒
     Private ⌄" — where a post says who sees it: beside who wrote it and
     when, not under what it says. The same control, the same sheet;
     only its height changed, the line's 20 drawn and the rest of 44 in
     slop (`BYLINE_SLOP`).

     The owner's alone. A visitor meets a public list or one a friend
     shared with them, and a word telling them which would be a fact
     about nothing they can change.

     The padlock the list already uses for the same fact, so a private
     collection looks the same wherever you meet it — and a globe once it
     is not private any more. The chevron is what says the word opens
     something; without it the row reads as a label.

     Bare: the glyph, the word and the chevron on the card, no fill and
     no outline (owner, 12 Nov 2026). It wore a pill for a day — the
     glass fill and hairline a kind pill wears, from a reference — and
     the owner took it off again: the kinds above it had just lost their
     pills, and one boxed word under a row of bare ones read as the odd
     one out. The chevron is what says it opens something. The word
     stays: the reference drew the glyph alone, and the third state is
     here now — Friends, a list shared with chosen friends (13 Nov 2026)
     — whose two heads (`people-outline`) nobody could read as "shared
     with some friends" unaided. VoiceOver hears the word either way.

     Every state wears one grey (owner, 12 Nov 2026). Public was the
     app's green, semibold, as "the state worth checking". It read as
     the loudest thing on the card after the title, for a setting. The
     green also says "fine" everywhere else ("open now", a success
     banner), and Public is a choice, not a success. It was the same
     green on every look, Slate's two tones included. The globe and the
     padlock already say which state it is. The grey is `textTertiary`,
     the list's age beside it on the same line, and the step the
     chevron was already in (owner, 13 Nov 2026). It was `textSecondary`,
     one step above the heart's tally, on the reasoning that a control
     outranks a count; on the card that put the age, the control and
     "Read more" in the description's own ink (`descText`), so the lines
     about the list read as loud as the list. On Teal that is 9.35:1 on
     the card for the description and 5.65 for these now. The control is still told from the tally by its chevron and
     its place, not by its ink.

     The glyph alone since 17 Nov 2026: the word and the chevron went,
     and the control with them in all but the press. The owner did not
     like a setting standing in the line that says who made the list and
     when; it is Share at the card's foot now (`collectionDetail/Share`,
     which has the argument), and what stays here is a mark of how the
     list stands. Everything above about the word and the chevron is how
     it came to be one grey glyph; `seenWord` is what VoiceOver is told.
     It still opens the sheet, for whoever learned to press here.

     The globe was gone for a day (17 Nov 2026: "no mark is public") and
     the owner asked for it back the next morning, small, after the
     time, as a public post wears one on Facebook: with it a list of your
     own always says how it stands, and its absence is not left to be
     read. A person's page says it in the same glyph (`person.seenOn`).

     Tapping opens a choice rather than flipping the switch: a word that
     changes who can see your list on one touch is a word nobody would
     dare tap to find out what it does. */
  const [whoSees, setWhoSees] = useState(false);
  const visibility = owned ? (
    <PressableScale
      contentStyle={s.visibility}
      scaleTo={0.94}
      haptic="selection"
      // On the button scale: the byline's 20 drawn, 44 to the thumb.
      hitSlop={BYLINE_SLOP}
      onPress={() => setWhoSees(true)}
      accessibilityRole="button"
      // The word the glyph stands for: VoiceOver has no glyph to read.
      accessibilityLabel={seenWord}
      accessibilityHint={whoHint(t)}
      testID="collection-visibility"
    >
      <Glyph name={SEEN_GLYPH[seen]} size={ICON.text} color={colors.textTertiary} />
    </PressableScale>
  ) : null;

  /* The three answers, each with what it means where the reader will meet
     it. Choosing Public or Private is doing: the sheet closes and the
     word under your handle changes, so there is no confirmation here
     either (see `publish`). The answer already true carries the tick,
     and choosing it again changes nothing — a write that re-saves the
     same boolean would tick under the thumb and tell VoiceOver about a
     change that did not happen (`said`).

     Friends is not a toggle: it opens the picker in this sheet's place
     (`ShareSheet`), because choosing Friends is choosing which. It opens
     it ticked or not — the tick here says only that the list is shared
     now — and the picker's own button is the press that writes. Its
     sentence names who has the list (`namesBriefly`), since this row is
     where an owner looks to check, and says what the answer means while
     nobody has it yet.

     No Cancel row. No other sheet in the app has one: the backdrop and
     the grabber are the way out, and the backdrop is a control VoiceOver
     names "Close".

     While some places are not public yet, Public says so in place of
     its plain description: the list goes out without them, and the
     owner who shows it to a friend should not be the one surprised that
     a place is missing. Until 23 Oct 2026 the row was dimmed instead and
     the list could not go public at all — and one already public went
     private, unannounced, the moment it gained such a place. */
  const choose = (next: 'public' | 'private') => () => {
    if (next === seen) return;
    if (next === 'public') publish();
    else makePrivate();
  };
  const nameOf = (id: string) => {
    const p = people[id];
    return p?.full_name || (p?.handle ? `@${p.handle}` : t('Someone', 'Ai đó', '誰か', '某人', '某人'));
  };
  const whoSeesRows: SheetAction[] = [
    {
      key: 'public',
      icon: 'globe-outline',
      title: t('Public', 'Công khai', '公開', '公开', '公開'),
      desc: someUnseen
        ? unseenSentence(unseen, t)
        : t('Shown in Explore and in search', 'Hiện trên Khám phá và trong tìm kiếm', '「探索する」と検索に表示されます', '会显示在探索和搜索中', '會顯示在探索和搜尋中'),
      selected: seen === 'public',
      onPress: choose('public'),
    },
    {
      key: 'friends',
      icon: SEEN_GLYPH.friends,
      title: seenName('friends', t),
      desc: sharedWith.length
        ? namesBriefly(sharedWith.map(nameOf), t)
        : t('Only the friends you choose', 'Chỉ những bạn bè bạn chọn', '選んだ友だちだけが見られます', '仅你选择的好友可见', '僅你選擇的好友可見'),
      selected: seen === 'friends',
      onPress: () => setPicking(true),
    },
    {
      key: 'private',
      icon: 'lock-closed-outline',
      title: t('Private', 'Riêng tư', '非公開', '私密', '私密'),
      desc: t('Only you can see it', 'Chỉ mình bạn thấy', '自分だけが見られます', '仅你可见', '僅你可見'),
      selected: seen === 'private',
      onPress: choose('private'),
    },
  ];

  /* One heart, and it is both the gesture and the tally — the shape the
     shelf card settled on: two marks for one meaning is one too many, and
     a number beside a control it does not belong to reads as that
     control's label. Outline is a list you have not liked, filled is one
     you have, and the figure beside it is how many people agree.

     Pressable for everyone, the curator included (owner, 17 Oct 2026):
     you may like your own list, as on any social app. The shelf sorts by
     everybody's likes but yours (`rankLikes`), so the vote fills your
     heart and moves the number without moving the list up. Signed out it
     stays pressable and opens the sign-in sheet; see `onHeart`. `hitSlop`
     buys a 15pt glyph a 44pt target without drawing a disc.

     It prints from one: a `0` reads as "nobody liked this" rather than
     "no votes yet", and below that the heart draws bare — exactly when it
     is most obviously an invitation. */
  // A button on a public list, and on one shared with friends, for the
  // friends and for you — `shares.likeable`.
  const heart = col && likeable(isPublic, owned, sharedWith.length) && col.id ? (
    <LikeHeart
      brief
      liked={liked}
      count={likes[col.slug] ?? 0}
      onPress={onHeart}
      contentStyle={s.like}
      countStyle={s.act}
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
    />
  ) : null;

  /* ── the likes a list kept (owner, 13 Nov 2026) ──
     Since 17 Nov 2026 this is a Private list alone: one shared with
     friends has the heart above, for them and for its owner, and the
     row draws the heart before it looks for this (`heart ?? keptHeart`).
     What follows was written when neither could be liked, and still
     says why a list nobody else can open shows a figure and not a
     button.

     A list that gathered likes while public and then went to Friends or
     Private kept every row in `collection_likes`, and lost them from
     view: the heart above asks `isPublic`, and so did the count. The
     count is now returned for your own lists and for the lists shared
     with you, whatever they are now (`20261113120000_likes_kept_off_
     public.sql`), and this is where it shows.

     Read-only: the same outline in the same grey and the figure beside
     it, so the row looks as it did, but a View, not a button. A new like
     on a list that is not public is refused by the insert policy, so a
     press here would be a control that does nothing — and a filled heart
     would claim a state the reader cannot change. The outline whoever is
     looking, the owner who once liked it included, for the same reason.

     Gated on the count alone, not on who is reading: the server returns
     a non-public list's count only to its owner and to the friends it is
     shared with, so a list with no count here is one the reader may not
     count, or one with no likes, and either way the slot stays empty, as
     it was. No `col.id` either: the figure is read by slug and nothing is
     written.

     VoiceOver reads the figure as a sentence, with no role — there is
     nothing to press. */
  const keptLikes = col && !isPublic ? likes[col.slug] : undefined;
  const keptHeart = keptLikes && likesWorthShowing(keptLikes) ? (
    <View
      style={s.like}
      accessible
      accessibilityLabel={t(
        keptLikes === 1 ? '1 like' : `${keptLikes} likes`,
        `${keptLikes} lượt thích`,
        `${keptLikes}件のいいね`,
        `${keptLikes} 个赞`, `${keptLikes} 個讚`,
      )}
      testID="collection-likes-kept"
    >
      <Glyph name="heart-outline" size={ACT_GLYPH} color={colors.textTertiary} />
      <Text style={s.meta}>{keptLikes}</Text>
    </View>
  ) : null;

  /* ── the activity row (owner, 13 Nov 2026) ──
     The card's last row, under a hairline: the heart, and on your own
     list the way to who liked and copied it (`activityLink`).

     Kept even when it is empty — a private list, or one lent to you,
     has no heart, and holds only the likes it kept (`keptHeart`) when
     it has any — and always `CHIP_H` tall: the row is the activity's
     place, and a card that grew by a row when a list went public, or
     when the activity arrived, would move the grid under it.

     It was the card's foot until this day: the heart and who can see it,
     the count before that. The count went to the kinds' row and who can
     see it to the line under your handle (`visibility`) the same day, so
     what is left is the one fact about how the list is doing.

     The heart leads (owner, 12 Nov 2026). It sat at the end, "where a
     thumb finds a gesture", but the apps this reads beside — Instagram,
     Threads, X — put the like first in the row, and first it stands in
     one place whether the list is yours or somebody else's. */
  /* ── "View activity ›" (owner, 13 Nov 2026) ──
     At the row's right end: who liked the list and who saved a copy, on
     a page of its own (`CollectionActivity`), with its figures behind it.

     For whoever is signed in and can open the list (owner, 15 Nov 2026).
     It was the author's alone, and this comment said why: "Threads draws
     its 'View activity' the same way and to the author alone." It does
     not. The owner sent a screenshot of the link on somebody else's post
     and asked for the same here, all of it, as the author sees it. The
     harder reason it gave has gone too: `likes_on_mine` and
     `copies_of_mine` answer only the owner, and a reader's page now asks
     `likes_on_list` and `copies_of_list`, which answer whoever can read
     the list (`20261115090000_list_activity_for_readers`).

     Not a guest: the page is people with a friend button on each row,
     and the three functions behind it answer signed-in callers only.

     On a private list too, and since 13 Nov 2026 its page lists the
     likes and copies the list gathered while it was public — the two
     functions answer the owner whatever the list is now — which is the
     one thing an owner wondering where the likes went needs to see. The
     row keeps one look whatever the list's state.

     The link is the target, not the row. The heart is in the same row,
     and a row-wide press would turn a thumb that just missed the heart
     into a trip to another screen; and a row that is a button with a
     button inside is one VoiceOver element, which swallows the heart.

     The meta size in the byline's grey, as Threads sets it: a way in, not
     a call to act, so not the accent a tier-4 link wears (`docs/
     architecture.md`, "Bốn cấp nút") — beside the heart's coral when the
     list is liked, a second coral would read as a second state. `CHIP_H`
     drawn, the row's own height, and 44 to the thumb with `CHIP_SLOP`.

     "Activity", where it said "View activity" (owner, 18 Nov 2026): the
     chevron says "open", a person's page already calls the same thing
     "Activity", and the row needed the room for Share's word. VoiceOver
     is still told "View activity". */
  const activityLink = uid && col ? (
    <PressableScale
      onPress={() => navigation.navigate('CollectionActivity', { slug: col.slug })}
      haptic="selection"
      hitSlop={CHIP_SLOP}
      style={s.activityLinkHang}
      contentStyle={s.activityLink}
      accessibilityRole="button"
      accessibilityLabel={t('View activity', 'Xem hoạt động', 'アクティビティを見る', '查看动态', '檢視動態')}
      testID="collection-activity-link"
    >
      <Text style={s.activityLinkText}>{t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')}</Text>
      <Glyph name="chevron-forward" size={ACTIVITY_CHEVRON} color={colors.textTertiary} />
    </PressableScale>
  ) : null;
  // Share, beside the heart: who can see the list, and sending it —
  // `collectionDetail/Share`. Yours alone.
  const shareButton = owned
    ? <ShareButton seen={seen} friends={sharedWith.length} onPress={() => setWhoSees(true)} />
    : null;
  const activity = (
    <View style={s.activity} testID="collection-activity">
      <View style={s.activityRow}>{heart ?? keptHeart}{shareButton}<CommentsDoor list={col} onPress={(id) => navigation.navigate('Comments', { subject: { kind: 'collection', id } })} />{activityLink}</View>
    </View>
  );

  /* ── the curator, at the head of the card (owner, 16 Oct 2026) ──
     The face and the handle lead the card on somebody else's list, where
     the note glyph used to: the glyph said "a note", the face says whose,
     which is the question the glyph was standing in for. Beside a handle
     in the card's own ink — larger than the 18pt it wore in the header,
     because it is the card's subject now rather than a mark in a line of
     meta. 28pt until 13 Nov 2026, 40 since, with a second line under the
     handle (`byline`).

     The face appears only where there is a person: `holdForFace` keeps
     the slot while the lookup is out and drops it once an editorial
     handle comes back with nobody behind it.

     A tap opens the author's page (owner, 16 Nov 2026) — `PersonScreen`
     — where an account stands behind the handle. Until that day it
     opened a sheet here with two rows, "Report this list" and "Block":
     there was no page to open. The report is still a row in the ⋯ on
     this card, where it always also was; the block is an act about a
     person and went to their page's own ⋯ (`usePersonMenu`), with a
     report of the person beside it. The cost: blocking a list's author
     is two presses from here, where it was one.

     An editorial handle has nobody behind it and no page, so its head is
     not a button — a press that opens "Nobody here" is a dead control. */
  const curatorTag = !owned && col?.curator_handle ? atHandle(col.curator_handle) : '';
  // A face or a profile row means an account; an editorial handle has
  // neither (see `curatorHandle`), and so no page to open.
  const curatorIsPerson = !!curatorAvatar || !!lookup.data;
  /* Report, a row in the ⋯. Never on a shared list: see `sharedToMe`. */
  const reportRow: SheetAction | null = col && !sharedToMe
    && canReport({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id })
    ? {
      key: 'report',
      icon: 'flag-outline',
      title: t('Report this list', 'Báo cáo bộ sưu tập này', 'このリストを報告', '举报这个清单', '舉報這個清單'),
      desc: t(
        'Tell the desk something here is wrong.',
        'Báo cho desk biết có điều gì không ổn ở đây.',
        'ここに問題があることをデスクに伝えます。',
        '告诉编辑团队这里有问题。', '告訴編輯團隊這裡有問題。',
      ),
      onPress: () => report({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id, name: title }),
    }
    : null;
  /* ── your own face, too (owner, 16 Oct 2026) ──
     Your own list leads with your face and handle as well, as the
     owner’s view in the review drew it: the card reads the same from
     both sides, and the reader sees what a visitor will see. From the
     signed-in profile rather than `curator_handle`, which is a stamp
     taken when the row was made and does not follow a changed handle.
     Never a button: there is nothing to report or block about yourself.
     A face slot always, since an account is always a person; the note
     glyph comes back only for a profile with no handle yet. */
  const ownTag = owned && profile?.handle ? atHandle(profile.handle) : '';
  const faceTag = owned ? ownTag : curatorTag;
  /* The handle as the head draws it: bare, no `@` (owner, 13 Nov 2026),
     as Threads and Instagram set the name beside a face. The `@` stays
     where the handle stands inside a sentence ("Block @lan?") or under
     a real name (the curator sheet), where it says "this is a handle";
     beside the face it is the name, and the sign was one more glyph
     before it. Sentences keep `curatorTag`. */
  const faceName = normalizeHandle(faceTag);

  /* ── the line under the handle (owner, 13 Nov 2026) ──
     A post's second line: how old the list is, and who sees it.

     - Your own list: its age, then who can see it — the control, with
       its sheet (`visibility`).
     - Somebody else's public list: its age alone. Not "Public": anyone
       who can see it already knows it is.
     - A friend's list lent to you (`sharedToMe`): its age, then two heads
       and "Shared with you". Not a control: who sees it is the owner's.

     The age only on a list with an owner. The editorial lists all wear
     one `created_at` — the instant the column was added with a default,
     not a date anybody chose (`fetchCollections`) — so every one of them
     would say the same day, and say it falsely. With no age and nothing
     after it, the line is not drawn, and the handle stands alone.

     Read at render, not ticking: a list opened at "New" says so until the
     screen draws again, as a post's header does until it is scrolled
     back to. */
  const madeAt = col?.owner_id ? col.created_at : null;
  const age = madeAt ? listAgeOf(madeAt, new Date()) : null;
  // The rest of the words are `ageWord`'s, which the list's activity page
  // reads too, so a list's "3h" and a like's cannot be spelled apart.
  const ageText = age ? ageWord(age, lang, t, t('New', 'Mới tạo', '作成したばかり', '刚创建', '剛建立')) : '';
  // What a reader who is not the owner sees there: "Shared with you",
  // or the globe of a person's public list — `shares.readerMark`.
  const readerSees = readerMark(col, owned);
  const sharedMark = readerSees ? <ReaderSeen kind={readerSees} /> : null;
  const seenOnLine = visibility ?? sharedMark;
  const byline = ageText || seenOnLine ? (
    <View style={s.byline} testID="collection-meta">
      {ageText ? <Text style={s.bylineText}>{ageText}</Text> : null}
      {ageText && seenOnLine ? <Text style={s.bylineText}>·</Text> : null}
      {seenOnLine}
    </View>
  ) : null;

  const curatorFace = (
    <>
      {owned
        ? <FaceDoor url={profile?.avatar_url || null} onPress={ownDoor(navigation, owned, faceName)} />
        : holdForFace ? <Avatar url={curatorAvatar} size={FACE} /> : null}
      <View style={s.curatorLines}>
        <Text style={s.curatorTag} numberOfLines={1} testID="collection-handle" onPress={ownDoor(navigation, owned, faceName)}>{faceName}</Text>
        {byline}
      </View>
    </>
  );
  const curatorRow = faceTag ? (
    !owned && curatorIsPerson ? (
      <PressableScale
        contentStyle={s.curator}
        onPress={() => navigation.navigate('Person', { handle: normalizeHandle(curatorTag) })}
        scaleTo={0.97}
        haptic="selection"
        accessibilityRole="button"
        // The whole head is the press, both lines with the face, as a
        // post's is — so VoiceOver hears both lines too, not the handle
        // alone. A visitor's line holds no control to be swallowed.
        accessibilityLabel={[faceName, ageText, readerWord(readerSees, t)].filter(Boolean).join(', ')}
        testID="collection-curator"
      >
        {curatorFace}
      </PressableScale>
    ) : (
      <View style={s.curator} testID="collection-curator">{curatorFace}</View>
    )
  // No handle to lead with — your own, before you choose one, or a lent
  // list whose owner has none: the line under it stands alone.
  ) : byline;

  /* ── the ⋯, at the card's top right (owner, 13 Nov 2026) ──
     It stood in the header's right-hand slot until this day, and this
     corner held the pencil on your own list and "Save a copy" on
     somebody else's. The ⋯ has both corners now, and the header keeps the
     way back and the title alone: what can be done with the list sits on
     the card that introduces it, and the two shortcuts it replaces are
     rows in its sheet — Edit collection and Save a copy — so nothing went
     out of reach, it went one tap further.

     Everybody gets it, not only the owner: what the sheet offers
     branches, but "there is more you can do with this list" is true on
     both sides of that line, and a card whose corner is empty for half
     its visitors reads as one that forgot something.

     Only once there is a list, which is also the only time there is a
     card. While your own lists are still loading there is no row to read
     `owner_id` off yet — `owned` is false by default, so the owner was
     briefly offered the visitor's "Save a copy" of their own list. Once
     the row is here its `owner_id` settles whose it is.

     The pencil's ink, not its box, ended at the card's padding, level
     with the end of the words under it; the ⋯ does the same by the
     header's own measure (`INK_GAP_END`), which holds unchanged because
     the box keeps the header's 44pt width — see `s.more`. */
  const more = (
    <PressableScale
      onPress={() => setMenu(true)}
      scaleTo={0.92}
      // `CHIP_H` drawn, 44 to the thumb: the slop above and below, the
      // box's own width across.
      hitSlop={CHIP_SLOP}
      style={s.moreHang}
      contentStyle={s.more}
      accessibilityRole="button"
      // "Tùy chọn khác" and not "Thêm" (owner, 22 Oct 2026): heard
      // alone, "Thêm" is "add", and this screen has an Add place too.
      accessibilityLabel={t('More', 'Tùy chọn khác', 'その他', '更多', '更多')}
      testID="collection-more"
    >
      <Glyph name="ellipsis-horizontal" size={ICON.nav} color={colors.textSecondary} />
    </PressableScale>
  );

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
  const introCard = col ? (
    <View style={s.descWrap}>
      <Card
        style={s.descCard}
        testID={desc || !owned ? 'collection-desc' : 'collection-desc-empty'}
      >
        {/* The face's row, drawn whenever the card is: the ⋯ is always
            in it. It was skipped when it held nothing — a list lent to
            you whose owner had no handle — so the words opened the card
            rather than sitting under an empty row and its 14. */}
        <View style={s.descTop}>
          {/* The note glyph, only on your own list and only when there
              is no handle to lead with: it says "your words go here". */}
          {owned && !ownTag ? (
            <Glyph
              name="document-text-outline"
              size={ICON.nav}
              color={desc ? colors.textSecondary : colors.textTertiary}
            />
          ) : null}
          <View style={s.descBody}>
            {curatorRow}
          </View>
          {more}
        </View>
        {/* Across the card too, the words as well as the kinds: the
            description's column stopped at the pencil's, 48pt short of
            the right edge against 16 on the left (owner, 13 Nov 2026). */}
        {desc ? (
          // Four lines, then "Đọc thêm ⌄" on its own (owner, 3 and
          // 13 Nov 2026): a long note had filled the screen the places
          // are for. See `MoreText`.
          <MoreText text={desc} style={s.descText} testID="collection-desc-text" />
        ) : owned ? (
          // The invitation: the line opens the form.
          // Not the whole card, since the chips under the line are
          // a filter and a tap meant for one would open the form.
          //
          // Drawn as an action, not as words. It was a sentence in
          // the description's own face one grey lighter — "Thêm vài
          // dòng về bộ sưu tập này." — and the owner read it as the
          // description (18 Oct 2026): on the sand ground the two
          // greys are a shade apart, and a sentence about the list
          // reads as one. Now a plus and two words in the accent,
          // the colour this app gives the things a tap changes,
          // at the caption's size: it is a control in the place
          // the words will go, not the words.
          <PressableScale
            onPress={edit}
            scaleTo={0.96}
            haptic="selection"
            accessibilityRole="button"
            contentStyle={s.descAdd}
            testID="collection-desc-add"
          >
            <Glyph name="add" size={ICON.action} color={colors.accent} />
            <Text style={s.descAddText}>{t('Add a description', 'Thêm mô tả', '説明を追加', '添加简介', '新增簡介')}</Text>
          </PressableScale>
        ) : null}
        {kindRow}
        {activity}
      </Card>
    </View>
  ) : null;

  /* ── the ⋯'s sheet (owner, 13 Nov 2026) ──
     The sheet the other ⋯s in the app open — `ActionSheet`, as
     who-can-see-it beside it, Visited's ⋯ and the curator's face do — so
     that every pop-up in the app rises from the bottom the same way and
     is closed the same way: the backdrop, the grabber, or a row. That is
     the owner's reason, and the whole of it.

     Rejected, and removed that day: the popover it was. A `Modal` hung
     under the header's ⋯ from a measure of the button, with a lighter
     scrim and a shadow, on the argument that a menu anchored to its
     control is visibly that control's menu. It was the one menu in the
     app that did not rise from the bottom, so a reader met two shapes of
     menu and two ways out of them. What the anchor said — this is the
     list's menu — the sheet's header says in words, and the sheet needs
     no measure of anything.

     The header is the list's name, the way Visited's ⋯ heads its sheet
     with the visit's: the thing the menu is about, above the rows
     (`ActionSheet`). The rows are their names alone (owner, 13 Nov 2026):
     this is a menu of acts, and "Edit collection" or "Delete collection"
     says what it does. Rejected the same day, before it shipped: a
     sentence under every row, as the sheets that are choices wear them
     ("Only you can see it" under Private). Here they repeated the names —
     "Its name, description and categories" under Edit — and made the
     sheet twice as tall to read for nothing. Report keeps its sentence
     in the curator's sheet, where it stands beside Block; here it is the
     one red row among plain ones, and its name is enough.

     The rows are the popover's, on its conditions, in three cards:
     what you do with the list, the two views under their name
     (`viewRows`), and the one row in red. A card with nothing in it is
     not drawn (`SheetRows`), which is how a list lent to you, with
     nothing to plan from, opens on the views.

     ── the order (owner, 16 Nov 2026) ──
     Every act on the list in the first card, the views under it, the red
     row alone at the foot. Until then the sheet kept the popover's
     order, which nobody had argued for: two acts, the views, then the
     other two with the red row closing their card. The views cut what
     you do with a list in half, and Delete stood one row under Share in
     the same card. Deleting asks first (`remove`), so the row apart is
     not what saves a list from a slipped thumb; it is that a card of
     plain verbs ending in a red one reads as four of a kind, and the
     red row is not one of them. What it costs is the views two rows
     further down, and which view a reader looks at is kept for them
     (`LIST_OR_GRID`), so that row is pressed once and rarely again. The
     sheet is as tall as it was: the same rows in the same three cards.

     Both sheets, yours and a visitor's, so the menu is one shape
     whoever's list it is on.

     ── yours ──
     Add place, Plan a trip, Edit collection, Share; the views; Delete.
     No publish row: who can see the list is changed where it is said,
     under your handle at the card's head — see `visibility`.

     ── somebody else's ──
     The things you can do to a thing you do not own: plan from it,
     take it, pass it on, say something is wrong with it. No Edit, no
     Delete, no publish switch — not because they are kept from you but
     because they are not yours to press, and a menu listing what the
     database will refuse lies twice.

     "Save a copy" and not "Follow", and the wording is the promise.
     Following would leave the curator in charge of what you see — they
     drop a place, you lose it — and the reason to want this list was to
     make it yours: reorder it, cut the two you have been to, add the
     four you know. It copies, and the row's name says so before the
     tap rather than after it. Only with a city to file the copy under (`canCopy`):
     without one the row could only close the sheet and do nothing.

     Plan a trip, Save a copy, Share; the views; Report. Report last,
     alone and in red, because it is the row that is about a person
     rather than about the list — and never on your own, which is yours
     to delete.

     A friend's list shared with you keeps only the reading half: Plan a
     trip and the two views. See `sharedToMe`. */
  const planRow: SheetAction | null = canPlan ? {
    key: 'plan',
    icon: 'paw-outline',
    title: t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程'),
    onPress: plan,
    testID: 'collection-menu-plan',
  } : null;
  const present = (rows: (SheetAction | null | false)[]) => rows.filter((r): r is SheetAction => !!r);
  const [actsBefore, actsAfter]: SheetAction[][] = owned
    ? [
      present([
        {
          key: 'add',
          icon: 'add-circle-outline',
          title: t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點'),
          onPress: addPlace,
          testID: 'collection-menu-add',
        },
        planRow,
        {
          key: 'edit',
          icon: 'create-outline',
          title: t('Edit collection', 'Sửa bộ sưu tập', 'コレクションを編集', '编辑合集', '編輯合集'),
          onPress: edit,
          testID: 'collection-menu-edit',
        },
      ]),
      [
        {
          key: 'delete',
          icon: 'trash-outline',
          title: t('Delete collection', 'Xoá bộ sưu tập', 'コレクションを削除', '删除合集', '刪除合集'),
          destructive: true,
          onPress: remove,
          testID: 'collection-menu-delete',
        },
      ],
    ]
    : [
      present([
        planRow,
        canCopy && {
          key: 'copy',
          icon: 'duplicate-outline',
          title: t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本'),
          onPress: copy,
          testID: 'collection-menu-copy',
        },
      ]),
      present([
        reportRow && { ...reportRow, desc: undefined, destructive: true, testID: 'collection-menu-report' },
      ]),
    ];
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
      backBare
      compactTitle
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
            contentContainerStyle={{ paddingTop: 8, paddingBottom: tabClearance }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </LiftedCard.Provider>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        header={
          <Text style={s.sheetTitle} numberOfLines={2} accessibilityRole="header">{title}</Text>
        }
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
            icon="duplicate-outline"
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
          // The Crew screen is in the Profile tab's stack, so the jump is
          // across tabs; `initial: false` keeps Profile's home beneath it
          // (see `goTo`).
          onCrew={() => { setPicking(false); goTo('Profile', { screen: 'Crew', initial: false }); }}
        />
      ) : null}
      <ActionSheet
        visible={whoSees}
        onClose={() => setWhoSees(false)}
        header={<ShareHead />}
      >
        <SheetRows actions={whoSeesRows} onClose={() => setWhoSees(false)} />
        <SheetRows actions={sendRows(t)} onClose={() => setWhoSees(false)} />
      </ActionSheet>
    </Screen>
  );
}
