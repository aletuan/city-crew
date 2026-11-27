// @vitest-environment jsdom
//
// What is said of the list a thread is about: the hook's answer, and the
// two drawings of it. Where the row's press goes is `ThreadAbout`'s test.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '../uitest/render';

const cat = vi.hoisted(() => ({ lists: [] as unknown[], places: [] as unknown[] }));
vi.mock('../lib/catalog', () => ({
  useCollections: () => ({ data: cat.lists }),
  usePlaces: () => ({ data: cat.places }),
}));
const tongue = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: tongue.lang, t: (en: string, vi_: string) => (tongue.lang === 'vi' ? vi_ : en) }) }));

import { AboutCard, AboutLine, useAbout } from './CommentAbout';

const place = (slug: string, photo: string) => ({ slug, place_photos: [{ photo_uri: photo, is_cover: true, is_hidden: false, sort_order: 0 }] });
const list = (over: Record<string, unknown> = {}) => ({
  id: 'c1', slug: 'chinese-flavours', title_en: 'Chinese Flavours of Saigon', title_vi: 'Hương vị Hoa ở Sài Gòn', title_ja: null,
  curator_handle: 'trang', cover: null,
  collection_places: [{ sort_order: 0, places: { slug: 'a' } }, { sort_order: 1, places: { slug: 'b' } }],
  ...over,
});
const ask = (id: string | null = 'c1') => renderHook(() => useAbout(id ? { kind: 'collection', id } : null)).result.current;

beforeEach(() => {
  tongue.lang = 'en';
  cat.lists = [list()];
  cat.places = [place('a', 'https://img/a.jpg'), place('b', 'https://img/b.jpg')];
});
afterEach(cleanup);

describe('useAbout', () => {
  it('names the list, how many places it holds, whose it is, and its first place\'s cover', () => {
    expect(ask()).toEqual({ slug: 'chinese-flavours', title: 'Chinese Flavours of Saigon', facts: '2 places · trang', uri: 'https://img/a.jpg' });
  });
  it('speaks the reader\'s language, counts one as one, and leaves out an owner it does not know', () => {
    cat.lists = [list({ collection_places: [{ sort_order: 0, places: { slug: 'a' } }], curator_handle: null })];
    expect(ask()!.facts).toBe('1 place');
    tongue.lang = 'vi';
    expect(ask()).toMatchObject({ title: 'Hương vị Hoa ở Sài Gòn', facts: '1 địa điểm' });
  });
  it('takes the cover its owner chose over the first place\'s, and none when there is neither', () => {
    cat.lists = [list({ cover: { photo_uri: 'https://img/chosen.jpg' } })];
    expect(ask()!.uri).toBe('https://img/chosen.jpg');
    cat.lists = [list()];
    cat.places = [];
    expect(ask()!.uri).toBeUndefined();
  });
  it('is null for a list the catalog does not hold, and for no subject', () => {
    expect(ask('unknown')).toBeNull();
    expect(ask(null)).toBeNull();
  });
});

describe.each([
  ['AboutLine', AboutLine],
  ['AboutCard', AboutCard],
])('%s', (_name, Drawn) => {
  const about = { slug: 's', title: 'Chinese Flavours of Saigon', facts: '2 places · trang', uri: 'https://img/a.jpg' as string | undefined };
  it('draws the cover, the name and the facts', () => {
    render(<Drawn about={about} />);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://img/a.jpg');
    expect(screen.getByText('Chinese Flavours of Saigon')).toBeTruthy();
    expect(screen.getByText('2 places · trang')).toBeTruthy();
  });
  it('draws a blank where there is no cover, not a broken picture', () => {
    render(<Drawn about={{ ...about, uri: undefined }} />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('Chinese Flavours of Saigon')).toBeTruthy();
  });
});
