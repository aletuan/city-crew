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

import React, { useEffect, useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

// The city hears the session through the auth provider's `useAuthEvent`.
// This stands it on the fake client's own auth stream, so `fireAuth` still
// reaches the city the way the real provider would hand it on.
vi.mock('./auth', async () => {
  const { useEffect, useRef } = await import('react');
  return {
    useAuthEvent: (kind: string, fn: () => void) => {
      const latest = useRef(fn);
      latest.current = fn;
      useEffect(() => {
        const { data } = h.fake!.client.auth.onAuthStateChange((event: string) => {
          if (event === kind) latest.current();
        });
        return () => data.subscription.unsubscribe();
      }, [kind]);
    },
  };
});

import { CityProvider, useCity, useCityList, useCurrentCity, useMyPosition } from './city';

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

/** Where the phone is, for the platform's fresh-fix read. */
const HANOI = { coords: { latitude: 21.02, longitude: 105.84 } };
const loc = vi.mocked(Location);

/** Location allowed, no cached fix, and a fresh one in Hanoi. */
const coldGpsInHanoi = () => {
  loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  loc.getLastKnownPositionAsync.mockResolvedValue(null);
  loc.getCurrentPositionAsync.mockResolvedValue(HANOI as never);
};

beforeEach(async () => {
  h.fake!.reset();
  loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
  loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
  loc.getLastKnownPositionAsync.mockResolvedValue(null);
  loc.getCurrentPositionAsync.mockReset();
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

describe('the account leaving, when the phone knows where it is', () => {
  // The case that was reported: an account signed out on a Da Nang the
  // last reader was looking at, a new one signed up in Hanoi, and the app
  // went on showing Da Nang because nothing asked again until a restart.
  it('moves to where the phone is once the pick is released', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('manual'));
    coldGpsInHanoi();

    h.fake!.fireAuth('SIGNED_OUT');

    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('hanoi'));
    expect(screen.getByTestId('mode').textContent).toBe('auto');
    await waitFor(async () => expect(await remembered()).toEqual({ id: 'hanoi', mode: 'auto' }));
  });

  it('follows the phone when the pick was automatic too', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'danang', mode: 'auto' }));
    mount();
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));
    coldGpsInHanoi();

    h.fake!.fireAuth('SIGNED_OUT');

    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('hanoi'));
  });

  // A sign-out is not a moment for the permission dialog: the fix is
  // taken only if location was already allowed.
  it('never asks for permission on the way out', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('manual'));
    loc.requestForegroundPermissionsAsync.mockClear();

    h.fake!.fireAuth('SIGNED_OUT');

    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('auto'));
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('city').textContent).toBe('danang');
  });
});

describe('a launch with no cached fix', () => {
  // Before: the stored automatic city stood, and since nothing asked for
  // a fresh fix the cache never warmed — the same city every launch.
  it('opens on the stored city, then moves to where a fresh fix says', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'danang', mode: 'auto' }));
    coldGpsInHanoi();
    mount();

    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('hanoi'));
    expect(loc.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    await waitFor(async () => expect(await remembered()).toEqual({ id: 'hanoi', mode: 'auto' }));
  });

  // Nothing remembered: the bootstrap falls back to its default, which is
  // the Saigon the report was about. The fresh fix corrects it.
  it('corrects a first launch that fell back to the default', async () => {
    await AsyncStorage.removeItem(KEY);
    coldGpsInHanoi();
    mount();

    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('hanoi'));
    await waitFor(async () => expect(await remembered()).toEqual({ id: 'hanoi', mode: 'auto' }));
  });

  it('stays put when the fresh fix agrees, writing nothing', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'hanoi', mode: 'auto' }));
    coldGpsInHanoi();
    mount();
    await waitFor(() => expect(loc.getCurrentPositionAsync).toHaveBeenCalled());
    vi.mocked(AsyncStorage.setItem).mockClear();
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId('city').textContent).toBe('hanoi');
    expect(vi.mocked(AsyncStorage.setItem).mock.calls.filter(([k]) => k === KEY)).toHaveLength(0);
  });

  it('stays put when location is not allowed', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'danang', mode: 'auto' }));
    mount();
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

    expect(screen.getByTestId('city').textContent).toBe('danang');
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  // The reader's word outranks a fix that was already on its way.
  it('drops a late fix when the reader picked a city meanwhile', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'danang', mode: 'auto' }));
    coldGpsInHanoi();
    let land!: (v: unknown) => void;
    loc.getCurrentPositionAsync.mockReturnValue(new Promise((r) => { land = r; }) as never);

    function Picker() {
      const { setCity } = useCity();
      return <button type="button" onClick={() => setCity('danang')}>pick</button>;
    }
    render(<CityProvider><Probe /><Picker /></CityProvider>);
    await waitFor(() => expect(loc.getCurrentPositionAsync).toHaveBeenCalled());

    fireEvent.click(screen.getByText('pick'));
    await act(async () => { land(HANOI); await Promise.resolve(); });

    expect(screen.getByTestId('city').textContent).toBe('danang');
    expect(screen.getByTestId('mode').textContent).toBe('manual');
  });

  // The start sheet's cancel puts a city back as it was, and a city the
  // app had chosen by position must come back as auto, or the cancelled
  // sheet would leave the app deaf to the next fix.
  it('takes a mode with the pick, and stores it', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'danang', mode: 'manual' }));
    function Picker() {
      const { setCity } = useCity();
      return <button type="button" onClick={() => setCity('hanoi', 'auto')}>back</button>;
    }
    render(<CityProvider><Probe /><Picker /></CityProvider>);
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));

    fireEvent.click(screen.getByText('back'));
    expect(screen.getByTestId('city').textContent).toBe('hanoi');
    expect(screen.getByTestId('mode').textContent).toBe('auto');
    const stored = vi.mocked(AsyncStorage.setItem).mock.calls.filter(([k]) => k === KEY).at(-1)?.[1];
    expect(JSON.parse(String(stored))).toEqual({ id: 'hanoi', mode: 'auto' });
  });
});

// ── a client shipped ahead of its migration ──
//
// `fetchCities` drops column groups and retries, newest group first, and
// the order is load-bearing: Postgres names only the FIRST column it does
// not recognise, so a database missing both groups answers about
// `hero_photo_uri` and mentions `hero_sub` only once the photo columns
// are gone. Combining the two retries into one would work on a database
// missing the newer group and fail on a database missing both — the
// oldest one, which is exactly the case this exists for.
describe('a database older than the app', () => {
  const asked = () => h.fake!.log.filter((a) => a.table === 'cities').map((a) => String(a.payload ?? ''));
  /** The suite's own two replies are already queued; these tests need the
   *  queue to start with the refusal instead. */
  const only = (...r: Parameters<NonNullable<typeof h.fake>['replies']>) => { h.fake!.reset(); h.fake!.replies(...r); };

  it('drops the photo columns when the database has not got them', async () => {
    only(
      { data: null, error: { message: 'column cities.hero_photo_uri does not exist' } },
      { data: CITIES, error: null },
    );
    mount();
    await waitFor(() => expect(asked()).toHaveLength(2));
    const cols = asked();
    expect(cols[0]).toContain('hero_photo_uri');
    expect(cols[1]).not.toContain('hero_photo_uri');
    expect(cols[1]).toContain('hero_sub_en');
  });

  it('drops the subtitle columns too when it is older still', async () => {
    only(
      { data: null, error: { message: 'column cities.hero_photo_uri does not exist' } },
      { data: null, error: { message: 'column cities.hero_sub_en does not exist' } },
      { data: CITIES, error: null },
    );
    mount();
    await waitFor(() => expect(asked()).toHaveLength(3));
    const cols = asked();
    expect(cols[2]).not.toContain('hero_photo_uri');
    expect(cols[2]).not.toContain('hero_sub_en');
    // What the retries are protecting: the third answer is the real city
    // list, not the single hardcoded Saigon row.
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));
  });

  // The Chinese hero is the newest group, and `hero_sub_zh` must not be
  // read as the subtitle group: dropping that would lose the English and
  // Vietnamese subtitles to a database missing only the Chinese.
  it('drops only the Chinese hero when that is all it lacks', async () => {
    only(
      { data: null, error: { message: 'column cities.hero_sub_zh does not exist' } },
      { data: CITIES, error: null },
    );
    mount();
    await waitFor(() => expect(asked()).toHaveLength(2));
    const cols = asked();
    expect(cols[0]).toContain('hero_title_zh');
    expect(cols[1]).not.toContain('_zh');
    expect(cols[1]).toContain('hero_sub_en');
    expect(cols[1]).toContain('hero_photo_uri');
  });

  // Every group named in turn, and each dropped once: the oldest database
  // there is still gets its city list.
  it('drops every group the database names, one at a time', async () => {
    only(
      { data: null, error: { message: 'column cities.hero_title_zh does not exist' } },
      { data: null, error: { message: 'column cities.tz does not exist' } },
      { data: null, error: { message: 'column cities.hero_photo_uri does not exist' } },
      { data: null, error: { message: 'column cities.hero_sub_en does not exist' } },
      { data: CITIES, error: null },
    );
    mount();
    await waitFor(() => expect(asked()).toHaveLength(5));
    const last = asked()[4];
    for (const gone of ['_zh', ', tz', 'hero_photo', 'hero_sub']) expect(last).not.toContain(gone);
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));
  });

  // A refusal about something no group covers is not retried forever.
  it('stops at an error it cannot drop its way out of', async () => {
    only({ data: null, error: { message: 'permission denied for table cities' } });
    mount();
    await waitFor(() => expect(asked()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(asked()).toHaveLength(1);
  });
});

// ── a launch where the platform already knows ──
//
// A cached fix is the quick path, read under a hard time cap and never
// behind a fresh GPS wait. Behind a remembered automatic city it may only
// *correct*: agreeing costs nothing, disagreeing moves and remembers.
describe('a launch with a cached fix', () => {
  // Counts from the tests before would otherwise be read as this one's.
  beforeEach(() => { vi.mocked(Location).requestForegroundPermissionsAsync.mockClear(); });
  const cachedInHanoi = () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    loc.getLastKnownPositionAsync.mockResolvedValue(HANOI as never);
  };

  it('moves a remembered automatic city to where the phone is, and remembers that', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'danang', mode: 'auto' }));
    cachedInHanoi();
    mount();
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('hanoi'));
    await waitFor(async () => expect(await remembered()).toEqual({ id: 'hanoi', mode: 'auto' }));
    // The cached fix answered; nothing waited on a fresh one.
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('writes nothing when the fix agrees with the city already open', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: 'hanoi', mode: 'auto' }));
    cachedInHanoi();
    // Cleared before the mount, not after the fix is asked for: the write
    // this is about would land in between, and be cleared with the rest.
    vi.mocked(AsyncStorage.setItem).mockClear();
    mount();
    await waitFor(() => expect(loc.getLastKnownPositionAsync).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByTestId('city').textContent).toBe('hanoi');
    expect(vi.mocked(AsyncStorage.setItem).mock.calls.filter(([k]) => k === KEY)).toHaveLength(0);
  });

  it('opens a first launch straight on the city the fix names', async () => {
    await AsyncStorage.removeItem(KEY);
    cachedInHanoi();
    mount();
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('hanoi'));
    await waitFor(async () => expect(await remembered()).toEqual({ id: 'hanoi', mode: 'auto' }));
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('never asks the platform at all behind a manual pick', async () => {
    cachedInHanoi();
    mount();
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('city').textContent).toBe('danang');
  });
});

// ── "Use my location" ──
//
// The one place the app may raise the permission dialog after launch: the
// reader just tapped a row asking for exactly that. And the one place that
// reports failure, because silence after an explicit request reads as broken.
describe('following my location', () => {
  // Handed out through an effect rather than assigned during render,
  // which the lint rule on components forbids — rightly, for components
  // that are not test probes.
  //
  // A layout effect, in the commit that draws the city. A passive one ran
  // after it, and `mountFollower`'s wait could see "danang" in the DOM
  // before it had: the tap then went through the first render's closure,
  // whose list was still the one-row fallback, and the city it chose was
  // not in the list the screen had ('—'). About one run in fifteen.
  let follow: () => Promise<boolean>;
  const Follower = ({ give }: { give: (f: () => Promise<boolean>) => void }) => {
    const { followMyLocation } = useCity();
    useLayoutEffect(() => { give(followMyLocation); });
    return null;
  };
  const mountFollower = async () => {
    render(<CityProvider><Probe /><Follower give={(f) => { follow = f; }} /></CityProvider>);
    await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));
  };
  const tap = async () => {
    let answer = false;
    await act(async () => { answer = await follow(); });
    return answer;
  };

  it('asks, finds the nearest city, follows it, and gives the choice back to the phone', async () => {
    await mountFollower();
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    loc.getLastKnownPositionAsync.mockResolvedValue(HANOI as never);
    expect(await tap()).toBe(true);
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(screen.getByTestId('city').textContent).toBe('hanoi');
    expect(screen.getByTestId('mode').textContent).toBe('auto');
    expect(await remembered()).toEqual({ id: 'hanoi', mode: 'auto' });
  });

  it('takes a fresh fix when the phone has no cached one', async () => {
    await mountFollower();
    coldGpsInHanoi();
    expect(await tap()).toBe(true);
    expect(loc.getCurrentPositionAsync).toHaveBeenCalled();
    expect(screen.getByTestId('city').textContent).toBe('hanoi');
  });

  it('says it could not when location is refused, and leaves the pick alone', async () => {
    await mountFollower();
    // A position the platform would have given, had it been allowed to:
    // refused means refused, not "refused unless there is a cached fix".
    loc.getLastKnownPositionAsync.mockResolvedValue(HANOI as never);
    expect(await tap()).toBe(false);
    expect(screen.getByTestId('city').textContent).toBe('danang');
    expect(screen.getByTestId('mode').textContent).toBe('manual');
    expect(await remembered()).toEqual({ id: 'danang', mode: 'manual' });
  });

  it('says it could not when the phone has no position to give', async () => {
    await mountFollower();
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    loc.getCurrentPositionAsync.mockResolvedValue(null as never);
    expect(await tap()).toBe(false);
    expect(screen.getByTestId('mode').textContent).toBe('manual');
  });
});

// ── where the reader is, for a screen that wants to sharpen a label ──
//
// Reads the permission, never requests it: launch has already asked, and a
// label is no reason to ask twice. Denied stays denied and the caller shows
// nothing rather than something approximate.
describe('my position', () => {
  let seen: { lat: number; lng: number } | null;
  const Where = ({ nonce = 0, give }: { nonce?: number; give: (p: typeof seen) => void }) => {
    const pos = useMyPosition(nonce);
    useEffect(() => { give(pos); });
    return null;
  };
  const report = (p: typeof seen) => { seen = p; };

  beforeEach(() => {
    seen = null;
    loc.requestForegroundPermissionsAsync.mockClear();
    loc.getLastKnownPositionAsync.mockClear();
  });

  it('is the cached fix when location is allowed', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    loc.getLastKnownPositionAsync.mockResolvedValue(HANOI as never);
    render(<Where give={report} />);
    await waitFor(() => expect(seen).toEqual({ lat: 21.02, lng: 105.84 }));
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('takes one low-accuracy read when the cache is cold', async () => {
    coldGpsInHanoi();
    render(<Where give={report} />);
    await waitFor(() => expect(seen).toEqual({ lat: 21.02, lng: 105.84 }));
    expect(loc.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Low });
  });

  it('is nothing when location is not allowed, and never raises the dialog', async () => {
    render(<Where give={report} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(seen).toBeNull();
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(loc.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it('is nothing when the platform fails, rather than an error', async () => {
    loc.getForegroundPermissionsAsync.mockRejectedValueOnce(new Error('bridge down'));
    render(<Where give={report} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(seen).toBeNull();
  });

  // The start sheet may raise the dialog itself, and granting it does
  // nothing on its own — this read has already happened. A new nonce is
  // how that caller asks again.
  it('reads again when its caller changes the nonce', async () => {
    const view = render(<Where nonce={0} give={report} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(seen).toBeNull();
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    loc.getLastKnownPositionAsync.mockResolvedValue(HANOI as never);
    view.rerender(<Where nonce={1} give={report} />);
    await waitFor(() => expect(seen).toEqual({ lat: 21.02, lng: 105.84 }));
  });
});

// ── the list last launch knew, and the list healed ──
const FULL = (id: string, name: string, lat: number, lng: number) => ({
  id, name_en: name, name_vi: name, name_ja: null, short_en: name, short_vi: name, short_ja: null,
  center_lat: lat, center_lng: lng, radius_km: 25,
});
const LIST_KEY = 'citycrew.cities';

describe('the city list', () => {
  const Count = () => {
    const { cities } = useCity();
    return <span data-testid="cities">{cities.map((c) => c.id).join(',')}</span>;
  };
  const mountList = () => render(<CityProvider><Probe /><Count /></CityProvider>);

  afterEach(async () => {
    vi.useRealTimers();
    await AsyncStorage.removeItem(LIST_KEY);
  });

  // A phone that opened the app with no network still has last launch's
  // cities to switch between, not one hardcoded Saigon.
  it('falls back to last launch’s list when this launch’s fetch comes back empty', async () => {
    await AsyncStorage.setItem(LIST_KEY, JSON.stringify([FULL('danang', 'Da Nang', 16.05, 108.2), FULL('hue', 'Hue', 16.46, 107.59)]));
    h.fake!.reset();
    h.fake!.replies({ data: [], error: null }, { data: [], error: null });
    mountList();
    await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('danang,hue'));
    expect(screen.getByTestId('city').textContent).toBe('danang');
  });

  it('writes down the list each launch fetches, for the next one', async () => {
    mountList();
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(LIST_KEY)) ?? '[]')).toEqual(CITIES));
  });

  // The reported case: no network at cold start kept the one-row fallback
  // for the whole session. The healer asks again every fifteen seconds
  // until the list comes back, and then stops.
  it('asks again for a list that failed, until it comes back, and then stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.fake!.reset();
    const healed = [...CITIES, FULL('hcmc', 'Saigon', 10.78, 106.7)];
    h.fake!.replies({ data: [], error: null }, { data: [], error: null }, { data: healed, error: null });
    mountList();
    const asked = () => h.fake!.log.filter((a) => a.table === 'cities').length;
    await waitFor(() => expect(asked()).toBe(1));
    await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('hcmc'));

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(asked()).toBe(2);
    expect(screen.getByTestId('cities').textContent).toBe('hcmc');

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi,hcmc'));
    // The city already chosen stays chosen — the fallback Saigon, since the
    // remembered Da Nang was not on the one-row list — and only the list
    // heals: the reader gets their rows back and taps if they meant
    // somewhere else.
    expect(screen.getByTestId('city').textContent).toBe('hcmc');

    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(asked()).toBe(3);
  });

  // ── the list, refreshed on return ──
  //
  // A list that succeeded was the list for the life of the process, and
  // iOS keeps a process alive for days: a city switched on in the desk
  // took a cold start to reach a phone. The provider asks again when the
  // app comes back to the foreground after the catalog's own threshold.
  describe('on return to the foreground', () => {
    let wake: ((s: string) => void) | null = null;
    const asked = () => h.fake!.log.filter((a) => a.table === 'cities').length;
    const written = () => vi.mocked(AsyncStorage.setItem).mock.calls.filter(([k]) => k === LIST_KEY).length;
    const HOIAN = FULL('hoian', 'Hoi An', 15.88, 108.33);

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
        wake = fn as (s: string) => void;
        return { remove: () => {} } as unknown as ReturnType<typeof AppState.addEventListener>;
      });
    });
    afterEach(() => { wake = null; vi.restoreAllMocks(); });

    /** Mounted, bootstrapped, and with the given reply queued for the next ask. */
    const settled = async (...next: Parameters<NonNullable<typeof h.fake>['replies']>) => {
      h.fake!.reset();
      h.fake!.replies({ data: CITIES, error: null }, ...next);
      mountList();
      await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi'));
      vi.mocked(AsyncStorage.setItem).mockClear();
    };
    const back = async () => { await act(async () => { wake!('active'); await Promise.resolve(); await Promise.resolve(); }); };

    it('asks again after a while away, takes a changed list, and keeps the city it is on', async () => {
      await settled({ data: [...CITIES, HOIAN], error: null });
      // Straight back from a notification shade: not a request.
      await back();
      expect(asked()).toBe(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      await back();
      await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi,hoian'));
      expect(asked()).toBe(2);
      expect(screen.getByTestId('city').textContent).toBe('danang');
      // Written down for the next launch, like the bootstrap's own fetch.
      expect(written()).toBe(1);
    });

    it('ignores every state but active', async () => {
      await settled({ data: [...CITIES, HOIAN], error: null });
      await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      await act(async () => { wake!('background'); wake!('inactive'); });
      expect(asked()).toBe(1);
    });

    it('leaves an unchanged list alone, and the clock running from the ask', async () => {
      await settled({ data: CITIES, error: null }, { data: [...CITIES, HOIAN], error: null });
      await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      await back();
      await waitFor(() => expect(asked()).toBe(2));
      expect(written()).toBe(0);
      // The ask that found nothing new still counts as fresh.
      await back();
      expect(asked()).toBe(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      await back();
      await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi,hoian'));
    });

    it('refuses a list that no longer holds the city on screen, and an empty one', async () => {
      await settled({ data: [FULL('hanoi', 'Hanoi', 21.03, 105.85), HOIAN], error: null }, { data: [], error: null });
      await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      await back();
      await waitFor(() => expect(asked()).toBe(2));
      expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi');
      expect(screen.getByTestId('city').textContent).toBe('danang');
      await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      await back();
      await waitFor(() => expect(asked()).toBe(3));
      expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi');
      expect(written()).toBe(0);
    });

    it('stays out of the way while the bootstrap has not brought a list back', async () => {
      h.fake!.reset();
      h.fake!.replies({ data: [], error: null }, { data: [], error: null }, { data: [], error: null });
      mountList();
      await waitFor(() => expect(asked()).toBe(1));
      await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      const before = asked();
      await back();
      // Only the healer's own ticks, if any — never one of this effect's.
      expect(asked()).toBe(before);
    });

    // ── the two halves (SOLID review, I, 20 Oct 2026) ──
    //
    // Sixteen callers read only the city on screen. A refreshed list must
    // not redraw them — not even though the network hands the same row
    // back as a new object — while a refresh that changed their row must.
    describe('a city-only caller', () => {
      const renders = { city: 0 };
      let seen: ReturnType<typeof useCurrentCity>;
      let list: ReturnType<typeof useCityList>;
      let all: ReturnType<typeof useCity>;
      function CityOnly() {
        const c = useCurrentCity();
        useEffect(() => { renders.city += 1; seen = c; });
        return null;
      }
      function ListOnly() {
        const l = useCityList();
        useEffect(() => { list = l; });
        return null;
      }
      function Both() {
        const a = useCity();
        useEffect(() => { all = a; });
        return null;
      }
      /** Bootstrapped on Da Nang, with `next` queued for the refresh — as
       *  JSON, the way the wire hands rows over: equal, never the same. */
      const onDanang = async (next: unknown[]) => {
        h.fake!.reset();
        h.fake!.replies({ data: CITIES, error: null }, { data: JSON.parse(JSON.stringify(next)), error: null });
        render(<CityProvider><Probe /><Count /><CityOnly /><ListOnly /><Both /></CityProvider>);
        await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi'));
        await waitFor(() => expect(screen.getByTestId('city').textContent).toBe('danang'));
        await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      };

      it('gets the city alone, the list its own half, and useCity both', async () => {
        await onDanang(CITIES);
        expect(Object.keys(seen)).toEqual(['city']);
        expect(Object.keys(list).sort()).toEqual(['cities', 'followMyLocation', 'mode', 'recentCityIds', 'setCity']);
        expect(all.city).toBe(seen.city);
        expect(all.cities).toBe(list.cities);
        expect(all.setCity).toBe(list.setCity);
      });

      it('is not redrawn when a refresh changes the list and not its row', async () => {
        await onDanang([...CITIES, HOIAN]);
        const before = renders.city;
        const was = seen.city;
        await back();
        await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi,hoian'));
        expect(list.cities).toHaveLength(3);
        expect(seen.city).toBe(was);
        expect(renders.city).toBe(before);
      });

      it('is redrawn when the refresh changed its own row', async () => {
        await onDanang([{ ...CITIES[0], short_en: 'Đà Nẵng' }, CITIES[1]]);
        const before = renders.city;
        await back();
        await waitFor(() => expect(seen.city?.short_en).toBe('Đà Nẵng'));
        expect(renders.city).toBe(before + 1);
      });
    });

    it('never stacks a second ask on one still out', async () => {
      await settled({ data: [...CITIES, HOIAN], error: null });
      await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 1000); });
      await act(async () => { wake!('active'); wake!('active'); });
      await waitFor(() => expect(screen.getByTestId('cities').textContent).toBe('danang,hanoi,hoian'));
      expect(asked()).toBe(2);
    });
  });
});

// ── the cities shown lately ──
//
// The city sheet's recent section (`lib/cityBook`). Every city the app
// shows goes on it, however it got there, newest first, and it is kept on
// the device — so it is the provider's to write, from the one place that
// knows which city is on screen.
describe('the recent cities', () => {
  const RECENT_KEY = 'citycrew.cities.recent';
  function Recent() {
    const { recentCityIds, setCity } = useCity();
    return (
      <>
        <span data-testid="recent">{recentCityIds.join(',')}</span>
        <button type="button" onClick={() => setCity('hanoi')}>pick hanoi</button>
      </>
    );
  }
  const show = () => render(<CityProvider><Probe /><Recent /></CityProvider>);
  const recent = () => screen.getByTestId('recent').textContent;
  const stored = async () => JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? 'null');
  const writes = () => vi.mocked(AsyncStorage.setItem).mock.calls.filter(([k]) => k === RECENT_KEY);

  // The describes above leave their own lists on the shared device.
  beforeEach(async () => { await AsyncStorage.removeItem(RECENT_KEY); });

  it('starts with the city the launch opened on, and keeps it on the device', async () => {
    show();
    await waitFor(() => expect(recent()).toBe('danang'));
    await waitFor(async () => expect(await stored()).toEqual(['danang']));
  });

  it('adds the city on screen to what an earlier launch remembered', async () => {
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(['hanoi']));
    show();
    await waitFor(() => expect(recent()).toBe('danang,hanoi'));
  });

  it('moves a picked city to the front, and writes nothing for the one already there', async () => {
    show();
    await waitFor(() => expect(recent()).toBe('danang'));
    fireEvent.click(screen.getByText('pick hanoi'));
    await waitFor(() => expect(recent()).toBe('hanoi,danang'));
    await waitFor(async () => expect(await stored()).toEqual(['hanoi', 'danang']));
    const before = writes().length;
    fireEvent.click(screen.getByText('pick hanoi'));
    expect(recent()).toBe('hanoi,danang');
    expect(writes()).toHaveLength(before);
  });

  // Where one account went is not the next one's business.
  it('forgets where the last account went when it signs out, keeping the city on screen', async () => {
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(['hanoi']));
    show();
    await waitFor(() => expect(recent()).toBe('danang,hanoi'));
    h.fake!.fireAuth('SIGNED_OUT');
    await waitFor(() => expect(recent()).toBe('danang'));
    await waitFor(async () => expect(await stored()).toEqual(['danang']));
  });
});
