import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, FlatList, Modal, Pressable, StyleProp, StyleSheet,
  Text, View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import PlaceCard from '../components/PlaceCard';
import TipBox from '../components/TipBox';
import { KindPills } from '../components/KindPill';
import {
  AmbientWarmth, Avatar, Card, Empty, GradientCta, PressableScale, RoundIconButton, Screen,
  fireHaptic, useTabBarClearance,
} from '../components/ui';
import { LIFT_AFTER_MS, useListDrag } from '../components/useListDrag';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useAuth } from '../lib/auth';
import { categoriesOf } from '../lib/categories';
import { collectionKinds, narrowTo } from '../lib/collectionKinds';
import { useCollections, useCuratorAvatar, useLikes, usePlaces } from '../lib/catalog';
import { likesWorthShowing } from '../lib/likes';
import {
  blockUser, deleteCollection, membersOf, publishBlockers, reorderCollection,
  setCollectionPublic, useProfileByHandle,
} from '../lib/data';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useCity } from '../lib/city';
import { moveItem, sameOrder } from '../lib/order';
import { useReport } from '../components/reportFlow';
import PersonSheet, { type PersonAction } from '../components/PersonSheet';
import { useSave } from '../lib/save';
import { useNoteEvent } from '../lib/tasteProfile';
import { useI18n } from '../lib/i18n';
import type { TipId } from '../lib/tips';
import { colors, font, radius, space, type } from '../theme';
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
          {t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。')}
        </Text>
        <GradientCta
          icon="compass-outline"
          label={t('Explore places', 'Khám phá địa điểm', 'スポットを見る')}
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
function MenuRow({ icon, label, onPress, danger, first, testID }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  first?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [s.menuRow, !first && s.menuDivider, pressed && s.menuRowOn]}
    >
      <Ionicons name={icon} size={21} color={danger ? colors.bad : colors.text} />
      <Text style={[s.menuText, danger && { color: colors.bad }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/**
 * Why a list cannot be published, said in words rather than counted at
 * the reader.
 *
 * It names both kinds because they end differently. A place still under
 * review will resolve on its own; one that was not accepted never will,
 * and the list stays private forever until its owner takes it out. A
 * sentence that said only "some places are pending" would leave them
 * waiting for something that is not coming.
 */
function blockerSentence(
  { pending, flagged }: { pending: number; flagged: number },
  t: (en: string, vi: string, ja: string) => string,
): string {
  const parts: string[] = [];
  if (pending) {
    // Not public *yet* — the state the list is in, rather than the
    // procedure it is waiting on. The owner does not need to picture a
    // queue to understand why the switch will not move; they need to know
    // which places are holding it, and that this one resolves on its own.
    parts.push(t(
      `${pending} ${pending === 1 ? 'place is' : 'places are'} not public yet`,
      `${pending} địa điểm chưa công khai`,
      `${pending}件がまだ公開されていません`,
    ));
  }
  if (flagged) {
    parts.push(t(
      `${flagged} ${flagged === 1 ? 'was' : 'were'} not accepted`,
      `${flagged} địa điểm không được duyệt`,
      `${flagged}件が不採用です`,
    ));
  }
  return t(
    `Private until every place is live — ${parts.join(', and ')}.`,
    `Riêng tư cho tới khi mọi địa điểm hiển thị — ${parts.join(', và ')}.`,
    `すべてのスポットが公開されるまで非公開です — ${parts.join('、')}。`,
  );
}

/**
 * How long after the last move the order is written.
 *
 * Long enough that a run of moves — three cards dropped one after another
 * — is one write rather than one per drop; short enough that the header
 * says "Saved" before the reader has looked up. Not measured: a chosen
 * beat. Leaving the screen writes at once, so the value can only decide
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
  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: t('Move up', 'Chuyển lên', '上へ移動') }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: t('Move down', 'Chuyển xuống', '下へ移動') }] : []),
  ];
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
        accessibilityHint={t(
          'Hold and drag to change the order.',
          'Giữ rồi kéo để đổi thứ tự.',
          '長押ししてドラッグすると並び順を変えられます。',
        )}
        accessibilityActions={actions}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'moveUp' ? onUp() : onDown())}
      />
    </Animated.View>
  );
}

export default function CollectionDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'CollectionDetail'> }) {
  const { t } = useI18n();
  const { session, profile } = useAuth();
  const uid = session?.user?.id;
  const cols = useCollections();
  // Both catalogs, because a list of your own that is still private is in
  // neither the public query nor anywhere else: without `mine` it would
  // open on "Collection not found". The owned half comes from the shared
  // copy, so a place saved from anywhere shows here. A published list of
  // your own is now in both, and `find` takes the first — `mine`, which
  // is the fuller row.
  const { mine, askToSignIn } = useSave();
  // Reporting, raised from the overflow menu — see components/reportFlow.
  const { report, canReport, node: reportSheet } = useReport();
  const { data: places, loading: placesLoading } = usePlaces();
  const { city } = useCity();
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
  // Why this list cannot go out, counted rather than asserted. Derived
  // from the members every time the screen opens, so it is right after a
  // review lands without anything having to be told — and it disappears
  // by itself when the last one clears, which is a truer signal than a
  // message would be.
  //
  // Only the owner can compute this, and only because they are the one
  // person allowed to see their own unreviewed places. That is the same
  // permission the reminder exists to explain.
  const blockers = useMemo(() => publishBlockers(members), [members]);
  const blocked = blockers.pending + blockers.flagged > 0;
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
            )}
          </Text>
          <Text style={s.filterCountText}>·</Text>
          <Pressable
            onPress={() => setPicked([])}
            hitSlop={12}
            accessibilityRole="button"
            testID="collection-filter-clear"
          >
            <Text style={s.filterClear}>{t('Clear', 'Bỏ lọc', '解除')}</Text>
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

  // The moves a tip explains that have been made on this visit. Their
  // tips retire (see `TipBox`): once you have done it, you know how.
  const [done, setDone] = useState<TipId[]>([]);
  const did = (id: TipId) => setDone((d) => (d.includes(id) ? d : [...d, id]));

  // Explore is where places are, and saving one from there already offers
  // this list by name. A picker that wrote straight back into this
  // collection would be better, and is a screen rather than a button.
  const addPlace = () => {
    did('add');
    navigation.getParent()?.navigate('Explore');
  };

  // The edit tip retires when an edit is saved, not when the form opens.
  // Opening it and backing out is a look, not a lesson, and it retired the
  // tip for good. The form writes and reloads the list this screen reads,
  // so a saved edit arrives here as a changed title, description or cover:
  // the effect runs on that change, and only one the form was opened for
  // counts.
  const editFields = col
    ? `${title}\n${desc}\n${col.cover?.id ?? ''}\n${col.kinds_hidden ?? []}\n${col.kinds_added ?? []}`
    : null;
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) return;
    editing.current = false;
    did('edit');
  }, [editFields]);

  const edit = () => {
    if (!col) return;
    editing.current = true;
    navigation.navigate('CollectionForm', { slug: col.slug, title, desc });
  };

  /**
   * Publish, or take it back.
   *
   * No confirmation on the way out, and a banner with Undo instead. An
   * alert asking "are you sure" before a reversible act is a toll on
   * everyone who meant it, paid so that the few who did not are stopped
   * one step earlier than the Undo would have stopped them. Publishing is
   * one boolean and unpublishing is the same boolean — the thing to
   * provide is a way back, not a gate.
   *
   * Both catalogs are reloaded because the row moves between them: it
   * leaves nothing in `mine`, which returns everything you own either
   * way, but it enters and leaves the public query, and that query is
   * what the other section is drawn from.
   */
  const [banner, setBanner] = useState<null | 'public' | 'private' | 'blocked'>(null);
  const [publishing, setPublishing] = useState(false);
  const setPublic = (next: boolean) => {
    if (!col || publishing) return;
    // The database refuses this too — that is where the rule lives. This
    // is so the answer arrives as a sentence about the list rather than
    // as `collection_has_pending_places` from Postgres.
    if (next && blocked) { setBanner('blocked'); return; }
    setPublishing(true);
    setCollectionPublic(col.slug, next)
      .then(() => {
        mine.reload();
        cols.reload();
        setBanner(next ? 'public' : 'private');
        if (next) did('publish');
      })
      .catch((e: Error) => Alert.alert(
        next
          ? t('Could not publish', 'Không công khai được', '公開できませんでした')
          : t('Could not make private', 'Không chuyển riêng tư được', '非公開にできませんでした'),
        e.message,
      ))
      .finally(() => setPublishing(false));
  };

  // The banner stands until it is dismissed or the screen is left. It
  // holds the only Undo there is, so a timer would be a deadline on
  // changing your mind about who can see your list.
  const undo = () => setPublic(banner === 'public' ? false : true);

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
   * screen writes whatever is waiting at once. The header says what the
   * write is doing instead of offering to do it.
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
  const bySlug = useMemo(() => new Map(members.map((p) => [p.slug, p])), [members]);
  // Members that have arrived since the draft began are appended rather
  // than dropped: saving would otherwise leave them wherever they were,
  // which is not a decision the reader made.
  const drafted: Place[] = draft
    ? [
      ...draft.map((slug) => bySlug.get(slug)).filter((p): p is Place => !!p),
      ...members.filter((p) => !draft.includes(p.slug)),
    ]
    : members;
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
        t('Could not save the order', 'Không lưu được thứ tự', '並び順を保存できませんでした'),
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
  // A card has moved on this visit: the reorder tip has been acted on.
  const moved = saveState !== 'idle';

  // ── the card in the finger ──
  //
  // The hold, the drag and the drop are `useListDrag`'s, shared with the
  // plan editor; landing calls `shuffle`, the same move VoiceOver's
  // actions make, and saves the same way. The pitch guess is a 16:10
  // photograph the width of a phone, the two lines under it, and the gap
  // below — only ever used for the first frame.
  const { lift, panHandlers, onLift, onRelease, onPitch, styleOf } = useListDrag({
    keys: drafted.map((p) => p.slug),
    onMove: shuffle,
    pitchGuess: PITCH_GUESS,
  });

  // Deliberately inert, and now inert for two different reasons — which
  // is why the sentence branches. A private list has no address to send
  // anyone to — and the sentence is about this list, not all of yours,
  // since "Make public" sits in the same menu. A published one is visible
  // to everybody but the app still has no link to hand over, because
  // nothing here registers a URL scheme or a web address for a
  // collection. Either way the honest placeholder
  // says which wall you have hit rather than opening a share sheet onto a
  // link that would 404 for whoever received it.
  const share = () => Alert.alert(
    t('Sharing is coming', 'Sắp có chia sẻ', '共有は近日公開'),
    isPublic
      ? t(
        'This list is public, but there is no link to send yet. Sharing one is on the way.',
        'Bộ sưu tập này đã công khai, nhưng chưa có liên kết để gửi. Tính năng chia sẻ sẽ sớm có.',
        'このコレクションは公開中ですが、送れるリンクはまだありません。共有機能は近日公開予定です。',
      )
      : t(
        'This list is private. You can make it public from this menu — share links are on the way.',
        'Bộ sưu tập này đang riêng tư. Bạn có thể công khai nó từ menu này — liên kết chia sẻ sẽ sớm có.',
        'このコレクションは非公開です。このメニューから公開できます。共有リンクは近日公開予定です。',
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
    did('copy');
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

  // The tips true of this list as it stands, in the order a first visit
  // meets them. Held back until everything has loaded: a list whose owner
  // is not known yet would be offered the visitor's tip.
  const tipsHere: TipId[] = !col || loading ? [] : owned
    ? [
      ...(canArrange ? ['reorder' as const] : []),
      // Not while places are still under review: the tip would point at a
      // switch that says no.
      ...(!isPublic && !blocked ? ['publish' as const] : []),
      'edit',
      'add',
    ]
    : copyCityId ? ['copy'] : [];

  const remove = () => Alert.alert(
    t('Delete this collection?', 'Xoá bộ sưu tập này?', 'このコレクションを削除しますか？'),
    t(`"${title}" will be gone for good.`, `"${title}" sẽ mất hẳn.`, `「${title}」は完全に削除されます。`),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除'),
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
            .catch((e: Error) => Alert.alert(t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message));
        },
      },
    ],
  );

  /* The line under the title — the owner's alone now (owner, 16 Oct
     2026). The counts and the heart went down into the card, beside the
     curator's face and the words they are about, so "who made this, what
     is in it, how is it doing" reads as one block rather than a header
     line and a card that each said half. What stays up here is the one
     fact an owner checks before leaving the screen: whether anybody else
     can see this list. A visitor's header is the title alone.

     The padlock the list already uses for the same fact, so a private
     collection looks the same wherever you meet it — and a globe once it
     is not private any more. Published reads in colour, because it is the
     state worth checking; Private stays grey, the resting state, which
     does not need announcing.

     No self-credit. `CollectionsScreen` already states it — your own
     byline is the padlock's business, not a credit line. */
  const byline = col && owned ? (
    <View style={s.metaRow}>
      <Ionicons
        name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
        size={13}
        color={isPublic ? colors.ok : colors.textTertiary}
      />
      <Text style={isPublic ? s.metaPublic : s.meta}>
        {isPublic ? t('Public', 'Công khai', '公開') : t('Private', 'Riêng tư', '非公開')}
      </Text>
    </View>
  ) : undefined;

  /* One heart, and it is both the gesture and the tally — the shape the
     shelf card settled on: two marks for one meaning is one too many, and
     a number beside a control it does not belong to reads as that
     control's label. Outline is a list you have not liked, filled is one
     you have, and the figure beside it is how many people agree.

     Pressable for everyone except the curator. A curator cannot like
     their own list — the database enforces it, and `!owned` here is the
     app's half of the same rule, so the reader never meets a heart that
     does nothing. The owner gets the same shape grey and inert, because
     they still want to know how the list is doing. Signed out it stays
     pressable and opens the sign-in sheet; see `onHeart`. `hitSlop` buys
     a 15pt glyph a 44pt target without drawing a disc.

     It prints from one: a `0` reads as "nobody liked this" rather than
     "no votes yet", and below that the heart draws bare — exactly when it
     is most obviously an invitation. */
  const heart = col && isPublic && col.id ? (
    !owned ? (
      <PressableScale
        style={s.like}
        scaleTo={0.82}
        haptic="none"
        hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
        onPress={onHeart}
        accessibilityRole="button"
        accessibilityState={{ selected: liked }}
        accessibilityLabel={liked
          ? t('Unlike', 'Bỏ thích', 'いいねを取り消す')
          : t('Like', 'Thích', 'いいね')}
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
    ) : likesWorthShowing(likes[col.slug]) ? (
      <View style={s.like}>
        <Ionicons name="heart" size={15} color={colors.textTertiary} />
        <Text style={s.meta}>{likes[col.slug]}</Text>
      </View>
    ) : null
  ) : null;

  /* The card's foot: how many places, and the heart. Under a hairline,
     the count at the start and the heart at the end — the two are
     separate facts now that the handle is not between them, and the end
     of the row is where a thumb finds a gesture. Drawn on every list,
     yours included: the count is the one line every list has. */
  const cardFoot = col ? (
    <View style={s.cardFoot} testID="collection-stats">
      <View style={s.footCount}>
        <Ionicons name="location-outline" size={15} color={colors.textTertiary} />
        <Text style={s.meta}>
          {members.length} {t(members.length === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}
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
      t(`Block ${curatorTag}?`, `Chặn ${curatorTag}?`, `${curatorTag} をブロックしますか？`),
      t(
        'They will not be told. You can undo this from Blocked.',
        'Họ sẽ không được báo. Bạn có thể bỏ chặn trong mục Đã chặn.',
        '相手に通知されません。ブロック中から解除できます。',
      ),
      [
        { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
        {
          text: t('Block', 'Chặn', 'ブロック'),
          style: 'destructive',
          onPress: () => {
            blockUser(target)
              .then(() => Alert.alert(
                t(`${curatorTag} is blocked`, `Đã chặn ${curatorTag}`, `${curatorTag} をブロックしました`),
                t(
                  'Their public lists stay on the shelf; they can no longer reach you.',
                  'Danh sách công khai của họ vẫn hiện; họ không thể liên hệ bạn nữa.',
                  '公開リストは表示されたままですが、相手からは連絡できなくなります。',
                ),
              ))
              .catch(() => Alert.alert(
                t('Could not block', 'Không chặn được', 'ブロックできませんでした'),
                t('Please try again later.', 'Vui lòng thử lại sau.', '後でもう一度お試しください。'),
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
      title: t('Report this list', 'Báo cáo danh sách này', 'このリストを報告'),
      desc: t(
        'Tell the desk something here is wrong.',
        'Báo cho desk biết có điều gì không ổn ở đây.',
        'ここに問題があることをデスクに伝えます。',
      ),
      onPress: () => report({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id, name: title }),
    });
  }
  if (col && curatorTag && uid && col.owner_id && curatorIsPerson) {
    curatorActions.push({
      key: 'block',
      icon: 'ban-outline',
      title: t(`Block ${curatorTag}`, `Chặn ${curatorTag}`, `${curatorTag} をブロック`),
      desc: t(
        'They will not be told, and can no longer reach you.',
        'Họ sẽ không được báo, và không thể liên hệ bạn nữa.',
        '相手に通知されず、あなたに連絡できなくなります。',
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
        style={s.curator}
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
  // Beside the menu, a report on the order rather than a control: there
  // is nothing to confirm. Blank until something has moved.
  const status = saveState === 'waiting' || saveState === 'saving'
    ? t('Saving…', 'Đang lưu…', '保存中…')
    : saveState === 'saved'
      ? t('Saved', 'Đã lưu', '保存しました')
      : '';
  const headerRight = col ? (
    <View style={s.headerRight}>
      {!!status && <Text style={s.saveState} accessibilityLiveRegion="polite">{status}</Text>}
      <View ref={btn} collapsable={false}>
        <RoundIconButton
          icon="ellipsis-horizontal"
          onPress={openMenu}
          label={t('More', 'Thêm', 'その他')}
          testID="collection-more"
        />
      </View>
    </View>
  ) : null;

  return (
    <Screen
      title={title}
      subtitle={byline}
      onBack={() => navigation.goBack()}
      backTestID="collection-back"
      right={headerRight}
    >
      <AmbientWarmth />
      {/* Under the title, before anything else: one tip a visit, about
          what can be done with this list. */}
      {/* Keyed by the reader, so another account signing in starts from
          its own record rather than the last one's chosen tip. */}
      <TipBox key={uid ?? 'guest'} reader={uid} eligible={tipsHere} done={moved ? [...done, 'reorder'] : done} />
      {/* What just happened, and the way back out of it. Above the
          description rather than floating over the list: it is about the
          collection as a whole, and a toast that covers the first place
          card would be reporting on the list by hiding part of it.

          Dismissible by its own tick — the row is the acknowledgement, so
          tapping it is how you say you have read it. The container is a
          plain View and the message and Undo are sibling controls: a
          button nested in a button is one element to VoiceOver, and Undo
          could not be reached on its own. */}
      {banner && (
        <View
          style={[s.banner, banner === 'private' && s.bannerQuiet]}
          accessibilityLiveRegion="polite"
        >
          <Pressable
            style={s.bannerBody}
            onPress={() => setBanner(null)}
            accessibilityRole="button"
            accessibilityHint={t('Dismisses this message', 'Ẩn thông báo này', 'このメッセージを閉じます')}
          >
            <Ionicons
              name={banner === 'public' ? 'checkmark-circle' : banner === 'blocked' ? 'time-outline' : 'lock-closed'}
              size={19}
              color={banner === 'public' ? colors.ok : colors.textSecondary}
            />
            <Text style={s.bannerText} numberOfLines={3}>
              {banner === 'public'
                ? t(
                  'This collection is now public',
                  'Bộ sưu tập này giờ đã công khai',
                  'このコレクションは公開されました',
                )
                : banner === 'blocked'
                  ? blockerSentence(blockers, t)
                  : t(
                    'This collection is private again',
                    'Bộ sưu tập này đã riêng tư trở lại',
                    'このコレクションは非公開に戻りました',
                  )}
            </Text>
          </Pressable>
          {banner !== 'blocked' && (
            <Pressable onPress={undo} hitSlop={10} disabled={publishing} accessibilityRole="button">
              <Text style={[s.bannerUndo, publishing && s.bannerUndoBusy]}>
                {t('Undo', 'Hoàn tác', '元に戻す')}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {/* ── the description, in a card ──
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
          least the count to say. Your own list keeps the note glyph.

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
          chips are the filter"), lit in the accent while chosen. */}
      {col ? (
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
                  <PressableScale
                    onPress={edit}
                    scaleTo={0.985}
                    haptic="selection"
                    accessibilityRole="button"
                    accessibilityLabel={t('Add a description', 'Thêm mô tả', '説明を追加')}
                  >
                    <Text style={s.descEmpty}>
                      {t(
                        'Add a few words about this list.',
                        'Thêm vài dòng về danh sách này.',
                        'このリストについて一言添えましょう。',
                      )}
                    </Text>
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
                  accessibilityLabel={t('Edit description', 'Sửa mô tả', '説明を編集')}
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
      ) : null}
      {loading && members.length === 0 && <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />}
      {!loading && !col && <Empty text={t('Collection not found.', 'Không tìm thấy bộ sưu tập.', 'コレクションが見つかりません。')} />}
      <LiftedCard.Provider value={lift ? lift.from : -1}>
        <View style={s.dragArea} {...panHandlers}>
          <FlatList
            data={shown}
            keyExtractor={(p) => p.slug}
            // Held still while a card is in the finger: the drag and the scroll
            // would otherwise both answer the same drag.
            scrollEnabled={!lift}
            CellRendererComponent={LiftCell}
            onScroll={duckScroll}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => {
              const open = () => navigation.navigate('PlaceDetail', { slug: item.slug });
              return canArrange
                ? (
                  <DraggableCard
                    place={item}
                    index={index}
                    count={drafted.length}
                    style={styleOf(index)}
                    onOpen={open}
                    onUp={() => shuffle(index, index - 1)}
                    onDown={() => shuffle(index, index + 1)}
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
                )} />)
              : null}
            // The door from a list to a day, at the end of the list — where
            // the owner's "Add place" slot stood until 15 Oct 2026. That
            // slot was the same action the ⋯ menu's first row already
            // offers, and the owner's review drew the line: one place for
            // adding (the menu), and the foot of the list for the thing a
            // reader does with a list once they have read it. The planner
            // has seeded plans from collections since 12 Oct 2026, but the
            // only way to it was the Plan tab and a row to find there; it
            // sat under the description for a day and read as a header
            // control over a list it had not yet shown. Everyone gets it,
            // guests included: the planner seeds from public lists too.
            //
            // The paw, the planner's own mark on its own button — not the
            // sparkle it wore for that day, which has become every app's
            // "AI" glyph and said nothing about whose planning this is.
            // `goTo`, since the planner is a sibling tab's stack; `at`
            // makes a second press on the same list a new ask. Only once
            // there is a list to end: an empty list seeds nothing, and its
            // own card is already asking for the first place. The planner
            // decides the city (see IdeasScreen's `from`), so nothing here
            // asks.
            ListFooterComponent={col && members.length > 0
              ? (
                <View style={s.planFoot}>
                  <GradientCta
                    wide
                    icon="paw"
                    label={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる')}
                    onPress={() => goTo('Ideas', { screen: 'IdeasHome', params: { from: col.slug, at: Date.now() } })}
                    testID="collection-plan"
                  />
                </View>
              )
              : null}
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
          accessibilityLabel={t('Close menu', 'Đóng menu', 'メニューを閉じる')}
        />
        <View style={[s.menu, { top: anchor.top, right: anchor.right }]}>
          {owned ? (
            <>
              <MenuRow
                icon="add-circle-outline"
                label={t('Add place', 'Thêm địa điểm', 'スポットを追加')}
                onPress={() => act(addPlace)}
                first
              />
              <MenuRow
                icon="create-outline"
                label={t('Edit collection', 'Sửa bộ sưu tập', 'コレクションを編集')}
                onPress={() => act(edit)}
                testID="collection-menu-edit"
              />
              <MenuRow
                icon="share-outline"
                label={t('Share', 'Chia sẻ', '共有')}
                onPress={() => act(share)}
              />
              {/* Above Delete, below the rest: it is the one row that changes
                  who else can see this, which is a heavier thing than editing
                  a title and a lighter one than destroying the list.

                  The label is the action, not the state. "Public" with a tick
                  would leave you working out which way the row is pointing;
                  the header already says which one you are in. */}
              <MenuRow
                icon={isPublic ? 'lock-closed-outline' : 'globe-outline'}
                label={isPublic
                  ? t('Make private', 'Chuyển riêng tư', '非公開にする')
                  : t('Make public', 'Công khai', '公開する')}
                onPress={() => act(() => setPublic(!isPublic))}
              />
              <MenuRow
                icon="trash-outline"
                label={t('Delete collection', 'Xoá bộ sưu tập', 'コレクションを削除')}
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
              {/* Only with a city to file the copy under. Without one the
                  row could only close the menu and do nothing, and a row
                  that does nothing is worse than a row that is not there. */}
              {!!copyCityId && (
                <MenuRow
                  icon="duplicate-outline"
                  label={t('Save a copy', 'Lưu bản sao', 'コピーを保存')}
                  onPress={() => act(copy)}
                  first
                />
              )}
              <MenuRow
                icon="share-outline"
                label={t('Share', 'Chia sẻ', '共有')}
                onPress={() => act(share)}
                first={!copyCityId}
              />
              {/* The third thing you can do about somebody else's list,
                  and the one the store asks for: say something is wrong
                  with it. Last, and marked, because it is the row that
                  is about a person rather than about the list — and
                  never on your own, which is yours to delete. */}
              {col && canReport({ kind: 'collection', id: col.id ?? '', ownerId: col.owner_id }) && (
                <MenuRow
                  icon="flag-outline"
                  label={t('Report this list', 'Báo cáo danh sách này', 'このリストを報告')}
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
      {reportSheet}
      <PersonSheet
        visible={aboutCurator}
        name={curatorName || curatorTag}
        meta={curatorName ? curatorTag : undefined}
        avatarUrl={curatorAvatar ?? undefined}
        actions={curatorActions}
        onClose={() => setAboutCurator(false)}
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
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
  // The tappable half of the banner, laid out as the banner row itself was
  // so moving the press off the container changes nothing on screen.
  bannerBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerQuiet: { backgroundColor: colors.surfaceGlass },
  bannerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: font.medium },
  bannerUndo: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },
  bannerUndoBusy: { opacity: 0.4 },

  // Full width at the foot of the list, in the page's margins, with the
  // room the dashed slot it replaced kept above it.
  planFoot: { paddingHorizontal: space.page, paddingTop: 10 },
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
  descEmpty: { color: colors.textTertiary, ...type.body, lineHeight: 24 },
  // A 20pt glyph centred on a 24pt first line.
  descGlyph: { marginTop: 2 },

  // A text button, not a pill: it sits where the overflow control was and
  // the header already has one round shape in it on the other side.
  // The responder that carries a lifted card: the list's whole height.
  dragArea: { flex: 1 },
  // The status beside ⋯ and the button, on one line.
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  saveState: { color: colors.textTertiary, fontSize: 14, fontWeight: font.medium, paddingHorizontal: 10 },
  // Lifted: above its neighbours, with the shadow of something held off
  // the page. `zIndex` for iOS and the web, `elevation` for Android.
  arrangeCellLifted: { zIndex: 10, elevation: 6 },

  // The dashed slot at the end of the list, matching the collections
  // screen's own last row down to the well and the gap.

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
