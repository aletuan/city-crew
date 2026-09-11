// @vitest-environment jsdom
// Add a place, pinned at the seams it owns.
//
// `useCandidates` is mocked as a plain object the tests set before
// rendering: its network behaviour is lib/candidates' to answer for, and
// what this screen owes it is which rows it shows, which calls it makes
// and with what, and where the reader ends up afterwards. `AddBatchBar`
// and `CandidateRow` are real, because the words the reader sees at the
// foot and on each row are this screen's words too. The i18n mock picks
// by language so the vi/ja arms of new copy can be asserted as well.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { Candidate, Known } from '../lib/suggest';

type Tally = { done: number; skipped: number; failed: number; held: number; cancelled: boolean };

const g = vi.hoisted(() => ({
  results: null as unknown[] | null,
  known: {} as Record<string, unknown>,
  searching: false,
  adding: null as string | null,
  batch: { running: false, state: {}, done: 0, total: 0 } as {
    running: boolean; state: Record<string, string>; done: number; total: number;
  },
  run: vi.fn(),
  addMany: vi.fn(),
  cancel: vi.fn(),
  clear: vi.fn(),
  awayFrom: vi.fn(() => ''),
}));
const env = vi.hoisted(() => ({
  lang: 'en' as 'en' | 'vi' | 'ja',
  city: { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' } as unknown,
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: env.lang,
    setLang: () => {},
    t: (en: string, vi?: string, ja?: string) =>
      (env.lang === 'vi' ? vi ?? en : env.lang === 'ja' ? ja ?? en : en),
  }),
}));
vi.mock('../lib/city', () => ({ useCity: () => ({ city: env.city }) }));
vi.mock('../lib/candidates', () => ({ useCandidates: () => ({ ...g }) }));

import AddPlaceScreen from './AddPlaceScreen';

const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  place_id: id,
  name: `Place ${id}`,
  address: `${id} Hàng Bạc, Hoàn Kiếm`,
  lat: 21, lng: 105,
  rating: 4.5, rating_count: 100,
  ...over,
} as Candidate);

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), push: vi.fn(),
  setOptions: vi.fn(), addListener: vi.fn(() => vi.fn()),
});

const mount = () => {
  const navigation = nav();
  const r = render(<AddPlaceScreen navigation={navigation as never} />);
  return { navigation, rerender: () => r.rerender(<AddPlaceScreen navigation={navigation as never} />) };
};

const field = () => screen.getByPlaceholderText(/Name of a place in|Tên một địa điểm|のスポット名/);
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });
const submit = () => fireEvent.keyDown(field(), { key: 'Enter' });
const row = (name: string) => screen.getByText(name).closest('[role="checkbox"]') as HTMLElement;
const clean: Tally = { done: 1, skipped: 0, failed: 0, held: 0, cancelled: false };

beforeEach(() => {
  env.lang = 'en';
  env.city = { short_en: 'Hanoi', short_vi: 'Hà Nội', short_ja: 'ハノイ' };
  g.results = null;
  g.known = {};
  g.searching = false;
  g.adding = null;
  g.batch = { running: false, state: {}, done: 0, total: 0 };
  g.run.mockReset();
  g.addMany.mockReset();
  g.addMany.mockResolvedValue(clean);
  g.cancel.mockReset();
  g.clear.mockReset();
  g.awayFrom.mockReset();
  g.awayFrom.mockReturnValue('');
});

describe('before a search', () => {
  it('titles the screen and asks for a place in the current city', () => {
    mount();
    expect(screen.getByText('Add a place')).toBeTruthy();
    expect(screen.getByPlaceholderText('Name of a place in Hanoi')).toBeTruthy();
    expect(screen.queryByText(/RESULTS/)).toBeNull();
    expect(screen.queryByText(/Results from Google Maps/)).toBeNull();
    expect(screen.queryByText(/Nothing found/)).toBeNull();
    // No selection and no batch: the foot is not drawn at all.
    expect(screen.queryByText('We fill in the name, photos and hours.')).toBeNull();
  });

  it('speaks the city in the reader’s language', () => {
    env.lang = 'vi';
    mount();
    expect(screen.getByText('Thêm địa điểm')).toBeTruthy();
    expect(screen.getByPlaceholderText('Tên một địa điểm ở Hà Nội')).toBeTruthy();
  });

  it('leaves the city blank rather than crashing when none is chosen', () => {
    env.city = null;
    mount();
    expect(screen.getByPlaceholderText('Name of a place in')).toBeTruthy();
  });

  it('goes back from the header', () => {
    const { navigation } = mount();
    fireEvent.click(screen.getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('searching', () => {
  it('runs the typed query on the return key', () => {
    mount();
    type('So Coffee');
    submit();
    expect(g.run).toHaveBeenCalledWith('So Coffee');
  });

  it('does not run, or drop the selection, on an empty or blank query', () => {
    g.results = [cand('a')];
    mount();
    fireEvent.click(row('Place a'));
    type('   ');
    submit();
    expect(g.run).not.toHaveBeenCalled();
    // The tick survived: the button still counts it.
    expect(screen.getByText('Add this place')).toBeTruthy();
  });

  it('drops the selection when a new search is submitted', () => {
    g.results = [cand('a')];
    mount();
    fireEvent.click(row('Place a'));
    expect(screen.getByText('Add this place')).toBeTruthy();
    type('bun cha');
    submit();
    expect(screen.queryByText('Add this place')).toBeNull();
  });

  it('shows a spinner and no count while a search is in flight', () => {
    g.searching = true;
    g.results = [cand('a')];
    mount();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText(/RESULTS/)).toBeNull();
  });

  it('says nothing was found, in words that say what to try', () => {
    g.results = [];
    mount();
    expect(screen.getByText('Nothing found. Try the name as it appears on the door.')).toBeTruthy();
    expect(screen.queryByText(/Results from Google Maps/)).toBeNull();
  });

  it('does not say nothing was found while still searching', () => {
    g.results = [];
    g.searching = true;
    mount();
    expect(screen.queryByText(/Nothing found/)).toBeNull();
  });

  it('heads the results with a count and the city, and credits Google under them', () => {
    g.results = [cand('a'), cand('b'), cand('c')];
    mount();
    expect(screen.getByText('3 RESULTS · HANOI')).toBeTruthy();
    expect(screen.getByText('Results from Google Maps · Hanoi')).toBeTruthy();
    expect(screen.getByText('Place a')).toBeTruthy();
    expect(screen.getByText('c Hàng Bạc, Hoàn Kiếm')).toBeTruthy();
  });

  it('puts the distance before the address when the hook has one', () => {
    g.results = [cand('a')];
    g.awayFrom.mockReturnValue('350 m');
    mount();
    expect(screen.getByText('350 m · a Hàng Bạc, Hoàn Kiếm')).toBeTruthy();
    expect(g.awayFrom).toHaveBeenCalledWith(expect.objectContaining({ place_id: 'a' }));
  });
});

describe('clearing the field', () => {
  it('appears only once something is typed, and is a labelled button', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    type('pho');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy();
  });

  it('is labelled in Vietnamese too', () => {
    env.lang = 'vi';
    mount();
    type('pho');
    expect(screen.getByRole('button', { name: 'Xoá tìm kiếm' })).toBeTruthy();
  });

  it('empties the field, clears the results and the selection', () => {
    g.results = [cand('a')];
    mount();
    fireEvent.click(row('Place a'));
    type('pho');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect((field() as HTMLInputElement).value).toBe('');
    expect(g.clear).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Add this place')).toBeNull();
  });
});

describe('rows already known', () => {
  it('lets a place already on City Crew be opened, not picked', () => {
    g.results = [cand('a'), cand('b')];
    g.known = { a: { state: 'live', slug: 'so-coffee' } satisfies Known };
    const { navigation } = mount();
    expect(screen.getByText('Already on City Crew')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(screen.getByText('View'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'so-coffee' });
  });

  it('says a place you added is yours, and cannot be added again', () => {
    g.results = [cand('a')];
    g.known = { a: { state: 'mine' } };
    mount();
    expect(screen.getByText('You added this — only you can see it')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('picking and adding', () => {
  it('counts the picked rows on the button, singular and plural', () => {
    g.results = [cand('a'), cand('b'), cand('c')];
    mount();
    fireEvent.click(row('Place a'));
    expect(screen.getByRole('button', { name: /Add this place/ })).toBeTruthy();
    expect(screen.getByText('We fill in the name, photos and hours.')).toBeTruthy();
    fireEvent.click(row('Place b'));
    expect(screen.getByText('Add 2 places')).toBeTruthy();
    fireEvent.click(row('Place a'));
    expect(screen.getByText('Add this place')).toBeTruthy();
    fireEvent.click(row('Place b'));
    expect(screen.queryByText(/^Add (this|\d)/)).toBeNull();
  });

  it('does not count a picked row once it turns out to be known', () => {
    g.results = [cand('a'), cand('b')];
    const { rerender } = mount();
    fireEvent.click(row('Place a'));
    fireEvent.click(row('Place b'));
    expect(screen.getByText('Add 2 places')).toBeTruthy();
    g.known = { a: { state: 'live', slug: 'a' } };
    rerender();
    expect(screen.getByText('Add this place')).toBeTruthy();
  });

  it('does not count a picked row once it turns out to be yours', () => {
    g.results = [cand('a'), cand('b')];
    const { rerender } = mount();
    fireEvent.click(row('Place a'));
    fireEvent.click(row('Place b'));
    g.known = { b: { state: 'mine' } };
    rerender();
    expect(screen.getByText('Add this place')).toBeTruthy();
  });

  it('submits exactly the picked, addable candidates, in list order', async () => {
    const a = cand('a'); const b = cand('b'); const c = cand('c');
    g.results = [a, b, c];
    mount();
    fireEvent.click(row('Place c'));
    fireEvent.click(row('Place a'));
    await act(async () => { fireEvent.click(screen.getByText('Add 2 places')); });
    expect(g.addMany).toHaveBeenCalledTimes(1);
    expect(g.addMany).toHaveBeenCalledWith([a, c]);
  });

  it('submits once however fast the button is tapped twice', async () => {
    g.results = [cand('a')];
    let settle: (t: Tally) => void = () => {};
    g.addMany.mockImplementation(() => new Promise<Tally>((r) => { settle = r; }));
    const { navigation } = mount();
    fireEvent.click(row('Place a'));
    const btn = screen.getByText('Add this place');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(g.addMany).toHaveBeenCalledTimes(1);
    await act(async () => { settle(clean); });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('can submit again once the previous run has settled', async () => {
    g.results = [cand('a')];
    g.addMany.mockResolvedValue({ ...clean, done: 0, failed: 1 });
    mount();
    fireEvent.click(row('Place a'));
    await act(async () => { fireEvent.click(screen.getByText('Add this place')); });
    await act(async () => { fireEvent.click(screen.getByText('Add this place')); });
    expect(g.addMany).toHaveBeenCalledTimes(2);
  });

  it('goes back to Explore after a clean run', async () => {
    g.results = [cand('a')];
    const { navigation } = mount();
    fireEvent.click(row('Place a'));
    await act(async () => { fireEvent.click(screen.getByText('Add this place')); });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['something failed', { failed: 1 }],
    ['the daily cap held some back', { held: 2 }],
    ['the reader stopped it', { cancelled: true }],
  ])('stays when %s', async (_why, over) => {
    g.results = [cand('a')];
    g.addMany.mockResolvedValue({ ...clean, ...over });
    const { navigation } = mount();
    fireEvent.click(row('Place a'));
    await act(async () => { fireEvent.click(screen.getByText('Add this place')); });
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

describe('while a batch runs and after', () => {
  it('heads the list with progress and offers to stop', () => {
    g.results = [cand('a'), cand('b'), cand('c')];
    g.batch = { running: true, state: { a: 'done', b: 'running', c: 'queued' }, done: 1, total: 3 };
    g.adding = 'b';
    mount();
    expect(screen.getByText('ADDING 3 · 1 DONE')).toBeTruthy();
    expect(screen.getByText('Adding 2 of 3…')).toBeTruthy();
    expect(screen.getByText('Fetching name, photos and hours…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop after this one' }));
    expect(g.cancel).toHaveBeenCalledTimes(1);
  });

  it('counts only the places actually added once a run has finished', () => {
    g.results = [cand('a'), cand('b'), cand('c')];
    // Three tried: one went in, one was already here, one failed.
    g.batch = { running: false, state: { a: 'done', b: 'skipped', c: 'failed' }, done: 3, total: 3 };
    g.known = { a: { state: 'mine', slug: 'a' }, b: { state: 'live', slug: 'b' } };
    mount();
    expect(screen.getByText('ADDED 1 OF 3')).toBeTruthy();
    expect(screen.getByText('Could not add this one')).toBeTruthy();
    expect(screen.getByText('Already here — skipped')).toBeTruthy();
  });

  it('offers the way back to Explore when a run ended with nothing left to add', () => {
    g.results = [cand('a')];
    g.batch = { running: false, state: { a: 'done' }, done: 1, total: 1 };
    g.known = { a: { state: 'mine', slug: 'a' } };
    const { navigation } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Back to Explore/ }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('says why the rest were held when the daily cap is reached', () => {
    g.results = [cand('a'), cand('b'), cand('c')];
    g.batch = { running: false, state: { a: 'done', b: 'held', c: 'held' }, done: 1, total: 3 };
    g.known = { a: { state: 'mine', slug: 'a' } };
    mount();
    expect(screen.getByText('2 places still to add — no goes left today')).toBeTruthy();
    expect(screen.getAllByText('Not added — no goes left today')).toHaveLength(2);
    expect(screen.getByText('They keep their place — come back and add them then.')).toBeTruthy();
    expect(screen.queryByText(/^Add (this|\d)/)).toBeNull();
  });

  it('heads a Japanese reader’s finished run in Japanese', () => {
    env.lang = 'ja';
    g.results = [cand('a'), cand('b')];
    g.batch = { running: false, state: { a: 'done', b: 'failed' }, done: 2, total: 2 };
    mount();
    expect(screen.getByText('2件中 1件を追加')).toBeTruthy();
  });
});
