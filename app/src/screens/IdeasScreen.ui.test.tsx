// @vitest-environment jsdom
//
// The plan wizard's questions and the one button that hands them on. What
// is pinned here is what the reader can answer and what `Sketching`
// receives: the company chips (one at a time, untoggling), the category
// chips (only the ones this city has, many at a time), the day that is
// offered before anybody chooses one (today, or tomorrow once today's
// outing has gone), the "it is already…" note, the date picker's bounds
// and what a pick does, the start sheet's round trip, the saved
// collections to seed from, and the button — dimmed with its reason until
// company and a category are chosen, refusing a press while it is.
//
// The clock is fixed with local-time `Date` constructors, never ISO
// strings, so the same assertions hold in Hanoi and in New York. Only
// `Date` is faked; the screen's timers stay real.
//
// The lib the screen reasons with — the trip draft, the planner's clock
// rules, the day arithmetic, the date line — runs for real: those are the
// facts the button carries, and a stub of them would pin the stub. What is
// stood in for is where data comes from (city, catalog, saved collections,
// position) and the two native-backed children, the date picker and the
// start sheet, which are reached through the props the screen hands them.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import { addDays, toISO } from '../lib/day';
import { dateline } from '../lib/format';
import type { Nav } from '../nav';

type Pos = { lat: number; lng: number } | null;
type Coll = { slug: string; title_en: string; title_vi: string; title_ja: string; cover?: { photo_uri: string } | null };

const state = vi.hoisted(() => ({
  city: { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' } as Record<string, string> | null,
  places: [] as unknown[],
  mine: [] as unknown[],
  me: null as Pos,
  members: {} as Record<string, unknown[]>,
  lang: 'en' as 'en' | 'vi' | 'ja',
}));
const picker = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
const sheet = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi?: string, ja?: string) =>
      (state.lang === 'ja' ? ja || en : state.lang === 'vi' ? vi || en : en),
  }),
}));
vi.mock('../lib/city', () => ({
  useCity: () => ({ city: state.city }),
  useMyPosition: () => state.me,
}));
vi.mock('../lib/catalog', () => ({ usePlaces: () => ({ data: state.places }) }));
vi.mock('../lib/save', () => ({ useSave: () => ({ mine: { data: state.mine, reload: vi.fn() } }) }));
vi.mock('../lib/data', () => ({
  membersOf: (c: { slug: string }) => state.members[c.slug] ?? [],
  coverOf: (p: { photo?: string }) => (p.photo ? { photo_uri: p.photo } : null),
}));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => undefined }));
// The platform picker has no web half. The stand-in keeps the props the
// screen gave it, which is where its bounds and its answer handler live.
vi.mock('@react-native-community/datetimepicker', () => ({
  default: (props: Record<string, unknown>) => {
    picker.props = props;
    return <div data-stub="DateTimePicker" />;
  },
}));
// The sheet has its own concerns (map, search); what this screen owes it is
// the value it opens with and what it does with the answer.
vi.mock('../components/StartSheet', () => ({
  default: (props: Record<string, unknown>) => {
    sheet.props = props;
    return props.visible ? <div>start-sheet-open</div> : null;
  },
}));

import IdeasScreen from './IdeasScreen';

const place = (slug: string, categories: string[]) => ({ slug, categories, vibe_tags: [], category: 'out' });
const coll = (slug: string, title: string, over: Partial<Coll> = {}): Coll =>
  ({ slug, title_en: title, title_vi: title, title_ja: title, cover: null, ...over });

/** A local wall-clock moment on 11 September 2026. */
const at = (h: number, m = 0) => new Date(2026, 8, 11, h, m);
const TODAY = toISO(at(12));
const TOMORROW = addDays(TODAY, 1);
const line = (iso: string) => {
  const [y, mo, d] = iso.split('-').map(Number);
  return dateline('en', new Date(y, mo - 1, d, 12));
};

const renderScreen = () => {
  const navigation = { navigate: vi.fn(), goBack: vi.fn() };
  render(<IdeasScreen navigation={navigation as unknown as Nav} />);
  return navigation;
};
const tap = (text: string) => fireEvent.click(screen.getByText(text));
const cta = () => screen.getByRole('button', { name: /Sketch the plan/ });
const sent = (navigation: { navigate: ReturnType<typeof vi.fn> }) => {
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
  expect(navigation.navigate.mock.calls[0][0]).toBe('Sketching');
  return navigation.navigate.mock.calls[0][1] as Record<string, unknown>;
};
const HINT = "Just pick who's going and one thing you fancy.";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(10));
  state.city = { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' };
  state.lang = 'en';
  state.places = [place('a', ['cafes']), place('b', ['eats', 'views']), place('c', ['cafes'])];
  state.mine = [];
  state.me = null;
  state.members = {};
  picker.props = null;
  sheet.props = null;
});
afterEach(() => { vi.useRealTimers(); });

describe('the questions', () => {
  it('offers the four companies and only the categories this city has, in the taxonomy order', () => {
    renderScreen();
    for (const c of ['Just me', 'Couple', 'Friends', 'Family']) expect(screen.getByText(c)).toBeTruthy();
    const cats = screen.queryAllByText(/^(Cafés|Focus|Eats|Views|Culture|Nature|Shopping|Nightlife|Fun)$/)
      .map((el) => el.textContent);
    expect(cats).toEqual(['Cafés', 'Eats', 'Views']);
  });

  it('offers no category chip at all while the catalog is empty', () => {
    state.places = [];
    renderScreen();
    expect(screen.queryByText('Cafés')).toBeNull();
    expect(screen.getByText(HINT)).toBeTruthy();
  });
});

describe('the button', () => {
  it('is dimmed with its reason until both company and a category are chosen', () => {
    renderScreen();
    expect(screen.getByText(HINT)).toBeTruthy();
    tap('Friends');
    expect(screen.getByText(HINT)).toBeTruthy();
    tap('Cafés');
    expect(screen.queryByText(HINT)).toBeNull();
    // Untoggling the only category takes the reason back.
    tap('Cafés');
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  // `pointerEvents="none"` stops a finger and nothing else: VoiceOver's
  // activate and a keyboard's Enter reach the button all the same, and the
  // next screen was handed a draft with nobody going and nothing wanted.
  it('refuses a press that reaches it while the draft is incomplete', () => {
    const navigation = renderScreen();
    fireEvent.click(cta());
    tap('Couple');
    fireEvent.click(cta());
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('hands Sketching the whole draft, with today and the evening by default', () => {
    const navigation = renderScreen();
    tap('Friends');
    tap('Eats');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toEqual({
      company: 'friends',
      categories: ['eats', 'cafes'],
      where: null,
      district: null,
      atLat: undefined,
      atLng: undefined,
      date: TODAY,
      when: 'evening',
      startMin: 18 * 60,
      from: [],
    });
  });

  it('keeps one company at a time, and a second tap on it clears it', () => {
    const navigation = renderScreen();
    tap('Cafés');
    tap('Friends');
    tap('Family');
    fireEvent.click(cta());
    expect(sent(navigation).company).toBe('family');
    tap('Family');
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it('sends the day shape when Day is chosen, from nine', () => {
    vi.setSystemTime(at(8));
    const navigation = renderScreen();
    tap('Just me');
    tap('Views');
    tap('Day');
    fireEvent.click(cta());
    const p = sent(navigation);
    expect(p).toMatchObject({ company: 'solo', when: 'day', date: TODAY, startMin: 9 * 60 });
  });

  it('carries the reader’s position as “near me” when neither district nor pin is chosen', () => {
    state.me = { lat: 21.03, lng: 105.85 };
    const navigation = renderScreen();
    tap('Couple');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({
      where: 'Around Hanoi · near me', district: null, atLat: 21.03, atLng: 105.85,
    });
  });
});

describe('the day', () => {
  it('prints today’s date and offers the evening at ten in the morning', () => {
    renderScreen();
    expect(screen.getByText(line(TODAY))).toBeTruthy();
    expect(screen.queryByText(/It is already/)).toBeNull();
  });

  it('moves the default to tomorrow once today’s outing has gone', () => {
    vi.setSystemTime(at(21, 30));
    const navigation = renderScreen();
    expect(screen.getByText(line(TOMORROW))).toBeTruthy();
    expect(screen.queryByText(/It is already/)).toBeNull();
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ date: TOMORROW, startMin: 18 * 60 });
  });

  it('keeps today for the evening at nine sharp, and says the plan starts late', () => {
    vi.setSystemTime(at(20, 50));
    const navigation = renderScreen();
    expect(screen.getByText(line(TODAY))).toBeTruthy();
    expect(screen.getByText('It is already 21:00 — this plan starts from there.')).toBeTruthy();
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ date: TODAY, startMin: 21 * 60 });
  });

  it('switches the default with the shape: a day at four is tomorrow, an evening is still today', () => {
    vi.setSystemTime(at(16));
    renderScreen();
    expect(screen.getByText(line(TODAY))).toBeTruthy();
    tap('Day');
    expect(screen.getByText(line(TOMORROW))).toBeTruthy();
    tap('Evening');
    expect(screen.getByText(line(TODAY))).toBeTruthy();
  });

  // The screen is a tab root and stays mounted: opened at ten, left, and
  // tapped at half past eight in the evening, it sent an 18:00 start for a
  // tonight already under way — the clock of the render, not of the tap.
  it('resolves the start at the tap, not at the last render', () => {
    const navigation = renderScreen();
    tap('Friends');
    tap('Cafés');
    vi.setSystemTime(at(20, 30));
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ date: TODAY, startMin: 20 * 60 + 30 });
  });
});

describe('the date picker', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: line(TODAY) }));

  it('opens on the resolved day, floored at today’s midnight and a year ahead at its last instant', () => {
    renderScreen();
    expect(picker.props).toBeNull();
    open();
    const p = picker.props!;
    expect(p.mode).toBe('date');
    expect(toISO(p.value as Date)).toBe(TODAY);
    const min = p.minimumDate as Date;
    expect([toISO(min), min.getHours(), min.getMinutes()]).toEqual([TODAY, 0, 0]);
    const max = p.maximumDate as Date;
    expect([toISO(max), max.getHours(), max.getMinutes()]).toEqual([addDays(TODAY, 365), 23, 59]);
  });

  it('takes a picked day into the draft and the button, and closes (not iOS)', () => {
    const navigation = renderScreen();
    open();
    const soon = new Date(2026, 8, 20, 0, 0);
    act(() => { (picker.props!.onChange as (e: object, d?: Date) => void)({ type: 'set' }, soon); });
    expect(screen.queryByText(line(TODAY))).toBeNull();
    expect(screen.getByText(line('2026-09-20'))).toBeTruthy();
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ date: '2026-09-20', startMin: 18 * 60 });
  });

  it('keeps the day on a dismissal, and closes', () => {
    renderScreen();
    open();
    const before = picker.props!;
    act(() => { (before.onChange as (e: object, d?: Date) => void)({ type: 'dismissed' }, new Date(2026, 9, 1)); });
    expect(screen.getByText(line(TODAY))).toBeTruthy();
    // Closed: a fresh open renders a fresh picker.
    picker.props = null;
    open();
    expect(picker.props).not.toBeNull();
  });

  it('pulls a pick beyond a year back to the year’s end', () => {
    renderScreen();
    open();
    act(() => { (picker.props!.onChange as (e: object, d?: Date) => void)({ type: 'set' }, new Date(2030, 0, 1, 12)); });
    expect(screen.getByText(line(addDays(TODAY, 365)))).toBeTruthy();
  });

  it('sends a chosen today honestly, even once its evening is late', () => {
    vi.setSystemTime(at(22, 5));
    const navigation = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: line(TOMORROW) }));
    act(() => { (picker.props!.onChange as (e: object, d?: Date) => void)({ type: 'set' }, at(12)); });
    expect(screen.getByText('It is already 22:15 — this plan starts from there.')).toBeTruthy();
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ date: TODAY, startMin: 22 * 60 + 15 });
  });
});

describe('where the day starts', () => {
  it('says “near me” around the city, and the sheet opens on the empty answer', () => {
    renderScreen();
    expect(sheet.props!.visible).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Around Hanoi · near me/ }));
    expect(screen.getByText('start-sheet-open')).toBeTruthy();
    expect(sheet.props!.value).toEqual({ district: null, at: null });
    expect(sheet.props!.places).toBe(state.places);
    act(() => { (sheet.props!.onClose as () => void)(); });
    expect(screen.queryByText('start-sheet-open')).toBeNull();
  });

  // Before the city resolves the label printed "Around  · near me" — a
  // hole where the name goes.
  it('says plain “near me” before the city has loaded, with no hole for its name', () => {
    state.city = null;
    renderScreen();
    expect(screen.getByRole('button', { name: 'Near me' })).toBeTruthy();
    expect(screen.queryByText(/Around/)).toBeNull();
  });

  // A city with no Japanese short name must not print "null" into the
  // Japanese label — it borrows the English one.
  it('names the city in Japanese from the English short name when it has no Japanese one', () => {
    state.lang = 'ja';
    state.city = { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: null } as unknown as Record<string, string>;
    renderScreen();
    expect(screen.getByRole('button', { name: /Hanoi周辺 · 現在地/ })).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('takes a district from the sheet, and sends it with no coordinate even when the reader has one', () => {
    state.me = { lat: 1, lng: 2 };
    const navigation = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /near me/ }));
    act(() => { (sheet.props!.onDone as (s: object) => void)({ district: 'Tây Hồ', at: null }); });
    expect(screen.queryByText('start-sheet-open')).toBeNull();
    expect(screen.getByText('Tây Hồ')).toBeTruthy();
    expect(sheet.props!.value).toEqual({ district: 'Tây Hồ', at: null });
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ where: 'Tây Hồ', district: 'Tây Hồ', atLat: undefined, atLng: undefined });
  });

  it('takes a dropped pin, which wins over the reader’s own position', () => {
    state.me = { lat: 1, lng: 2 };
    const navigation = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /near me/ }));
    act(() => { (sheet.props!.onDone as (s: object) => void)({ district: null, at: { lat: 21.04, lng: 105.81 } }); });
    expect(screen.getByText('A pin you dropped')).toBeTruthy();
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ where: 'A pin you dropped', district: null, atLat: 21.04, atLng: 105.81 });
  });
});

describe('start from what you love', () => {
  it('is absent for a reader with nothing saved (and for a guest)', () => {
    renderScreen();
    expect(screen.queryByText('Start from what you love')).toBeNull();
  });

  it('lists each saved collection with its count and cover, and seeds the plan from the ticked ones', () => {
    state.mine = [
      coll('pho', 'Phở run', { cover: { photo_uri: 'https://x/pho.jpg' } }),
      coll('lakes', 'Lakes'),
      coll('empty', 'Empty'),
    ];
    state.members = { pho: [{}, {}], lakes: [{ photo: 'https://x/lake.jpg' }] };
    const navigation = renderScreen();
    expect(screen.getByText('Start from what you love')).toBeTruthy();
    expect(screen.getByText('2 places')).toBeTruthy();
    expect(screen.getByText('1 place')).toBeTruthy();
    expect(screen.getByText('0 places')).toBeTruthy();
    expect([...document.querySelectorAll('img')].map((i) => i.getAttribute('src')))
      .toEqual(['https://x/pho.jpg', 'https://x/lake.jpg']);

    // react-native-web drops `accessibilityState`, so "ticked" is read off
    // the tick the row draws rather than off an aria attribute.
    const ticked = () => screen.getAllByRole('checkbox').map((b) => !!b.querySelector('[data-icon="checkmark"]'));
    expect(ticked()).toEqual([false, false, false]);
    fireEvent.click(screen.getByRole('checkbox', { name: /Lakes/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Phở run/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Empty/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Empty/ }));
    expect(ticked()).toEqual([true, true, false]);

    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation).from).toEqual(['lakes', 'pho']);
  });
});
