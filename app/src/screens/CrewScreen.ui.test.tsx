// @vitest-environment jsdom
//
// The crew screen is where friendships are made, answered and ended, so
// what is pinned here is which verb reaches which write, and with the
// arguments in which order: `acceptFriendRequest(requester, me)` and
// `removeFriendship(requester, me)` are one swapped argument apart from
// silently acting on the wrong edge. Also pinned: that every irreversible
// step (unfriend, block, unblock) waits for the native confirmation, that
// the add-by-handle flow speaks the right sentence for every standing,
// and that a block refusal is worded neutrally rather than announcing
// itself. The pure halves (`splitFriendships`, `standingWith`,
// `openSuggestions`) run for real; only the I/O seams are mocked.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '../uitest/render';
import type { Nav } from '../nav';
import type { FriendshipRow, Suggestion } from '../lib/friends';
import type { FriendProfile } from '../lib/data';

const ME = 'me';

// `Alert` from react-native-web is a silent no-op, and the setup's spy sits
// on a path the alias never reaches, so the confirmation is caught at the
// import the screen actually uses.
const alert = vi.hoisted(() => vi.fn<(
  title: string, body?: string, buttons?: { text?: string; style?: string; onPress?: () => void }[],
) => void>());
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));

const data = vi.hoisted(() => ({
  acceptFriendRequest: vi.fn(async () => {}),
  removeFriendship: vi.fn(async () => {}),
  blockUser: vi.fn(async () => {}),
  unblockUser: vi.fn(async () => {}),
  sendFriendRequest: vi.fn(async () => {}),
  fetchSuggestedFriends: vi.fn(async (): Promise<Suggestion[]> => []),
  fetchProfilesById: vi.fn(async (): Promise<FriendProfile[]> => []),
  profileByHandle: vi.fn(async (): Promise<FriendProfile | null> => null),
  searchHandles: vi.fn(async (): Promise<FriendProfile[]> => []),
}));
vi.mock('../lib/data', () => data);

const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[], loading: false, loadedAt: 1 as number | null, reload: vi.fn() },
  blocks: { data: [] as string[], reload: vi.fn() },
  people: {} as Record<string, FriendProfile>,
  mutual: {} as Record<string, number>,
  absorb: vi.fn(),
}));
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: { user: { id: 'me' } } }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

// The report sheet is its own flow with its own tests; what this screen
// owes it is the right target, so the hook is a spy.
const report = vi.hoisted(() => vi.fn());
vi.mock('../components/reportFlow', () => ({ useReport: () => ({ report, node: null }) }));

import CrewScreen from './CrewScreen';

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
}) as unknown as Nav;

const person = (id: string, handle: string, full_name = ''): FriendProfile =>
  ({ id, handle, full_name, avatar_url: '' }) as FriendProfile;

const edge = (requester: string, addressee: string, status: FriendshipRow['status'], at = '2026-01-01'): FriendshipRow =>
  ({ requester, addressee, status, created_at: at });

/** Presses the destructive button of the last confirmation raised. */
const confirmLast = () => {
  const buttons = alert.mock.calls.at(-1)![2]!;
  buttons.find((b) => b.style === 'destructive')!.onPress!();
};

/** PersonSheet runs an action 220ms after it closes, so waits for it. */
const pickSheetAction = async (name: string | RegExp) => {
  fireEvent.click(await screen.findByRole('button', { name }));
};

const tab = (name: RegExp) => screen.getByRole('tab', { name });

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of [data.acceptFriendRequest, data.removeFriendship, data.blockUser, data.unblockUser, data.sendFriendRequest]) {
    fn.mockImplementation(async () => {});
  }
  data.fetchSuggestedFriends.mockImplementation(async () => []);
  data.fetchProfilesById.mockImplementation(async () => []);
  data.profileByHandle.mockImplementation(async () => null);
  data.searchHandles.mockImplementation(async () => []);
  crew.ships.data = [];
  crew.ships.loading = false;
  crew.ships.loadedAt = 1;
  crew.blocks.data = [];
  crew.people = {};
  crew.mutual = {};
});

describe('the frame', () => {
  it('names itself and goes back through the navigation prop', () => {
    const navigation = nav();
    render(<CrewScreen navigation={navigation} />);
    expect(screen.getByText('Your crew')).toBeTruthy();
    expect(screen.getByText('Plans get better together')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('asks the server again on focus, unless the launch fetch is still in flight', () => {
    const { unmount } = render(<CrewScreen navigation={nav()} />);
    expect(crew.ships.reload).toHaveBeenCalledTimes(1);
    unmount();
    crew.ships.reload.mockClear();
    crew.ships.loading = true;
    render(<CrewScreen navigation={nav()} />);
    expect(crew.ships.reload).not.toHaveBeenCalled();
  });
});

describe('which tab opens', () => {
  it('opens on Your friends when nobody is waiting, with the tally in the name', () => {
    crew.ships.data = [edge(ME, 'a', 'accepted'), edge('b', ME, 'accepted')];
    crew.people = { a: person('a', 'anh', 'Anh'), b: person('b', 'bao') };
    render(<CrewScreen navigation={nav()} />);
    expect(tab(/Your friends/).textContent).toContain('Your friends (2)');
    expect(screen.getByText('Anh')).toBeTruthy();
    // No full name: the handle stands in as the name.
    expect(screen.getAllByText('@bao').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('opens on Requests when somebody is waiting, and badges nothing on the open tab', () => {
    crew.ships.data = [edge('r', ME, 'pending')];
    crew.people = { r: person('r', 'minh', 'Minh') };
    render(<CrewScreen navigation={nav()} />);
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Minh')).toBeTruthy();
    expect(screen.getByText('wants to join your crew')).toBeTruthy();
    expect(tab(/Requests/).textContent).toContain('Requests (1)');
  });

  it('waits for the edges to land before choosing, then never re-picks', () => {
    crew.ships.loadedAt = null;
    crew.ships.data = [edge('r', ME, 'pending')];
    const { rerender } = render(<CrewScreen navigation={nav()} />);
    expect(screen.queryByText('Pending')).toBeNull();

    crew.ships.loadedAt = 2;
    rerender(<CrewScreen navigation={nav()} />);
    expect(screen.getByText('Pending')).toBeTruthy();

    // The reader chooses Friends; a reload that brings another request
    // must not drag them back.
    fireEvent.click(tab(/Your friends/));
    crew.ships.data = [...crew.ships.data, edge('s', ME, 'pending', '2026-02-01')];
    crew.ships.loadedAt = 3;
    rerender(<CrewScreen navigation={nav()} />);
    expect(screen.queryByText('Pending')).toBeNull();
    // ...and the unchosen Requests tab rings with the count instead.
    expect(tab(/Requests/).textContent).toBe('Requests2');
  });
});

describe('answering a request', () => {
  beforeEach(() => {
    crew.ships.data = [edge('r', ME, 'pending')];
    crew.people = { r: person('r', 'minh', 'Minh') };
  });

  it('Accept accepts the requester’s edge and reloads', async () => {
    render(<CrewScreen navigation={nav()} />);
    crew.ships.reload.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Accept/ }));
    expect(data.acceptFriendRequest).toHaveBeenCalledWith('r', ME);
    expect(data.removeFriendship).not.toHaveBeenCalled();
    await waitFor(() => expect(crew.ships.reload).toHaveBeenCalled());
  });

  it('Decline removes the edge, silently and without a confirmation', async () => {
    render(<CrewScreen navigation={nav()} />);
    crew.ships.reload.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(data.removeFriendship).toHaveBeenCalledWith('r', ME);
    expect(data.acceptFriendRequest).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    await waitFor(() => expect(crew.ships.reload).toHaveBeenCalled());
  });

  // It used to leave the list as it was and say nothing at all, so a
  // dropped connection read the same as a tap that missed.
  it('a failed answer leaves the list as it was, and says so', async () => {
    data.acceptFriendRequest.mockImplementation(async () => { throw new Error('offline'); });
    render(<CrewScreen navigation={nav()} />);
    crew.ships.reload.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Accept/ }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not accept the request', 'offline'));
    expect(crew.ships.reload).not.toHaveBeenCalled();
  });

  it('says so when a decline fails too', async () => {
    data.removeFriendship.mockImplementation(async () => { throw new Error('offline'); });
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not decline the request', 'offline'));
  });

  it('takes one answer per request while it is in flight, and dims both buttons', async () => {
    let settle!: () => void;
    data.acceptFriendRequest.mockImplementation(() => new Promise<void>((ok) => { settle = ok; }));
    render(<CrewScreen navigation={nav()} />);
    const accept = screen.getByRole('button', { name: /Accept/ });
    fireEvent.click(accept);
    fireEvent.click(accept);
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(data.acceptFriendRequest).toHaveBeenCalledTimes(1);
    expect(data.removeFriendship).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Accept/ }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Decline' }).getAttribute('aria-disabled')).toBe('true');
    settle();
    await waitFor(() => expect(screen.getByRole('button', { name: /Accept/ }).getAttribute('aria-disabled')).not.toBe('true'));
  });

  it('the options sheet can decline, and decline-and-block only after confirming', async () => {
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    await pickSheetAction('Decline and block');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toBe('Block @minh?');
    expect(data.blockUser).not.toHaveBeenCalled();
    confirmLast();
    expect(data.blockUser).toHaveBeenCalledWith('r');
    await waitFor(() => expect(crew.blocks.reload).toHaveBeenCalled());
  });

  it('the sheet’s own Decline declines', async () => {
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    const dialog = await screen.findByRole('button', { name: 'Report @minh' });
    expect(dialog).toBeTruthy();
    const declines = screen.getAllByRole('button', { name: 'Decline' });
    fireEvent.click(declines.at(-1)!);
    await waitFor(() => expect(data.removeFriendship).toHaveBeenCalledWith('r', ME));
  });

  it('a request from a profile not yet loaded offers only Decline', async () => {
    crew.people = {};
    render(<CrewScreen navigation={nav()} />);
    expect(screen.getByText('…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(await screen.findByText('This request')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /block/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Report/ })).toBeNull();
  });

  it('reporting from the sheet hands the desk the profile', async () => {
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    await pickSheetAction('Report @minh');
    await waitFor(() => expect(report).toHaveBeenCalledWith({
      kind: 'profile', id: 'r', name: 'Minh', avatarUrl: undefined,
    }));
  });
});

describe('a request you sent', () => {
  beforeEach(() => {
    crew.ships.data = [edge(ME, 'o', 'pending'), edge('r', ME, 'pending')];
    crew.people = { o: person('o', 'oanh', 'Oanh') };
  });

  it('is listed as waiting, and Cancel withdraws it through the sheet', async () => {
    render(<CrewScreen navigation={nav()} />);
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(screen.getByText('@oanh · waiting on their answer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await pickSheetAction('Cancel the request');
    await waitFor(() => expect(data.removeFriendship).toHaveBeenCalledWith(ME, 'o'));
    expect(alert).not.toHaveBeenCalled();
  });

  it('cancel-and-block confirms before blocking', async () => {
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await pickSheetAction('Cancel and block');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(data.blockUser).not.toHaveBeenCalled();
    confirmLast();
    expect(data.blockUser).toHaveBeenCalledWith('o');
  });
});

describe('your friends', () => {
  beforeEach(() => {
    crew.ships.data = [edge(ME, 'a', 'accepted')];
    crew.people = { a: person('a', 'anh', 'Anh') };
    crew.mutual = { a: 3 };
  });

  it('shows how many places you both save', () => {
    render(<CrewScreen navigation={nav()} />);
    expect(screen.getByText('@anh · 3 mutual saves')).toBeTruthy();
  });

  it('says “1 mutual save” in the singular', () => {
    crew.mutual = { a: 1 };
    render(<CrewScreen navigation={nav()} />);
    expect(screen.getByText('@anh · 1 mutual save')).toBeTruthy();
  });

  it('unfriends only after the confirmation, and Cancel there does nothing', async () => {
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    // The sheet says who it is about: the same line appears a second time.
    expect(await screen.findAllByText('@anh · 3 mutual saves')).toHaveLength(2);
    await pickSheetAction('Unfriend @anh');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    const [title, body, buttons] = alert.mock.calls[0];
    expect(title).toBe('Unfriend @anh?');
    expect(body).toBe('They will not be told.');
    expect(buttons!.map((b) => b.text)).toEqual(['Cancel', 'Unfriend']);
    expect(buttons![0].onPress).toBeUndefined();
    expect(data.removeFriendship).not.toHaveBeenCalled();
    confirmLast();
    expect(data.removeFriendship).toHaveBeenCalledWith(ME, 'a');
    await waitFor(() => expect(crew.ships.reload).toHaveBeenCalled());
  });

  it('blocks after confirming, and refreshes both edges and blocks', async () => {
    render(<CrewScreen navigation={nav()} />);
    crew.ships.reload.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    await pickSheetAction('Block @anh');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toBe('Block @anh?');
    confirmLast();
    expect(data.blockUser).toHaveBeenCalledWith('a');
    await waitFor(() => {
      expect(crew.ships.reload).toHaveBeenCalled();
      expect(crew.blocks.reload).toHaveBeenCalled();
    });
  });

  it('a long press on the row opens the same sheet', async () => {
    render(<CrewScreen navigation={nav()} />);
    const row = screen.getByLabelText('@anh');
    // react-native-web's responder turns a press held past 500ms into a
    // long press.
    fireEvent.mouseDown(row);
    await new Promise((r) => setTimeout(r, 600));
    fireEvent.mouseUp(row);
    expect(await screen.findByRole('button', { name: 'Unfriend @anh' })).toBeTruthy();
  });
});

describe('the blocked list', () => {
  it('lists blocks under the friends and unblocks after confirming', async () => {
    crew.blocks.data = ['x'];
    crew.people = { x: person('x', 'xuan', 'Xuan') };
    render(<CrewScreen navigation={nav()} />);
    expect(screen.getByText('Blocked')).toBeTruthy();
    expect(screen.getByText('Xuan')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    expect(alert.mock.calls[0][0]).toBe('Unblock @xuan?');
    expect(data.unblockUser).not.toHaveBeenCalled();
    confirmLast();
    expect(data.unblockUser).toHaveBeenCalledWith(ME, 'x');
    await waitFor(() => expect(crew.blocks.reload).toHaveBeenCalled());
  });
});

describe('empty and loading', () => {
  it('says there are no friends yet once loaded', () => {
    render(<CrewScreen navigation={nav()} />);
    expect(screen.getByText('No friends yet. Ask for a username and add them here.')).toBeTruthy();
    expect(screen.queryByText('Blocked')).toBeNull();
  });

  it('shows a spinner, not the empty sentence, while loading', () => {
    crew.ships.loading = true;
    render(<CrewScreen navigation={nav()} />);
    expect(screen.queryByText(/No friends yet/)).toBeNull();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    fireEvent.click(tab(/Requests/));
    expect(screen.queryByText(/Nothing waiting/)).toBeNull();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('says nothing is waiting on an empty Requests tab', () => {
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(tab(/Requests/));
    expect(screen.getByText(/^Nothing waiting\./)).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
    expect(screen.queryByText('Sent')).toBeNull();
  });
});

describe('introductions', () => {
  it('lists suggestions with their faces absorbed, and Add asks without a confirmation', async () => {
    const sg = person('s', 'son', 'Son');
    data.fetchSuggestedFriends.mockImplementation(async () => [{ other: 's', mutual: 2 }]);
    data.fetchProfilesById.mockImplementation(async () => [sg]);
    crew.people = { s: sg };
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(tab(/Requests/));
    expect(await screen.findByText('Suggested · you save the same places')).toBeTruthy();
    expect(screen.getByText('@son · 2 mutual saves')).toBeTruthy();
    expect(screen.queryByText(/Nothing waiting/)).toBeNull();
    await waitFor(() => expect(crew.absorb).toHaveBeenCalledWith([sg]));
    expect(data.fetchProfilesById).toHaveBeenCalledWith(['s']);

    crew.ships.reload.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Add$/ }));
    expect(data.sendFriendRequest).toHaveBeenCalledWith(ME, 's');
    expect(alert).not.toHaveBeenCalled();
    await waitFor(() => expect(crew.ships.reload).toHaveBeenCalled());
  });

  it('drops a suggestion that is already a friend or blocked', async () => {
    data.fetchSuggestedFriends.mockImplementation(async () => [{ other: 'a', mutual: 2 }, { other: 'x', mutual: 1 }]);
    crew.ships.data = [edge(ME, 'a', 'accepted')];
    crew.blocks.data = ['x'];
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(tab(/Requests/));
    await waitFor(() => expect(data.fetchSuggestedFriends).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Suggested · you save the same places')).toBeNull();
    expect(screen.getByText(/^Nothing waiting\./)).toBeTruthy();
  });
});

describe('adding by handle', () => {
  const openAdd = () => {
    render(<CrewScreen navigation={nav()} />);
    // Pressed from the Friends tab: the field belongs with the asking.
    fireEvent.click(screen.getByRole('button', { name: 'Add a friend' }));
    return screen.getByRole('textbox') as HTMLInputElement;
  };
  const typeAndSend = async (input: HTMLInputElement, value: string) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: /Send request/ }));
  };

  it('the ⊕ opens the field on the Requests tab, and closes it again', () => {
    openAdd();
    expect(screen.getByText('Their username')).toBeTruthy();
    expect(screen.getByText(/^Nothing waiting\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a friend' }));
    expect(screen.queryByText('Their username')).toBeNull();
  });

  it('refuses something that is not a handle without asking the server', async () => {
    const input = openAdd();
    await typeAndSend(input, 'a!');
    expect(await screen.findByText('That does not look like a handle.')).toBeTruthy();
    expect(data.profileByHandle).not.toHaveBeenCalled();
  });

  it('says only that nobody has an unknown handle', async () => {
    const input = openAdd();
    await typeAndSend(input, '@Zed_1');
    expect(await screen.findByText('Nobody here is @zed_1.')).toBeTruthy();
    expect(data.profileByHandle).toHaveBeenCalledWith('zed_1');
    expect(data.sendFriendRequest).not.toHaveBeenCalled();
  });

  it.each([
    ['yourself', ME, [] as FriendshipRow[], 'That is you.'],
    ['a friend', 'a', [edge('a', ME, 'accepted')], 'You and @anh are already friends.'],
    ['already asked', 'a', [edge(ME, 'a', 'pending')], 'Already asked — waiting on their answer.'],
    ['asking you', 'a', [edge('a', ME, 'pending')], 'They already asked you — their request is above.'],
  ])('names the standing when the handle is %s, and sends nothing', async (_label, id, rows, sentence) => {
    crew.ships.data = rows;
    data.profileByHandle.mockImplementation(async () => person(id, 'anh'));
    const input = openAdd();
    await typeAndSend(input, 'anh');
    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(data.sendFriendRequest).not.toHaveBeenCalled();
  });

  it('sends to a stranger, closes the field and reloads', async () => {
    data.profileByHandle.mockImplementation(async () => person('n', 'nam'));
    const input = openAdd();
    crew.ships.reload.mockClear();
    await typeAndSend(input, 'nam');
    await waitFor(() => expect(data.sendFriendRequest).toHaveBeenCalledWith(ME, 'n'));
    await waitFor(() => expect(screen.queryByText('Their username')).toBeNull());
    expect(crew.ships.reload).toHaveBeenCalled();
  });

  it('words a policy refusal neutrally, so a block does not announce itself', async () => {
    data.profileByHandle.mockImplementation(async () => person('n', 'nam'));
    data.sendFriendRequest.mockImplementation(async () => {
      throw new Error('new row violates row-level security policy');
    });
    const input = openAdd();
    await typeAndSend(input, 'nam');
    expect(await screen.findByText('Could not send this request.')).toBeTruthy();
    expect(screen.queryByText(/row-level/)).toBeNull();
    expect(screen.getByText('Their username')).toBeTruthy();
  });

  it('relays any other failure as the server said it', async () => {
    data.profileByHandle.mockImplementation(async () => { throw new Error('Twenty requests a day is the limit.'); });
    const input = openAdd();
    await typeAndSend(input, 'nam');
    expect(await screen.findByText('Twenty requests a day is the limit.')).toBeTruthy();
  });

  it('suggests handles from two letters, minus yourself and your blocks, and a tap fills the field', async () => {
    crew.blocks.data = ['x'];
    data.searchHandles.mockImplementation(async () => [
      person(ME, 'anhme'), person('x', 'anhx'), person('h', 'anhthu', 'Anh Thu'),
    ]);
    const input = openAdd();
    fireEvent.change(input, { target: { value: 'a' } });
    await new Promise((r) => setTimeout(r, 300));
    expect(data.searchHandles).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'An' } });
    const pick = await screen.findByRole('button', { name: '@anhthu' });
    expect(data.searchHandles).toHaveBeenCalledWith('an');
    expect(within(pick).getByText('Anh Thu')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '@anhme' })).toBeNull();
    expect(screen.queryByRole('button', { name: '@anhx' })).toBeNull();

    fireEvent.click(pick);
    expect(input.value).toBe('anhthu');
    expect(screen.queryByRole('button', { name: '@anhthu' })).toBeNull();
  });
});

// Rows whose profile has not arrived, and may never: an account deleted,
// a profile RLS will not show. Every action here needs only an id, and the
// buttons used to be guarded with `p && …` — drawn, tappable and silent,
// which left a block that could not be lifted and a request that could not
// be taken back.
describe('somebody whose profile never arrived', () => {
  it('can still be unblocked, named as "this person"', async () => {
    crew.blocks.data = ['x'];
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    expect(alert.mock.calls[0][0]).toBe('Unblock this person?');
    confirmLast();
    expect(data.unblockUser).toHaveBeenCalledWith(ME, 'x');
    await waitFor(() => expect(crew.blocks.reload).toHaveBeenCalled());
  });

  it('can still have a sent request withdrawn, and offers no report about a profile nobody has seen', async () => {
    crew.ships.data = [edge(ME, 'o', 'pending')];
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(tab(/Requests/));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await pickSheetAction('Cancel the request');
    await waitFor(() => expect(data.removeFriendship).toHaveBeenCalledWith(ME, 'o'));
    expect(screen.queryByRole('button', { name: /Report/ })).toBeNull();
  });

  it('can still be unfriended from the options sheet', async () => {
    crew.ships.data = [edge(ME, 'f', 'accepted')];
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    await pickSheetAction('Unfriend this person');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toBe('Unfriend this person?');
    confirmLast();
    await waitFor(() => expect(data.removeFriendship).toHaveBeenCalledWith(ME, 'f'));
  });
});

// Every other write on the screen, failing. Each used to end in
// `.catch(() => {})`; each now names what did not happen, with the
// server's reason, and leaves the lists as they were.
describe('a write that fails says so', () => {
  const failAll = () => {
    for (const fn of [data.removeFriendship, data.blockUser, data.unblockUser, data.sendFriendRequest]) {
      fn.mockImplementation(async () => { throw new Error('offline'); });
    }
  };

  it('unfriending', async () => {
    failAll();
    crew.ships.data = [edge(ME, 'a', 'accepted')];
    crew.people = { a: person('a', 'anh') };
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    await pickSheetAction('Unfriend @anh');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    confirmLast();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not unfriend', 'offline'));
  });

  it('withdrawing a sent request', async () => {
    failAll();
    crew.ships.data = [edge(ME, 'o', 'pending')];
    crew.people = { o: person('o', 'oanh') };
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(tab(/Requests/));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await pickSheetAction('Cancel the request');
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not cancel the request', 'offline'));
  });

  it('blocking, without refreshing anything', async () => {
    failAll();
    crew.ships.data = [edge(ME, 'a', 'accepted')];
    crew.people = { a: person('a', 'anh') };
    render(<CrewScreen navigation={nav()} />);
    crew.ships.reload.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    await pickSheetAction(/^Block/);
    await waitFor(() => expect(alert).toHaveBeenCalled());
    confirmLast();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not block', 'offline'));
    expect(crew.blocks.reload).not.toHaveBeenCalled();
  });

  it('unblocking', async () => {
    failAll();
    crew.blocks.data = ['x'];
    crew.people = { x: person('x', 'xuan') };
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    confirmLast();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not unblock', 'offline'));
    expect(crew.blocks.reload).not.toHaveBeenCalled();
  });

  it('adding a suggestion', async () => {
    failAll();
    data.fetchSuggestedFriends.mockImplementation(async () => [{ other: 's', mutual: 2 }]);
    crew.people = { s: person('s', 'son') };
    render(<CrewScreen navigation={nav()} />);
    fireEvent.click(tab(/Requests/));
    fireEvent.click(await screen.findByRole('button', { name: /Add$/ }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not send the request', 'offline'));
  });
});
