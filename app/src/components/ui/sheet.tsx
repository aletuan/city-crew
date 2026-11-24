// The sheet from below: the modal, the backdrop that closes it, the panel
// with its rounded top and hairline, the grabber, the phone's own inset at
// the foot, and — for a sheet that is about one thing — its title and ✕.
//
// ── why it is one component ──
//
// Nineteen files drew this chrome by hand, each with its own copy of the
// backdrop's colour, the panel's radius and the grabber, and the copies
// had already drifted when the code review counted them (23 Nov 2026):
// a grabber 36 wide in `borderGlass` on six sheets and 38 in
// `textTertiary` on ten, a 14pt gap under it on the menu and 12 on the
// cover sheets. Nothing was wrong with either; what was wrong was that
// nobody had chosen. A sheet built on this one has the chrome by
// construction, and a change to it is one change.
//
// The numbers are `ActionSheet`'s, the sheet the most of the app opens:
// 28 at the top corners (`radius.card` + 6, which the other family wrote
// out), a 38 × 4 grabber in `textTertiary`, the page's margin either side
// and 10 above.
//
// ── what a caller may still choose ──
//
// - `scrim`: dark (0.62, the default), clear, or as dark as a number
//   says. Clear is for a sheet whose page is the preview — the cover
//   sheets put the tapped photograph on the cover above them, so the page
//   must not dim. Still a press: a tap above the sheet closes it. The
//   start sheet keeps 0.32 (owner, 25 Nov 2026), lighter than the menus.
// - `rise`: the spring up from 360pt under, which the menus have had
//   since `PersonSheet`: the Modal only fades, so the scrim brightens in
//   place the way a room dims, and the panel alone rises on the native
//   driver. Modal's own animationType="slide" moved the whole window,
//   scrim included, and read as a wall climbing the screen. The cover
//   sheets came in with the fade alone and keep it until someone decides
//   otherwise.
// - `maxHeight`, `foot` (what is left under the last line, over the
//   inset), `grabberGap` and `style` for the panel: the measured
//   differences between the sheets that exist, kept rather than
//   flattened, so moving a sheet here changes nothing on screen.
// - `pull`: the pull-down to close (`useSheetDrag`), on the whole panel
//   (`'sheet'`) or, for a sheet whose body scrolls and keeps its own
//   gesture, on the grabber and `head` only (`'head'`). A sheet may move
//   it between the two as its height changes: the grabber and `head` sit
//   in one wrapper either way. `riseFrom` is how
//   far under the spring starts: 360 here, 320 on the settings sheets and
//   60 on the legal documents, which are 90% of the screen tall and would
//   otherwise spend the spring's first half off it.
// - `backdropLabel` and `backdropTestID`, for a sheet whose tap above it
//   means something other than "Close" (the reminder ask's "Not now"),
//   and `onDismiss`, for one that has to act once the Modal has gone.
//
// The panel is `accessibilityViewIsModal` on every sheet: VoiceOver stops
// at its edge instead of reading the dimmed page through it. Four of the
// settings sheets had it and the menus did not; nothing in a menu wants
// the page behind it read.
//
// The six settings sheets (About, the city, language and theme switchers,
// the reminder ask, the legal documents) came here on 24 Nov 2026 with
// the owner's choice of grabber: this one, 38 in `textTertiary`, not
// their 36 in `borderGlass`. They also took the hairline along the top,
// which they alone had gone without; their inner margin (16, not 22) and
// 8 above the grabber they keep through `style`.
//
// Moved here so far: `ActionSheet`, `CollectionCoverSheet`, `person/Wall`,
// the six above, and the rest of the menus — `AuthSheet`, `AvatarPicker`,
// `FriendPicker`, `SaveSheet`, `ExploreFilterSheet`.
//
// Not here, on purpose: `PhotoSheet` holds more than a sheet — a blur
// under its scrim, and the full-screen viewer in the same Modal, which
// Back closes first. And `CheckinSheet` and `CommentQuick` ride the
// keyboard. Their panel stands in a dock that the keyboard lifts, with
// its ground carried on under the keys, and the check-in's spring also
// grows its tick; that is a second kind of sheet, and three more props
// here for one caller each would make this one harder to read than the
// copy they replace.

import React, { useEffect, useRef } from 'react';
import { useSheetDrag } from '../sheetDrag';
import { Animated, Modal, Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../lib/i18n';
import { colors, display, space } from '../../theme';
import { PressableScale } from './controls';
import { Glyph, ICON } from './glyph';

/** The backdrop's dark: the page is still there, and plainly not the
 *  thing to touch. One value for every sheet that dims. */
export const SHEET_SCRIM = 'rgba(6,5,8,0.62)';

export function Sheet({
  visible, onClose, children, title, closeTestID, testID,
  scrim = true, rise = true, riseFrom = 360, maxHeight, foot = 16, grabberGap = 12, style,
  pull, head, grabTestID, backdropLabel, backdropTestID, onDismiss,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** A title over the body, centred, with a ✕ at the right. */
  title?: string;
  closeTestID?: string;
  testID?: string;
  /** Dark, clear, or this opacity of the scrim's ink. */
  scrim?: boolean | number;
  rise?: boolean;
  maxHeight?: ViewStyle['maxHeight'];
  foot?: number;
  grabberGap?: number;
  style?: StyleProp<ViewStyle>;
  riseFrom?: number;
  /** Where a pull down closes the sheet from; no pull when absent. */
  pull?: 'sheet' | 'head';
  /** What sits with the grabber in the part that can be pulled. */
  head?: React.ReactNode;
  /** The grabber-and-head part's testID, where a sheet's tests name it. */
  grabTestID?: string;
  backdropLabel?: string;
  backdropTestID?: string;
  onDismiss?: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const up = useRef(new Animated.Value(rise ? 1 : 0)).current;
  useEffect(() => {
    if (!rise) return;
    if (!visible) { up.setValue(1); return; }
    Animated.spring(up, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise, up]);
  const { drag, handlers } = useSheetDrag(visible, onClose, pull != null);
  const close = t('Close', 'Đóng', '閉じる', '关闭', '關閉');
  const moves = [
    ...(rise ? [{ translateY: up.interpolate({ inputRange: [0, 1], outputRange: [0, riseFrom] }) }] : []),
    ...(pull ? [{ translateY: drag }] : []),
  ];
  const ink = scrim === true ? SHEET_SCRIM : scrim === false ? undefined : `rgba(6,5,8,${scrim})`;
  const grabber = <View style={[s.grabber, { marginBottom: grabberGap }]} />;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss} statusBarTranslucent>
      <Pressable style={[s.backdrop, ink != null && { backgroundColor: ink }]} onPress={onClose}
        accessibilityLabel={backdropLabel ?? close} testID={backdropTestID} />
      <Animated.View
        {...(pull === 'sheet' ? handlers : null)}
        accessibilityViewIsModal
        style={[s.panel, { paddingBottom: insets.bottom + foot, maxHeight }, style, { transform: moves }]}
        testID={testID}
      >
        {/* One wrapper whether or not it is pulled, so a sheet that moves
            its pull with its height (the Explore filter) keeps its head. */}
        {head != null || pull === 'head' ? (
          <View {...(pull === 'head' ? handlers : null)} testID={grabTestID ?? (pull === 'head' ? 'sheet-grab' : undefined)}>
            {grabber}{head}
          </View>
        ) : grabber}
        {title != null ? (
          <View style={s.head}>
            <Text style={s.title}>{title}</Text>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel={close}
              hitSlop={8} style={s.close} contentStyle={s.closeFace} testID={closeTestID}>
              <Glyph name="close" size={ICON.nav} color={colors.textSecondary} />
            </PressableScale>
          </View>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary },
  head: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontFamily: display.bold },
  close: { position: 'absolute', right: 0 },
  closeFace: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
