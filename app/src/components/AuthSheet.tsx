// The sign-in invitation, as a bottom sheet.
//
// It used to be a card pinned under the places list, where it was only
// found by scrolling to the end of a feed that has no end. As a sheet it
// arrives when someone reaches for the profile control — asked for, rather
// than parked in the way.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { colors, display, font, gradAI, radius, space } from '../theme';
import { PressableScale } from './ui';

export default function AuthSheet({ visible, onClose, onSignIn }: {
  visible: boolean;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Modal's own fade carries the backdrop; the panel gets a spring of its
  // own so it rises like a sheet instead of appearing all at once.
  const rise = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Tapping the dimmed area dismisses — the same escape as "Not now". */}
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: insets.bottom + 22, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }] },
        ]}
      >
        <View style={s.grabber} />
        <View style={s.badge}>
          <Ionicons name="heart" size={28} color={colors.accent} />
        </View>
        <Text style={s.title}>
          {t('Save places you love', 'Lưu những nơi bạn thích', 'お気に入りを保存')}
        </Text>
        <Text style={s.body}>
          {t(
            'Sign in to keep favourites and build collections with your crew.',
            'Đăng nhập để giữ địa điểm yêu thích và dựng bộ sưu tập cùng hội của bạn.',
            'サインインしてお気に入りを保存し、仲間とコレクションを作りましょう。',
          )}
        </Text>
        <PressableScale onPress={onSignIn} accessibilityRole="button" style={{ width: '100%' }}>
          <LinearGradient {...gradAI} style={s.primary}>
            <Text style={s.primaryText}>{t('Sign in', 'Đăng nhập', 'サインイン')}</Text>
          </LinearGradient>
        </PressableScale>
        <PressableScale onPress={onClose} accessibilityRole="button" style={s.secondary}>
          <Text style={s.secondaryText}>{t('Not now', 'Để sau', '今はしない')}</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 12,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: colors.textTertiary, marginBottom: 14,
  },
  badge: {
    width: 66, height: 66, borderRadius: 33,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentLine,
  },
  title: { color: colors.text, fontSize: 22, fontFamily: display.bold, marginTop: 4 },
  body: {
    color: colors.textSecondary, fontSize: 15, lineHeight: 21,
    textAlign: 'center', paddingHorizontal: 8, marginBottom: 6,
  },
  // A rounded rectangle, not a pill. The reference draws it this way and
  // it is the right call at full width: a pill's end caps grow with its
  // height, so a wide one reads as a lozenge floating in the sheet rather
  // than as the block the sheet is asking you to press.
  primary: {
    borderRadius: 18, paddingVertical: 17, alignItems: 'center', width: '100%',
  },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: font.semibold },
  secondary: { paddingVertical: 12 },
  secondaryText: { color: colors.textSecondary, fontSize: 15.5, fontWeight: font.medium },
});
