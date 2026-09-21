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
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { Keyboard, Platform } from 'react-native';

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
const fetchPlaceCountByCity = vi.hoisted(() => vi.fn(async () => ({} as Record<string, number>)));
vi.mock('../lib/data', () => ({ fetchPlaceCountByCity }));

import { CitySwitcherModal } from './CitySwitcher';

beforeEach(() => {
  ctx.city = { ...hanoi };
  ctx.mode = 'auto';
  setCity.mockClear();
  followMyLocation.mockClear();
  followMyLocation.mockImplementation(async () => true);
  fetchPlaceCountByCity.mockClear();
  fetchPlaceCountByCity.mockImplementation(async () => ({}));
});

describe('the list of cities', () => {
  it('names every city the catalog has', () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(screen.getByText('Hanoi')).toBeTruthy();
    expect(screen.getByText('Saigon')).toBeTruthy();
  });

  // The tick is gone with the redesign; the chosen row is its tint, its
  // accent text and `aria-selected`. That last one is the part a test has
  // to hold, because it is the only half that is not colour.
  it('marks the one currently showing, in something other than colour', () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    const chosen = document.querySelectorAll('[aria-selected="true"]');
    expect(chosen).toHaveLength(1);
    expect(chosen[0].textContent).toContain('Hanoi');
  });

  // A chevron promises a screen on the other side, and no row here has
  // one: a tap sets the city and the sheet closes.
  it('draws no chevrons', () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(document.querySelectorAll('[data-icon="chevron-forward"]')).toHaveLength(0);
  });

  // Eight cities is where a list stops being scannable, which is the
  // only reason this field exists.
  describe('the search field', () => {
    const type = (text: string) => fireEvent.change(screen.getByTestId('city-search'), { target: { value: text } });

    it('narrows the list to what was typed', () => {
      render(<CitySwitcherModal visible onClose={() => {}} />);
      type('han');
      expect(screen.getByText('Hanoi')).toBeTruthy();
      expect(screen.queryByText('Saigon')).toBeNull();
    });

    // The ordinary case on a phone keyboard, not the exception: nobody
    // reaches for the circumflex to find Hà Nội.
    it('finds a city typed without its diacritics', () => {
      render(<CitySwitcherModal visible onClose={() => {}} />);
      type('ha noi');
      expect(screen.getByText('Hanoi')).toBeTruthy();
    });

    // A reader with the app in Vietnamese still types "saigon" as often
    // as "sài gòn", so every name a city answers to is searched — not
    // only the one on screen.
    it('matches a name in a language the row is not showing', () => {
      render(<CitySwitcherModal visible onClose={() => {}} />);
      type('sài gòn');
      expect(screen.getByText('Saigon')).toBeTruthy();
      expect(screen.queryByText('Hanoi')).toBeNull();
    });

    it('says so rather than showing an empty sheet', () => {
      render(<CitySwitcherModal visible onClose={() => {}} />);
      type('zzz');
      expect(screen.getByText('No city by that name')).toBeTruthy();
    });

    // A row still chooses while the keyboard is up — see
    // keyboardShouldPersistTaps.
    it('still switches to a city it has just found', () => {
      const onClose = vi.fn();
      render(<CitySwitcherModal visible onClose={onClose} />);
      type('sai');
      fireEvent.click(screen.getByText('Saigon'));
      expect(setCity).toHaveBeenCalledWith('saigon');
      expect(onClose).toHaveBeenCalled();
    });
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
    // And asks for nothing either — the counts wait for the first open.
    expect(fetchPlaceCountByCity).not.toHaveBeenCalled();
  });

  // The promise each row makes: fifteen places is a different offer from
  // a hundred and seventy-nine, and the young one says so before anyone
  // walks in expecting Hanoi.
  it('wears each city’s place count, and introduces the young one as new', async () => {
    fetchPlaceCountByCity.mockImplementation(async () => ({ hanoi: 179, saigon: 15 }));
    render(<CitySwitcherModal visible onClose={() => {}} />);
    // The number alone now, at the row's right edge — the word "places"
    // repeated down a column said nothing the heading had not.
    expect(await screen.findByText('179')).toBeTruthy();
    expect(await screen.findByText('15')).toBeTruthy();
    // The badge belongs to the name, not the count. Written under it as
    // "15 places · new" it read as fifteen newly added places; the count
    // line is now the count alone, and NEW stands beside "Saigon".
    expect(await screen.findByText('NEW')).toBeTruthy();
    expect(screen.queryByText(/places · new/)).toBeNull();
    expect(screen.queryByText('179 places')).toBeNull();
  });

  it('badges only the young city, never the deep one', async () => {
    fetchPlaceCountByCity.mockImplementation(async () => ({ hanoi: 179, saigon: 15 }));
    render(<CitySwitcherModal visible onClose={() => {}} />);
    // Two cities on screen, one badge — the threshold is doing work
    // rather than the badge being unconditional.
    await screen.findByText('NEW');
    expect(screen.queryAllByText('NEW')).toHaveLength(1);
  });

  it('keeps its quiet when the count never came', async () => {
    fetchPlaceCountByCity.mockImplementationOnce(async () => { throw new Error('offline'); });
    render(<CitySwitcherModal visible onClose={() => {}} />);
    expect(await screen.findByText('Hanoi')).toBeTruthy();
    expect(screen.queryByText(/^\d+$/)).toBeNull();
    // No count means no judgement about age either — a row that says
    // nothing must not imply a city is young.
    expect(screen.queryByText('NEW')).toBeNull();
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

// ── the keyboard ──
//
// The sheet is pinned to the bottom of the screen. Raising a keyboard over
// it hid the field being typed into along with everything below — which is
// the whole sheet, the field included, on a phone whose keyboard is 336 of
// 852 points.
//
// `Platform.OS` is 'web' in this environment and the listener is iOS-only,
// so the test says which platform it is and then plays the notification the
// sheet is listening for. What it pins is the arithmetic the sheet does
// with that number, which is the part that was missing.
describe('the city sheet and the keyboard', () => {
  const asIos = () => {
    const was = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    return () => Object.defineProperty(Platform, 'OS', { value: was, configurable: true });
  };

  const raise = (height: number) => {
    const calls = (Keyboard.addListener as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const show = calls.find((c) => c[0] === 'keyboardWillShow')?.[1] as
      (e: { endCoordinates: { height: number } }) => void;
    act(() => show({ endCoordinates: { height } }));
  };

  const hide = () => {
    const calls = (Keyboard.addListener as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const off = calls.find((c) => c[0] === 'keyboardWillHide')?.[1] as () => void;
    act(() => off());
  };

  it('stands on top of the keyboard rather than under it', () => {
    const restore = asIos();
    const spy = vi.spyOn(Keyboard, 'addListener').mockReturnValue({ remove: () => {} } as never);
    try {
      render(<CitySwitcherModal visible onClose={() => {}} />);
      const sheet = screen.getByTestId('city-sheet');
      expect(sheet.style.bottom).toBe('0px');

      raise(336);
      expect(sheet.style.bottom).toBe('336px');

      hide();
      expect(sheet.style.bottom).toBe('0px');
    } finally {
      spy.mockRestore();
      restore();
    }
  });

  // A sheet lifted onto the keyboard has less room, not the same room
  // higher up. Without this it keeps its full height and pushes its own
  // rows off the top of the screen.
  it('gives up the height the keyboard took', () => {
    const restore = asIos();
    const spy = vi.spyOn(Keyboard, 'addListener').mockReturnValue({ remove: () => {} } as never);
    try {
      render(<CitySwitcherModal visible onClose={() => {}} />);
      const sheet = screen.getByTestId('city-sheet');
      const full = parseFloat(sheet.style.maxHeight);

      raise(336);
      expect(parseFloat(sheet.style.maxHeight)).toBeCloseTo(full - 336 * 0.92, 1);
    } finally {
      spy.mockRestore();
      restore();
    }
  });

  // The cap above is a ceiling, not a promise: when the sheet is lifted
  // there is less than the list's own 380 left, and a child that cannot
  // shrink overflows instead of scrolling.
  //
  // Weaker than it looks, and worth saying so: react-native-web's
  // ScrollView already shrinks on its own, so deleting the declaration
  // leaves this green while breaking the phone, where React Native's
  // default is 0. What it does catch is the value being set the other
  // way, which is the change somebody would make on purpose.
  it('lets the list yield, since nothing above it can', () => {
    render(<CitySwitcherModal visible onClose={() => {}} />);
    // The scroller is the box the city rows live in.
    const list = screen.getByText('Hanoi').closest('[class*="r-overflowY"]') as HTMLElement;
    expect(list, 'the city rows should sit in a scroller').toBeTruthy();
    expect(getComputedStyle(list).maxHeight).toBe('380px');
    expect(getComputedStyle(list).flexShrink).toBe('1');
  });
});
