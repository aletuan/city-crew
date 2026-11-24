// Taking a visit back, written once.
//
// Two screens remove a check-in — a place's own page, from the sheet that
// lists the visits there, and the Check-ins list, from the row's menu —
// and each had its own copy of the same four lines: delete, reload the
// list the reader is looking at, and on failure say so in the same words.
// Two copies is how a fix lands in one and not the other: the failure
// alert is the part a reader sees only when something has already gone
// wrong, which is the part nobody re-reads.
//
// ── what stays with the caller ──
//
// The place page closes its sheet *before* the delete when the visit it
// removes is the last (a sheet about a visit that no longer exists has
// nothing to show, and waiting for the network first would leave it open
// on an empty list). The list has no sheet of its own to close. That is a
// difference in what happens around the removal, not in the removal, so it
// stays in the caller and this takes only the `reload` of the list each
// one holds.
//
// ── no "are you sure" ──
//
// Neither caller asks. Both reach this from a second step — the sheet
// after the pill, the menu after the ⋯ — and a visit is the reader's own
// note, not something another person sees go (#831). A confirmation here
// would be a third tap for a slip.
import { Alert } from 'react-native';
import { removeCheckin } from './data';
import { useI18n } from './i18n';

/** `remove(id)` takes one visit back, reloads, and tells the reader if it
 *  could not. It never rejects: the caller has nothing to do with a
 *  failure that the reader has already been told about. */
export function useRemoveCheckin(reload: () => void): (id: string) => Promise<void> {
  const { t } = useI18n();
  return async (id) => {
    try {
      await removeCheckin(id);
      reload();
    } catch (e) {
      Alert.alert(t('Could not remove it', 'Không bỏ được', '削除できませんでした', '无法删除', '無法刪除'), (e as Error).message);
    }
  };
}
