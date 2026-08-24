import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PlaceCard from '../components/PlaceCard';
import { AddSlot } from '../components/add';
import {
  AmbientWarmth, Avatar, Empty, GradientCta, PressableScale, RoundIconButton, Screen,
  fireHaptic, successHaptic, useTabBarClearance,
} from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { useAuth } from '../lib/auth';
import { useLikes } from '../lib/catalog';
import { likesWorthShowing } from '../lib/likes';
import {
  copyCollection, deleteCollection, membersOf, publishBlockers, reorderCollection,
  setCollectionPublic, useProfileByHandle,
} from '../lib/data';
import { atHandle, normalizeHandle } from '../lib/handle';
import { useCollections, usePlaces } from '../lib/catalog';
import { useCity } from '../lib/city';
import { moveItem, sameOrder } from '../lib/order';
import { useReport } from '../components/reportFlow';
import { useSave } from '../lib/save';
import { useI18n } from '../lib/i18n';
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
function MenuRow({ icon, label, onPress, danger, first }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
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
 * A place while the list is being put in order.
 *
 * Deliberately not a `PlaceCard`. Arranging is about the sequence, not
 * about the places — full cards mean two of them fill the screen and you
 * are reordering a list you can only see a fifth of. This is one line each,
 * with the position spelled out, so the whole list is in front of you.
 *
 * ── on arrows rather than dragging ──
 *
 * The app carries `react-native-gesture-handler` and uses it for the swipe
 * rows on the collections list, but a drag-to-reorder list is a different
 * animal: it needs a layout-animated list that reflows under the finger,
 * which in practice means `react-native-reanimated` and a dependency this
 * project does not have. Two buttons reorder a six-place list in a handful
 * of taps, work under VoiceOver, and cannot drop an item somewhere the
 * reader did not mean. When the drag arrives it replaces this; until then
 * this is the feature rather than a placeholder for it.
 */
function ArrangeRow({ place, index, count, onUp, onDown }: {
  place: Place;
  index: number;
  count: number;
  onUp: () => void;
  onDown: () => void;
}) {
  const { t } = useI18n();
  const first = index === 0;
  const last = index === count - 1;
  return (
    <View style={s.arrangeRow}>
      <Text style={s.arrangeNum}>{index + 1}</Text>
      <View style={s.arrangeText}>
        <Text style={s.arrangeName} numberOfLines={1}>{place.name_en}</Text>
        {!!place.neighborhood_en && (
          <Text style={s.arrangeArea} numberOfLines={1}>{place.neighborhood_en}</Text>
        )}
      </View>
      <PressableScale
        haptic="selection"
        onPress={onUp}
        disabled={first}
        containerStyle={[s.arrangeBtn, first && s.arrangeBtnOff]}
        accessibilityRole="button"
        accessibilityLabel={t('Move up', 'Chuyển lên', '上へ移動')}
      >
        <Ionicons name="chevron-up" size={17} color={colors.textSecondary} />
      </PressableScale>
      <PressableScale
        haptic="selection"
        onPress={onDown}
        disabled={last}
        containerStyle={[s.arrangeBtn, last && s.arrangeBtnOff]}
        accessibilityRole="button"
        accessibilityLabel={t('Move down', 'Chuyển xuống', '下へ移動')}
      >
        <Ionicons name="chevron-down" size={17} color={colors.textSecondary} />
      </PressableScale>
    </View>
  );
}

export default function CollectionDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'CollectionDetail'> }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const uid = session?.user?.id;
  const cols = useCollections();
  // Both catalogs, because the public query excludes owned rows: a list of
  // your own would otherwise open on "Collection not found". The owned half
  // comes from the shared copy, so a place saved from anywhere shows here.
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
  const curatorAvatar = useProfileByHandle(curatorHandle).data?.avatar_url || null;
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
    if (!uid) { askToSignIn(); return; }
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

  // Explore is where places are, and saving one from there already offers
  // this list by name. A picker that wrote straight back into this
  // collection would be better, and is a screen rather than a button.
  const addPlace = () => navigation.getParent()?.navigate('Explore');

  const edit = () => col && navigation.navigate('CollectionForm', {
    slug: col.slug,
    title,
    desc: t(col.desc_en, col.desc_vi, col.desc_ja),
  });

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
   * Arranging the list.
   *
   * A mode rather than always-on controls. Two arrows on every card would
   * mean tapping a place is one thumb-width from moving it, and a list you
   * are browsing is not a list you are editing. `arranging` holds the draft
   * order as slugs — never places — because the catalog can reload
   * underneath this screen and slugs are what the write takes anyway.
   *
   * Nothing is written until Done. `sort_order` is a column every read in
   * the app already honours, so a half-applied order would show up
   * everywhere at once; the whole sequence goes in one go or not at all.
   */
  const [arranging, setArranging] = useState<string[] | null>(null);
  const [ordering, setOrdering] = useState(false);
  const bySlug = useMemo(() => new Map(members.map((p) => [p.slug, p])), [members]);
  // Members that have arrived since arranging began are appended rather
  // than dropped. Saving would otherwise leave them at whatever position
  // they had, which is not a decision the reader made.
  const drafted: Place[] = arranging
    ? [
      ...arranging.map((slug) => bySlug.get(slug)).filter((p): p is Place => !!p),
      ...members.filter((p) => !arranging.includes(p.slug)),
    ]
    : members;
  const dirty = !!arranging && !sameOrder(arranging, members.map((p) => p.slug));

  const shuffle = (from: number, to: number) => setArranging(
    moveItem(drafted.map((p) => p.slug), from, to),
  );

  const finishArranging = () => {
    if (!col || !arranging || ordering) return;
    if (!dirty) { setArranging(null); return; }
    setOrdering(true);
    reorderCollection(col.slug, drafted.map((p) => p.slug))
      .then(() => {
        successHaptic();
        setArranging(null);
        // Both catalogs: the row is in `mine` and, once published, in the
        // public list too, and the order is read from whichever copy the
        // screen that draws it happens to hold.
        mine.reload();
        cols.reload();
      })
      .catch((e: Error) => Alert.alert(
        t('Could not save the order', 'Không lưu được thứ tự', '並び順を保存できませんでした'),
        e.message,
      ))
      .finally(() => setOrdering(false));
  };

  // Deliberately inert, and now inert for two different reasons — which
  // is why the sentence branches. A private list has no address to send
  // anyone to; a published one is visible to everybody but the app still
  // has no link to hand over, because nothing here registers a URL scheme
  // or a web address for a collection. Either way the honest placeholder
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
        'Your collections are private for now. Sharing one with the crew is on the way.',
        'Bộ sưu tập của bạn hiện đang riêng tư. Tính năng chia sẻ với hội bạn sẽ sớm có.',
        'コレクションは現在非公開です。共有機能は近日公開予定です。',
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
   * ── the title, kept ──
   *
   * Verbatim, with no "(copy)" hung off the end. The reader recognises
   * the list by its name, that name is the reason they took it, and the
   * suffix would be the app narrating its own plumbing into something a
   * person now owns. Two lists with one name is the price, and it is a
   * rename away in the menu they are already holding.
   *
   * ── the credit, added ──
   *
   * The curator's handle goes into the description, under whatever the
   * curator wrote. It is the only durable place for it: `curator_handle`
   * on the new row is not ours to set — a database trigger stamps it from
   * the owner's profile on publish, precisely so a byline cannot be
   * forged from the client — so a copy that is later published would go
   * out under the copier's name with nothing recording where it came
   * from. A line of description travels with the list and survives that.
   *
   * ── the city, from the list rather than from the tab ──
   *
   * `col.city_id`, falling back to the city on screen. The two agree in
   * every path that reaches this button — a list you do not own arrives
   * through the public query, which is city-scoped — and the fallback
   * exists for the legacy select that omits the column.
   */
  const [copying, setCopying] = useState(false);
  const copy = () => {
    if (!col || copying) return;
    // Signed out this is the sheet, not an error: wanting somebody's list
    // is a good moment to be offered an account, and a disabled row would
    // have explained nothing.
    if (!uid) { askToSignIn(); return; }
    const cityId = col.city_id || city?.id;
    if (!cityId) return;
    const sourceDesc = t(col.desc_en, col.desc_vi, col.desc_ja)?.trim() || '';
    const credit = col.curator_handle
      ? t(
        `Copied from ${atHandle(col.curator_handle)}`,
        `Sao chép từ ${atHandle(col.curator_handle)}`,
        `${atHandle(col.curator_handle)} からコピー`,
      )
      : '';
    setCopying(true);
    copyCollection({
      ownerId: uid,
      cityId,
      title,
      desc: [sourceDesc, credit].filter(Boolean).join('\n\n'),
      // The order on screen, which is `sort_order` already resolved by
      // `membersOf` — copying the list means copying the sequence the
      // curator chose, not the order the rows happen to come back in.
      placeSlugs: members.map((p) => p.slug),
    })
      .then((slug) => {
        successHaptic();
        mine.reload();
        // Into the Collections tab rather than pushing onto whichever
        // stack we are in. The copy is not a thing you were browsing, it
        // is a thing you now own, and Back should lead to your lists —
        // which is only true in the tab that holds them.
        goTo('Collections', { screen: 'CollectionDetail', initial: false, params: { slug } });
      })
      .catch((e: Error) => Alert.alert(
        t('Could not save a copy', 'Không lưu được bản sao', 'コピーを保存できませんでした'),
        e.message,
      ))
      .finally(() => setCopying(false));
  };

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
            .then(() => { navigation.goBack(); mine.reload(); })
            .catch((e: Error) => Alert.alert(t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message));
        },
      },
    ],
  );

  /* The line under the title. It goes to `Screen` as a node rather than a
     string because it is not a sentence: a padlock or a globe, the
     curator's face, the counts, and a heart you can press. `Screen`
     styles a string and leaves a node to style itself, which is what this
     one needs — the 18pt face and the 15pt heart are tuned to `meta`'s
     measure, not to the 13.5pt a written subtitle takes. */
  const byline = col ? (
    <View style={s.metaRow}>
      {/* The padlock the list already uses for the same fact, so a
          private collection looks the same wherever you meet it —
          and a globe once it is not private any more.

          Published reads first and in colour, because it is the
          state worth checking before you leave the screen. Private
          stays grey: it is the resting state and does not need
          announcing. */}
      {owned && (
        <Ionicons
          name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
          size={13}
          color={isPublic ? colors.ok : colors.textTertiary}
        />
      )}
      {owned && isPublic && (
        <Text style={s.metaPublic}>{t('Public', 'Công khai', '公開')}</Text>
      )}
      {/* The face leads the line and the handle follows it, which
          is a reordering rather than an insertion: a photograph
          belongs beside the name it is of, and the only way to
          keep the byline a single `Text` — which `numberOfLines`
          needs, or the ellipsis arrives twice — is to put the
          person first and the counts after.

          18pt against a 15pt line, and that is the whole answer
          to the two round controls this header already has. A
          face at the size of the type it sits in is never
          mistaken for the 44pt glass one, and it costs the header
          no height. The rule is written where the controls are,
          in `ui.tsx`.

          No self-credit. `CollectionsScreen` already states it —
          your own byline is the padlock's business, not a credit
          line — and this screen was the one place contradicting
          it. Beside a padlock only an owner sees, above a menu
          that offers only an owner Delete, your own name was a
          third way of saying the same thing. */}
      {curatorAvatar ? <Avatar url={curatorAvatar} size={18} /> : null}
      <Text style={[s.meta, s.byline]} numberOfLines={1}>
        {owned && isPublic ? '·  ' : ''}
        {!owned && col.curator_handle ? `${atHandle(col.curator_handle)}  ·  ` : ''}
        {members.length} {t('places', 'địa điểm', 'スポット')}
        {owned && !isPublic ? `  ·  ${t('Private', 'Riêng tư', '非公開')}` : ''}
      </Text>

      {/* One heart, and it is both the gesture and the tally — the
          shape the shelf card settled on and the argument written
          there: two marks for one meaning is one too many, and a
          number sitting beside a control it does not belong to
          reads as that control's label.

          This screen had exactly that split. A 44pt heart in the
          header did the liking; the words "1 likes" down here did
          the counting; and the number was nowhere near the thing
          it counted. Merged, outline is a list you have not liked,
          coral filled is one you have, and the figure beside it is
          how many people agree — which is also how Instagram, X
          and every app that stopped shipping "N likes" as prose
          now says it.

          Pressable for everyone except the curator, and that is
          the only exception. A curator cannot like their own
          list — the database enforces it, and `!owned` here is
          the app's half of the same rule: the policy is what
          makes it true, this is what keeps the reader from
          meeting it as a heart that does nothing. Only this
          screen needs the check. The public shelf already leaves
          your own lists out of the query it draws from, so the
          heart there never meets one; here the row arrives
          through `mine` as readily as through the public read.

          So the owner gets the same shape drawn grey and inert —
          they still want to know how the list is doing. Signed
          out it stays pressable and opens the sign-in sheet; see
          `onHeart`.
          `hitSlop` is what buys a 15pt glyph a 44pt target
          without drawing a disc — the shelf's trick, and the
          reason the header can lose a round control without
          losing a tap.

          It sits immediately after the counts rather than out at
          the margin, which is the correction to how this first
          shipped — see `s.like`.

          Same rule as the shelf on the number itself: it prints
          from one. A `0` reads as "nobody liked this" rather than
          "no votes yet", and below that the heart draws bare —
          which is exactly when it is most obviously an
          invitation. */}
      {isPublic && col.id ? (
        !owned ? (
          <>
            <Text style={[s.meta, s.sep]}>·</Text>
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
          </>
        ) : likesWorthShowing(likes[col.slug]) ? (
          <>
            <Text style={[s.meta, s.sep]}>·</Text>
            <View style={s.like}>
              <Ionicons name="heart" size={15} color={colors.textTertiary} />
              <Text style={s.meta}>{likes[col.slug]}</Text>
            </View>
          </>
        ) : null
      ) : null}
    </View>
  ) : null;

  /* The header's right-hand slot, which holds one of three things.
     Exclusive by construction: `arranging` is only ever set from a menu
     row the owner alone is offered, and `copying` only ever runs for
     somebody who does not own the list.

     While a copy is in flight the spinner stands here rather than
     anywhere else on screen. Three round trips is long enough for a tap
     to look dead, and the control that started the work is the honest
     place to say it is still going — reopening the menu mid-copy to
     press the row again is also the one mistake this makes impossible.

     While arranging, the one control is the way out of it. Leaving the
     overflow menu up would offer Delete to a thumb that is currently in
     the business of tapping small buttons in a row.

     Otherwise ⋯, and everybody gets it, not only the owner: what the
     menu offers branches, but "there is more you can do with this list"
     is true on both sides of that line, and a header whose right-hand
     side is empty for half its visitors reads as a screen that forgot
     something. `collapsable={false}` keeps the wrapper a real native
     view, which is what `measureInWindow` needs to have something to
     measure. */
  const headerRight = copying ? (
    <View style={s.busy}>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  ) : arranging ? (owned ? (
    <PressableScale onPress={finishArranging} containerStyle={s.done} disabled={ordering}>
      <Text style={s.doneText}>
        {ordering
          ? t('Saving…', 'Đang lưu…', '保存中…')
          : dirty
            ? t('Done', 'Xong', '完了')
            : t('Cancel', 'Huỷ', 'キャンセル')}
      </Text>
    </PressableScale>
  ) : null) : (
    <View ref={btn} collapsable={false}>
      <RoundIconButton
        icon="ellipsis-horizontal"
        onPress={openMenu}
        label={t('More', 'Thêm', 'その他')}
      />
    </View>
  );

  return (
    <Screen
      title={title}
      subtitle={byline}
      onBack={() => navigation.goBack()}
      right={headerRight}
    >
      <AmbientWarmth />
      {/* What just happened, and the way back out of it. Above the
          description rather than floating over the list: it is about the
          collection as a whole, and a toast that covers the first place
          card would be reporting on the list by hiding part of it.

          Dismissible by its own tick — the row is the acknowledgement, so
          tapping it is how you say you have read it. */}
      {banner && (
        <Pressable
          style={[s.banner, banner === 'private' && s.bannerQuiet]}
          onPress={() => setBanner(null)}
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
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
          {banner !== 'blocked' && (
            <Pressable onPress={undo} hitSlop={10} disabled={publishing}>
              <Text style={[s.bannerUndo, publishing && s.bannerUndoBusy]}>
                {t('Undo', 'Hoàn tác', '元に戻す')}
              </Text>
            </Pressable>
          )}
        </Pressable>
      )}
      {col && (col.desc_en || col.desc_vi) && (
        <Text style={s.desc}>{t(col.desc_en, col.desc_vi, col.desc_ja)}</Text>
      )}
      {loading && members.length === 0 && <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />}
      {!loading && !col && <Empty text={t('Collection not found.', 'Không tìm thấy bộ sưu tập.', 'コレクションが見つかりません。')} />}
      {/* What the mode is for, said once at the top of it. Without this the
          numbered rows read as a different screen the reader arrived at by
          accident. */}
      {arranging && (
        <Text style={s.arrangeHint}>
          {t(
            'Set the order these places appear in. This is the order a plan builds from.',
            'Sắp thứ tự các địa điểm. Đây cũng là thứ tự mà một kế hoạch dựa vào.',
            'スポットの並び順を決めます。プランもこの順番を参照します。',
          )}
        </Text>
      )}
      <FlatList
        data={drafted}
        keyExtractor={(p) => p.slug}
        onScroll={duckScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (arranging
          ? (
            <ArrangeRow
              place={item}
              index={index}
              count={drafted.length}
              onUp={() => shuffle(index, index - 1)}
              onDown={() => shuffle(index, index + 1)}
            />
          )
          : <PlaceCard place={item} onPress={() => navigation.navigate('PlaceDetail', { slug: item.slug })} />
        )}
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
        // Only once there is a list to end. Empty, the card above is
        // already asking for the first place, and two invitations to do
        // one thing read as two different things.
        ListFooterComponent={owned && !arranging && members.length > 0
          ? (
            <AddSlot
              onPress={addPlace}
              title={t('Add place', 'Thêm địa điểm', 'スポットを追加')}
              // The second line names where the places come from. Without
              // it the row is a verb with no object, and "Add place" alone
              // had already sent one reader to Explore expecting a picker.
              subtitle={t(
                'From search or your bookmarks',
                'Từ tìm kiếm hoặc mục đã lưu',
                '検索や保存済みから',
              )}
            />
          )
          : null}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
      />

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
        <Pressable style={s.scrim} onPress={() => setMenu(false)} />
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
              />
              {/* Only with something to arrange. One place has no order, and a
                  row that does nothing is worse than a row that is not there. */}
              {members.length > 1 && (
                <MenuRow
                  icon="swap-vertical-outline"
                  label={t('Reorder places', 'Sắp xếp thứ tự', '並び順を変更')}
                  onPress={() => act(() => {
                    fireHaptic('light');
                    setArranging(members.map((p) => p.slug));
                  })}
                />
              )}
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
              <MenuRow
                icon="duplicate-outline"
                label={t('Save a copy', 'Lưu bản sao', 'コピーを保存')}
                onPress={() => act(copy)}
                first
              />
              <MenuRow
                icon="share-outline"
                label={t('Share', 'Chia sẻ', '共有')}
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
  // The ⋯ button's footprint without its glass. A spinner standing in for
  // a control has to hold that control's space or the title beside it
  // jumps sideways the moment you press — and the circle is what says
  // "button", which this is not while it is spinning.
  busy: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  meta: { color: colors.textTertiary, ...type.meta },
  // The words yield, the heart does not. Without this a long handle
  // sizes the byline to its own content and pushes the tally off the
  // right edge — `numberOfLines` alone only stops a second line, it does
  // not make a row's text give way to its siblings.
  byline: { flexShrink: 1 },
  // The join between the byline and the tally, as an element rather than
  // two more characters inside the Text: a trailing "  ·  " would go
  // under the ellipsis with the words it trails, leaving a heart with
  // nothing attaching it to the line. The 3 is what makes it match the
  // separators it is standing in for — the row's own `gap` is 5, and the
  // dots inside the Text are written "  ·  ", about 8 either side.
  sep: { marginHorizontal: 3 },
  // Next to the count it belongs to, not out at the margin. This shipped
  // with `marginLeft: 'auto'` on the argument that a gesture wants a
  // corner. True of a gesture — but the whole point of bringing the heart
  // down here was that the mark and its tally are one fact, and a fact
  // belongs in the line that states the others. Pushed to the edge it sat
  // directly under the ⋯ button with a hand's width of nothing between it
  // and the byline, and read as a second header control that had slipped
  // a line, which is exactly what it had stopped being.
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
  bannerUndo: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },
  bannerUndoBusy: { opacity: 0.4 },

  desc: {
    color: colors.textSecondary, ...type.body, lineHeight: 24,
    paddingHorizontal: space.page, paddingBottom: 12,
  },

  // A text button, not a pill: it sits where the overflow control was and
  // the header already has one round shape in it on the other side.
  done: { paddingHorizontal: 10, paddingVertical: 8 },
  doneText: { color: colors.accent, fontSize: 16, fontWeight: font.semibold },

  arrangeHint: {
    color: colors.textTertiary, fontSize: 13.5, lineHeight: 19,
    paddingHorizontal: space.page, paddingBottom: 10,
  },
  arrangeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: space.page, marginBottom: 8,
    paddingVertical: 11, paddingHorizontal: 14,
    backgroundColor: colors.surfaceCard, borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  // The position, spelled out. The row's place in the list is the one fact
  // this mode exists to change, and counting rows on screen is what people
  // do when nothing tells them.
  arrangeNum: {
    color: colors.textTertiary, fontSize: 13, fontWeight: font.semibold,
    width: 18, textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  arrangeText: { flex: 1 },
  arrangeName: { color: colors.text, fontSize: 15.5, fontWeight: font.medium },
  arrangeArea: { color: colors.textTertiary, ...type.meta, marginTop: 1 },
  arrangeBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass,
  },
  arrangeBtnOff: { opacity: 0.28 },

  // The dashed slot at the end of the list, matching the collections
  // screen's own last row down to the well and the gap.

  // Lighter than the sheet's scrim was. A popover keeps its context —
  // you can still read the row you are acting on — where a sheet takes
  // the screen and has to dim what it covers.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.22)' },
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
  menuText: { color: colors.text, fontSize: 16.5, lineHeight: 22, fontWeight: font.medium },

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
