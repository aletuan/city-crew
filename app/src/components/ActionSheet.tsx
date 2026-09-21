// The sheet that opens on a ⋯ — a thing named at the top, then what you
// can do about it.
//
// This is the chrome `PersonSheet` was built with, lifted out so a sheet
// about a photograph can wear it too. The reasoning that put it there
// still holds and is repeated here because it decides the shape: an
// alert menu gives every choice the same voice — bare verbs, no faces,
// no consequences, and on iOS the destructive ones turn red together so
// two different acts look like one. A row here carries an icon, a title
// and a sentence saying what will actually happen, and the thing the
// menu is about is drawn above the rows so nobody has to trust they
// opened it on the right one.
//
// What is generic is the backdrop, the spring, the grabber and the rows.
// What is not is the header: a person is a face and a handle, a
// photograph is a thumbnail and where it came from, and the sheet takes
// that as a node rather than guessing at a shape that fits both.
//
// The confirmation that follows a destructive choice stays a system
// dialog, raised from the row's own `onPress` once this sheet has gone —
// see the timing note on the row.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from './ui';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space } from '../theme';

export type SheetAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** What it will actually do, in a sentence. The half an alert menu
   *  cannot carry, and the half that tells two red rows apart. */
  desc: string;
  /** Draws the row in the warning colour. Cosmetic only — whether a
   *  choice asks again is the caller's business, and the callers that
   *  do ask raise their dialog from inside `onPress`, once this sheet
   *  has closed. */
  destructive?: boolean;
  onPress: () => void;
};

export default function ActionSheet({ visible, header, actions, onClose }: {
  visible: boolean;
  /** What the menu is about, drawn above the rows. */
  header: React.ReactNode;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
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
          paddingBottom: insets.bottom + 16,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 360] }) }],
        }]}
      >
        <View style={s.grabber} />

        {header}

        <View style={s.group}>
          {actions.map((a, i) => (
            <PressableScale
              key={a.key}
              style={[s.row, i > 0 && s.rowDivider]}
              scaleTo={0.985}
              // The sheet goes first, always. A dialog raised over a
              // sheet that is still animating out is the stacked-modal
              // bug every platform has its own version of.
              onPress={() => { onClose(); setTimeout(a.onPress, 220); }}
              accessibilityRole="button"
              accessibilityLabel={a.title}
              accessibilityHint={a.desc}
            >
              <View style={[s.mark, a.destructive && s.markBad]}>
                <Ionicons
                  name={a.icon}
                  size={20}
                  color={a.destructive ? colors.bad : colors.text}
                />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.rowTitle, a.destructive && s.rowTitleBad]}>{a.title}</Text>
                <Text style={s.rowDesc}>{a.desc}</Text>
              </View>
            </PressableScale>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

/** The card a sheet's header is drawn on, shared so the two headers
 *  that exist sit on the same surface as the rows beneath them. */
export const sheetHeader = {
  flexDirection: 'row', alignItems: 'center', gap: 14,
  padding: space.cardPadding,
  backgroundColor: colors.surfaceCard,
  borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
} as const;

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
    gap: 12,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: colors.textTertiary, marginBottom: 2,
  },

  group: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  // The same box the settings rows wear, in neutral rather than coral:
  // these are not places to go, they are things to do, and one of them
  // is a thing to be careful about.
  mark: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  markBad: { backgroundColor: colors.badSoft },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  rowTitleBad: { color: colors.bad },
  rowDesc: { color: colors.textTertiary, fontSize: 13.5, lineHeight: 18 },
});
