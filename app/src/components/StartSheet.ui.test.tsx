// @vitest-environment jsdom
//
// Where the day should start — the sheet, driven.
//
// `IdeasScreen`'s test stands this sheet in with a stub that records its
// props, so the sheet's own decisions had no test: which point the map
// shows for each of the three ways of answering, the two words the one
// button can wear, what a search result carries out, what a tapped pin is
// called, and the locate button's answer to a permission iOS will only
// ever ask for once. The pure halves — `areasNear`, `ctaMode`,
// `findSpots`' shaping — are held at 100% in `lib`.
//
// `MiniMap` is stood in for: the real one cannot load under jsdom (it
// requires the native map, and `expo-constants` will not import here),
// and the sheet's contract with it is three props and two callbacks,
// which the stand-in exposes as buttons and text.

import React from 'react';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Place } from '../lib/types';

const findSpots = vi.hoisted(() => vi.fn(async () => [] as { name: string; label: string; lat: number; lng: number }[]));
const nameOf = vi.hoisted(() => vi.fn(async () => 'Hoàn Kiếm'));
const world = vi.hoisted(() => ({
  city: { id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', center_lat: 21.03, center_lng: 105.85 } as
    { id: string; name_en: string; name_vi: string; center_lat: number; center_lng: number } | null,
  me: null as { lat: number; lng: number } | null,
}));
vi.mock('../lib/findplace', () => ({ findSpots, nameOf }));
vi.mock('../lib/city', () => ({ useCity: () => ({ city: world.city }), useMyPosition: () => world.me }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('./MiniMap', async () => {
  const R = await import('react');
  return {
    canDrawMap: true,
    default: (p: { lat: number; lng: number; caption?: string; onPick: (at: { lat: number; lng: number }) => void; onLocate?: () => void }) =>
      R.createElement('div', null,
        R.createElement('span', { 'data-testid': 'centre' }, `${p.lat},${p.lng}`),
        R.createElement('span', { 'data-testid': 'caption' }, p.caption ?? ''),
        R.createElement('button', { 'aria-label': 'drop a pin', onClick: () => p.onPick({ lat: 20.97, lng: 105.77 }) }),
        R.createElement('button', { 'aria-label': 'locate', onClick: p.onLocate })),
  };
});

import StartSheet, { type Start } from './StartSheet';

const place = (slug: string, neighborhood_en: string, lat: number, lng: number): Place =>
  ({ slug, name_en: slug, neighborhood_en, lat, lng } as unknown as Place);
// Hanoi, roughly: two in the old quarter, and one apiece elsewhere, with
// Hà Đông the far south-west so a pin there reorders the chips.
const PLACES = [
  place('a', 'Hoàn Kiếm', 21.03, 105.85), place('b', 'Hoàn Kiếm', 21.028, 105.852),
  place('c', 'Ba Đình', 21.035, 105.83), place('d', 'Tây Hồ', 21.07, 105.82),
  place('e', 'Hà Đông', 20.97, 105.77), place('f', 'Cầu Giấy', 21.03, 105.79),
];
const NOWHERE: Start = { district: null, at: null, atName: null };

const location = vi.mocked(Location);
const openSheet = (value: Start = NOWHERE, onDone = vi.fn()) => {
  const view = render(<StartSheet visible places={PLACES} value={value} onClose={() => {}} onDone={onDone} />);
  return { ...view, onDone };
};
const centre = () => screen.getByTestId('centre').textContent;
const caption = () => screen.getByTestId('caption').textContent;
const chip = (name: string) => screen.getByRole('button', { name });
const cta = () => screen.getByRole('button', { name: /Search|Use this location/ });
const field = () => screen.getByPlaceholderText('Search an address or place') as HTMLInputElement;
const type = (q: string) => fireEvent.change(field(), { target: { value: q } });
/** The sheet asks the geocoder on every move; settled once its answer is in. */
const named = () => waitFor(() => expect(caption()).not.toBe(''));

beforeEach(() => {
  findSpots.mockClear();
  findSpots.mockResolvedValue([]);
  nameOf.mockClear();
  nameOf.mockResolvedValue('Hoàn Kiếm');
  world.city = { id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', center_lat: 21.03, center_lng: 105.85 };
  world.me = null;
  location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
  location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true } as never);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the map, and what it shows', () => {
  it('opens on the city when nothing is known, and asks the geocoder nothing', () => {
    openSheet();
    expect(screen.getByText('Where should it start?')).toBeTruthy();
    expect(centre()).toBe('21.03,105.85');
    // No pin and no position: there is no point to put a name to.
    expect(nameOf).not.toHaveBeenCalled();
    expect(caption()).toBe('');
  });

  it('draws no map at all when there is nothing to centre one on', () => {
    // No city, no position, no pin: a map of nowhere is worse than none,
    // and the rest of the sheet — the search, the areas — still stands.
    world.city = null;
    openSheet();
    expect(screen.queryByTestId('centre')).toBeNull();
    expect(field()).toBeTruthy();
  });

  it('opens on the reader when their position is known, and says so under the map', async () => {
    world.me = { lat: 21.02, lng: 105.84 };
    openSheet();
    expect(centre()).toBe('21.02,105.84');
    await named();
    expect(nameOf).toHaveBeenCalledWith({ lat: 21.02, lng: 105.84 }, 'en');
    expect(caption()).toBe("You're here · Hoàn Kiếm");
  });

  // The one this missed: picking an area set a district and no point, so
  // everything below fell back to where the reader was standing.
  it('moves to the area that was picked, not to where the reader stands', async () => {
    world.me = { lat: 21.02, lng: 105.84 };
    openSheet();
    fireEvent.click(chip('Hà Đông'));
    expect(centre()).toBe('20.97,105.77');
    // Named as the area's point, and no longer "here".
    await named();
    expect(caption()).toBe('Hoàn Kiếm');
  });

  it('moves to a tapped pin, and forgets the old point’s name while the new one is asked for', async () => {
    world.me = { lat: 21.02, lng: 105.84 };
    openSheet();
    await named();
    nameOf.mockResolvedValue('Hà Đông');
    fireEvent.click(screen.getByRole('button', { name: 'drop a pin' }));
    expect(centre()).toBe('20.97,105.77');
    // Cleared at the tap: the old point's name must not be read as this one's.
    expect(caption()).toBe('');
    await named();
    expect(caption()).toBe('Hà Đông');
  });
});

describe('the areas', () => {
  it('offers the catalog’s areas as nearby while the reader is near them', () => {
    world.me = { lat: 21.03, lng: 105.85 };
    openSheet();
    expect(screen.getByText('Or pick a nearby area')).toBeTruthy();
    // Nearest first: the old quarter, where the reader stands.
    expect(screen.getAllByRole('button', { name: /^(Hoàn Kiếm|Ba Đình|Tây Hồ|Hà Đông|Cầu Giấy)$/ })[0].textContent).toBe('Hoàn Kiếm');
  });

  it('names the city instead of claiming a proximity that is not there', () => {
    // Thanh Hóa, a hundred and fifty kilometres south.
    world.me = { lat: 19.8, lng: 105.78 };
    openSheet();
    expect(screen.getByText('Or pick an area in Hanoi')).toBeTruthy();
  });

  it('offers the areas plainly when there is no city to name and the reader is far', () => {
    world.city = null;
    world.me = { lat: 19.8, lng: 105.78 };
    openSheet();
    expect(screen.getByText('Or pick an area')).toBeTruthy();
    // No city and no pin: the map centres on the reader.
    expect(centre()).toBe('19.8,105.78');
  });

  it('reorders around the pin, which wins over where the reader stands', () => {
    world.me = { lat: 21.03, lng: 105.85 };
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'drop a pin' }));
    expect(screen.getAllByRole('button', { name: /^(Hoàn Kiếm|Ba Đình|Tây Hồ|Hà Đông|Cầu Giấy)$/ })[0].textContent).toBe('Hà Đông');
  });

  it('hands a picked area out as the district, with no point', () => {
    const { onDone } = openSheet();
    fireEvent.click(chip('Tây Hồ'));
    expect(chip('Tây Hồ').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith({ district: 'Tây Hồ', at: null, atName: null });
  });

  it('lets the same chip take the answer back', () => {
    const { onDone } = openSheet({ district: 'Tây Hồ', at: null, atName: null });
    expect(chip('Tây Hồ').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(chip('Tây Hồ'));
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith(NOWHERE);
  });

  it('drops a half-typed search when an area is taken instead', () => {
    openSheet();
    type('cau giay');
    expect(cta().textContent).toBe('Search');
    fireEvent.click(chip('Ba Đình'));
    expect(field().value).toBe('');
    expect(cta().textContent).toBe('Use this location');
  });
});

describe('the search', () => {
  const PARK = { name: 'Cầu Giấy Park', label: 'Cầu Giấy, Hanoi', lat: 21.032, lng: 105.792 };
  const OFFICE = { name: 'Quý Lộc commune office', label: '', lat: 20.1, lng: 105.6 };

  it('turns the button into Search while the field holds a question nobody has asked', () => {
    openSheet();
    expect(cta().textContent).toBe('Use this location');
    type('cau giay');
    expect(cta().textContent).toBe('Search');
  });

  it('asks Google once, biased by the point the map is on, and lists what came back', async () => {
    findSpots.mockResolvedValue([PARK, OFFICE]);
    openSheet();
    type('  cau giay ');
    fireEvent.click(cta());

    // Trimmed; biased by the city's centre since nothing else is known;
    // the city and the language along for the ride.
    await waitFor(() => expect(findSpots).toHaveBeenCalledWith('cau giay', { lat: 21.03, lng: 105.85 }, 'hanoi', 'en'));
    expect(await screen.findByText('Cầu Giấy Park')).toBeTruthy();
    expect(screen.getByText('Cầu Giấy, Hanoi')).toBeTruthy();
    // A result whose address said nothing the name had not is one line tall.
    expect(screen.getByText('Quý Lộc commune office')).toBeTruthy();
    // Asked, so the button stops offering to ask again.
    expect(cta().textContent).toBe('Use this location');
  });

  it('takes a result: the pin moves, the list goes, the name rides out', async () => {
    findSpots.mockResolvedValue([PARK, OFFICE]);
    const { onDone } = openSheet();
    type('cau giay');
    fireEvent.click(cta());
    fireEvent.click(await screen.findByText('Cầu Giấy Park'));

    expect(centre()).toBe('21.032,105.792');
    expect(screen.queryByText('Quý Lộc commune office')).toBeNull();
    expect(field().value).toBe('Cầu Giấy Park');
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith({ district: null, at: { lat: 21.032, lng: 105.792 }, atName: 'Cầu Giấy Park' });
  });

  it('says when nothing was found, and lets the reader use the pin they have', async () => {
    const { onDone } = openSheet();
    type('xyzzy');
    fireEvent.click(cta());

    expect(await screen.findByText('Nothing found for that. Try fewer words, or a street and district.')).toBeTruthy();
    // The reader has had their answer; the button offers the pin, not another ask.
    expect(cta().textContent).toBe('Use this location');
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith(NOWHERE);
    // Typing again is a new question.
    type('xyzzy again');
    expect(screen.queryByText(/Nothing found/)).toBeNull();
    expect(cta().textContent).toBe('Search');
  });

  it('asks once, however many times the button is pressed while it is out', async () => {
    let answer: (v: never[]) => void = () => {};
    findSpots.mockReturnValue(new Promise((r) => { answer = r; }));
    openSheet();
    type('cau giay');
    fireEvent.click(cta());
    fireEvent.click(cta());
    fireEvent.click(cta());
    expect(findSpots).toHaveBeenCalledTimes(1);
    // Working, visibly.
    expect(screen.getByRole('progressbar')).toBeTruthy();
    await act(async () => { answer([]); });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('searches without a city when the catalog has none, biased by the reader alone', async () => {
    world.city = null;
    world.me = { lat: 19.8, lng: 105.78 };
    openSheet();
    type('quy loc');
    fireEvent.click(cta());
    await waitFor(() => expect(findSpots).toHaveBeenCalledWith('quy loc', { lat: 19.8, lng: 105.78 }, null, 'en'));
  });

  it('scrolls the field into view when it takes focus', () => {
    // The map goes off screen while you type — the right trade, since
    // the map carries nothing while an address is being typed. The
    // scroll itself is geometry jsdom does not do; what can be pinned is
    // that focusing asks the list to move, and asks for the field's own
    // position rather than the top.
    // react-native-web scrolls by assigning `scrollTop`; the assignment
    // is what is listened for, since jsdom has no layout to move.
    const set = vi.fn();
    const own = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!;
    Object.defineProperty(Element.prototype, 'scrollTop', { configurable: true, get: () => 0, set });
    try {
      openSheet();
      fireEvent.focus(field());
      // The field's own position (0 here, with no layout to report one),
      // eight points short so the label above it stays in view.
      expect(set).toHaveBeenCalledWith(0);
    } finally {
      Object.defineProperty(Element.prototype, 'scrollTop', own);
    }
  });

  it('asks nothing for an empty field', () => {
    openSheet();
    type('   ');
    fireEvent.click(cta());
    expect(findSpots).not.toHaveBeenCalled();
  });

  it('searches from the keyboard too', async () => {
    findSpots.mockResolvedValue([PARK]);
    openSheet();
    type('park');
    fireEvent.keyDown(field(), { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(findSpots).toHaveBeenCalledWith('park', expect.anything(), 'hanoi', 'en'));
  });
});

describe('a pin with no name of its own', () => {
  // The row on the Ideas screen prints these words; before this it said
  // "A pin you dropped" over a place the reader had just picked by name.
  it('leaves with the name the geocoder gave the point', async () => {
    nameOf.mockResolvedValue('Hà Đông');
    const { onDone } = openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'drop a pin' }));
    await named();
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith({ district: null, at: { lat: 20.97, lng: 105.77 }, atName: 'Hà Đông' });
  });

  it('leaves nameless when the geocoder has not answered', () => {
    nameOf.mockReturnValue(new Promise(() => {}));
    const { onDone } = openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'drop a pin' }));
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith({ district: null, at: { lat: 20.97, lng: 105.77 }, atName: null });
  });
});

describe('the locate button', () => {
  const locate = () => fireEvent.click(screen.getByRole('button', { name: 'locate' }));
  const NOTICE = /City Crew is not allowed to know where you are/;

  it('goes back to near-me and asks nothing when the permission is already held', async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as never);
    const { onDone } = openSheet({ district: 'Tây Hồ', at: null, atName: null });
    locate();

    await waitFor(() => expect(location.getForegroundPermissionsAsync).toHaveBeenCalled());
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(screen.queryByText(NOTICE)).toBeNull();
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith(NOWHERE);
  });

  it('raises the dialog while it still can', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true } as never);
    openSheet();
    locate();
    await waitFor(() => expect(location.requestForegroundPermissionsAsync).toHaveBeenCalled());
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  // iOS asks once per install. After "Don't Allow" every later request
  // returns denied with no interface at all — the silent button.
  it('says what is missing, and offers Settings, once the system will not ask again', async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    // Native only: react-native-web's `Linking` has no `openSettings` to
    // spy on, so the door is put there for the test and taken away after.
    const openSettings = vi.fn(async () => {});
    (Linking as unknown as { openSettings?: () => Promise<void> }).openSettings = openSettings;
    try {
      openSheet();
      locate();

      expect(await screen.findByText(NOTICE)).toBeTruthy();
      expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
      expect(openSettings).toHaveBeenCalled();
    } finally {
      delete (Linking as unknown as { openSettings?: unknown }).openSettings;
    }
  });

  it('says so too when the dialog it raised was the last one', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    openSheet();
    locate();
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });

  // Coming back from Settings having granted it: the notice must not
  // still be telling the reader to do the thing they just did.
  it('takes the notice down when the reader returns with the switch on', async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    let onChange: ((s: string) => void) | null = null;
    vi.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      onChange = cb;
      return { remove: () => {} };
    }) as never);
    openSheet();
    locate();
    await screen.findByText(NOTICE);
    expect(onChange).not.toBeNull();

    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as never);
    await act(async () => { onChange!('active'); });
    await waitFor(() => expect(screen.queryByText(NOTICE)).toBeNull());
  });

  it('leaves the notice up when the reader comes back without granting it', async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    let onChange: ((s: string) => void) | null = null;
    vi.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      onChange = cb;
      return { remove: () => {} };
    }) as never);
    openSheet();
    locate();
    await screen.findByText(NOTICE);

    await act(async () => { onChange!('background'); onChange!('active'); });
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });
});

describe('opening again', () => {
  // The sheet is a question, and closing it without answering must not
  // change the answer that was already there.
  it('starts from the value it was given, with the last visit’s typing gone', () => {
    const value: Start = { district: 'Tây Hồ', at: null, atName: null };
    const view = render(<StartSheet visible places={PLACES} value={value} onClose={() => {}} onDone={() => {}} />);
    type('cau giay');
    fireEvent.click(chip('Ba Đình'));

    view.rerender(<StartSheet visible={false} places={PLACES} value={value} onClose={() => {}} onDone={() => {}} />);
    view.rerender(<StartSheet visible places={PLACES} value={value} onClose={() => {}} onDone={() => {}} />);
    expect(field().value).toBe('');
    expect(chip('Tây Hồ').getAttribute('aria-selected')).toBe('true');
    expect(chip('Ba Đình').getAttribute('aria-selected')).toBe('false');
  });
});
