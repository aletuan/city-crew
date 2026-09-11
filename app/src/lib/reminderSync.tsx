// Keeps the phone's trip reminders in step with the trips — see the note
// above `planReminderSync` in lib/remind for why the phone cannot simply
// plant on save and pull on delete.
//
// Renders nothing. It sits inside the trips and invitations providers and
// reconciles whenever either list settles on a new answer: at launch, when
// the app comes back to the foreground (both lists refresh then), and after
// any accept, leave or delete, since each of those reloads the lists.
//
// Only on answers the network gave. A launch opens on the last session's
// cached trips, and reconciling against those could pull a reminder for a
// trip accepted on another phone a moment before the network says so.

import { useEffect, useMemo } from 'react';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import { useInvitations } from './invitations';
import { useMyTrips } from './mytrips';
import { reminderText, tripsToRemind } from './remind';
import { syncTripReminders } from './reminders';

export function ReminderSync() {
  const { session } = useAuth();
  const me = session?.user?.id ?? null;
  const trips = useMyTrips();
  const { invites } = useInvitations();
  const { t, lang } = useI18n();

  const want = useMemo(
    () => tripsToRemind(trips.data, invites.data, me),
    [trips.data, invites.data, me],
  );
  // What the effect keys on: the wanted set as a value, not the array's
  // identity, so an unrelated re-render does not re-read the phone's
  // schedule. The language is in it because a reminder's words are.
  const signature = `${lang}|${want.map((w) => `${w.tripId}:${w.day}:${w.title}`).join(',')}`;
  const settled = trips.loaded && !trips.loading && !trips.fromCache && !trips.error
    && invites.loaded && !invites.loading && !invites.error;

  useEffect(() => {
    if (!settled) return;
    void syncTripReminders(want, (w) => reminderText(w.title, t));
    // `want` and `t` are read through `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, signature]);

  return null;
}
