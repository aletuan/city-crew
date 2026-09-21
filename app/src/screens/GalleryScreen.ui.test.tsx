// @vitest-environment jsdom
//
// The gallery, kept by its guide, rendered for real.
//
// What is pinned: that the screen reads the gallery through its own query
// and draws every row in `sort_order`, hidden ones included; that a tile
// wears the badge its row says; that every tile opens the same menu,
// whoever's photograph it is; that each menu row reaches the write it
// names and the screen reads back afterwards; that deleting asks first;
// that the choice mode ticks any tile; that the header pill runs the
// upload; and that a stranger is refused before anything is read.
//
// The boundary itself is `lib/gallery`'s and is tested there; the writes
// are `lib/data/gallery`'s and are tested there. This is the screen
// proving it asked them.

import React from 'react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '../uitest/render';
import type { GalleryPhoto } from '../lib/gallery';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';

// A phone's width, so the cell arithmetic has something to divide.
vi.hoisted(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
});

const state = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  guide: true,
  catalog: { loading: false, data: [] as unknown[] },
  elsewhere: { loading: false, data: null as unknown },
  rows: [] as GalleryPhoto[],
  picked: true,
}));
const data = vi.hoisted(() => ({
  reload: vi.fn(),
  fetchPlaceId: vi.fn(async () => 'place-uuid'),
  fetchGallery: vi.fn(async () => state.rows),
  setCover: vi.fn(async () => {}),
  setHidden: vi.fn(async () => {}),
  reorderGallery: vi.fn(async () => {}),
  removePlacePhoto: vi.fn(async (_id: string) => {}),
  fetchMyPhotoCounts: vi.fn(async () => ({ mineHere: 0, mineToday: 0 })),
  addPlacePhoto: vi.fn(async (_row: unknown) => 'photo-new'),
  uploaded: vi.fn((_path: string) => {}),
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/useGuideGrant', () => ({ useIsGuide: () => state.guide }));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
}));
vi.mock('../lib/catalog', () => ({
  usePlaces: () => ({ ...state.catalog, reload: data.reload }),
}));
vi.mock('../lib/data', () => ({
  usePlaceBySlug: () => state.elsewhere,
  fetchPlaceId: data.fetchPlaceId,
  fetchGallery: data.fetchGallery,
  setCover: data.setCover,
  setHidden: data.setHidden,
  reorderGallery: data.reorderGallery,
  removePlacePhoto: data.removePlacePhoto,
  fetchMyPhotoCounts: data.fetchMyPhotoCounts,
  addPlacePhoto: data.addPlacePhoto,
}));
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string) => { data.uploaded(path); return Promise.resolve({ error: null }); },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `http://cdn/${path}` } }),
      }),
    },
  },
}));
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: () => Promise.resolve(
    state.picked
      ? { canceled: false, assets: [{ uri: 'file://roll/IMG_1.HEIC' }] }
      : { canceled: true, assets: [] },
  ),
}));
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: () => Promise.resolve({ base64: 'AAAA' }),
  SaveFormat: { JPEG: 'jpeg' },
}));
vi.mock('base64-arraybuffer', () => ({ decode: () => new ArrayBuffer(4) }));

import GalleryScreen from './GalleryScreen';

// react-native-web's `Alert` is a silent no-op; what the reader is told is
// read off the spy.
const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'cong-caphe',
  name_en: 'Cộng Cà Phê - Old Quarter',
  name_vi: 'Cộng Cà Phê - Phố Cổ',
  name_ja: null,
  submitted_by: 'u1',
  place_photos: [],
  ...over,
} as unknown as Place);

const photo = (id: string, over: Partial<GalleryPhoto> = {}): GalleryPhoto => ({
  id, photo_uri: `http://cdn/${id}.jpg`, is_cover: false, is_hidden: false, sort_order: 0,
  source: 'google', ...over,
});
const mine = (id: string, over: Partial<GalleryPhoto> = {}) => photo(id, { source: 'upload', ...over });

const nav = () => ({ navigate: vi.fn(), goBack: vi.fn() }) as unknown as Nav;
const route = (slug = 'cong-caphe') => ({ params: { slug } }) as RootRoute<'Gallery'>;

const show = (rows: GalleryPhoto[], p: Place | null = place()) => {
  state.rows = rows;
  state.catalog = { loading: false, data: p ? [p] : [] };
  const n = nav();
  render(<GalleryScreen navigation={n} route={route()} />);
  return n;
};
const grid = () => screen.findByTestId('gallery-grid');
/** The tiles, in the order the grid draws them. */
const tileIds = () => [...screen.getByTestId('gallery-grid').querySelectorAll('[data-testid^="gallery-tile-"]')]
  .map((el) => el.getAttribute('data-testid')!.replace('gallery-tile-', ''));
/** Opens the ⋯ menu on a tile and presses the row named. */
const pick = async (id: string, name: string) => {
  fireEvent.click(screen.getByTestId(`gallery-tile-${id}`));
  fireEvent.click(await screen.findByRole('button', { name }));
};
/** Presses the destructive button of the last confirmation raised. */
const confirmLast = () => {
  const buttons = alert.mock.calls.at(-1)![2] as { style?: string; onPress?: () => void }[];
  buttons.find((b) => b.style === 'destructive')!.onPress!();
};

beforeEach(() => {
  state.uid = 'u1';
  state.guide = true;
  state.elsewhere = { loading: false, data: null };
  state.picked = true;
  for (const fn of Object.values(data)) fn.mockClear();
  alert.mockClear();
});
afterEach(cleanup);

describe('the read', () => {
  it('reads by the place’s id and draws every row in sort order, hidden ones included', async () => {
    show([photo('b', { sort_order: 1 }), photo('a', { sort_order: 0 }), mine('c', { sort_order: 2, is_hidden: true })]);
    await grid();
    expect(data.fetchPlaceId).toHaveBeenCalledWith('cong-caphe');
    expect(data.fetchGallery).toHaveBeenCalledWith('place-uuid');
    expect(tileIds()).toEqual(['a', 'b', 'c']);
    expect(within(screen.getByTestId('gallery-tile-c')).getByTestId('gallery-hidden')).toBeTruthy();
    expect(screen.getByText('Cộng Cà Phê')).toBeTruthy();
  });

  it('wears the cover badge on the cover, wherever it sits', async () => {
    show([photo('a', { sort_order: 0 }), photo('b', { sort_order: 1, is_cover: true })]);
    await grid();
    expect(within(screen.getByTestId('gallery-tile-b')).getByTestId('gallery-cover')).toBeTruthy();
    expect(within(screen.getByTestId('gallery-tile-a')).queryByTestId('gallery-cover')).toBeNull();
    // Not moved to the front: the gallery is the list "Reorder" edits.
    expect(tileIds()).toEqual(['a', 'b']);
  });

  // No boundary between kinds: an upload and a Google row wear the same
  // ⋯, and nothing on the tile says whose it is.
  it('offers the menu on every tile alike', async () => {
    show([mine('d'), photo('g', { sort_order: 1 })]);
    await grid();
    expect(screen.getByTestId('gallery-more-d')).toBeTruthy();
    expect(screen.getByTestId('gallery-more-g')).toBeTruthy();
    expect(screen.queryByText('Desk')).toBeNull();
  });

  it('invites the first photo when there is none', async () => {
    show([]);
    expect(await screen.findByText(/No photos yet/)).toBeTruthy();
    expect(screen.queryByTestId('gallery-tools')).toBeNull();
  });

  // A place still waiting at the desk is not in the catalog, and is
  // exactly where this screen is most useful.
  it('reads a place the catalog does not have by its own fetch', async () => {
    state.elsewhere = { loading: false, data: place() };
    show([mine('m')], null);
    await grid();
    expect(tileIds()).toEqual(['m']);
  });

  it('says so when the read fails, rather than drawing an empty gallery', async () => {
    data.fetchGallery.mockRejectedValueOnce(new Error('offline'));
    show([mine('m')]);
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toBe('That did not work');
    expect(alert.mock.calls[0][1]).toBe('offline');
  });
});

describe('who may keep it', () => {
  // The door is drawn for the keeper alone, but a route can be typed.
  it('refuses a person without the grant before reading anything', async () => {
    state.guide = false;
    show([mine('m')]);
    expect(await screen.findByText('This is not yours to keep.')).toBeTruthy();
    expect(data.fetchGallery).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Add a photo' })).toBeNull();
  });

  it('refuses the keeper of a different place', async () => {
    show([mine('m')], place({ submitted_by: 'u2' }));
    expect(await screen.findByText('This is not yours to keep.')).toBeTruthy();
    expect(data.fetchGallery).not.toHaveBeenCalled();
  });

  it('draws nothing but the header while the place is still loading', () => {
    state.catalog = { loading: true, data: [] };
    render(<GalleryScreen navigation={nav()} route={route()} />);
    expect(screen.queryByTestId('gallery-grid')).toBeNull();
    expect(screen.queryByText('This is not yours to keep.')).toBeNull();
  });

  it('goes back from the header', async () => {
    const n = show([mine('m')]);
    await grid();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(n.goBack).toHaveBeenCalled();
  });
});

describe('the menu on one photograph', () => {
  // Every write, the same way: do it, read the gallery back, tell the
  // catalog — so the detail screen behind this one draws the new cover.
  it('sets the cover, then reads back and tells the catalog', async () => {
    show([photo('a'), mine('m', { sort_order: 1 })]);
    await grid();
    await pick('a', 'Make it the cover');
    await waitFor(() => expect(data.setCover).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(data.fetchGallery).toHaveBeenCalledTimes(2));
    expect(data.reload).toHaveBeenCalled();
  });

  it('does not offer to set the cover on the cover', async () => {
    show([mine('m', { is_cover: true })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-tile-m'));
    expect(await screen.findByRole('button', { name: 'Hide it' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Make it the cover' })).toBeNull();
  });

  it('hides through guide_set_hidden', async () => {
    show([photo('a')]);
    await grid();
    await pick('a', 'Hide it');
    await waitFor(() => expect(data.setHidden).toHaveBeenCalledWith('a', true));
  });

  // No veto: hidden by anybody, the way back is offered. A hidden
  // photograph offers that and delete, not the cover.
  it('shows a hidden photograph again, whoever hid it', async () => {
    show([photo('a', { is_hidden: true })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-tile-a'));
    expect(await screen.findByRole('button', { name: 'Show it again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Make it the cover' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete it' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show it again' }));
    await waitFor(() => expect(data.setHidden).toHaveBeenCalledWith('a', false));
  });

  // A Google row can be deleted like any other; the sheet says where it
  // came from, and that is all the source is for.
  it('offers delete on a Google photograph too, and says where it came from', async () => {
    show([photo('a')]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-tile-a'));
    expect(await screen.findByRole('button', { name: 'Delete it' })).toBeTruthy();
    expect(screen.getByText('From Google')).toBeTruthy();
  });

  it('asks before deleting, and removes on yes', async () => {
    show([mine('m')]);
    await grid();
    await pick('m', 'Delete it');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls.at(-1)![0]).toBe('Delete this photo?');
    expect(data.removePlacePhoto).not.toHaveBeenCalled();
    confirmLast();
    await waitFor(() => expect(data.removePlacePhoto).toHaveBeenCalledWith('m'));
    await waitFor(() => expect(data.fetchGallery).toHaveBeenCalledTimes(2));
  });

  it('says so when a write is refused', async () => {
    data.setCover.mockRejectedValueOnce(new Error('not yours to set'));
    show([photo('a')]);
    await grid();
    await pick('a', 'Make it the cover');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls.at(-1)![1]).toBe('not yours to set');
  });
});

describe('choosing several', () => {
  it('ticks any tile, untick included, and deletes the ticked after asking', async () => {
    show([mine('m1', { sort_order: 0 }), photo('g', { sort_order: 1 }), mine('m2', { sort_order: 2 })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-select'));
    // Every tile has a tick; the menu is gone while choosing.
    expect(screen.getByTestId('gallery-tick-g')).toBeTruthy();
    expect(screen.queryByTestId('gallery-more-g')).toBeNull();
    fireEvent.click(screen.getByTestId('gallery-tile-m1'));
    fireEvent.click(screen.getByTestId('gallery-tile-g'));
    fireEvent.click(screen.getByTestId('gallery-tile-m2'));
    fireEvent.click(screen.getByTestId('gallery-tile-m1'));
    expect(screen.getByRole('button', { name: 'Delete 2' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('gallery-delete-picked'));
    expect(alert.mock.calls.at(-1)![0]).toBe('Delete 2 photos?');
    confirmLast();
    await waitFor(() => expect(data.removePlacePhoto).toHaveBeenCalledTimes(2));
    expect(data.removePlacePhoto.mock.calls.map((c) => c[0])).toEqual(['g', 'm2']);
    await waitFor(() => expect(screen.queryByTestId('gallery-delete-picked')).toBeNull());
  });

  it('asks nothing with nothing ticked', async () => {
    show([mine('m')]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-select'));
    fireEvent.click(screen.getByTestId('gallery-delete-picked'));
    expect(alert).not.toHaveBeenCalled();
  });

  it('backs out on cancel with nothing written', async () => {
    show([photo('a')]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-select'));
    fireEvent.click(screen.getByTestId('gallery-tile-a'));
    fireEvent.click(screen.getByTestId('gallery-cancel'));
    expect(screen.queryByTestId('gallery-tick-a')).toBeNull();
    expect(screen.getByTestId('gallery-more-a')).toBeTruthy();
    expect(data.removePlacePhoto).not.toHaveBeenCalled();
  });
});

describe('adding one', () => {
  it('runs the upload from the header, past everything already there, and reads back', async () => {
    show([photo('a'), photo('b', { sort_order: 1 })]);
    await grid();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await waitFor(() => expect(data.addPlacePhoto).toHaveBeenCalled());
    // Namespaced by uid, so one person's uploads cannot collide with
    // another's and the storage policy can read the first path segment.
    expect(data.uploaded.mock.calls[0][0]).toMatch(/^u1\/cong-caphe-\d+\.jpg$/);
    expect(data.addPlacePhoto.mock.calls[0][0]).toMatchObject({
      placeId: 'place-uuid', uid: 'u1', sortOrder: 3,
      publicUrl: expect.stringContaining('u1/cong-caphe-'),
    });
    await waitFor(() => expect(data.fetchGallery).toHaveBeenCalledTimes(2));
    expect(data.reload).toHaveBeenCalled();
  });

  it('writes nothing when the picker is dismissed', async () => {
    state.picked = false;
    show([]);
    await screen.findByText(/No photos yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(data.uploaded).not.toHaveBeenCalled();
    expect(data.addPlacePhoto).not.toHaveBeenCalled();
  });

  // The rules a menu cannot show, because they are about what it does
  // not offer.
  it('explains the boundary once, at the bottom', async () => {
    show([mine('m')]);
    await grid();
    expect(screen.getByText(/The last change is the one that counts/)).toBeTruthy();
    expect(screen.getByText(/JPG or PNG, up to 5 of yours/)).toBeTruthy();
  });
});
