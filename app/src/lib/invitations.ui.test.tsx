// @vitest-environment jsdom
//
// The invitations provider's promises, rendered.
//
// The screens read three things from it: the list, the badge, and — since
// #364, the flicker fix — the batched crew counts a detail screen opens
// already holding. The batch is the part with rules worth pinning: it is
// asked once per answer, only over trips the reader was asked onto and
// has not declined, a number on screen outlives a failed refresh, and
// only a trip that was never answered wears the failure. All of that is
// worthless if the counts never reach a consumer, so every assertion here
// reads them through the context the way a screen would.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { InviteRow } from './invites';

const world = vi.hoisted(() => ({
  ready: true,
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
  rows: [] as unknown[],
}));
// A copy per call, the way a network answer is a fresh array every time —
// the batch effect keys on the list's identity, and a mock that hands the
// same reference back would pin behaviour no server has.
const fetchInvites = vi.hoisted(() => vi.fn(async () => [...world.rows]));
const fetchCrewCounts = vi.hoisted(() => vi.fn(async (ids: string[]) => Object.fromEntries(
  ids.map((id, i) => [id, { accepted: i + 1 }]),
)));

vi.mock('./auth', () => ({ useAuth: () => ({ ready: world.ready, session: world.session }) }));
vi.mock('./data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchInvites,
  fetchCrewCounts,
}));

import { InvitationsProvider, useInvitations } from './invitations';

const asked = (
  trip: string,
  status: InviteRow['status'],
  invitee = 'me',
): InviteRow => ({
  trip_id: trip, invitee_id: invitee, inviter_id: 'host', status, created_at: '2026-08-28T00:00:00Z',
});

/** A consumer, because `useInvitations` is the whole surface under test. */
function Probe() {
  const { invites, waiting, crewCounts } = useInvitations();
  return (
    <>
      <span data-testid="rows">{String(invites.data.length)}</span>
      <span data-testid="waiting">{String(waiting)}</span>
      <span data-testid="counts">{JSON.stringify(crewCounts)}</span>
      <button type="button" onClick={() => invites.reload()}>refresh</button>
    </>
  );
}

const mount = () => render(<InvitationsProvider><Probe /></InvitationsProvider>);
const refresh = () => fireEvent.click(screen.getByText('refresh'));

beforeEach(() => {
  world.ready = true;
  world.session = { user: { id: 'me' } };
  world.rows = [
    asked('trip-a', 'pending'),
    asked('trip-b', 'accepted'),
    asked('trip-c', 'declined'),
    // The owner's side of the table: a row the reader sent, not one they
    // were asked with. Neither the badge nor the batch may count it.
    asked('trip-d', 'pending', 'somebody-else'),
  ];
  fetchInvites.mockClear();
  fetchCrewCounts.mockClear();
});

describe('who is asking', () => {
  it('holds the question until auth has decided', async () => {
    world.ready = false;
    mount();
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('0'));
    expect(fetchInvites).not.toHaveBeenCalled();
  });
});

describe('the batch', () => {
  it('asks once, for exactly the trips you were asked onto — and the screens can read the answer', async () => {
    mount();
    // Declined trips are unreadable and unasked; the owner-side row is
    // not an invitation to the reader at all.
    await waitFor(() => expect(fetchCrewCounts).toHaveBeenCalledWith(['trip-a', 'trip-b']));
    expect(fetchCrewCounts).toHaveBeenCalledTimes(1);
    // Through the context, the way TripDetail reads it — a count the
    // provider holds but never serves is the flicker coming back.
    await waitFor(() => expect(screen.getByTestId('counts').textContent)
      .toBe('{"trip-a":1,"trip-b":2}'));
    // And the badge: one unanswered invitation addressed to the reader.
    expect(screen.getByTestId('waiting').textContent).toBe('1');
  });

  it('a number on screen outlives a failed refresh; only the never-answered wear the failure', async () => {
    // First ask dies — every asked trip is marked failed, because none
    // of them ever had a number.
    fetchCrewCounts.mockImplementationOnce(async () => { throw new Error('offline'); });
    mount();
    await waitFor(() => expect(screen.getByTestId('counts').textContent)
      .toBe('{"trip-a":null,"trip-b":null}'));

    // A refresh lands — the failures are replaced by numbers.
    refresh();
    await waitFor(() => expect(screen.getByTestId('counts').textContent)
      .toBe('{"trip-a":1,"trip-b":2}'));

    // And another refresh dies — the numbers stand. A count already on
    // screen is not taken down by one failed round trip.
    fetchCrewCounts.mockImplementationOnce(async () => { throw new Error('offline'); });
    refresh();
    await waitFor(() => expect(fetchCrewCounts).toHaveBeenCalledTimes(3));
    expect(screen.getByTestId('counts').textContent).toBe('{"trip-a":1,"trip-b":2}');
  });
});
