import { describe, expect, it } from 'vitest';
import {
  candidates, companySeats, crewOf, diffSelection, headcount, INVITE_CAP, roomLeft,
  sortInvites, splitByStanding, standingOn, togglePick, waitingCount, type InviteRow,
} from './invites';

const inv = (over: Partial<InviteRow> = {}): InviteRow => ({
  trip_id: 't1',
  invitee_id: 'friend',
  inviter_id: 'owner',
  status: 'pending',
  created_at: '2026-08-26T10:00:00Z',
  ...over,
});

describe('standingOn', () => {
  it('the planner owns it however many invitations there are', () => {
    expect(standingOn('me', 'me', [])).toBe('owned');
    expect(standingOn('me', 'me', [inv({ invitee_id: 'me' })])).toBe('owned');
  });

  it('reads the reader’s own row, not somebody else’s', () => {
    const rows = [inv({ invitee_id: 'other', status: 'accepted' })];
    expect(standingOn('owner', 'me', rows)).toBe('none');
    expect(standingOn('owner', 'other', rows)).toBe('joined');
  });

  it('is still asked while the answer is owed', () => {
    expect(standingOn('owner', 'me', [inv({ invitee_id: 'me', status: 'pending' })]))
      .toBe('asked');
  });

  it('keeps a refusal apart from never having been asked', () => {
    expect(standingOn('owner', 'me', [inv({ invitee_id: 'me', status: 'declined' })]))
      .toBe('declined');
    expect(standingOn('owner', 'me', [])).toBe('none');
  });
});

describe('splitByStanding', () => {
  const trips = [
    { id: 'own', owner_id: 'me' },
    { id: 'yes', owner_id: 'owner' },
    { id: 'ask', owner_id: 'owner' },
    { id: 'no', owner_id: 'owner' },
    { id: 'stray', owner_id: 'owner' },
  ];
  const mine = [
    inv({ trip_id: 'yes', invitee_id: 'me', status: 'accepted' }),
    inv({ trip_id: 'ask', invitee_id: 'me', status: 'pending' }),
    inv({ trip_id: 'no', invitee_id: 'me', status: 'declined' }),
  ];

  it('puts an accepted trip in the reader’s own list, beside the ones they planned', () => {
    const { mine: ours } = splitByStanding(trips, 'me', mine);
    expect(ours.map((t) => t.id)).toEqual(['own', 'yes']);
  });

  it('keeps an unanswered invitation out of the plans they have agreed to', () => {
    const { asked } = splitByStanding(trips, 'me', mine);
    expect(asked.map((t) => t.id)).toEqual(['ask']);
  });

  it('draws a declined trip nowhere — the policy has already stopped returning it', () => {
    const { mine: ours, asked } = splitByStanding(trips, 'me', mine);
    expect(ours.map((t) => t.id)).not.toContain('no');
    expect(asked.map((t) => t.id)).not.toContain('no');
  });

  it('drops a trip nothing explains rather than guessing a pile for it', () => {
    // 'stray' has no invitation and another owner: RLS should never have
    // returned it. Showing it anyway would be the app inventing access.
    const { mine: ours, asked } = splitByStanding(trips, 'me', mine);
    expect([...ours, ...asked].map((t) => t.id)).not.toContain('stray');
  });
});

describe('waitingCount', () => {
  it('counts only what is still owed an answer', () => {
    expect(waitingCount([
      inv({ status: 'pending' }),
      inv({ trip_id: 't2', status: 'pending' }),
      inv({ trip_id: 't3', status: 'accepted' }),
      inv({ trip_id: 't4', status: 'declined' }),
    ])).toBe(2);
    expect(waitingCount([])).toBe(0);
  });
});

describe('sortInvites', () => {
  it('answers the longest wait first — an invitation is owed, not news', () => {
    const rows = [
      inv({ trip_id: 'new', created_at: '2026-08-26T12:00:00Z' }),
      inv({ trip_id: 'old', created_at: '2026-08-24T09:00:00Z' }),
      inv({ trip_id: 'mid', created_at: '2026-08-25T09:00:00Z' }),
    ];
    expect(sortInvites(rows).map((i) => i.trip_id)).toEqual(['old', 'mid', 'new']);
  });

  it('sinks answered rows without dropping them', () => {
    const rows = [
      inv({ trip_id: 'done', status: 'accepted', created_at: '2026-08-20T09:00:00Z' }),
      inv({ trip_id: 'owed', created_at: '2026-08-26T09:00:00Z' }),
    ];
    expect(sortInvites(rows).map((i) => i.trip_id)).toEqual(['owed', 'done']);
  });

  it('does not disturb its input', () => {
    const rows = [inv({ trip_id: 'b', created_at: '2026-08-26T09:00:00Z' }),
      inv({ trip_id: 'a', created_at: '2026-08-24T09:00:00Z' })];
    sortInvites(rows);
    expect(rows.map((i) => i.trip_id)).toEqual(['b', 'a']);
  });
});

describe('crewOf and headcount', () => {
  const rows = [
    inv({ invitee_id: 'c', status: 'accepted', created_at: '2026-08-26T12:00:00Z' }),
    inv({ invitee_id: 'a', status: 'accepted', created_at: '2026-08-26T09:00:00Z' }),
    inv({ invitee_id: 'b', status: 'pending' }),
    inv({ invitee_id: 'd', status: 'declined' }),
  ];

  it('sorts each pile by when they were asked', () => {
    expect(crewOf(rows).accepted.map((i) => i.invitee_id)).toEqual(['a', 'c']);
  });

  it('keeps a refusal, because the owner is planning around the number', () => {
    expect(crewOf(rows).declined.map((i) => i.invitee_id)).toEqual(['d']);
  });

  it('counts the planner plus everyone who said yes', () => {
    expect(headcount(crewOf(rows))).toBe(3);
  });

  it('never counts a maybe — the number is what a table is booked for', () => {
    const onlyPending = crewOf([inv({ status: 'pending' }), inv({ invitee_id: 'x' })]);
    expect(headcount(onlyPending)).toBe(1);
  });

  it('is one for a trip nobody was asked to', () => {
    expect(headcount(crewOf([]))).toBe(1);
  });
});

describe('roomLeft', () => {
  it('mirrors the server cap', () => {
    expect(roomLeft([])).toBe(INVITE_CAP);
    expect(roomLeft(Array.from({ length: INVITE_CAP }, (_, i) =>
      inv({ invitee_id: `p${i}` })))).toBe(0);
  });

  it('never goes negative if the server let one more through', () => {
    expect(roomLeft(Array.from({ length: INVITE_CAP + 3 }, (_, i) =>
      inv({ invitee_id: `p${i}` })))).toBe(0);
  });
});

describe('candidates', () => {
  it('shows an already-invited friend ticked rather than missing', () => {
    const rows = candidates(['a', 'b'], [inv({ invitee_id: 'a' })]);
    expect(rows).toEqual([
      { id: 'a', invited: true, locked: false, seated: true },
      { id: 'b', invited: false, locked: false, seated: false },
    ]);
  });

  it('locks an answered invitation — it cannot be withdrawn', () => {
    const rows = candidates(['a', 'b'], [
      inv({ invitee_id: 'a', status: 'accepted' }),
      inv({ invitee_id: 'b', status: 'declined' }),
    ]);
    expect(rows.every((r) => r.locked)).toBe(true);
  });

  it('seats the pending and the accepted, never the refusal', () => {
    const rows = candidates(['a', 'b', 'c'], [
      inv({ invitee_id: 'a', status: 'accepted' }),
      inv({ invitee_id: 'b', status: 'declined' }),
      inv({ invitee_id: 'c' }),
    ]);
    expect(rows.map((r) => r.seated)).toEqual([true, false, true]);
  });

  it('keeps the order the crew list gave it', () => {
    expect(candidates(['c', 'a', 'b'], []).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('companySeats', () => {
  it('gives a couple one guest seat, solo none, and the rest no ceiling', () => {
    expect(companySeats('couple')).toBe(1);
    expect(companySeats('solo')).toBe(0);
    expect(companySeats('friends')).toBeNull();
    expect(companySeats('family')).toBeNull();
    expect(companySeats(null)).toBeNull();
  });
});

describe('togglePick', () => {
  const free = candidates(['a', 'b', 'c'], []);

  it('unticks without asking about seats', () => {
    expect(togglePick(free, new Set(['a']), 'a', 1)).toEqual(new Set());
  });

  it('collects ticks freely when the company names no size', () => {
    expect(togglePick(free, new Set(['a', 'b']), 'c', null))
      .toEqual(new Set(['a', 'b', 'c']));
  });

  it('swaps on a couple: the second pick steps the first aside', () => {
    expect(togglePick(free, new Set(['a']), 'b', 1)).toEqual(new Set(['b']));
  });

  it('withdraws a pending guest by the same swap', () => {
    const rows = candidates(['a', 'b'], [inv({ invitee_id: 'a' })]);
    // 'a' seeded ticked (pending). Picking 'b' unticks 'a' — Send will
    // withdraw one and invite the other in the same press.
    expect(togglePick(rows, new Set(['a']), 'b', 1)).toEqual(new Set(['b']));
  });

  it('refuses the tap when an answered guest fills the couple', () => {
    const rows = candidates(['a', 'b'], [inv({ invitee_id: 'a', status: 'accepted' })]);
    expect(togglePick(rows, new Set(['a']), 'b', 1)).toEqual(new Set(['a']));
  });

  it('lets a refusal give its seat back', () => {
    // 'a' declined: locked, seeded ticked, but seatless — the couple's
    // one guest seat is open for 'b'.
    const rows = candidates(['a', 'b'], [inv({ invitee_id: 'a', status: 'declined' })]);
    expect(togglePick(rows, new Set(['a']), 'b', 1)).toEqual(new Set(['a', 'b']));
  });
});

describe('diffSelection', () => {
  const before = candidates(['new', 'already', 'drop', 'joined'], [
    inv({ invitee_id: 'already' }),
    inv({ invitee_id: 'drop' }),
    inv({ invitee_id: 'joined', status: 'accepted' }),
  ]);

  it('sends only what is not already sent', () => {
    const { invite } = diffSelection(before, new Set(['new', 'already', 'joined']));
    expect(invite).toEqual(['new']);
  });

  it('withdraws an unticked invitation that has not been answered', () => {
    const { withdraw } = diffSelection(before, new Set(['already', 'joined']));
    expect(withdraw).toEqual(['drop']);
  });

  it('never proposes a statement the server would refuse on an answered row', () => {
    // 'joined' unticked: the delete policy only reaches pending rows, so
    // proposing it would be a press that fails.
    const { invite, withdraw } = diffSelection(before, new Set(['already']));
    expect(invite).toEqual([]);
    expect(withdraw).toEqual(['drop']);
  });

  it('is empty when nothing moved', () => {
    const { invite, withdraw } = diffSelection(before, new Set(['already', 'drop', 'joined']));
    expect(invite).toEqual([]);
    expect(withdraw).toEqual([]);
  });
});
