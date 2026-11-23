// The three things a trip's page writes: who is invited, deleting the
// trip (its planner), and leaving it (a guest).
//
// Out of `TripDetailScreen` on 23 Nov 2026. The screen was one of the
// nine that called the data layer's writes itself; these three, with
// their reloads and their failure alerts, sat in the middle of the
// function that draws the page. The screen keeps the sheet and the red
// button. The reasoning moved with the code unchanged.

import { useState } from 'react';
import { Alert } from 'react-native';
import { answerInvite, deleteTrip, sendInvites, withdrawInvites } from '../../lib/data';
import type { useI18n } from '../../lib/i18n';
import type { useInvitations } from '../../lib/invitations';
import type { useMyTrips } from '../../lib/mytrips';
import { cancelTripReminder } from '../../lib/reminders';
import type { Nav } from '../../nav';

type Trips = ReturnType<typeof useMyTrips>;

export function useTripActions({ trip, tripId, me, trips, invites, navigation, t }: {
  /** The trip on screen; null while it is loading or once it has gone,
   *  when the page draws neither button. */
  trip: Trips['data'][number] | null;
  tripId: string;
  me: string | null;
  trips: Trips;
  invites: ReturnType<typeof useInvitations>['invites'];
  navigation: Nav;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);

  /** Send what was ticked and take back what was unticked, in that order:
   *  a press that both invites and withdraws should not leave the trip
   *  briefly emptier than the reader asked for. */
  const onSend = async (invite: string[], withdraw: string[]) => {
    if (!me || sending) return;
    setSending(true);
    try {
      await sendInvites(tripId, me, invite);
      await withdrawInvites(tripId, withdraw);
      setSheetOpen(false);
      invites.reload();
    } catch (e) {
      Alert.alert(
        t('Could not send', 'Không gửi được', '送信できません', '无法发送', '無法傳送'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = () => trip && Alert.alert(
    t('Delete this trip?', 'Xoá chuyến đi này?', 'この旅程を削除しますか？', '删除这个行程？', '刪除這個行程？'),
    t(
      `"${trip.title}" will be gone for good.`,
      `"${trip.title}" sẽ mất hẳn.`,
      `「${trip.title}」は完全に削除されます。`,
      `“${trip.title}”将被永久删除。`, `「${trip.title}」將被永久刪除。`,
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除', '删除', '刪除'),
        style: 'destructive',
        // Back first, then reload: the list is the screen that has to
        // notice, and leaving this one standing over a row that no longer
        // exists would put it through its own "no longer here" state on
        // the way out.
        onPress: () => {
          cancelTripReminder(trip.id);
          deleteTrip(trip.id)
            .then(() => { navigation.goBack(); trips.reload(); })
            .catch((e: Error) => Alert.alert(
              t('Could not delete', 'Không xoá được', '削除できませんでした', '无法删除', '無法刪除'), e.message,
            ));
        },
      },
    ],
  );

  /** The guest's version of the red button. Deleting is the owner's act —
   *  a guest who pressed it reached a row RLS would not let them touch,
   *  got a silent zero, and watched the trip "come back" on the next
   *  refetch. What a guest actually does is leave: a late decline, which
   *  ends their view of the plan for good and tells the planner the
   *  truth — the crew row marks them "can't make it". */
  const confirmLeave = () => trip && Alert.alert(
    t('Leave this trip?', 'Rời chuyến đi này?', 'この旅程から抜けますか？', '退出这个行程？', '離開這個行程？'),
    t(
      `"${trip.title}" will leave your list, and the planner will see you can't make it.`,
      `"${trip.title}" sẽ rời khỏi danh sách của bạn; người mời sẽ thấy bạn không đi được.`,
      `「${trip.title}」はリストから消え、招待した人には不参加と表示されます。`,
      `“${trip.title}”将从你的列表中移除，发起人会看到你无法参加。`, `「${trip.title}」將從你的列表中移除，發起人會看到你無法參加。`,
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      {
        text: t('Leave', 'Rời', '抜ける', '退出', '離開'),
        style: 'destructive',
        onPress: () => {
          answerInvite(trip.id, 'declined')
            .then(() => {
              // Leaving takes the reminder with it, as a delete does for
              // the planner. The sync would pull it on the next reload
              // anyway; doing it here means it is gone before that.
              cancelTripReminder(trip.id);
              navigation.goBack(); trips.reload(); invites.reload();
            })
            .catch((e: Error) => Alert.alert(
              t('Could not leave', 'Không rời được', '退出できませんでした', '无法退出', '無法離開'), e.message,
            ));
        },
      },
    ],
  );

  return { sheetOpen, setSheetOpen, sending, onSend, confirmDelete, confirmLeave };
}
