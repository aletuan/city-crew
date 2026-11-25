// Out of `IdeasScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GradientCta } from '../../components/ui';
import { addDays, clampDay, fromISO, toISO } from '../../lib/day';
import { type Lang, useI18n } from '../../lib/i18n';
import { s } from './styles';

/** The last instant of a calendar day, for a picker bound. `fromISO` gives
 *  local noon — right for a day, half a day short of a ceiling. */
export const endOfDay = (iso: string): Date | undefined => {
  const d = fromISO(iso);
  if (!d) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
};

/** The date picker's locale for each app language — see its note. */
const PICKER_LOCALE: Record<Lang, string> = { en: 'en-GB', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-Hans-CN', 'zh-Hant': 'zh-Hant-TW' };

// The platform's own, so the gesture is the one the reader already
// knows. `display="inline"` is the iOS calendar rather than the
// wheel — this is a question about a day, and a month grid answers
// it in one glance.
export function DayPicker({ day, onClose, onPick }: {
  day: string;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const { t, lang } = useI18n();
  const now = new Date();
  /** Today at 00:00 — the picker's floor. Not `fromISO(todayISO())`, which
   *  is noon; see the picker below. */
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      {/* Named, so VoiceOver has a way out that is not "anywhere off
          the card" — the same backdrop the save and sign-in sheets
          give a label for the same reason. */}
      <Pressable
        style={s.pickScrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')}
      />
      <View style={s.pickCard}>
        <DateTimePicker
          value={fromISO(day) ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          // In the app's language, not the phone's. Left to the phone,
          // a Vietnamese screen opened "October 2026 / MON TUE…" under
          // a "Xong" button on a phone set to English (PLAN-07, 17 Oct
          // 2026). English is the British reading, the one `dateline`
          // already writes ("Tue, 20 Oct") and the one that starts the
          // week on Monday, as Vietnamese and the old grid did.
          //
          // iOS only: Android's dialog takes no locale and follows the
          // system. The prop only names how the grid is labelled — the
          // day still comes back as a Date and goes through `toISO`, so
          // which day was picked does not depend on it.
          locale={PICKER_LOCALE[lang]}
          // The past is refused rather than clamped after the fact:
          // there is no plan to sketch for last Tuesday, and a picker
          // that lets you choose one and then silently moves you is
          // worse than one that never offered.
          //
          // The bounds are instants, not days, which is why they are
          // built here rather than with `fromISO` — that returns local
          // *noon*, deliberately, so a calendar day survives every
          // timezone. Handed to a picker as a minimum it means
          // something else entirely: "today, from 12:00", and every
          // reader opening this before lunch found today greyed out on
          // the day they were most likely to want it.
          minimumDate={startOfToday}
          maximumDate={endOfDay(addDays(toISO(startOfToday), 365))}
          onChange={(e, picked) => {
            // Android fires once with 'set' or 'dismissed' and closes
            // itself; iOS fires on every scrub and stays open.
            if (Platform.OS !== 'ios') onClose();
            if (e.type === 'dismissed' || !picked) return;
            onPick(clampDay(toISO(picked)));
          }}
        />
        {Platform.OS === 'ios' && (
          <GradientCta
            icon="checkmark"
            label={t('Done', 'Xong', '完了', '完成', '完成')}
            onPress={onClose}
            wide
          />
        )}
      </View>
    </Modal>
  );
}
