// City switcher — a bottom sheet with two ways to choose, and the
// difference between them kept visible.
//
// The sheet slides from the bottom with a grab handle, the platform's own
// grammar for "a quick choice, then back to what you were doing" — the
// centered fade it replaced read as an interruption. "Use my location" is
// the primary action and sits in a tinted well; the city rows carry no
// glyphs, because five identical buildings said nothing five times — the
// chosen row wears the tint and a tick instead (the tick stays: colour
// alone must never be the whole signal).
//
// The count moved to the right edge: the number is what you compare rows
// by, so it belongs in a column you can read down. The chosen row keeps
// the sheet's tint and turns its text accent.
//
// No chevrons. A chevron promises a screen on the other side, and these
// rows have none — a tap sets the city and the sheet closes. It was also
// a second thing in the right-hand column, standing between the eye and
// the numbers the column exists for.
//
// The tick went when the chevron came, and it was carrying something:
// colour alone should never be the whole signal. `aria-selected` now
// carries it instead, so VoiceOver still announces the chosen row; what
// is lost is the sighted non-colour cue, which the tint and the weight
// have to do on their own.
//
// The search field earns its place at eight cities and not before. It
// folds diacritics through `lib/search`'s own `fold`, so "hue" finds
// Huế and "da lat" finds Đà Lạt — typing a Vietnamese name without the
// marks is the ordinary case on a phone keyboard, not the exception.
//
// When auto is on, the subtitle names the city it resolved — "On" alone
// answered half the question. And a tap on the location row that comes
// back empty-handed says so in place instead of closing the sheet over
// nothing: refusing the permission at the system prompt is an answer,
// but silence after the person explicitly asked is a broken button.

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCity } from '../lib/city';
import { fetchPlaceCountByCity } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { fold } from '../lib/search';
import { colors, font, radius, space } from '../theme';
import { fireHaptic, PressableScale } from './ui';

/** Under this many live places a city is introduced as new — a promise
 *  kept small on purpose, so nobody walks into a young catalog expecting
 *  Hanoi. The number is a judgement, not a measurement; move it when a
 *  city stops feeling young before it crosses. */
const YOUNG_CITY_MAX = 30;

export function CitySwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { city, cities, mode, setCity, followMyLocation } = useCity();
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // How many places each row is promising — asked once, the first time
  // the sheet opens, because the answer moves at the desk's pace, not the
  // reader's. A count that never comes leaves the rows exactly as quiet
  // as they were before this existed.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const askedCounts = useRef(false);
  useEffect(() => {
    if (!visible || askedCounts.current) return;
    askedCounts.current = true;
    fetchPlaceCountByCity().then(setCounts).catch(() => {});
  }, [visible]);

  const here = city ? t(city.short_en, city.short_vi, city.short_ja) : null;

  // Every name a city answers to, not just the one on screen: somebody
  // reading the app in Vietnamese still types "saigon" as often as
  // "sài gòn", and a search that only looked at the shown language would
  // refuse them.
  const q = fold(query.trim());
  const shown = q
    ? cities.filter((c) => [c.short_en, c.short_vi, c.short_ja, c.name_en, c.name_vi, c.name_ja]
      .some((name) => fold(name).includes(q)))
    : cities;

  // The house entrance (SaveSheet's, via PersonSheet): the modal only
  // fades — the scrim brightens in place, the way a room dims — while
  // the sheet alone rises on a native-driven spring. Modal's own
  // animationType="slide" moved the whole window, scrim included, and
  // read as a wall climbing the screen.
  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    setQuery('');
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    setNote(null);
    let found = false;
    try { found = await followMyLocation(); } catch { /* answered below, like any empty hand */ }
    setLocating(false);
    if (found) { onClose(); return; }
    setNote(t(
      'Couldn’t read your location — check location access in Settings.',
      'Không đọc được vị trí — kiểm tra quyền vị trí trong Cài đặt.',
      '位置情報を取得できません — 設定で位置情報のアクセスを確認してください。',
    ));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 360] }) }],
        }]}
      >
        <View style={s.handle} />
        <Text style={s.title}>{t('Choose a city', 'Chọn thành phố', '都市を選択')}</Text>

        <View style={s.search}>
          <Ionicons name="search" size={17} color={colors.textTertiary} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search cities…', 'Tìm thành phố…', '都市を検索…')}
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t('Search cities', 'Tìm thành phố', '都市を検索')}
            testID="city-search"
          />
        </View>

        <PressableScale haptic="selection" style={s.locWell} onPress={locate}>
          <Ionicons name="navigate-outline" size={19} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>
              {locating ? t('Locating…', 'Đang định vị…', '位置情報を取得中…') : t('Use my location', 'Dùng vị trí của tôi', '現在地を使う')}
            </Text>
            <Text style={s.rowSub}>
              {mode === 'auto'
                ? (here
                  ? t(`On · you're in ${here}`, `Đang bật · đang ở ${here}`, `オン · ${here}にいます`)
                  : t('On — nearest city is selected for you', 'Đang bật — tự chọn thành phố gần nhất', 'オン — 最寄りの都市を自動選択'))
                : t('Currently picking manually', 'Đang chọn thủ công', '現在は手動で選択中')}
            </Text>
          </View>
        </PressableScale>
        {note ? <Text style={s.note}>{note}</Text> : null}

        {/* Scrolls, and keeps taps while the keyboard is up: without
            `keyboardShouldPersistTaps` the first tap on a row only
            dismisses the keyboard, so choosing a city you have just
            searched for takes two taps and feels broken. */}
        <ScrollView
          style={s.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {shown.map((c, i) => {
            const active = c.id === city?.id;
            const n = counts[c.id];
            return (
              <View key={c.id}>
                {i > 0 && <View style={s.sep} />}
                <PressableScale
                  haptic="selection"
                  style={[s.row, active && s.rowOn]}
                  onPress={() => { fireHaptic('selection'); setCity(c.id); onClose(); }}
                  accessibilityRole="button"
                  // `aria-*` rather than `accessibilityState`, which
                  // react-native-web drops — the same reason `Chip` does
                  // it this way, and now the only thing besides colour
                  // saying which row is chosen.
                  aria-selected={active}
                  testID={`city-row-${i}`}
                >
                  <View style={s.nameRow}>
                    <Text style={[s.rowTitle, active && { color: colors.accent }]}>
                      {t(c.short_en, c.short_vi, c.short_ja)}
                    </Text>
                    {/* Beside the name, because that is the noun it means.
                        Under it — as "15 places · new" — it sat next to
                        the count instead, and read as fifteen *newly
                        added* places rather than a young catalog. A chip
                        against the city's own name cannot say that. */}
                    {n != null && n < YOUNG_CITY_MAX && (
                      <View style={s.newChip}>
                        <Text style={s.newChipText}>{t('NEW', 'MỚI', '新着')}</Text>
                      </View>
                    )}
                  </View>
                  {/* Right edge, so the numbers line up in a column you
                      can read down. A city with nothing in it yet shows
                      no number rather than a zero: the row is an offer,
                      and "0" reads as a broken one. */}
                  {n != null && (
                    <Text style={[s.count, active && { color: colors.accent }]}>{n}</Text>
                  )}
                </PressableScale>
              </View>
            );
          })}
          {shown.length === 0 && (
            <Text style={s.empty}>
              {t('No city by that name', 'Không có thành phố nào như vậy', 'その名前の都市はありません')}
            </Text>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // SaveSheet's backdrop, so the five sheets dim the room identically.
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.card + 6, borderTopRightRadius: radius.card + 6,
    paddingHorizontal: space.cardPadding, paddingTop: 8,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.borderGlass, marginBottom: 12,
  },
  title: {
    color: colors.text, fontSize: 18, fontWeight: font.semibold,
    marginBottom: 12, paddingHorizontal: 4,
  },
  // The field the reference draws: a quiet well, the search glyph inside
  // it rather than beside it, and the same radius as everything else on
  // this sheet.
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 13, height: 44, marginBottom: 10,
    borderRadius: radius.card - 6, backgroundColor: colors.surfaceGlass,
  },
  searchInput: {
    flex: 1, color: colors.text, fontSize: 15.5, padding: 0,
  },
  // Capped, so eight cities and a keyboard cannot push the rows off the
  // bottom of the screen. Below the cap the sheet is still its content's
  // height — nothing grows a scroll bar it does not need.
  list: { maxHeight: 380 },
  empty: {
    color: colors.textTertiary, fontSize: 14,
    paddingVertical: 22, textAlign: 'center',
  },
  locWell: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: radius.card - 6,
    backgroundColor: colors.accentSoft, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 12,
  },
  // The chosen row wears the well's own tint — one material for "this is
  // the special one" across the sheet — plus the tick above.
  rowOn: { backgroundColor: colors.accentSoft, borderRadius: radius.card - 6 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: font.medium },
  rowSub: { color: colors.textTertiary, fontSize: 12.5, marginTop: 2 },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Tabular figures so the column of counts lines up digit for digit;
  // 274 above 43 with proportional numerals reads as a ragged edge.
  count: {
    color: colors.textTertiary, fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  // Outlined rather than filled: the chosen row already wears accentSoft
  // as its ground, and a soft-tinted chip would vanish into it on the one
  // row most likely to carry this — the young city you just switched to.
  newChip: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentLine,
  },
  newChipText: {
    color: colors.accent, fontSize: 10, fontWeight: font.semibold, letterSpacing: 0.6,
  },
  // The empty-handed answer, under the well it answers for.
  note: { color: colors.accent, fontSize: 12.5, lineHeight: 17, paddingHorizontal: 4, marginBottom: 6 },
  // `marginVertical`, and it is the whole reason this line is visible.
  //
  // Without it the hairline sits flush against the next row, which is fine
  // between two plain ones and invisible against the selected pill: an 8%
  // hairline touching the top edge of an `accentSoft` fill reads as the
  // pill's own border, not as a divider. The language sheet got away with
  // it because its selected row is usually the first, so its dividers fall
  // between plain rows; the appearance sheet has two rows and one divider,
  // and when Light is chosen that divider is the one hugging the pill.
  //
  // Three points either side is enough to put sheet colour between the
  // line and the fill, and small enough that the rhythm between plain rows
  // does not change.
  sep: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginHorizontal: 4, marginVertical: 3,
  },
});
