// When a trip's reminders should fire — the arithmetic half.
//
// Two reminders per trip since 2 Oct 2026, where there had been one:
//
// - **The evening before, at eight.** Early enough to change plans or
//   sleep, late enough that the plan is near. The hour is a product
//   decision made once, so it lives here as the one constant rather than
//   at whichever call site remembered it.
// - **On the day, two hours before the first stop.** The evening-before
//   note is a courtesy about tomorrow; the day's own note is the one that
//   gets a reader out of the door. Two hours is a shower and the ride: the
//   planner never sends anyone across more than one city, and an hour's
//   ride is the long end of that. Not before seven in the morning — a plan
//   whose first stop is at eight does not need a phone buzzing at six —
//   and a plan that starts at or before seven gets no day-of note at all,
//   since the evening-before one already said when. The owner asked for
//   this after finding that the evening-before note was the only one, and
//   that a trip saved after eight the night before, or on the day itself,
//   was reminded of by nothing.
//
// The evening-before note used to say "starts in the morning" to every
// trip, including the evening ones it was written for. Both notes now
// print the first stop's hour instead, when the stops carry one.
//
// Pure on purpose, like every module the gate can see: the clock comes
// in as an argument, so a Node process can prove that a trip on the 24th
// reminds on the 23rd at 20:00 — and that one saved for tomorrow morning
// after tonight's eight o'clock has already passed reminds not at all,
// rather than instantly, which is what a naive schedule would do.
//
// On the phone's clock. Stop times are minutes on the catalog city's
// clock, and the fire dates below are built with the phone's; the two
// agree for the person this is for, who is in the city to go on the
// trip. A reader planning Hanoi from Melbourne gets Melbourne-hour
// notes, which is wrong by three hours and is left as it is: the trip
// itself is in the same column as the reminder, and fixing one without
// the other would only move the disagreement.

import { clockOf } from './format';

export const REMINDER_HOUR = 20;
/** Minutes before the first stop that the day-of note fires. */
export const DAY_OF_LEAD_MIN = 120;
/** The day-of note never fires before this hour. */
export const DAY_OF_EARLIEST_HOUR = 7;

/** The two notes a trip has. `eve` is the original and keeps its
 *  identifier prefix, so the ones already on phones are recognised. */
export type ReminderKind = 'eve' | 'today';
export const REMINDER_KINDS: readonly ReminderKind[] = ['eve', 'today'];

const parseDay = (dayISO: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  return m ? { y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]) } : null;
};

/**
 * The local moment to remind about a trip on `dayISO` the evening
 * before, or null.
 *
 * Null when the day does not parse, and null when the moment is not
 * strictly in the future — a reminder that fires the instant it is
 * scheduled is a bug wearing a feature's name.
 */
export function reminderFireDate(dayISO: string, now: Date): Date | null {
  const p = parseDay(dayISO);
  if (!p) return null;
  const fire = new Date(p.y, p.mo, p.d - 1, REMINDER_HOUR, 0, 0, 0);
  if (fire.getTime() <= now.getTime()) return null;
  return fire;
}

/**
 * The local moment for the day-of note: `DAY_OF_LEAD_MIN` before the
 * first stop, no earlier than `DAY_OF_EARLIEST_HOUR`, or null.
 *
 * Null for a trip with no timed stop (nothing to be two hours before),
 * for a start at or before the earliest hour (the clamp would land on or
 * after the start, and a note that arrives as you arrive is noise), and
 * for a moment already passed.
 */
export function dayOfFireDate(dayISO: string, startMin: number | null, now: Date): Date | null {
  const p = parseDay(dayISO);
  if (!p || startMin == null) return null;
  const start = new Date(p.y, p.mo, p.d, 0, startMin, 0, 0);
  const earliest = new Date(p.y, p.mo, p.d, DAY_OF_EARLIEST_HOUR, 0, 0, 0);
  let fire = new Date(start.getTime() - DAY_OF_LEAD_MIN * 60_000);
  if (fire.getTime() < earliest.getTime()) fire = earliest;
  if (fire.getTime() >= start.getTime()) return null;
  if (fire.getTime() <= now.getTime()) return null;
  return fire;
}

/** When note `kind` for `w` fires, or null when it should not exist. */
export function fireDateFor(kind: ReminderKind, w: ReminderWant, now: Date): Date | null {
  return kind === 'eve' ? reminderFireDate(w.day, now) : dayOfFireDate(w.day, w.startMin, now);
}

/**
 * The first stop's arrival, in minutes past midnight, or null when no
 * stop carries a time. A minimum over the stops rather than the first
 * row, for the reason `endMinOf` takes a maximum: row order is
 * `sort_order`, and a dragged stop's row is not its hour.
 */
export function startMinOf(stops: readonly { arrive_min?: number | null }[]): number | null {
  let start: number | null = null;
  for (const s of stops) {
    if (s.arrive_min == null) continue;
    if (start == null || s.arrive_min < start) start = s.arrive_min;
  }
  return start;
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

/** Every evening-before note this app plants carries this prefix, so the
 *  sync can tell its own from anything else the phone has scheduled. */
export const REMINDER_PREFIX = 'trip-reminder-';
/** And every day-of note this one. */
export const TODAY_PREFIX = 'trip-today-';

export const reminderIdFor = (tripId: string, kind: ReminderKind = 'eve') =>
  `${kind === 'eve' ? REMINDER_PREFIX : TODAY_PREFIX}${tripId}`;

/** The trip and the kind a scheduled notification is for, or null when
 *  it is not ours. */
export function reminderOf(identifier: string): { tripId: string; kind: ReminderKind } | null {
  for (const kind of REMINDER_KINDS) {
    const prefix = kind === 'eve' ? REMINDER_PREFIX : TODAY_PREFIX;
    if (!identifier.startsWith(prefix)) continue;
    const tripId = identifier.slice(prefix.length);
    return tripId ? { tripId, kind } : null;
  }
  return null;
}

/** The trip a scheduled notification is for, or null when it is not ours. */
export function tripIdOfReminder(identifier: string): string | null {
  return reminderOf(identifier)?.tripId ?? null;
}

/** A trip the reader should be reminded about. `startMin` is the first
 *  stop's arrival, or null when the stops carry no time. */
export type ReminderWant = { tripId: string; day: string; title: string; startMin: number | null };

/** A reminder the phone already holds. `day`, `title` and `startMin` are
 *  what it was planted for; null for the ones planted before they were
 *  recorded. */
export type ReminderHeld = {
  tripId: string; kind: ReminderKind; day: string | null; title: string | null; startMin: number | null;
};

type TripLike = {
  id: string; owner_id: string; day: string; title: string;
  trip_stops?: readonly { arrive_min?: number | null }[];
};
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
    .map((t) => ({ tripId: t.id, day: t.day, title: t.title, startMin: startMinOf(t.trip_stops ?? []) }));
}

/** One note to plant: which trip, which of its two. */
export type ReminderPlant = { kind: ReminderKind; want: ReminderWant };
/** One note to pull. */
export type ReminderPull = { tripId: string; kind: ReminderKind };

/**
 * What to plant and what to pull so the phone holds exactly the notes
 * every trip still ahead that the reader is going on should have.
 *
 * Planted: a wanted note whose moment is still to come and that the phone
 * holds nothing for, or holds for another day, title or start — the same
 * identifier replaces the old one. Pulled: anything held for a trip that
 * is no longer wanted (deleted, left, invitation withdrawn) or whose
 * moment has passed. A wanted note already held as it is, is left alone.
 */
export function planReminderSync(
  want: readonly ReminderWant[],
  held: readonly ReminderHeld[],
  now: Date,
): { schedule: ReminderPlant[]; cancel: ReminderPull[] } {
  const key = (tripId: string, kind: ReminderKind) => `${kind}:${tripId}`;
  const ahead = new Map<string, ReminderPlant>();
  for (const w of want) {
    for (const kind of REMINDER_KINDS) {
      if (fireDateFor(kind, w, now)) ahead.set(key(w.tripId, kind), { kind, want: w });
    }
  }
  const heldBy = new Map(held.map((h) => [key(h.tripId, h.kind), h]));
  const schedule = [...ahead.values()].filter(({ kind, want: w }) => {
    const h = heldBy.get(key(w.tripId, kind));
    return !h || h.day !== w.day || h.title !== w.title || h.startMin !== w.startMin;
  });
  const cancel = held
    .filter((h) => !ahead.has(key(h.tripId, h.kind)))
    .map((h) => ({ tripId: h.tripId, kind: h.kind }));
  return { schedule, cancel };
}

export type Translate = (en: string, vi: string, ja: string) => string;

/**
 * A note's words — one place, so a trip saved and a trip synced read the
 * same. The first stop's hour where the stops carry one; the evening-
 * before note without a time says only that the day is tomorrow, where it
 * used to promise a morning to every evening plan.
 */
export function reminderText(
  kind: ReminderKind,
  w: { title: string; startMin: number | null },
  t: Translate,
): { title: string; body: string } {
  const at = w.startMin == null ? null : clockOf(w.startMin);
  if (kind === 'eve') {
    return {
      title: t(`Tomorrow: ${w.title}`, `Ngày mai: ${w.title}`, `明日：${w.title}`),
      body: at
        ? t(`First stop at ${at}. Sleep well.`, `Điểm dừng đầu lúc ${at}. Ngủ ngon nhé.`, `最初の立ち寄り先は${at}。おやすみなさい。`)
        : t('Your plan is tomorrow. Sleep well.', 'Mai là ngày đi rồi. Ngủ ngon nhé.', '予定は明日。おやすみなさい。'),
    };
  }
  // A day-of note exists only for a trip with a start, so `at` is set here.
  return {
    title: t(`Today: ${w.title}`, `Hôm nay: ${w.title}`, `今日：${w.title}`),
    body: t(
      `First stop at ${at}. Check the route and leave in time.`,
      `Điểm dừng đầu lúc ${at}. Xem lại lộ trình, đi cho kịp nhé.`,
      `最初の立ち寄り先は${at}。ルートを確認して、余裕を持って出発を。`,
    ),
  };
}
