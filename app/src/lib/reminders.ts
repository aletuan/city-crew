// The notification half of trip reminders — the part that talks to the
// operating system, kept apart from the arithmetic (lib/remind) the same
// way candidates.ts keeps its React out of suggest.ts: the gate can hold
// the maths to 100%, and this file needs a phone to mean anything.
//
// Local notifications only. The date of a trip is known the moment it is
// saved, so the phone can carry its own reminder — no server, no push
// token, and it fires with the app closed or the network gone. (Remote
// push is a different feature with a different cost: Expo Go cannot
// receive it at all since SDK 53, so it waits for a development build.)
//
// Every function here is best-effort and swallows its failures: a
// reminder is a courtesy, and no courtesy is worth failing a save over.

import * as Notifications from 'expo-notifications';
import {
  planReminderSync, reminderFireDate, reminderIdFor, tripIdOfReminder,
  type ReminderHeld, type ReminderWant,
} from './remind';

// Foreground behaviour: show the banner. Without a handler the default
// on iOS is to show nothing when the app is open — and a reminder for
// tomorrow is still worth seeing tonight, whichever screen is up.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Ask only when there is something to schedule — the agreed timing: the
 *  first trip is the moment the permission makes sense to a person. */
async function ensurePermission(): Promise<boolean> {
  try {
    const have = await Notifications.getPermissionsAsync();
    if (have.granted) return true;
    if (!have.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** One identifier per trip, so a delete can find what a save planted. */
const idFor = reminderIdFor;

/**
 * Plant the evening-before reminder for a saved trip. No-op when the
 * moment has passed (see reminderFireDate), when permission is refused,
 * or when the platform balks — a save must never fail over a courtesy.
 */
export async function scheduleTripReminder(
  trip: { id: string; day: string; title: string },
  content: { title: string; body: string },
): Promise<void> {
  try {
    const fire = reminderFireDate(trip.day, new Date());
    if (!fire) return;
    if (!(await ensurePermission())) return;
    await plant(trip, content, fire);
  } catch { /* a courtesy, not a contract */ }
}

/** The day and title ride along in `data`, so a later sync can tell a
 *  reminder that is still right from one planted for an older version. */
async function plant(
  trip: { id: string; day: string; title: string },
  content: { title: string; body: string },
  fire: Date,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: idFor(trip.id),
    content: {
      title: content.title,
      body: content.body,
      sound: false,
      data: { tripId: trip.id, day: trip.day, title: trip.title },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
  });
}

/**
 * Make the phone hold exactly the reminders `want` calls for — see
 * `planReminderSync` for the rule.
 *
 * Never asks for permission. It runs on its own, at launch and whenever
 * the trips change, and a permission sheet nobody tapped for is the wrong
 * moment to ask; the asking stays with the reader's own taps (saving a
 * plan, accepting an invitation). Without permission it still pulls the
 * stale ones — cancelling needs none — and plants nothing.
 */
export async function syncTripReminders(
  want: readonly ReminderWant[],
  text: (w: ReminderWant) => { title: string; body: string },
  now: Date = new Date(),
): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const held: ReminderHeld[] = [];
    for (const n of all) {
      const tripId = tripIdOfReminder(n.identifier);
      if (!tripId) continue;
      const data = (n.content?.data ?? {}) as { day?: unknown; title?: unknown };
      held.push({
        tripId,
        day: typeof data.day === 'string' ? data.day : null,
        title: typeof data.title === 'string' ? data.title : null,
      });
    }
    const plan = planReminderSync(want, held, now);
    for (const tripId of plan.cancel) await cancelTripReminder(tripId);
    if (!plan.schedule.length) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    for (const w of plan.schedule) {
      const fire = reminderFireDate(w.day, now);
      if (fire) await plant({ id: w.tripId, day: w.day, title: w.title }, text(w), fire);
    }
  } catch { /* a courtesy, not a contract */ }
}

/** A deleted trip takes its reminder with it — a phone that pings about
 *  a plan its owner erased is the app talking to itself. */
export async function cancelTripReminder(tripId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(idFor(tripId));
  } catch { /* already gone is the goal state */ }
}
