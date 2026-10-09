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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { InviteRow } from './invites';
import { appStateStub } from '../uitest/appState';
import { STALE_MS } from './stale';

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

  // Two asks in flight, answered out of order: the older one must land on
  // nothing. Without these two the `live` guard was reached or not by
  // timing alone — the same file read 86.11% of branches on one run and
  // 82.85% on the next, and CI turned red on the providers' floor over a
  // change that touched no provider. Each ask is held open here and let
  // go by hand, so the order is the test's and not the scheduler's.
  //
  // Between the two asks trip-b is declined, so the older ask is the only
  // one that knows about it — which is what makes a late answer visible.
  const heldAsk = () => {
    let settle!: { ok: (m: Record<string, { accepted: number }>) => void; fail: () => void };
    fetchCrewCounts.mockImplementationOnce(() => new Promise((ok, fail) => {
      settle = { ok, fail: () => fail(new Error('offline')) };
    }));
    return () => settle;
  };

  it('an older answer that lands late does not overwrite a newer one', async () => {
    const first = heldAsk();
    mount();
    await waitFor(() => expect(fetchCrewCounts).toHaveBeenCalledTimes(1));
    world.rows = [asked('trip-a', 'pending'), asked('trip-b', 'declined')];
    refresh();
    await waitFor(() => expect(screen.getByTestId('counts').textContent).toBe('{"trip-a":1}'));

    first().ok({ 'trip-a': { accepted: 9 }, 'trip-b': { accepted: 9 } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId('counts').textContent).toBe('{"trip-a":1}');
  });

  it('an older failure that lands late marks nothing failed', async () => {
    const first = heldAsk();
    mount();
    await waitFor(() => expect(fetchCrewCounts).toHaveBeenCalledTimes(1));
    world.rows = [asked('trip-a', 'pending'), asked('trip-b', 'declined')];
    refresh();
    await waitFor(() => expect(screen.getByTestId('counts').textContent).toBe('{"trip-a":1}'));

    first().fail();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId('counts').textContent).toBe('{"trip-a":1}');
  });
});

// Coming back from the background asks again — but only for a list older
// than `STALE_MS`, and not on the way out: iOS reports `active` after every
// notification shade, and a request per glance is not what this is for.
describe('coming back to the foreground', () => {
  let app: ReturnType<typeof appStateStub>;
  beforeEach(() => { app = appStateStub(); });
  afterEach(() => { app.restore(); });

  const settle = async () => {
    mount();
    await waitFor(() => expect(fetchInvites).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('rows').textContent !== '0').toBeTruthy());
    fetchInvites.mockClear();
  };

  it('asks again once the list has gone stale', async () => {
    await settle();
    app.later(STALE_MS + 1000);
    app.emit('active');
    await waitFor(() => expect(fetchInvites).toHaveBeenCalledOnce());
  });

  it('leaves a list younger than that alone', async () => {
    await settle();
    app.later(STALE_MS - 1000);
    app.emit('active');
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchInvites).not.toHaveBeenCalled();
  });

  it('does nothing on the way to the background', async () => {
    await settle();
    app.later(STALE_MS + 1000);
    app.emit('background');
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchInvites).not.toHaveBeenCalled();
  });
});
