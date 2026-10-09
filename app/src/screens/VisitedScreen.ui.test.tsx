// @vitest-environment jsdom
//
// The visits, by month: what a row says, where it goes, and how one is
// taken back.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, screen, waitFor, within } from '../uitest/render';
import type { Nav } from '../nav';
import type { Checkin } from '../lib/checkin';
import { VISIT_RECENTS_KEY } from '../lib/recents';

const data = vi.hoisted(() => ({
  visits: { data: [] as Checkin[], loading: false, loaded: true, error: null as string | null, loadedAt: 1, fromCache: false, reload: vi.fn() },
  removeCheckin: vi.fn(async (_id: string) => {}),
  asked: vi.fn(() => {}),
}));
vi.mock('../lib/data', () => ({ removeCheckin: data.removeCheckin }));
vi.mock('../lib/checkins', () => ({ useMyCheckins: () => { data.asked(); return data.visits; } }));
vi.mock('../lib/city', () => ({
  useCity: () => ({
    cities: [
      { id: 'hanoi', short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' },
      { id: 'saigon', short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: null },
    ],
  }),
}));
const i18n = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' | 'ja' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: i18n.lang,
    setLang: () => {},
    t: (en: string, vi?: string, ja?: string) =>
      (i18n.lang === 'ja' ? ja : i18n.lang === 'vi' ? vi : en) ?? en,
  }),
}));
const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});

import VisitedScreen from './VisitedScreen';

const nav = () => {
  const n = { navigate: vi.fn(), goBack: vi.fn() };
  return { n: n as unknown as Nav, raw: n };
};
const show = () => { const r = nav(); render(<VisitedScreen navigation={r.n} />); return r; };
const visit = (id: string, slug: string, at: string, over: Partial<Checkin> = {}): Checkin => ({
  id, place_slug: slug, city_id: 'hanoi', at,
  place: { name_en: `${slug} en`, name_vi: `${slug} vi`, name_ja: null, cover: `https://x/${slug}.jpg`, categories: ['cafes'] },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  i18n.lang = 'en';
  data.visits = { data: [], loading: false, loaded: true, error: null, loadedAt: 1, fromCache: false, reload: vi.fn() };
  data.removeCheckin.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('VisitedScreen', () => {
  it('reads the one shared list, and names itself', () => {
    show();
    expect(data.asked).toHaveBeenCalled();
    expect(screen.getByText('Check-ins')).toBeTruthy();
  });

  it('spins before the first answer, and says so when there is nothing', () => {
    data.visits = { ...data.visits, loading: true, loaded: false };
    const r = show();
    expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
    cleanup();
    data.visits = { ...data.visits, loading: false, loaded: true, data: [] };
    render(<VisitedScreen navigation={r.n} />);
    expect(screen.getByText(/No visits yet/)).toBeTruthy();
  });

  it('files the visits by month, newest first, and sums them up', () => {
    data.visits.data = [
      visit('a', 'cong', '2026-09-15T05:00:00Z'),
      visit('b', 'pizza', '2026-10-15T05:00:00Z', { city_id: 'saigon' }),
      visit('c', 'cong', '2026-10-12T05:00:00Z'),
    ];
    show();
    expect(screen.getByText('2 places · 2 cities')).toBeTruthy();
    const months = screen.getAllByTestId('visit-month').map((e) => e.textContent);
    expect(months).toEqual(['October 2026', 'September 2026']);
    const rows = screen.getAllByTestId('visit-row');
    expect(rows.map((r) => within(r).getByTestId('visit-name').textContent)).toEqual(['pizza en', 'cong en', 'cong en']);
    // The meta: the date, the time and the city, in that order — and no
    // weekday: a visit already made is placed by its date, as a receipt is.
    expect(within(rows[0]).getByTestId('visit-meta').textContent).toMatch(/^15 Oct · \d\d:\d\d · Saigon$/);
    expect(within(rows[1]).getByTestId('visit-meta').textContent).toMatch(/Hanoi$/);
    expect(within(rows[0]).getByTestId('visit-meta').textContent).toMatch(/\d\d:\d\d/);
  });

  it('speaks the reader\u2019s language for the name, the month and the city', () => {
    i18n.lang = 'vi';
    data.visits.data = [visit('a', 'cong', '2026-10-15T05:00:00Z')];
    show();
    expect(screen.getByText('Tháng 10, 2026')).toBeTruthy();
    expect(screen.getByTestId('visit-name').textContent).toBe('cong vi');
    expect(screen.getByTestId('visit-meta').textContent).toMatch(/^15\/10 · \d\d:\d\d · Hà Nội$/);
    expect(screen.getByText('1 địa điểm · 1 thành phố')).toBeTruthy();
  });

  it('falls back to English for a Japanese reader when there is no Japanese, and names a gone place', () => {
    i18n.lang = 'ja';
    data.visits.data = [
      visit('a', 'cong', '2026-10-15T05:00:00Z', { city_id: 'saigon' }),
      visit('g', '', '2026-10-14T05:00:00Z', { place: null, city_id: 'nowhere' }),
    ];
    show();
    const names = screen.getAllByTestId('visit-name').map((e) => e.textContent);
    expect(names[0]).toBe('cong en');
    expect(names[1]).toBe('削除された場所');
    const metas = screen.getAllByTestId('visit-meta').map((e) => e.textContent);
    expect(metas[0]).toMatch(/Saigon$/);
    // A city the app no longer knows adds nothing to the line.
    expect(metas[1]).not.toMatch(/·\s*$/);
    expect(metas[1].split('·')).toHaveLength(2);
  });

  it('opens the place, when there is one to open', () => {
    data.visits.data = [visit('a', 'cong', '2026-10-15T05:00:00Z'), visit('g', '', '2026-10-14T05:00:00Z', { place: null })];
    const { raw } = show();
    const rows = screen.getAllByTestId('visit-row');
    fireEvent.click(rows[0]);
    expect(raw.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'cong' });
    expect(rows[0].getAttribute('role')).toBe('button');
    expect(rows[1].getAttribute('role')).not.toBe('button');
    expect(rows[1].querySelector('[data-icon="chevron-forward"]')).toBeNull();
  });

  it('takes one visit back through its menu, and only that one', async () => {
    data.visits.data = [visit('a', 'cong', '2026-10-15T05:00:00Z'), visit('b', 'cong', '2026-10-12T05:00:00Z')];
    show();
    const rows = screen.getAllByTestId('visit-row');
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Options' }));
    fireEvent.click(await screen.findByRole('button', { name: /Remove this visit/ }));
    await waitFor(() => expect(data.removeCheckin).toHaveBeenCalledWith('b'));
    expect(data.removeCheckin).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(data.visits.reload).toHaveBeenCalledTimes(1));
  });

  it('says so when the undo fails, and leaves the list as it was', async () => {
    data.visits.data = [visit('a', 'cong', '2026-10-15T05:00:00Z')];
    data.removeCheckin.mockRejectedValueOnce(new Error('offline'));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    fireEvent.click(await screen.findByRole('button', { name: /Remove this visit/ }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not remove it', 'offline'));
    expect(data.visits.reload).not.toHaveBeenCalled();
  });

  // The place's own picture at the row's head, not a pin thirty times
  // over: a glyph every row shares tells the eye nothing, a cover tells
  // it which row this is. The same shape whether or not there is a
  // picture, so the names stay in one column.
  it('leads with the place\u2019s cover, and a glyph in the same box when there is none', () => {
    data.visits.data = [
      visit('a', 'cong', '2026-10-15T05:00:00Z'),
      visit('b', 'bare', '2026-10-14T05:00:00Z', { place: { name_en: 'Bare', name_vi: 'Bare', name_ja: null, cover: null, categories: [] } }),
      visit('g', '', '2026-10-13T05:00:00Z', { place: null }),
    ];
    show();
    const rows = screen.getAllByTestId('visit-row');
    const img = rows[0].querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://x/cong.jpg');
    // Decorative: the name beside it is what VoiceOver reads.
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(rows[1].querySelector('img')).toBeNull();
    expect(rows[1].querySelector('[data-icon="location-outline"]')).toBeTruthy();
    expect(rows[2].querySelector('[data-icon="location-outline"]')).toBeTruthy();
    // One box for all three, 56 square, rounded, so the names line up.
    // 56 by the owner's eye after 48 and 44 both read too small: a
    // picture of a place has a room in it, and a face does not.
    const boxes = rows.map((r) => r.querySelector('[data-testid="visit-thumb"]')!);
    for (const b of boxes) {
      const box = getComputedStyle(b);
      expect(box.width).toBe('56px');
      expect(box.height).toBe('56px');
      expect(box.borderTopLeftRadius).toBe('12px');
    }
    expect(new Set(boxes.map((b) => b.className)).size).toBe(1);
  });

  // The search box, always there under the title. Tapping into it opens
  // a panel under it — what was searched here before, then the cities,
  // then the kinds of place — and Cancel closes the panel with the
  // narrowing let go. The summary under the title answers whatever is
  // typed and chosen.
  describe('search, suggestions and chips', () => {
    const many = () => [
      visit('a', 'cong', '2026-10-15T05:00:00Z', { city_id: 'hanoi', place: { ...visit('a', 'cong', '').place!, categories: ['cafes'] } }),
      visit('b', 'pizza', '2026-10-14T05:00:00Z', { city_id: 'saigon', place: { ...visit('b', 'pizza', '').place!, categories: ['eats'] } }),
      visit('c', 'bun', '2026-10-13T05:00:00Z', { city_id: 'saigon', place: { ...visit('c', 'bun', '').place!, categories: ['eats', 'cafes'] } }),
    ];
    const names = () => screen.getAllByTestId('visit-name').map((e) => e.textContent);
    const input = () => screen.getByTestId('visits-input') as HTMLInputElement;
    const open = () => fireEvent.focus(input());
    const type = (v: string) => fireEvent.change(input(), { target: { value: v } });
    const chips = () => screen.queryAllByRole('button').filter((b) => b.hasAttribute('aria-selected'));
    const chip = (label: string) => chips().find((b) => b.textContent === label)!;
    const selected = () => chips().filter((b) => b.getAttribute('aria-selected') === 'true').map((b) => b.textContent);

    beforeEach(async () => {
      await AsyncStorage.removeItem(VISIT_RECENTS_KEY);
      vi.mocked(AsyncStorage.setItem).mockClear();
    });

    it('keeps the panel closed until the box is tapped, and Cancel closes it with everything let go', () => {
      data.visits.data = many();
      show();
      expect(chips()).toHaveLength(0);
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      open();
      expect(chips()).toHaveLength(4);
      expect(screen.getByText('City')).toBeTruthy();
      expect(screen.getByText('Kind of place')).toBeTruthy();
      fireEvent.click(chip('Saigon'));
      type('bun');
      expect(names()).toEqual(['bun en']);
      expect(screen.getByText('1 place · Saigon')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(chips()).toHaveLength(0);
      expect(input().value).toBe('');
      expect(names()).toHaveLength(3);
      expect(screen.getByText('3 places · 2 cities')).toBeTruthy();
    });

    it('finds by name and by city, and clears back to everything', () => {
      data.visits.data = many();
      show();
      open();
      type('piz');
      expect(names()).toEqual(['pizza en']);
      type('saigon');
      expect(names()).toEqual(['pizza en', 'bun en']);
      expect(screen.getByText('2 places · Saigon')).toBeTruthy();
      fireEvent.click(screen.getByTestId('visits-clear'));
      expect(names()).toHaveLength(3);
      expect(screen.getByText('3 places · 2 cities')).toBeTruthy();
    });

    it('offers the cities and the kinds there are, most visited first, each group only where there is a choice', () => {
      data.visits.data = many();
      show();
      open();
      // Saigon twice to Hanoi's once; cafés and eats twice each, cafés seen first.
      expect(chips().map((b) => b.textContent)).toEqual(['Saigon', 'Hanoi', 'Cafés', 'Eats']);
      expect(document.querySelector('[data-icon="cafe-outline"]')).toBeTruthy();
      expect(selected()).toEqual([]);
      cleanup();
      data.visits.data = many().map((v) => ({ ...v, city_id: 'hanoi' }));
      show();
      open();
      expect(chips().map((b) => b.textContent)).toEqual(['Cafés', 'Eats']);
      expect(screen.queryByText('City')).toBeNull();
      cleanup();
      data.visits.data = many().map((v) => ({ ...v, place: { ...v.place!, categories: ['cafes'] } }));
      show();
      open();
      expect(chips().map((b) => b.textContent)).toEqual(['Saigon', 'Hanoi']);
      expect(screen.queryByText('Kind of place')).toBeNull();
      cleanup();
      data.visits.data = [visit('a', 'cong', '2026-10-15T05:00:00Z')];
      show();
      open();
      expect(chips()).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('narrows by city, by kind, and by both; a chosen chip tapped again lets go', () => {
      data.visits.data = many();
      show();
      open();
      fireEvent.click(chip('Saigon'));
      expect(names()).toEqual(['pizza en', 'bun en']);
      expect(screen.getByText('2 places · Saigon')).toBeTruthy();
      expect(selected()).toEqual(['Saigon']);
      // A second city replaces the first: one city at a time.
      fireEvent.click(chip('Hanoi'));
      expect(names()).toEqual(['cong en']);
      expect(selected()).toEqual(['Hanoi']);
      fireEvent.click(chip('Saigon'));
      fireEvent.click(chip('Cafés'));
      expect(names()).toEqual(['bun en']);
      expect(screen.getByText('1 place · Saigon · Cafés')).toBeTruthy();
      expect(selected()).toEqual(['Saigon', 'Cafés']);
      // Letting the city go keeps the kind.
      fireEvent.click(chip('Saigon'));
      expect(names()).toEqual(['cong en', 'bun en']);
      expect(screen.getByText('2 places · Cafés')).toBeTruthy();
      expect(selected()).toEqual(['Cafés']);
      fireEvent.click(chip('Cafés'));
      expect(names()).toHaveLength(3);
      expect(screen.getByText('3 places · 2 cities')).toBeTruthy();
      expect(selected()).toEqual([]);
    });

    it('narrows the chips\' answer by the words typed, and says so when nothing is left', () => {
      data.visits.data = many();
      show();
      open();
      type('piz');
      fireEvent.click(chip('Hanoi'));
      expect(screen.queryAllByTestId('visit-row')).toHaveLength(0);
      expect(screen.getByText(/No visits match/)).toBeTruthy();
      // The box and the chips stay, so the reader can take either back.
      expect(chips()).toHaveLength(4);
      fireEvent.click(chip('Hanoi'));
      expect(names()).toEqual(['pizza en']);
    });

    it('suggests what was searched here before, narrowed by what is typed, and runs one on a tap', async () => {
      await AsyncStorage.setItem(VISIT_RECENTS_KEY, JSON.stringify(['pizza', 'cong', 'x1', 'x2', 'x3', 'x4']));
      data.visits.data = many();
      show();
      expect(screen.queryByText('Suggestions')).toBeNull();
      open();
      expect(await screen.findByText('Suggestions')).toBeTruthy();
      // Five at most, newest first, as the catalog's box shows them.
      expect(screen.getByRole('button', { name: 'x3' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'x4' })).toBeNull();
      type('pi');
      expect(screen.getByRole('button', { name: 'pizza' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'cong' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'pizza' }));
      expect(input().value).toBe('pizza');
      expect(names()).toEqual(['pizza en']);
      // The word in the box is not suggested back to itself.
      expect(screen.queryByRole('button', { name: 'pizza' })).toBeNull();
      type('');
      fireEvent.click(screen.getByRole('button', { name: 'Clear suggestions' }));
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(VISIT_RECENTS_KEY, '[]');
      expect(screen.queryByText('Suggestions')).toBeNull();
    });

    it('remembers a search once a row is opened or the return key is pressed, never a keystroke', async () => {
      await AsyncStorage.setItem(VISIT_RECENTS_KEY, JSON.stringify(['older']));
      vi.mocked(AsyncStorage.setItem).mockClear();
      data.visits.data = many();
      const { raw } = show();
      open();
      await screen.findByText('Suggestions');
      type('bu');
      type('bun');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('visit-row'));
      expect(raw.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'bun' });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(VISIT_RECENTS_KEY, JSON.stringify(['bun', 'older']));
      type('piz');
      fireEvent.keyDown(input(), { key: 'Enter' });
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(VISIT_RECENTS_KEY, JSON.stringify(['piz', 'bun', 'older']));
    });
  });

  it('goes back from its header', () => {
    const { raw } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(raw.goBack).toHaveBeenCalled();
  });
});
