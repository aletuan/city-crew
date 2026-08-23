// The sheet that opens on a person's ⋯ — who they are, then what you
// can do about it.
//
// It replaces a stacked Alert, and the reason is not decoration. An
// alert menu gives every choice the same voice: three lines of bare
// verbs, no faces, no consequences, and on iOS the destructive ones
// turn red together so "Unfriend" and "Block" look like the same act.
// They are not. One is a quiet exit, the other is a door that stays
// shut, and a reader deserves to see which is which *before* pressing,
// not after.
//
// So: a card naming the person at the top — because a menu about
// somebody should say who — and rows carrying an icon and a sentence
// each, in the app's own sheet idiom (see SaveSheet, whose backdrop,
// spring and grabber this borrows so the two feel like one app).
//
// The confirmation that follows a destructive choice stays a system
// dialog on purpose. That is what iOS readers expect at the moment of
// no return, and it is the one place a native alert is the right
// instrument rather than the lazy one.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, PressableScale } from './ui';
import { useI18n } from '../lib/i18n';
import { colors, display, font, radius, space } from '../theme';

export type PersonAction = {
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

export default function PersonSheet({
  visible, name, meta, avatarUrl, actions, onClose,
}: {
  visible: boolean;
  name: string;
  /** The line under the name — handle, and what you have in common. */
  meta?: string;
  avatarUrl?: string;
  actions: PersonAction[];
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

        {/* Who this is about. A menu that names nobody is a menu you have
            to trust you opened on the right row. */}
        <View style={s.who}>
          <Avatar url={avatarUrl} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
          </View>
        </View>

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

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.62)' },
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

  who: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: space.cardPadding,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
  },
  name: { color: colors.text, fontSize: 18, fontFamily: display.semibold },
  meta: { color: colors.textTertiary, fontSize: 14 },

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
