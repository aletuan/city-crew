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
// - `scrim`: dark (0.62, the default) or clear. Clear is for a sheet whose
//   page is the preview — the cover sheets put the tapped photograph on
//   the cover above them, so the page must not dim. Still a press: a tap
//   above the sheet closes it.
// - `rise`: the spring up from 360pt under, which the menus have had
//   since `PersonSheet`. The cover sheets came in with the fade alone and
//   keep it until someone decides otherwise.
// - `maxHeight`, `foot` (what is left under the last line, over the
//   inset), `grabberGap` and `style` for the panel: the measured
//   differences between the sheets that exist, kept rather than
//   flattened, so moving a sheet here changes nothing on screen.
//
// Moved here so far: `ActionSheet`, `CollectionCoverSheet`, `person/Wall`.

import React, { useEffect, useRef } from 'react';
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
  scrim = true, rise = true, maxHeight, foot = 16, grabberGap = 12, style,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** A title over the body, centred, with a ✕ at the right. */
  title?: string;
  closeTestID?: string;
  testID?: string;
  scrim?: boolean;
  rise?: boolean;
  maxHeight?: ViewStyle['maxHeight'];
  foot?: number;
  grabberGap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const up = useRef(new Animated.Value(rise ? 1 : 0)).current;
  useEffect(() => {
    if (!rise) return;
    if (!visible) { up.setValue(1); return; }
    Animated.spring(up, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise, up]);
  const close = t('Close', 'Đóng', '閉じる', '关闭', '關閉');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[s.backdrop, scrim && s.dim]} onPress={onClose} accessibilityLabel={close} />
      <Animated.View
        style={[s.panel, { paddingBottom: insets.bottom + foot, maxHeight }, style, rise && {
          transform: [{ translateY: up.interpolate({ inputRange: [0, 1], outputRange: [0, 360] }) }],
        }]}
        testID={testID}
      >
        <View style={[s.grabber, { marginBottom: grabberGap }]} />
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
  dim: { backgroundColor: SHEET_SCRIM },
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
