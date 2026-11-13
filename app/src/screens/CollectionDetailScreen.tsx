import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent, AccessibilityInfo, ActivityIndicator, Alert, Animated, Dimensions, FlatList, Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent, Pressable, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glyph } from '../components/ui/glyph';
import PlaceCard from '../components/PlaceCard';
import PlaceTile from '../components/PlaceTile';
import MoreText from '../components/MoreText';
import { KindPills } from '../components/KindPill';
import {
  AmbientWarmth, Avatar, CHIP_H, CHIP_SLOP, Card, Empty, GradientCta, INK_GAP_END, PressableScale, RoundIconButton, Screen,
  fireHaptic, successHaptic, useTabBarClearance,
} from '../components/ui';
import { LIFT_AFTER_MS, useEdgeSwipeBack, useListDrag } from '../components/useListDrag';
import { useDuckOnScroll, useTabBarDucked } from '../components/tabBarDuck';
import { DockOffer, DockSlot, useDockOffer } from '../components/DockSlot';
import { AddCell, AddPill } from '../components/add';
import { useProfile, useSession } from '../lib/auth';
import { categoriesOf } from '../lib/categories';
import { collectionKinds, narrowTo } from '../lib/collectionKinds';
import { useCollections, useCuratorAvatar, useLikes, usePlaces } from '../lib/catalog';
import { likesWorthShowing } from '../lib/likes';
import {
  blockUser, deleteCollection, isNotShareable, membersOf, reorderCollection, setCollectionPublic, setShares,
  unseenMembers, unseenSentence, useMyListShares, useProfileByHandle, useSharedWithMe, type Collection,
} from '../lib/data';
import { useCrew } from '../lib/crew';
import { splitFriendships } from '../lib/friends';
import { namesBriefly, sharesByList, type Visibility, visibilityOf } from '../lib/shares';
import ShareSheet from '../components/ShareSheet';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useCurrentCity } from '../lib/city';
import { applyDraft, moveItem, sameOrder } from '../lib/order';
import { useReport } from '../components/reportFlow';
import PersonSheet, { type PersonAction } from '../components/PersonSheet';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import { useMyLists, useSaveActions } from '../lib/save';
import { readerKey, COLLECTION_VIEW_KEY } from '../lib/readerPrefs';
import { oneOf, useStored } from '../lib/stored';
import { useNoteEvent } from '../lib/tasteProfile';
import { useI18n } from '../lib/i18n';
import { colors, display, font, radius, space, type } from '../theme';
import type { Place } from '../lib/types';
import { goTo, type Nav, type RootRoute } from '../nav';

/**
 * The empty state of a list you own.
 *
 * A public collection that is empty is a mistake at the desk; one of yours
 * is just new, and the screen should hand you the way forward instead of
 * reporting the absence twice.
 */
function OwnEmpty({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.emptyWrap}>
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Glyph name="bookmark-outline" size={26} color={colors.accent} />
        </View>
        {/* One line. The second sentence was telling you to go looking,
            which is what the button underneath already says — a card this
            small should not say the same thing twice, once in prose and
            once as a control. */}
        <Text style={s.emptyBody}>
          {t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。', '这里还没有内容。', '這裡還沒有內容。')}
        </Text>
        <GradientCta
          icon="search"
          label={t('Find places', 'Tìm địa điểm', 'スポットを探す', '查找地点', '查詢地點')}
          onPress={onAdd}
        />
      </View>
    </View>
  );
}

/**
 * A line in the overflow menu.
 *
 * Glyphs are neutral and only the destructive one is red. The sheet this
 * replaces tinted every glyph with `accent`, which on paper is `#C4402C`
 * against `bad`'s `#C2564A` — 1.15:1 apart, indistinguishable. Five red
 * rows meant Delete was not marked at all. Neutral against `bad` is
 * 4.11:1, so the red says something again.
 */
function MenuRow({ icon, label, onPress, danger, first, checked, testID }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  first?: boolean;
  /** For a row that is one of a choice: ticked when it is the one in force. */
  checked?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      aria-selected={checked}
      style={({ pressed }) => [s.menuRow, !first && s.menuDivider, pressed && s.menuRowOn]}
    >
      <Glyph name={icon} size={21} color={danger ? colors.bad : colors.text} />
      <Text style={[s.menuText, danger && { color: colors.bad }]} numberOfLines={1}>{label}</Text>
      {checked && <Glyph name="checkmark" size={20} color={colors.accent} style={s.menuCheck} />}
    </Pressable>
  );
}

/** What a change of who-sees-it says to VoiceOver: published, private
 *  again, or shared with this many people — see `said`. */
type Said = 'public' | 'private' | { shared: number };

/** The glyph at the card's foot and on the sheet's row, for each of the
 *  three answers — see `visibility`. */
const SEEN_GLYPH: Record<Visibility, keyof typeof Ionicons.glyphMap> = {
  public: 'globe-outline',
  friends: 'people-outline',
  private: 'lock-closed-outline',
};

/**
 * How long after the last move the order is written.
 *
 * Long enough that a run of moves — three cards dropped one after another
 * — is one write rather than one per drop; short enough that the write
 * lands before the reader has looked up. Not measured: a chosen beat. Leaving the screen writes at once, so the value can only decide
 * how many writes there are, never whether one is lost.
 */
const SAVE_AFTER_MS = 600;

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
/** Between tiles, both ways. The reference's, measured off it: about a
 *  fourteenth of a tile. */
const GRID_GAP = 8;
/** The grid's first cell on your own list, which holds "Add place" rather
 *  than a place. Not a slug: slugs never carry a "+". */
const ADD_CELL = '+add' as const;

/** Which card is in the finger, for the cell that holds it; -1 for none. */
const LiftedCard = createContext(-1);

/**
 * The list's cell, raised while its card is lifted.
 *
 * Each card sits in a cell of its own, and a zIndex on the card does not
 * reach past its cell to the siblings it has to pass over, so it is the
 * cell that goes up. Declared here and fed by context rather than written
 * inline on the list: an inline component is a new type every render, and
 * every lift and every slot passed is a render, so each one remounted
 * every card, the one in the finger with its gesture.
 */
function LiftCell({ index, style, children, ...cell }: {
  index: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const lifted = useContext(LiftedCard);
  return <View {...cell} style={[style, lifted === index && s.arrangeCellLifted]}>{children}</View>;
}

/**
 * A place in your own list: the same card as everywhere else, which can
 * also be held and dragged to a new position.
 *
 * ── on the list itself, not in a mode ──
 *
 * The order used to be set in a separate mode, reached through the menu,
 * that swapped the cards for numbered one-line rows. It worked, and
 * nobody found it. The list you want to put in order is the one in front
 * of you, so that is where the order is changed: hold a card and it
 * lifts; drag it and the cards it passes step aside into the room it
 * left; let go and it lands, and the new order saves itself.
 *
 * A tap still opens the place. The hold is what tells the two apart (see
 * `LIFT_AFTER_MS`): it is the card's own long press, so a press that
 * lifted never also opens the place, and a finger that moves before the
 * hold completes cancels it and scrolls instead.
 *
 * ── the lift is the card's, the drag is the list's ──
 *
 * The card only lifts. The drag after it belongs to a responder on the
 * list around the cards, and the hold, the drag and the drop — and why
 * they are built on the responder system rather than on gesture-handler
 * or reanimated — are `useListDrag`, which the plan editor shares.
 *
 * VoiceOver cannot drag, so the card offers "Move up" and "Move down" as
 * accessibility actions, and says so in its hint.
 */
const DraggableCard = memo(function DraggableCard({
  place, index, count, style, onOpen, onStep, onLift, onRelease, onPitch,
}: {
  place: Place;
  index: number;
  count: number;
  /** What this card wears right now — raised and travelling, stepped
   *  aside, or nothing — from `useListDrag`'s `styleOf`. */
  style: ReturnType<ReturnType<typeof useListDrag>['styleOf']>;
  onOpen: (slug: string) => void;
  /** Move the place at `index` one step: -1 up, 1 down. */
  onStep: (index: number, by: -1 | 1) => void;
  /** The hold completed: `pageY` is where the finger is, which the drag
   *  measures its travel from. */
  onLift: (index: number, pageY: number) => void;
  /** The card's button let go of the touch, by the finger coming up or by
   *  the list taking the drag over. */
  onRelease: () => void;
  onPitch: (slug: string, pitch: number) => void;
}) {
  const { t } = useI18n();
  const raised = useContext(LiftedCard) === index;
  return (
    <Animated.View
      onLayout={(e) => onPitch(place.slug, e.nativeEvent.layout.height)}
      style={style}
      testID={`drag-${place.slug}`}
    >
      <PlaceCard
        place={place}
        onPress={() => onOpen(place.slug)}
        testID={`collection-place-${index}`}
        raised={raised}
        onLongPress={(e) => onLift(index, e.nativeEvent.pageY)}
        delayLongPress={LIFT_AFTER_MS}
        onPressOut={onRelease}
        {...stepsFor(t, index, count, 'list', () => onStep(index, -1), () => onStep(index, 1))}
      />
    </Animated.View>
  );
});

/**
 * What VoiceOver is offered in place of the drag, and told in the hint: a
 * step either way, only where there is somewhere to go. On the cards a
 * step is up or down. On the grid it is earlier or later, because the next
 * place in the order is beside a tile or, at a row's end, at the start of
 * the row below — "up" there would promise a move of three.
 */
function stepsFor(
  t: ReturnType<typeof useI18n>['t'], index: number, count: number, view: 'list' | 'grid',
  onUp: () => void, onDown: () => void,
) {
  const grid = view === 'grid';
  return {
    accessibilityHint: t(
      'Hold and drag to change the order.',
      'Giữ rồi kéo để đổi thứ tự.',
      '長押ししてドラッグすると並び順を変えられます。',
      '长按并拖动即可调整顺序。', '長按並拖曳即可調整順序。',
    ),
    accessibilityActions: [
      ...(index > 0 ? [{
        name: 'moveUp',
        label: grid
          ? t('Move earlier', 'Đưa lên trước', '前へ移動', '前移', '前移')
          : t('Move up', 'Chuyển lên', '上へ移動', '上移', '上移'),
      }] : []),
      ...(index < count - 1 ? [{
        name: 'moveDown',
        label: grid
          ? t('Move later', 'Đưa ra sau', '後ろへ移動', '后移', '後移')
          : t('Move down', 'Chuyển xuống', '下へ移動', '下移', '下移'),
      }] : []),
    ],
    onAccessibilityAction: (e: AccessibilityActionEvent) => (e.nativeEvent.actionName === 'moveUp' ? onUp() : onDown()),
  };
}

/**
 * A place in your own list as a tile of the grid, which can be held and
 * dragged as the card can. The same hold, the same responder on the list
 * around it, the same save: only the arithmetic of where it lands is the
 * grid's (see `useListDrag`). Every tile is one size, so unlike the card
 * it reports no pitch.
 */
const DraggableTile = memo(function DraggableTile({
  place, index, count, size, style, onOpen, onStep, onLift, onRelease,
}: {
  place: Place;
  index: number;
  count: number;
  size: number;
  style: ReturnType<ReturnType<typeof useListDrag>['styleOf']>;
  onOpen: (slug: string) => void;
  onStep: (index: number, by: -1 | 1) => void;
  onLift: (index: number, pageY: number, pageX: number) => void;
  onRelease: () => void;
}) {
  const { t } = useI18n();
  return (
    <Animated.View style={style} testID={`drag-${place.slug}`}>
      <PlaceTile
        place={place}
        size={size}
        onPress={() => onOpen(place.slug)}
        testID={`collection-tile-${index}`}
        onLongPress={(e) => onLift(index, e.nativeEvent.pageY, e.nativeEvent.pageX)}
        delayLongPress={LIFT_AFTER_MS}
        onPressOut={onRelease}
        {...stepsFor(t, index, count, 'grid', () => onStep(index, -1), () => onStep(index, 1))}
      />
    </Animated.View>
  );
});

/**
 * A place in somebody else's list, or in yours while it cannot be
 * arranged: a card or a tile that only opens. Behind `memo` like the two
 * above, for the same reason — see "drawn again only when it moved".
 */
const StillCard = memo(function StillCard({ place, index, chip, onOpen }: {
  place: Place;
  index: number;
  chip: string | null | undefined;
  onOpen: (slug: string) => void;
}) {
  return (
    <PlaceCard place={place} onPress={() => onOpen(place.slug)} chip={chip} testID={`collection-place-${index}`} />
  );
});
const StillTile = memo(function StillTile({ place, index, size, onOpen }: {
  place: Place;
  index: number;
  size: number;
  onOpen: (slug: string) => void;
}) {
  return <PlaceTile place={place} size={size} onPress={() => onOpen(place.slug)} testID={`collection-tile-${index}`} />;
});

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
  // public, since a private one has no shelf to be ordered on.
  const { likes, myLikes, toggleLike } = useLikes();
  // Shared before public: a list that is both is the same row either way,
  // and the shared copy names its owner (`fetchSharedWithMe`).
  const col = useMemo(
    () => [...mine.data, ...shared.data, ...cols.data].find((c) => c.slug === route.params.slug),
    [mine.data, shared.data, cols.data, route.params.slug],
  );
  const members = useMemo(() => (col ? membersOf(col, places) : []), [col, places]);
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
   * all. No heart (likes are public-only — `heart` already asks
   * `isPublic`). No "Save a copy", in any of its three doors (`canCopy`):
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
   * words its foot says — `lib/shares.visibilityOf`: Public, Friends (not
   * public, shared with somebody) or Private.
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
  const seenWords: Record<Visibility, string> = {
    public: t('Public', 'Công khai', '公開', '公开', '公開'),
    friends: t('Friends', 'Bạn bè', '友だち', '好友', '好友'),
    private: t('Private', 'Riêng tư', '非公開', '私密', '私密'),
  };
  const seenWord = seenWords[seen];
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
  // The list's chips: every kind its places carry, most places first,
  // less what the owner hid (`lib/collectionKinds`).
  const kinds = useMemo(
    () => (col ? collectionKinds(members, { hidden: col.kinds_hidden }) : []),
    [col, members],
  );

  // ── the chips are the filter (owner, 15 Oct 2026) ──
  //
  // A tap on a chip narrows the places to that kind; nothing chosen is the
  // whole list — there is no "All" chip, by the owner's ruling, and the
  // way back is the count line's "Clear" or the chip tapped off.
  //
  // One kind at a time (owner, 24 Oct 2026). Any number could be chosen
  // until then, a place staying if it carried any of them; the owner took
  // multiple choice out of every filter in the app the same day. Another
  // chip moves to its kind rather than adding it.
  //
  // It was a second row of the filter row's glyph chips under the card
  // for one build, and the owner saw the same kinds twice: in the card,
  // and again under it, one chip apart. So the card's pills are the
  // filter now, which is also why they carry every kind rather than the
  // three that cleared a third of the list — a threshold there hid the
  // nine bars among seventy-two cafés, the case a filter is for.
  //
  // Only with two kinds or more: on a list of one kind a filter has
  // nothing to narrow, and a pill that does nothing should not be a
  // button. Chosen keys a reload takes away are let go rather than kept
  // as a filter nothing can match. Not kept across visits: a filter is a
  // look at the list, and a list that opens narrowed reads as a list that
  // lost places.
  const [picked, setPicked] = useState<string[]>([]);
  const filters = kinds.length > 1;
  const chosen = filters ? picked.filter((k) => kinds.includes(k)) : [];
  const narrowed = chosen.length > 0;
  const pick = (k: string) => setPicked((p) => (p.includes(k) ? [] : [k]));
  const kept = narrowed ? narrowTo(members, chosen).length : members.length;
  /* ── the count, at the end of the kinds' row (owner, 13 Nov 2026) ──
     How many places, beside what kinds they are: the two say what is in
     the list, so they share a row, the count fixed at its right edge and
     the kinds wrapping in the column to its left — a fourth kind goes to
     a second line under the first, never under the count. One place for
     the figure, for the owner and a visitor alike: it had been the foot's
     on somebody else's list and the "Add place" cell's corner on yours,
     and the foot is now the heart and who can see it, nothing else.

     The list's whole count, whatever a chip has narrowed it to: the grid
     shows what the chip kept, and the line under the row says "4 of 11"
     while one is chosen. Its box is a pill's box — the same rule, clear,
     when the kinds are a filter — so the figure sits on the first line's
     baseline by construction rather than by a guessed offset.

     Its pin and figure, never the word (owner, 31 Oct 2026); a screen
     reader hears the word. On a list with no places there is no count:
     "Nothing here yet" is the card's whole answer. */
  const placesWord = t(members.length === 1 ? 'place' : 'places', 'địa điểm', 'スポット', '个地点', '個地點');
  const placeCount = members.length > 0 ? (
    <View
      style={[s.placeCount, filters && s.placeCountRule]}
      accessible
      accessibilityLabel={`${members.length} ${placesWord}`}
      testID="collection-count"
    >
      <Glyph name="location-outline" size={13} color={colors.textTertiary} />
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
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  // Where the popover hangs from. Measured off the button rather than
  // computed from paddings, because the header's height moves with the
  // title and the meta line and a menu that floats away from its control
  // stops looking like that control's menu.
  const btn = useRef<React.ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState({ top: insets.top + 58, right: space.page });
  const openMenu = () => {
    // Opened first and positioned second: if the measure never calls back
    // the menu still appears, at the estimate above rather than not at all.
    setMenu(true);
    btn.current?.measureInWindow((x, y, w, h) => {
      if (!w) return;
      setAnchor({ top: y + h + 6, right: Dimensions.get('window').width - (x + w) });
    });
  };
  // Every action leaves this screen or opens an alert over it, and a menu
  // still standing behind either is the sort of thing you come back to and
  // have to dismiss twice.
  const act = (run: () => void) => { setMenu(false); run(); };
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
  const viewRows = (first = false) => (
    <>
      <Text style={[s.menuSection, !first && s.menuDivider]} accessibilityRole="header">
        {t('View', 'Chế độ xem', '表示', '视图', '檢視')}
      </Text>
      <MenuRow
        icon="grid-outline"
        label={t('Grid', 'Dạng lưới', 'グリッド', '网格', '網格')}
        onPress={() => act(() => pickView('grid'))}
        checked={grid}
        first
        testID="collection-menu-grid"
      />
      <MenuRow
        icon="list-outline"
        label={t('List', 'Dạng danh sách', 'リスト', '列表', '列表')}
        onPress={() => act(() => pickView('list'))}
        checked={!grid}
        testID="collection-menu-list"
      />
    </>
  );

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
   * was easy; it is two deliberate taps now — the word at the card's
   * foot, then the answer in the sheet — and the way back is the same
   * two taps on the same word, which stays on screen.
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
   *   again if it goes private. The foot says Public.
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
     sentence to VoiceOver. Nothing drawn — the word at the card's foot
     has already changed, and it is the record (owner, 13 Nov 2026).

     Rejected, and removed that day: a banner above the card for three
     seconds ("Bộ sưu tập này đã riêng tư trở lại"). It said again what
     the foot's word said and kept saying, and it sat in the flow, so it
     pushed the card and the grid down by its height and margin (11 +
     a 20pt line + 11, then 12: about 54pt; 51 on the owner's screenshot)
     and pulled them back up three seconds later — two moves of the whole
     page for news the reader had just made. It earned its row while it
     held the only Undo; the Undo went on 17 Oct, and the way back is the
     same word, which stays. A toast floating over the list was not the
     answer either: it would hide part of the list to report on it.

     The sentence stays for VoiceOver because a reader who cannot see the
     foot's word change would otherwise hear nothing at all —
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

  /**
   * Putting the list in order.
   *
   * On the list itself, by holding a card (see `DraggableCard`). The old
   * worry about controls on the cards, that tapping a place would be a
   * thumb-width from moving it, does not apply to a hold: a tap still
   * only ever opens the place.
   *
   * ── saved as it goes ──
   *
   * There is no Done. Every move is the reader's decision already, and a
   * button to confirm it was a second decision about the first, one the
   * back arrow skipped and so threw the order away without a word. So each
   * move is written on its own, a beat after the last drop (`SAVE_AFTER_MS`)
   * so that three drops are one write rather than three. Leaving the
   * screen writes whatever is waiting at once.
   *
   * Nothing on screen says it worked: the order on screen is the result,
   * and a failure puts the old order back and says so in an alert. The
   * header used to carry "Saving…" then "Saved" beside the ⋯, and every
   * drag shifted the title across to make room for it — a report on
   * something the reader could already see, paid for by the one line that
   * says which list this is (owner, 16 Oct 2026). VoiceOver, which cannot
   * see the card land, is told instead.
   *
   * `draft` is the order on screen, as slugs — never places, because the
   * catalog can reload underneath this screen and slugs are what the write
   * takes anyway. It stays until the server's order has caught up with
   * it, so the list does not flick back to the old order for the
   * moment between the write landing and the reload.
   *
   * One write in flight at a time, always the latest order: a move made
   * while a write is out is picked up when it returns. The whole sequence
   * goes in one statement (`reorder_collection`), so a failure leaves the
   * server's order as it was — and the screen goes back to it, and says so.
   */
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'waiting' | 'saving' | 'saved'>('idle');
  const wanted = useRef<string[] | null>(null);
  const writing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drafted = useMemo(() => applyDraft(members, draft), [members, draft]);
  // The draft steps aside once the server agrees with it and nothing is
  // left to write. Adjusted during render, React's pattern for state that
  // follows props — see `usePersistedFetch`.
  if (draft && (saveState === 'idle' || saveState === 'saved')
    && sameOrder(drafted.map((p) => p.slug), members.map((p) => p.slug))) {
    setDraft(null);
  }

  const flush = async () => {
    if (!col || writing.current || !wanted.current) return;
    writing.current = true;
    setSaveState('saving');
    try {
      while (wanted.current) {
        const order = wanted.current;
        wanted.current = null;
        await reorderCollection(col.slug, order);
      }
      setSaveState('saved');
      AccessibilityInfo.announceForAccessibility(
        t('Order saved', 'Đã lưu thứ tự', '並び順を保存しました', '顺序已保存', '順序已儲存'),
      );
      // Both catalogs: the row is in `mine` and, once published, in the
      // public list too, and the order is read from whichever copy the
      // screen that draws it happens to hold.
      mine.reload();
      cols.reload();
    } catch (e) {
      wanted.current = null;
      setDraft(null);
      setSaveState('idle');
      Alert.alert(
        t('Could not save the order', 'Không lưu được thứ tự', '並び順を保存できませんでした', '无法保存顺序', '無法儲存順序'),
        (e as Error).message,
      );
    } finally {
      writing.current = false;
    }
  };
  // The latest `flush`, for the one caller that outlives a render: the
  // unmount below, which must write a move made a moment before leaving.
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; });
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); void flushRef.current(); }
  }, []);

  const shuffle = (from: number, to: number) => {
    const next = moveItem(drafted.map((p) => p.slug), from, to);
    setDraft(next);
    wanted.current = next;
    setSaveState('waiting');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void flush(); }, SAVE_AFTER_MS);
  };

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

  // Deliberately inert, and now inert for two different reasons — which
  // is why the sentence branches. A private list has no address to send
  // anyone to — and the sentence is about this list, not all of yours,
  // and says where its switch is. A published one is visible
  // to everybody but the app still has no link to hand over, because
  // nothing here registers a URL scheme or a web address for a
  // collection. Either way the honest placeholder
  // says which wall you have hit rather than opening a share sheet onto a
  // link that would 404 for whoever received it.
  const share = () => Alert.alert(
    t('Sharing is coming', 'Sắp có chia sẻ', '共有は近日公開', '分享功能即将推出', '分享功能即將推出'),
    isPublic
      ? t(
        'This list is public, but there is no link to send yet. Sharing one is on the way.',
        'Bộ sưu tập này đã công khai, nhưng chưa có liên kết để gửi. Tính năng chia sẻ sẽ sớm có.',
        'このコレクションは公開中ですが、送れるリンクはまだありません。共有機能は近日公開予定です。',
        '这个清单已公开，但还没有可发送的链接。分享功能即将推出。', '這個清單已公開，但還沒有可傳送的連結。分享功能即將推出。',
      )
      // The word the foot says, Private or Friends: a list shared with
      // friends is private too, and the sentence points at the control
      // by what it reads.
      : t(
        `This list is private. Tap ${seenWord} at the foot of its card to make it public — share links are on the way.`,
        `Bộ sưu tập này đang riêng tư. Bấm ${seenWord} ở cuối thẻ giới thiệu để công khai — liên kết chia sẻ sẽ sớm có.`,
        `このコレクションは非公開です。紹介カードの下の「${seenWord}」から公開できます。共有リンクは近日公開予定です。`,
        `这个清单是私密的。点按卡片底部的“${seenWord}”即可公开 — 分享链接即将推出。`, `這個清單是私密的。點按卡片底部的「${seenWord}」即可公開 — 分享連結即將推出。`,
      ),
  );

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
  // Where the copy's three doors open: with a city to file it under, and
  // never on a list lent to you (`sharedToMe`).
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
        kinds: { hidden: col.kinds_hidden ?? [] },
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

  /* Who can see this list — at the foot of the card now, and the place
     to change it (owner, 16 Oct 2026). It sat under the title as a
     line of its own and was changed from the ⋯ menu, which split one
     fact across two places: the header said what it was, a menu row
     said how to make it the other thing. The header lost it so the
     title stands alone the way a visitor's does, and the menu lost its
     row so the way to the switch is the word that names the state —
     tap "Private" to choose who sees it.

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
     padlock already say which state it is. The grey is `textSecondary`,
     one step above the heart's tally beside it, because this word is a
     control and the tally is not.

     Tapping opens a choice rather than flipping the switch: a word that
     changes who can see your list on one touch is a word nobody would
     dare tap to find out what it does. */
  const [whoSees, setWhoSees] = useState(false);
  const visibility = col && owned ? (
    <PressableScale
      contentStyle={s.visibility}
      scaleTo={0.94}
      haptic="selection"
      // A chip on the button scale: 32 drawn, 44 to the thumb.
      hitSlop={CHIP_SLOP}
      onPress={() => setWhoSees(true)}
      accessibilityRole="button"
      accessibilityHint={t(
        'Choose who can see this list',
        'Chọn ai có thể xem bộ sưu tập này',
        'このリストを見られる人を選びます',
        '选择谁可以看到这个清单', '選擇誰可以看到這個清單',
      )}
      testID="collection-visibility"
    >
      <Glyph name={SEEN_GLYPH[seen]} size={15} color={colors.textSecondary} />
      <Text style={s.visibilityWord}>{seenWord}</Text>
      <Glyph name="chevron-down" size={13} color={colors.textTertiary} />
    </PressableScale>
  ) : null;

  /* The three answers, each with what it means where the reader will meet
     it. Choosing Public or Private is doing: the sheet closes and the
     word at the card's foot changes, so there is no confirmation here
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
      title: seenWords.friends,
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
  const heart = col && isPublic && col.id ? (
    <PressableScale
      contentStyle={s.like}
      scaleTo={0.82}
      haptic="none"
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
      onPress={onHeart}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked
        ? t('Unlike', 'Bỏ thích', 'いいねを取り消す', '取消点赞', '取消按讚')
        : t('Like', 'Thích', 'いいね', '点赞', '按讚')}
    >
      <Glyph
        name={liked ? 'heart' : 'heart-outline'}
        size={15}
        color={liked ? colors.accent : colors.textTertiary}
      />
      {likesWorthShowing(likes[col.slug])
        ? <Text style={s.meta}>{likes[col.slug]}</Text>
        : null}
    </PressableScale>
  ) : null;

  /* The card's foot: the heart, and who can see it. Under a hairline,
     from the start of the row.

     The heart leads (owner, 12 Nov 2026). It sat at the end, "where a
     thumb finds a gesture", but the apps this reads beside — Instagram,
     Threads, X — put the like first in the row, and first it stands in
     one place whether the list is yours or somebody else's. Grouped from
     the start rather than spread across three columns: only a public
     list has a heart (likes are public-only), and a private list's pill
     would otherwise float in a middle column with nothing to its left.

     The count left the foot on 13 Nov (owner) for the end of the kinds'
     row — see `kindRow`. So a foot with nothing to say is not drawn, and
     neither is its hairline: somebody else's list with no heart (shared
     with you, which no one may like) ends at its kinds. */
  const cardFoot = col && (heart || visibility) ? (
    <View style={s.cardFoot} testID="collection-stats">
      {heart}
      {visibility}
    </View>
  ) : null;

  /* ── the curator, at the head of the card (owner, 16 Oct 2026) ──
     The face and the handle lead the card on somebody else's list, where
     the note glyph used to: the glyph said "a note", the face says whose,
     which is the question the glyph was standing in for. 28pt, beside a
     handle in the card's own ink — larger than the 18pt it wore in the
     header, because it is the card's subject now rather than a mark in a
     line of meta.

     The face appears only where there is a person: `holdForFace` keeps
     the slot while the lookup is out and drops it once an editorial
     handle comes back with nobody behind it.

     A tap opens the curator sheet: report this list, and — only where a
     real account stands behind the handle — block them. Both already
     existed (the ⋯ menu's report row, Crew's block); this is the door
     beside the person they are about. No "View profile" and no follow:
     there is no public profile screen to open, and the app's graph is
     friendship, not following. Where neither action applies (signed
     out, or an editorial list you cannot report) the row is not a
     button — a press that opens an empty sheet is a dead control. */
  const [aboutCurator, setAboutCurator] = useState(false);
  const curatorTag = !owned && col?.curator_handle ? atHandle(col.curator_handle) : '';
  const curatorName = lookup.data?.full_name?.trim() || '';
  // A face or a profile row means an account; an editorial handle has
  // neither (see `curatorHandle`). Blocking a handle with nobody behind
  // it would block whoever seeded the row — the desk's own account.
  const curatorIsPerson = !!curatorAvatar || !!lookup.data;
  const blockCurator = () => {
    const target = col?.owner_id;
    if (!target) return;
    Alert.alert(
      t(`Block ${curatorTag}?`, `Chặn ${curatorTag}?`, `${curatorTag} をブロックしますか？`, `屏蔽 ${curatorTag}？`, `遮蔽 ${curatorTag}？`),
      t(
        'They will not be told. You can undo this from Blocked.',
        'Họ sẽ không được báo. Bạn có thể bỏ chặn trong mục Đã chặn.',
        '相手に通知されません。ブロック中から解除できます。',
        '对方不会收到通知。你可以在“已屏蔽”中撤销。', '對方不會收到通知。你可以在「已遮蔽」中取消。',
      ),
      [
        { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
        {
          text: t('Block', 'Chặn', 'ブロック', '屏蔽', '遮蔽'),
          style: 'destructive',
          onPress: () => {
            blockUser(target)
              .then(() => Alert.alert(
                t(`${curatorTag} is blocked`, `Đã chặn ${curatorTag}`, `${curatorTag} をブロックしました`, `已屏蔽 ${curatorTag}`, `已遮蔽 ${curatorTag}`),
                t(
                  'Their public lists stay on the shelf; they can no longer reach you.',
                  'Bộ sưu tập công khai của họ vẫn hiện; họ không thể liên hệ bạn nữa.',
                  '公開リストは表示されたままですが、相手からは連絡できなくなります。',
                  '对方的公开清单仍会显示，但对方无法再联系你。', '對方的公開清單仍會顯示，但對方無法再聯絡你。',
                ),
              ))
              .catch(() => Alert.alert(
                t('Could not block', 'Không chặn được', 'ブロックできませんでした', '无法屏蔽', '無法遮蔽'),
                t('Please try again later.', 'Vui lòng thử lại sau.', '後でもう一度お試しください。', '请稍后再试。', '請稍後再試。'),
              ));
          },
        },
      ],
    );
  };
  const curatorActions: PersonAction[] = [];
  // Never on a shared list: see `sharedToMe`.
  if (col && curatorTag && !sharedToMe && canReport({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id })) {
    curatorActions.push({
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
    });
  }
  if (col && curatorTag && uid && col.owner_id && curatorIsPerson) {
    curatorActions.push({
      key: 'block',
      icon: 'ban-outline',
      title: t(`Block ${curatorTag}`, `Chặn ${curatorTag}`, `${curatorTag} をブロック`, `屏蔽 ${curatorTag}`, `遮蔽 ${curatorTag}`),
      desc: t(
        'They will not be told, and can no longer reach you.',
        'Họ sẽ không được báo, và không thể liên hệ bạn nữa.',
        '相手に通知されず、あなたに連絡できなくなります。',
        '对方不会收到通知，也无法再联系你。', '對方不會收到通知，也無法再聯絡你。',
      ),
      destructive: true,
      onPress: blockCurator,
    });
  }
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
  const curatorFace = (
    <>
      {owned
        ? <Avatar url={profile?.avatar_url || null} size={28} />
        : holdForFace ? <Avatar url={curatorAvatar} size={28} /> : null}
      <Text style={s.curatorTag} numberOfLines={1}>{faceTag}</Text>
    </>
  );
  const curatorRow = faceTag ? (
    !owned && curatorActions.length > 0 ? (
      <PressableScale
        contentStyle={s.curator}
        onPress={() => setAboutCurator(true)}
        scaleTo={0.97}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={curatorTag}
        testID="collection-curator"
      >
        {curatorFace}
      </PressableScale>
    ) : (
      <View style={s.curator} testID="collection-curator">{curatorFace}</View>
    )
  ) : null;

  /* The header's right-hand slot.

     ⋯, and everybody gets it, not only the owner: what the
     menu offers branches, but "there is more you can do with this list"
     is true on both sides of that line, and a header whose right-hand
     side is empty for half its visitors reads as a screen that forgot
     something. `collapsable={false}` keeps the wrapper a real native
     view, which is what `measureInWindow` needs to have something to
     measure.

     But only once there is a list. A missing one has nothing to copy or
     share, and while your own lists are still loading there is no row to
     read `owner_id` off yet — `owned` is false by default, so the owner was
     briefly offered the visitor's "Save a copy" of their own list. Once the
     row is here its `owner_id` settles whose it is. */
  const headerRight = col ? (
    <View style={s.headerRight}>
      {/* The ⋯ alone, with no disc, and hung past the right margin by the
          glyph's own empty edge so its ink ends where the cards do (owner,
          12 Nov 2026) — as the chevron opposite does on the left. The hang
          is on this wrapper rather than the button so the guide's ring,
          drawn inside it, moves with what it rings. */}
      <View ref={btn} collapsable={false} style={{ marginRight: -INK_GAP_END['ellipsis-horizontal'] }}>
        <RoundIconButton
          bare
          icon="ellipsis-horizontal"
          onPress={openMenu}
          // "Tùy chọn khác" and not "Thêm" (owner, 22 Oct 2026): heard
          // alone, "Thêm" is "add", and this screen has an Add place too.
          label={t('More', 'Tùy chọn khác', 'その他', '更多', '更多')}
          testID="collection-more"
        />
      </View>
    </View>
  ) : null;

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

      The pencil is the owner's, and opens the same form the menu's
      "Edit collection" does. Two doors to one action, which is what
      took the "Add place" slot away the same day — but this one sits
      on the text it changes, so it reads as "change this", not as a
      second general button. 44pt to the thumb.

      ── the two glyphs (owner, 15 Oct 2026) ──
      The pencil was Ionicons' `pencil`, a single thin diagonal that
      read at 17pt on a pale card as a stroke rather than a control.
      It is `create-outline` now — the framed pencil the ⋯ menu's own
      "Edit collection" row wears, so one action has one glyph and the
      reader already knows it from the menu. And a note glyph leads
      the card: on somebody else's list nothing said whose words these
      were, and the card could read as the app's own copy. The page
      with lines says "a note", which is the one fact it adds. Both at
      20pt in `textSecondary`, the card's one secondary ink, each
      centred on the first line (24 tall, so 2 down); the text column
      gives up their 32pt, which a two-line note can spare.

      ── the face, the foot (owner, 16 Oct 2026) ──
      On somebody else's list the curator's face and handle now lead
      the card where the note glyph was (see `curatorRow`), and every
      card ends in a foot with the place count and the heart (see
      `cardFoot`), both moved down from the header. So the card is
      drawn on every list, a visitor's included: it always has at
      least the count to say. Your own list leads with your own face
      (see `ownTag`); the note glyph returns only without a handle.

      An owner's list with no description still invites one: the line
      and the pencil open the form.

      On somebody else's list the pencil's corner holds "Save a copy"
      (owner, 27 Oct 2026): the one thing a visitor does to a list they
      like, at the place the owner's own change-this sits.

      Checked on the text `t` picks, not on a hand-listed pair of
      columns: that left a Japanese-only description never drawn.

      ── the chips (owner, 15 Oct 2026) ──
      Under the words, in the same card, because they answer the same
      question — what is this list — and one pencil edits both. They
      are every kind the places carry, most places first, less what
      the owner hid (`lib/collectionKinds`), drawn as `KindPill` — the
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
        {owned || canCopy || curatorRow ? (
        <View style={s.descTop}>
          {/* The note glyph, only on your own list and only when there
              is no handle to lead with: it says "your words go here". */}
          {owned && !ownTag ? (
            <Glyph
              name="document-text-outline"
              size={20}
              color={desc ? colors.textSecondary : colors.textTertiary}
              style={s.descGlyph}
            />
          ) : null}
          <View style={s.descBody}>
            {curatorRow}
          </View>
          {owned ? (
            <PressableScale
              onPress={edit}
              scaleTo={0.85}
              haptic="selection"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('Edit description', 'Sửa mô tả', '説明を編集', '编辑简介', '編輯簡介')}
              testID="collection-desc-edit"
            >
              <Glyph
                name="create-outline"
                size={20}
                color={desc ? colors.textSecondary : colors.textTertiary}
                style={s.descGlyph}
              />
            </PressableScale>
          ) : canCopy ? (
            // Somebody else's list: the corner the pencil holds on yours
            // holds what you can do with theirs (owner, 27 Oct 2026). The
            // same `copy` the menu row and the dock pill call, and the
            // same glyph, so one action keeps one look; only where a city
            // gives the copy somewhere to go, as both of those do.
            <PressableScale
              onPress={copy}
              scaleTo={0.85}
              haptic="selection"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')}
              testID="collection-desc-copy"
            >
              <Glyph
                name="duplicate-outline"
                size={20}
                color={colors.textSecondary}
                style={s.descGlyph}
              />
            </PressableScale>
          ) : null}
        </View>
        ) : null}
        {/* Across the card too, the words as well as the kinds: the
            description's column stopped at the pencil's, 48pt short of
            the right edge against 16 on the left (owner, 13 Nov 2026). */}
        {desc ? (
          // Five lines, then "… Đọc thêm" (owner, 3 Nov 2026): a long
          // note had filled the screen the places are for. See
          // `MoreText`.
          <MoreText text={desc} style={s.descText} testID="collection-desc-text" />
        ) : owned ? (
          // The invitation: the line and the pencil open the form.
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
            <Glyph name="add" size={17} color={colors.accent} />
            <Text style={s.descAddText}>{t('Add a description', 'Thêm mô tả', '説明を追加', '添加简介', '新增簡介')}</Text>
          </PressableScale>
        ) : null}
        {kindRow}
        {cardFoot}
      </Card>
    </View>
  ) : null;

  return (
    <Screen
      title={title}
      onBack={() => navigation.goBack()}
      backTestID="collection-back"
      backBare
      compactTitle
      right={headerRight}
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

      {/* Anchored under the control that opened it, which is the whole
          argument for a popover over a sheet: the menu is visibly this
          button's menu. No Cancel row — tapping anywhere off the card is
          the way out, and a menu that hangs off its own control does not
          need to explain that. */}
      <Modal
        visible={menu}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenu(false)}
      >
        <Pressable
          style={s.scrim}
          onPress={() => setMenu(false)}
          // The way out under VoiceOver, which has no "anywhere off the
          // card" to tap: the backdrop has to be a control it can name.
          accessibilityRole="button"
          accessibilityLabel={t('Close menu', 'Đóng menu', 'メニューを閉じる', '关闭菜单', '關閉選單')}
        />
        <View style={[s.menu, { top: anchor.top, right: anchor.right }]}>
          {owned ? (
            <>
              <MenuRow
                icon="add-circle-outline"
                label={t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點')}
                onPress={() => act(addPlace)}
                first
              />
              {canPlan && (
                <MenuRow
                  icon="paw-outline"
                  label={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')}
                  onPress={() => act(plan)}
                  testID="collection-menu-plan"
                />
              )}
              {viewRows()}
              <MenuRow
                icon="create-outline"
                label={t('Edit collection', 'Sửa bộ sưu tập', 'コレクションを編集', '编辑合集', '編輯合集')}
                onPress={() => act(edit)}
                testID="collection-menu-edit"
              />
              <MenuRow
                icon="share-outline"
                label={t('Share', 'Chia sẻ', '共有', '分享', '分享')}
                onPress={() => act(share)}
              />
              {/* No publish row: who can see the list is changed where it
                  is said, at the foot of the card — see `visibility`. */}
              <MenuRow
                icon="trash-outline"
                label={t('Delete collection', 'Xoá bộ sưu tập', 'コレクションを削除', '删除合集', '刪除合集')}
                onPress={() => act(remove)}
                danger
                testID="collection-menu-delete"
              />
            </>
          ) : (
            /* Somebody else's list, so the menu is the two things you can
               do to a thing you do not own: take it, or pass it on. No
               Edit, no Delete, no publish switch — not because they are
               kept from you but because they are not yours to press, and
               a menu listing what the database will refuse lies twice.

               "Save a copy" and not "Follow", and the wording is the
               promise. Following would leave the curator in charge of
               what you see — they drop a place, you lose it — and the
               reason to want this list was to make it yours: reorder it,
               cut the two you have been to, add the four you know. It
               copies, and the row says so before the tap rather than
               after it.

               A friend's list shared with you keeps only the reading half:
               Plan a trip and the two views. See `sharedToMe`. */
            <>
              {/* What a reader does with a list once read, so it leads. */}
              {canPlan && (
                <MenuRow
                  icon="paw-outline"
                  label={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')}
                  onPress={() => act(plan)}
                  first
                  testID="collection-menu-plan"
                />
              )}
              {/* Only with a city to file the copy under. Without one the
                  row could only close the menu and do nothing, and a row
                  that does nothing is worse than a row that is not there. */}
              {canCopy && (
                <MenuRow
                  icon="duplicate-outline"
                  label={t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')}
                  onPress={() => act(copy)}
                  first={!canPlan}
                />
              )}
              {viewRows(!canCopy && !canPlan)}
              {!sharedToMe && (
                <MenuRow
                  icon="share-outline"
                  label={t('Share', 'Chia sẻ', '共有', '分享', '分享')}
                  onPress={() => act(share)}
                  testID="collection-menu-share"
                />
              )}
              {/* The third thing you can do about somebody else's list,
                  and the one the store asks for: say something is wrong
                  with it. Last, and marked, because it is the row that
                  is about a person rather than about the list — and
                  never on your own, which is yours to delete. */}
              {col && !sharedToMe && canReport({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id }) && (
                <MenuRow
                  icon="flag-outline"
                  label={t('Report this list', 'Báo cáo bộ sưu tập này', 'このリストを報告', '举报这个清单', '舉報這個清單')}
                  danger
                  onPress={() => act(() => report({
                    kind: 'collection',
                    id: col.id ?? '',
                    ownerId: col.owner_id,
                    name: title,
                  }))}
                />
              )}
            </>
          )}
        </View>
      </Modal>
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
      <PersonSheet
        visible={aboutCurator}
        name={curatorName || curatorTag}
        meta={curatorName ? curatorTag : undefined}
        avatarUrl={curatorAvatar ?? undefined}
        actions={curatorActions}
        onClose={() => setAboutCurator(false)}
      />
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
        actions={whoSeesRows}
        header={
          <Text style={s.sheetTitle} accessibilityRole="header">
            {t('Who can see your list?', 'Những ai xem được bộ sưu tập của bạn?', 'あなたのリストを見られるのは？', '谁能看到你的清单？', '誰能看到你的清單？')}
          </Text>
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  // No `screen`, no `header`, no `title`. This screen drew its own header
  // and it drifted: a 20pt title where every other pushed screen has 26,
  // centred against a two-line stack where the shared one aligns to the
  // first line, and its own paddings. `Screen` draws it now — the same
  // component Crew, Trips, Ideas and six others already use, and the same
  // shape `authUi` arrived at independently.
  //
  // The 20pt was a workaround for long collection names truncating, which
  // `Screen` answers better: two lines at 26pt hold far more of a name
  // than one line at 20 ever did.
  // The glyph, the word and the chevron, as one press, on nothing: see
  // `visibility` above. The 5 the header line it came from used, so the
  // three still read as one phrase. Still `CHIP_H` tall, with no fill to
  // show it, so `CHIP_SLOP` keeps making the 44pt target.
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 5, height: CHIP_H },
  // A question, so it is the sheet's whole header: the rows under it are
  // the answers, and the title VoiceOver hears first. The size and face
  // Visited's sheet titles use.
  sheetTitle: { color: colors.text, fontSize: 18, fontFamily: display.semibold, paddingHorizontal: 4 },
  meta: { color: colors.textTertiary, ...type.meta },
  // The heart and its tally, one fact, first in the card's foot (see
  // `cardFoot`). In the header it had to sit beside the count, or it read
  // as a second header control slipped a line under ⋯ — inside the card
  // there is no control above it to be mistaken for.
  like: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Public or Private, in one grey — see `visibility`.
  visibilityWord: { color: colors.textSecondary, ...type.meta },

  // Full width at the foot of the list, in the page's margins, with the
  // room the dashed slot it replaced kept above it.
  // The chips and, while something is chosen, the count line under them.
  kindsBlock: { gap: 10 },
  // The kinds in a column that wraps, the count fixed to its right; 16
  // between them, under the 18 between two kinds, so the count reads as
  // the row's end rather than one more kind.
  kindsLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  kindsLeft: { flex: 1 },
  // A bare kind's box — 13pt medium in the tertiary grey, the pin at the
  // word's size — so the figure is a kind's equal in weight and quieter
  // in ink: it counts, it does not name. 3 between pin and figure, not a
  // kind's 6 between dot and word: the pin's own bearings make up the
  // rest (measured in ink, see `cardFoot`).
  placeCount: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  placeCountText: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium },
  // `KindPill`'s rule, clear: 4 above and below and a 2pt border, so a
  // filter row's first line and the count are one height.
  placeCountRule: { paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterCountText: { color: colors.textTertiary, fontSize: 13 },
  filterClear: { color: colors.accent, fontSize: 13, fontWeight: font.semibold },
  // The page's margins outside, the card's padding inside; the text keeps
  // the body size and line height it had bare, so nothing reflows but
  // the inset. The pencil hangs at the top right, level with the first
  // line, and the text takes the rest of the row.
  descWrap: { paddingHorizontal: space.page, paddingBottom: 14 },
  // ── the card's rhythm, measured in ink (owner, 13 Nov 2026) ──
  // Read off a 2x render of a visitor's card, ink to ink:
  //
  // |                       | before | now  |
  // |-----------------------|--------|------|
  // | card's top → face     | 16     | 20   |
  // | face → words          | 15–18  | 17–20 (accents, letters) |
  // | words → kinds         | 20.5   | 20.5 |
  // | kinds → hairline      | 21     | 21   |
  // | hairline → heart      | 16.5   | 20.5 |
  // | heart → card's foot   | 20     | 20   |
  // | words' left / right   | 16 / 48 | 16 / 16 |
  //
  // So one rhythm of about 20 from the card's top to its foot: the words
  // came out of the face's row (the 12 of `descBody` became this 14),
  // the foot's top went from 12 to 16, and the top from 16 to 20, since
  // the face is a solid 28pt disc whose ink fills its box while the
  // heart, at the foot, carries a few points of its glyph's own air. The
  // sides stay 16: the words now run to the card's own edges.
  descCard: { gap: 14, padding: space.cardPadding, paddingTop: space.cardPadding + 4 },
  // The face and the handle with the pencil (or the copy) at the end of
  // its row; the words go under it, across the card (owner, 13 Nov 2026).
  descTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  descBody: { flex: 1 },
  // The face and the handle. `alignSelf` keeps the press to the row's own
  // width rather than the card's: a tap on empty space beside a handle
  // should not open a sheet about a person.
  curator: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', maxWidth: '100%' },
  curatorTag: { color: colors.text, fontSize: 15, fontWeight: font.semibold, flexShrink: 1 },
  // A hairline, then the heart and who can see it, from the start.
  //
  // ── the spacing, measured in ink (owner, 12 Nov 2026) ──
  // Measured while the count was still in the foot; it moved to the kinds'
  // row the next day, taking its 3 with it (`placeCount`), and the 20 now
  // stands between the heart and the visibility.
  // Read off a 2x render of a visitor's foot, glyph ink to glyph ink, not
  // off these numbers: each glyph's box has side bearings of its own.
  //
  // |                     | ♡ → 2 | 2 → 📍 | 📍 → 17 |
  // |---------------------|-------|--------|---------|
  // | was (gap 16, pin 6) | 6.5   | 20     | 9.5     |
  // | now (gap 20, pin 3) | 6.5   | 24     | 6.5     |
  //
  // The pin's box is wider round its ink than the heart's, so at the
  // same gap its count stood 3pt further off. "2 · 📍 · 17" read as four
  // things evenly spaced, not two pairs: 20 between the pairs was only
  // twice the 9.5 inside one. Now each glyph sits 6.5 from its count and
  // the pairs 24 apart, nearly four times that.
  cardFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    // 16, not 12 (owner, 13 Nov 2026): the hairline sat 16.5 above the
    // heart's ink and 21 under the kinds', and the heart 20 above the
    // card's edge — one rhythm of about 20 now, see `descCard`.
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  // Justified (owner, 3 Nov 2026), the owner's call over the case put
  // against it: a 318pt column holds some 44 characters, iOS does not
  // hyphenate Vietnamese, and the up-to-25pt each ragged line stopped
  // short now goes into its nine or so spaces — some open to near twice
  // a space. The last line stays ragged, as justified text always ends,
  // so "… Đọc thêm" and "Thu gọn" keep their own spacing. Here only: the
  // place blurbs and every other paragraph stay set ragged-right.
  descText: { color: colors.textSecondary, ...type.body, lineHeight: 24, textAlign: 'justify' },
  // `alignSelf` keeps the press to the words, as the curator row's does.
  descAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 24 },
  descAddText: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  // A 20pt glyph centred on a 24pt first line.
  descGlyph: { marginTop: 2 },

  // A text button, not a pill: it sits where the overflow control was and
  // the header already has one round shape in it on the other side.
  // The responder that carries a lifted card: the list's whole height.
  dragArea: { flex: 1 },
  // The status beside ⋯ and the button, on one line.
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  // Lifted: above its neighbours, with the shadow of something held off
  // the page. `zIndex` for iOS and the web, `elevation` for Android.
  arrangeCellLifted: { zIndex: 10, elevation: 6 },
  gridRow: { paddingHorizontal: space.page, gap: GRID_GAP, marginBottom: GRID_GAP },

  // Lighter than the sheet's scrim was. A popover keeps its context —
  // you can still read the row you are acting on — where a sheet takes
  // the screen and has to dim what it covers.
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.22)' },
  menu: {
    position: 'absolute', minWidth: 232, maxWidth: 300,
    backgroundColor: colors.bgElevated, borderRadius: 16, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    // The one shadow in the app. Depth everywhere else comes from the
    // ground and hairlines, but this layer genuinely floats above the
    // page and a hairline alone does not say so.
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 18 },
  menuRowOn: { backgroundColor: colors.surfaceGlass },
  menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  menuText: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: font.medium },
  // The tick sits at the row's far end, past the label.
  menuCheck: { marginLeft: 'auto' },
  // A choice's name over its rows: smaller and quieter than a row, so it
  // reads as a heading and not as one more thing to press.
  menuSection: {
    color: colors.textSecondary, fontSize: 13, fontWeight: font.medium,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 2,
  },
  emptyWrap: { marginHorizontal: space.page, marginTop: 24 },
  empty: {
    alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding + 6, paddingTop: 26, paddingBottom: 24,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card,
  },
  emptyIcon: {
    width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  // 16, not 15: it is one short line now rather than a paragraph, and at
  // the smaller size it read as a caption under the glyph.
  emptyBody: {
    color: colors.textSecondary, fontSize: 16, lineHeight: 22, textAlign: 'center',
  },
});
