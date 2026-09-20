// @vitest-environment jsdom
//
// The panel that offers a photograph, rendered for real.
//
// What is worth asserting is almost entirely *absence*: this control is
// drawn for a handful of people and must be invisible to everyone else,
// and an appearance test is the only thing that says so. The rule itself
// is `canAddPhoto`, tested in `lib/guide.test.ts`; this checks that the
// component actually asks it, and that the upload it starts says the
// right things to the database.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Lang } from '../lib/i18n';
import type { Place } from '../lib/types';

const state = vi.hoisted(() => ({
  lang: 'en' as Lang,
  uid: 'u1' as string | null,
  granted: true,
  picked: true,
  name: 'Nguyễn Thu Trang',
}));
const added = vi.hoisted(() => vi.fn());
const uploaded = vi.hoisted(() => vi.fn());

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi: string, ja?: string) => ({ en, vi, ja: ja ?? en }[state.lang] ?? en),
  }),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    session: state.uid ? { user: { id: state.uid } } : null,
    profile: { full_name: state.name },
  }),
}));

vi.mock('../lib/data', () => ({
  useIsLocalGuide: () => ({ data: state.granted, loading: false }),
  fetchPlaceId: vi.fn(async () => 'place-uuid'),
  fetchMyPhotoCounts: vi.fn(async () => ({ mineHere: 0, mineToday: 0 })),
  addPlacePhoto: (row: unknown) => { added(row); return Promise.resolve('photo-id'); },
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string) => { uploaded(path); return Promise.resolve({ error: null }); },
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

import LocalGuidePanel from './LocalGuidePanel';

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'cong-caphe',
  name_en: 'Cong Caphe',
  name_vi: 'Cộng Cà Phê',
  name_ja: null,
  submitted_by: 'u1',
  place_photos: [],
  vibe_tags: [],
  categories: [],
  ...over,
} as unknown as Place);

const onAdded = vi.fn();

beforeEach(() => {
  state.lang = 'en';
  state.uid = 'u1';
  state.granted = true;
  state.picked = true;
  state.name = 'Nguyễn Thu Trang';
  added.mockClear();
  uploaded.mockClear();
  onAdded.mockClear();
});

const draw = (p = place()) =>
  render(<LocalGuidePanel place={p} onAdded={onAdded} testID="panel" />);

describe('who the panel appears for', () => {
  it('appears for a granted guide on a place they imported', () => {
    draw();
    expect(screen.getByTestId('panel')).toBeTruthy();
  });

  // The mark at its head is the app's own, not a camera glyph: the button
  // below already says "Add photo", and a card that says the same thing
  // twice says it about the tool rather than about who is being asked.
  it('wears the app’s own logo at its head', () => {
    draw();
    expect(screen.getByTestId('panel').querySelector('img')).toBeTruthy();
    expect(document.querySelector('[data-icon="camera-outline"]')).toBeNull();
  });

  // The whole reason the role is handed out by hand: being signed in is
  // not being a guide, and the control must not appear and then refuse.
  it('is absent for a signed-in person the desk has not granted', () => {
    state.granted = false;
    draw();
    expect(screen.queryByTestId('panel')).toBeNull();
  });

  it('is absent for a guest', () => {
    state.uid = null;
    draw();
    expect(screen.queryByTestId('panel')).toBeNull();
  });

  // A guide is not an editor: the grant says "you may add photographs",
  // not "you may add them anywhere".
  it('is absent on somebody else’s place', () => {
    state.uid = 'u1';
    draw(place({ submitted_by: 'u2' }));
    expect(screen.queryByTestId('panel')).toBeNull();
  });

  // Every place the importer brought in carries a null here. Without this
  // the panel would appear on the whole catalog.
  it('is absent on a place nobody in the app imported', () => {
    draw(place({ submitted_by: null }));
    expect(screen.queryByTestId('panel')).toBeNull();
  });
});

describe('what it offers', () => {
  // The reference drew a second, primary button beside this one, disabled.
  // Its absence is deliberate and worth pinning: a disabled primary button
  // is the loudest thing on the panel, promising the one thing that
  // cannot be done.
  it('offers one button, and does not draw the editing one yet', () => {
    draw();
    expect(screen.getByTestId('guide-add-photo')).toBeTruthy();
    expect(screen.queryByText(/Edit Place/i)).toBeNull();
  });

  // The provenance line that used to sit under the button is gone. It said
  // where a photograph was expected to come from, which the picker it opens
  // says better by only ever opening on this phone's own library — and it
  // was a third line of prose on a card whose whole job is one button.
  it('does not explain where the photo should come from', () => {
    draw();
    expect(screen.queryByText(/from my own Photos/i)).toBeNull();
    expect(screen.queryByText(/Photos của tôi/)).toBeNull();
  });

  it('speaks the reader’s language', () => {
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Thêm ảnh')).toBeTruthy();
  });

  // Their name, then a question — rather than claiming the place is
  // theirs and handing them a chore. This panel only ever shows to the
  // person who put the café in front of everybody else, and asking is
  // how you speak to them.
  it('greets the reader by name and asks, instead of instructing', () => {
    draw();
    expect(screen.getByText('Hi Trang,')).toBeTruthy();
    expect(screen.getByText('Would you like to add more photos?')).toBeTruthy();
    expect(screen.queryByText(/Keep it up to date/)).toBeNull();
  });

  // The given name, which in a Vietnamese name is the last word. The
  // family name — Nguyễn — is the first, and greeting somebody by it is
  // wrong the way "Hi Smith" is wrong. `lib/greet` holds the rule and the
  // reasoning; this is the screen proving it asked.
  it('uses the given name, not the family name', () => {
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Chào Trang,')).toBeTruthy();
    expect(screen.queryByText(/Nguyễn/)).toBeNull();
  });

  // さん rather than a bare name, and the same last word: these profiles
  // are Vietnamese, and a foreign given name with さん is ordinary.
  it('adds さん for a Japanese reader', () => {
    state.lang = 'ja';
    draw();
    expect(screen.getByText('Trangさん、')).toBeTruthy();
  });

  // "Chào 2024," is worse than "Chào bạn,". A profile whose name cannot
  // be greeted gets the stranger's greeting rather than a guess with
  // somebody's data in it.
  it('greets a stranger when there is no name worth using', () => {
    state.lang = 'vi';
    state.name = 'user 2024';
    draw();
    expect(screen.getByText('Chào bạn,')).toBeTruthy();
  });
});

describe('the upload', () => {
  it('shrinks, stores under the uploader’s own folder, and files the row', async () => {
    draw();
    fireEvent.click(screen.getByTestId('guide-add-photo'));

    await waitFor(() => expect(added).toHaveBeenCalled());

    // Namespaced by uid, so one person's uploads cannot collide with
    // another's and the storage policy can read the first path segment.
    expect(uploaded.mock.calls[0][0]).toMatch(/^u1\/cong-caphe-\d+\.jpg$/);

    // Every column the insert policy checks, said out loud.
    expect(added.mock.calls[0][0]).toMatchObject({
      placeId: 'place-uuid',
      uid: 'u1',
      publicUrl: expect.stringContaining('u1/cong-caphe-'),
    });
    expect(onAdded).toHaveBeenCalled();
  });

  // The screen re-reads the place only when something landed on it.
  it('writes nothing when the picker is dismissed', async () => {
    state.picked = false;
    draw();
    fireEvent.click(screen.getByTestId('guide-add-photo'));
    await new Promise((r) => setTimeout(r, 0));
    expect(uploaded).not.toHaveBeenCalled();
    expect(added).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  // Past whatever is already on the place, so `photosOf` — cover first,
  // then this number — puts it at the end rather than in front of
  // pictures that were here before it.
  it('sorts a new photograph after the ones already there', async () => {
    draw(place({ place_photos: [{}, {}, {}] as Place['place_photos'] }));
    fireEvent.click(screen.getByTestId('guide-add-photo'));
    await waitFor(() => expect(added).toHaveBeenCalled());
    expect(added.mock.calls[0][0]).toMatchObject({ sortOrder: 4 });
  });
});

afterEach(cleanup);
