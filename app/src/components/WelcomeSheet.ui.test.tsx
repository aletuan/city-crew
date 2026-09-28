// @vitest-environment jsdom
//
// The welcome, and the promise that it is a welcome rather than a
// greeting: it appears to a guest on the launch where storage holds
// nothing, and never again — including when storage itself is the thing
// that failed. An account holder is never welcomed at all.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
const goTo = vi.hoisted(() => vi.fn());
vi.mock('../nav', () => ({ goTo }));
// `Auth.userId`: undefined not known yet, null a guest, an id an account.
const reader = vi.hoisted(() => ({ userId: null as string | null | undefined }));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ userId: reader.userId }) }));

import WelcomeSheet from './WelcomeSheet';
import { launchSettled } from '../lib/launch';

const KEY = 'citycrew.welcomeSeen';

beforeEach(async () => {
  // The stub's storage is one Map shared by every test in this file, and
  // this key is fixed — so the flag has to be cleared by hand between
  // tests. `mockClear`, never `mockReset`: reset takes the stub's
  // implementation with it and the Map stops working for everything after.
  await AsyncStorage.removeItem(KEY);
  reader.userId = null;
  vi.mocked(AsyncStorage.getItem).mockClear();
  vi.mocked(AsyncStorage.setItem).mockClear();
  goTo.mockClear();
  // The launch has settled, as Explore would have said by now. The one
  // test about the wait itself puts this back.
  launchSettled.settle();
});

describe('the wait', () => {
  // The whole reason the sheet is not a Modal and does not use
  // InteractionManager: it must not arrive while Explore is still
  // committing. Unsettled, it stays off the screen past any interval a
  // launch actually takes to settle; settled, it comes within a beat.
  it('holds until the launch has settled', async () => {
    launchSettled.reset();
    render(<WelcomeSheet />);
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.queryByText('Welcome to City Crew')).toBeNull();
    launchSettled.settle();
    expect(await screen.findByText('Welcome to City Crew')).toBeTruthy();
  });
});

describe('the first launch', () => {
  it('introduces the three things the tabs never say out loud', async () => {
    render(<WelcomeSheet />);
    expect(await screen.findByText('Welcome to City Crew')).toBeTruthy();
    expect(screen.getByText('Discover & save')).toBeTruthy();
    expect(screen.getByText('Plan with ease')).toBeTruthy();
    expect(screen.getByText('Share with friends')).toBeTruthy();
  });

  // What "leaves" means here is the written flag, not a vanished word:
  // react-native-web's Modal fades a closed sheet with CSS — opacity nil,
  // pointer-events off — and leaves its children in the document, so a
  // text query still finds them. The flag is the durable half anyway, and
  // "it does not come back" is pinned by the launch-after tests below.
  // The mark, not a glyph standing in for one.
  it('wears the app\u2019s own logo', async () => {
    render(<WelcomeSheet />);
    await screen.findByText('Welcome to City Crew');
    expect(document.querySelector('img')).toBeTruthy();
  });

  it('leaves through its one button, and remembers that it did', async () => {
    render(<WelcomeSheet />);
    fireEvent.click(await screen.findByText('Start exploring'));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, '1'));
  });

  // The regression: dismissed, the sheet came straight back. The wait
  // that holds it for the launch re-armed when `show` dropped, because
  // "wanted" was still up. Past the exit and a full grace, it is gone.
  it('stays gone once it has left', async () => {
    render(<WelcomeSheet />);
    fireEvent.click(await screen.findByText('Start exploring'));
    await waitFor(() => expect(screen.queryByText('Welcome to City Crew')).toBeNull(), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.queryByText('Welcome to City Crew')).toBeNull();
  });

  // The dimmed area is this sheet's only secondary action — there is
  // nothing here to decline — so it has to write the flag too, or the
  // welcome comes back on the next launch.
  it('treats a tap on the dimmed room the same way', async () => {
    render(<WelcomeSheet />);
    await screen.findByText('Welcome to City Crew');
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, '1'));
  });
});

describe('every launch after', () => {
  it('says nothing at all', async () => {
    await AsyncStorage.setItem(KEY, '1');
    vi.mocked(AsyncStorage.setItem).mockClear();
    render(<WelcomeSheet />);

    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith(KEY));
    expect(screen.queryByText('Welcome to City Crew')).toBeNull();
  });

  // A read that failed is not a first launch. If storage cannot be read
  // it cannot be written either, so greeting here would greet on every
  // launch forever — the one failure mode worse than missing the welcome.
  it('stays quiet when storage itself is the thing that broke', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage gone'));
    render(<WelcomeSheet />);

    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith(KEY));
    expect(screen.queryByText('Welcome to City Crew')).toBeNull();
  });
});

// For guests. An account holder on a fresh install — or on the update
// that first shipped this — was welcomed to an app they already use, and
// its Sign in link opened the form over a session that was already there.
describe('an account holder', () => {
  it('is never welcomed, and is marked as having been', async () => {
    reader.userId = 'u1';
    render(<WelcomeSheet />);
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, '1'));
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.queryByText('Welcome to City Crew')).toBeNull();
  });

  // Not known yet is not a guest: the sheet waits for the answer rather
  // than greeting somebody it is about to find out has an account.
  it('is waited for while the reader is not yet known', async () => {
    reader.userId = undefined;
    const view = render(<WelcomeSheet />);
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.queryByText('Welcome to City Crew')).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    reader.userId = null;
    view.rerender(<WelcomeSheet />);
    expect(await screen.findByText('Welcome to City Crew')).toBeTruthy();
  });
});

describe('the reader who is not new', () => {
  // The greeting reaches an existing account at its worst moment — a
  // reinstall, or the update that first shipped it — and "start
  // exploring" is the one thing that reader does not need.
  it('offers the way back to an account, and takes it', async () => {
    render(<WelcomeSheet />);
    fireEvent.click(await screen.findByText('Sign in'));

    expect(goTo).toHaveBeenCalledWith('Profile', { screen: 'SignIn', initial: false });
    // And the flag is written on the way out, so the greeting is not
    // still waiting on the other side of signing in.
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, '1'));
  });
});
