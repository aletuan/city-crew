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
// When auto is on, the subtitle names the city it resolved — "On" alone
// answered half the question. And a tap on the location row that comes
// back empty-handed says so in place instead of closing the sheet over
// nothing: refusing the permission at the system prompt is an answer,
// but silence after the person explicitly asked is a broken button.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCity } from '../lib/city';
import { fetchPlaceCountByCity } from '../lib/data';
import { useI18n } from '../lib/i18n';
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

  // The house entrance (SaveSheet's, via PersonSheet): the modal only
  // fades — the scrim brightens in place, the way a room dims — while
  // the sheet alone rises on a native-driven spring. Modal's own
  // animationType="slide" moved the whole window, scrim included, and
  // read as a wall climbing the screen.
  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
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

        {cities.map((c, i) => {
          const active = c.id === city?.id;
          const n = counts[c.id];
          return (
            <View key={c.id}>
              {i > 0 && <View style={s.sep} />}
              <PressableScale
                haptic="selection"
                style={[s.row, active && s.rowOn]}
                onPress={() => { fireHaptic('selection'); setCity(c.id); onClose(); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, active && { color: colors.accent }]}>
                    {t(c.short_en, c.short_vi, c.short_ja)}
                  </Text>
                  {n != null && (
                    <Text style={s.rowSub}>
                      {t(`${n} ${n === 1 ? 'place' : 'places'}`, `${n} địa điểm`, `${n}件`)}
                      {n < YOUNG_CITY_MAX
                        ? t(' · new', ' · mới', ' · 新着')
                        : ''}
                    </Text>
                  )}
                </View>
                {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </PressableScale>
            </View>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // SaveSheet's backdrop, so the five sheets dim the room identically.
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.62)' },
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
  // The empty-handed answer, under the well it answers for.
  note: { color: colors.accent, fontSize: 12.5, lineHeight: 17, paddingHorizontal: 4, marginBottom: 6 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginHorizontal: 4 },
});
