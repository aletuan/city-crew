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
