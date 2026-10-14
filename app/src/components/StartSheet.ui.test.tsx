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
import { act, cleanup, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Place } from '../lib/types';

const findSpots = vi.hoisted(() => vi.fn(async () => [] as { name: string; label: string; lat: number; lng: number }[]));
const nameOf = vi.hoisted(() => vi.fn(async () => 'Hoàn Kiếm'));
const world = vi.hoisted(() => ({
  city: { id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', center_lat: 21.03, center_lng: 105.85, radius_km: 25 } as
    { id: string; name_en: string; name_vi: string; center_lat: number; center_lng: number; radius_km: number } | null,
  cities: [
    { id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', name_ja: null, center_lat: 21.03, center_lng: 105.85, radius_km: 25 },
    { id: 'hcmc', name_en: 'Ho Chi Minh City', name_vi: 'Thành phố Hồ Chí Minh', name_ja: null, center_lat: 10.7769, center_lng: 106.7009, radius_km: 25 },
  ],
  mode: 'auto' as 'auto' | 'manual',
  me: null as { lat: number; lng: number } | null,
  session: { user: { id: 'u1' } } as { user: { id: string } } | null,
}));
const SignedOutError = vi.hoisted(() => class SignedOutError extends Error {});
vi.mock('../lib/findplace', () => ({ findSpots, nameOf, SignedOutError }));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ session: world.session }) }));
const setCity = vi.hoisted(() => vi.fn());
const followMyLocation = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../lib/city', () => ({
  useCity: () => ({ city: world.city, cities: world.cities, mode: world.mode, setCity, followMyLocation }),
  useMyPosition: () => world.me,
}));
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
const openSheet = (value: Start = NOWHERE, onDone = vi.fn(), onNeedSignIn = vi.fn()) => {
  const view = render(<StartSheet visible places={PLACES} value={value} onClose={() => {}} onDone={onDone} onNeedSignIn={onNeedSignIn} />);
  return { ...view, onDone, onNeedSignIn };
};
const centre = () => screen.getByTestId('centre').textContent;
const caption = () => screen.getByTestId('caption').textContent;
const chip = (name: string) => screen.getByRole('button', { name });
const cta = () => screen.getByRole('button', { name: /Search|Use this location/ });
const row = () => screen.getByRole('button', { name: 'Current location' });
const SAIGON = { name: 'Thành phố Hồ Chí Minh', label: 'Vietnam', lat: 10.78, lng: 106.70 };
const NHATRANG = { name: 'Nha Trang', label: 'Khánh Hòa', lat: 12.2388, lng: 109.1967 };
/** Search, and take the one result. */
const takeResult = async (q: string, spot: { name: string }) => {
  type(q);
  fireEvent.click(cta());
  fireEvent.click(await screen.findByText(spot.name));
};
const field = () => screen.getByPlaceholderText('Search an address or place') as HTMLInputElement;
const type = (q: string) => fireEvent.change(field(), { target: { value: q } });
/**
 * The sheet asks the geocoder on every move; settled once *this* answer is
 * in, which is why it takes the name rather than "not empty".
 *
 * Polling is enough where the caption *is* the assertion. It is not enough
 * for a test that goes on to press the button, because every move clears
 * the caption and refills it a promise later (`onPick` sets `where` to ''
 * on purpose, so the old point's name is never read as the new one's): a
 * poll can return on a name that is already on its way out, and the press
 * then reads the gap. CI caught that three times as `atName: null` where
 * 'Hà Đông' was due. Such a test holds the geocoder open instead — see
 * "a pin with no name of its own".
 */
const named = (name: string) => waitFor(() => expect(caption()).toBe(name));

beforeEach(() => {
  findSpots.mockClear();
  findSpots.mockResolvedValue([]);
  nameOf.mockClear();
  nameOf.mockResolvedValue('Hoàn Kiếm');
  world.city = { id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', center_lat: 21.03, center_lng: 105.85, radius_km: 25 };
  world.cities = [
    { id: 'hanoi', name_en: 'Hanoi', name_vi: 'Hà Nội', name_ja: null, center_lat: 21.03, center_lng: 105.85, radius_km: 25 },
    { id: 'hcmc', name_en: 'Ho Chi Minh City', name_vi: 'Thành phố Hồ Chí Minh', name_ja: null, center_lat: 10.7769, center_lng: 106.7009, radius_km: 25 },
  ];
  world.mode = 'auto';
  world.me = null;
  setCity.mockClear();
  location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
  location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true } as never);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the map, and what it shows', () => {
  it('opens on the city when nothing is known, and asks the geocoder nothing', () => {
    openSheet();
    expect(screen.getByText('Choose a starting point')).toBeTruthy();
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

  // The last line of this test is a privacy fact, not only a UI one: the
  // reader's own position leaves the phone here — through `fetch-place` to
  // Google — so the caption can name the street. The privacy policy says so
  // under "Your location and the map" (`lib/legal.ts`), and for a month it
  // said the opposite ("never leaves your phone") while this line passed.
  // Change what is sent here and that section changes in the same commit;
  // so do `docs/store/app-privacy-labels.md` and the MAPS and LOCATION
  // paragraphs in `docs/store/review-notes.md`, which is what Apple reads.
  it('opens on the reader when their position is known, and says so under the map', async () => {
    world.me = { lat: 21.02, lng: 105.84 };
    openSheet();
    expect(centre()).toBe('21.02,105.84');
    await named("You're here · Hoàn Kiếm");
    expect(nameOf).toHaveBeenCalledWith({ lat: 21.02, lng: 105.84 }, 'en');
  });

  // The one this missed: picking an area set a district and no point, so
  // everything below fell back to where the reader was standing.
  it('moves to the area that was picked, not to where the reader stands', async () => {
    world.me = { lat: 21.02, lng: 105.84 };
    openSheet();
    fireEvent.click(chip('Hà Đông'));
    expect(centre()).toBe('20.97,105.77');
    // Named as the area's point, and no longer "here".
    await named('Hoàn Kiếm');
  });

  it('moves to a tapped pin, and forgets the old point’s name while the new one is asked for', async () => {
    world.me = { lat: 21.02, lng: 105.84 };
    openSheet();
    await named("You're here · Hoàn Kiếm");
    nameOf.mockResolvedValue('Hà Đông');
    fireEvent.click(screen.getByRole('button', { name: 'drop a pin' }));
    expect(centre()).toBe('20.97,105.77');
    // Cleared at the tap: the old point's name must not be read as this one's.
    expect(caption()).toBe('');
    await named('Hà Đông');
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

  // The search needs an account. A reader without one is sent to the
  // door, not told "nothing found"; so is a reader whose session lapsed
  // between opening the sheet and pressing Search.
  it('sends a signed-out reader to the door instead of searching, and one whose session lapsed too', async () => {
    world.session = null;
    const { onNeedSignIn } = openSheet();
    type('335 quan nhan');
    fireEvent.click(cta());
    expect(onNeedSignIn).toHaveBeenCalledTimes(1);
    expect(findSpots).not.toHaveBeenCalled();
    expect(screen.queryByText(/Nothing found/)).toBeNull();
    cleanup();
    world.session = { user: { id: 'u1' } };
    findSpots.mockRejectedValueOnce(new SignedOutError('not signed in'));
    const second = openSheet();
    type('335 quan nhan');
    fireEvent.click(cta());
    await waitFor(() => expect(second.onNeedSignIn).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Nothing found/)).toBeNull();
  });

  // Where a pin may land. A result in another catalog city moves the app
  // there and is taken; one in no catalog city is refused, by name, with
  // the list left up to pick again. The owner's rule: never plan the city
  // the sheet happened to be open on.
  it('takes a result in another catalog city and switches the app to it', async () => {
    findSpots.mockResolvedValue([SAIGON]);
    const { onDone } = openSheet();
    await takeResult('thanh pho ho chi minh', SAIGON);
    expect(setCity).toHaveBeenCalledWith('hcmc');
    const moved = screen.getByTestId('start-moved');
    // What the plan will do, not what the app did: the switch is real now
    // and a cancel takes it back, so "switched to" would be a report of
    // the one thing that may still be undone.
    expect(moved.textContent).toBe('The plan will be made in Ho Chi Minh City.');
    expect(moved.querySelector('[data-icon="checkmark-circle"]')).toBeTruthy();
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith({ district: null, at: { lat: 10.78, lng: 106.70 }, atName: 'Thành phố Hồ Chí Minh' });
  });

  it('refuses a result in no catalog city, says so by name in a well, and drops the list', async () => {
    findSpots.mockResolvedValue([NHATRANG]);
    const { onDone } = openSheet();
    await takeResult('nha trang', NHATRANG);
    expect(setCity).not.toHaveBeenCalled();
    const well = screen.getByTestId('start-elsewhere');
    expect(well.textContent).toBe('No places near Nha Trang yet.Search somewhere else, pick an area below, or use your current location.');
    expect(well.querySelector('[data-icon="alert-circle"]')).toBeTruthy();
    expect(getComputedStyle(well).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    // The list goes; the words typed stay.
    expect(screen.queryByText('Khánh Hòa')).toBeNull();
    expect(screen.getByDisplayValue('nha trang')).toBeTruthy();
    // And nothing is chosen: the tick that stood on Thanh Xuân over a
    // refused "Cần Thơ" (14 Oct 2026) is gone, and the button with it —
    // one tap used to make a plan of the city the sheet was open on.
    expect(row().getAttribute('aria-selected')).toBe('false');
    expect(cta().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(cta());
    expect(onDone).not.toHaveBeenCalled();
  });

  // The three ways out the well names, each one taking the refusal down.
  it('lets a refusal be answered by a new search, an area, or the reader’s own position', async () => {
    findSpots.mockResolvedValue([NHATRANG]);
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as never);
    world.me = { lat: 21.03, lng: 105.85 };
    const { onDone } = openSheet();
    await takeResult('nha trang', NHATRANG);
    // A new question in the field: the button is Search again, and live.
    type('nha trang beach');
    expect(cta().textContent).toBe('Search');
    expect(cta().getAttribute('aria-disabled')).not.toBe('true');
    expect(screen.getByTestId('start-elsewhere')).toBeTruthy();
    // An area.
    fireEvent.click(chip('Tây Hồ'));
    expect(screen.queryByTestId('start-elsewhere')).toBeNull();
    expect(cta().getAttribute('aria-disabled')).not.toBe('true');
    // The reader's own position, after a second refusal.
    await takeResult('nha trang', NHATRANG);
    expect(chip('Tây Hồ').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(row());
    await waitFor(() => expect(screen.queryByTestId('start-elsewhere')).toBeNull());
    expect(row().getAttribute('aria-selected')).toBe('true');
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith(NOWHERE);
  });

  // The wells answer the pin just taken and go with it: "Current
  // location" and an area chip each drop them. And the reader's position
  // is held to the pin's rule — in another catalog city the app follows
  // them there, in none the warn well says the plan will not reach them.
  it('drops the wells on “Current location”, and follows the reader to their own city', async () => {
    followMyLocation.mockClear();
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as never);
    world.me = { lat: 21.03, lng: 105.85 };
    findSpots.mockResolvedValue([SAIGON]);
    openSheet();
    await takeResult('thanh pho ho chi minh', SAIGON);
    expect(screen.getByTestId('start-moved')).toBeTruthy();
    // The pin switched the app; the mock does not, so say it did — and
    // render once more so the sheet reads the new city.
    world.city = world.cities[1];
    type('x');
    fireEvent.click(screen.getByRole('button', { name: 'Current location' }));
    await waitFor(() => expect(followMyLocation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('start-moved').textContent).toBe('The plan will be made in Hanoi.'));
    fireEvent.click(chip('Tây Hồ'));
    expect(screen.queryByTestId('start-moved')).toBeNull();
  });

  it('drops the “switched” well on “Current location” even when there is no city to follow', async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as never);
    world.me = { lat: 21.03, lng: 105.85 };
    findSpots.mockResolvedValue([{ name: 'Thành phố Hồ Chí Minh', label: 'Vietnam', lat: 10.78, lng: 106.70 }]);
    openSheet();
    type('thanh pho ho chi minh');
    fireEvent.click(cta());
    fireEvent.click(await screen.findByText('Thành phố Hồ Chí Minh'));
    expect(screen.getByTestId('start-moved')).toBeTruthy();
    // The mock's city stays Hanoi, where the reader stands: nothing to
    // follow, and nothing left to say.
    fireEvent.click(screen.getByRole('button', { name: 'Current location' }));
    await waitFor(() => expect(location.getForegroundPermissionsAsync).toHaveBeenCalled());
    expect(screen.queryByTestId('start-moved')).toBeNull();
  });

  it('says so when the reader stands in no catalog city, and holds the plan until they pick an area', async () => {
    followMyLocation.mockClear();
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as never);
    world.me = { lat: 12.2388, lng: 109.1967 }; // Nha Trang
    const { onDone } = openSheet();
    fireEvent.click(row());
    // The reader's own position is the thing refused, so the well does not
    // offer it back, and the areas come first.
    await waitFor(() => expect(screen.getByTestId('start-elsewhere').textContent)
      .toBe('No places near you yet.Pick an area below, or search somewhere else.'));
    expect(followMyLocation).not.toHaveBeenCalled();
    expect(row().getAttribute('aria-selected')).toBe('false');
    expect(cta().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(cta());
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(chip('Hà Đông'));
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith({ district: 'Hà Đông', at: null, atName: null });
  });

  it('refuses a map tap in no catalog city the same way, and drops the answer it was over', async () => {
    world.cities = world.cities.filter((c) => c.id === 'hcmc');
    const { onDone } = openSheet({ district: 'Tây Hồ', at: null, atName: null });
    fireEvent.click(screen.getByRole('button', { name: 'drop a pin' }));
    expect(screen.getByTestId('start-elsewhere').textContent).toContain('No places near that pin yet');
    // Not the area it opened on either: a refusal leaves nothing chosen,
    // rather than the last answer standing under a notice about another.
    expect(chip('Tây Hồ').getAttribute('aria-selected')).toBe('false');
    expect(cta().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(cta());
    expect(onDone).not.toHaveBeenCalled();
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
    // The button is one node wearing two handlers in turn, and
    // react-native-web hands a Pressable its new `onPress` in a passive
    // effect — a beat after the commit `findByText` was watching for. A
    // press in that beat runs the old handler, `find`, and `onDone` is
    // never called: CI saw exactly that once. Settled before the press,
    // the same way `SignUpScreen`'s `reach` settles a step (#627).
    await act(async () => {});
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
    // The geocoder answers when this test says so, rather than a promise
    // after the pin lands. Waiting on the caption instead was a poll
    // against a value that moves, and it failed in CI three times.
    let answer!: (name: string) => void;
    nameOf.mockReturnValue(new Promise<string>((res) => { answer = res; }));
    const { onDone } = openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'drop a pin' }));
    expect(nameOf).toHaveBeenCalledWith({ lat: 20.97, lng: 105.77 }, 'en');
    // Nothing else is in flight, so this is the whole of what the sheet
    // knows when the button is pressed on the next line.
    await act(async () => { answer('Hà Đông'); });
    expect(caption()).toBe('Hà Đông');
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
    // The notice and the AppState subscription are registered by two
    // different effects, so the text appearing is not the signal that the
    // listener is there — this asserted straight off the wrong one and
    // failed intermittently with "expected null not to be null". Wait for
    // the thing the next line actually calls.
    await waitFor(() => expect(onChange).not.toBeNull());

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
    await waitFor(() => expect(onChange).not.toBeNull());

    await act(async () => { onChange!('background'); onChange!('active'); });
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });
});

// The map's locate button, as a row — because two builds draw no map
// (`canDrawMap`), and on those "start from where I am" had no control at
// all. The permission flow is `locate`'s and is tested above; what is
// this row's is that it exists without the map, which answer it shows as
// current, and the line under its name.
describe('the current-location row', () => {
  const row = () => screen.getByRole('button', { name: 'Current location' });
  const ticked = () => !!row().querySelector('[data-icon="checkmark"]');

  // The stand-in map always draws, so "no map" here is the sheet's own
  // case of nothing to centre one on; the keyless build's case (`MiniMap`
  // returning null over a centre it has) leaves the sheet identical.
  it('stands without a map, and takes the day back to near-me', async () => {
    world.city = null;
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as never);
    const { onDone } = openSheet();
    expect(screen.queryByTestId('centre')).toBeNull();
    expect(screen.queryByRole('button', { name: 'locate' })).toBeNull();
    expect(row()).toBeTruthy();

    fireEvent.click(chip('Tây Hồ'));
    expect(ticked()).toBe(false);
    fireEvent.click(row());
    await waitFor(() => expect(location.getForegroundPermissionsAsync).toHaveBeenCalled());
    expect(ticked()).toBe(true);
    expect(chip('Tây Hồ').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith(NOWHERE);
  });

  it('is the ticked answer whenever no area and no pin is, and says so to VoiceOver', () => {
    openSheet();
    expect(ticked()).toBe(true);
    expect(row().getAttribute('aria-selected')).toBe('true');
    fireEvent.click(chip('Hà Đông'));
    expect(ticked()).toBe(false);
    expect(row().getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'drop a pin' }));
    expect(ticked()).toBe(false);
  });

  it('asks for a tap while there is no position, names the point once there is, and offers silently otherwise', async () => {
    openSheet();
    expect(row().textContent).toBe('Current locationNot located yet · tap to locate');

    cleanup();
    world.me = { lat: 21.02, lng: 105.84 };
    openSheet();
    await waitFor(() => expect(row().textContent).toBe('Current locationHoàn Kiếm'));
    fireEvent.click(chip('Hà Đông'));
    // The geocoder is asked about Hà Đông now; the row must not borrow
    // its answer for a point the reader has not chosen.
    await named('Hoàn Kiếm');
    expect(row().textContent).toBe('Current location');
  });

  it('drops a half-typed search, so the button stops offering to run it', () => {
    openSheet();
    type('cau giay');
    expect(cta().textContent).toContain('Search');
    fireEvent.click(row());
    expect(field().value).toBe('');
    expect(cta().textContent).toContain('Use this location');
  });
});

describe('opening again', () => {
  const sheet = (visible: boolean, value: Start, onDone = () => {}) =>
    <StartSheet visible={visible} places={PLACES} value={value} onClose={() => {}} onDone={onDone} onNeedSignIn={() => {}} />;

  // The sheet is a question, and closing it without answering must not
  // change the answer that was already there.
  it('starts from the value it was given, with the last visit’s typing gone', () => {
    const value: Start = { district: 'Tây Hồ', at: null, atName: null };
    const view = render(sheet(true, value));
    type('cau giay');
    fireEvent.click(chip('Ba Đình'));

    view.rerender(sheet(false, value));
    view.rerender(sheet(true, value));
    expect(field().value).toBe('');
    expect(chip('Tây Hồ').getAttribute('aria-selected')).toBe('true');
    expect(chip('Ba Đình').getAttribute('aria-selected')).toBe('false');
  });

  // The answer the sheet reopens on has to be visible somewhere, and a
  // pin's only place is the field: an empty field over a pin at Saigon
  // showed a map and an unticked row and nothing that said why.
  it('shows the pin it reopens on by name, ready to use', () => {
    const value: Start = { district: null, at: { lat: 10.78, lng: 106.70 }, atName: 'Thành phố Hồ Chí Minh' };
    const onDone = vi.fn();
    render(sheet(true, value, onDone));
    expect(field().value).toBe('Thành phố Hồ Chí Minh');
    expect(row().getAttribute('aria-selected')).toBe('false');
    expect(cta().textContent).toBe('Use this location');
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalledWith(value);
  });

  // The city the sheet switched to while open is part of the answer, and a
  // cancel takes it back with the rest — as it was, auto or manual. On 14
  // Oct 2026 a cancelled sheet put the start back on Thanh Xuân and left
  // the app on Ho Chi Minh City, with the "switched" well still up.
  it('puts the city back, as it was, when closed without an answer', async () => {
    world.mode = 'manual';
    findSpots.mockResolvedValue([SAIGON]);
    const view = render(sheet(true, NOWHERE));
    await takeResult('thanh pho ho chi minh', SAIGON);
    expect(setCity).toHaveBeenCalledWith('hcmc');
    // The pin switched the app; the mock does not, so say it did.
    world.city = world.cities[1];
    view.rerender(sheet(true, NOWHERE));
    view.rerender(sheet(false, NOWHERE));
    expect(setCity).toHaveBeenLastCalledWith('hanoi', 'manual');
    expect(setCity).toHaveBeenCalledTimes(2);
  });

  it('puts an automatic city back as automatic', async () => {
    findSpots.mockResolvedValue([SAIGON]);
    const view = render(sheet(true, NOWHERE));
    await takeResult('thanh pho ho chi minh', SAIGON);
    world.city = world.cities[1];
    view.rerender(sheet(true, NOWHERE));
    view.rerender(sheet(false, NOWHERE));
    expect(setCity).toHaveBeenLastCalledWith('hanoi', 'auto');
  });

  it('keeps the city when the answer was taken, and when it never moved', async () => {
    findSpots.mockResolvedValue([SAIGON]);
    const onDone = vi.fn();
    const view = render(sheet(true, NOWHERE, onDone));
    await takeResult('thanh pho ho chi minh', SAIGON);
    world.city = world.cities[1];
    view.rerender(sheet(true, NOWHERE, onDone));
    fireEvent.click(cta());
    expect(onDone).toHaveBeenCalled();
    view.rerender(sheet(false, NOWHERE, onDone));
    expect(setCity).toHaveBeenCalledTimes(1);
    // Opened on the new city and closed on it: nothing to put back.
    view.rerender(sheet(true, NOWHERE, onDone));
    view.rerender(sheet(false, NOWHERE, onDone));
    expect(setCity).toHaveBeenCalledTimes(1);
  });

  // The wells and the permission notice answered a visit that is over.
  it('reopens without the last visit’s notices', async () => {
    findSpots.mockResolvedValue([NHATRANG]);
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    const view = render(sheet(true, NOWHERE));
    await takeResult('nha trang', NHATRANG);
    expect(screen.getByTestId('start-elsewhere')).toBeTruthy();
    fireEvent.click(row());
    expect(await screen.findByText(/City Crew is not allowed to know where you are/)).toBeTruthy();
    view.rerender(sheet(false, NOWHERE));
    view.rerender(sheet(true, NOWHERE));
    expect(screen.queryByTestId('start-elsewhere')).toBeNull();
    expect(screen.queryByText(/City Crew is not allowed to know where you are/)).toBeNull();
    expect(row().getAttribute('aria-selected')).toBe('true');
    expect(cta().getAttribute('aria-disabled')).not.toBe('true');
  });
});
