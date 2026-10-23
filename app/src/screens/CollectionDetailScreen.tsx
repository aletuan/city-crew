import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent, AccessibilityInfo, ActivityIndicator, Alert, Animated, Dimensions, FlatList, LayoutAnimation, Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent, Pressable, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import PlaceCard from '../components/PlaceCard';
import PlaceTile from '../components/PlaceTile';
import { KindPills } from '../components/KindPill';
import {
  AmbientWarmth, Avatar, Card, Empty, GradientCta, PressableScale, RoundIconButton, Screen,
  fireHaptic, useReducedMotion, useTabBarClearance,
} from '../components/ui';
import { LIFT_AFTER_MS, useListDrag } from '../components/useListDrag';
import { AttentionRing } from '../components/Attention';
import { useDuckOnScroll, useTabBarDucked } from '../components/tabBarDuck';
import { DockOffer, DockSlot, useDockOffer } from '../components/DockSlot';
import { AddCell, AddPill } from '../components/add';
import { useProfile, useSession } from '../lib/auth';
import { categoriesOf } from '../lib/categories';
import { collectionKinds, narrowTo } from '../lib/collectionKinds';
import { useCollections, useCuratorAvatar, useLikes, usePlaces } from '../lib/catalog';
import { likesWorthShowing } from '../lib/likes';
import {
  blockUser, deleteCollection, membersOf, reorderCollection,
  setCollectionPublic, unseenMembers, unseenSentence, useProfileByHandle,
} from '../lib/data';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useCurrentCity } from '../lib/city';
import { applyDraft, moveItem, sameOrder } from '../lib/order';
import { useReport } from '../components/reportFlow';
import PersonSheet, { type PersonAction } from '../components/PersonSheet';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import { useMyLists, useSaveActions } from '../lib/save';
import { useGridNotice } from '../lib/gridNotice';
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
function OwnEmpty({ onExplore }: { onExplore: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.emptyWrap}>
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Ionicons name="bookmark-outline" size={26} color={colors.accent} />
        </View>
        {/* One line. The second sentence was telling you to go looking,
            which is what the button underneath already says — a card this
            small should not say the same thing twice, once in prose and
            once as a control. */}
        <Text style={s.emptyBody}>
          {t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。', '这里还没有内容。', '這裡還沒有內容。')}
        </Text>
        <GradientCta
          icon="compass-outline"
          label={t('Explore places', 'Khám phá địa điểm', 'スポットを見る', '探索地点', '探索地點')}
          onPress={onExplore}
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
      <Ionicons name={icon} size={21} color={danger ? colors.bad : colors.text} />
      <Text style={[s.menuText, danger && { color: colors.bad }]} numberOfLines={1}>{label}</Text>
      {checked && <Ionicons name="checkmark" size={20} color={colors.accent} style={s.menuCheck} />}
    </Pressable>
  );
}

/**
 * How long the visibility banner stays. The longer sentence is seven
 * words ("Bộ sưu tập này giờ đã công khai"), about two seconds at an
 * adult's silent reading pace of roughly 240 words a minute, and a
 * second more for the eye to arrive at it after the sheet has closed.
 * Not longer: the word at the card's foot already says the same thing
 * and stays.
 */
const BANNER_MS = 3000;

/** The banner's arrival and departure: 250ms, eased both ways, fading as
 *  the row opens or closes so the list below moves rather than jumps.
 *  The search field's slide is 200 for a smaller move; this one carries
 *  the whole list 60pt. */
const BANNER_EASE = LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

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

/** The ring round the 44pt ⋯ button, 4 clear of it all round. */
const MORE_RING = { left: -4, top: -4, width: 52, height: 52 };

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
function DraggableCard({
  place, index, count, style, onOpen, onUp, onDown, onLift, onRelease, onPitch,
}: {
  place: Place;
  index: number;
  count: number;
  /** What this card wears right now — raised and travelling, stepped
   *  aside, or nothing — from `useListDrag`'s `styleOf`. */
  style: ReturnType<ReturnType<typeof useListDrag>['styleOf']>;
  onOpen: () => void;
  onUp: () => void;
  onDown: () => void;
  /** The hold completed: `pageY` is where the finger is, which the drag
   *  measures its travel from. */
  onLift: (index: number, pageY: number) => void;
  /** The card's button let go of the touch, by the finger coming up or by
   *  the list taking the drag over. */
  onRelease: () => void;
  onPitch: (slug: string, pitch: number) => void;
}) {
  const { t } = useI18n();
  return (
    <Animated.View
      onLayout={(e) => onPitch(place.slug, e.nativeEvent.layout.height)}
      style={style}
      testID={`drag-${place.slug}`}
    >
      <PlaceCard
        place={place}
        onPress={onOpen}
        testID={`collection-place-${index}`}
        onLongPress={(e) => onLift(index, e.nativeEvent.pageY)}
        delayLongPress={LIFT_AFTER_MS}
        onPressOut={onRelease}
        {...stepsFor(t, index, count, 'list', onUp, onDown)}
      />
    </Animated.View>
  );
}

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
function DraggableTile({
  place, index, count, size, style, onOpen, onUp, onDown, onLift, onRelease,
}: {
  place: Place;
  index: number;
  count: number;
  size: number;
  style: ReturnType<ReturnType<typeof useListDrag>['styleOf']>;
  onOpen: () => void;
  onUp: () => void;
  onDown: () => void;
  onLift: (index: number, pageY: number, pageX: number) => void;
  onRelease: () => void;
}) {
  const { t } = useI18n();
  return (
    <Animated.View style={style} testID={`drag-${place.slug}`}>
      <PlaceTile
        place={place}
        size={size}
        onPress={onOpen}
        testID={`collection-tile-${index}`}
        onLongPress={(e) => onLift(index, e.nativeEvent.pageY, e.nativeEvent.pageX)}
        delayLongPress={LIFT_AFTER_MS}
        onPressOut={onRelease}
        {...stepsFor(t, index, count, 'grid', onUp, onDown)}
      />
    </Animated.View>
  );
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
  const col = useMemo(
    () => [...mine.data, ...cols.data].find((c) => c.slug === route.params.slug),
    [mine.data, cols.data, route.params.slug],
  );
  const members = useMemo(() => (col ? membersOf(col, places) : []), [col, places]);
  const note = useNoteEvent();
  const loading = cols.loading || mine.loading || placesLoading;
  // Pull to reload (owner, 23 Oct 2026). Until then this screen reloaded
  // only after a write of its own, so a place the desk approved, or a
  // change made to the list on another phone, waited for a trip back to
  // the Collections tab and a pull there. All three catalogs, because the
  // screen is drawn from all three: the list from `mine` or `cols`, a
  // community list's places from `places`.
  //
  // The spinner belongs to the pull, as on Collections and Explore: armed
  // by the gesture, disarmed when the fetches settle, and never lit by a
  // background revalidate nobody asked to watch.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !loading) setPulling(false);
  }, [pulling, loading]);
  const pull = () => { setPulling(true); cols.reload(); mine.reload(); placesReload(); };
  const owned = !!col?.owner_id && col.owner_id === uid;
  const isPublic = !!col?.is_public;
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
  // A tap on a chip narrows the places to that kind; any number chosen,
  // and a place stays if it carries any of them. Nothing chosen is the
  // whole list — there is no "All" chip, by the owner's ruling, and the
  // way back is the count line's "Clear" or the chips tapped off.
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
  const pick = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const kept = narrowed ? narrowTo(members, chosen).length : members.length;
  const kindRow = kinds.length > 0 ? (
    <View style={s.kindsBlock}>
      <KindPills
        kinds={kinds}
        chosen={chosen}
        onPick={filters ? pick : undefined}
        testID="collection-kinds"
      />
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
  const btn = useRef<View>(null);
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
  const [view, pickView, viewFrom] = useStored<'list' | 'grid'>(
    readerKey(COLLECTION_VIEW_KEY, userId), 'grid', LIST_OR_GRID,
  );
  const grid = view === 'grid';
  // Open until the reader closes it with its ×, on this phone or any
  // other the account is signed into — see `lib/gridNotice` for the rule
  // and the two memories it is kept in.
  const { state: noticeState, close: closeNotice } = useGridNotice(userId);
  // Only once both reads are in, and so only once it is known who is
  // reading: until then a reader who chose the cards is shown the grid
  // by default, for a moment, and a reader who closed the notice has not
  // yet been read as having closed it.
  const noticing = viewFrom !== 'reading' && noticeState === 'open'
    && grid && members.length > 0;
  // Each time the screen comes back into view with the notice still open,
  // the ⋯ button's ring pulses its three again (owner, 22 Oct 2026). The
  // first three ran while the screen was still sliding in, under eyes on
  // the photographs, and a reader back from a place found only the still
  // ring. Not pulsing on and on: the × is there to stop it, but a ring
  // breathing in the corner for as long as one browses is a nag.
  const [visits, setVisits] = useState(0);
  useEffect(() => navigation.addListener('focus', () => setVisits((n) => n + 1)), [navigation]);
  /*
   * The two views, in either menu: how a list is looked at is the
   * reader's, whoever made the list. A choice of two under its own name,
   * the one in force ticked, as iOS's own Files does it (owner, 22 Oct
   * 2026, from the reference). It was one row naming where it went —
   * "List view" while in the grid — which said nothing about where you
   * were, and the grid notice needs a row it can point to by name.
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

  // Explore is where places are, and saving one from there already offers
  // this list by name. A picker that wrote straight back into this
  // collection would be better, and is a screen rather than a button.
  const addPlace = () => {
    navigation.getParent()?.navigate('Explore');
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
   * two taps on the same word, which stays on screen after the banner
   * has gone.
   *
   * Both catalogs are reloaded because the row moves between them: it
   * leaves nothing in `mine`, which returns everything you own either
   * way, but it enters and leaves the public query, and that query is
   * what the other section is drawn from.
   */
  const [banner, setBanner] = useState<null | 'public' | 'private'>(null);
  const [publishing, setPublishing] = useState(false);
  // No check for places under review here: a list goes public with them
  // in, and they stay out of everyone else's sight until they are live
  // (`*_lists_stay_public_around_unlive_places.sql`). The Public row says
  // how many (see `whoSeesRows`).
  const setPublic = (next: boolean) => {
    if (!col || publishing) return;
    setPublishing(true);
    setCollectionPublic(col.slug, next)
      .then(() => {
        mine.reload();
        cols.reload();
        showBanner(next ? 'public' : 'private');
      })
      .catch((e: Error) => Alert.alert(
        next
          ? t('Could not publish', 'Không công khai được', '公開できませんでした', '无法公开', '無法公開')
          : t('Could not make private', 'Không chuyển riêng tư được', '非公開にできませんでした', '无法设为私密', '無法設為私密'),
        e.message,
      ))
      .finally(() => setPublishing(false));
  };

  /* The banner says it once and goes. It stood until dismissed while it
     held the only Undo; with no Undo in it, a message that stays is a
     message about something already done, still taking a row at the top
     of the list. The word at the card's foot is the lasting record.

     VoiceOver hears the sentence, since it cannot see a banner arrive —
     `accessibilityLiveRegion` is Android's alone.

     It opens and closes as a layout animation rather than a jump: it
     sits in the flow above the card, and a 60pt row vanishing in one
     frame pulls the whole list up under the reader's eye. Not under
     Reduce Motion, which asks for exactly that jump instead. */
  const still = useReducedMotion();
  const ease = () => { if (!still) LayoutAnimation.configureNext(BANNER_EASE); };
  const bannerText = (which: 'public' | 'private') => which === 'public'
    ? t('This collection is now public', 'Bộ sưu tập này giờ đã công khai', 'このコレクションは公開されました', '这个合集已公开', '這個合集已公開')
    : t('This collection is private again', 'Bộ sưu tập này đã riêng tư trở lại', 'このコレクションは非公開に戻りました', '这个合集已改回私密', '這個合集已改回私密');
  const showBanner = (which: 'public' | 'private') => {
    ease();
    setBanner(which);
    AccessibilityInfo.announceForAccessibility(bannerText(which));
  };
  const hideBanner = () => { ease(); setBanner(null); };
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(hideBanner, BANNER_MS);
    return () => clearTimeout(timer);
    // Re-armed by a new message, not by a new render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner]);

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
      : t(
        'This list is private. Tap Private at the foot of its card to make it public — share links are on the way.',
        'Bộ sưu tập này đang riêng tư. Bấm Riêng tư ở cuối thẻ giới thiệu để công khai — liên kết chia sẻ sẽ sớm có.',
        'このコレクションは非公開です。紹介カードの下の「非公開」から公開できます。共有リンクは近日公開予定です。',
        '这个清单是私密的。点按卡片底部的“私密”即可公开 — 分享链接即将推出。', '這個清單是私密的。點按卡片底部的「私密」即可公開 — 分享連結即將推出。',
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

     The owner's alone. A visitor only ever meets a public list, and a
     word telling them so would be a fact about nothing they can change.

     The padlock the list already uses for the same fact, so a private
     collection looks the same wherever you meet it — and a globe once it
     is not private any more. Published reads in colour, because it is the
     state worth checking; Private stays grey, the resting state, which
     does not need announcing. The chevron is what says the word opens
     something; without it the row reads as a label.

     Tapping opens a choice rather than flipping the switch: a word that
     changes who can see your list on one touch is a word nobody would
     dare tap to find out what it does. */
  const [whoSees, setWhoSees] = useState(false);
  const visibility = col && owned ? (
    <PressableScale
      contentStyle={s.visibility}
      scaleTo={0.94}
      haptic="selection"
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 8 }}
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
      <Ionicons
        name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
        size={15}
        color={isPublic ? colors.ok : colors.textTertiary}
      />
      <Text style={isPublic ? s.metaPublic : s.meta}>
        {isPublic ? t('Public', 'Công khai', '公開', '公开', '公開') : t('Private', 'Riêng tư', '非公開', '私密', '私密')}
      </Text>
      <Ionicons name="chevron-down" size={13} color={colors.textTertiary} />
    </PressableScale>
  ) : null;

  /* The two answers, each with what it means where the reader will meet
     it. Choosing is doing: the sheet closes and the banner says what
     happened and holds the Undo, as the menu row's did, so there is no
     confirmation here either (see `setPublic`). The answer already true
     carries the tick, and choosing it again changes nothing — a write
     that re-saves the same boolean would raise a banner announcing a
     change that did not happen.

     No Cancel row. No other sheet in the app has one: the backdrop and
     the grabber are the way out, and the backdrop is a control VoiceOver
     names "Close".

     While some places are not public yet, Public says so in place of
     its plain description: the list goes out without them, and the
     owner who shows it to a friend should not be the one surprised that
     a place is missing. Until 23 Oct 2026 the row was dimmed instead and
     the list could not go public at all — and one already public went
     private, unannounced, the moment it gained such a place. */
  const choose = (next: boolean) => () => { if (next !== isPublic) setPublic(next); };
  const whoSeesRows: SheetAction[] = [
    {
      key: 'public',
      icon: 'globe-outline',
      title: t('Public', 'Công khai', '公開', '公开', '公開'),
      desc: someUnseen
        ? unseenSentence(unseen, t)
        : t('Shown in Explore and in search', 'Hiện trên Khám phá và trong tìm kiếm', '「探索する」と検索に表示されます', '会显示在探索和搜索中', '會顯示在探索和搜尋中'),
      selected: isPublic,
      onPress: choose(true),
    },
    {
      key: 'private',
      icon: 'lock-closed-outline',
      title: t('Private', 'Riêng tư', '非公開', '私密', '私密'),
      desc: t('Only you can see it', 'Chỉ mình bạn thấy', '自分だけが見られます', '仅你可见', '僅你可見'),
      selected: !isPublic,
      onPress: choose(false),
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
      <Ionicons
        name={liked ? 'heart' : 'heart-outline'}
        size={15}
        color={liked ? colors.accent : colors.textTertiary}
      />
      {likesWorthShowing(likes[col.slug])
        ? <Text style={s.meta}>{likes[col.slug]}</Text>
        : null}
    </PressableScale>
  ) : null;

  /* The card's foot: who can see it, how many places, and the heart.
     Under a hairline, the facts at the start and the heart at the end —
     the end of the row is where a thumb finds a gesture. Drawn on every
     list, yours included: the count is the one line every list has. On
     your own the visibility leads, and the count follows after a dot
     without its pin — the globe or padlock is already the row's glyph,
     and two glyphs on one line of facts read as two controls. */
  const cardFoot = col ? (
    <View style={s.cardFoot} testID="collection-stats">
      <View style={s.footCount}>
        {visibility}
        {visibility
          ? <Text style={s.meta}>·</Text>
          : <Ionicons name="location-outline" size={15} color={colors.textTertiary} />}
        <Text style={s.meta}>
          {members.length} {t(members.length === 1 ? 'place' : 'places', 'địa điểm', 'スポット', '个地点', '個地點')}
        </Text>
      </View>
      {heart}
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
  if (col && curatorTag && canReport({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id })) {
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
      <View ref={btn} collapsable={false}>
        <RoundIconButton
          icon="ellipsis-horizontal"
          onPress={openMenu}
          // "Tùy chọn khác" and not "Thêm" (owner, 22 Oct 2026): heard
          // alone, "Thêm" is "add", and this screen has an Add place too.
          label={t('More', 'Tùy chọn khác', 'その他', '更多', '更多')}
          testID="collection-more"
        />
        {/* The guide's own "look here" (`Attention`), while the grid notice
            points at this button: 4pt clear of the 44pt circle, as the
            guide rings its round search button. Transient: three pulses,
            then gone, and again on each return (owner, 22 Oct 2026) — the
            notice says where the way back is, and a still ring after the
            pulses only weighed on the corner. */}
        {noticing && <AttentionRing frame={MORE_RING} runKey={visits} transient testID="collection-more-ring" />}
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

     A list with no city has no copy to offer (see the ⋯ menu), so a
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
  const addCell = (size?: number) => (
    <AddCell
      label={t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點')}
      onPress={addPlace}
      size={size}
      testID="collection-add-cell"
    />
  );
  /* ── the grid notice (owner, 22 Oct 2026) ──
     Lists open as a grid now, so a reader looking at one is told, between
     the card and the tiles, where the way back is: the ⋯ button, ringed
     while this shows, until they close it (`lib/gridNotice`). A banner in the page rather than a
     sheet over it: it says something, it asks nothing, and the grid it is
     about is right under it. The guide's toast in look — the sheets'
     ground, the accent's tint behind the mark — so the app's two notices
     read as one kind of thing. */
  const gridNotice = (
    <View style={s.notice} testID="collection-grid-notice" accessibilityLiveRegion="polite">
      <View style={s.noticeMark}><Ionicons name="grid-outline" size={16} color={colors.accent} /></View>
      <View style={s.noticeText}>
        <Text style={s.noticeTitle}>
          {t('Now in grid view', 'Bộ sưu tập hiển thị dạng lưới',
            'グリッド表示になりました', '现在以网格显示', '現在以網格顯示')}
        </Text>
        {/* The ⋯ in the line is the button's own glyph on the button's own
            round ground, not the "⋯" character (owner, 22 Oct 2026): a
            character comes out thin and low in the body font and does not
            look like the round button it names, and a screen reader says
            "ellipsis". It is said as the button is labelled instead, "More" ("Tùy chọn khác"),
            so the sentence and the button agree out loud. With the glyph in
            the line, "in the corner of the screen" went: the chip and the
            ring already show where.

            One line, and no full stop (owner, 22 Oct 2026): the notice
            took about 92pt, most of it a second line of this sentence.
            "Đổi về danh sách" says it in half the words "Bạn có thể chuyển
            về dạng danh sách" did, and fits a 390pt phone in one line
            beside the 32pt mark; a sentence that is a single line of a
            tip wants no stop, as iOS's own tips have none. */}
        <Text
          style={s.noticeBody}
          accessibilityLabel={t('Switch to list in the More menu', 'Đổi về danh sách trong menu Tùy chọn khác',
            'その他メニューからリストに切り替え', '可在“更多”菜单中切换为列表', '可在「更多」選單中切換為列表')}
        >
          {(() => {
            const [before, after] = t('Switch to list in the {⋯} menu', 'Đổi về danh sách trong menu {⋯}',
              '{⋯} メニューからリストに切り替え', '可在 {⋯} 菜单中切换为列表', '可在 {⋯} 選單中切換為列表').split('{⋯}');
            return (
              <>
                {before}
                <View style={s.moreChip} testID="collection-grid-notice-more">
                  <Ionicons name="ellipsis-horizontal" size={12} color={colors.text} />
                </View>
                {after}
              </>
            );
          })()}
        </Text>
      </View>
      <Pressable onPress={closeNotice} accessibilityRole="button" hitSlop={4} style={s.noticeClose}
        accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')} testID="collection-grid-notice-close">
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );

  const introCard = col ? (
    <View style={s.descWrap}>
      <Card
        style={s.descCard}
        testID={desc || !owned ? 'collection-desc' : 'collection-desc-empty'}
      >
        <View style={s.descTop}>
          {/* The note glyph, only on your own list and only when there
              is no handle to lead with: it says "your words go here". */}
          {owned && !ownTag ? (
            <Ionicons
              name="document-text-outline"
              size={20}
              color={desc ? colors.textSecondary : colors.textTertiary}
              style={s.descGlyph}
            />
          ) : null}
          <View style={s.descBody}>
            {curatorRow}
            {desc ? (
              <Text style={s.descText}>{desc}</Text>
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
                <Ionicons name="add" size={17} color={colors.accent} />
                <Text style={s.descAddText}>{t('Add a description', 'Thêm mô tả', '説明を追加', '添加简介', '新增簡介')}</Text>
              </PressableScale>
            ) : null}
            {kindRow}
          </View>
          {owned && (
            <PressableScale
              onPress={edit}
              scaleTo={0.85}
              haptic="selection"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('Edit description', 'Sửa mô tả', '説明を編集', '编辑简介', '編輯簡介')}
              testID="collection-desc-edit"
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={desc ? colors.textSecondary : colors.textTertiary}
                style={s.descGlyph}
              />
            </PressableScale>
          )}
        </View>
        {cardFoot}
      </Card>
    </View>
  ) : null;

  return (
    <Screen
      title={title}
      onBack={() => navigation.goBack()}
      backTestID="collection-back"
      right={headerRight}
    >
      <AmbientWarmth />
      {/* What just happened, for three seconds — see `showBanner`. Above
          the description rather than floating over the list: it is about
          the collection as a whole, and a toast that covers the first
          place card would be reporting on the list by hiding part of it.

          A tap puts it away sooner: the row is the acknowledgement, so
          tapping it is how you say you have read it. */}
      {banner && (
        <Pressable
          style={[s.banner, banner === 'private' && s.bannerQuiet]}
          onPress={hideBanner}
          accessibilityRole="button"
          accessibilityHint={t('Dismisses this message', 'Ẩn thông báo này', 'このメッセージを閉じます', '关闭这条消息', '關閉這條訊息')}
          testID="collection-banner"
        >
          <Ionicons
            name={banner === 'public' ? 'checkmark-circle' : 'lock-closed'}
            size={19}
            color={banner === 'public' ? colors.ok : colors.textSecondary}
          />
          <Text style={s.bannerText} numberOfLines={3}>{bannerText(banner)}</Text>
        </Pressable>
      )}
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
              const open = () => navigation.navigate('PlaceDetail', { slug: item.slug });
              const up = () => shuffle(index, index - 1);
              const down = () => shuffle(index, index + 1);
              if (grid) {
                return canArrange
                  ? (
                    <DraggableTile
                      place={item}
                      index={index}
                      count={drafted.length}
                      size={tile}
                      style={styleOf(index)}
                      onOpen={open}
                      onUp={up}
                      onDown={down}
                      onLift={onLift}
                      onRelease={onRelease}
                    />
                  )
                  : <PlaceTile place={item} size={tile} onPress={open} testID={`collection-tile-${index}`} />;
              }
              return canArrange
                ? (
                  <DraggableCard
                    place={item}
                    index={index}
                    count={drafted.length}
                    style={styleOf(index)}
                    onOpen={open}
                    onUp={up}
                    onDown={down}
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
                  <PlaceCard
                    place={item}
                    onPress={open}
                    chip={narrowed ? kinds.find((k) => chosen.includes(k) && categoriesOf(item).includes(k)) : null}
                    testID={`collection-place-${index}`}
                  />
                );
            }}
            ListEmptyComponent={!loading && col
              ? (owned
                // One message, not two. The reference stacks "No places in this
                // collection yet." above a card that says the same thing again.
                ? <OwnEmpty onExplore={() => navigation.getParent()?.navigate('Explore')} />
                : <Empty text={t(
                  'No places in this collection yet.',
                  'Bộ sưu tập này chưa có địa điểm nào.',
                  'このコレクションにはまだスポットがありません。',
                  '这个合集里还没有地点。', '這個合集裡還沒有地點。',
                )} />)
              : null}
            ListHeaderComponent={introCard || noticing || (adding && !grid) ? (
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
                {noticing && gridNotice}
                {adding && !grid && addCell()}
              </>
            ) : null}
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
               after it. */
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
              {!!copyCityId && (
                <MenuRow
                  icon="duplicate-outline"
                  label={t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')}
                  onPress={() => act(copy)}
                  first={!canPlan}
                />
              )}
              {viewRows(!copyCityId && !canPlan)}
              <MenuRow
                icon="share-outline"
                label={t('Share', 'Chia sẻ', '共有', '分享', '分享')}
                onPress={() => act(share)}
              />
              {/* The third thing you can do about somebody else's list,
                  and the one the store asks for: say something is wrong
                  with it. Last, and marked, because it is the row that
                  is about a person rather than about the list — and
                  never on your own, which is yours to delete. */}
              {col && canReport({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id }) && (
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
            tall
            label={t('Place', 'Địa điểm', 'スポット', '地点', '地點')}
            accessibilityLabel={t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點')}
            onPress={addPlace}
            testID="collection-dock-add"
          />
        ) : copyCityId ? (
          <AddPill
            tall
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
      <ActionSheet
        visible={whoSees}
        onClose={() => setWhoSees(false)}
        actions={whoSeesRows}
        header={
          <Text style={s.sheetTitle} accessibilityRole="header">
            {t('Who can see this list?', 'Ai có thể xem bộ sưu tập này?', 'このリストを見られるのは？', '谁可以看到这个清单？', '誰可以看到這個清單？')}
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
  // The glyph, the word and the chevron, as one press. The 5 the header
  // line it came from used, so the three still read as one phrase.
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // A question, so it is the sheet's whole header: the rows under it are
  // the answers, and the title VoiceOver hears first. The size and face
  // Visited's sheet titles use.
  sheetTitle: { color: colors.text, fontSize: 18, fontFamily: display.semibold, paddingHorizontal: 4 },
  meta: { color: colors.textTertiary, ...type.meta },
  // The heart and its tally, one fact. At the end of the card's foot now:
  // in the header it had to sit beside the count, or it read as a second
  // header control slipped a line under ⋯ — inside the card there is no
  // control above it to be mistaken for.
  like: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The one word on the line that is not grey. `ok` is the app's green and
  // measures 4.35:1 on paper, which small text needs; the padlock beside
  // it stays tertiary because a resting state does not need a colour.
  metaPublic: { color: colors.ok, ...type.meta, fontWeight: font.semibold },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: space.page, marginBottom: 12,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: radius.input,
    // A wash of the same green rather than a filled bar: the message is
    // good news about a small thing, and a solid green rail across the top
    // of the screen would announce it like an error.
    backgroundColor: colors.okSoft,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  bannerQuiet: { backgroundColor: colors.surfaceGlass },
  bannerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: font.medium },

  // Full width at the foot of the list, in the page's margins, with the
  // room the dashed slot it replaced kept above it.
  // The chips and, while something is chosen, the count line under them.
  kindsBlock: { gap: 10 },
  filterCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterCountText: { color: colors.textTertiary, fontSize: 13 },
  filterClear: { color: colors.accent, fontSize: 13, fontWeight: font.semibold },
  // The page's margins outside, the card's padding inside; the text keeps
  // the body size and line height it had bare, so nothing reflows but
  // the inset. The pencil hangs at the top right, level with the first
  // line, and the text takes the rest of the row.
  descWrap: { paddingHorizontal: space.page, paddingBottom: 14 },
  descCard: { gap: 14, padding: space.cardPadding },
  // The glyph, the words and the pencil, on one row above the foot.
  descTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  descBody: { flex: 1, gap: 12 },
  // The face and the handle. `alignSelf` keeps the press to the row's own
  // width rather than the card's: a tap on empty space beside a handle
  // should not open a sheet about a person.
  curator: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', maxWidth: '100%' },
  curatorTag: { color: colors.text, fontSize: 15, fontWeight: font.semibold, flexShrink: 1 },
  // A hairline, then the count and the heart at either end.
  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  footCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  descText: { color: colors.textSecondary, ...type.body, lineHeight: 24 },
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
  // The guide's toast, in the page: see `gridNotice`.
  // 12 above and below, not 14, and a 32pt mark, not 40 (owner, 22 Oct
  // 2026, asking for it smaller): with the line now one line, the title
  // and it come to 44pt, and the mark was the tallest thing in the row.
  // About 68pt in all, where it was about 92.
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: space.page, marginBottom: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 4,
    backgroundColor: colors.bgElevated, borderColor: colors.borderGlassSoft, borderWidth: 1, borderRadius: radius.card,
  },
  noticeMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  noticeText: { flex: 1, gap: 2, paddingTop: 1 },
  noticeTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: font.semibold },
  noticeBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  // The ⋯ button in small, inside the line: the button's ground and glyph
  // at 18pt to its 44. A view in a line of text sits with its foot on the
  // baseline, so 18pt of chip stands about 3pt above the middle of 14pt
  // lower-case; it is brought down by that. A starting figure, to be
  // judged on a phone.
  moreChip: {
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, transform: [{ translateY: 3 }],
  },
  // 40pt, and 4 of slop each side, for the 44pt a finger needs.
  noticeClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -8 },

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
