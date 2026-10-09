// @vitest-environment jsdom
//
// The visits, by month: what a row says, where it goes, and how one is
// taken back.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor, within } from '../uitest/render';
import type { Nav } from '../nav';
import type { Checkin } from '../lib/checkin';

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
  place: { name_en: `${slug} en`, name_vi: `${slug} vi`, name_ja: null, cover: `https://x/${slug}.jpg` },
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
    expect(screen.getByText('3 visits · 2 places')).toBeTruthy();
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
    expect(screen.getByText('1 lần ghé · 1 địa điểm')).toBeTruthy();
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
      visit('b', 'bare', '2026-10-14T05:00:00Z', { place: { name_en: 'Bare', name_vi: 'Bare', name_ja: null, cover: null } }),
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
    // One box for all three, 44 square — the face's size on Activity, so
    // a leading picture is one size wherever a list has one — rounded,
    // so the names line up.
    const boxes = rows.map((r) => r.querySelector('[data-testid="visit-thumb"]')!);
    for (const b of boxes) {
      const box = getComputedStyle(b);
      expect(box.width).toBe('44px');
      expect(box.height).toBe('44px');
      expect(box.borderTopLeftRadius).toBe('10px');
    }
    expect(new Set(boxes.map((b) => b.className)).size).toBe(1);
  });

  it('goes back from its header', () => {
    const { raw } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(raw.goBack).toHaveBeenCalled();
  });
});
