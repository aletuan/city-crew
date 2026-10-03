// The notification half of trip reminders — the part that talks to the
// operating system, kept apart from the arithmetic (lib/remind) the same
// way candidates.ts keeps its React out of suggest.ts: the gate can hold
// the maths to 100%, and this file needs a phone to mean anything.
//
// Local notifications only. The date of a trip is known the moment it is
// saved, so the phone can carry its own reminders — no server, no push
// token, and they fire with the app closed or the network gone. (Remote
// push is a different feature with a different cost: Expo Go cannot
// receive it at all since SDK 53, so it waits for a development build.)
//
// Two notes per trip — the evening before and the day of — see
// `lib/remind` for when each fires and why.
//
// Every function here is best-effort and swallows its failures: a
// reminder is a courtesy, and no courtesy is worth failing a save over.

import * as Notifications from 'expo-notifications';
import {
  fireDateFor, planReminderSync, REMINDER_KINDS, reminderIdFor, reminderOf, reminderText,
  type ReminderHeld, type ReminderKind, type ReminderWant, type Translate,
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

/**
 * Plant both notes for a saved trip. No-op for a note whose moment has
 * passed (see `lib/remind`), when permission is refused, or when the
 * platform balks — a save must never fail over a courtesy.
 */
export async function scheduleTripReminder(
  trip: { id: string; day: string; title: string; startMin: number | null },
  t: Translate,
): Promise<void> {
  try {
    const w: ReminderWant = { tripId: trip.id, day: trip.day, title: trip.title, startMin: trip.startMin };
    const now = new Date();
    const due = REMINDER_KINDS
      .map((kind) => ({ kind, fire: fireDateFor(kind, w, now) }))
      .filter((d): d is { kind: ReminderKind; fire: Date } => d.fire !== null);
    if (!due.length) return;
    if (!(await ensurePermission())) return;
    for (const { kind, fire } of due) await plant(kind, w, reminderText(kind, w, t), fire);
  } catch { /* a courtesy, not a contract */ }
}

/** The day, title and start ride along in `data`, so a later sync can
 *  tell a note that is still right from one planted for an older version. */
async function plant(
  kind: ReminderKind,
  w: ReminderWant,
  content: { title: string; body: string },
  fire: Date,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: reminderIdFor(w.tripId, kind),
    content: {
      title: content.title,
      body: content.body,
      sound: false,
      data: { tripId: w.tripId, kind, day: w.day, title: w.title, startMin: w.startMin },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
  });
}

/**
 * Make the phone hold exactly the notes `want` calls for — see
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
  t: Translate,
  now: Date = new Date(),
): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const held: ReminderHeld[] = [];
    for (const n of all) {
      const ours = reminderOf(n.identifier);
      if (!ours) continue;
      const data = (n.content?.data ?? {}) as { day?: unknown; title?: unknown; startMin?: unknown };
      held.push({
        ...ours,
        day: typeof data.day === 'string' ? data.day : null,
        title: typeof data.title === 'string' ? data.title : null,
        startMin: typeof data.startMin === 'number' ? data.startMin : null,
      });
    }
    const plan = planReminderSync(want, held, now);
    for (const { tripId, kind } of plan.cancel) await cancel(tripId, kind);
    if (!plan.schedule.length) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    for (const { kind, want: w } of plan.schedule) {
      const fire = fireDateFor(kind, w, now);
      if (fire) await plant(kind, w, reminderText(kind, w, t), fire);
    }
  } catch { /* a courtesy, not a contract */ }
}

async function cancel(tripId: string, kind: ReminderKind): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderIdFor(tripId, kind));
  } catch { /* already gone is the goal state */ }
}

/** A deleted trip takes both its notes with it — a phone that pings about
 *  a plan its owner erased is the app talking to itself. */
export async function cancelTripReminder(tripId: string): Promise<void> {
  for (const kind of REMINDER_KINDS) await cancel(tripId, kind);
}
