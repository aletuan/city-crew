// @vitest-environment jsdom
//
// The row at a thread's head: what it says of the list, that it draws
// nothing for a list it does not know, and where a press on it goes.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '../../uitest/render';
import type { Nav } from '../../nav';

const cat = vi.hoisted(() => ({ lists: [] as unknown[], places: [] as unknown[] }));
vi.mock('../../lib/catalog', () => ({
  useCollections: () => ({ data: cat.lists }),
  usePlaces: () => ({ data: cat.places }),
}));
const tongue = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: tongue.lang, t: (en: string, vi_: string) => (tongue.lang === 'vi' ? vi_ : en) }) }));

import ThreadAbout from './ThreadAbout';

const place = (slug: string, photo?: string) => ({
  slug, lat: 10, lng: 106,
  place_photos: photo ? [{ photo_uri: photo, is_cover: true, is_hidden: false, sort_order: 0 }] : [],
});
const list = (over: Record<string, unknown> = {}) => ({
  id: 'c1', slug: 'chinese-flavours', title_en: 'Chinese Flavours of Saigon', title_vi: 'Hương vị Hoa ở Sài Gòn', title_ja: null,
  curator_handle: 'trang', cover: null,
  collection_places: [{ sort_order: 0, places: { slug: 'a' } }, { sort_order: 1, places: { slug: 'b' } }],
  ...over,
});
const nav = (routes: { name: string; params?: Record<string, unknown> }[] = [{ name: 'Comments' }]) => ({
  goBack: vi.fn(), navigate: vi.fn(), getState: () => ({ routes, index: routes.length - 1 }),
});
const draw = (navigation = nav(), id = 'c1') => {
  render(<ThreadAbout subject={{ kind: 'collection', id }} navigation={navigation as unknown as Nav} />);
  return navigation;
};

beforeEach(() => {
  tongue.lang = 'en';
  cat.lists = [list()];
  cat.places = [place('a', 'https://img/a.jpg'), place('b', 'https://img/b.jpg')];
});
afterEach(cleanup);

describe('ThreadAbout', () => {
  it('names the list, how many places it holds and whose it is', () => {
    draw();
    expect(screen.getByRole('button', { name: 'Chinese Flavours of Saigon, 2 places · trang' })).toBeTruthy();
    expect(screen.getByText('2 places · trang')).toBeTruthy();
  });

  it('speaks the reader\'s language, and counts one place as one', () => {
    tongue.lang = 'vi';
    cat.lists = [list({ collection_places: [{ sort_order: 0, places: { slug: 'a' } }], curator_handle: null })];
    draw();
    expect(screen.getByText('Hương vị Hoa ở Sài Gòn')).toBeTruthy();
    expect(screen.getByText('1 địa điểm')).toBeTruthy();
    cleanup();
    tongue.lang = 'en';
    draw();
    expect(screen.getByText('1 place')).toBeTruthy();
  });

  it('wears the list\'s chosen cover, else its first place\'s, else a blank', () => {
    cat.lists = [list({ cover: { photo_uri: 'https://img/chosen.jpg' } })];
    draw();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://img/chosen.jpg');
    cleanup();
    cat.lists = [list()];
    draw();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://img/a.jpg');
    cleanup();
    cat.places = [];
    draw();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByTestId('thread-about')).toBeTruthy();
  });

  it('draws nothing for a list the catalog does not hold', () => {
    draw(nav(), 'unknown');
    expect(screen.queryByTestId('thread-about')).toBeNull();
  });

  it('goes back when the page under it is that list, rather than stacking it again', () => {
    const n = draw(nav([{ name: 'CollectionDetail', params: { slug: 'chinese-flavours' } }, { name: 'Comments' }]));
    fireEvent.click(screen.getByTestId('thread-about'));
    expect(n.goBack).toHaveBeenCalledOnce();
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['another list is under it', [{ name: 'CollectionDetail', params: { slug: 'other' } }, { name: 'Comments' }]],
    ['another kind of page is under it', [{ name: 'Activity' }, { name: 'Comments' }]],
    ['nothing is under it', [{ name: 'Comments' }]],
  ])('opens the list when %s', (_why, routes) => {
    const n = draw(nav(routes));
    fireEvent.click(screen.getByTestId('thread-about'));
    expect(n.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'chinese-flavours' });
    expect(n.goBack).not.toHaveBeenCalled();
  });
});
