import { describe, expect, it } from 'vitest';
import type { Collection, PlacePhoto } from './types';
import {
  autoWall, cityTiles, cityWallUri, collectionTiles, heroSlugsWanted, resolveWall, sameWall, wallColumns, wallOf,
} from './wall';

const list = (id: string) => ({ id } as unknown as Collection);
const covers: Record<string, string> = { a: 'A.jpg', b: 'B.jpg', d: 'D.jpg' };
const coverFor = (c: Collection) => covers[c.id ?? ''];
const photo = (uri: string, o: Partial<PlacePhoto> = {}): PlacePhoto =>
  ({ photo_uri: uri, is_cover: false, is_hidden: false, sort_order: 0, attribution_name: null, ...o } as PlacePhoto);

const hanoi = { id: 'hanoi', hero_photo_uri: null, hero_place_slug: 'west-lake' };
const hue = { id: 'hue', hero_photo_uri: 'HUE.jpg', hero_place_slug: 'imperial' };
const bare = { id: 'bare', hero_photo_uri: null, hero_place_slug: null };
const heroPhotos = {
  'west-lake': [photo('second.jpg', { sort_order: 2 }), photo('hidden.jpg', { is_hidden: true, is_cover: true }),
    photo('first.jpg', { sort_order: 1 }), photo('cover.jpg', { is_cover: true, sort_order: 9 })],
};

describe('wallOf', () => {
  it('reads a stored choice', () => {
    expect(wallOf({ wall_kind: 'city', wall_ref: 'hanoi' })).toEqual({ kind: 'city', ref: 'hanoi' });
  });
  it('reads automatic from nothing, a kind with no ref, a ref with no kind, or a kind it does not know', () => {
    expect(wallOf(null)).toBeNull();
    expect(wallOf(undefined)).toBeNull();
    expect(wallOf({})).toBeNull();
    expect(wallOf({ wall_kind: 'city', wall_ref: null })).toBeNull();
    expect(wallOf({ wall_kind: null, wall_ref: 'hanoi' })).toBeNull();
    expect(wallOf({ wall_kind: 'sky', wall_ref: 'hanoi' })).toBeNull();
  });
});

describe('wallColumns', () => {
  it('writes a choice, and automatic as two nulls', () => {
    expect(wallColumns({ kind: 'upload', ref: 'u' })).toEqual({ wall_kind: 'upload', wall_ref: 'u' });
    expect(wallColumns(null)).toEqual({ wall_kind: null, wall_ref: null });
  });
});

describe('cityWallUri', () => {
  it('takes the city\'s own photograph first', () => {
    expect(cityWallUri(hue, heroPhotos)).toBe('HUE.jpg');
  });
  it('else its hero place\'s cover, skipping a hidden one, as photosOf sorts', () => {
    expect(cityWallUri(hanoi, heroPhotos)).toBe('cover.jpg');
    expect(cityWallUri(hanoi, { 'west-lake': [photo('second.jpg', { sort_order: 2 }), photo('first.jpg', { sort_order: 1 })] })).toBe('first.jpg');
  });
  it('is nothing with no photograph and no hero, or a hero not yet fetched', () => {
    expect(cityWallUri(bare, heroPhotos)).toBeUndefined();
    expect(cityWallUri(hanoi, {})).toBeUndefined();
  });
});

describe('heroSlugsWanted', () => {
  it('asks only for the cities with no photograph of their own', () => {
    expect(heroSlugsWanted([hanoi, hue, bare])).toEqual(['west-lake']);
  });
});

describe('autoWall', () => {
  it('skips the first list, which is the first card under the cover', () => {
    expect(autoWall([list('a'), list('b')], coverFor, 'CITY.jpg')).toBe('B.jpg');
  });
  it('takes the next list that has a cover', () => {
    expect(autoWall([list('a'), list('c'), list('d')], coverFor, 'CITY.jpg')).toBe('D.jpg');
  });
  it('falls to the city with one list, none, or none after the first with a cover', () => {
    expect(autoWall([list('a')], coverFor, 'CITY.jpg')).toBe('CITY.jpg');
    expect(autoWall([], coverFor, 'CITY.jpg')).toBe('CITY.jpg');
    expect(autoWall([list('a'), list('c')], coverFor, undefined)).toBeUndefined();
  });
});

describe('resolveWall', () => {
  const ctx = { cities: [hanoi, hue, bare], heroPhotos, open: [list('a'), list('b'), list('c')], coverFor, auto: 'AUTO.jpg' };
  it('is automatic when nothing is chosen', () => {
    expect(resolveWall(null, ctx)).toBe('AUTO.jpg');
  });
  it('is the upload\'s own URL', () => {
    expect(resolveWall({ kind: 'upload', ref: 'U.jpg' }, ctx)).toBe('U.jpg');
  });
  it('is the chosen city\'s picture, or automatic for a city gone or without one', () => {
    expect(resolveWall({ kind: 'city', ref: 'hanoi' }, ctx)).toBe('cover.jpg');
    expect(resolveWall({ kind: 'city', ref: 'gone' }, ctx)).toBe('AUTO.jpg');
    expect(resolveWall({ kind: 'city', ref: 'bare' }, ctx)).toBe('AUTO.jpg');
  });
  it('is the chosen list\'s cover, or automatic for a list not public any more or without one', () => {
    expect(resolveWall({ kind: 'collection', ref: 'b' }, ctx)).toBe('B.jpg');
    expect(resolveWall({ kind: 'collection', ref: 'private' }, ctx)).toBe('AUTO.jpg');
    expect(resolveWall({ kind: 'collection', ref: 'c' }, ctx)).toBe('AUTO.jpg');
  });
});

describe('the sheet\'s rows', () => {
  it('offers each city that has a picture, in order, by name', () => {
    expect(cityTiles([{ ...hue, name: 'Huế' }, { ...bare, name: 'Bare' }, { ...hanoi, name: 'Hà Nội' }], heroPhotos)).toEqual([
      { wall: { kind: 'city', ref: 'hue' }, uri: 'HUE.jpg', title: 'Huế' },
      { wall: { kind: 'city', ref: 'hanoi' }, uri: 'cover.jpg', title: 'Hà Nội' },
    ]);
  });
  it('offers each public list that has a cover, by its title', () => {
    const noId = { slug: 'x' } as unknown as Collection;
    expect(collectionTiles([list('a'), list('c'), noId, list('b')], (c) => coverFor(c) ?? (c.id ? undefined : 'X.jpg'), (c) => `T-${c.id}`)).toEqual([
      { wall: { kind: 'collection', ref: 'a' }, uri: 'A.jpg', title: 'T-a' },
      { wall: { kind: 'collection', ref: 'b' }, uri: 'B.jpg', title: 'T-b' },
    ]);
  });
});

describe('sameWall', () => {
  it('matches the same choice, and automatic with automatic', () => {
    expect(sameWall(null, null)).toBe(true);
    expect(sameWall({ kind: 'city', ref: 'x' }, { kind: 'city', ref: 'x' })).toBe(true);
  });
  it('tells choices apart, and a choice from automatic', () => {
    expect(sameWall({ kind: 'city', ref: 'x' }, { kind: 'city', ref: 'y' })).toBe(false);
    expect(sameWall({ kind: 'city', ref: 'x' }, { kind: 'collection', ref: 'x' })).toBe(false);
    expect(sameWall({ kind: 'city', ref: 'x' }, null)).toBe(false);
    expect(sameWall(null, { kind: 'city', ref: 'x' })).toBe(false);
  });
});
