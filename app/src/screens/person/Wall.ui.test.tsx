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
  picked: null as string | null,
  uploaded: [] as string[],
  uploadFail: null as string | null,
}));
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: async () => (st.picked ? { canceled: false, assets: [{ uri: st.picked }] } : { canceled: true, assets: [] }),
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
    setWallPhoto: async (uri: string) => { if (st.uploadFail) throw new Error(st.uploadFail); st.uploaded.push(uri); },
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
      <div data-testid="cover" data-src={wall.cover ?? ''} data-trying={String(wall.trying)} />
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
const trying = () => screen.getByTestId('cover').getAttribute('data-trying');
const sheetOpen = () => !!screen.queryByTestId('wall-sheet');

beforeEach(() => {
  st.city = { id: 'hcmc', hero_photo_uri: 'https://city/hcmc.jpg', hero_place_slug: null };
  st.cities = [city('hcmc'), city('hanoi', { hero_photo_uri: null, hero_place_slug: 'west-lake' }), city('bare', { hero_photo_uri: null })];
  st.photosAsked = [];
  st.photos = { 'west-lake': [{ photo_uri: 'https://lake.jpg', is_cover: true, is_hidden: false, sort_order: 0 }] };
  st.saved = [];
  st.fail = false;
  st.alerts = [];
  st.picked = null;
  st.uploaded = [];
  st.uploadFail = null;
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

  // The page is the preview (owner, 21 Nov 2026): a tap puts the picture
  // on the cover itself, said to be a trial, and saves nothing.
  it('tries a tap on the page\'s own cover without saving it, and saves only what differs', async () => {
    render(<Page who={person()} own open={open} />);
    fireEvent.click(screen.getByText('edit'));
    expect(src()).toBe('https://b.jpg');
    expect(trying()).toBe('false');
    expect(screen.getByTestId('wall-save').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByTestId('wall-tile-city-hcmc'));
    expect(src()).toBe('https://city/hcmc.jpg');
    expect(trying()).toBe('true');
    expect(screen.getByTestId('wall-tile-city-hcmc').getAttribute('aria-selected')).toBe('true');
    expect(st.saved).toEqual([]);
    expect(screen.getByTestId('wall-save').getAttribute('aria-disabled')).not.toBe('true');
    // Back to what is saved: no longer a trial, nothing to save.
    fireEvent.click(screen.getByTestId('wall-auto'));
    expect(src()).toBe('https://b.jpg');
    expect(trying()).toBe('false');
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
    expect(sheetOpen()).toBe(false);
    // Kept on the cover until the page reads itself again, with no trial
    // left to announce.
    expect(src()).toBe('https://a.jpg');
    expect(trying()).toBe('false');
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
    expect(sheetOpen()).toBe(true);
    expect(src()).toBe('https://city/hcmc.jpg');
  });

  it('closes on × without saving, the cover back as it was, and opens again on what is worn', () => {
    render(<Page who={person()} own open={open} />);
    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByTestId('wall-tile-city-hcmc'));
    expect(src()).toBe('https://city/hcmc.jpg');
    fireEvent.click(screen.getByTestId('wall-close'));
    settleModal();
    expect(sheetOpen()).toBe(false);
    expect(src()).toBe('https://b.jpg');
    expect(trying()).toBe('false');
    fireEvent.click(screen.getByText('edit'));
    expect(screen.getByTestId('wall-auto').getAttribute('aria-selected')).toBe('true');
    expect(st.saved).toEqual([]);
  });

  it('lets the cover go once the page says the same as was saved', async () => {
    const open2 = [list('a', 'https://a.jpg'), list('b', 'https://b.jpg')];
    const { rerender } = render(<Page who={person()} own open={open2} />);
    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByTestId('wall-tile-collection-a'));
    await act(async () => { fireEvent.click(screen.getByTestId('wall-save')); });
    settleModal();
    // The page read again, now saying the list; then a change made
    // elsewhere is shown, not held over by the old look.
    rerender(<Page who={person({ wall_kind: 'collection', wall_ref: 'a' })} own open={open2} />);
    rerender(<Page who={person({ wall_kind: 'city', wall_ref: 'hcmc' })} own open={open2} />);
    expect(src()).toBe('https://city/hcmc.jpg');
  });
});

describe('a photograph of your own', () => {
  it('uploads the one picked at once, and reads the page again', async () => {
    st.picked = 'file:///street.jpg';
    const reload = vi.fn();
    render(<Page who={person()} own open={[]} reload={reload} />);
    fireEvent.click(screen.getByText('edit'));
    // Nothing of yours to offer back yet.
    expect(screen.queryByTestId('wall-tile-upload')).toBeNull();
    // A look tried first is not what the upload leaves on the cover.
    fireEvent.click(screen.getByTestId('wall-tile-city-hcmc'));
    await act(async () => { fireEvent.click(screen.getByTestId('wall-upload')); });
    expect(st.uploaded).toEqual(['file:///street.jpg']);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(trying()).toBe('false');
    expect(st.saved).toEqual([]);
  });

  it('does nothing when the library is closed without a choice', async () => {
    const reload = vi.fn();
    render(<Page who={person()} own open={[]} reload={reload} />);
    fireEvent.click(screen.getByText('edit'));
    await act(async () => { fireEvent.click(screen.getByTestId('wall-upload')); });
    expect(st.uploaded).toEqual([]);
    expect(reload).not.toHaveBeenCalled();
  });

  it('says why an upload failed, in the account\'s words for it', async () => {
    st.picked = 'file:///again.jpg';
    st.uploadFail = 'too_soon';
    render(<Page who={person()} own open={[]} />);
    fireEvent.click(screen.getByText('edit'));
    await act(async () => { fireEvent.click(screen.getByTestId('wall-upload')); });
    expect(st.alerts).toHaveLength(1);
    expect(st.alerts[0]).not.toBe('too_soon');
  });

  it('offers the upload worn back as a tile, ticked', () => {
    const up = 'https://up/wall.jpg?v=1';
    render(<Page who={person({ wall_kind: 'upload', wall_ref: up })} own open={[]} />);
    fireEvent.click(screen.getByText('edit'));
    const tile = screen.getByTestId('wall-tile-upload');
    expect(tile.getAttribute('aria-selected')).toBe('true');
    expect(tile.querySelector('img')!.getAttribute('src')).toBe(up);
  });
});

