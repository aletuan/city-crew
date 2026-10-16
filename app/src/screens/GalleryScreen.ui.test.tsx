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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '../uitest/render';
import type { GalleryPhoto } from '../lib/gallery';
import type { PhotoScore, Reading, ScorerKey } from '../lib/photoScore';
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
  editor: false,
  catalog: { loading: false, data: [] as unknown[] },
  elsewhere: { loading: false, data: null as unknown },
  rows: [] as GalleryPhoto[],
  picked: true,
  /** How many the roll hands back when `picked`. */
  pickedCount: 1,
}));
const data = vi.hoisted(() => ({
  reload: vi.fn(),
  reloadLists: vi.fn(),
  reloadMine: vi.fn(),
  fetchPlaceId: vi.fn(async () => 'place-uuid'),
  fetchGallery: vi.fn(async () => state.rows),
  setCover: vi.fn(async () => {}),
  setHidden: vi.fn(async () => {}),
  reorderGallery: vi.fn(async () => {}),
  removePlacePhoto: vi.fn(async (_id: string, _path: string | null) => {}),
  savePhotoScore: vi.fn(async (_id: string, _scorer: ScorerKey, _reading: Reading, _uid: string) => {}),
  scoreAsync: vi.fn(async (_uri: string): Promise<Reading> => ({ aesthetic: 0.5, isUtility: false, signals: {} })),
  removePhotoFile: vi.fn(async (_path: string) => {}),
  fetchMyPhotoCounts: vi.fn(async () => ({ mineHere: 0, mineToday: 0 })),
  addPlacePhoto: vi.fn(async (_row: unknown) => 'photo-new'),
  uploaded: vi.fn((_path: string) => {}),
  picker: vi.fn(),
}));
// The two slow steps, held open by a test that wants to look at the
// screen between them; by default each settles on its own. Outside
// `data`, whose every member is a mock to be cleared.
const gates = vi.hoisted(() => ({
  shrink: { hold: false, release: () => {} },
  upload: { hold: false, release: () => {} },
}));
const gate = (g: { hold: boolean; release: () => void }) =>
  g.hold ? new Promise<void>((r) => { g.release = r; }) : Promise.resolve();

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
// The Vision module, present or not as a test says. A getter, so the
// screen reads whichever the test set when it renders.
const native = vi.hoisted(() => ({ present: true }));
vi.mock('../lib/photoScoreNative', () => ({
  get photoScorer() {
    // A version the shown scorer does not have, so a test can tell the
    // row was stamped by the scorer that read and not by a constant.
    return native.present ? { id: 'apple-vision', version: 7, read: (uri: string) => data.scoreAsync(uri) } : null;
  },
}));
vi.mock('../lib/useGuideGrant', () => ({ useIsGuide: () => state.guide, useIsEditor: () => state.editor }));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }),
}));
vi.mock('../lib/catalog', () => ({
  usePlaces: () => ({ ...state.catalog, reload: data.reload }),
  useCollections: () => ({ reload: data.reloadLists }),
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({ mine: { reload: data.reloadMine } }),
}));
vi.mock('../lib/data', () => ({
  usePlaceBySlug: () => state.elsewhere,
  fetchPlaceId: data.fetchPlaceId,
  fetchGallery: data.fetchGallery,
  setCover: data.setCover,
  setHidden: data.setHidden,
  reorderGallery: data.reorderGallery,
  removePlacePhoto: data.removePlacePhoto,
  savePhotoScore: data.savePhotoScore,
  removePhotoFile: data.removePhotoFile,
  fetchMyPhotoCounts: data.fetchMyPhotoCounts,
  addPlacePhoto: data.addPlacePhoto,
  uploadPlacePhoto: async (path: string) => { data.uploaded(path); await gate(gates.upload); return `http://cdn/${path}`; },
}));
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (opts: unknown) => {
    data.picker(opts);
    return Promise.resolve(
      state.picked
        ? { canceled: false, assets: Array.from({ length: state.pickedCount }, (_, i) => ({ uri: `file://roll/IMG_${i + 1}.HEIC` })) }
        : { canceled: true, assets: [] },
    );
  },
}));
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: async () => { await gate(gates.shrink); return { base64: 'AAAA' }; },
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
  source: 'google', storage_path: `cong-caphe/${id}.jpg`, ...over,
});
const mine = (id: string, over: Partial<GalleryPhoto> = {}) =>
  photo(id, { source: 'upload', storage_path: `u1/cong-caphe-${id}.jpg`, ...over });

const nav = () => ({ navigate: vi.fn(), goBack: vi.fn() }) as unknown as Nav;
const route = (slug = 'cong-caphe') => ({ params: { slug } }) as RootRoute<'Gallery'>;

const show = (rows: GalleryPhoto[], p: Place | null = place()) => {
  state.rows = rows;
  state.catalog = { loading: false, data: p ? [p] : [] };
  const n = nav();
  render(<GalleryScreen navigation={n} route={route()} />);
  return n;
};
/**
 * The grid, drawn and settled.
 *
 * The header's Add pill is the same node before and after the gallery
 * loads, and react-native-web hands a Pressable its new `onPress` in a
 * passive effect — a beat after the commit `findByTestId` was watching
 * for. A press in that beat runs the handler from the loading render,
 * whose `add` knew no photographs yet, and nothing is uploaded: CI saw
 * exactly that once. One drained `act` and the pill wears the handler
 * the screen is showing — the same settling `SignUpScreen`'s `reach`
 * does (#627).
 */
const grid = async () => {
  const g = await screen.findByTestId('gallery-grid');
  await act(async () => {});
  return g;
};
/** The empty note, drawn and settled — the same beat as `grid`, for the
 *  same reason. The one test that pressed Add straight after finding the
 *  note went red in CI's coverage pass (the slowest of the three) with
 *  the loading render's handler: no place id yet, "place_not_found",
 *  and the waiting tile never came. */
const emptyNote = async () => {
  const e = await screen.findByText(/No photos yet/);
  await act(async () => {});
  return e;
};
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
  gates.shrink = { hold: false, release: () => {} };
  gates.upload = { hold: false, release: () => {} };
  state.uid = 'u1';
  state.editor = false;
  state.guide = true;
  state.elsewhere = { loading: false, data: null };
  state.picked = true;
  state.pickedCount = 1;
  native.present = true;
  for (const fn of Object.values(data)) fn.mockClear();
  data.scoreAsync.mockReset().mockResolvedValue({ aesthetic: 0.5, isUtility: false, signals: {} });
  data.savePhotoScore.mockReset().mockResolvedValue(undefined);
  data.fetchMyPhotoCounts.mockReset().mockResolvedValue({ mineHere: 0, mineToday: 0 });
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

  // No boundary between kinds: an upload and a Google row open the same
  // way, and nothing on the tile says whose it is. No ⋯ on any tile: a
  // tap is the way in (owner, 16 Oct 2026).
  it('opens every tile alike, and marks none with a ⋯', async () => {
    show([mine('d'), photo('g', { sort_order: 1 })]);
    await grid();
    expect(screen.getByTestId('gallery-grid').querySelector('[data-icon="ellipsis-horizontal"]')).toBeNull();
    expect(screen.queryByText('Desk')).toBeNull();
    fireEvent.click(screen.getByTestId('gallery-tile-g'));
    expect(await screen.findByTestId('photo-sheet')).toBeTruthy();
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

  // The desk's hand: an editor who is no guide, on a place somebody else
  // imported, keeps the gallery — reads it, and may add to it.
  it('opens for an editor on anybody\u2019s place, grant or no grant', async () => {
    state.guide = false;
    state.editor = true;
    show([mine('m')], place({ submitted_by: 'u2' }));
    await waitFor(() => expect(data.fetchGallery).toHaveBeenCalled());
    expect(screen.queryByText('This is not yours to keep.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeTruthy();
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
  // catalog — so the detail screen behind this one draws the new cover —
  // and both shelves of lists, which carry the place's photographs in
  // their own copy of it (owner, 15 Oct 2026: a collection kept the old
  // cover until navigated away and back).
  it('sets the cover, then reads back and tells the catalog and the lists', async () => {
    show([photo('a'), mine('m', { sort_order: 1 })]);
    await grid();
    await pick('a', 'Make it the cover');
    await waitFor(() => expect(data.setCover).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(data.fetchGallery).toHaveBeenCalledTimes(2));
    expect(data.reload).toHaveBeenCalled();
    expect(data.reloadLists).toHaveBeenCalledTimes(1);
    expect(data.reloadMine).toHaveBeenCalledTimes(1);
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
    // A hidden cover leaves a list's tile too.
    await waitFor(() => expect(data.reloadLists).toHaveBeenCalledTimes(1));
    expect(data.reloadMine).toHaveBeenCalledTimes(1);
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

  // The picture is the sheet's subject: the one tapped, large, and named
  // by its place in the gallery.
  it('opens the photograph tapped, large, at its place in the gallery', async () => {
    show([photo('a'), photo('b', { sort_order: 1 }), photo('c', { sort_order: 2 })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-tile-b'));
    const frame = await screen.findByTestId('photo-sheet-frame');
    expect(frame.querySelector('img')!.getAttribute('src')).toBe('http://cdn/b.jpg');
    expect(screen.getByTestId('photo-sheet').textContent).toContain('Photo 2/3');
  });

  // Coming back to the grid, the guide finds where they were.
  it('rings the tile last opened, once its sheet has closed, and not while choosing', async () => {
    show([photo('a'), photo('b', { sort_order: 1 })]);
    await grid();
    // The tile's look is on the pressable's inner view, its first child.
    const ringed = (id: string) =>
      getComputedStyle(screen.getByTestId(`gallery-tile-${id}`).firstElementChild!).borderTopWidth === '2.5px';
    expect(ringed('a')).toBe(false);
    fireEvent.click(screen.getByTestId('gallery-tile-b'));
    fireEvent.click(await screen.findByTestId('photo-sheet-close'));
    expect(ringed('b')).toBe(true);
    expect(ringed('a')).toBe(false);
    fireEvent.click(screen.getByTestId('gallery-select'));
    expect(ringed('b')).toBe(false);
  });

  it('asks before deleting, and removes on yes', async () => {
    show([mine('m')]);
    await grid();
    await pick('m', 'Delete it');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls.at(-1)![0]).toBe('Delete this photo?');
    expect(data.removePlacePhoto).not.toHaveBeenCalled();
    confirmLast();
    // The row's id and its file's path, so the bucket is cleared with it.
    await waitFor(() => expect(data.removePlacePhoto).toHaveBeenCalledWith('m', 'u1/cong-caphe-m.jpg'));
    await waitFor(() => expect(data.fetchGallery).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(data.reloadLists).toHaveBeenCalledTimes(1));
    expect(data.reloadMine).toHaveBeenCalledTimes(1);
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
    // Every tile has a tick, and a tap is a tick, not the photograph.
    expect(screen.getByTestId('gallery-tick-g')).toBeTruthy();
    fireEvent.click(screen.getByTestId('gallery-tile-m1'));
    fireEvent.click(screen.getByTestId('gallery-tile-g'));
    fireEvent.click(screen.getByTestId('gallery-tile-m2'));
    fireEvent.click(screen.getByTestId('gallery-tile-m1'));
    expect(screen.queryByTestId('photo-sheet')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete 2' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('gallery-delete-picked'));
    expect(alert.mock.calls.at(-1)![0]).toBe('Delete 2 photos?');
    confirmLast();
    await waitFor(() => expect(data.removePlacePhoto).toHaveBeenCalledTimes(2));
    expect(data.removePlacePhoto.mock.calls).toEqual([['g', 'cong-caphe/g.jpg'], ['m2', 'u1/cong-caphe-m2.jpg']]);
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
    expect(data.removePlacePhoto).not.toHaveBeenCalled();
    // Looking again: a tap opens the photograph.
    fireEvent.click(screen.getByTestId('gallery-tile-a'));
    expect(await screen.findByTestId('photo-sheet')).toBeTruthy();
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
    // A new photograph becomes the cover, so the lists are told too.
    expect(data.reloadLists).toHaveBeenCalledTimes(1);
    expect(data.reloadMine).toHaveBeenCalledTimes(1);
  });

  // Adding took one to three seconds on a phone and the only sign of it
  // was the pill's word turning into "…" — a narrower pill that read as
  // a different button, over a grid that did nothing until the read-back
  // landed (owner, 7 Oct 2026). The pill now keeps its word and its width
  // and goes quiet; the grid grows a waiting tile that names the step it
  // is on, because those are the two steps that actually take the time.
  it('keeps the pill\'s word while adding, locks it, and walks a waiting tile through both steps', async () => {
    gates.shrink.hold = true;
    gates.upload.hold = true;
    show([photo('a')]);
    await grid();
    const pill = screen.getByRole('button', { name: 'Add a photo' });
    fireEvent.click(pill);
    await screen.findByTestId('gallery-uploading');
    expect(screen.getByText('Compressing…')).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
    expect(screen.queryByText('…')).toBeNull();
    expect(pill.getAttribute('aria-disabled')).toBe('true');
    expect(pill.getAttribute('aria-busy')).toBe('true');
    // The pill's plus has made way for its spinner.
    expect(pill.querySelector('[role="progressbar"]')).toBeTruthy();
    // A second tap while it works opens nothing.
    fireEvent.click(pill);
    expect(data.picker).toHaveBeenCalledTimes(1);
    // The tile sits at the end of the grid, the size of a cell.
    const tile = screen.getByTestId('gallery-uploading');
    expect(tile.parentElement).toBe(screen.getByTestId('gallery-grid'));
    expect(tile).toBe(screen.getByTestId('gallery-grid').lastElementChild);
    await act(async () => { gates.shrink.release(); });
    await screen.findByText('Uploading…');
    expect(screen.queryByText('Compressing…')).toBeNull();
    await act(async () => { gates.upload.release(); });
    await waitFor(() => expect(data.addPlacePhoto).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('gallery-uploading')).toBeNull());
    expect(pill.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('shows the waiting tile in place of the empty note while the first photo is on its way', async () => {
    gates.upload.hold = true;
    show([]);
    await emptyNote();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await screen.findByTestId('gallery-uploading');
    expect(screen.queryByText(/No photos yet/)).toBeNull();
    await act(async () => { gates.upload.release(); });
    await waitFor(() => expect(data.addPlacePhoto).toHaveBeenCalled());
  });

  // The third way a file ends up with no row: the storage write landed
  // and the insert was refused. Until 6 Oct 2026 the file simply stayed.
  it('takes the file back out when the row insert is refused', async () => {
    data.addPlacePhoto.mockImplementationOnce(async () => { throw new Error('new row violates row-level security'); });
    show([photo('a')]);
    await grid();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await waitFor(() => expect(data.removePhotoFile).toHaveBeenCalledTimes(1));
    expect(data.removePhotoFile.mock.calls[0][0]).toBe(data.uploaded.mock.calls[0][0]);
    expect(alert).toHaveBeenCalledWith('Could not add your photo', expect.stringMatching(/row-level security/));
  });

  it('leaves the bucket alone when the upload itself fails', async () => {
    gates.upload.hold = false;
    data.addPlacePhoto.mockClear();
    show([photo('a')]);
    await grid();
    // Make the storage write the failing step: the mock calls `uploaded`
    // before it answers, so a throw there is the upload throwing.
    data.uploaded.mockImplementationOnce(() => { throw new Error('bucket full'); });
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not add your photo', 'bucket full'));
    expect(data.removePhotoFile).not.toHaveBeenCalled();
    expect(data.addPlacePhoto).not.toHaveBeenCalled();
  });

  // One trip to the roll for the whole batch (owner, 9 Oct 2026): five
  // photographs used to be five rounds of Add → roll → wait. The roll
  // is asked for as many as the caps still allow, so the refusal the
  // policy would give the sixth is never reached.
  it('asks the roll for several at once, as many as the caps leave room for', async () => {
    data.fetchMyPhotoCounts.mockResolvedValue({ mineHere: 2, mineToday: 0 });
    show([photo('a')]);
    await grid();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await waitFor(() => expect(data.picker).toHaveBeenCalledTimes(1));
    expect(data.picker.mock.calls[0][0]).toMatchObject({ allowsMultipleSelection: true, selectionLimit: 3, orderedSelection: true });
  });

  it('adds every photo picked, in the order picked, with the first picked ending as the cover', async () => {
    state.pickedCount = 3;
    show([photo('a')]);
    await grid();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await waitFor(() => expect(data.addPlacePhoto).toHaveBeenCalledTimes(3));
    // Three files, three paths, none the same.
    expect(new Set(data.uploaded.mock.calls.map((c) => c[0])).size).toBe(3);
    // Past everything already there, in the order the reader picked —
    // and inserted last to first, because the cover trigger lands on the
    // newest row, and the cover should be the one they reached for first.
    expect(data.addPlacePhoto.mock.calls.map((c) => (c[0] as { sortOrder: number }).sortOrder)).toEqual([4, 3, 2]);
    // One read-back for the batch, not one per photo.
    await waitFor(() => expect(data.fetchGallery).toHaveBeenCalledTimes(2));
    expect(data.reload).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('counts the batch on the waiting tile', async () => {
    state.pickedCount = 3;
    gates.upload.hold = true;
    show([photo('a')]);
    await grid();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    expect(await screen.findByText('Uploading… 1/3')).toBeTruthy();
    await act(async () => { gates.upload.release(); });
    expect(await screen.findByText('Uploading… 2/3')).toBeTruthy();
    await act(async () => { gates.upload.release(); });
    expect(await screen.findByText('Uploading… 3/3')).toBeTruthy();
    await act(async () => { gates.upload.release(); });
    await waitFor(() => expect(data.addPlacePhoto).toHaveBeenCalledTimes(3));
  });

  it('keeps the photos that landed, takes back the file of the one that did not, and says how many', async () => {
    state.pickedCount = 3;
    data.addPlacePhoto.mockImplementationOnce(async () => { throw new Error('new row violates row-level security'); });
    show([photo('a')]);
    await grid();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await waitFor(() => expect(data.addPlacePhoto).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not add 1 of 3 photos', expect.stringMatching(/row-level security/)));
    expect(data.removePhotoFile).toHaveBeenCalledTimes(1);
    // The two that landed are read back all the same.
    await waitFor(() => expect(data.fetchGallery).toHaveBeenCalledTimes(2));
  });

  it('writes nothing when the picker is dismissed', async () => {
    state.picked = false;
    show([]);
    await emptyNote();
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
    expect(screen.getByText('Note')).toBeTruthy();
    expect(screen.getByText(/A photo you add becomes the cover/)).toBeTruthy();
    expect(screen.getByText(/The City Crew team can edit these photos too/)).toBeTruthy();
    expect(screen.getByText('You can add up to 5 photos per place.')).toBeTruthy();
    // "The desk" is the team's own name for itself, and the format was
    // never the reader's to mind (owner, 15 Oct 2026).
    expect(screen.queryByText(/desk/i)).toBeNull();
    expect(screen.queryByText(/JPG/)).toBeNull();
  });
});

describe('scoring', () => {
  const read = (aesthetic: number, over: Partial<PhotoScore> = {}): PhotoScore => ({
    scorer: 'apple-vision', scorer_version: 1, aesthetic, is_utility: false, signals: { brightness: 0.5 }, ...over,
  });
  /** Each save lands on the row, as the read-back after a real run would
   *  find it. */
  const landing = () => data.savePhotoScore.mockImplementation(async (id: string, _s: ScorerKey, r: Reading) => {
    state.rows = state.rows.map((p) => (p.id === id ? { ...p, score: read(r.aesthetic) } : p));
  });

  // Every absence of the module reads as null — Expo Go, Android, an
  // older binary, iOS before 18 — and every one means no button.
  it('draws no button where the phone cannot read', async () => {
    native.present = false;
    show([photo('a')]);
    await grid();
    expect(screen.getByTestId('gallery-select')).toBeTruthy();
    expect(screen.queryByTestId('gallery-score')).toBeNull();
  });

  it('offers to score every photo when none has been read', async () => {
    show([photo('a'), photo('b', { sort_order: 1 })]);
    await grid();
    expect(screen.getByTestId('gallery-score').textContent).toBe('Score photos');
    // The scorer's bars; sparkles mean "suggested" in this app.
    expect(screen.getByTestId('gallery-score').querySelector('[data-icon]')).toBeNull();
    expect(within(screen.getByTestId('gallery-score')).getAllByTestId('score-glyph-bar')).toHaveLength(3);
    // Nothing is being read until it is asked.
    expect(screen.queryByTestId('scoring-dialog')).toBeNull();
  });

  // Score once: a read photo is not offered again, and one read by an
  // older version of the scorer, or by another scorer, counts as unread.
  it('offers only the photos not yet read by this scorer', async () => {
    show([
      photo('a', { score: read(0.68) }),
      photo('b', { sort_order: 1, score: read(0.1, { scorer_version: 0 }) }),
      photo('c', { sort_order: 2 }),
      photo('d', { sort_order: 3, score: read(0.4, { scorer: 'later-model' }) }),
    ]);
    await grid();
    expect(screen.getByTestId('gallery-score').textContent).toBe('Score 3 new');
  });

  it('draws no button once every photo is read', async () => {
    show([photo('a', { score: read(0.68) })]);
    await grid();
    expect(screen.queryByTestId('gallery-score')).toBeNull();
  });

  it('wears the score bottom-left on a read tile, and says it to VoiceOver', async () => {
    show([photo('a', { score: read(0.68) }), photo('b', { sort_order: 1 })]);
    await grid();
    expect(screen.getByTestId('gallery-score-a').textContent).toBe('8.4');
    expect(screen.queryByTestId('gallery-score-b')).toBeNull();
    expect(screen.getByTestId('gallery-tile-a').getAttribute('aria-label')).toBe('Photo 1 · 8.4/10');
    expect(screen.getByTestId('gallery-tile-b').getAttribute('aria-label')).toBe('Photo 2');
  });

  it('reads each unread photo in turn, keeps each in the guide\'s name, reads back and says how it went', async () => {
    landing();
    data.scoreAsync.mockImplementation(async (uri: string) => ({
      aesthetic: uri.includes('/c.') ? 0.72 : 0.2, isUtility: false, signals: {},
    }));
    show([photo('a', { score: read(0.3) }), photo('b', { sort_order: 1 }), photo('c', { sort_order: 2 })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-score'));
    const card = await screen.findByTestId('scored-card');
    expect(data.scoreAsync.mock.calls.map((c) => c[0])).toEqual(['http://cdn/b.jpg', 'http://cdn/c.jpg']);
    // Stamped by the scorer that read it, version and all.
    expect(data.savePhotoScore).toHaveBeenCalledWith(
      'c', expect.objectContaining({ id: 'apple-vision', version: 7 }), { aesthetic: 0.72, isUtility: false, signals: {} }, 'u1',
    );
    expect(data.fetchGallery).toHaveBeenCalledTimes(2);
    expect(card.textContent).toContain('Scored 2 photos');
    expect(card.textContent).toContain('Best: photo 3 · 8.6');
    // Everything is read now, so the offer goes.
    expect(screen.queryByTestId('gallery-score')).toBeNull();
    fireEvent.click(screen.getByTestId('scored-close'));
    expect(screen.queryByTestId('scored-card')).toBeNull();
  });

  it('shows how far it has got while it reads', async () => {
    let release = () => {};
    data.scoreAsync.mockImplementationOnce(() => new Promise((r) => {
      release = () => r({ aesthetic: 0.5, isUtility: false, signals: {} });
    }));
    show([photo('a'), photo('b', { sort_order: 1 })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-score'));
    // On screen before anything is read.
    expect(data.scoreAsync).not.toHaveBeenCalled();
    expect((await screen.findByTestId('scoring-dialog')).textContent).toContain('1/2');
    // The first photograph is handed over once the dialog has had two
    // frames to start its bars.
    await waitFor(() => expect(data.scoreAsync).toHaveBeenCalledTimes(1));
    await act(async () => { release(); });
    await screen.findByTestId('scored-card');
  });

  // Cancel stops after the photo in hand, and what was read is kept.
  it('stops after the photo in hand when cancelled, keeping what it read', async () => {
    let release = () => {};
    data.scoreAsync.mockImplementationOnce(() => new Promise((r) => {
      release = () => r({ aesthetic: 0.5, isUtility: false, signals: {} });
    }));
    show([photo('a'), photo('b', { sort_order: 1 }), photo('c', { sort_order: 2 })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-score'));
    await screen.findByTestId('scoring-dialog');
    await waitFor(() => expect(data.scoreAsync).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('scoring-cancel'));
    expect(screen.getByTestId('scoring-dialog').textContent).toContain('Stopping after this photo…');
    await act(async () => { release(); });
    const card = await screen.findByTestId('scored-card');
    expect(data.scoreAsync).toHaveBeenCalledTimes(1);
    expect(data.savePhotoScore).toHaveBeenCalledTimes(1);
    expect(card.textContent).toContain('Scored 1 photo');
  });

  it('counts the photos it could not read and goes on', async () => {
    data.scoreAsync.mockRejectedValueOnce(new Error('404'));
    show([photo('a'), photo('b', { sort_order: 1 })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-score'));
    await screen.findByTestId('scored-card');
    expect(data.savePhotoScore).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('scored-failed').textContent).toBe('1 could not be read');
  });

  it('is not offered, and its card not drawn, while choosing photos to delete', async () => {
    show([photo('a'), photo('b', { sort_order: 1 })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-score'));
    await screen.findByTestId('scored-card');
    fireEvent.click(screen.getByTestId('gallery-select'));
    expect(screen.queryByTestId('gallery-score')).toBeNull();
    expect(screen.queryByTestId('scored-card')).toBeNull();
  });

  it('puts the number and its reasons in the photo\'s sheet, above what can be done to it', async () => {
    show([photo('a', { score: read(0.68) }), photo('b', { sort_order: 1 })]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-tile-a'));
    const ten = await screen.findByTestId('score-ten');
    expect(ten.textContent).toContain('8.4');
    expect(ten.textContent).toContain('Very good');
    expect(screen.getByTestId('score-why').textContent).toBe('Well lit.');
    // In reading order: the number and why, then the rows.
    const sheet = screen.getByTestId('photo-sheet');
    const why = screen.getByTestId('score-why');
    const cover = screen.getByRole('button', { name: 'Make it the cover' });
    expect(why.compareDocumentPosition(cover) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sheet.contains(why)).toBe(true);
  });

  it('says nothing of a score for a photo nobody has read', async () => {
    show([photo('a')]);
    await grid();
    fireEvent.click(screen.getByTestId('gallery-tile-a'));
    await screen.findByRole('button', { name: 'Make it the cover' });
    expect(screen.queryByTestId('score-ten')).toBeNull();
    expect(screen.queryByTestId('score-why')).toBeNull();
  });
});
