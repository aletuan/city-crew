// A line on a saved trip saying the phone will not remind the reader of it.
//
// Account has a row for trip reminders (`screens/profile/RemindRow`), but
// nobody goes to Account to look for a reminder that is missing. The place
// they notice is the trip, on the evening it did not come — so the trip
// says so itself, and the line is the way to fix it: one press into the
// app's page in iOS Settings, where the permission lives.
//
// ── only where iOS has said no ──
//
// Not when the reader switched reminders off themselves (they know) and not
// when the permission was never asked (the sheet is still to come, on the
// save or the yes). Blocked is the one state a reader cannot get out of
// from inside the app, and the one they do not know they are in: a denial
// is a tap on a sheet weeks ago.
//
// ── for the planner and for whoever said yes ──
//
// `remindsAhead` is the same rule the sync plants by, so the line appears
// exactly where a reminder would have been planted and nowhere else: not
// on an invitation not yet answered, not on a trip already over.

import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { Glyph, ICON } from './ui/glyph';
import { PressableScale, SECONDARY_CONTROL_H } from './ui';
import { useI18n } from '../lib/i18n';
import { remindsAhead } from '../lib/remind';
import { useReminderPref } from '../lib/reminderPref';
import { colors, font, radius, space } from '../theme';

export default function TripReminderNote({ trip, invites, me }: {
  trip: Parameters<typeof remindsAhead>[0];
  invites: Parameters<typeof remindsAhead>[1];
  me: string | null;
}) {
  const { t } = useI18n();
  const { state } = useReminderPref();
  if (state !== 'blocked' || !remindsAhead(trip, invites, me, new Date())) return null;
  return (
    <PressableScale
      onPress={() => { Linking.openSettings().catch(() => {}); }}
      contentStyle={s.note}
      accessibilityRole="button"
      testID="trip-reminder-note"
    >
      <Glyph name="notifications-off-outline" size={ICON.text} color={colors.warnInk} />
      <Text style={s.text}>
        {t(
          'Your phone won’t remind you about this trip.',
          'Điện thoại sẽ không nhắc bạn về chuyến đi này.',
          'この旅程のリマインダーは届きません。',
          '手机不会提醒你这个行程。',
          '手機不會提醒你這個行程。',
        )}
      </Text>
      <Text style={s.act}>{t('Turn on', 'Bật', 'オンにする', '开启', '開啟')}</Text>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  note: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: SECONDARY_CONTROL_H, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.card, backgroundColor: colors.warnSoft, marginBottom: space.cardGap,
  },
  text: { flex: 1, color: colors.warnInk, fontSize: 13, fontWeight: font.regular },
  act: { color: colors.warnInk, fontSize: 13, fontWeight: font.semibold },
});
