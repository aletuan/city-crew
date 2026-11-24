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

import React from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useI18n } from '../lib/i18n';
import type { SignInWhy } from '../lib/save';
import { useScheme } from '../lib/theme';
import { colors, display, font, gradAI, labelScaleCap } from '../theme';
import { CONTROL_H, PressableScale, Sheet, useNarrowWindow } from './ui';
import artDark from '../../assets/signin-art-dark.webp';
import artLight from '../../assets/signin-art-light.webp';

type T = (en: string, vi: string, ja: string, zh?: string, hant?: string) => string;

/** What each reason says: the thing that was reached for, by name. */
const TITLES: Record<SignInWhy, (t: T) => string> = {
  save: (t) => t('Save this place', 'Lưu địa điểm này', 'このスポットを保存', '保存这个地点', '儲存這個地點'),
  like: (t) => t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね', '点赞这个合集', '按讚這個合集'),
  copy: (t) => t('Save a copy to your account', 'Lưu bản sao về tài khoản', 'コピーを自分のアカウントに保存', '保存副本到你的账号', '儲存副本到你的帳號'),
  saved: (t) => t('See the places you saved', 'Xem địa điểm đã lưu', '保存したスポットを見る', '查看你保存的地点', '檢視你儲存的地點'),
  search: (t) => t('Find new places on Google Maps', 'Tìm địa điểm mới trên Google Maps', 'Google マップで新しいスポットを探す', '在 Google 地图上发现新地点', '在 Google 地圖上發現新地點'),
  trip: (t) => t('Save this trip', 'Lưu chuyến đi này', 'この旅程を保存', '保存这个行程', '儲存這個行程'),
  start: (t) => t('Find a starting point', 'Tìm điểm xuất phát', '出発地を探す', '寻找出发地点', '尋找出發地點'),
  checkin: (t) => t('Check in here', 'Check-in ở đây', 'ここにチェックイン', '在这里打卡', '在這裡打卡'),
  comment: (t) => t('Join the conversation', 'Tham gia bình luận', 'コメントに参加', '参与评论', '參與評論'),
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
  return (
    // Tapping the dimmed area dismisses — the same escape as "Not now".
    <Sheet visible={visible} onClose={onClose} riseFrom={320} foot={22} grabberGap={14} style={s.sheet}>
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
      {/* The width has to go on the Pressable itself (`style`), not
          on the animated child: the sheet centres its children, so an
          un-stretched Pressable shrink-wraps the label and "100%" inside
          it then resolves against that shrunken box. */}
      <PressableScale
        onPress={onSignIn}
        testID="auth-sheet-sign-in"
        accessibilityRole="button"
        style={{ alignSelf: 'stretch' }}
      >
        <LinearGradient {...gradAI} style={s.primary}>
          {/* Both words: a reader without an account reads "Sign in" as
              a door for somebody else. */}
          <Text style={s.primaryText}>{t('Sign in / Sign up', 'Đăng nhập / Đăng ký', 'サインイン / 登録', '登录 / 注册', '登入 / 註冊')}</Text>
        </LinearGradient>
      </PressableScale>
      <PressableScale testID="auth-sheet-cancel" onPress={onClose} accessibilityRole="button" contentStyle={s.secondary}>
        <Text style={s.secondaryText}>{t('Not now', 'Để sau', 'あとで', '以后再说', '以後再說')}</Text>
      </PressableScale>
    </Sheet>
  );
}

const s = StyleSheet.create({
  // The panel centres its children: the art, the title, two buttons.
  sheet: { alignItems: 'center', gap: 12 },
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
    borderRadius: 18, minHeight: CONTROL_H, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', width: '100%',
  },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: font.semibold },
  secondary: { paddingVertical: 12 },
  secondaryText: { color: colors.textSecondary, fontSize: 16, fontWeight: font.medium },
});
