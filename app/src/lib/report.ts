// Reporting somebody's words — the client's half of the rules the
// `reports` migration states.
//
// Pure, so the gate can hold it: which reasons exist, what a note may
// be, and the one thing the app must not offer. The policy on the table
// refuses a self-report and caps the day's filings; this file lets the
// screen decline before the round trip, so a refusal a person could
// have been spared never becomes an error message.

/** The four the table's CHECK accepts, in the order the sheet shows
 *  them: the common one first, the serious one second, the specific one
 *  third, and the escape hatch last. */
export const REPORT_REASONS = ['spam', 'offensive', 'impersonation', 'other'] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** What the column will take. Long enough for a paragraph of context,
 *  short enough that the queue stays readable. */
export const NOTE_MAX = 500;

export function isReportReason(x: string): x is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(x);
}

/** The note, as the row will hold it: trimmed, capped, and null rather
 *  than empty — a column of empty strings is a column that has to be
 *  checked twice everywhere it is read. */
export function cleanNote(note: string | null | undefined): string | null {
  const n = (note ?? '').trim();
  if (!n) return null;
  return n.slice(0, NOTE_MAX);
}

/**
 * Whether this is a thing the reader may report at all.
 *
 * Reporting yourself is refused by the policy, so the app must not offer
 * it — a control that exists to fail is worse than no control. Your own
 * collection is the same case wearing a different hat: it is yours to
 * delete, and reporting it to the desk would be asking somebody else to
 * do what the row above already does.
 */
export function reportable(
  target: { kind: 'collection' | 'profile'; ownerId?: string | null; id: string },
  me: string | null | undefined,
): boolean {
  if (!me) return false;
  if (target.kind === 'profile') return target.id !== me;
  return target.ownerId != null && target.ownerId !== me;
}
