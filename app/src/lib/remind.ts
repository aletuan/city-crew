// When a trip's reminder should fire — the arithmetic half.
//
// The evening before, at eight: early enough to change plans or sleep,
// late enough that the plan is near. The choice of hour is a product
// decision made once (see the discussion that set it), so it lives here
// as the one constant rather than at whichever call site remembered it.
//
// Pure on purpose, like every module the gate can see: the clock comes
// in as an argument, so a Node process can prove that a trip on the 24th
// reminds on the 23rd at 20:00 — and that one saved for tomorrow morning
// after tonight's eight o'clock has already passed reminds not at all,
// rather than instantly, which is what a naive schedule would do.

export const REMINDER_HOUR = 20;

/**
 * The local moment to remind about a trip on `dayISO`, or null.
 *
 * Null when the day does not parse, and null when the moment is not
 * strictly in the future — a reminder that fires the instant it is
 * scheduled is a bug wearing a feature's name.
 */
export function reminderFireDate(dayISO: string, now: Date): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) return null;
  const fire = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1,
    REMINDER_HOUR, 0, 0, 0,
  );
  if (fire.getTime() <= now.getTime()) return null;
  return fire;
}

// ── who is reminded, and keeping the phone in step ──
//
// A reminder is a local notification, planted on the phone that asked for
// it. That was enough while only the planner was reminded — the save and
// the delete happen on their phone — but three things happen elsewhere:
// an invitation is accepted on another screen or another phone, the owner
// deletes a trip or withdraws an invitation from theirs, and a reader who
// reinstalls or changes phones arrives with none of the reminders their
// trips had. So the phone does not only plant and pull at the moment of a
// save; it reconciles what it holds with the trips as they now stand.

/** Every reminder this app plants carries this prefix, so the sync can tell
 *  its own from anything else the phone has scheduled. */
export const REMINDER_PREFIX = 'trip-reminder-';

export const reminderIdFor = (tripId: string) => `${REMINDER_PREFIX}${tripId}`;

/** The trip a scheduled notification is for, or null when it is not ours. */
export function tripIdOfReminder(identifier: string): string | null {
  if (!identifier.startsWith(REMINDER_PREFIX)) return null;
  const id = identifier.slice(REMINDER_PREFIX.length);
  return id || null;
}

/** A trip the reader should be reminded about. */
export type ReminderWant = { tripId: string; day: string; title: string };

/** A reminder the phone already holds. `day` and `title` are what it was
 *  planted for; null for the ones planted before they were recorded. */
export type ReminderHeld = { tripId: string; day: string | null; title: string | null };

type TripLike = { id: string; owner_id: string; day: string; title: string };
type InviteLike = { trip_id: string; invitee_id: string; status: string };

/**
 * The trips the reader is going on: the ones they planned, and the ones
 * they accepted an invitation to.
 *
 * Not a pending invitation — the list of trips holds those too, because an
 * invitee can open a trip to decide — and not one they declined or left.
 * Somebody who has not said yes is not reminded about an evening they
 * may not go to.
 */
export function tripsToRemind(
  trips: readonly TripLike[],
  invites: readonly InviteLike[],
  me: string | null,
): ReminderWant[] {
  if (!me) return [];
  const accepted = new Set(
    invites.filter((i) => i.invitee_id === me && i.status === 'accepted').map((i) => i.trip_id),
  );
  return trips
    .filter((t) => t.owner_id === me || accepted.has(t.id))
    .map((t) => ({ tripId: t.id, day: t.day, title: t.title }));
}

/**
 * What to plant and what to pull so the phone holds exactly one reminder
 * for every trip still ahead that the reader is going on.
 *
 * Planted: a wanted trip whose evening-before is still to come and that
 * the phone holds nothing for, or holds for another day or title — the
 * same identifier replaces the old one. Pulled: anything held for a trip
 * that is no longer wanted (deleted, left, invitation withdrawn) or whose
 * moment has passed. A wanted trip already held as it is, is left alone.
 */
export function planReminderSync(
  want: readonly ReminderWant[],
  held: readonly ReminderHeld[],
  now: Date,
): { schedule: ReminderWant[]; cancel: string[] } {
  const ahead = new Map(
    want.filter((w) => reminderFireDate(w.day, now)).map((w) => [w.tripId, w]),
  );
  const heldBy = new Map(held.map((h) => [h.tripId, h]));
  const schedule = [...ahead.values()].filter((w) => {
    const h = heldBy.get(w.tripId);
    return !h || h.day !== w.day || h.title !== w.title;
  });
  const cancel = held.filter((h) => !ahead.has(h.tripId)).map((h) => h.tripId);
  return { schedule, cancel };
}

type Translate = (en: string, vi: string, ja: string) => string;

/** The reminder's words — one place, so a trip saved and a trip synced
 *  read the same the night before. */
export function reminderText(title: string, t: Translate): { title: string; body: string } {
  return {
    title: t(`Tomorrow: ${title}`, `Ngày mai: ${title}`, `明日：${title}`),
    body: t(
      'Your plan starts in the morning. Sleep well.',
      'Kế hoạch bắt đầu vào sáng mai. Ngủ ngon nhé.',
      '予定は明日の朝から。おやすみなさい。',
    ),
  };
}
