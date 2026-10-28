import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ExploreFilters, ExploreSort, ExploreStatus } from '../lib/exploreFilters';
import { useI18n } from '../lib/i18n';
import { colors, display, font, radius, space } from '../theme';
import { Card, fireHaptic, GradientCta, PressableScale, SECONDARY_CONTROL_H, useReducedMotion } from './ui';
import { SLIDE } from './SearchField';
import { useSheetDrag } from './sheetDrag';

/** What the sheet looks like with nothing chosen — the state Reset
 *  returns to, and the one it compares against to know it has anything
 *  to return from. */
const NOTHING_APPLIED: ExploreFilters = { sort: 'recommended', status: 'any', savedOnly: false, visitedOnly: false };

/** Whether Reset has anything to return from. */
const isDirty = (f: ExploreFilters) => f.sort !== NOTHING_APPLIED.sort
  || f.status !== NOTHING_APPLIED.status
  || f.savedOnly !== NOTHING_APPLIED.savedOnly
  || f.visitedOnly !== NOTHING_APPLIED.visitedOnly;

const SORTS: ExploreSort[] = ['recommended', 'distance', 'rating'];
const STATUSES: ExploreStatus[] = ['any', 'open', 'closed'];

/**
 * The sort's name, short enough for a third of a row.
 *
 * These were "Nearest first" and "Highest rated" while the sorts were
 * three rows of a card: a row has the width to name the *order* rather
 * than the column, and the longer names were chosen for that. The sorts
 * are three segments of one track again (13 Oct 2026) — the sheet
 * gained a fourth question, the check-in filter, and three rows of 52pt
 * on top of it put the Apply button under the home indicator on a
 * 390pt phone — so the names are back to what fits a segment. The
 * owner asked for the shorter Vietnamese in the same breath: "trước"
 * in "Gần nhất trước" only repeats what the heading "Sắp xếp theo"
 * already says.
 *
 * Each still names a direction and not a column: "Nearest", not
 * "Distance"; "Top rated", not "Rating". Vietnamese "Đánh giá" is the
 * one that reads as a column, and it stands because the star beside
 * it says which way a rating sort can go, and "Đánh giá cao nhất"
 * wraps to two lines in a segment while its neighbours take one.
 */
function sortLabel(value: ExploreSort, t: ReturnType<typeof useI18n>['t']) {
  if (value === 'distance') return t('Nearest', 'Gần nhất', '近い順', '距离最近', '距離最近');
  if (value === 'rating') return t('Top rated', 'Đánh giá', '評価順', '评分最高', '評分最高');
  return t('Recommended', 'Đề xuất', 'おすすめ', '推荐', '推薦');
}

/**
 * A mark per sort, and the star is the one to be careful with: the app's
 * star is gold, and that is its single exception to the one-accent rule —
 * it means "this is a rating". Drawn here in ink and outline, so it reads
 * as the subject of a choice rather than as a score.
 */
function sortIcon(value: ExploreSort): keyof typeof Ionicons.glyphMap {
  if (value === 'distance') return 'navigate-outline';
  if (value === 'rating') return 'star-outline';
  return 'sparkles-outline';
}

/**
 * "Open now", not "Opened".
 *
 * The filter asks about this minute, and the past participle answered a
 * different question — "opened" is something a place did, at some point,
 * and reads in a list of two as though its partner meant "shut down".
 * The pair that carries the tense is "Open now" / "Closed now".
 *
 * Vietnamese already said it: "Đang mở" is present-continuous and "Đã
 * đóng" is its opposite, so those stand. Japanese too — 営業中 is "in the
 * middle of trading" and 営業時間外 is "outside business hours", both
 * about now, and neither needs a 今 in front of it to say so.
 */
export function statusLabel(value: ExploreStatus, t: ReturnType<typeof useI18n>['t']) {
  if (value === 'open') return t('Open now', 'Đang mở cửa', '営業中', '营业中', '營業中');
  if (value === 'closed') return t('Closed now', 'Đang đóng cửa', '営業時間外', '已打烊', '已打烊');
  // "Any time", not "Any": it sits under a heading that asks about
  // opening hours, and the other two answers are about now.
  return t('Any time', 'Mọi giờ', '指定なし', '不限', '不限');
}

/**
 * What a saved/visited row says it is: a checkbox for a reader who can
 * tick it, a button for a guest it sends to sign in.
 *
 * It was a checkbox both ways, with `disabled` set for the guest — and
 * the guest's row is not disabled: pressing it opens sign-in, and the
 * screen says so with an accent "Sign in ›" where the box would be.
 * VoiceOver read "checkbox, dimmed" over that door, so a reader who
 * trusts the announcement never tried it, and TalkBack may decline to
 * activate a node it has been told is disabled. "Unchecked" was wrong
 * too: a guest has no box to be unchecked. (UX-01, 17 Oct 2026.)
 *
 * The guest's label is the row read left to right, name first, so a
 * reader skimming the rows hears which one this is before what it
 * needs. `aria-checked` beside the state for the same reason the radios
 * carry it: react-native-web drops `accessibilityState`, and a test can
 * only read what reaches the DOM.
 */
export function switchOrDoor(signedIn: boolean, checked: boolean, name: string, door: string, why: string) {
  return signedIn
    ? { accessibilityRole: 'checkbox' as const, accessibilityState: { checked }, 'aria-checked': checked, accessibilityLabel: name }
    : { accessibilityRole: 'button' as const, accessibilityLabel: door, accessibilityHint: why };
}

export default function ExploreFilterSheet({
  visible,
  applied,
  signedIn,
  visitedAvailable,
  countFor,
  onClose,
  onApply,
  onNeedSignIn,
}: {
  visible: boolean;
  applied: ExploreFilters;
  signedIn: boolean;
  /** Whether check-in exists on this build (`place_checkin`); off, the
   *  sheet has three questions, as it did before the fourth. */
  visitedAvailable: boolean;
  countFor: (filters: ExploreFilters) => number;
  onClose: () => void;
  onApply: (filters: ExploreFilters) => Promise<string | null>;
  onNeedSignIn: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(1)).current;
  const { drag, handlers } = useSheetDrag(visible, onClose);
  const [draft, setDraft] = useState(applied);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const still = useReducedMotion();
  // Configured before the render that moves things, and only for the
  // renders that do: Reset arriving or leaving. A tap that changes the
  // sort while another answer already holds Reset in place moves nothing,
  // and a slide armed for it would animate whatever else that render
  // happened to shift — the error line, say.
  const slide = () => { if (!still) LayoutAnimation.configureNext(SLIDE); };

  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    setDraft(applied);
    setError(null);
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, applied, rise]);

  const choose = <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) => {
    fireHaptic('selection');
    setError(null);
    const next = { ...draft, [key]: value };
    if (isDirty(next) !== isDirty(draft)) slide();
    setDraft(next);
  };

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await onApply(draft);
    setBusy(false);
    if (message) setError(message);
  };

  const count = countFor(draft);
  const dirty = isDirty(draft);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')} />
      <Animated.View
        {...handlers}
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }, { translateY: drag }],
        }]}
      >
        <View style={s.handle} />
        <View style={s.head}>
          <Text style={s.title}>{t('Sort & filter', 'Sắp xếp & lọc', '並べ替え・絞り込み', '排序和筛选', '排序和篩選')}</Text>
          <PressableScale
            onPress={onClose}
            testID="filter-close"
            accessibilityRole="button"
            accessibilityLabel={t('Close filters', 'Đóng bộ lọc', 'フィルターを閉じる', '关闭筛选', '關閉篩選')}
            contentStyle={s.close}
          >
            <Ionicons name="close" size={19} color={colors.text} />
          </PressableScale>
        </View>

        {/* A track of three segments, with a mark each — the shape the
            opening-hours question below already takes, so the two
            questions read as two of one thing.

            They were three rows of a card, and the rows were the better
            answer while the sheet had three questions: the width for
            the order's full name, a radio saying out loud that the
            three are one choice. The fourth question (13 Oct 2026) is
            what took the room back — three 52pt rows above it put the
            Apply button under the home indicator on a 390pt phone, and
            a sheet that scrolls to reach its own button is a sheet that
            has lost. A segment gives up the radio and the long name and
            keeps the mark, the tint and the hairline; the track is what
            says these three are one answer, as it does for the hours. */}
        <Text style={[s.legend, s.legendFirst]}>{t('Sort by', 'Sắp xếp theo', '並べ替え', '排序方式', '排序方式')}</Text>
        <View style={s.track} accessibilityRole="radiogroup">
          {SORTS.map((value) => {
            const active = draft.sort === value;
            return (
              <PressableScale
                key={value}
                onPress={() => choose('sort', value)}
                testID={`filter-sort-${value}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                aria-checked={active}
                // Said in words, not assembled from children: without
                // this the segment's label is the icon's glyph, a comma
                // and then the words.
                accessibilityLabel={sortLabel(value, t)}
                style={s.segmentCell}
                hitSlop={TRACK_SLOP}
                contentStyle={[s.segment, s.segmentWithMark, active && s.segmentOn]}
              >
                <Ionicons
                  name={sortIcon(value)}
                  size={16}
                  color={active ? colors.accent : colors.textSecondary}
                />
                <Text style={[s.segmentText, active && s.segmentTextOn]} numberOfLines={1}>
                  {sortLabel(value, t)}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {/* One track holding three segments, rather than three pills
            standing apart. The grouping is the point: a pill row leaves
            each option looking like its own switch, and these three are
            one answer to one question. The selected segment wears the
            accent the rest of the app wears when something is chosen —
            not the white raised tile of a native iOS segmented control,
            which has no counterpart on the dark theme. */}
        <Text style={s.legend}>{t('Opening hours', 'Giờ mở cửa', '営業時間', '营业时间', '營業時間')}</Text>
        <View style={s.track} accessibilityRole="radiogroup">
          {STATUSES.map((value) => {
            const active = draft.status === value;
            return (
              <PressableScale
                key={value}
                onPress={() => choose('status', value)}
                testID={`filter-status-${value}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                // react-native-web drops `accessibilityState` from the DOM
                // entirely; `aria-checked` is what a test can actually read.
                aria-checked={active}
                style={s.segmentCell}
                hitSlop={TRACK_SLOP}
                contentStyle={[s.segment, active && s.segmentOn]}
              >
                <Text style={[s.segmentText, active && s.segmentTextOn]} numberOfLines={1}>
                  {statusLabel(value, t)}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {/* Its own card, for the same reason the sorts got one: a single
            row with no frame beside two framed blocks reads as the one
            thing nobody finished. And its own heading, for the same
            reason again — two headed blocks and one bare card is the
            same asymmetry one level up. Three questions, three headings.

            "Bookmarked only" rather than naming the section twice: the
            heading says what the block is about, so the row is free to
            say what the switch does. */}
        <Text style={s.legend}>{t('Saved places', 'Địa điểm đã lưu', '保存済み', '已保存的地点', '已儲存的地點')}</Text>
        <Card>
        <PressableScale
          onPress={() => {
            if (!signedIn) { onNeedSignIn(); return; }
            choose('savedOnly', !draft.savedOnly);
          }}
          testID="filter-saved"
          // Same reason as the sort rows for naming it at all: the tree
          // otherwise reads the bookmark glyph, the words, "Sign in" and
          // the chevron glyph as one comma-spliced label.
          {...switchOrDoor(
            signedIn,
            draft.savedOnly,
            t('Bookmarked only', 'Chỉ nơi đã lưu', 'ブックマークのみ', '仅看已保存', '僅看已儲存'),
            t('Bookmarked only, sign in', 'Chỉ nơi đã lưu, đăng nhập', 'ブックマークのみ、サインイン', '仅看已保存，需登录', '僅看已儲存，需登入'),
            t('Sign in to filter by saved places', 'Đăng nhập để lọc theo nơi đã lưu', 'サインインして保存済みで絞り込む', '登录后可按已保存的地点筛选', '登入後可按已儲存的地點篩選'),
          )}
          contentStyle={[s.row, draft.savedOnly && s.rowOn]}
        >
          <Ionicons
            name={draft.savedOnly ? 'bookmark' : 'bookmark-outline'}
            size={19}
            color={draft.savedOnly ? colors.accent : colors.textSecondary}
          />
          <Text style={[s.rowText, draft.savedOnly && s.rowTextOn]}>
            {t('Bookmarked only', 'Chỉ nơi đã lưu', 'ブックマークのみ', '仅看已保存', '僅看已儲存')}
          </Text>
          {/* Signed out this said "Sign in required" in grey, which is a
              refusal written as a label. It is a door, so it looks like
              one — the same accent-and-chevron the app uses wherever a
              row leads somewhere. */}
          {signedIn ? (
            <View style={[s.check, draft.savedOnly && s.checkOn]}>
              {draft.savedOnly ? <Ionicons name="checkmark" size={14} color={colors.accentInk} /> : null}
            </View>
          ) : (
            <View style={s.signIn}>
              <Text style={s.signInText}>{t('Sign in', 'Đăng nhập', 'サインイン', '登录', '登入')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </View>
          )}
        </PressableScale>
        </Card>

        {/* The fourth question, the saved one's twin: same card, same
            row, same door for a guest. Its glyph is the Check-in pill's
            own ring — hollow until the switch is on, as the pill is
            hollow until a visit is written — so the filter and the
            thing it filters on wear one mark. Behind `place_checkin`
            with the pill itself: a filter on a thing nobody on this
            build can do is a question with one answer. */}
        {visitedAvailable ? (
          <>
            <Text style={s.legend}>{t('Visited places', 'Địa điểm đã check-in', '訪問済み', '已打卡的地点', '已打卡的地點')}</Text>
            <Card>
            <PressableScale
              onPress={() => {
                if (!signedIn) { onNeedSignIn(); return; }
                choose('visitedOnly', !draft.visitedOnly);
              }}
              testID="filter-visited"
              {...switchOrDoor(
                signedIn,
                draft.visitedOnly,
                t('Visited only', 'Chỉ nơi đã check-in', '訪問済みのみ', '仅看已打卡', '僅看已打卡'),
                t('Visited only, sign in', 'Chỉ nơi đã check-in, đăng nhập', '訪問済みのみ、サインイン', '仅看已打卡，需登录', '僅看已打卡，需登入'),
                t('Sign in to filter by places you checked in at', 'Đăng nhập để lọc theo nơi đã check-in', 'サインインして訪問済みで絞り込む', '登录后可按打过卡的地点筛选', '登入後可按打過卡的地點篩選'),
              )}
              contentStyle={[s.row, draft.visitedOnly && s.rowOn]}
            >
              <Ionicons
                name={draft.visitedOnly ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={19}
                color={draft.visitedOnly ? colors.accent : colors.textSecondary}
              />
              <Text style={[s.rowText, draft.visitedOnly && s.rowTextOn]}>
                {t('Visited only', 'Chỉ nơi đã check-in', '訪問済みのみ', '仅看已打卡', '僅看已打卡')}
              </Text>
              {signedIn ? (
                <View style={[s.check, draft.visitedOnly && s.checkOn]}>
                  {draft.visitedOnly ? <Ionicons name="checkmark" size={14} color={colors.accentInk} /> : null}
                </View>
              ) : (
                <View style={s.signIn}>
                  <Text style={s.signInText}>{t('Sign in', 'Đăng nhập', 'サインイン', '登录', '登入')}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                </View>
              )}
            </PressableScale>
            </Card>
          </>
        ) : null}

        {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
        {/* One track, always drawn, holding the button and — when there is
            something to undo — Reset beside it. The owner's ask (17 Oct
            2026): Reset inside one seamless block, arriving the way the
            search box's Cancel does, with the button giving up the room
            and taking it back.

            The track stays when Reset is gone. Drawn only around the
            pair, its 4pt of padding would come and go with Reset: three
            things moving at once — the glass, the button's width, and
            the button pushed in from both edges — and the sheet growing
            8pt taller under the finger that just chose a filter. Kept,
            the one thing that moves is the button's width. It is the
            shape the sort and hours tracks above already take, so the
            sheet ends in a fourth of a thing it has three of.

            The hairline that sat above it went in the same change: the
            track is its own edge, and the line was a second one. */}
        <View style={s.actions}>
          {/* Only when there is something to undo. A Reset standing
              beside an untouched sheet is a control that cannot do
              anything, and the reader has to work that out by pressing
              it. It is drawn as words on the track rather than as a
              second button for the same reason: one action here is the
              action. The mark is `refresh`, the circle that means "back
              to how it was"; `arrow-undo` reads as taking back the last
              tap, and Reset takes back all of them. */}
          {dirty ? (
            <PressableScale
              onPress={() => { slide(); setDraft(NOTHING_APPLIED); setError(null); }}
              testID="filter-reset"
              accessibilityRole="button"
              contentStyle={s.reset}
            >
              <Ionicons name="refresh" size={17} color={colors.textSecondary} />
              <Text style={s.resetText}>{t('Reset', 'Đặt lại', 'リセット', '重置', '重設')}</Text>
            </PressableScale>
          ) : null}
          {/* The app's own primary button, not a coral pill drawn again
              here. This one had been hand-rolled — flat fill, 14pt type,
              48 high — beside a `GradientCta` that every other screen
              commits with, so the one button that finishes this sheet was
              the one button in the app that did not look like the rest.
              `wide` is documented for exactly this: the action that
              commits a sheet. The stretch comes from the row, since Reset
              sits beside it.

              The label no longer swaps to "Locating…" while the fix is
              being fetched — the primitive spins its glyph instead, and
              holding the words still is the reason it does. */}
          <View style={s.applyWrap}>
            <GradientCta
              icon="checkmark"
              wide
              busy={busy}
              onPress={() => { void apply(); }}
              testID="filter-apply"
              label={`${t('Show', 'Hiện', '表示', '显示', '顯示')} ${count} ${t(count === 1 ? 'place' : 'places', 'địa điểm', '件', '个地点', '個地點')}`}
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

/** The track's padding: the gutter round the selected segment. */
const TRACK_INSET = 4;
const TRACK_SLOP = { top: TRACK_INSET, bottom: TRACK_INSET };

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 8,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.card + 6, borderTopRightRadius: radius.card + 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginBottom: 10 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    // The title's own gap to the first heading, which is the same 24 the
    // headings below take from each other.
    marginBottom: space.titleToContent,
  },
  title: { color: colors.text, fontSize: 21, fontFamily: display.bold },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass },
  // Sentence case, in ink rather than in the tertiary grey, because
  // these now head blocks of rows rather than labelling a strip of
  // pills. Note this is the sheet departing from the app's `eyebrow`
  // (uppercase, letter-spaced) — deliberately, and worth settling
  // app-wide rather than leaving as two voices.
  // The gaps are the app's, by name rather than by eye. A heading is 16
  // above its content (`headingToContent`, which is what TripsScreen,
  // IdeasScreen and SearchScreen all put under theirs) and the next
  // heading takes 24 above it (`titleToContent`, TripsScreen's
  // `sectionAfter`). This sheet had 18 and 6 — two numbers nobody chose,
  // and the 6 was less than half what every other heading in the app
  // gets, which is exactly how it looked.
  legend: {
    color: colors.text, fontSize: 15, fontWeight: font.semibold,
    marginTop: space.titleToContent, marginBottom: space.headingToContent,
  },
  // The first one is already under the sheet's title, which brings its
  // own air — same exception TripsScreen makes for the heading at the
  // top of the screen.
  legendFirst: { marginTop: 0 },

  // One row shape for every switch in this sheet — the saved toggle and
  // the visited one — so the eye learns it once.
  //
  // It carries no frame of its own any more: the card around it is the
  // frame, and a rounded rect inside a rounded rect was two of them
  // saying the same thing. Which also lets the chosen row's tint run to
  // both edges, where before it had to stop short of a border.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 52, paddingHorizontal: 14,
  },
  rowOn: { backgroundColor: colors.accentSoft },
  rowText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: font.medium },
  rowTextOn: { color: colors.accent, fontWeight: font.semibold },

  check: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 1.5, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  signIn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  signInText: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },

  // The track is what makes three segments read as one question. Its
  // padding is the gutter the selected segment sits in.
  track: {
    flexDirection: 'row', gap: 4, padding: TRACK_INSET,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.card - 2,
  },
  segmentCell: { flex: 1 },
  // The track, not the segment, is the control the eye measures, so the
  // track is what stands at `SECONDARY_CONTROL_H` (the button scale,
  // owner, 28 Oct 2026): 44 overall where it was 48, the segment the 36
  // left inside the gutter, and `TRACK_SLOP` giving each its 44pt target
  // back out to the track's edge.
  segment: {
    minHeight: SECONDARY_CONTROL_H - 2 * TRACK_INSET, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1, borderColor: 'transparent', borderRadius: radius.card - 7,
  },
  // The sort segments carry a mark before the word; the hours segments
  // do not, and a mark on three one-word answers would be three more
  // things to read than the words.
  segmentWithMark: { flexDirection: 'row', gap: 6 },
  segmentOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  segmentText: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium },
  segmentTextOn: { color: colors.accent, fontWeight: font.semibold },

  error: { color: colors.bad, fontSize: 13, lineHeight: 18, marginTop: 10 },
  // The sort track's glass and padding, at the button's own radius: the
  // 4pt it leaves round the button is the track's, and it is the same
  // 4pt the search box leaves round its Cancel. 24pt above, so the sheet
  // keeps its height: the line and its two 16s were 32, the track's
  // padding adds 8, and the sheet already sits at the home indicator on
  // a 390pt phone (see `sortLabel`).
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4,
    marginTop: space.headingToContent + 8,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.pill,
  },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingLeft: 12, paddingRight: 10 },
  resetText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  applyWrap: { flex: 1 },
});
