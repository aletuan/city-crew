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
// identical marks carried none. And it stays open on a choice: choosing
// a ground repaints the whole screen behind the sheet, which is the one
// moment both readings can be seen against each other — closing on the
// tap would hide the result of the tap. A bottom sheet makes that view
// better, not worse: everything above it is the screen repainting.
//
// It had a "Done" for leaving, and lost it on 11 Oct 2026. The owner asked
// whether it was needed, and it no longer was: a look closes the sheet
// itself on the way to its restart, and from inside a look every row is
// one; only the three grounds, from the standard look, repaint in place,
// and the dimmed screen above the sheet closes it there — it is labelled
// "Close" for VoiceOver, so nobody is left without a way out.
//
// FIVE ROWS since 10 Oct 2026: the standard three, then Coffee and Rose,
// which are looks rather than grounds (`lib/look.ts`). Those cannot
// repaint in place — the colours are built at launch — so choosing one
// asks first and restarts the app; the sheet says so before the tap,
// rather than surprising anyone with a relaunch. Where a look cannot be
// kept (the web build) they are not offered at all.
//
// NINE since 11 Oct 2026, when Blush, Slate, Midnight and Navy came in,
// and nine rows of 67pt do not fit a sheet on an iPhone SE. So the looks
// moved into a grid of two, each card a swatch drawn in the look's own
// page, type, pill and fill — the one thing a name like "Xanh than" next
// to "Xanh navy" could not say. The restart note moved with them, once,
// over the grid, since it is true of every card but the one being worn;
// the standard rows keep theirs on the row, where it is true of them only
// from inside a look.

import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { lookOf, needsRestart, PINNED, type Pinned } from '../lib/look';
import { Pref, Scheme, useScheme } from '../lib/theme';
import { colors, font, PALETTES, radius, space } from '../theme';
import { PressableScale } from './ui';

const OPTIONS: { id: Pref; icon: keyof typeof Ionicons.glyphMap }[] = [
  // The phone's own mark for "this device" — the same glyph iOS uses in
  // its Display settings, and the one row of the three whose icon names
  // a place rather than a time of day.
  { id: 'system', icon: 'phone-portrait-outline' },
  { id: 'dark', icon: 'moon-outline' },
  { id: 'light', icon: 'sunny-outline' },
  // The looks name what they are of: a cup for the coffee brown, a
  // flower for the rose, a heart for the blush, a cloud for the slate
  // grey, a star for the midnight sky, a boat for the navy.
  { id: 'coffee', icon: 'cafe-outline' },
  { id: 'rose', icon: 'flower-outline' },
  { id: 'blush', icon: 'heart-outline' },
  { id: 'slate', icon: 'cloud-outline' },
  { id: 'midnight', icon: 'star-outline' },
  { id: 'navy', icon: 'boat-outline' },
];

const isLook = (id: Pref): id is Pinned => Object.prototype.hasOwnProperty.call(PINNED, id);

type T = (en: string, vi: string, ja?: string) => string;

/**
 * How long the sheet is given to leave before the restart is asked for.
 *
 * The restart is asked for only once the sheet is gone. On 10 Oct 2026
 * the owner pressed Restart on a phone and nothing happened: the sheet was
 * still presented, the new look was kept (the next cold start wore it),
 * and the app did not relaunch. The restart had been asked for from
 * inside a presented modal, with the alert itself still dismissing over
 * it. So the sheet closes first, and the restart waits for the Modal's
 * own `onDismiss`. This is the iOS fade's 300 ms plus a margin, kept as
 * a backstop in case that callback never comes.
 */
const DISMISS_MS = 450;

/**
 * How long the JavaScript can still be running after the restart was asked
 * for before it is safe to say the restart did not happen. A relaunch tears
 * this timer down with everything else, so the note below shows only when
 * there is nothing else left to try: `reloadAsync` refused or queued
 * forever, and `DevSettings.reload` is a no-op in a release build.
 */
const STUCK_MS = 3000;

/** The glyph for a setting, as Profile's row shows it. The standard three
 *  wear the ground showing — under Auto, the one the phone picked — and
 *  the two looks their own mark. */
export function schemeIcon(pref: Pref, scheme: Scheme): keyof typeof Ionicons.glyphMap {
  if (isLook(pref)) return OPTIONS.find((o) => o.id === pref)!.icon;
  return scheme === 'light' ? 'sunny-outline' : 'moon-outline';
}

/** The label for a setting, in the app's three languages. */
export function schemeLabel(id: Pref, t: T): string {
  if (id === 'system') return t('Automatic', 'Tự động', '自動');
  if (id === 'coffee') return t('Coffee', 'Nâu cafe', 'コーヒー');
  if (id === 'rose') return t('Rose', 'Hồng', 'ローズ');
  if (id === 'blush') return t('Blush', 'Hồng phấn', 'ブラッシュ');
  if (id === 'slate') return t('Slate', 'Xanh xám', 'スレート');
  if (id === 'midnight') return t('Midnight', 'Xanh than', 'ミッドナイト');
  if (id === 'navy') return t('Navy', 'Xanh navy', 'ネイビー');
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

/**
 * A look, drawn small in its own colours: its page, a line of its type and
 * a shorter one of its secondary, its tab pill, and its fill. Plain hex
 * from `PALETTES` — this is the other look, not the one being worn, so no
 * token of the loaded look could draw it.
 */
function Swatch({ look }: { look: Pinned }) {
  const p = PALETTES[look];
  return (
    <View style={[s.swatch, { backgroundColor: p.bg }]} testID={`swatch-${look}`}>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={[s.swatchLine, { backgroundColor: p.text, width: '80%' }]} />
        <View style={[s.swatchLine, { backgroundColor: p.textSecondary, width: '50%' }]} />
      </View>
      <View style={[s.swatchPill, { backgroundColor: p.badgeSolid }]} />
      <View style={[s.swatchDot, { backgroundColor: p.accentFill }]} />
    </View>
  );
}

export function ThemeSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { scheme, pref, setPref, look, looks } = useScheme();
  const grounds = OPTIONS.filter((o) => lookOf(o.id) === 'standard');
  const palettes = looks ? OPTIONS.filter((o) => isLook(o.id)) : [];
  // What the sheet may take before its list scrolls: the window less the
  // status bar's inset and the sheet's own chrome — handle, title and the
  // home indicator, about 100pt. On every phone this ships to the nine
  // fit without it; it is there for the largest text sizes.
  const { height } = useWindowDimensions();
  // A row that changes the look restarts the app, which loses whatever
  // screen the reader was on; it is asked once, here, and nowhere else.
  // The choice waits in `pending` while the sheet leaves (see DISMISS_MS);
  // whichever of `onDismiss` and the backstop comes first sends it, once.
  const pending = useRef<Pref | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const relaunch = () => {
    const id = pending.current;
    if (!id) return;
    pending.current = null;
    setPref(id);
    timers.current.push(setTimeout(() => Alert.alert(
      t('Close and reopen City Crew', 'Hãy đóng và mở lại City Crew', 'City Crew を閉じて開き直してください'),
      t(
        'The new theme is saved, and appears the next time the app opens.',
        'Theme mới đã được lưu, và sẽ hiện ra ở lần mở app tiếp theo.',
        '新しいテーマは保存されました。次にアプリを開いたときに反映されます。',
      ),
    ), STUCK_MS));
  };
  const agree = (id: Pref) => {
    pending.current = id;
    onClose();
    timers.current.push(setTimeout(relaunch, DISMISS_MS));
  };
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
        { text: t('Restart', 'Khởi động lại', '再起動'), onPress: () => agree(id) },
      ],
    );
  };
  const insets = useSafeAreaInsets();
  const room = Math.max(height - insets.top - insets.bottom - 100, 240);
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={relaunch} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }],
        }]}
      >
        <View style={s.handle} />
        <Text style={s.title}>{t('Theme', 'Theme', 'テーマ')}</Text>
        <ScrollView style={{ maxHeight: room }} bounces={false} showsVerticalScrollIndicator={false}>
        {grounds.map((o, i) => {
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
        {palettes.length > 0 && (
          <>
            <Text style={s.section}>{t('Colours', 'Bảng màu', 'カラー')}</Text>
            <Text style={s.sectionNote}>
              {t('Changing these restarts the app', 'Đổi bảng màu sẽ khởi động lại ứng dụng', 'カラーを変えるとアプリが再起動します')}
            </Text>
            <View style={s.grid}>
              {palettes.map((o) => {
                const active = o.id === pref;
                return (
                  <PressableScale
                    key={o.id}
                    haptic="selection"
                    containerStyle={s.cardCell}
                    style={[s.card, active && s.rowOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => choose(o.id)}
                  >
                    <Swatch look={o.id as Pinned} />
                    <View style={s.cardLabel}>
                      <Ionicons name={o.icon} size={16} color={active ? colors.accent : colors.textTertiary} />
                      <Text style={[s.cardTitle, active && { color: colors.accent }]} numberOfLines={1}>
                        {schemeLabel(o.id, t)}
                      </Text>
                      {active && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </>
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
  section: {
    color: colors.text, fontSize: 15, fontWeight: font.semibold,
    marginTop: 14, paddingHorizontal: 4,
  },
  sectionNote: {
    color: colors.textTertiary, fontSize: 13, fontWeight: font.regular,
    marginTop: 2, marginBottom: 10, paddingHorizontal: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Two to a line: half the row less half the gap between.
  cardCell: { width: '48.5%' },
  card: { padding: 8, borderRadius: radius.card - 6, backgroundColor: colors.surfaceGlass },
  cardLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, paddingHorizontal: 2, minHeight: 28 },
  cardTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: font.medium },
  // A neutral hairline, half-grey, because the swatch is a pale page on a
  // dark sheet as often as a dark page on a pale one, and has to stand out
  // from either. Plain rgba, not a token: a token here would be the look
  // being worn, not the look being drawn.
  swatch: {
    height: 52, borderRadius: radius.card - 10, flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(128,128,128,0.35)',
  },
  swatchLine: { height: 5, borderRadius: 2.5 },
  swatchPill: { width: 26, height: 18, borderRadius: 9 },
  swatchDot: { width: 18, height: 18, borderRadius: 9 },
});
