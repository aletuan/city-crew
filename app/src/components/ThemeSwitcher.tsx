// Theme picker — the grounds and looks the app can wear, opened from
// Profile's settings card. Same sheet grammar as the city and language
// switchers, because it is the same kind of choice.
//
// "Theme", not "Appearance", since 10 Oct 2026, when it stopped being only
// light or dark — the owner's word for it, kept as the English loanword in
// Vietnamese rather than "Giao diện", and テーマ in Japanese.
//
// Three rows, and Auto is the first of them because it is the default.
// This sheet once carried a note saying the opposite — two rows, no
// "match the system", on the argument that light is a different reading
// of the design rather than a courtesy to a phone in light mode. The
// reading holds; the conclusion did not. Deferring to the phone is not a
// third design, it is a way of picking between the two we have, and it
// is the pick most people would make by hand anyway. Anyone who wants
// one ground regardless of the hour still says so on the other two rows.
//
// Unlike its siblings this sheet keeps its glyphs: a moon and a sun are
// two different marks carrying meaning, where the language rows' three
// identical marks carried none. And it keeps its "Done": choosing here
// repaints the whole screen behind the sheet, which is the one moment
// both readings can be seen against each other — closing on the tap
// would hide the result of the tap. A bottom sheet makes that view
// better, not worse: everything above it is the screen repainting.
//
// FIVE ROWS since 10 Oct 2026: the standard three, then Coffee and Rose,
// which are looks rather than grounds (`lib/look.ts`). Those two cannot
// repaint in place — the colours are built at launch — so choosing one
// asks first and restarts the app; the sheet says so on the row, before
// the tap, rather than surprising anyone with a relaunch. Where a look
// cannot be kept (the web build) the two rows are not offered at all.

import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { lookOf, needsRestart } from '../lib/look';
import { Pref, Scheme, useScheme } from '../lib/theme';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

const OPTIONS: { id: Pref; icon: keyof typeof Ionicons.glyphMap }[] = [
  // The phone's own mark for "this device" — the same glyph iOS uses in
  // its Display settings, and the one row of the three whose icon names
  // a place rather than a time of day.
  { id: 'system', icon: 'phone-portrait-outline' },
  { id: 'dark', icon: 'moon-outline' },
  { id: 'light', icon: 'sunny-outline' },
  // The two looks name what they are of: a cup for the coffee brown, a
  // flower for the rose.
  { id: 'coffee', icon: 'cafe-outline' },
  { id: 'rose', icon: 'flower-outline' },
];

type T = (en: string, vi: string, ja?: string) => string;

/** The glyph for a setting, as Profile's row shows it. The standard three
 *  wear the ground showing — under Auto, the one the phone picked — and
 *  the two looks their own mark. */
export function schemeIcon(pref: Pref, scheme: Scheme): keyof typeof Ionicons.glyphMap {
  if (pref === 'coffee' || pref === 'rose') return OPTIONS.find((o) => o.id === pref)!.icon;
  return scheme === 'light' ? 'sunny-outline' : 'moon-outline';
}

/** The label for a setting, in the app's three languages. */
export function schemeLabel(id: Pref, t: T): string {
  if (id === 'system') return t('Automatic', 'Tự động', '自動');
  if (id === 'coffee') return t('Coffee', 'Nâu cafe', 'コーヒー');
  if (id === 'rose') return t('Rose', 'Hồng', 'ローズ');
  return id === 'dark'
    ? t('Dark', 'Tối', 'ダーク')
    : t('Light', 'Sáng', 'ライト');
}

/** The second line on the Auto row: what the phone is doing right now.
 *  Without it the sheet can show a tick on Auto while the screen is
 *  plainly dark, and nothing on it explains which of the two won. */
function systemNow(scheme: Scheme, t: T): string {
  return scheme === 'dark'
    ? t('Following the phone · Dark', 'Theo máy · Tối', '端末に合わせる · ダーク')
    : t('Following the phone · Light', 'Theo máy · Sáng', '端末に合わせる · ライト');
}

export function ThemeSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { scheme, pref, setPref, look, looks } = useScheme();
  const options = looks ? OPTIONS : OPTIONS.filter((o) => lookOf(o.id) === 'standard');
  // A row that changes the look restarts the app, which loses whatever
  // screen the reader was on; it is asked once, here, and nowhere else.
  const choose = (id: Pref) => {
    if (!needsRestart(look, id)) { setPref(id); return; }
    Alert.alert(
      t('Restart to change the theme?', 'Khởi động lại để đổi theme?', 'テーマを変えるために再起動しますか？'),
      t(
        'City Crew will close and open again in the new colours.',
        'City Crew sẽ đóng và mở lại với màu mới.',
        'City Crew が閉じて、新しい色で開き直します。',
      ),
      [
        { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
        { text: t('Restart', 'Khởi động lại', '再起動'), onPress: () => setPref(id) },
      ],
    );
  };
  const insets = useSafeAreaInsets();
  // The house entrance (SaveSheet's, via PersonSheet): the modal only
  // fades — the scrim brightens in place — while the sheet alone rises
  // on a native-driven spring. See CitySwitcher for the longer note.
  // It matters most here of the three: the whole screen repaints behind
  // this sheet, and the calmer the sheet's own motion, the more that
  // repaint reads as the event.
  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }],
        }]}
      >
        <View style={s.handle} />
        <Text style={s.title}>{t('Theme', 'Theme', 'テーマ')}</Text>
        {options.map((o, i) => {
          const active = o.id === pref;
          return (
            <View key={o.id}>
              {i > 0 && <View style={s.sep} />}
              <PressableScale
                haptic="selection"
                style={[s.row, active && s.rowOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                // The sheet stays open — see the note in the header.
                onPress={() => choose(o.id)}
              >
                <Ionicons name={o.icon} size={18} color={active ? colors.accent : colors.textTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, active && { color: colors.accent }]}>
                    {schemeLabel(o.id, t)}
                  </Text>
                  {o.id === 'system' && (
                    <Text style={s.rowNote}>{systemNow(scheme, t)}</Text>
                  )}
                  {!active && needsRestart(look, o.id) && (
                    <Text style={s.rowNote}>{t('Restarts the app', 'Ứng dụng sẽ khởi động lại', 'アプリが再起動します')}</Text>
                  )}
                </View>
                {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </PressableScale>
            </View>
          );
        })}
        <PressableScale onPress={onClose} accessibilityRole="button" style={s.done}>
          <Text style={s.doneText}>{t('Done', 'Xong', '完了')}</Text>
        </PressableScale>
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
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 12,
  },
  // The city sheet's own material for "this is the special one".
  rowOn: { backgroundColor: colors.accentSoft, borderRadius: radius.card - 6 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: font.medium },
  rowNote: { color: colors.textTertiary, fontSize: 13, fontWeight: font.regular, marginTop: 2 },
  // `marginVertical`, and it is the whole reason this line is visible.
  //
  // Without it the hairline sits flush against the next row, which is fine
  // between two plain ones and invisible against the selected pill: an 8%
  // hairline touching the top edge of an `accentSoft` fill reads as the
  // pill's own border, not as a divider. The language sheet got away with
  // it because its selected row is usually the first, so its dividers fall
  // between plain rows; the appearance sheet has three rows and two
  // dividers, and whichever row is chosen at least one divider hugs the
  // pill — Auto, the default, has one on its underside from first launch.
  //
  // Three points either side is enough to put sheet colour between the
  // line and the fill, and small enough that the rhythm between plain rows
  // does not change.
  sep: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginHorizontal: 4, marginVertical: 3,
  },
  done: { paddingVertical: 12, marginTop: 4, alignSelf: 'center' },
  doneText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },
});
