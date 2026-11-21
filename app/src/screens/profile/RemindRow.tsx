// Profile's row for trip reminders: a switch where pressing it can work,
// and a way into iOS Settings where it cannot — see `lib/remindState`.

import { Linking } from 'react-native';
import { useI18n } from '../../lib/i18n';
import { useReminderPref } from '../../lib/reminderPref';
import { SettingRow, SwitchRow } from './rows';

export function RemindRow() {
  const { t } = useI18n();
  const { state, setOn } = useReminderPref();
  // Not drawn on a guess: until the phone and the storage have both
  // answered, a row that said "off" would be wrong half the time.
  if (state === null) return null;
  const label = t('Trip reminders', 'Nhắc nhở chuyến đi', '旅程のリマインダー', '行程提醒', '行程提醒');
  if (state === 'blocked') {
    return (
      <SettingRow
        icon="notifications-off-outline"
        label={label}
        value={t('Off in Settings', 'Tắt trong Cài đặt', '設定でオフ', '在设置中关闭', '在設定中關閉')}
        onPress={() => { Linking.openSettings().catch(() => {}); }}
        testID="profile-reminders"
      />
    );
  }
  return (
    <SwitchRow
      icon="notifications-outline"
      label={label}
      value={state === 'on'}
      onChange={(on) => { void setOn(on); }}
      testID="profile-reminders"
    />
  );
}
