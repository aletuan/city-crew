// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, Card, Empty, PressableScale, Screen, Skeleton, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { Collection, coverOf, deleteCollection, membersOf } from '../lib/data';
import { useCollections, usePlaces } from '../lib/catalog';
import { useSave } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav } from '../nav';

/** What `renderRightActions` hands back, and what the card animates from. */
type Drag = ReturnType<Animated.Value['interpolate']>;

/** What the two actions take up behind an open row: two 62pt buttons, the
 *  8pt between them, and the 8pt separating them from the card. The row
 *  clamps its own travel to whatever they measure, so this figure only sets
 *  how fast the card's insides shrink on the way there. */
const ACTIONS_W = 62 * 2 + 8 + 8;
const THUMB = 92;
const THUMB_OPEN = 64;
const CHEVRON = 44;

// The card sells signing in, so it leads with what you get rather than with
// what you are: "browsing as a guest" names a limitation and leaves the
// reader to work out the offer for themselves.
//
// The whole card is the target and the chip inside it is drawn, not pressed —
// a Pressable nested inside a Pressable gives one action two overlapping hit
// areas and two stops in VoiceOver, for no gain.
//
// Sign-in lives in the Profile tab's stack, not this one, so the jump goes
// through the tab navigator above us.
function GuestNotice({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  if (session) return null;
  return (
    <PressableScale
      containerStyle={s.noticeWrap}
      style={s.notice}
      onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'SignIn' })}
      accessibilityRole="button"
      accessibilityLabel={t(
        'Sign in to build your own collections',
        'Đăng nhập để tạo bộ sưu tập của riêng bạn',
        'サインインして自分のコレクションを作る',
      )}
    >
      <View style={s.noticeHead}>
        {/* The Collections tab's own glyph, so the card belongs to this
            screen instead of reading as a generic account banner. */}
        <View style={s.noticeIcon}>
          <Ionicons name="bookmark" size={19} color={colors.accent} />
        </View>
        <View style={s.noticeCopy}>
          <Text style={s.noticeTitle}>
            {t('Start your own collection', 'Tạo bộ sưu tập của riêng bạn', '自分のコレクションを作る')}
          </Text>
          <Text style={s.noticeBody}>
            {t(
              'Sign in to save places you like and group them into lists.',
              'Đăng nhập để lưu địa điểm bạn thích và nhóm lại thành danh sách.',
              'サインインすると気になるスポットを保存し、リストにまとめられます。',
            )}
          </Text>
        </View>
      </View>
      {/* A rounded rectangle at chip scale, the sheet's primary button
          scaled down. Sized to its label rather than stretched: the card is
          already the target, so this names the action — it does not need to
          be the loudest object on the screen. */}
      <LinearGradient {...gradAI} style={s.noticeChip}>
        <Text style={s.noticeChipText}>{t('Sign in', 'Đăng nhập', 'サインイン')}</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.accentInk} />
      </LinearGradient>
    </PressableScale>
  );
}

/**
 * The cover slot of a list that has nothing in it yet.
 *
 * A flat grey square reads as a photo that failed to load — the eye has
 * seen too many broken images to read it any other way. A warm tinted well
 * with the tab's own glyph reads as a slot waiting to be filled, which is
 * what it is.
 */
function EmptyCover() {
  return (
    <LinearGradient
      colors={[colors.accentSoft, 'rgba(255,111,91,0.02)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.thumbFill, s.thumbEmpty]}
    >
      <Ionicons name="bookmark-outline" size={26} color={colors.accentFaint} />
    </LinearGradient>
  );
}

/**
 * Signed in, nothing made yet. This is the one state with room to explain
 * what a collection is and why anyone would want one, so it takes the
 * whole card and the section's other create controls stand down.
 *
 * It mirrors the guest card one section up — same tinted well, same
 * gradient action — because they are the same argument aimed at two
 * states: sign in to make lists, and now make one.
 */
function FirstCollection({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.firstWrap}>
      <View style={s.first}>
        <View style={s.firstIcon}>
          <Ionicons name="bookmark" size={27} color={colors.accent} />
        </View>
        <Text style={s.firstTitle}>
          {t('No collections yet', 'Chưa có bộ sưu tập nào', 'コレクションはまだありません')}
        </Text>
        <Text style={s.firstBody}>
          {t(
            'Group places into lists — date nights, crew weekends, coffee crawls.',
            'Nhóm địa điểm thành danh sách — buổi hẹn tối, cuối tuần với hội bạn, tour cà phê.',
            'スポットをリストにまとめましょう — デートの夜、仲間との週末、カフェ巡り。',
          )}
        </Text>
        {/* A pill here, where the sheet's primary is a rounded rectangle:
            that one runs the full width, where end caps as tall as the
            button read as a lozenge. This one is sized to its label, which
            is exactly where a pill belongs. */}
        <PressableScale onPress={onPress} accessibilityRole="button">
          <LinearGradient {...gradAI} style={s.firstCta}>
            <Ionicons name="add" size={20} color={colors.accentInk} />
            <Text style={s.firstCtaText}>
              {t('Create your first collection', 'Tạo bộ sưu tập đầu tiên', '最初のコレクションを作る')}
            </Text>
          </LinearGradient>
        </PressableScale>
        <Text style={s.firstFoot}>
          {t('Only you can see your lists.', 'Chỉ mình bạn thấy danh sách của bạn.', 'リストはあなただけに表示されます。')}
        </Text>
      </View>
    </View>
  );
}

/**
 * The last row of your own section: a slot rather than a thing.
 *
 * The dashed outline is doing the work — it says "not a collection, a
 * place where one would go", which no amount of label on a solid card
 * manages. It sits at the end of the list because that is where you are
 * looking when you have just decided the list is missing something.
 */
function NewCollectionRow({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.row}>
      <PressableScale onPress={onPress} accessibilityRole="button" style={s.newRow}>
        <View style={s.newRowIcon}>
          <Ionicons name="add" size={26} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.newRowTitle}>
            {t('New collection', 'Bộ sưu tập mới', '新しいコレクション')}
          </Text>
          <Text style={s.newRowSub} numberOfLines={1}>
            {t('Group places for your next plan', 'Nhóm địa điểm cho kế hoạch tới', '次の予定に向けてスポットをまとめる')}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

/**
 * Swipe left on your own row to reveal Edit and Delete — the iOS list
 * convention, and the reason the row itself carries no extra controls.
 *
 * Where this parts company with the stock behaviour is what happens to the
 * row. Swipeable slides its children left by the width of the actions,
 * which on a full-bleed card pushes the cover and the first half of the
 * title off the screen: you end up choosing between two buttons for a list
 * you can no longer read the name of. So the card is pinned — translated
 * back by exactly what the row translates it — and narrowed by the same
 * amount instead, so its left edge stays on the page margin and its right
 * edge stops where the buttons begin.
 *
 * Both actions close the row first. Leaving it open behind a pushed screen
 * or an alert means coming back to a row half off its rails, and the way
 * out of that is another swipe nobody thinks to try.
 */
function SwipeRow({ children, onEdit, onDelete, editLabel, deleteLabel }: {
  children: (open: boolean, drag: Drag | null) => React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}) {
  const ref = useRef<Swipeable>(null);
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Swipeable rebuilds the node it drags the row with every time it
  // remeasures, so the one captured on the first pass goes stale. Lifting
  // it out of the render prop keeps the copy the card animates from and the
  // one the row moves by the same node.
  const seen = useRef<Drag | null>(null);
  useEffect(() => { if (seen.current !== drag) setDrag(seen.current); });

  const act = (run: () => void) => { ref.current?.close(); run(); };

  // Until the row has been measured there is nothing to pin against, and
  // the card sits at its full width the way it always did.
  const pinned = drag && width > 0
    ? { width: Animated.add(width, drag), transform: [{ translateX: Animated.multiply(drag, -1) }] }
    : null;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Swipeable
        ref={ref}
        friction={1.6}
        rightThreshold={38}
        // No rubber-band past the actions: the row is 92pt tall and an
        // overshoot on something this small reads as the row coming loose.
        overshootRight={false}
        // Width is a layout property, so the pin cannot ride the native
        // driver — a JS-driven value cannot be composed from a native one.
        // The cost is a handful of owned rows animating on the JS thread
        // for the length of a swipe, which is what it takes for the card to
        // stay legible instead of leaving the screen.
        useNativeAnimations={false}
        onSwipeableWillOpen={() => setOpen(true)}
        onSwipeableWillClose={() => setOpen(false)}
        renderRightActions={(_progress, dragX) => {
          seen.current = dragX;
          return (
            <View style={s.actions}>
              <PressableScale
                onPress={() => act(onEdit)}
                accessibilityRole="button"
                accessibilityLabel={editLabel}
                containerStyle={s.actionWrap}
                style={[s.action, s.actionEdit]}
              >
                <Ionicons name="create-outline" size={21} color={colors.text} />
              </PressableScale>
              <PressableScale
                onPress={() => act(onDelete)}
                accessibilityRole="button"
                accessibilityLabel={deleteLabel}
                containerStyle={s.actionWrap}
                style={[s.action, s.actionDelete]}
              >
                <Ionicons name="trash-outline" size={21} color={colors.accentInk} />
              </PressableScale>
            </View>
          );
        }}
      >
        <Animated.View style={pinned}>{children(open, drag)}</Animated.View>
      </Swipeable>
    </View>
  );
}

export default function CollectionsScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const cols = useCollections();
  // Shared with the save sheet — see SaveProvider. Reading it here through
  // its own hook is what let the two disagree.
  const { mine } = useSave();
  const { data: places, loading: placesLoading } = usePlaces();
  const tabClearance = useTabBarClearance();
  // Counting and filtering need the places catalog — until it's in, hold
  // the skeleton rather than showing raw DB membership numbers.
  const loading = cols.loading || placesLoading;

  // Reload on return: creating a collection happens on another screen, and
  // without this you would come back to the list you left. The first focus
  // is skipped — the hook has already loaded on mount, and refetching there
  // is a second identical request for nothing.
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    mine.reload();
  }, [mine.reload]));

  // An editorial collection with no visible members is a dead end, so it
  // stays hidden. Your own is not: you just made it, and it is empty
  // because it is new.
  const visible = cols.data.filter((c) => membersOf(c, places).length > 0);

  const coverFor = (c: Collection) =>
    c.cover?.photo_uri ?? (membersOf(c, places)[0] && coverOf(membersOf(c, places)[0])?.photo_uri);

  const remove = (c: Collection) => {
    const name = t(c.title_en, c.title_vi, c.title_ja);
    Alert.alert(
      t('Delete this collection?', 'Xoá bộ sưu tập này?', 'このコレクションを削除しますか？'),
      t(`"${name}" will be gone for good.`, `"${name}" sẽ mất hẳn.`, `「${name}」は完全に削除されます。`),
      [
        { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
        {
          text: t('Delete', 'Xoá', '削除'),
          style: 'destructive',
          onPress: () => {
            deleteCollection(c.slug)
              .then(() => mine.reload())
              .catch((e: Error) => Alert.alert(t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message));
          },
        },
      ],
    );
  };

  // The section stays even with nothing in it — that empty is the one place
  // to say what collections are for.
  //
  // It hides only until the first load has settled. `loaded`, not
  // `!loading`: the focus refresh flips `loading` back on, and hiding the
  // section for that is what made a visit to this tab look like a double
  // load. The previous attempt read `data.length > 0` as "we have been
  // here before", which is true for everyone except the people this card
  // exists for — anyone whose answer is legitimately empty saw the blink
  // every time.
  const mineReady = mine.loaded;
  const sections = [
    ...(session && mineReady
      ? [{ title: t('Your collections', 'Bộ sưu tập của bạn', 'あなたのコレクション'), own: true, data: mine.data }]
      : []),
    { title: t('Public collections', 'Bộ sưu tập công khai', '公開コレクション'), own: false, data: visible },
  ];

  return (
    // No control in the header: creating belongs to the section it creates
    // into, and every signed-in state now shows one there — the "New" pill
    // beside the heading, the dashed row under the list, or the empty
    // card's own button. A fourth one up here would be the same action a
    // fourth time.
    <Screen title={t('Collections', 'Bộ sưu tập', 'コレクション')}>
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {loading && (
          <View>
            <GuestNotice navigation={navigation} />
            <Text style={s.section}>{t('Public collections', 'Bộ sưu tập công khai', '公開コレクション')}</Text>
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.row}>
                <Card style={s.card}>
                  <Skeleton style={s.thumb} />
                  <View style={s.cardText}>
                    <Skeleton style={{ height: 18, width: '70%', borderRadius: 8 }} />
                    <Skeleton style={{ height: 13, width: '45%', borderRadius: 7 }} />
                  </View>
                </Card>
              </View>
            ))}
          </View>
        )}
        {!loading && cols.error && <Empty text={t(`Couldn't load collections: ${cols.error}`, `Không tải được bộ sưu tập: ${cols.error}`, `読み込みに失敗しました: ${cols.error}`)} />}
        {!loading && !cols.error && (
          <SectionList
            sections={sections}
            keyExtractor={(c) => c.slug}
            stickySectionHeadersEnabled={false}
            ListHeaderComponent={<GuestNotice navigation={navigation} />}
            renderSectionHeader={({ section }) => (
              // The pill rides the heading only where there is already a
              // list — an empty section has the full card below it making
              // the same offer, and two invitations to do one thing read as
              // two different things.
              section.own && section.data.length > 0
                ? (
                  <View style={s.sectionRow}>
                    <Text style={[s.section, s.sectionFlush]}>{section.title}</Text>
                    <PressableScale
                      onPress={() => navigation.navigate('CollectionForm')}
                      accessibilityRole="button"
                      accessibilityLabel={t('New collection', 'Bộ sưu tập mới', '新しいコレクション')}
                    >
                      <LinearGradient {...gradAI} style={s.newPill}>
                        <Ionicons name="add" size={18} color={colors.accentInk} />
                        <Text style={s.newPillText}>{t('New', 'Tạo mới', '新規')}</Text>
                      </LinearGradient>
                    </PressableScale>
                  </View>
                )
                : <Text style={s.section}>{section.title}</Text>
            )}
            renderItem={({ item, section }) => {
              const count = membersOf(item, places).length;
              const uri = coverFor(item);
              // Narrowed to roughly a third of its width, the card has room
              // for a name and a count and nothing else. So the cover comes
              // down to 64pt, the chevron closes up — the row is already
              // open, it has nothing left to announce — and the title drops
              // to a single line rather than wrapping into the space the
              // meta needs. All of it rides the same drag as the pin, so
              // the card reflows under your thumb instead of snapping when
              // you let go.
              const card = (open: boolean, drag: Drag | null) => (
                <PressableScale onPress={() => navigation.navigate('CollectionDetail', { slug: item.slug })}>
                  <Card style={s.card}>
                    <Animated.View
                      style={[s.thumb, drag && {
                        width: Animated.add(THUMB, Animated.multiply(drag, (THUMB - THUMB_OPEN) / ACTIONS_W)),
                        height: Animated.add(THUMB, Animated.multiply(drag, (THUMB - THUMB_OPEN) / ACTIONS_W)),
                      }]}
                    >
                      {uri
                        ? <Image source={{ uri }} style={s.thumbFill} contentFit="cover" transition={200} />
                        : <EmptyCover />}
                    </Animated.View>
                    <View style={s.cardText}>
                      <Text style={s.title} numberOfLines={open ? 1 : 2}>{t(item.title_en, item.title_vi, item.title_ja)}</Text>
                      <View style={s.metaRow}>
                        {/* The padlock says whose it is without spending a
                            word on it — and every owned list is private,
                            so the word after it never varies. */}
                        {section.own && (
                          <Ionicons name="lock-closed-outline" size={13} color={colors.textTertiary} />
                        )}
                        <Text style={s.meta} numberOfLines={1}>
                          {/* "0 places" reads like a broken count; an empty
                              list you just made deserves a sentence. */}
                          {count === 0
                            ? t('No places yet', 'Chưa có địa điểm', 'スポットはまだありません')
                            : `${count} ${t('places', 'địa điểm', 'スポット')}`}
                          {section.own ? `  ·  ${t('Private', 'Riêng tư', '非公開')}` : ''}
                          {item.curator_handle ? `  ·  ${t('by', 'bởi', 'by')} ${item.curator_handle}` : ''}
                        </Text>
                      </View>
                    </View>
                    <Animated.View
                      style={[s.chevron, drag && {
                        // The gap the card lays out before it closes up
                        // too, or the title keeps paying for a control
                        // that is no longer there.
                        width: Animated.add(CHEVRON, Animated.multiply(drag, CHEVRON / ACTIONS_W)),
                        marginLeft: Animated.multiply(drag, space.cardPadding / ACTIONS_W),
                        opacity: drag.interpolate({
                          inputRange: [-40, 0], outputRange: [0, 1], extrapolate: 'clamp',
                        }),
                      }]}
                    >
                      <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
                    </Animated.View>
                  </Card>
                </PressableScale>
              );
              // The margins sit on the wrapper, not on the swipeable row:
              // actions revealed behind a full-bleed row would slide out
              // past the page margin the rest of the screen keeps.
              return (
                <View style={s.row}>
                  {section.own
                    ? (
                      <SwipeRow
                        onEdit={() => navigation.navigate('CollectionForm', {
                          slug: item.slug,
                          title: t(item.title_en, item.title_vi, item.title_ja),
                          desc: t(item.desc_en, item.desc_vi, item.desc_ja),
                        })}
                        onDelete={() => remove(item)}
                        editLabel={t('Edit', 'Sửa', '編集')}
                        deleteLabel={t('Delete', 'Xoá', '削除')}
                      >
                        {card}
                      </SwipeRow>
                    )
                    : card(false, null)}
                </View>
              );
            }}
            renderSectionFooter={({ section }) => {
              if (section.own) {
                return section.data.length === 0
                  ? <FirstCollection onPress={() => navigation.navigate('CollectionForm')} />
                  : <NewCollectionRow onPress={() => navigation.navigate('CollectionForm')} />;
              }
              return section.data.length === 0
                ? <Empty text={t('No public collections yet.', 'Chưa có bộ sưu tập công khai.', '公開コレクションはまだありません。')} />
                : null;
            }}
            contentContainerStyle={{ paddingBottom: tabClearance }}
            showsVerticalScrollIndicator={false}
            onRefresh={() => { cols.reload(); mine.reload(); }}
            refreshing={loading}
          />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  // Margins stay on the Pressable; the card itself is what scales.
  noticeWrap: { marginHorizontal: space.page, marginBottom: space.titleToContent },
  notice: {
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, paddingHorizontal: space.cardPadding, paddingVertical: 17,
  },
  noticeHead: { flexDirection: 'row', gap: 13 },
  // Tinted well, not a filled disc: the filled accent shape belongs to the
  // selected tab, and two of them on one screen both claim to be the
  // thing you last touched.
  noticeIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { color: colors.text, ...type.cardTitle },
  // A step down from `type.body`: this is the supporting line, and at body
  // size it read as loud as the collection titles underneath it.
  noticeBody: { color: colors.textSecondary, fontSize: 14.5, lineHeight: 20 },
  noticeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    // 40 + 13: the icon well and its gap, so the chip starts on the text's
    // left edge rather than under the icon.
    marginTop: 14, marginLeft: 53,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14,
  },
  noticeChipText: { color: colors.accentInk, fontSize: 15, fontWeight: font.semibold },

  section: {
    color: colors.text, ...type.section,
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },
  // The heading keeps its own padding through `s.section`; inside the row
  // the row owns it, and applying both would indent the title twice.
  sectionFlush: { paddingHorizontal: 0, marginBottom: 0 },
  newPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingLeft: 14, paddingRight: 18, paddingVertical: 9,
    borderRadius: radius.pill,
  },
  newPillText: { color: colors.accentInk, fontSize: 15.5, fontWeight: font.semibold },

  newRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: space.cardPadding, borderRadius: radius.card,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderGlass,
  },
  newRowIcon: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  newRowTitle: { color: colors.text, ...type.cardTitle },
  newRowSub: { color: colors.textTertiary, fontSize: 14, lineHeight: 19 },

  firstWrap: { marginHorizontal: space.page, marginBottom: space.titleToContent },
  first: {
    alignItems: 'center', gap: 10,
    paddingHorizontal: space.cardPadding + 6, paddingTop: 26, paddingBottom: 22,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card,
  },
  firstIcon: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
    marginBottom: 2,
  },
  firstTitle: { color: colors.text, ...type.headline },
  firstBody: {
    color: colors.textSecondary, fontSize: 15, lineHeight: 21,
    textAlign: 'center', marginBottom: 6,
  },
  firstCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 15, borderRadius: radius.pill,
  },
  firstCtaText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
  firstFoot: { color: colors.textTertiary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },

  row: { marginHorizontal: space.page, marginBottom: space.cardGap },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.cardPadding,
    padding: space.cardPadding,
  },
  // The box, which is what the swipe resizes; the cover inside fills it.
  thumb: {
    width: THUMB, height: THUMB, borderRadius: radius.image,
    backgroundColor: colors.surfaceGlass,
  },
  thumbFill: { width: '100%', height: '100%', borderRadius: radius.image },
  thumbEmpty: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.accentLine,
  },

  // Revealed behind an owned row. Height comes from the row, so the two
  // buttons stay square-ish whatever the title wraps to.
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginLeft: 8 },
  // Width on the Pressable, the painted box on its animated child: the
  // child is what scales on press, and `flex: 1` is what makes it as tall
  // as the row instead of as tall as its glyph.
  actionWrap: { width: 62 },
  action: {
    flex: 1, borderRadius: radius.image,
    alignItems: 'center', justifyContent: 'center',
  },
  actionEdit: { backgroundColor: colors.surfaceGlassStrong, borderWidth: 1, borderColor: colors.borderGlassSoft },
  // The one destructive surface in the app, so it is the one place the
  // soft red is a fill rather than a line of text.
  actionDelete: { backgroundColor: colors.bad },
  cardText: { flex: 1, gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { color: colors.text, ...type.cardTitle },
  meta: { color: colors.textTertiary, ...type.meta },
  // Circular control: translucent fill, thin hairline, 44pt touch target.
  chevron: {
    width: CHEVRON, height: CHEVRON, borderRadius: CHEVRON / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
});
