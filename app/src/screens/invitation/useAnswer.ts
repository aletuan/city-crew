// Out of `TripInvitationScreen` on 27 Nov 2026, so the screen's function
// fits the ceiling (`oversize.js`); the reasoning moved with the code,
// unchanged.

import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { answerInvite } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import type { useInvitations } from '../../lib/invitations';
import { startMinOf } from '../../lib/remind';
import { scheduleTripReminder } from '../../lib/reminders';
import type { useMyTrips } from '../../lib/mytrips';
import type { Nav } from '../../nav';

type Trip = ReturnType<typeof useMyTrips>['data'][number];

/** Yes or no, sent once, and the screen left either way. */
export function useAnswer({ tripId, trip, invites, trips, navigation }: {
  tripId: string;
  trip: Trip | null;
  invites: ReturnType<typeof useInvitations>['invites'];
  trips: ReturnType<typeof useMyTrips>;
  navigation: Nav;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  // The guard, as opposed to the dimming: `busy` is only seen by the
  // render after the one that set it, so two taps landing in the same
  // frame both read false and sent the answer twice.
  const inFlight = useRef(false);

  const answer = async (said: 'accepted' | 'declined') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await answerInvite(tripId, said);
      // The promise this screen makes above the buttons: accepting brings
      // the reminders, the evening before and on the day. Planted here, on
      // the tap, because this is the moment a permission sheet makes sense
      // to the reader; the background sync that also covers it never asks.
      // Declining needs nothing — an invitee was never reminded before
      // saying yes.
      if (said === 'accepted' && trip) {
        void scheduleTripReminder(
          { id: trip.id, day: trip.day, title: trip.title, startMin: startMinOf(trip.trip_stops ?? []) },
          t,
        );
      }
      invites.reload();
      trips.reload();
      // Both answers leave this screen: accepting puts the trip in Trips
      // where it now belongs, and declining ends the reader's access to it
      // on the same statement. Staying would be a screen with nothing left
      // to do on it either way.
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        t('Could not answer', 'Không trả lời được', '回答できません', '无法回复', '無法回覆'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return { busy, answer };
}
