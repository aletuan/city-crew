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
import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '../uitest/render';
import { useScrollToTop } from '@react-navigation/native';
import { addDays, toISO } from '../lib/day';
import { dateline } from '../lib/format';
import type { Nav } from '../nav';

type Pos = { lat: number; lng: number } | null;
type Coll = { slug: string; title_en: string; title_vi: string; title_ja: string; cover?: { photo_uri: string } | null };

const HN = { id: 'hn', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' };
const SG = { id: 'sg', short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'サイゴン' };
const DN = { id: 'dn', short_en: 'Da Nang', short_vi: 'Đà Nẵng', short_ja: 'ダナン' };
const setCity = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  city: { id: 'hn', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' } as Record<string, string> | null,
  cities: [] as Record<string, string>[],
  places: [] as unknown[],
  mine: [] as unknown[],
  cols: [] as unknown[],
  likes: {} as Record<string, number>,
  // What a shelf ranks by, when a test needs it to differ from the shown count.
  rankLikes: undefined as Record<string, number> | undefined,
  uid: null as string | null,
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
vi.mock('../lib/city', () => {
  const m = {
    useCity: () => ({ city: state.city, cities: state.cities, setCity }),
    useMyPosition: () => state.me,
  };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
vi.mock('../lib/catalog', () => ({
  usePlaces: () => ({ data: state.places }),
  useCollections: () => ({ data: state.cols }),
  useLikes: () => ({ likes: state.likes, rankLikes: state.rankLikes ?? state.likes }),
}));
vi.mock('../lib/auth', () => {
  const m = { useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }) };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
const askToSignIn = vi.hoisted(() => vi.fn());
vi.mock('../lib/save', () => {
  const useSave = () => ({ mine: { data: state.mine, reload: vi.fn() }, askToSignIn });
  return { useSave, useMyLists: () => (useSave() as { mine?: unknown }).mine, useSaveActions: () => useSave() };
});
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

const renderScreen = (params?: { from?: string; at?: number }) => {
  const navigation = { navigate: vi.fn(), goBack: vi.fn() };
  render(<IdeasScreen navigation={navigation as unknown as Nav} route={{ params }} />);
  return navigation;
};
const tap = (text: string) => fireEvent.click(screen.getByText(text));
const cta = () => screen.getByRole('button', { name: /Plan a trip/ });
const sent = (navigation: { navigate: ReturnType<typeof vi.fn> }) => {
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
  expect(navigation.navigate.mock.calls[0][0]).toBe('Sketching');
  return navigation.navigate.mock.calls[0][1] as Record<string, unknown>;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(10));
  state.city = { id: 'hn', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' };
  state.lang = 'en';
  state.places = [place('a', ['cafes']), place('b', ['eats', 'views']), place('c', ['cafes'])];
  state.mine = [];
  state.cols = [];
  state.likes = {};
  state.rankLikes = undefined;
  state.uid = null;
  state.me = null;
  state.members = {};
  picker.props = null;
  sheet.props = null;
});
afterEach(() => { vi.useRealTimers(); });

describe('the title band', () => {
  // Three short answers where Laozi's sentence stood, in the order the
  // screen asks its questions; and the painting beside them.
  it('opens with the three good things, unsigned', () => {
    renderScreen();
    expect(screen.getByText('Good food. Good views. Good company.')).toBeTruthy();
    expect(screen.queryByText(/thousand miles|Laozi/)).toBeNull();
  });

  it('says them in the reader’s language', () => {
    state.lang = 'vi';
    renderScreen();
    expect(screen.getByText('Món ngon. Cảnh đẹp. Bạn hiền.')).toBeTruthy();
  });

  it('carries the two cats beside the title', () => {
    renderScreen();
    expect(screen.getByTestId('ideas-art')).toBeTruthy();
  });
});

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
    expect(cta().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('the button', () => {
  it('wears the planner\'s paw — the mark the orb and the rail carry on', () => {
    renderScreen();
    expect(cta().querySelector('[data-icon="paw"]')).toBeTruthy();
  });

  // Dimmed, and said so to VoiceOver, until the draft is whole.
  it('is dimmed until both company and a category are chosen', () => {
    renderScreen();
    expect(cta().getAttribute('aria-disabled')).toBe('true');
    tap('Friends');
    expect(cta().getAttribute('aria-disabled')).toBe('true');
    tap('Cafés');
    expect(cta().getAttribute('aria-disabled')).not.toBe('true');
    // Untoggling the only category dims it again.
    tap('Cafés');
    expect(cta().getAttribute('aria-disabled')).toBe('true');
  });

  // UX-06: the line under the dimmed button names what is still missing,
  // and only that — the half already answered drops out of it, and the
  // whole line goes once the button lights.
  it('says under the dimmed button which question is still unanswered', () => {
    renderScreen();
    const line = () => screen.queryByTestId('ideas-sketch-missing')?.textContent ?? null;
    expect(line()).toBe("Pick who's going and one thing you fancy to make a plan.");
    tap('Friends');
    expect(line()).toBe('Pick one thing you fancy to make a plan.');
    tap('Friends');
    tap('Cafés');
    expect(line()).toBe("Pick who's going to make a plan.");
    tap('Friends');
    expect(line()).toBeNull();
    tap('Cafés');
    expect(line()).toBe('Pick one thing you fancy to make a plan.');
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
    expect(cta().getAttribute('aria-disabled')).toBe('true');
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

  it('carries the reader’s position as “near you” when neither district nor pin is chosen', () => {
    state.me = { lat: 21.03, lng: 105.85 };
    const navigation = renderScreen();
    tap('Couple');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({
      where: 'Hanoi · Near you', district: null, atLat: 21.03, atLng: 105.85,
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
  const shown = () => document.querySelector('[data-stub="DateTimePicker"]') !== null;
  const pick = (d: Date) => act(() => {
    (picker.props!.onChange as (e: object, d?: Date) => void)({ type: 'set' }, d);
  });

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

  // PLAN-07: the grid was labelled in the phone's language, so a
  // Vietnamese screen opened on "October / MON TUE" under "Xong".
  it.each([['en', 'en-GB'], ['vi', 'vi-VN'], ['ja', 'ja-JP']] as const)(
    'labels the calendar in the app\'s language: %s → %s',
    (lang, locale) => {
      state.lang = lang;
      renderScreen();
      fireEvent.click(screen.getByTestId('ideas-day-chevron'));
      expect(picker.props?.locale).toBe(locale);
    },
  );

  // The glyph at the row's end is a control, not a picture of one. It
  // ends this row because it ends the row above it, and a reader who
  // aims at it has to land somewhere.
  it('opens from the chevron at the row’s end as well as from the date', () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('ideas-day-chevron'));
    expect(picker.props).not.toBeNull();
  });

  // And says nothing while doing it: the date beside it is already the
  // button, and a second nameless one on the same row is noise.
  it('keeps the chevron out of the accessibility tree', () => {
    renderScreen();
    const named = screen.getAllByRole('button', { name: line(TODAY) });
    expect(named).toHaveLength(1);
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

  // Three ways out besides a pick, and each has to leave the day as it
  // was: the scrim, Android's back (Escape, under react-native-web), and
  // on iOS the Done under the calendar.
  it('closes from the scrim, keeping the day', () => {
    renderScreen();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(shown()).toBe(false);
    expect(screen.getByText(line(TODAY))).toBeTruthy();
  });

  it('closes on the system’s back', () => {
    renderScreen();
    open();
    // react-native-web only lets a modal answer Escape once its fade-in
    // has ended, and jsdom never ends an animation — so the test ends it.
    for (const el of document.querySelectorAll('[class*="r-animationKeyframes"]')) fireEvent.animationEnd(el);
    act(() => { fireEvent.keyUp(document, { key: 'Escape' }); });
    expect(shown()).toBe(false);
  });

  it('offers no Done where the picker closes itself', () => {
    renderScreen();
    open();
    expect(picker.props!.display).toBe('default');
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  describe('on iOS', () => {
    let os: string;
    beforeEach(() => { os = Platform.OS; (Platform as { OS: string }).OS = 'ios'; });
    afterEach(() => { (Platform as { OS: string }).OS = os; });

    // The inline calendar fires on every scrub, so a pick must not close
    // it — the reader is still choosing — and Done is how they say so.
    it('shows the month, stays open through a pick, and closes on Done', () => {
      renderScreen();
      open();
      expect(picker.props!.display).toBe('inline');
      pick(new Date(2026, 8, 20, 0, 0));
      expect(shown()).toBe(true);
      expect(screen.getByText(line('2026-09-20'))).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(shown()).toBe(false);
      expect(screen.getByText(line('2026-09-20'))).toBeTruthy();
    });
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

// Two halves of one answer, and the control has to say so: exactly one
// is checked at a time, and choosing the other unchecks the first.
describe('day or evening', () => {
  const half = (name: string) => screen.getByRole('radio', { name });

  // Evening, from `EMPTY_DRAFT` — the control opens already answered
  // rather than blank, so the reader is changing a plan rather than
  // filling a field.
  it('reads as a radio group with one half chosen', () => {
    renderScreen();
    expect(half('Evening').getAttribute('aria-checked')).toBe('true');
    expect(half('Day').getAttribute('aria-checked')).toBe('false');
  });

  it('swaps rather than adds', () => {
    renderScreen();
    fireEvent.click(half('Day'));
    expect(half('Day').getAttribute('aria-checked')).toBe('true');
    expect(half('Evening').getAttribute('aria-checked')).toBe('false');
  });
});

describe('where the day starts', () => {
  it('says “near you” around the city, and the sheet opens on the empty answer', () => {
    renderScreen();
    expect(sheet.props!.visible).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^Hanoi · Near you/ }));
    expect(screen.getByText('start-sheet-open')).toBeTruthy();
    expect(sheet.props!.value).toEqual({ district: null, at: null, atName: null });
    expect(sheet.props!.places).toBe(state.places);
    act(() => { (sheet.props!.onClose as () => void)(); });
    expect(screen.queryByText('start-sheet-open')).toBeNull();
  });

  // The sheet's search needs an account: the sheet steps aside, the door
  // opens for that reason, and a sign-in brings the sheet back.
  it('hands a signed-out search to the door, and reopens the sheet after sign-in', () => {
    askToSignIn.mockClear();
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^Hanoi · Near you/ }));
    expect(screen.getByText('start-sheet-open')).toBeTruthy();
    act(() => { (sheet.props!.onNeedSignIn as () => void)(); });
    expect(screen.queryByText('start-sheet-open')).toBeNull();
    expect(askToSignIn).toHaveBeenCalledWith('start', expect.any(Function));
    act(() => { (askToSignIn.mock.calls[0][1] as () => void)(); });
    expect(screen.getByText('start-sheet-open')).toBeTruthy();
  });

  // Before the city resolves the label printed " · Near you" — a hole
  // where the name goes, with the separator still standing beside it.
  it('says plain “near you” before the city has loaded, with no hole for its name', () => {
    state.city = null;
    renderScreen();
    expect(screen.getByRole('button', { name: 'Near you' })).toBeTruthy();
    expect(screen.queryByText(/^\s*·/)).toBeNull();
  });

  // A city with no Japanese short name must not print "null" into the
  // Japanese label — it borrows the English one.
  it('names the city in Japanese from the English short name when it has no Japanese one', () => {
    state.lang = 'ja';
    state.city = { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: null } as unknown as Record<string, string>;
    renderScreen();
    expect(screen.getByRole('button', { name: /^Hanoi · 現在地/ })).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('takes a district from the sheet, and sends it with no coordinate even when the reader has one', () => {
    state.me = { lat: 1, lng: 2 };
    const navigation = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Near you/ }));
    act(() => { (sheet.props!.onDone as (s: object) => void)({ district: 'Tây Hồ', at: null }); });
    expect(screen.queryByText('start-sheet-open')).toBeNull();
    expect(screen.getByText('Tây Hồ')).toBeTruthy();
    expect(sheet.props!.value).toEqual({ district: 'Tây Hồ', at: null, atName: null });
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ where: 'Tây Hồ', district: 'Tây Hồ', atLat: undefined, atLng: undefined });
  });

  it('takes a dropped pin, which wins over the reader’s own position', () => {
    state.me = { lat: 1, lng: 2 };
    const navigation = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Near you/ }));
    act(() => { (sheet.props!.onDone as (s: object) => void)({ district: null, at: { lat: 21.04, lng: 105.81 } }); });
    expect(screen.getByText('A pin you dropped')).toBeTruthy();
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({ where: 'A pin you dropped', district: null, atLat: 21.04, atLng: 105.81 });
  });

  it('prints the name a pin was given, and sends those words on', () => {
    const navigation = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Near you/ }));
    act(() => {
      (sheet.props!.onDone as (s: object) => void)({
        district: null, at: { lat: 21.04, lng: 105.81 }, atName: "Pizza 4P's Hoàng Thành Tower",
      });
    });
    expect(screen.getByText("Pizza 4P's Hoàng Thành Tower")).toBeTruthy();
    expect(screen.queryByText('A pin you dropped')).toBeNull();
    expect(sheet.props!.value).toMatchObject({ atName: "Pizza 4P's Hoàng Thành Tower" });
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation)).toMatchObject({
      where: "Pizza 4P's Hoàng Thành Tower", district: null, atLat: 21.04, atLng: 105.81,
    });
  });
});

describe('a city switch and the pin', () => {
  const HANOI = { id: 'hn', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ', center_lat: 21.0285, center_lng: 105.8542, radius_km: 25 };
  const SAIGON = { id: 'hcmc', short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'サイゴン', center_lat: 10.7769, center_lng: 106.7009, radius_km: 25 };
  const open = () => {
    const navigation = { navigate: vi.fn(), goBack: vi.fn() };
    const view = render(<IdeasScreen navigation={navigation as unknown as Nav} />);
    return { again: () => view.rerender(<IdeasScreen navigation={navigation as unknown as Nav} />) };
  };
  const pin = (at: { lat: number; lng: number }, atName: string) => {
    fireEvent.click(screen.getByRole('button', { name: /Near you/ }));
    act(() => { (sheet.props!.onDone as (s: object) => void)({ district: null, at, atName }); });
  };

  it('drops a pin left in the old city, and a district with it', () => {
    state.city = HANOI as unknown as typeof state.city;
    const { again } = open();
    pin({ lat: 21.04, lng: 105.81 }, 'Tràng Tiền');
    expect(screen.getByText('Tràng Tiền')).toBeTruthy();
    state.city = SAIGON as unknown as typeof state.city;
    again();
    expect(screen.queryByText('Tràng Tiền')).toBeNull();
    expect(screen.getByRole('button', { name: /^Saigon · Near you/ })).toBeTruthy();
    // A district the same way.
    fireEvent.click(screen.getByRole('button', { name: /Near you/ }));
    act(() => { (sheet.props!.onDone as (s: object) => void)({ district: 'Quận 1', at: null }); });
    expect(screen.getByText('Quận 1')).toBeTruthy();
    state.city = HANOI as unknown as typeof state.city;
    again();
    expect(screen.queryByText('Quận 1')).toBeNull();
  });

  it('keeps a pin that lies in the new city: the start sheet’s own switch loses nothing', () => {
    state.city = HANOI as unknown as typeof state.city;
    const { again } = open();
    pin({ lat: 10.78, lng: 106.70 }, 'Thành phố Hồ Chí Minh');
    state.city = SAIGON as unknown as typeof state.city;
    again();
    expect(screen.getByText('Thành phố Hồ Chí Minh')).toBeTruthy();
  });
});

// ── sent here from a collection ──
//
// The detail screen's "Plan a trip" lands with `from`. The list is ticked
// and the city is decided by the start sheet's rule: a place here, nothing
// moves; all in one other city, the app follows; several other cities, ask.
describe('arriving from a collection', () => {
  const here = () => ({ city_id: 'hn' });
  const away = (city_id = 'sg') => ({ city_id });
  const ticked = (name: RegExp) => !!screen.getByRole('checkbox', { name }).querySelector('[data-icon="checkmark"]');
  const sheetRows = () => screen.queryAllByTestId('sheet-glyph').length;

  beforeEach(() => {
    setCity.mockClear();
    state.cities = [HN, SG, DN];
    state.places = [place('p', ['cafes'])];
    state.uid = 'u1';
    state.mine = [coll('pho', 'Phở run'), coll('far', 'Far away'), coll('split', 'Split')];
    state.cols = [coll('theirs1', 'Theirs one', { owner_id: 'u2' } as never), coll('theirs2', 'Theirs two', { owner_id: 'u2' } as never), coll('theirs3', 'Theirs three', { owner_id: 'u2' } as never), coll('theirs4', 'Theirs four', { owner_id: 'u2' } as never)];
    state.members = {
      pho: [here(), away()], far: [away(), away()], split: [away('sg'), away('dn'), away('dn')],
      theirs1: [here()], theirs2: [here()], theirs3: [here()], theirs4: [here()],
    };
  });

  it('ticks a list with a place here, opens the lists, and moves nothing', () => {
    renderScreen({ from: 'pho', at: 1 });
    expect(ticked(/Phở run/)).toBe(true);
    expect(setCity).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ideas-moved')).toBeNull();
    // Opened: the community's fourth list is in view without "more".
    expect(screen.getByRole('checkbox', { name: /Theirs four/ })).toBeTruthy();
  });

  it('follows a list whose places are all in one other city, and says so while the app is there', () => {
    const navigation = { navigate: vi.fn(), goBack: vi.fn() };
    const view = render(<IdeasScreen navigation={navigation as unknown as Nav} route={{ params: { from: 'far', at: 2 } }} />);
    expect(setCity).toHaveBeenCalledWith('sg');
    expect(setCity).toHaveBeenCalledTimes(1);
    // The catalog refreshing under the same ask is not a second ask.
    state.places = [place('p', ['cafes'])];
    view.rerender(<IdeasScreen navigation={navigation as unknown as Nav} route={{ params: { from: 'far', at: 2 } }} />);
    expect(setCity).toHaveBeenCalledTimes(1);
    // The mock does not move the city; say it did.
    state.city = SG;
    view.rerender(<IdeasScreen navigation={navigation as unknown as Nav} route={{ params: { from: 'far', at: 2 } }} />);
    expect(screen.getByTestId('ideas-moved').textContent).toBe('The plan will be made in Saigon.');
    expect(ticked(/Far away/)).toBe(true);
    // Applied once: the re-render carried the same `at`.
    expect(setCity).toHaveBeenCalledTimes(1);
    // A switch made afterwards is a new fact; the well goes with it.
    state.city = DN;
    view.rerender(<IdeasScreen navigation={navigation as unknown as Nav} route={{ params: { from: 'far', at: 2 } }} />);
    expect(screen.queryByTestId('ideas-moved')).toBeNull();
    state.city = HN;
  });

  it('asks which city when the list spans several and none is this one, and follows the answer', async () => {
    renderScreen({ from: 'split', at: 3 });
    expect(setCity).not.toHaveBeenCalled();
    expect(screen.getByText('Which city?')).toBeTruthy();
    expect(sheetRows()).toBe(2);
    // Most places first, with the count the plan would take.
    expect(screen.getAllByRole('button', { name: /Saigon|Da Nang/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Da Nang', 'Saigon']);
    expect(screen.getByText('2 places from this collection will be included')).toBeTruthy();
    expect(screen.getByText('1 place from this collection will be included')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Da Nang' }));
    // The sheet closes first and the answer lands a beat later, the
    // sheet's own rule against stacked modals.
    await waitFor(() => expect(setCity).toHaveBeenCalledWith('dn'));
    // (The modal's fade never ends under jsdom, so whether the sheet is
    // gone is not asked here — it is the sheet's own concern.)
  });

  it('leaves the list unticked when the question is closed without an answer', () => {
    renderScreen({ from: 'split', at: 4 });
    fireEvent.click(screen.getByLabelText('Close'));
    expect(setCity).not.toHaveBeenCalled();
    // Still on this city, where the split list has nothing and is not a row.
    expect(screen.queryByRole('checkbox', { name: /Split/ })).toBeNull();
  });

  it('waits for the catalog, and does nothing for a list in no catalog city', () => {
    state.places = [];
    const navigation = { navigate: vi.fn(), goBack: vi.fn() };
    const view = render(<IdeasScreen navigation={navigation as unknown as Nav} route={{ params: { from: 'pho', at: 5 } }} />);
    // The row is there (its members come from the mock); the tick is not.
    expect(ticked(/Phở run/)).toBe(false);
    state.places = [place('p', ['cafes'])];
    view.rerender(<IdeasScreen navigation={navigation as unknown as Nav} route={{ params: { from: 'pho', at: 5 } }} />);
    expect(ticked(/Phở run/)).toBe(true);

    state.members.far = [away('xx')];
    view.rerender(<IdeasScreen navigation={navigation as unknown as Nav} route={{ params: { from: 'far', at: 6 } }} />);
    expect(setCity).not.toHaveBeenCalled();
    expect(sheetRows()).toBe(0);
    expect(screen.queryByText('Which city?')).toBeNull();
  });

  it('is unmoved by no params at all, and by a slug nobody has', () => {
    renderScreen();
    renderScreen({ from: 'nope', at: 7 });
    expect(setCity).not.toHaveBeenCalled();
  });
});

describe('start from what you love', () => {
  /** A member place in a city; `photo` makes it a cover candidate. */
  const here = (photo?: string) => ({ city_id: 'hn', photo });
  const away = (photo?: string) => ({ city_id: 'sg', photo });

  it('is absent for a reader with nothing saved (and for a guest)', () => {
    renderScreen();
    expect(screen.queryByText('Start from what you love')).toBeNull();
  });

  it('lists each saved collection with its count and cover, and seeds the plan from the ticked ones', () => {
    state.mine = [
      coll('pho', 'Phở run', { cover: { photo_uri: 'https://x/pho.jpg' } }),
      coll('lakes', 'Lakes'),
      coll('mixed', 'Mixed'),
    ];
    state.members = { pho: [here(), here()], lakes: [here('https://x/lake.jpg')], mixed: [away('https://x/sg.jpg'), here('https://x/mixed.jpg'), here(), away()] };
    const navigation = renderScreen();
    expect(screen.getByText('Start from what you love')).toBeTruthy();
    expect(screen.getByText('1 place')).toBeTruthy();
    // The count is the places in this city, in the same short line as
    // every other row: not "2 of 4", and never the four. So Phở run and
    // Mixed read the same.
    expect(screen.getAllByText('2 places')).toHaveLength(2);
    expect(screen.queryByText('4 places')).toBeNull();
    // The header's painting is an image too; the covers are the ones
    // under the collections — and a list without a chosen cover takes
    // its first place *here*, not its first place.
    expect([...document.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((src) => !src?.includes('ideas-art')))
      .toEqual(['https://x/pho.jpg', 'https://x/lake.jpg', 'https://x/mixed.jpg']);

    // react-native-web drops `accessibilityState`, so "ticked" is read off
    // the tick the row draws rather than off an aria attribute.
    const ticked = () => screen.getAllByRole('checkbox').map((b) => !!b.querySelector('[data-icon="checkmark"]'));
    expect(ticked()).toEqual([false, false, false]);
    fireEvent.click(screen.getByRole('checkbox', { name: /Lakes/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Phở run/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Mixed/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Mixed/ }));
    expect(ticked()).toEqual([true, true, false]);

    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation).from).toEqual(['lakes', 'pho']);
  });

  // A plan is for the city on screen. A list with nothing there cannot
  // seed it, so it is not offered — rather than listed at "0 places",
  // ticked, and dropped in silence two screens on. Same for an empty one.
  it('offers only the lists with a place in this city, and nothing when none has one', () => {
    state.mine = [coll('saigon', 'Saigon weekend'), coll('empty', 'Empty'), coll('lakes', 'Lakes')];
    state.members = { saigon: [away(), away()], lakes: [here()] };
    renderScreen();
    expect(screen.getAllByRole('checkbox').map((b) => b.textContent)).toEqual(['Lakes1 place']);

    cleanup();
    state.mine = [coll('saigon', 'Saigon weekend'), coll('empty', 'Empty')];
    renderScreen();
    expect(screen.queryByText('Start from what you love')).toBeNull();
  });

  const names = () => screen.getAllByRole('checkbox').map((b) => b.textContent!.replace(/\d+ places?$/, ''));
  const more = () => screen.queryByTestId('seeds-more');

  // Your own lists are what you came for; the community's are behind one
  // tap, ranked as Explore ranks them, and your own published list is
  // shown once, under Yours.
  it('shows your lists first and keeps the community behind one tap, most liked first', () => {
    state.uid = 'me';
    state.mine = [coll('pho', 'Phở run'), coll('minepub', 'My public one', { owner_id: 'me' } as Partial<Coll>)];
    state.cols = [
      coll('quiet', 'Quiet corners'),
      coll('loud', 'Loud nights'),
      coll('minepub', 'My public one', { owner_id: 'me' } as Partial<Coll>),
      coll('saigon', 'Saigon only'),
    ];
    state.likes = { loud: 9, quiet: 2 };
    state.members = { pho: [here()], minepub: [here()], quiet: [here()], loud: [here()], saigon: [away()] };
    renderScreen();
    expect(screen.getByText('Collections with a place in Hanoi')).toBeTruthy();
    expect(names()).toEqual(['Phở run', 'My public one']);
    expect(screen.queryByText('Yours')).toBeNull();
    expect(more()!.textContent).toBe('More · 2 community collections');

    fireEvent.click(more()!);
    expect(screen.getByText('Yours')).toBeTruthy();
    expect(screen.getByText('Community')).toBeTruthy();
    expect(names()).toEqual(['Phở run', 'My public one', 'Loud nights', 'Quiet corners']);
    expect(more()).toBeNull();
  });

  // Ranked by everybody's likes but the curator's own (owner, 17 Oct 2026).
  it('orders the community by the ranking figure, not the shown count', () => {
    state.uid = 'me';
    state.mine = [coll('pho', 'Phở run')];
    state.cols = [coll('quiet', 'Quiet corners'), coll('loud', 'Loud nights')];
    // Loud's heart shows more, but most of it is its own curator's.
    state.likes = { loud: 9, quiet: 2 };
    state.rankLikes = { loud: 1, quiet: 2 };
    state.members = { pho: [here()], quiet: [here()], loud: [here()] };
    renderScreen();
    fireEvent.click(more()!);
    expect(names()).toEqual(['Phở run', 'Quiet corners', 'Loud nights']);
  });

  // A guest owns nothing, and an account whose lists are all elsewhere
  // owns nothing here: both see the city's own lists — three, then the
  // rest — and can seed a plan from one.
  it('offers a reader with no list here the three most liked, the rest a tap away, and seeds from them', () => {
    state.cols = ['a', 'b', 'c', 'd', 'e'].map((k) => coll(k, `List ${k.toUpperCase()}`));
    state.likes = { a: 1, b: 5, c: 4, d: 3, e: 2 };
    state.members = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [k, [here()]]));
    const navigation = renderScreen();
    expect(names()).toEqual(['List B', 'List C', 'List D']);
    expect(screen.queryByText('Yours')).toBeNull();
    expect(screen.queryByText('Community')).toBeNull();
    expect(more()!.textContent).toBe('2 more');
    fireEvent.click(more()!);
    expect(names()).toEqual(['List B', 'List C', 'List D', 'List E', 'List A']);
    expect(more()).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /List E/ }));
    tap('Friends');
    tap('Cafés');
    fireEvent.click(cta());
    expect(sent(navigation).from).toEqual(['e']);

    cleanup();
    state.uid = 'me';
    state.mine = [coll('saigon', 'Saigon weekend')];
    state.members.saigon = [away()];
    state.cols = [coll('a', 'List A'), coll('b', 'List B')];
    renderScreen();
    expect(names()).toEqual(['List B', 'List A']);
    expect(more()).toBeNull();
  });

  it('names no city under the heading while none is chosen', () => {
    state.city = null;
    state.cols = [coll('a', 'List A')];
    state.members = { a: [here()] };
    renderScreen();
    expect(screen.getByText('Start from what you love')).toBeTruthy();
    expect(screen.queryByText(/Collections with a place/)).toBeNull();
  });

  // Before the city resolves there is no "here" to count: every list with
  // anything in it is offered, whole, which is what the shelves do too.
  it('offers every non-empty list, whole, while no city is chosen', () => {
    state.city = null;
    state.mine = [coll('mixed', 'Mixed'), coll('empty', 'Empty')];
    state.members = { mixed: [away(), here(), away()] };
    renderScreen();
    expect(screen.getAllByRole('checkbox').map((b) => b.textContent)).toEqual(['Mixed3 places']);
  });
});

// Its tab pressed again at this root scrolls back to the top. The press
// is React Navigation's to hear; what is this screen's is the ref, and a
// ref left off the list would hand over null and scroll nothing.
describe('its tab, pressed again', () => {
  it('hands the scroll to the top the screen’s own list', async () => {
    renderScreen();
    const ref = vi.mocked(useScrollToTop).mock.calls.at(-1)?.[0] as { current: unknown };
    expect(ref.current).toHaveProperty('scrollTo');
  });
});
