// @vitest-environment jsdom
//
// The page's column with visits in it: lists and visits in one order,
// five at a time across both, the next covers of either fetched ahead,
// and an empty page only when there is neither. What a list's card says
// is `PersonScreen.ui.test`'s; what a visit's says is `CheckinAct`'s.

import React from 'react';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Image } from 'expo-image';
import { cleanup, fireEvent, render, screen } from '../../uitest/render';
import type { PersonCheckin } from '../../lib/checkin';
import type { Collection, FriendProfile } from '../../lib/data';

vi.mock('../../lib/catalog', () => ({ useLikes: () => ({ likes: {}, myLikes: [], toggleLike: vi.fn() }) }));
vi.mock('../../lib/save', () => ({ useSaveActions: () => ({ askToSignIn: vi.fn() }) }));
vi.mock('./useCardComments', () => ({ useCardComments: () => () => ({}) }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));

import Shared, { PAGE } from './Shared';

const LAN = { id: 'lan', handle: 'lan', full_name: 'Lan', avatar_url: '' } as FriendProfile;
// Local noon, so a list's day is the same on any clock.
const made = (d: number) => new Date(2026, 10, d, 12).toISOString();
const list = (slug: string, d: number): Collection => ({
  id: `id-${slug}`, slug, title_en: `List ${slug}`, title_vi: slug, desc_en: null, desc_vi: null,
  collection_places: [], owner_id: 'lan', is_public: true, created_at: made(d),
} as unknown as Collection);
const visit = (id: string, d: number): PersonCheckin => ({
  id, place_slug: id, place: { name_en: `Place ${id}`, name_vi: id, cover: `https://x/${id}.jpg`, categories: [] },
  city_id: null, day: `2026-11-${String(d).padStart(2, '0')}`, note: null, audience: null, likes: 0, liked: false,
});
const visitCard = (v: PersonCheckin) => <Text key={v.id} testID="a-visit">{v.id}</Text>;
const prefetch = vi.spyOn(Image, 'prefetch').mockResolvedValue(true);

const show = (lists: Collection[], visits: PersonCheckin[] | undefined, me: string | null = 'me', reach = 0) => render(
  <Shared
    me={me} person={LAN} lists={lists} visits={visits} visitCard={visitCard}
    seenOf={() => ({ kind: 'public' })} coverFor={(c) => `https://x/${c.slug}.jpg`}
    onOpen={() => {}} onCreate={() => {}} reach={reach}
  />,
);
/** The column as drawn, a visit by its id and a list by its title. */
const column = () => [...screen.getByTestId('person-activity').children]
  .map((el) => (el.getAttribute('data-testid') === 'a-visit' ? el.textContent : el.querySelector('[data-testid="activity-open"]')?.getAttribute('aria-label')?.split(',')[0]))
  .filter(Boolean);

beforeEach(() => { prefetch.mockClear(); });
afterEach(cleanup);

describe('Shared, with visits', () => {
  it('draws the lists and the visits in one column, by day', () => {
    show([list('b', 20), list('a', 10)], [visit('k3', 22), visit('k2', 15), visit('k1', 5)]);
    expect(column()).toEqual(['k3', 'List b', 'k2', 'List a', 'k1']);
  });

  it('is the lists alone when no visits are handed in', () => {
    show([list('b', 20), list('a', 10)], undefined);
    expect(column()).toEqual(['List b', 'List a']);
  });

  it('draws five at a time across the two, and five more on Show more', () => {
    const lists = [list('c', 18), list('b', 14), list('a', 10)];
    const visits = [visit('k4', 20), visit('k3', 16), visit('k2', 12), visit('k1', 8)];
    show(lists, visits);
    expect(column()).toEqual(['k4', 'List c', 'k3', 'List b', 'k2']);
    expect(PAGE).toBe(5);
    fireEvent.click(screen.getByTestId('person-show-more'));
    expect(column()).toEqual(['k4', 'List c', 'k3', 'List b', 'k2', 'List a', 'k1']);
    expect(screen.queryByTestId('person-show-more')).toBeNull();
  });

  it('adds five when the reader nears the end, counting the visits among what is left', () => {
    const visits = [1, 2, 3, 4, 5, 6, 7].map((d) => visit(`k${d}`, d)).reverse();
    const page = show([], visits, 'me', 0);
    expect(screen.getAllByTestId('a-visit')).toHaveLength(5);
    page.rerender(
      <Shared
        me="me" person={LAN} lists={[]} visits={visits} visitCard={visitCard}
        seenOf={() => ({ kind: 'public' })} coverFor={() => undefined} onOpen={() => {}} onCreate={() => {}} reach={1}
      />,
    );
    expect(screen.getAllByTestId('a-visit')).toHaveLength(7);
  });

  it('fetches ahead the covers of the cards that come next, a place’s as a list’s', () => {
    const lists = [list('c', 18), list('b', 14), list('a', 10)];
    const visits = [visit('k4', 20), visit('k3', 16), visit('k2', 12), visit('k1', 8)];
    show(lists, visits);
    expect(prefetch).toHaveBeenCalledWith(['https://x/a.jpg', 'https://x/k1.jpg'], 'memory-disk');
  });

  it('is not an empty page when there are visits and no lists', () => {
    show([], [visit('k1', 5)]);
    expect(screen.queryByTestId('person-no-lists')).toBeNull();
    expect(column()).toEqual(['k1']);
  });

  it('draws nothing of the column while the visits are awaited — no list, no empty page — and all of it once they are in', () => {
    const lists = [list('b', 20)];
    const page = render(
      <Shared
        me="me" person={LAN} lists={lists} visits={[]} visitCard={visitCard} holding
        seenOf={() => ({ kind: 'public' })} coverFor={() => undefined} onOpen={() => {}} onCreate={() => {}}
      />,
    );
    expect(screen.getByTestId('person-activity-wait')).toBeTruthy();
    expect(screen.queryByTestId('person-activity')).toBeNull();
    expect(screen.queryByTestId('person-no-lists')).toBeNull();
    page.rerender(
      <Shared
        me="me" person={LAN} lists={lists} visits={[visit('k1', 22)]} visitCard={visitCard} holding={false}
        seenOf={() => ({ kind: 'public' })} coverFor={() => undefined} onOpen={() => {}} onCreate={() => {}}
      />,
    );
    expect(screen.queryByTestId('person-activity-wait')).toBeNull();
    expect(column()).toEqual(['k1', 'List b']);
  });

  it('does not say the page is empty while it waits to find out', () => {
    render(
      <Shared
        me="me" person={LAN} lists={[]} visits={[]} visitCard={visitCard} holding
        seenOf={() => ({ kind: 'public' })} coverFor={() => undefined} onOpen={() => {}} onCreate={() => {}}
      />,
    );
    expect(screen.queryByTestId('person-no-lists')).toBeNull();
    expect(screen.getByTestId('person-activity-wait')).toBeTruthy();
  });

  it('is the empty page with neither', () => {
    show([], []);
    expect(screen.getByTestId('person-no-lists')).toBeTruthy();
    expect(screen.queryByTestId('person-activity')).toBeNull();
  });
});
