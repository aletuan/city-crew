// @vitest-environment jsdom
//
// The friends card on Account (19 Nov 2026): two rows, and the dot that
// is a request waiting on the reader. The rows' words and where they go
// are pinned through the page, in `ProfileScreen.ui.test.tsx`; here is
// the dot's rule, which the page cannot ask without a session.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../uitest/render';
import type { Nav } from '../../nav';
import { FriendsCard } from './FriendsCard';

const ships = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));
vi.mock('../../lib/crew', () => ({ useCrew: () => ({ ships }) }));
vi.mock('../../lib/theme', () => ({ useScheme: () => ({ scheme: 'dark' }) }));

const nav = { navigate: vi.fn() } as unknown as Nav;
const pending = (requester: string, addressee: string) =>
  ({ requester, addressee, status: 'pending', created_at: '2026-11-01' });

describe('the dot on the friends row', () => {
  it('is a request waiting on the reader, and not one the reader sent', () => {
    ships.data = [pending('u-a', 'me')];
    const { unmount } = render(<FriendsCard navigation={nav} me="me" />);
    expect(screen.getAllByTestId('friends-dot')).toHaveLength(1);
    unmount();
    ships.data = [pending('me', 'u-a')];
    render(<FriendsCard navigation={nav} me="me" />);
    expect(screen.queryByTestId('friends-dot')).toBeNull();
  });

  // With nobody signed in there is nobody to wait on: the empty id must
  // not match a row, even one whose addressee is empty.
  it('is not drawn for no reader', () => {
    ships.data = [pending('u-a', 'me')];
    render(<FriendsCard navigation={nav} me={null} />);
    expect(screen.queryByTestId('friends-dot')).toBeNull();
    expect(screen.getByText('Activity')).toBeTruthy();
  });
});
