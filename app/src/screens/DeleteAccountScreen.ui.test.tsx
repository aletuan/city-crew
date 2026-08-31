// @vitest-environment jsdom
//
// The first test this flow has ever had.
//
// It was two nested `Alert.alert`s until now, and `Alert` is a no-op in
// `react-native-web` — `setup.tsx` keeps a spy over it precisely because
// otherwise a test would see nothing at all. So the most destructive
// action in the app was also the one thing no test could reach without
// reaching *through* the platform. Moving it onto a screen is what makes
// these assertions possible, and they are the point of the move as much
// as the layout is: what this screen must never do is delete an account
// on a tap the reader did not mean, or leave them looking at a screen for
// an account that no longer exists.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';

const deleteAccount = vi.hoisted(() => vi.fn(async () => {}));
const account = vi.hoisted(() => ({
  email: 'trang@example.com' as string | null,
  profile: { handle: 'trang', full_name: 'Trang', location: '', bio: '', interests: '', avatar_url: '' },
}));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ deleteAccount, email: account.email, profile: account.profile }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import DeleteAccountScreen from './DeleteAccountScreen';

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
}) as unknown as Nav;

// By role, and by a loose match on the name.
//
// The button and the header now say the same words — the page's own title,
// the way an iOS settings screen does it — so `getByText` finds two nodes
// and throws. And the name is loose because the button carries a glyph:
// `@expo/vector-icons` renders one as a character in a `Text`, which lands
// in the accessible name in front of the label.
const deleteButton = () => screen.getByRole('button', { name: /Delete account/ });

beforeEach(() => {
  deleteAccount.mockClear();
  deleteAccount.mockImplementation(async () => {});
  account.email = 'trang@example.com';
  account.profile = { handle: 'trang', full_name: 'Trang', location: '', bio: '', interests: '', avatar_url: '' };
});

describe('the delete account screen', () => {
  // Both halves, because the half people get wrong is the second one: a
  // café somebody added to the catalog stays, and somebody deciding
  // whether to close their account is entitled to know that before they
  // decide rather than after.
  it('says what goes and what stays', () => {
    render(<DeleteAccountScreen navigation={nav()} />);
    expect(screen.getByText('Will be deleted')).toBeTruthy();
    expect(screen.getByText('Collections, likes and trips')).toBeTruthy();
    // `history`, the word Edit profile already uses for this data —
    // never `activity`, which is a different screen in this same stack.
    expect(screen.getByText('Taste preferences and history')).toBeTruthy();
    expect(screen.getByText('Will remain')).toBeTruthy();
    expect(screen.getByText(
      'Places you added will remain in the catalog, but will no longer be linked to your account.',
    )).toBeTruthy();
  });

  // Which account. Neither alert ever said, and the day somebody has two
  // this is the only thing on the screen that tells them apart.
  it('names the account it would delete', () => {
    render(<DeleteAccountScreen navigation={nav()} />);
    expect(screen.getByText('Trang')).toBeTruthy();
    expect(screen.getByText('@trang')).toBeTruthy();
  });

  // An account that never filled the name in still has to be identifiable,
  // and the address is the one thing every account has.
  it('falls back to the email when there is no name', () => {
    account.profile = { ...account.profile, full_name: '   ' };
    render(<DeleteAccountScreen navigation={nav()} />);
    expect(screen.getByText('trang@example.com')).toBeTruthy();
    expect(screen.getByText('@trang')).toBeTruthy();
  });

  it('deletes, then leaves the screen behind', async () => {
    const navigation = nav();
    render(<DeleteAccountScreen navigation={navigation} />);

    fireEvent.click(deleteButton());

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    // Not `goBack`: the account is gone and so is the session, and every
    // screen between here and the tab root belongs to it.
    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
  });

  // The failure the old alert reported by dumping `error.message` into a
  // second dialog — English prose from the server, on a screen the reader
  // may have set to Vietnamese, with no way back to the button.
  it('reports a failure in place, and stays put', async () => {
    const navigation = nav();
    deleteAccount.mockImplementation(async () => { throw new Error('offline'); });
    render(<DeleteAccountScreen navigation={navigation} />);

    fireEvent.click(deleteButton());

    // `offline` is a name `authfail` knows, so what the reader gets is
    // the sentence — never the name, and never the server's own words.
    expect(await screen.findByText('No connection. Check your network and try again.')).toBeTruthy();
    expect(navigation.popToTop).not.toHaveBeenCalled();
  });

  // The hole the alerts left open: `ProfileScreen` set `busy` on a state
  // the delete row never read, so the seconds between the tap and the
  // server answering looked exactly like nothing happening.
  it('cannot be fired twice while it is running', async () => {
    let release: () => void = () => {};
    deleteAccount.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    render(<DeleteAccountScreen navigation={nav()} />);

    fireEvent.click(deleteButton());
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));

    // The label is gone while it runs — the button is a spinner — so the
    // second tap has nothing to hit even before `onPress` is withheld.
    expect(screen.queryByRole('button', { name: /Delete account/ })).toBeNull();
    release();
  });

  // Leaving is an answer, and it must be reachable from the bottom of the
  // screen rather than only from the header the reader has scrolled past.
  it('offers keeping the account, next to deleting it', () => {
    const navigation = nav();
    render(<DeleteAccountScreen navigation={navigation} />);

    fireEvent.click(screen.getByText('Keep my account'));

    expect(navigation.goBack).toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
