// @vitest-environment jsdom
//
// The last tab's first page (owner, 19 Nov 2026 — docs/profile-home-plan.md):
// your own person page, or the guest's hub. The two pages it chooses
// between have their own tests; what is checked here is the choice and
// the page it is handed.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';

const state = vi.hoisted(() => ({
  ready: true,
  session: { user: { id: 'me-id' } } as { user: { id: string } } | null,
  handle: 'tuananh',
}));
vi.mock('../lib/auth', () => ({
  useSession: () => ({ ready: state.ready, session: state.session }),
  useProfile: () => ({ profile: { handle: state.handle }, memberSince: null }),
}));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));

const seen = vi.hoisted(() => ({ person: null as null | { route: RootRoute<'Person'>; home?: boolean } }));
vi.mock('./PersonScreen', () => ({
  default: (p: { route: RootRoute<'Person'>; home?: boolean }) => {
    seen.person = p;
    return <div data-testid="person-page" />;
  },
}));
vi.mock('./ProfileScreen', () => ({
  // `home` read back as an attribute: the hub must know it is the tab's
  // first page, or it pops a stack it is the bottom of (`ProfileScreen`).
  default: ({ home }: { home?: boolean }) => <div data-testid="account-or-guest" data-home={String(!!home)} />,
}));
vi.mock('../components/ui', () => ({
  Screen: ({ title, children }: { title: string; children: React.ReactNode }) => <section aria-label={title}>{children}</section>,
}));

import MeScreen from './MeScreen';

const draw = () => {
  const navigation = { navigate: vi.fn() };
  render(<MeScreen navigation={navigation as unknown as Nav} route={{ key: 'ProfileHome-1', name: 'ProfileHome' } as RootRoute<'ProfileHome'>} />);
  return navigation;
};

beforeEach(() => {
  state.ready = true;
  state.session = { user: { id: 'me-id' } };
  state.handle = 'tuananh';
  seen.person = null;
});

describe('MeScreen', () => {
  it('opens your own person page, found by your handle, as the tab’s first page', () => {
    draw();
    expect(screen.getByTestId('person-page')).toBeTruthy();
    expect(screen.queryByTestId('account-or-guest')).toBeNull();
    expect(seen.person!.route.params).toEqual({ handle: 'tuananh' });
    // Its own key: the page is this route, not a second one.
    expect(seen.person!.route.key).toBe('ProfileHome-1');
    expect(seen.person!.home).toBe(true);
  });

  it('gives a guest the hub, as the tab always did', () => {
    state.session = null;
    draw();
    expect(screen.getByTestId('account-or-guest').getAttribute('data-home')).toBe('true');
    expect(screen.queryByTestId('person-page')).toBeNull();
  });

  // Before the session is read, the hub's own spinner (`ProfileScreen`),
  // not a guess at either page.
  it('waits on the session with the page that has always waited on it', () => {
    state.ready = false;
    draw();
    expect(screen.getByTestId('account-or-guest')).toBeTruthy();
  });

  it('waits for your handle under the page’s own name', () => {
    state.handle = '';
    draw();
    expect(screen.getByTestId('me-loading')).toBeTruthy();
    expect(screen.getByLabelText('Profile')).toBeTruthy();
    expect(screen.queryByTestId('person-page')).toBeNull();
  });
});
