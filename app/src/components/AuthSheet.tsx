// The sign-in invitation, as a bottom sheet.
//
// It used to be a card pinned under the places list, where it was only
// found by scrolling to the end of a feed that has no end. As a sheet it
// arrives when someone reaches for the profile control — asked for, rather
// than parked in the way.
//
// It is only ever raised by a reach for something, so its title names
// that thing, and nothing else is said. It used to carry one title for
// every reason ("Save places you love") and a line below it on what an
// account is for; a reader who had tapped a heart met a sentence about
// saving places, and five ways in read as one sheet. The line went with
// the shared title. What they reached for already says why, and a
// sentence under it was one more thing to read before the button.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import type { SignInWhy } from '../lib/save';
import { colors, display, font, gradAI, space } from '../theme';
import { PressableScale } from './ui';

type T = (en: string, vi: string, ja: string) => string;

/**
 * What each reason says, and the glyph it wears.
 *
 * The glyph is the one on the control that opened the sheet, so the two
 * read as one object. The saved filter wears `bookmarks`, not the single
 * bookmark it shows on the map: the sheet is about the whole set of saved
 * places, and one bookmark would read as saving one more.
 */
const REASONS: Record<SignInWhy, { icon: 'bookmark' | 'heart' | 'copy' | 'bookmarks' | 'search'; title: (t: T) => string }> = {
  save: { icon: 'bookmark', title: (t) => t('Save this place', 'Lưu địa điểm này', 'このスポットを保存') },
  like: { icon: 'heart', title: (t) => t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね') },
  copy: { icon: 'copy', title: (t) => t('Save a copy to your account', 'Lưu bản sao về tài khoản', 'コピーを自分のアカウントに保存') },
  saved: { icon: 'bookmarks', title: (t) => t('See the places you saved', 'Xem địa điểm đã lưu', '保存したスポットを見る') },
  search: { icon: 'search', title: (t) => t('Find new places on Google Maps', 'Tìm địa điểm mới trên Google Maps', 'Google マップで新しいスポットを探す') },
};

export default function AuthSheet({ visible, why = 'save', onClose, onSignIn }: {
  visible: boolean;
  /** What was reached for — see `SignInWhy`. */
  why?: SignInWhy;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const { t } = useI18n();
  const reason = REASONS[why];
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
          <Ionicons name={reason.icon} size={28} color={colors.accent} />
        </View>
        <Text style={s.title}>{reason.title(t)}</Text>
        {/* The width has to go on the Pressable itself (containerStyle), not
            on the animated child: the sheet centres its children, so an
            un-stretched Pressable shrink-wraps the label and "100%" inside
            it then resolves against that shrunken box. */}
        <PressableScale
          onPress={onSignIn}
          accessibilityRole="button"
          containerStyle={{ alignSelf: 'stretch' }}
        >
          <LinearGradient {...gradAI} style={s.primary}>
            {/* Both words: a reader without an account reads "Sign in" as
                a door for somebody else. */}
            <Text style={s.primaryText}>{t('Sign in / Sign up', 'Đăng nhập / Đăng ký', 'サインイン / 登録')}</Text>
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
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
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
  // The margin below is the one the explanation line used to hold: the
  // title now sits straight over the button and needs the same air.
  title: {
    color: colors.text, fontSize: 22, fontFamily: display.bold,
    textAlign: 'center', marginTop: 4, marginBottom: 6,
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
