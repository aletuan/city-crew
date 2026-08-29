// @vitest-environment jsdom
//
// The welcome, and the promise that it is a welcome rather than a
// greeting: it appears on the launch where storage holds nothing, and
// never again — including when storage itself is the thing that failed.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
const goTo = vi.hoisted(() => vi.fn());
vi.mock('../nav', () => ({ goTo }));

import WelcomeSheet, { WELCOME_ALWAYS_KEY } from './WelcomeSheet';

const KEY = 'citycrew.welcomeSeen';

beforeEach(async () => {
  // The stub's storage is one Map shared by every test in this file, and
  // this key is fixed — so the flag has to be cleared by hand between
  // tests. `mockClear`, never `mockReset`: reset takes the stub's
  // implementation with it and the Map stops working for everything after.
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(WELCOME_ALWAYS_KEY);
  vi.mocked(AsyncStorage.getItem).mockClear();
  vi.mocked(AsyncStorage.setItem).mockClear();
  goTo.mockClear();
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

// TEMPORARY, and pinned so it cannot rot quietly while it is here: the
// switch in Profile → Settings that makes the welcome greet on every
// launch. Delete this block along with the switch.
describe('the always-show switch', () => {
  it('greets again on a launch that has already seen it', async () => {
    await AsyncStorage.setItem(KEY, '1');
    await AsyncStorage.setItem(WELCOME_ALWAYS_KEY, '1');
    render(<WelcomeSheet />);
    expect(await screen.findByText('Welcome to City Crew')).toBeTruthy();
  });

  it('goes back to silence once it is off', async () => {
    await AsyncStorage.setItem(KEY, '1');
    render(<WelcomeSheet />);

    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith(WELCOME_ALWAYS_KEY));
    expect(screen.queryByText('Welcome to City Crew')).toBeNull();
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
