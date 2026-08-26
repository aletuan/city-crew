// Invitations, as arithmetic rather than as a screen.
//
// The questions the invitation screens ask are all shape questions — which
// pile does this row belong in, how many are coming, what does the crew row
// say when nobody has answered yet — and every one of them is easier to get
// wrong in a component than to prove here. Same trade the rest of `lib`
// makes: no React, no Supabase, so a Node process can hold it to the truth.
//
// ── the three piles ──
//
// A trip the reader can see is in exactly one of three states, and the two
// screens that draw them disagree about which matters:
//
//   owned      they planned it            → Trips, editable
//   joined     they were asked and said yes → Trips, read-only
//   asked      they were asked and have not answered → the invitations rail
//
// The database hands back one undifferentiated list — RLS lets an invitee
// read the trip from the moment they are asked, which is deliberate (a plan
// you must accept sight unseen is not an invitation) — so the split has to
// happen here. Getting it wrong puts an unanswered invitation in somebody's
// upcoming plans, which is the app promising an evening nobody agreed to.

/** One invitation, as the table stores it. Structural, because Node runs
 *  this and because the row is the same shape coming from either side of
 *  it — the owner reading their trip's crew, or the invitee reading their
 *  own list. */
export type InviteRow = {
  trip_id: string;
  invitee_id: string;
  inviter_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at?: string | null;
};

/** Mirror of the insert policy's cap: twenty invitees on one trip. The
 *  server enforces it; the app knows the number so the sheet can say the
 *  evening is full rather than relaying a refusal it cannot explain. */
export const INVITE_CAP = 20;

export type Standing = 'owned' | 'joined' | 'asked' | 'declined' | 'none';

/**
 * Where the reader stands on one trip.
 *
 * `declined` is a state and not an absence, which is the one thing here
 * that differs from friendships: a refusal is recorded so the owner can act
 * on it. For the person who refused it means only that the trip is gone
 * from their list — the select policies drop them the moment it is written,
 * so in practice they will not be holding the trip to ask about it. It is
 * answered anyway rather than folded into 'none', because a screen that
 * cannot tell "I said no" from "I was never asked" will eventually offer
 * one of them the wrong sentence.
 */
export function standingOn(
  ownerId: string, me: string, invites: readonly InviteRow[],
): Standing {
  if (ownerId === me) return 'owned';
  const mine = invites.find((i) => i.invitee_id === me);
  if (!mine) return 'none';
  if (mine.status === 'accepted') return 'joined';
  if (mine.status === 'declined') return 'declined';
  return 'asked';
}

export type Owned = { id: string; owner_id: string };

/**
 * Split what the database returned into the three piles the screens draw.
 *
 * Takes the reader's own invitations rather than every invitation on every
 * trip: the invitee is only ever shown their own row, and the owner's view
 * of who else is coming is a different question answered by `crewOf` below.
 *
 * A trip with a declined invitation lands nowhere. It cannot be read
 * anymore — the policy drops it — so a row for one is a stale copy from
 * before the answer, and putting it in any pile would draw a trip the
 * server has already stopped returning.
 */
export function splitByStanding<T extends Owned>(
  trips: readonly T[], me: string, myInvites: readonly InviteRow[],
): { mine: T[]; asked: T[] } {
  const byTrip = new Map(myInvites.map((i) => [i.trip_id, i]));
  const mine: T[] = [];
  const asked: T[] = [];
  for (const t of trips) {
    if (t.owner_id === me) { mine.push(t); continue; }
    const inv = byTrip.get(t.id);
    if (!inv) continue;
    if (inv.status === 'accepted') mine.push(t);
    else if (inv.status === 'pending') asked.push(t);
  }
  return { mine, asked };
}

/** The badge on the Trips tab, and the count in the rail's heading. Only
 *  unanswered rows: an invitation you have answered is not waiting on you,
 *  whichever way you answered. */
export function waitingCount(myInvites: readonly InviteRow[]): number {
  return myInvites.filter((i) => i.status === 'pending').length;
}

/**
 * Oldest first — the opposite of every other list in this app.
 *
 * Elsewhere newest-first is right because the newest thing is the most
 * interesting. An invitation is not interesting, it is owed: somebody is
 * waiting on an answer, and the one who has waited longest is the one to
 * answer next. Same reasoning as the reports queue on the desk.
 *
 * Answered rows sink below the unanswered ones rather than being dropped,
 * so the reader can see what they just did.
 */
export function sortInvites(invites: readonly InviteRow[]): InviteRow[] {
  const rank = (i: InviteRow) => (i.status === 'pending' ? 0 : 1);
  return [...invites].sort(
    (a, b) => rank(a) - rank(b) || a.created_at.localeCompare(b.created_at),
  );
}

export type Crew = {
  /** Everyone who said yes, in the order they were asked. */
  accepted: InviteRow[];
  /** Still to answer. */
  pending: InviteRow[];
  /** Said no. Kept, because the owner is planning around the number. */
  declined: InviteRow[];
};

/** The owner's view of one trip's invitations, in three piles. */
export function crewOf(invites: readonly InviteRow[]): Crew {
  const by = (s: InviteRow['status']) => invites
    .filter((i) => i.status === s)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { accepted: by('accepted'), pending: by('pending'), declined: by('declined') };
}

/**
 * How many people the evening is currently for.
 *
 * The owner plus everyone who has accepted. Pending rows are deliberately
 * NOT counted: the number is what a table would be booked for, and counting
 * a maybe would book a seat nobody has agreed to sit in.
 *
 * Always at least one — there is no trip without the person who planned it.
 */
export function headcount(crew: Crew): number {
  return 1 + crew.accepted.length;
}

/** Whether the sheet may send any more. The cap is the server's; this is
 *  the app knowing it so it can grey the row out instead of letting the
 *  press fail. */
export function roomLeft(invites: readonly InviteRow[]): number {
  return Math.max(0, INVITE_CAP - invites.length);
}

/**
 * Who the invite sheet may offer, and in what state each row starts.
 *
 * Friends only — the insert policy refuses anybody else, so listing them
 * would be offering a button that cannot work. An existing invitation is
 * not hidden: it comes back already ticked, because the sheet is the one
 * place that answers "who did I ask?" and a name quietly missing from it
 * reads as having forgotten to ask them.
 *
 * `locked` is the row the reader may not untick — an answered invitation.
 * Withdrawing is only allowed while it is unanswered (see the delete
 * policy), and a checkbox that springs back is worse than one that does
 * not move.
 */
export type Candidate = { id: string; invited: boolean; locked: boolean };

export function candidates(
  friendIds: readonly string[], invites: readonly InviteRow[],
): Candidate[] {
  const byId = new Map(invites.map((i) => [i.invitee_id, i]));
  return friendIds.map((id) => {
    const inv = byId.get(id);
    return {
      id,
      invited: !!inv,
      locked: !!inv && inv.status !== 'pending',
    };
  });
}

/**
 * What pressing Send actually has to do, given what the reader ticked.
 *
 * Two lists rather than one "set the selection to this", because they are
 * two different statements against two different policies — an insert the
 * owner is allowed on any friend, and a delete the owner is allowed only
 * while the invitation is unanswered. Working it out here means the screen
 * never sends a withdrawal the server will refuse.
 *
 * A locked row can appear in neither: it is already answered, so it cannot
 * be re-sent and it cannot be taken back.
 */
export function diffSelection(
  before: readonly Candidate[], selected: ReadonlySet<string>,
): { invite: string[]; withdraw: string[] } {
  const invite: string[] = [];
  const withdraw: string[] = [];
  for (const c of before) {
    if (c.locked) continue;
    if (selected.has(c.id) && !c.invited) invite.push(c.id);
    if (!selected.has(c.id) && c.invited) withdraw.push(c.id);
  }
  return { invite, withdraw };
}
