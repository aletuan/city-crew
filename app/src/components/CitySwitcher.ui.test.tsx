// @vitest-environment jsdom
//
// The city sheet — two ways to choose, and the difference between them.
//
// It also holds the one control the lint gate found by name: the action
// behind "Use my location" was called `useMyLocation` until then, which is
// how React spells "hook". It is `followMyLocation` now, and this is the
// test that would notice if it quietly became a hook again.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';

const hanoi = { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' };
const ctx = vi.hoisted(() => ({
  city: { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' } as
    { id: string; short_en: string; short_vi: string; short_ja: string } | null,
  mode: 'auto' as 'auto' | 'manual',
}));
const setCity = vi.hoisted(() => vi.fn());
const followMyLocation = vi.hoisted(() => vi.fn(async () => true));

vi.mock('../lib/city', () => ({
  useCity: () => ({
    city: ctx.city,
    cities: [
      { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' },
      { id: 'saigon', short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'サイゴン' },
    ],
    mode: ctx.mode,
    setCity,
    followMyLocation,
  }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { CitySwitcherModal } from './CitySwitcher';

beforeEach(() => {
  ctx.city = { ...hanoi };
  ctx.mode = 'auto';
  setCity.mockClear();
  followMyLocation.mockClear();
  followMyLocation.mockImplementation(async () => true);
});

describe('the list of cities', () => {
  it('names every city the catalog has', () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('Hanoi')).toBeTruthy();
    expect(screen.getByText('Saigon')).toBeTruthy();
  });

  it('ticks the one currently showing', () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(document.querySelector('[data-icon="checkmark"]')).toBeTruthy();
  });

  it('switches, then gets out of the way', () => {
    const onClose = vi.fn();
    render(<CitySwitcherModal visible onClose={onClose} />);
    fireEvent.click(screen.getByText('Saigon'));
    expect(setCity).toHaveBeenCalledWith('saigon');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing while it is closed', () => {
    render(<CitySwitcherModal visible={false} onClose={() => {}} />);
    expect(screen.queryByText('Hanoi')).toBeNull();
  });
});

describe('"Use my location"', () => {
  // The name is the point. `followMyLocation` is an async action called from
  // a press handler; naming it `use…` told React's own rules it was a hook
  // called inside a callback — which is a fault, had it been one.
  it('runs the action behind it', async () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    fireEvent.click(screen.getByText('Use my location'));
    await waitFor(() => expect(followMyLocation).toHaveBeenCalled());
  });

  it('says it is working while it is', async () => {
    let release: (found: boolean) => void = () => {};
    followMyLocation.mockImplementation(() => new Promise<boolean>((r) => { release = r; }));
    render(<CitySwitcherModal visible onClose={() => {}} />);

    fireEvent.click(screen.getByText('Use my location'));
    expect(await screen.findByText('Locating…')).toBeTruthy();

    release(true);
    await waitFor(() => expect(screen.queryByText('Locating…')).toBeNull());
  });

  // A second tap while the first is still out would ask the platform twice
  // and close the sheet under the answer to the first.
  it('ignores a second tap while the first is still out', async () => {
    followMyLocation.mockImplementation(() => new Promise<boolean>(() => {}));
    render(<CitySwitcherModal visible onClose={() => {}} />);

    const row = screen.getByText('Use my location');
    fireEvent.click(row);
    await screen.findByText('Locating…');
    fireEvent.click(screen.getByText('Locating…'));

    expect(followMyLocation).toHaveBeenCalledOnce();
  });

  it('closes once a city was found', async () => {
    const onClose = vi.fn();
    render(<CitySwitcherModal visible onClose={onClose} />);
    fireEvent.click(screen.getByText('Use my location'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  // Refusing at the SYSTEM prompt is an answer — but the person just
  // tapped a row explicitly asking, and a sheet that closes over nothing
  // is a broken button. Empty-handed now says so in place, and the city
  // the reader was already looking at stays.
  it('says so, in place, when it comes back empty-handed', async () => {
    const onClose = vi.fn();
    followMyLocation.mockImplementationOnce(async () => false);
    render(<CitySwitcherModal visible onClose={onClose} />);

    fireEvent.click(screen.getByText('Use my location'));
    expect(await screen.findByText(/check location access/i)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(setCity).not.toHaveBeenCalled();
  });

  it('treats an unexpected failure the same as an empty hand', async () => {
    followMyLocation.mockImplementationOnce(async () => { throw new Error('bridge died'); });
    render(<CitySwitcherModal visible onClose={() => {}} />);
    fireEvent.click(screen.getByText('Use my location'));
    expect(await screen.findByText(/check location access/i)).toBeTruthy();
  });

  // "On" alone answered half the question — the subtitle names the city
  // the auto choice resolved to.
  it('names the city the app chose for you', () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText(/you're in Hanoi/i)).toBeTruthy();
  });

  it('falls back to the plain sentence while no city has resolved', () => {
    ctx.city = null;
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText(/nearest city is selected for you/i)).toBeTruthy();
  });

  it('says so too when the choice was made by hand', () => {
    ctx.mode = 'manual';
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText(/picking manually/i)).toBeTruthy();
  });
});
