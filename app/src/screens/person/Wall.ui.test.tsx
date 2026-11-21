// @vitest-environment jsdom
//
// The cover on a person's page and the sheet that changes it
// (docs/wall-plan.md, W2): what the page wears for each choice, and on
// your own page a preview that follows a tap and a Save that writes the
// choice and reads the page again.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../../uitest/render';
import type { Collection, FriendProfile } from '../../lib/data';
import { useWall } from './Wall';

const st = vi.hoisted(() => ({
  city: { id: 'hcmc', hero_photo_uri: 'https://city/hcmc.jpg', hero_place_slug: null } as Record<string, unknown> | null,
  cities: [] as Record<string, unknown>[],
  photosAsked: [] as string[][],
  photos: {} as Record<string, unknown>,
  saved: [] as unknown[],
  fail: false,
  alerts: [] as string[],
}));
vi.mock('../../lib/city', () => ({
  useCurrentCity: () => ({ city: st.city }),
  useCityList: () => ({ cities: st.cities }),
}));
vi.mock('../../lib/data', async (orig) => ({
  ...(await orig<typeof import('../../lib/data')>()),
  fetchPlacePhotos: async (slugs: string[]) => { st.photosAsked.push(slugs); return st.photos; },
}));
vi.mock('../../lib/auth', () => ({
  useAuthActions: () => ({
    updateProfile: async (patch: unknown) => { if (st.fail) throw new Error('x'); st.saved.push(patch); },
  }),
}));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en, lang: 'en' }) }));
vi.mock('react-native', async (orig) => {
  const rn = await orig<typeof import('react-native')>();
  return { ...rn, Alert: { alert: (m: string) => { st.alerts.push(m); } } };
});

const city = (id: string, o: Record<string, unknown> = {}) =>
  ({ id, short_en: id.toUpperCase(), short_vi: id, short_ja: null, hero_photo_uri: `https://city/${id}.jpg`, hero_place_slug: null, ...o });
const list = (id: string, cover?: string) =>
  ({ id, slug: id, title_en: `T-${id}`, title_vi: `T-${id}`, cover: cover ? { photo_uri: cover } : null } as unknown as Collection);
const coverFor = (c: Collection) => (c as unknown as { cover: { photo_uri: string } | null }).cover?.photo_uri;
const person = (o: Partial<FriendProfile> = {}): FriendProfile =>
  ({ id: 'me', handle: 'me', full_name: 'Me', avatar_url: 'https://face.jpg', ...o });

function Page({ who, own, open, reload = () => {} }: { who: FriendProfile; own: boolean; open: Collection[]; reload?: () => void }) {
  const wall = useWall({ person: who, own, open, coverFor, places: [], reload });
  return (
    <>
      <div data-testid="cover" data-src={wall.cover ?? ''} />
      {wall.onCover ? <button type="button" onClick={wall.onCover}>edit</button> : null}
      {wall.sheet}
    </>
  );
}
// react-native-web's Modal leaves on its fade's end.
const settleModal = () => {
  document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
};
const src = () => screen.getByTestId('cover').getAttribute('data-src');
const previewSrc = () => screen.getByTestId('wall-preview').querySelector('img')?.getAttribute('src');

beforeEach(() => {
  st.city = { id: 'hcmc', hero_photo_uri: 'https://city/hcmc.jpg', hero_place_slug: null };
  st.cities = [city('hcmc'), city('hanoi', { hero_photo_uri: null, hero_place_slug: 'west-lake' }), city('bare', { hero_photo_uri: null })];
  st.photosAsked = [];
  st.photos = { 'west-lake': [{ photo_uri: 'https://lake.jpg', is_cover: true, is_hidden: false, sort_order: 0 }] };
  st.saved = [];
  st.fail = false;
  st.alerts = [];
});

describe('the cover the page wears', () => {
  it('is automatic with nothing chosen: the second public list, not the first card under it', () => {
    render(<Page who={person()} own={false} open={[list('a', 'https://a.jpg'), list('b', 'https://b.jpg')]} />);
    expect(src()).toBe('https://b.jpg');
  });

  it('is the city on screen for a person with one list', () => {
    render(<Page who={person()} own={false} open={[list('a', 'https://a.jpg')]} />);
    expect(src()).toBe('https://city/hcmc.jpg');
  });

  it('is the chosen list\'s cover, and automatic once that list is not public', () => {
    const open = [list('a', 'https://a.jpg'), list('b', 'https://b.jpg')];
    const { rerender } = render(<Page who={person({ wall_kind: 'collection', wall_ref: 'a' })} own={false} open={open} />);
    expect(src()).toBe('https://a.jpg');
    rerender(<Page who={person({ wall_kind: 'collection', wall_ref: 'gone' })} own={false} open={open} />);
    expect(src()).toBe('https://b.jpg');
  });

  it('is the upload\'s own address', () => {
    render(<Page who={person({ wall_kind: 'upload', wall_ref: 'https://up/wall.jpg?v=1' })} own={false} open={[]} />);
    expect(src()).toBe('https://up/wall.jpg?v=1');
  });

  it('fetches a chosen city\'s hero place only when it has no photograph of its own', async () => {
    render(<Page who={person({ wall_kind: 'city', wall_ref: 'hanoi' })} own={false} open={[]} />);
    await waitFor(() => expect(src()).toBe('https://lake.jpg'));
    expect(st.photosAsked).toEqual([['west-lake']]);
  });

  it('asks for nothing on a page whose cover is not a city, until a sheet opens', () => {
    render(<Page who={person()} own={false} open={[]} />);
    expect(st.photosAsked).toEqual([]);
  });

  it('offers no way to change it on somebody else\'s page', () => {
    render(<Page who={person()} own={false} open={[]} />);
    expect(screen.queryByText('edit')).toBeNull();
    expect(screen.queryByTestId('wall-sheet')).toBeNull();
  });
});

describe('the sheet on your own page', () => {
  const open = [list('a', 'https://a.jpg'), list('b', 'https://b.jpg'), list('c')];

  it('offers automatic, every city with a picture, and your public lists with a cover', async () => {
    render(<Page who={person()} own open={open} />);
    fireEvent.click(screen.getByText('edit'));
    await waitFor(() => expect(screen.getByTestId('wall-tile-city-hanoi')).toBeTruthy());
    expect(screen.getByTestId('wall-auto')).toBeTruthy();
    expect(screen.getByTestId('wall-tile-city-hcmc')).toBeTruthy();
    // No picture of its own and no hero: not offered as grey.
    expect(screen.queryByTestId('wall-tile-city-bare')).toBeNull();
    expect(screen.getByTestId('wall-tile-collection-a')).toBeTruthy();
    expect(screen.getByTestId('wall-tile-collection-b')).toBeTruthy();
    expect(screen.queryByTestId('wall-tile-collection-c')).toBeNull();
    expect(screen.getByRole('button', { name: 'T-a' })).toBeTruthy();
  });

  it('has no row of lists for somebody with none to offer', () => {
    render(<Page who={person()} own open={[]} />);
    fireEvent.click(screen.getByText('edit'));
    expect(screen.queryByTestId('wall-lists')).toBeNull();
  });

  it('previews a tap without saving it, and saves only what differs', async () => {
    render(<Page who={person()} own open={open} />);
    fireEvent.click(screen.getByText('edit'));
    expect(previewSrc()).toBe('https://b.jpg');
    expect(screen.getByTestId('wall-save').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByTestId('wall-tile-city-hcmc'));
    expect(previewSrc()).toBe('https://city/hcmc.jpg');
    expect(screen.getByTestId('wall-tile-city-hcmc').getAttribute('aria-selected')).toBe('true');
    expect(st.saved).toEqual([]);
    expect(screen.getByTestId('wall-save').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('writes the choice and reads the page again on Save', async () => {
    const reload = vi.fn();
    render(<Page who={person()} own open={open} reload={reload} />);
    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByTestId('wall-tile-collection-a'));
    await act(async () => { fireEvent.click(screen.getByTestId('wall-save')); });
    expect(st.saved).toEqual([{ wall_kind: 'collection', wall_ref: 'a' }]);
    expect(reload).toHaveBeenCalledTimes(1);
    settleModal();
    expect(screen.queryByTestId('wall-preview')).toBeNull();
  });

  it('goes back to automatic as two nulls', async () => {
    render(<Page who={person({ wall_kind: 'city', wall_ref: 'hcmc' })} own open={open} />);
    fireEvent.click(screen.getByText('edit'));
    expect(screen.getByTestId('wall-tile-city-hcmc').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('wall-auto'));
    await act(async () => { fireEvent.click(screen.getByTestId('wall-save')); });
    expect(st.saved).toEqual([{ wall_kind: null, wall_ref: null }]);
  });

  it('says so when the save fails, and stays open', async () => {
    st.fail = true;
    const reload = vi.fn();
    render(<Page who={person()} own open={open} reload={reload} />);
    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByTestId('wall-tile-city-hcmc'));
    await act(async () => { fireEvent.click(screen.getByTestId('wall-save')); });
    expect(st.alerts).toEqual(['Couldn\'t save the cover. Try again.']);
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByTestId('wall-preview')).toBeTruthy();
  });

  it('closes on × without saving, and opens again on what is worn', () => {
    render(<Page who={person()} own open={open} />);
    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByTestId('wall-tile-city-hcmc'));
    fireEvent.click(screen.getByTestId('wall-close'));
    settleModal();
    expect(screen.queryByTestId('wall-preview')).toBeNull();
    fireEvent.click(screen.getByText('edit'));
    expect(screen.getByTestId('wall-auto').getAttribute('aria-selected')).toBe('true');
    expect(st.saved).toEqual([]);
  });
});
