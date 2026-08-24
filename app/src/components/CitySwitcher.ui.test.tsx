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

const ctx = vi.hoisted(() => ({
  city: { id: 'hanoi' } as { id: string } | null,
  mode: 'auto' as 'auto' | 'manual',
}));
const setCity = vi.hoisted(() => vi.fn());
const followMyLocation = vi.hoisted(() => vi.fn(async () => {}));

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
  ctx.city = { id: 'hanoi' };
  ctx.mode = 'auto';
  setCity.mockClear();
  followMyLocation.mockClear();
  followMyLocation.mockImplementation(async () => {});
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
    let release: () => void = () => {};
    followMyLocation.mockImplementation(() => new Promise<void>((r) => { release = r; }));
    render(<CitySwitcherModal visible onClose={() => {}} />);

    fireEvent.click(screen.getByText('Use my location'));
    expect(await screen.findByText('Locating…')).toBeTruthy();

    release();
    await waitFor(() => expect(screen.queryByText('Locating…')).toBeNull());
  });

  // A second tap while the first is still out would ask the platform twice
  // and close the sheet under the answer to the first.
  it('ignores a second tap while the first is still out', async () => {
    followMyLocation.mockImplementation(() => new Promise<void>(() => {}));
    render(<CitySwitcherModal visible onClose={() => {}} />);

    const row = screen.getByText('Use my location');
    fireEvent.click(row);
    await screen.findByText('Locating…');
    fireEvent.click(screen.getByText('Locating…'));

    expect(followMyLocation).toHaveBeenCalledOnce();
  });

  // Refusing the permission is not an error to report — it is an answer,
  // and the city the reader was already looking at stays.
  it('keeps the current city when the reader refuses the permission', async () => {
    const onClose = vi.fn();
    followMyLocation.mockImplementationOnce(async () => { throw new Error('denied'); });
    render(<CitySwitcherModal visible onClose={onClose} />);

    fireEvent.click(screen.getByText('Use my location'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(setCity).not.toHaveBeenCalled();
  });

  it('says whether the app is choosing for you', () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText(/nearest city is selected for you/i)).toBeTruthy();
  });

  it('says so too when the choice was made by hand', () => {
    ctx.mode = 'manual';
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText(/picking manually/i)).toBeTruthy();
  });
});
