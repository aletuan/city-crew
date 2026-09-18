import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ExploreFilters, ExploreSort, ExploreStatus } from '../lib/exploreFilters';
import { useI18n } from '../lib/i18n';
import { colors, display, font, radius, space } from '../theme';
import { fireHaptic, GradientCta, PressableScale } from './ui';

const SORTS: ExploreSort[] = ['recommended', 'distance', 'rating'];
const STATUSES: ExploreStatus[] = ['any', 'open', 'closed'];

function sortLabel(value: ExploreSort, t: ReturnType<typeof useI18n>['t']) {
  if (value === 'distance') return t('Distance', 'Khoảng cách', '距離');
  if (value === 'rating') return t('Rating', 'Đánh giá', '評価');
  return t('Recommended', 'Đề xuất', 'おすすめ');
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
  return t('Any', 'Tất cả', 'すべて');
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

        <Text style={s.legend}>{t('Sort by', 'Sắp xếp theo', '並べ替え')}</Text>
        <View style={s.options} accessibilityRole="radiogroup">
          {SORTS.map((value) => {
            const active = draft.sort === value;
            return (
              <PressableScale
                key={value}
                onPress={() => choose('sort', value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                containerStyle={s.optionCell}
                style={[s.option, active && s.optionOn]}
              >
                <Text style={[s.optionText, active && s.optionTextOn]} numberOfLines={1}>
                  {sortLabel(value, t)}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <Text style={s.legend}>{t('Status', 'Trạng thái', '営業状況')}</Text>
        <View style={s.options} accessibilityRole="radiogroup">
          {STATUSES.map((value) => {
            const active = draft.status === value;
            return (
              <PressableScale
                key={value}
                onPress={() => choose('status', value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                containerStyle={s.optionCell}
                style={[s.option, active && s.optionOn]}
              >
                <Text style={[s.optionText, active && s.optionTextOn]} numberOfLines={1}>
                  {statusLabel(value, t)}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <Text style={s.legend}>{t('Saved places', 'Địa điểm đã lưu', '保存済み')}</Text>
        <PressableScale
          onPress={() => {
            if (!signedIn) { onNeedSignIn(); return; }
            choose('savedOnly', !draft.savedOnly);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.savedOnly, disabled: !signedIn }}
          style={[s.saved, draft.savedOnly && s.savedOn]}
        >
          <Ionicons name={draft.savedOnly ? 'bookmark' : 'bookmark-outline'} size={18} color={draft.savedOnly ? colors.accent : colors.text} />
          <Text style={[s.savedText, draft.savedOnly && s.optionTextOn]}>
            {t('Bookmarked only', 'Chỉ mục đã lưu', 'ブックマークのみ')}
          </Text>
          {!signedIn ? <Text style={s.signInHint}>{t('Sign in required', 'Cần đăng nhập', 'サインインが必要')}</Text> : null}
        </PressableScale>

        {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
        <View style={s.actions}>
          <PressableScale
            onPress={() => { setDraft({ sort: 'recommended', status: 'any', savedOnly: false }); setError(null); }}
            accessibilityRole="button"
            style={s.reset}
          >
            <Text style={s.resetText}>{t('Reset', 'Đặt lại', 'リセット')}</Text>
          </PressableScale>
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { color: colors.text, fontSize: 21, fontFamily: display.bold },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass },
  legend: { color: colors.textTertiary, fontSize: 11, fontWeight: font.semibold, textTransform: 'uppercase', marginTop: 13, marginBottom: 8 },
  options: { flexDirection: 'row', gap: 8 },
  // Three equal thirds of the row, and the `flex` is out here rather than
  // on the cell below for the reason `PressableScale` spells out: put it
  // in `style` and it lands on the animated view inside a Pressable that
  // has already shrunk to fit its own text. Which is what happened — the
  // three pills came out the widths of the words "Recommended",
  // "Distance" and "Rating", with a third of the row left empty after
  // them. A row of choices should be a row of equals; the width of a
  // label is not a ranking.
  optionCell: { flex: 1 },
  option: {
    minHeight: 46, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card - 7,
  },
  optionOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  // 13, up from 12: the cells are the full width of the row now and the
  // type was sized for the cramped version of them.
  optionText: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium },
  optionTextOn: { color: colors.accent, fontWeight: font.semibold },
  saved: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 13, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card - 5,
  },
  savedOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  savedText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: font.medium },
  signInHint: { color: colors.textTertiary, fontSize: 10.5, fontWeight: font.medium },
  error: { color: colors.bad, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 20 },
  reset: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 17, borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill },
  resetText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },
  applyWrap: { flex: 1 },
});
