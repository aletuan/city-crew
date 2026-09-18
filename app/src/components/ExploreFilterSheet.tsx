import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ExploreFilters, ExploreSort, ExploreStatus } from '../lib/exploreFilters';
import { useI18n } from '../lib/i18n';
import { colors, display, font, radius, space } from '../theme';
import { Card, fireHaptic, GradientCta, PressableScale } from './ui';

/** What the sheet looks like with nothing chosen — the state Reset
 *  returns to, and the one it compares against to know it has anything
 *  to return from. */
const NOTHING_APPLIED: ExploreFilters = { sort: 'recommended', status: 'any', savedOnly: false };

const SORTS: ExploreSort[] = ['recommended', 'distance', 'rating'];
const STATUSES: ExploreStatus[] = ['any', 'open', 'closed'];

/**
 * The sort's name says what it does to the list, not what it sorts on.
 *
 * "Distance" and "Rating" name a column. "Nearest first" and "Highest
 * rated" name the order you will get, which is the thing being chosen —
 * and they cost nothing, because these are rows now and a row has the
 * width for them.
 */
function sortLabel(value: ExploreSort, t: ReturnType<typeof useI18n>['t']) {
  if (value === 'distance') return t('Nearest first', 'Gần nhất trước', '近い順');
  if (value === 'rating') return t('Highest rated', 'Đánh giá cao nhất', '評価の高い順');
  return t('Recommended', 'Đề xuất', 'おすすめ');
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
function statusLabel(value: ExploreStatus, t: ReturnType<typeof useI18n>['t']) {
  if (value === 'open') return t('Open now', 'Đang mở', '営業中');
  if (value === 'closed') return t('Closed now', 'Đã đóng', '営業時間外');
  // "Any time", not "Any": it sits under a heading that asks about
  // opening hours, and the other two answers are about now.
  return t('Any time', 'Bất kỳ', '指定なし');
}

export default function ExploreFilterSheet({
  visible,
  applied,
  signedIn,
  countFor,
  onClose,
  onApply,
  onNeedSignIn,
}: {
  visible: boolean;
  applied: ExploreFilters;
  signedIn: boolean;
  countFor: (filters: ExploreFilters) => number;
  onClose: () => void;
  onApply: (filters: ExploreFilters) => Promise<string | null>;
  onNeedSignIn: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(1)).current;
  const [draft, setDraft] = useState(applied);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    setDraft(applied);
    setError(null);
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, applied, rise]);

  const choose = <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) => {
    fireHaptic('selection');
    setError(null);
    setDraft((current) => ({ ...current, [key]: value }));
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
  const dirty = draft.sort !== NOTHING_APPLIED.sort
    || draft.status !== NOTHING_APPLIED.status
    || draft.savedOnly !== NOTHING_APPLIED.savedOnly;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }],
        }]}
      >
        <View style={s.handle} />
        <View style={s.head}>
          <Text style={s.title}>{t('Sort & filter', 'Sắp xếp & lọc', '並べ替え・絞り込み')}</Text>
          <PressableScale
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('Close filters', 'Đóng bộ lọc', 'フィルターを閉じる')}
            style={s.close}
          >
            <Ionicons name="close" size={19} color={colors.text} />
          </PressableScale>
        </View>

        {/* Rows, where these were three pills in a line.
            A pill row fits three words and nothing else, and the words it
            fitted named columns — "Distance", "Rating" — because that is
            all that would fit. A row has the width for the name of the
            *order*, a mark to recognise it by, and a radio that says out
            loud that these three are one choice. It costs height, and
            that is the trade: the pills were cheaper and said less. */}
        <Text style={[s.legend, s.legendFirst]}>{t('Sort by', 'Sắp xếp theo', '並べ替え')}</Text>
        {/* One card of divided rows, which is the shape this app already
            keeps for a list of choices — `Card` with `featureRow` and a
            hairline on all but the last, four times over in
            ProfileScreen. Three rows standing apart each looked like
            their own switch; the frame is what says they are one answer.

            The horizontal padding is on the rows rather than on the
            card, so the rule between them runs the card's full width and
            the chosen row's tint reaches both edges. ProfileScreen insets
            its rules instead; here the tint is the reason not to. */}
        {/* The role goes on a wrapper rather than on `Card`, which takes
            children and a style and nothing else — a shared primitive
            should not grow a prop for one caller. */}
        <View accessibilityRole="radiogroup">
        <Card>
          {SORTS.map((value, i) => {
            const active = draft.sort === value;
            return (
              <PressableScale
                key={value}
                onPress={() => choose('sort', value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                // Said in words, not assembled from children: without
                // this the row's label is the icon's glyph, a comma and
                // then the words — `'\uf599, Highest rated'` in the tree.
                accessibilityLabel={sortLabel(value, t)}
                style={[s.row, i < SORTS.length - 1 && s.rowDivided, active && s.rowOn]}
              >
                <Ionicons
                  name={sortIcon(value)}
                  size={19}
                  color={active ? colors.accent : colors.textSecondary}
                />
                <Text style={[s.rowText, active && s.rowTextOn]} numberOfLines={1}>
                  {sortLabel(value, t)}
                </Text>
                {/* The border is always drawn and only ever changes
                    colour, so choosing one cannot move the row by a
                    pixel. Same rule as the tabs elsewhere in the app. */}
                <View style={[s.radio, active && s.radioOn]}>
                  {active ? <View style={s.radioDot} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </Card>
        </View>

        {/* One track holding three segments, rather than three pills
            standing apart. The grouping is the point: a pill row leaves
            each option looking like its own switch, and these three are
            one answer to one question. The selected segment wears the
            accent the rest of the app wears when something is chosen —
            not the white raised tile of a native iOS segmented control,
            which has no counterpart on the dark theme. */}
        <Text style={s.legend}>{t('Opening hours', 'Giờ mở cửa', '営業時間')}</Text>
        <View style={s.track} accessibilityRole="radiogroup">
          {STATUSES.map((value) => {
            const active = draft.status === value;
            return (
              <PressableScale
                key={value}
                onPress={() => choose('status', value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                containerStyle={s.segmentCell}
                style={[s.segment, active && s.segmentOn]}
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
        <Text style={s.legend}>{t('Saved places', 'Địa điểm đã lưu', '保存済み')}</Text>
        <Card>
        <PressableScale
          onPress={() => {
            if (!signedIn) { onNeedSignIn(); return; }
            choose('savedOnly', !draft.savedOnly);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.savedOnly, disabled: !signedIn }}
          // Same reason as the sort rows: the tree otherwise reads the
          // bookmark glyph, the words, "Sign in" and the chevron glyph
          // as one comma-spliced label.
          accessibilityLabel={t('Bookmarked only', 'Chỉ mục đã lưu', 'ブックマークのみ')}
          accessibilityHint={signedIn
            ? undefined
            : t('Sign in to use this', 'Đăng nhập để dùng', 'サインインして使う')}
          style={[s.row, draft.savedOnly && s.rowOn]}
        >
          <Ionicons
            name={draft.savedOnly ? 'bookmark' : 'bookmark-outline'}
            size={19}
            color={draft.savedOnly ? colors.accent : colors.textSecondary}
          />
          <Text style={[s.rowText, draft.savedOnly && s.rowTextOn]}>
            {t('Bookmarked only', 'Chỉ mục đã lưu', 'ブックマークのみ')}
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
              <Text style={s.signInText}>{t('Sign in', 'Đăng nhập', 'サインイン')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </View>
          )}
        </PressableScale>
        </Card>

        {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
        <View style={s.divider} />
        <View style={s.actions}>
          {/* Only when there is something to undo. A Reset standing
              beside an untouched sheet is a control that cannot do
              anything, and the reader has to work that out by pressing
              it. It is drawn as words rather than as a second button for
              the same reason: one action here is the action. */}
          {dirty ? (
            <PressableScale
              onPress={() => { setDraft(NOTHING_APPLIED); setError(null); }}
              accessibilityRole="button"
              style={s.reset}
            >
              <Text style={s.resetText}>{t('Reset', 'Đặt lại', 'リセット')}</Text>
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
              label={`${t('Show', 'Hiện', '表示')} ${count} ${t(count === 1 ? 'place' : 'places', 'địa điểm', '件')}`}
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

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

  // One row shape for every choice in this sheet — the three sorts and
  // the saved toggle — so the eye learns it once.
  //
  // It carries no frame of its own any more: the card around it is the
  // frame, and a rounded rect inside a rounded rect was two of them
  // saying the same thing. Which also lets the chosen row's tint run to
  // both edges, where before it had to stop short of a border.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 52, paddingHorizontal: 14,
  },
  // The rule between rows, on every one but the last — `featureRowDivider`
  // in ProfileScreen, which is where this pattern already lives.
  rowDivided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft },
  rowOn: { backgroundColor: colors.accentSoft },
  rowText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: font.medium },
  rowTextOn: { color: colors.accent, fontWeight: font.semibold },

  // The empty ring is drawn in the tertiary ink the drag handle uses, not
  // in a border token: `borderGlass` on the dark card was a ring you had
  // to know was there. An unchosen radio the eye cannot find is not
  // offering a choice.
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: colors.textTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: colors.accent },

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
    flexDirection: 'row', gap: 4, padding: 4,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.card - 2,
  },
  segmentCell: { flex: 1 },
  segment: {
    minHeight: 40, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1, borderColor: 'transparent', borderRadius: radius.card - 7,
  },
  segmentOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  segmentText: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium },
  segmentTextOn: { color: colors.accent, fontWeight: font.semibold },

  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginTop: space.headingToContent,
  },

  error: { color: colors.bad, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  reset: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  resetText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  applyWrap: { flex: 1 },
});
