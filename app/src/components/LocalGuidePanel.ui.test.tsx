// @vitest-environment jsdom
//
// The panel that offers the gallery, rendered for real.
//
// What is worth asserting is almost entirely *absence*: this control is
// drawn for a handful of people and must be invisible to everyone else,
// and an appearance test is the only thing that says so. The rule itself
// is `canKeepGallery`, tested in `lib/gallery.test.ts`; this checks that
// the component actually asks it, and that its one button asks the screen
// to open the gallery rather than doing anything itself. The upload it
// used to start lives in `useAddPhoto` now and is tested where it is
// called, in `GalleryScreen.ui.test.tsx`.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '../uitest/render';
import type { Lang } from '../lib/i18n';
import type { Place } from '../lib/types';

const state = vi.hoisted(() => ({
  lang: 'en' as Lang,
  uid: 'u1' as string | null,
  granted: true,
  name: 'Nguyễn Thu Trang',
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi: string, ja?: string) => ({ en, vi, ja: ja ?? en }[state.lang] ?? en),
  }),
}));

// The grant is read from a store now, not fetched — see `lib/guideGrant`.
vi.mock('../lib/useGuideGrant', () => ({ useIsGuide: () => state.granted }));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    session: state.uid ? { user: { id: state.uid } } : null,
    profile: { full_name: state.name },
  }),
}));

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

const onOpen = vi.fn();

beforeEach(() => {
  state.lang = 'en';
  state.uid = 'u1';
  state.granted = true;
  state.name = 'Nguyễn Thu Trang';
  onOpen.mockClear();
});

const draw = (p = place()) =>
  render(<LocalGuidePanel place={p} onOpen={onOpen} testID="panel" />);

describe('who the panel appears for', () => {
  it('appears for a granted guide on a place they imported', () => {
    draw();
    expect(screen.getByTestId('panel')).toBeTruthy();
  });

  // The mark at its head is the app's own, not a camera glyph: a camera
  // says what the button beside it says, about the tool rather than about
  // who is being asked.
  it('wears the app’s own logo at its head', () => {
    draw();
    expect(screen.getByTestId('panel').querySelector('img')).toBeTruthy();
    expect(document.querySelector('[data-icon="camera"]')).toBeNull();
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

  // A guide is not an editor: the grant says "you may keep your own
  // gallery", not "you may keep everybody's".
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
    expect(screen.getByTestId('guide-open-gallery')).toBeTruthy();
    expect(screen.queryByText(/Edit Place/i)).toBeNull();
  });

  // One door rather than one verb. The button no longer opens the picker:
  // it opens the screen where adding is one of four things to do.
  it('opens the gallery and does nothing else', () => {
    draw();
    fireEvent.click(screen.getByTestId('guide-open-gallery'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Add photo/)).toBeNull();
  });

  // "Gallery" in every language, by request — it is the name of a screen.
  it('is called Gallery in Vietnamese too', () => {
    state.lang = 'vi';
    draw();
    expect(screen.getByText('Gallery')).toBeTruthy();
    expect(screen.getByText('Bạn muốn cải thiện gallery?')).toBeTruthy();
  });

  // Their name, then a question — rather than claiming the place is
  // theirs and handing them a chore. This panel only ever shows to the
  // person who put the café in front of everybody else, and asking is
  // how you speak to them.
  it('greets the reader by name and asks, instead of instructing', () => {
    draw();
    expect(screen.getByText('Hi Trang,')).toBeTruthy();
    expect(screen.getByText('Want to improve your gallery?')).toBeTruthy();
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

afterEach(cleanup);
