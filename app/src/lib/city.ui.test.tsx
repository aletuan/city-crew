// @vitest-environment jsdom
//
// Whose word the city is.
//
// `setCity` writes `mode: 'manual'`, and the bootstrap honours that
// absolutely: it returns before the platform is asked where the phone is.
// But the pick is stored per *device* — the key carries no user id and
// `signOut` never touches it — so without the effect this file pins, one
// person's choice goes on silencing the location question for every
// account after them. A reader in Hanoi opens on the Da Nang somebody else
// chose, with no signal that a choice is being made for them.
//
// The precision matters as much as the behaviour: a launch must leave a
// manual pick untouched, or the reader loses their choice every morning.
// `SIGNED_OUT` is what draws that line — it does not fire on a start the
// way `INITIAL_SESSION` does — and both halves are below.
//
// The events are fired through the fake client rather than through a
// stubbed provider, because the code under test listens to the client.
// Faking the provider would test a seam that does not exist.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '../uitest/render';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { CityProvider, useCity } from './city';

const KEY = 'citycrew.city';
const CITIES = [
  { id: 'danang', name_en: 'Da Nang', short_en: 'Da Nang', center_lat: 16.05, center_lng: 108.2, radius_km: 25 },
  { id: 'hanoi', name_en: 'Hanoi', short_en: 'Hanoi', center_lat: 21.03, center_lng: 105.85, radius_km: 25 },
];

function Probe() {
  const { city, mode } = useCity();
  return (
    <>
      <span data-testid="city">{city?.id ?? '—'}</span>
      <span data-testid="mode">{mode}</span>
    </>
  );
}

const mount = () => render(<CityProvider><Probe /></CityProvider>);

/** What the device remembers, as the bootstrap will read it back. */
const remembered = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');

beforeEach(async () => {
  h.fake!.reset();
  // Two replies: the bootstrap's fetch, and the healer's retry if the
  // first were ever empty. Queueing both keeps the test off that path.
  h.fake!.replies({ data: CITIES, error: null }, { data: CITIES, error: null });
  await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'danang', mode: 'manual' }));
});

describe('an ordinary launch', () => {
  it('leaves a manual pick exactly where the reader put it', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));
    expect(screen.getByTestId('mode').textContent).toBe('manual');
    expect(await remembered()).toEqual({ id: 'danang', mode: 'manual' });
  });

  // The event a start actually delivers. If the release read any session
  // event rather than a departure, the reader would lose their choice
  // every single morning — which is a worse bug than the one being fixed.
  it('is unmoved by the session arriving', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('manual'));

    h.fake!.fireAuth('INITIAL_SESSION', { user: { id: 'u1' } });
    h.fake!.fireAuth('SIGNED_IN', { user: { id: 'u1' } });
    h.fake!.fireAuth('TOKEN_REFRESHED', { user: { id: 'u1' } });

    expect(screen.getByTestId('mode').textContent).toBe('manual');
    expect(await remembered()).toEqual({ id: 'danang', mode: 'manual' });
  });
});

describe('the account leaving', () => {
  it('takes the claim off the pick, and keeps the city', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('manual'));

    h.fake!.fireAuth('SIGNED_OUT');

    // In memory, not only on disk: signing out and signing up again
    // happens without the app restarting, which is the case this exists
    // for. A storage-only fix would arrive one launch too late for the
    // reader who just met it.
    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('auto'));
    expect(screen.getByTestId('city').textContent).toBe('danang');
    await waitFor(async () => expect(await remembered()).toEqual({ id: 'danang', mode: 'auto' }));
  });

  // Nothing to release, nothing written. The common case by far — most
  // picks were never manual.
  it('writes nothing when the pick was automatic anyway', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'danang', mode: 'auto' }));
    mount();
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));

    vi.mocked(AsyncStorage.setItem).mockClear();
    h.fake!.fireAuth('SIGNED_OUT');

    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('auto'));
    expect(vi.mocked(AsyncStorage.setItem).mock.calls.filter(([k]) => k === KEY)).toHaveLength(0);
  });

  // The listener goes when the provider does. A leak here would have
  // every torn-down tree still answering sign-outs in a long session.
  it('stops listening when the provider unmounts', async () => {
    const view = mount();
    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('manual'));
    view.unmount();

    vi.mocked(AsyncStorage.setItem).mockClear();
    h.fake!.fireAuth('SIGNED_OUT');
    expect(vi.mocked(AsyncStorage.setItem).mock.calls.filter(([k]) => k === KEY)).toHaveLength(0);
  });
});
