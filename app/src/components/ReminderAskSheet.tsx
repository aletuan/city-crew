// The sheet that explains trip reminders before the phone asks for them
// (owner, 21 Nov 2026).
//
// iOS asks for notifications once. Raised cold — which is what the first
// save of a plan or the first yes to an invitation did — the phone's sheet
// has no context, and a reflex on "Don't Allow" is a no that can only be
// undone in Settings. So the app asks first, in words, after the thing the
// reminders are for has just happened. "Not now" costs nothing: the phone
// has not been asked, and the next save offers this again.
//
// ── after the save, not before it ──
//
// Raised once the save or the yes has succeeded, over the screen that
// shows the trip, so it never stands between the reader and what they came
// to do, and the reason is in front of them: this trip was just made.
// Rejected: asking before the save. A question in the middle of a task is
// an interruption, and a "later" there would leave the task half done.
//
// ── the phone's sheet waits for this one to go ──
//
// iOS will not present one view controller while another is dismissing:
// raised in the same tick as the close, the permission sheet never shows
// and its promise never settles (see `AvatarPicker`, which learned this
// with the camera). So "Turn on" closes first, and the phone is asked from
// the Modal's own `onDismiss`, with a timer where that callback does not
// exist.

import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Glyph, ICON } from './ui/glyph';
import { CONTROL_H, PressableScale, SECONDARY_CONTROL_H, Sheet } from './ui';
import { useI18n } from '../lib/i18n';
import { closeReminderAsk, useReminderAsk } from '../lib/reminderAsk';
import { useReminderPref } from '../lib/reminderPref';
import { colors, font, radius, space, type } from '../theme';

/** The iOS fade is 300 ms; this is that and a margin, for platforms with
 *  no `onDismiss` to say the sheet has gone. */
const DISMISS_MS = 350;

export default function ReminderAskSheet() {
  const { t } = useI18n();
  const visible = useReminderAsk();
  const { setOn } = useReminderPref();
  // Set by "Turn on", spent by whichever of `onDismiss` and the timer
  // comes first, so the phone is asked once.
  const agreed = useRef(false);
  const flush = () => {
    if (!agreed.current) return;
    agreed.current = false;
    void setOn(true);
  };
  const turnOn = () => {
    agreed.current = true;
    closeReminderAsk();
    if (Platform.OS !== 'ios') setTimeout(flush, DISMISS_MS);
  };

  return (
    <Sheet
      visible={visible}
      onClose={closeReminderAsk}
      onDismiss={flush}
      pull="sheet"
      riseFrom={320}
      foot={14}
      style={s.sheet}
      backdropLabel={t('Not now', 'Để sau', 'あとで', '以后再说', '以後再說')}
    >
      <View style={s.well}>
        <Glyph name="notifications-outline" size={ICON.action} color={colors.accent} />
      </View>
      <Text style={s.title} accessibilityRole="header">
        {t('Get a nudge before your trip', 'Nhắc bạn trước chuyến đi', '旅程の前にお知らせ', '行程前提醒你', '行程前提醒你')}
      </Text>
      <Text style={s.body}>
        {t(
          'The evening before, and two hours ahead of the first stop, your phone will remind you. Only for trips you are going on.',
          'Tối hôm trước và 2 giờ trước điểm đầu tiên, điện thoại sẽ nhắc bạn. Chỉ nhắc các chuyến bạn đi.',
          '前日の夜と、最初の予定の2時間前にお知らせします。参加する旅程のみです。',
          '行程前一晚和第一站前两小时，手机会提醒你。只提醒你要去的行程。',
          '行程前一晚和第一站前兩小時，手機會提醒你。只提醒你要去的行程。',
        )}
      </Text>
      <PressableScale onPress={turnOn} haptic="selection" accessibilityRole="button" contentStyle={s.primary} testID="reminder-ask-on">
        <Text style={s.primaryText}>{t('Turn on reminders', 'Bật nhắc nhở', 'リマインダーをオン', '开启提醒', '開啟提醒')}</Text>
      </PressableScale>
      <PressableScale onPress={closeReminderAsk} haptic="selection" accessibilityRole="button" contentStyle={s.later} testID="reminder-ask-later">
        <Text style={s.laterText}>{t('Not now', 'Để sau', 'あとで', '以后再说', '以後再說')}</Text>
      </PressableScale>
    </Sheet>
  );
}

const s = StyleSheet.create({
  // The settings sheets' inner margin and the 8 above the grabber; the
  // rest of the chrome is `Sheet`'s.
  sheet: { paddingHorizontal: space.cardPadding, paddingTop: 8 },
  well: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: font.semibold, marginBottom: 6 },
  body: { color: colors.textSecondary, ...type.body, marginBottom: 16 },
  primary: {
    alignItems: 'center', justifyContent: 'center', minHeight: CONTROL_H, borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  primaryText: { color: colors.bg, ...type.body, fontWeight: font.semibold },
  later: { alignItems: 'center', justifyContent: 'center', minHeight: SECONDARY_CONTROL_H, marginTop: 4 },
  laterText: { color: colors.textSecondary, ...type.body, fontWeight: font.medium },
});
