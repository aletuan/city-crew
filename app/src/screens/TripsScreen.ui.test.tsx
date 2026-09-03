// @vitest-environment jsdom
//
// The bug the harness's own `useFocusEffect` mock happens to make provable:
// it treats mount as the only focus a tree that is never blurred can have
// (see `uitest/setup.tsx`) — exactly the "first focus" this screen used to
// skip. Before the fix, `reload` never fired on mount at all: a trip saved
// elsewhere and landed on this tab for the first time in a session stayed
// invisible until the reader left the tab and came back. See TripsScreen.tsx
// for the full argument.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '../uitest/render';
import type { Nav } from '../nav';

const reload = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));
vi.mock('../lib/city', () => ({
  useCity: () => ({ cities: [] }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
// The seam under test: `useMyTrips` stands in for the one shared fetch —
// see `lib/mytrips.tsx` — and `reload` is what a real save elsewhere would
// need this screen to call the moment it is first seen.
vi.mock('../lib/mytrips', () => ({
  useMyTrips: () => ({
    loading: true, loaded: false, error: null, data: [], loadedAt: null, fromCache: false, reload,
  }),
}));
vi.mock('../lib/crew', () => ({
  useCrew: () => ({ people: {} }),
}));
vi.mock('../lib/invitations', () => ({
  useInvitations: () => ({ invites: { data: [] } }),
}));

import TripsScreen from './TripsScreen';

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
}) as unknown as Nav;

describe('TripsScreen', () => {
  it('reloads on the very first focus, not just the second', () => {
    render(<TripsScreen navigation={nav()} />);
    // The regression: this used to be `.not.toHaveBeenCalled()` on the
    // first mount, on purpose — a trip saved in another tab and landed on
    // here for this session's first-ever look at Trips showed the launch
    // snapshot, not the trip just saved, until the reader left and returned.
    expect(reload).toHaveBeenCalled();
  });
});
