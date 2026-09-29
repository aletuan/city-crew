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
//
// Above the title, the two cats and the paper plane: the illustration
// Ideas opens on, here as the app's face at the moment it asks
// something of the reader. It replaced a glyph in a ring that matched
// the control tapped (a bookmark, a heart). Two marks competing over
// one short title made the sheet taller for nothing, and the title now
// names the control in words.
//
// The files are transparent, keyed against this sheet's colour rather
// than the page's (`scripts/signin-art.py`): the renders came on a
// cream and a near-black that match neither sheet, and unkeyed the day
// read as a card laid on a white sheet. Under Display Zoom or large
// Dynamic Type the painting goes, as the Ideas header's does: 150pt of
// decoration is the room the title and the buttons need there.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import type { SignInWhy } from '../lib/save';
import { useScheme } from '../lib/theme';
import { colors, display, font, gradAI, labelScaleCap, space } from '../theme';
import { PressableScale, useNarrowWindow } from './ui';
import artDark from '../../assets/signin-art-dark.webp';
import artLight from '../../assets/signin-art-light.webp';

type T = (en: string, vi: string, ja: string) => string;

/** What each reason says: the thing that was reached for, by name. */
const TITLES: Record<SignInWhy, (t: T) => string> = {
  save: (t) => t('Save this place', 'Lưu địa điểm này', 'このスポットを保存'),
  like: (t) => t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね'),
  copy: (t) => t('Save a copy to your account', 'Lưu bản sao về tài khoản', 'コピーを自分のアカウントに保存'),
  saved: (t) => t('See the places you saved', 'Xem địa điểm đã lưu', '保存したスポットを見る'),
  search: (t) => t('Find new places on Google Maps', 'Tìm địa điểm mới trên Google Maps', 'Google マップで新しいスポットを探す'),
};

/** Width over height of both files (900×471). */
export const ART_ASPECT = 900 / 471;
/**
 * The painting's height, in points. The ring it replaced was 66; this is
 * what the cats need to read as cats rather than as a pattern, and it
 * leaves the sheet under half of a 667pt screen with a title on two
 * lines. It is 287pt wide, inside the 335pt a 375pt window has between
 * the page margins.
 */
export const ART_HEIGHT = 150;

export default function AuthSheet({ visible, why = 'save', onClose, onSignIn }: {
  visible: boolean;
  /** What was reached for — see `SignInWhy`. */
  why?: SignInWhy;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const { t } = useI18n();
  const { scheme } = useScheme();
  const { fontScale } = useWindowDimensions();
  const narrow = useNarrowWindow();
  const painted = !narrow && fontScale < labelScaleCap;
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
        {painted ? (
          <Image
            source={scheme === 'light' ? artLight : artDark}
            style={s.art}
            contentFit="contain"
            accessible={false}
            aria-hidden
            testID="signin-art"
          />
        ) : null}
        <Text style={s.title}>{TITLES[why](t)}</Text>
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
  art: { width: Math.round(ART_HEIGHT * ART_ASPECT), height: ART_HEIGHT },
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
