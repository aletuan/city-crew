// An invitation, whole, before it is answered.
//
// The card on Trips carries enough for the easy yes. This is for the
// answer that needs looking at first: the times, the walk between the
// stops, what it will cost, and how many people are already coming.
//
// ── read from the list, not fetched again ──
//
// Same rule as `TripDetail`, and it works here for a reason worth naming:
// the invitee can read the trip from the moment they are asked, so it is
// already in `useMyTrips` alongside the ones they planned. No second
// query, and no second answer that could disagree with the screen behind
// this one.
//
// ── what it says before it asks ──
//
// Two sentences under the plan, and both are promises the rest of the
// system keeps rather than reassurance: the owner keeps the plan (there
// is no policy that would let this screen's reader move a stop), and
// declining does not delete anything (a refusal is a status, not a
// delete — see the trip_invites migration for why, unlike a declined
// friend request, it is recorded).

import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { AmbientWarmth, Screen, useTabBarClearance } from '../components/ui';
import { useSession } from '../lib/auth';
import { useCrew } from '../lib/crew';
import { fromISO } from '../lib/day';
import { useMyTrips } from '../lib/mytrips';
import { clockOf } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useInvitations } from '../lib/invitations';
import { useFlag } from '../lib/useFlag';
import { spendVnd } from '../lib/trips';
import { legsOf } from '../lib/travel';
import { space } from '../theme';
import type { Nav, RootRoute } from '../nav';
import { Answers, Asker, Going, Keeps, NotHere, Plan } from './invitation/parts';
import { useAnswer } from './invitation/useAnswer';

/** The cost per person when prices are shown, and 0 — which prints
 *  nothing — when they are not. Outside the screen so the switch costs
 *  its function no branch (`oversize.js`). */
function shownSpend(on: boolean, stops: readonly { places?: Parameters<typeof spendVnd>[0][number] }[]): number {
  return on ? spendVnd(stops.map((st) => st.places)) : 0;
}

export default function TripInvitationScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'TripInvitation'>;
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const { people } = useCrew();
  const { invites, crewCounts } = useInvitations();
  const clearance = useTabBarClearance();
  const trips = useMyTrips();
  // The cost per person is behind the same switch as every other price
  // (#597, #755), and was the one left out (23 Nov 2026): this line
  // predates the switch, so when the plan screens' totals went behind it
  // the invitation kept "~50k ₫ / người" — the only price left in the
  // app, shown to the one reader who cannot open the places to check it.
  const showPrice = useFlag('place_price');


  const tripId = route.params.id;
  // Batched by the invitations provider alongside the rail this screen
  // was opened from, so the "you'd be N in all" clause is already in hand.
  const heads = crewCounts[tripId];
  const trip = trips.data.find((x) => x.id === tripId) ?? null;
  const invite = useMemo(
    () => invites.data.find((i) => i.trip_id === tripId && i.invitee_id === session?.user?.id) ?? null,
    [invites.data, tripId, session?.user?.id],
  );

  // Sent once, and the screen left either way — see `useAnswer`.
  const { busy, answer } = useAnswer({ tripId, trip, invites, trips, navigation });

  if (!trip) {
    return <NotHere failed={!!trips.error} loaded={trips.loaded} onBack={() => navigation.goBack()} />;
  }


  const stops = trip.trip_stops ?? [];
  const day = fromISO(trip.day);
  const from = people[invite?.inviter_id ?? ''] ?? null;
  const legs = legsOf(stops.map((st) => st.places ?? { lat: null, lng: null }));
  const spend = shownSpend(showPrice, stops);
  const [first, last] = [stops[0], stops[stops.length - 1]];
  const window = first?.arrive_min != null && last?.arrive_min != null
    ? `${clockOf(first.arrive_min)}–${clockOf(last.arrive_min + (last.dwell_min ?? 0))}`
    : null;
  const going = heads == null ? null : heads + 1;

  // Already answered — reached by a stale card, or by coming back. Said
  // plainly rather than by re-offering two buttons that would reach no
  // rows: the update policy pins the answer to the unanswered state.
  const answered = invite && invite.status !== 'pending';

  return (
    <Screen
      compactTitle
      title={trip.title}
      eyebrow={t('INVITATION', 'LỜI MỜI', '招待', '邀请', '邀請')}
      onBack={() => navigation.goBack()}
      backBare
    >
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        <Asker from={from} trip={trip} day={day} window={window} />

        <Plan stops={stops} legs={legs} window={window} spend={spend} />

        {going != null ? <Going going={going} from={from} /> : null}

        <Keeps from={from} />

        <Answers
          answered={!!answered}
          accepted={invite?.status === 'accepted'}
          busy={busy}
          onAnswer={answer}
        />
      </ScrollView>
    </Screen>
  );
}
