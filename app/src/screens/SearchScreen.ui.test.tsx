// @vitest-environment jsdom
//
// Search, driven the way a reader drives it: type, tap, read.
//
// The screen is almost all branching over one list — a zero-state before a
// word is typed, results under headings after, a dead end with a way out
// when nothing matches, and a Google section that only exists once the
// reader asked for it. Each of those has shipped wrong at least once in
// its life (a Google section answering the previous query, "most popular"
// advertising a pending place, a keyboard re-summoned on every pop), so
// what is pinned here is what the reader sees and where each tap goes.
//
// The seams mocked are the screen's own hooks: the catalog, the city, the
// Google candidates and the taste profile. The pure libraries under them —
// search, recents, ranking, dead-end routes, opening hours — run for real,
// so a result on screen is the result the app would show.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';
import type { Collection, Place } from '../lib/data';
import type { Candidate, Known } from '../lib/suggest';
import { RECENTS_KEY } from '../lib/recents';

const cat = vi.hoisted(() => ({
  places: [] as unknown[],
  cols: [] as unknown[],
  terms: {} as Record<string, string[]>,
}));

// The Google half, as a plain object the tests set before rendering. The
// hook's own network behaviour is lib/candidates' to answer for; what the
// screen owes it is which rows it shows and which calls it makes.
const g = vi.hoisted(() => ({
  results: null as unknown[] | null,
  known: {} as Record<string, unknown>,
  searching: false,
  adding: null as string | null,
  batch: { running: false, state: {}, done: 0, total: 0 } as unknown,
  run: vi.fn(),
  addMany: vi.fn(async () => ({ done: 0, skipped: 0, failed: 0, held: 0, cancelled: false })),
  cancel: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/city', () => ({
  useCity: () => ({ city: { id: 'hanoi' } }),
}));
vi.mock('../lib/catalog', () => ({
  usePlaces: () => ({ data: cat.places }),
  useCollections: () => ({ data: cat.cols }),
  useLikes: () => ({ likes: {} }),
  useSearchTerms: () => cat.terms,
}));
vi.mock('../lib/candidates', () => ({
  // The real filter, restated: importing the module pulls auth and the
  // network in behind it, and this one line is all the screen uses.
  freshOnly: (results: Candidate[], known: Record<string, Known>) =>
    results.filter((c) => (known[c.place_id]?.state ?? 'none') === 'none'),
  useCandidates: () => ({ ...g, awayFrom: () => '' }),
}));
vi.mock('../lib/tasteProfile', () => ({ useBrowseTaste: () => null }));
vi.mock('../lib/save', () => ({
  useSave: () => ({ save: vi.fn(), isSaved: () => false }),
}));

import SearchScreen from './SearchScreen';

const week = (hours: string) =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((d) => `${d}: ${hours}`);

const place = (over: Partial<Place>): Place => ({
  slug: 'x',
  city_id: 'hanoi',
  name_en: 'X',
  name_vi: 'X',
  name_ja: null,
  category: 'out',
  categories: [],
  is_featured: false,
  is_published: true,
  review_status: 'approved',
  vibe_tags: [],
  neighborhood_en: null,
  neighborhood_vi: null,
  neighborhood_ja: null,
  address: null,
  lat: null,
  lng: null,
  rating: null,
  rating_count: null,
  price_display: null,
  price_vnd: null,
  duration_min: null,
  duration_max: null,
  desc_en: null,
  desc_vi: null,
  desc_ja: null,
  emoji: null,
  opening_hours: null,
  website: null,
  phone: null,
  place_photos: [],
  ...over,
} as Place);

// Thursday 10:00 in Hanoi — the clock every opening-hours line below is
// read against.
const NOW = new Date('2026-09-10T03:00:00Z');

const cong = place({
  slug: 'cong', name_en: 'Cong Caphe', categories: ['cafes'],
  neighborhood_en: 'Hoan Kiem', rating: 4.5, rating_count: 100,
  opening_hours: week('8:00 AM – 10:00 PM'), created_at: '2026-01-02T00:00:00Z',
} as Partial<Place>);
const pho = place({
  slug: 'pho-10', name_en: 'Phở 10 Lý Quốc Sư', categories: ['eats'],
  neighborhood_en: 'Hoan Kiem', rating: 4.7, rating_count: 500,
  opening_hours: week('7:00 PM – 11:00 PM'), created_at: '2026-03-01T00:00:00Z',
} as Partial<Place>);
const museum = place({
  slug: 'fine-arts', name_en: 'Fine Arts Gallery', categories: ['heritage'],
  neighborhood_en: 'Ba Dinh',
});
// The reader's own submission: searchable, but never recommended.
const pending = place({
  slug: 'pending', name_en: 'Pending Bakery', categories: ['markets'],
  is_published: false, review_status: 'pending',
  opening_hours: week('Open 24 hours'), created_at: '2026-09-01T00:00:00Z',
} as Partial<Place>);

const collection = (over: Partial<Collection>): Collection => ({
  slug: 'c', title_en: 'C', title_vi: 'C', title_ja: null,
  desc_en: null, desc_vi: null, desc_ja: null, curator_handle: null,
  cover: null, collection_places: [],
  ...over,
} as Collection);
const members = (...slugs: string[]) =>
  slugs.map((slug, i) => ({ sort_order: i, places: { slug } }));

const crawl = collection({ slug: 'coffee-crawl', title_en: 'Coffee crawl', collection_places: members('cong', 'pho-10') });
const gallery = collection({ slug: 'gallery-day', title_en: 'Gallery day', collection_places: members('fine-arts') });
// Entirely in another city: must never answer a search made in Hanoi.
const saigon = collection({
  slug: 'saigon', title_en: 'Coffee in Saigon',
  members: [place({ slug: 'sg', city_id: 'saigon', name_en: 'SG Roastery' })],
});

const cand = (id: string, name: string): Candidate => ({
  place_id: id, name, address: `${name} street`, lat: null, lng: null, rating: null, rating_count: null,
});

const nav = () => {
  const listeners: Record<string, () => void> = {};
  const n = {
    navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
    addListener: vi.fn((ev: string, cb: () => void) => { listeners[ev] = cb; return vi.fn(); }),
  };
  return { n: n as unknown as Nav & typeof n, listeners };
};

const input = () => screen.getByTestId('search-input') as HTMLInputElement;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const tapText = (text: string) => fireEvent.click(screen.getByText(text));
/** Everything the page says after `label`, for asserting order within a section. */
const textAfter = (label: string) => {
  const all = document.body.textContent ?? '';
  const i = all.indexOf(label);
  expect(i).toBeGreaterThanOrEqual(0);
  return all.slice(i + label.length);
};

const mount = () => {
  const { n, listeners } = nav();
  const r = render(<SearchScreen navigation={n} />);
  return { navigation: n, listeners, rerender: () => r.rerender(<SearchScreen navigation={n} />) };
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  cat.places = [cong, pho, museum, pending];
  cat.cols = [crawl, gallery, saigon];
  cat.terms = { heritage: ['temple'] };
  Object.assign(g, {
    results: null, known: {}, searching: false, adding: null,
    batch: { running: false, state: {}, done: 0, total: 0 },
  });
  g.run.mockClear();
  g.addMany.mockClear();
  g.clear.mockClear();
  await AsyncStorage.removeItem(RECENTS_KEY);
  vi.mocked(AsyncStorage.setItem).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the zero-state', () => {
  it('offers browse, open now, most popular and recently added before anything is typed', () => {
    mount();
    for (const label of ['Browse', 'Open right now', 'Most popular', 'Recently added']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // Nothing remembered yet, so no Recent section.
    expect(screen.queryByText('Recent')).toBeNull();
    expect(screen.queryByText('Places')).toBeNull();
  });

  it('shows a chip only for categories this city has live places in, in taxonomy order', () => {
    mount();
    const chips = textAfter('Browse');
    expect(chips.indexOf('Cafés')).toBeLessThan(chips.indexOf('Eats'));
    expect(chips.indexOf('Eats')).toBeLessThan(chips.indexOf('Culture'));
    // Shopping exists only as the reader's own pending submission.
    expect(screen.queryByText('Shopping')).toBeNull();
    expect(screen.queryByText('Nightlife')).toBeNull();
  });

  it('lists only the places open at this minute, with how long they stay open', () => {
    mount();
    const open = textAfter('Open right now');
    const section = open.slice(0, open.indexOf('Most popular'));
    expect(section).toContain('Cong Caphe');
    expect(section).toContain('Hoan Kiem · until 22:00');
    expect(section).not.toContain('Phở 10');
  });

  it('says when a closed place opens, and shows the rating on the right', () => {
    mount();
    const popular = textAfter('Most popular');
    expect(popular).toContain('Hoan Kiem · opens 19:00');
    expect(popular).toContain('4.7');
    // An unrated place keeps the chevron; an area with no hours stands alone.
    expect(popular).toContain('Ba Dinh');
    expect(popular).not.toContain('Ba Dinh ·');
  });

  it('never recommends a pending place in any zero-state section', () => {
    mount();
    expect(screen.queryByText('Pending Bakery')).toBeNull();
  });

  it('orders recently added newest first and leaves out undated places', () => {
    // Fewer rows, so the whole zero-state fits in the list's first window.
    cat.places = [{ ...cong, opening_hours: null }, pho, museum];
    mount();
    const latest = textAfter('Recently added');
    expect(latest.indexOf('Phở 10 Lý Quốc Sư')).toBeGreaterThanOrEqual(0);
    expect(latest.indexOf('Phở 10 Lý Quốc Sư')).toBeLessThan(latest.indexOf('Cong Caphe'));
    expect(latest).not.toContain('Fine Arts Gallery');
  });

  it('opens a zero-state row without remembering a search', () => {
    const { navigation } = mount();
    fireEvent.click(screen.getAllByText('Fine Arts Gallery')[0]);
    expect(navigation.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'fine-arts' });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('skips the open-now section entirely when nothing is open', () => {
    cat.places = [pho, museum];
    mount();
    expect(screen.queryByText('Open right now')).toBeNull();
    expect(screen.getByText('Most popular')).toBeTruthy();
  });

  it('shows the hint while the catalog is still empty', () => {
    cat.places = [];
    cat.cols = [];
    mount();
    expect(screen.getByText('Try a name, a neighbourhood, or a vibe — cafés, museums, rooftops.')).toBeTruthy();
    expect(screen.queryByText('Browse')).toBeNull();
  });

  it('turns a category chip into the search itself', () => {
    mount();
    tapText('Cafés');
    expect(input().value).toBe('Cafés');
    expect(screen.getByTestId('search-result-0').textContent).toContain('Cong Caphe');
    expect(screen.queryByText('Browse')).toBeNull();
  });
});

describe('recent searches', () => {
  it('shows at most five remembered searches, newest first', async () => {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']));
    mount();
    expect(await screen.findByText('Recent')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'a5' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'a6' })).toBeNull();
  });

  it('treats unreadable storage as an empty memory', async () => {
    await AsyncStorage.setItem(RECENTS_KEY, '{not json');
    mount();
    await act(async () => {});
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('re-runs a search from its row', async () => {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(['pho 10']));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'pho 10' }));
    expect(input().value).toBe('pho 10');
    expect(screen.getByTestId('search-result-0').textContent).toContain('Phở 10 Lý Quốc Sư');
  });

  it('lifts a term into the box for editing, and focuses it', async () => {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(['cong']));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit this search' }));
    expect(input().value).toBe('cong');
    expect(document.activeElement).toBe(input());
  });

  it('forgets every remembered search on Clear', async () => {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(['cong', 'pho']));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Clear recent searches' }));
    expect(screen.queryByText('Recent')).toBeNull();
    expect(screen.queryByRole('button', { name: 'cong' })).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(RECENTS_KEY, '[]');
  });

  it('remembers a query once one of its results is opened', async () => {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(['older']));
    const { navigation } = mount();
    await screen.findByText('Recent');
    type('  cong ');
    fireEvent.click(screen.getByTestId('search-result-0'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'cong' });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(RECENTS_KEY, JSON.stringify(['cong', 'older']));
  });
});

describe('typing a query', () => {
  it('replaces the zero-state with place results, diacritics folded', () => {
    mount();
    type('pho ly');
    expect(screen.getByText('Places')).toBeTruthy();
    expect(screen.getByTestId('search-result-0').textContent).toContain('Phở 10 Lý Quốc Sư');
    expect(screen.queryByTestId('search-result-1')).toBeNull();
    expect(screen.queryByText('Most popular')).toBeNull();
  });

  it('numbers every place hit for addressing', () => {
    mount();
    type('hoan kiem');
    expect(screen.getByTestId('search-result-0').textContent).toContain('Cong Caphe');
    expect(screen.getByTestId('search-result-1').textContent).toContain('Phở 10');
  });

  it('still finds the reader’s own pending place', () => {
    mount();
    type('bakery');
    expect(screen.getByTestId('search-result-0').textContent).toContain('Pending Bakery');
  });

  it('finds collections in this city by title, with their size', () => {
    mount();
    type('coffee');
    expect(screen.getByText('Collections')).toBeTruthy();
    expect(screen.getByText('Coffee crawl')).toBeTruthy();
    expect(screen.getByText('2 places')).toBeTruthy();
    expect(screen.queryByText('Coffee in Saigon')).toBeNull();
  });

  it('finds a collection by the names of the places inside it, singular count', () => {
    mount();
    type('fine arts');
    expect(screen.getByText('Gallery day')).toBeTruthy();
    expect(screen.getByText('1 place')).toBeTruthy();
  });

  it('opens a collection and remembers the query', () => {
    const { navigation } = mount();
    type('crawl');
    tapText('Coffee crawl');
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'coffee-crawl' });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(RECENTS_KEY, JSON.stringify(['crawl']));
  });

  it('labels synonym matches as the guess they are', () => {
    mount();
    type('temple');
    expect(screen.getByText('No exact match — related places')).toBeTruthy();
    expect(screen.queryByText('Places')).toBeNull();
    expect(screen.getByTestId('search-result-0').textContent).toContain('Fine Arts Gallery');
  });

  it('offers to look further under results that exist', () => {
    mount();
    type('cong');
    fireEvent.click(screen.getByText('Add “cong”'));
    expect(g.run).toHaveBeenCalledWith('cong');
    expect(screen.queryByText('No matches for “cong”')).toBeNull();
  });

  it('clears the box from the × and returns to the zero-state', () => {
    mount();
    expect(screen.queryByTestId('search-clear')).toBeNull();
    type('cong');
    fireEvent.click(screen.getByTestId('search-clear'));
    expect(input().value).toBe('');
    expect(screen.getByText('Most popular')).toBeTruthy();
    expect(screen.queryByTestId('search-clear')).toBeNull();
  });

  it('goes back from the back button', () => {
    const { navigation } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('a search that finds nothing', () => {
  it('says so, and offers Google and a way back', () => {
    const { navigation } = mount();
    type('zzz');
    expect(screen.getByText('No matches for “zzz”')).toBeTruthy();
    expect(screen.getByText('Not in City Crew yet.')).toBeTruthy();
    expect(screen.getByText('We look it up on Google Maps')).toBeTruthy();
    expect(screen.getByText('OR TRY')).toBeTruthy();
    fireEvent.click(screen.getByText('Back to Explore'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('shortens a long query on the label but sends the whole of it', () => {
    mount();
    type('abcdefghijklmnopq');
    expect(screen.getByText('No matches for “abcdefghijklmn…”')).toBeTruthy();
    tapText('Add “abcdefghijklmn…”');
    expect(g.run).toHaveBeenCalledWith('abcdefghijklmnopq');
  });

  it('offers the part of town inside the query, which re-runs the search', () => {
    mount();
    type('zzz hoan kiem');
    expect(screen.queryByText('All Cafés')).toBeNull();
    tapText('Browse Hoan Kiem');
    expect(input().value).toBe('Hoan Kiem');
    expect(screen.getByTestId('search-result-0').textContent).toContain('Cong Caphe');
  });

  it('offers the kind of place inside the query', () => {
    mount();
    type('zzz cafes');
    tapText('All Cafés');
    expect(input().value).toBe('Cafés');
    expect(screen.getByTestId('search-result-0').textContent).toContain('Cong Caphe');
  });

  it('shows a spinner instead of the offer while Google is being asked', () => {
    g.searching = true;
    mount();
    type('zzz');
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('Add “zzz”')).toBeNull();
    // The fork survives the wait.
    expect(screen.getByText('Back to Explore')).toBeTruthy();
  });

  it('says out loud when Google had nothing new', () => {
    g.results = [cand('g1', 'Already Known')];
    g.known = { g1: { state: 'live', slug: 'cong' } };
    mount();
    type('zzz');
    expect(screen.getByText('Nothing on Google Maps that is not already here.')).toBeTruthy();
    expect(screen.queryByText('Already Known')).toBeNull();
    expect(screen.queryByText('On Google Maps')).toBeNull();
    expect(screen.queryByText('Add “zzz”')).toBeNull();
    expect(screen.getByText('Back to Explore')).toBeTruthy();
  });
});

describe('the Google section', () => {
  const asked = () => {
    g.results = [cand('g1', 'New Roastery'), cand('g2', 'Other Roastery'), cand('g3', 'Known Place')];
    g.known = { g3: { state: 'live', slug: 'cong' } };
  };

  it('shows only what the catalog has never heard of, under its own heading', () => {
    asked();
    mount();
    type('roastery');
    expect(screen.getByText('On Google Maps')).toBeTruthy();
    expect(screen.getByText('New Roastery')).toBeTruthy();
    expect(screen.queryByText('Known Place')).toBeNull();
    // Already asked: the offer has nothing left to give.
    expect(screen.queryByText('Add “roastery”')).toBeNull();
    expect(screen.queryByText('No matches for “roastery”')).toBeNull();
  });

  it('leaves the hook alone on a keystroke when nothing was asked', () => {
    mount();
    type('a');
    expect(g.clear).not.toHaveBeenCalled();
  });

  it('asks the hook to clear the old answer on a new query', () => {
    asked();
    mount();
    type('roast');
    expect(g.clear).toHaveBeenCalled();
  });

  it('adds the ticked rows together', () => {
    asked();
    mount();
    type('roastery');
    const [first, second] = screen.getAllByRole('checkbox');
    fireEvent.click(first);
    fireEvent.click(screen.getByText('Add this place'));
    expect(g.addMany).toHaveBeenCalledWith([expect.objectContaining({ place_id: 'g1' })]);

    fireEvent.click(second);
    fireEvent.click(screen.getByText('Add 2 places'));
    expect(g.addMany).toHaveBeenLastCalledWith([
      expect.objectContaining({ place_id: 'g1' }),
      expect.objectContaining({ place_id: 'g2' }),
    ]);

    fireEvent.click(first);
    fireEvent.click(second);
    expect(screen.queryByText(/^Add \d places$|^Add this place$/)).toBeNull();
  });

  it('keeps an added row on screen but stops counting it towards the button', () => {
    asked();
    const { navigation, rerender } = mount();
    type('roastery');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText('Add this place')).toBeTruthy();

    // The add lands: the hook now knows the place as the reader's own.
    g.known = { ...g.known, g1: { state: 'mine', slug: 'new-roastery' } };
    rerender();
    expect(screen.getByText('New Roastery')).toBeTruthy();
    expect(screen.queryByText('Add this place')).toBeNull();
    fireEvent.click(screen.getByText('View'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'new-roastery' });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(RECENTS_KEY, JSON.stringify(['roastery']));
  });
});

describe('the keyboard', () => {
  it('rises once the push has landed, not during it', () => {
    const { listeners } = mount();
    expect(document.activeElement).not.toBe(input());
    act(() => listeners.transitionEnd());
    expect(document.activeElement).toBe(input());
  });

  it('falls back to a timer when no transition end ever arrives', async () => {
    mount();
    await waitFor(() => expect(document.activeElement).toBe(input()), { timeout: 1500 });
  });

  it('is summoned only once', async () => {
    const { listeners } = mount();
    act(() => listeners.transitionEnd());
    act(() => input().blur());
    act(() => listeners.transitionEnd());
    expect(document.activeElement).not.toBe(input());
    await new Promise((r) => setTimeout(r, 700));
    expect(document.activeElement).not.toBe(input());
  });
});
