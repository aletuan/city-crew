import { supabase } from '../supabase';
import type { InviteRow } from '../invites';

// ── invitations ──────────────────────────────────────────────────────
//
// Four statements and a count. Every one of them is scoped by a policy
// rather than by a `where` clause here — the reads below deliberately do
// not filter by the caller, because RLS already does and a second copy of
// the rule in the client is the copy that drifts. See the trip_invites
// migration for what each policy allows; this file's job is only to send
// the statement and surface the refusal.

const INVITE_COLS = 'trip_id, invitee_id, inviter_id, status, created_at, responded_at';

/**
 * Every invitation the caller can see, both sides of it.
 *
 * The select policy returns the rows where they are the invitee *and* the
 * rows on trips they own, in one query, because those are the same table
 * and the caller wants both: the Trips tab needs the first to draw the
 * rail, the trip detail needs the second to draw the crew. Splitting them
 * into two queries would be two round trips to answer one question, and
 * `lib/invites` can tell them apart with the reader's own id.
 */
export async function fetchInvites(): Promise<InviteRow[]> {
  const { data, error } = await supabase
    .from('trip_invites')
    .select(INVITE_COLS);
  if (error) throw new Error(error.message);
  return (data ?? []) as InviteRow[];
}

/**
 * Ask several friends at once.
 *
 * One insert, not a loop: the sheet sends whatever was ticked in a single
 * press, and a partial failure halfway down a loop would leave the reader
 * with some of their invitations sent and no way to tell which.
 *
 * `status` is left to its default rather than passed. The insert policy
 * requires 'pending' and the column defaults to it, so naming it here
 * would be a second copy of a rule the server already holds — and the one
 * that could be edited to say something else.
 */
export async function sendInvites(
  tripId: string, inviterId: string, inviteeIds: readonly string[],
): Promise<number> {
  if (!inviteeIds.length) return 0;
  const { error } = await supabase.from('trip_invites').insert(
    inviteeIds.map((id) => ({ trip_id: tripId, invitee_id: id, inviter_id: inviterId })),
  );
  if (error) throw new Error(error.message);
  return inviteeIds.length;
}

/**
 * Take back invitations nobody has answered.
 *
 * The delete policy only reaches unanswered rows, so this cannot remove
 * somebody who has already said yes — and `lib/invites.diffSelection`
 * never proposes it. Both halves are deliberate: the client refuses to ask
 * and the server refuses to do it.
 */
export async function withdrawInvites(
  tripId: string, inviteeIds: readonly string[],
): Promise<void> {
  if (!inviteeIds.length) return;
  const { error } = await supabase
    .from('trip_invites')
    .delete()
    .eq('trip_id', tripId)
    .in('invitee_id', inviteeIds);
  if (error) throw new Error(error.message);
}

/**
 * Yes or no, once.
 *
 * `responded_at` is stamped by the client, matching how `trips.updated_at`
 * is — a trigger would be tidier and is worth having when something other
 * than the app writes here; nothing does.
 *
 * No `eq('invitee_id', me)`: the update policy pins the row to the caller
 * and to the unanswered state, so adding the same condition here would be
 * the drifting copy again. A second answer reaches no rows rather than
 * failing, which is what the screen wants — the invitation is simply no
 * longer waiting.
 */
export async function answerInvite(
  tripId: string, answer: 'accepted' | 'declined',
): Promise<void> {
  const { error } = await supabase
    .from('trip_invites')
    .update({ status: answer, responded_at: new Date().toISOString() })
    .eq('trip_id', tripId);
  if (error) throw new Error(error.message);
}

export type CrewCount = { trip_id: string; accepted: number; pending: number };

/**
 * How many are coming, for trips the caller is on.
 *
 * An invitee is shown "and 2 others" without being shown who: who else was
 * asked is the owner's business, and one of them may have said no. The
 * function returns no row at all for a trip the caller is on neither side
 * of — not a zero, which would confirm the trip exists.
 *
 * Best-effort at the call site: a missing headcount costs a clause in a
 * sentence, and is not worth failing a screen over.
 */
export async function fetchCrewCounts(tripIds: readonly string[]): Promise<Record<string, CrewCount>> {
  if (!tripIds.length) return {};
  const { data, error } = await supabase.rpc('trip_crew_counts', { trip_ids: tripIds });
  if (error) throw new Error(error.message);
  const out: Record<string, CrewCount> = {};
  for (const row of (data ?? []) as CrewCount[]) out[row.trip_id] = row;
  return out;
}
