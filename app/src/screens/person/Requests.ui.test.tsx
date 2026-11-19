// @vitest-environment jsdom
//
// The friend requests waiting, on your own page (owner, 19 Nov 2026 —
// docs/profile-home-plan.md): the commonest reason for the last tab's
// dot, in sight where the tab opens.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../uitest/render';
import type { FriendshipRow } from '../../lib/friends';
import { askers, Requests } from './Requests';

const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[] },
  people: {} as Record<string, { id: string; handle: string; full_name: string; avatar_url: string }>,
}));
vi.mock('../../lib/crew', () => ({ useCrew: () => crew }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));
vi.mock('../../lib/theme', () => ({ useScheme: () => ({ scheme: 'light' }) }));

const row = (requester: string, at: string, addressee = 'me'): FriendshipRow =>
  ({ requester, addressee, status: 'pending', created_at: at }) as FriendshipRow;
const face = (id: string, full_name: string) => ({ id, handle: id, full_name, avatar_url: '' });

beforeEach(() => {
  crew.ships.data = [];
  crew.people = {};
});

describe('Requests', () => {
  it('says how many, who, and is one way to Friends', () => {
    crew.ships.data = [row('mai', '2026-11-18T10:00:00Z'), row('vu', '2026-11-19T10:00:00Z')];
    crew.people = { mai: face('mai', 'Mai Anh'), vu: face('vu', 'Quang Vũ') };
    const open = vi.fn();
    render(<Requests me="me" onOpen={open} />);
    const card = screen.getByTestId('person-requests');
    expect(card.textContent).toContain('2 friend requests');
    // Newest first, as Friends lists them.
    expect(card.textContent).toContain('Quang Vũ and Mai Anh want to be friends');
    expect(screen.getAllByTestId('person-requests-face')).toHaveLength(2);
    fireEvent.click(card);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('draws two faces at most', () => {
    crew.ships.data = ['a', 'b', 'c'].map((id, i) => row(id, `2026-11-1${i}T10:00:00Z`));
    crew.people = { a: face('a', 'A'), b: face('b', 'B'), c: face('c', 'C') };
    render(<Requests me="me" onOpen={() => {}} />);
    expect(screen.getAllByTestId('person-requests-face')).toHaveLength(2);
    expect(screen.getByTestId('person-requests').textContent).toContain('C and 2 others want to be friends');
  });

  it('is nothing when nobody waits, nor for a request you sent', () => {
    crew.ships.data = [row('me', '2026-11-19T10:00:00Z', 'vu')];
    render(<Requests me="me" onOpen={() => {}} />);
    expect(screen.queryByTestId('person-requests')).toBeNull();
  });

  it('says the count alone before the faces have come', () => {
    crew.ships.data = [row('mai', '2026-11-18T10:00:00Z')];
    render(<Requests me="me" onOpen={() => {}} />);
    expect(screen.getByTestId('person-requests').textContent).toBe('1 friend request');
    expect(screen.queryAllByTestId('person-requests-face')).toHaveLength(0);
  });
});

describe('askers', () => {
  const t = (en: string) => en;
  it('says one name, two, or the first and how many more', () => {
    expect(askers([], 3, t)).toBeNull();
    expect(askers(['Mai'], 1, t)).toBe('Mai wants to be friends');
    expect(askers(['Mai', 'Vu'], 2, t)).toBe('Mai and Vu want to be friends');
    // The second face not yet come: the first, and one other.
    expect(askers(['Mai'], 2, t)).toBe('Mai and 1 other want to be friends');
    expect(askers(['Mai', 'Vu', 'Lan'], 3, t)).toBe('Mai and 2 others want to be friends');
  });
});
