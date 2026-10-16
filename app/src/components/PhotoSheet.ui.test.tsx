// @vitest-environment jsdom
//
// One photograph, opened. What is pinned is what the guide sees and can
// do: the picture, at its own shape; its place in the gallery and whether
// it is the cover or hidden; its score when it has one; the rows, titles
// only; swiping to the next; the full screen; and the ways out. Which
// rows a photograph offers is `lib/gallery`'s, and what each does is the
// Gallery screen's — tested there.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { GalleryPhoto } from '../lib/gallery';
import type { PhotoScore } from '../lib/photoScore';
import type { SheetAction } from './ActionSheet';
import { space } from '../theme';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ t: (en: string) => en, lang: 'en' }),
}));
// jsdom's window has no size to React Native; an iPhone 15's points
// instead, so the frame has a width to be a share of.
const PHONE = vi.hoisted(() => ({ width: 393, height: 852, scale: 3, fontScale: 1 }));
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => PHONE,
}));

import PhotoSheet, { frameHeight } from './PhotoSheet';

const photo = (over: Partial<GalleryPhoto> = {}): GalleryPhoto => ({
  id: 'p1', photo_uri: 'http://cdn/p1.jpg', is_cover: false, is_hidden: false,
  sort_order: 0, source: 'google', storage_path: null, ...over,
} as GalleryPhoto);
/** A gallery of `n`, p1…pn. */
const gallery = (n: number, over: Partial<GalleryPhoto> = {}) =>
  Array.from({ length: n }, (_, i) => photo({ id: `p${i + 1}`, photo_uri: `http://cdn/p${i + 1}.jpg`, sort_order: i, ...over }));

type Props = React.ComponentProps<typeof PhotoSheet>;
const props = (over: Partial<Props> = {}): Props => ({
  photos: [photo()], index: 0, onIndex: vi.fn(), actionsFor: () => [], onClose: vi.fn(), ...over,
});
/** The sheet's pager, scrolled to `x` and come to rest there. */
const swipeTo = (x: number, id = 'photo-sheet-pager') => {
  const pager = screen.getByTestId(id);
  Object.defineProperty(pager, 'scrollLeft', { value: x, configurable: true });
  fireEvent.scroll(pager);
};
const score: PhotoScore = {
  scorer: 'apple-vision', scorer_version: 1, aesthetic: 0.68, is_utility: false,
  signals: { brightness: 0.5 },
};
const row = (over: Partial<SheetAction> = {}): SheetAction => ({
  key: 'cover', icon: 'star-outline', title: 'Make it the cover',
  desc: 'The picture that stands for the place.', onPress: vi.fn(), ...over,
});

const W = PHONE.width - space.page * 2;

const frame = () => screen.getByTestId('photo-sheet-frame');
const frameH = () => parseFloat(frame().style.height);

describe('frameHeight', () => {
  it('is a square the frame\'s width across', () => {
    expect(frameHeight(360, 2000)).toBe(360);
  });
  it('never takes more than half the screen', () => {
    expect(frameHeight(360, 600)).toBe(300);
    expect(frameHeight(361, 851)).toBe(361);
    expect(frameHeight(500, 851)).toBe(426);
  });
});

describe('PhotoSheet', () => {
  it('is nothing until a photograph has been opened', () => {
    render(<PhotoSheet {...props({ index: null })} />);
    expect(screen.queryByTestId('photo-sheet')).toBeNull();
  });

  it('shows the picture open, its place in the gallery, and whether it is the cover', () => {
    const photos = gallery(6);
    photos[3] = { ...photos[3], is_cover: true };
    render(<PhotoSheet {...props({ photos, index: 3 })} />);
    expect(screen.getByTestId('photo-sheet-page-p4').querySelector('img')!.getAttribute('src')).toBe('http://cdn/p4.jpg');
    expect(screen.getByTestId('photo-sheet-page-p4').getAttribute('aria-label')).toBe('Photo 4/6');
    const sheet = screen.getByTestId('photo-sheet');
    expect(sheet.textContent).toContain('4/6');
    expect(sheet.textContent).toContain('Photo 4/6');
    expect(screen.getByTestId('photo-sheet-status').textContent).toBe('Cover');
  });

  // Where it came from told the guide nothing to act on (owner, 16 Oct).
  it('says nothing of where a photograph came from', () => {
    render(<PhotoSheet {...props({ photos: [photo({ source: 'google' })] })} />);
    const sheet = screen.getByTestId('photo-sheet');
    expect(sheet.textContent).not.toMatch(/From Google|Uploaded/);
    expect(sheet.querySelector('[data-icon="logo-google"]')).toBeNull();
    expect(sheet.querySelector('[data-icon="cloud-upload-outline"]')).toBeNull();
    expect(screen.queryByTestId('photo-sheet-status')).toBeNull();
  });

  it('says a hidden photograph is hidden, and a hidden cover both', () => {
    render(<PhotoSheet {...props({ photos: [photo({ is_hidden: true, is_cover: true })] })} />);
    expect(screen.getByTestId('photo-sheet-status').textContent).toBe('Cover · Hidden');
  });

  // One frame for every photograph: the sheet does not grow or shrink as
  // the guide swipes from a portrait to a landscape (owner, 16 Oct 2026).
  it('keeps one frame, whichever photograph is open', () => {
    const photos = gallery(3);
    const { rerender } = render(<PhotoSheet {...props({ photos, index: 0 })} />);
    expect(frameH()).toBe(frameHeight(W, PHONE.height));
    rerender(<PhotoSheet {...props({ photos, index: 2 })} />);
    expect(frameH()).toBe(frameHeight(W, PHONE.height));
    for (const id of ['p1', 'p2', 'p3']) {
      expect(parseFloat(screen.getByTestId(`photo-sheet-page-${id}`).style.height)).toBe(frameH());
    }
  });

  // Whole, never cropped: the frame is the picture's shape, or a square
  // with dark ground either side.
  it('shows the whole picture, never a crop of it', () => {
    render(<PhotoSheet {...props()} />);
    expect(screen.getByTestId('photo-sheet-page-p1').querySelector('img')!.getAttribute('contentfit')).toBe('contain');
  });

  // The grid behind is photographs too; dimmed alone it read as a second
  // screen (owner, 16 Oct 2026).
  it('blurs the screen behind it', () => {
    render(<PhotoSheet {...props()} />);
    expect(screen.getByTestId('photo-sheet-blur')).toBeTruthy();
  });

  // The reasons sit under the name and the number beside them, so no gap
  // opens under a one-line name beside a two-line number (owner, 16 Oct).
  it('puts the reasons under the name, and the number beside them', () => {
    render(<PhotoSheet {...props({ photos: [photo({ score })] })} />);
    const title = screen.getByText('Photo 1/1');
    const why = screen.getByTestId('score-why');
    const ten = screen.getByTestId('score-ten');
    expect(ten.textContent).toContain('8.4');
    expect(why.textContent).toBe('Well lit.');
    const column = title.parentElement!.parentElement!;
    expect(column.contains(why)).toBe(true);
    expect(column.contains(ten)).toBe(false);
    expect(column.parentElement!.contains(ten)).toBe(true);
  });

  it('says nothing of a score for a photograph nobody has read', () => {
    render(<PhotoSheet {...props()} />);
    expect(screen.queryByTestId('score-ten')).toBeNull();
    expect(screen.queryByTestId('score-why')).toBeNull();
  });

  // The picture above makes the sentence plain; VoiceOver still hears it.
  it('lists the open photograph\'s rows by title alone', () => {
    const actionsFor = vi.fn(() => [row()]);
    const photos = gallery(2);
    render(<PhotoSheet {...props({ photos, index: 1, actionsFor })} />);
    expect(actionsFor).toHaveBeenLastCalledWith(photos[1]);
    const button = screen.getByRole('button', { name: 'Make it the cover' });
    expect(button.textContent).toBe('Make it the cover');
    expect(screen.getByTestId('photo-sheet').textContent).not.toContain('stands for the place');
  });

  it('closes first, then does what the row says', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const act1 = row();
    render(<PhotoSheet {...props({ actionsFor: () => [act1], onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make it the cover' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(act1.onPress).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(220); });
    expect(act1.onPress).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('closes from the × on the picture, and from the dimmed screen above it', () => {
    const onClose = vi.fn();
    render(<PhotoSheet {...props({ onClose })} />);
    fireEvent.click(screen.getByTestId('photo-sheet-close'));
    fireEvent.click(screen.getAllByLabelText('Close')[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  // The sheet fades out after `index` goes null, and the caller has
  // nothing left to show by then.
  it('keeps showing the photograph it last had while it fades', () => {
    const photos = gallery(3);
    const { rerender } = render(<PhotoSheet {...props({ photos, index: 2, actionsFor: () => [row()] })} />);
    rerender(<PhotoSheet {...props({ photos: [], index: null, actionsFor: () => [row()] })} />);
    expect(screen.getByTestId('photo-sheet-page-p3').querySelector('img')!.getAttribute('src')).toBe('http://cdn/p3.jpg');
    expect(screen.getByTestId('photo-sheet').textContent).toContain('Photo 3/3');
    // Its rows go with it: nothing is pressable on a sheet on its way out.
    expect(screen.queryByRole('button', { name: 'Make it the cover' })).toBeNull();
  });

  // A swipe moves to the next photograph without closing the sheet and
  // finding the tile (owner, 16 Oct 2026) — once it comes to rest.
  it('moves to the photograph a swipe comes to rest on, and not before', async () => {
    const onIndex = vi.fn();
    render(<PhotoSheet {...props({ photos: gallery(3), index: 0, onIndex })} />);
    swipeTo(W * 0.6);
    expect(onIndex).not.toHaveBeenCalled();
    // react-native-web reports the resting offset when the scroll ends.
    swipeTo(W * 2);
    await waitFor(() => expect(onIndex).toHaveBeenCalledWith(2));
    expect(onIndex).toHaveBeenCalledTimes(1);
  });

  it('does not report the photograph already open', () => {
    const onIndex = vi.fn();
    render(<PhotoSheet {...props({ photos: gallery(3), index: 1, onIndex })} />);
    swipeTo(W);
    expect(onIndex).not.toHaveBeenCalled();
  });

  it('opens the full screen from ⛶ and from the picture, and closes back to the sheet', () => {
    const photos = gallery(2, { score });
    render(<PhotoSheet {...props({ photos, index: 1 })} />);
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
    fireEvent.click(screen.getByTestId('photo-sheet-full'));
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('2/2');
    fireEvent.click(screen.getByTestId('photo-viewer-close'));
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
    expect(screen.getByTestId('photo-sheet')).toBeTruthy();
    fireEvent.click(screen.getByTestId('photo-sheet-page-p2'));
    expect(screen.getByTestId('photo-viewer')).toBeTruthy();
  });

  // The viewer pages the same photographs, and where it rests is where
  // the sheet is when it closes: the gallery owns the index.
  it('reports a swipe in the full screen as the sheet\'s own', () => {
    const onIndex = vi.fn();
    render(<PhotoSheet {...props({ photos: gallery(3), index: 0, onIndex })} />);
    fireEvent.click(screen.getByTestId('photo-sheet-full'));
    swipeTo(PHONE.width, 'photo-viewer-pager');
    expect(onIndex).toHaveBeenCalledWith(1);
  });

  // Back on Android, or Escape here: the full screen first, then the sheet.
  it('closes the full screen before the sheet on the system\'s back', () => {
    const onClose = vi.fn();
    render(<PhotoSheet {...props({ onClose })} />);
    // react-native-web listens for Escape once the Modal has finished
    // appearing, on `animationend`, which jsdom never fires by itself.
    document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
    fireEvent.click(screen.getByTestId('photo-sheet-full'));
    fireEvent.keyUp(document, { key: 'Escape' });
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyUp(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens on the sheet again, not the full screen, next time', () => {
    const { rerender } = render(<PhotoSheet {...props()} />);
    fireEvent.click(screen.getByTestId('photo-sheet-full'));
    rerender(<PhotoSheet {...props({ index: null })} />);
    rerender(<PhotoSheet {...props()} />);
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
  });
});
