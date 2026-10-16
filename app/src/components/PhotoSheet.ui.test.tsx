// @vitest-environment jsdom
//
// One photograph, opened. What is pinned is what the guide sees and can
// do: the picture, at its own shape; its place in the gallery and where
// it came from; its score when it has one; the rows, titles only; and
// the ways out. Which rows a photograph offers is `lib/gallery`'s, and
// what each does is the Gallery screen's — tested there.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
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
/** The picture arriving, at its own size, as `expo-image` reports it. */
const arrive = (w: number, h: number) => {
  const img = frame().querySelector('img')!;
  Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true });
  fireEvent.load(img);
};

describe('frameHeight', () => {
  it('is the picture\'s own height when it is wider than tall', () => {
    expect(frameHeight(4 / 3, 360, 2000)).toBe(270);
    expect(frameHeight(16 / 9, 360, 2000)).toBe(203);
  });
  // Never cropped to a landscape: a portrait sits whole in a square.
  it('is a square for a square or a portrait', () => {
    expect(frameHeight(1, 360, 2000)).toBe(360);
    expect(frameHeight(3 / 4, 360, 2000)).toBe(360);
  });
  it('never takes more than half the screen', () => {
    expect(frameHeight(1, 360, 600)).toBe(300);
    expect(frameHeight(4 / 3, 360, 500)).toBe(250);
  });
});

describe('PhotoSheet', () => {
  it('is nothing until a photograph has been opened', () => {
    render(<PhotoSheet photo={null} index={0} total={3} actions={[]} onClose={() => {}} />);
    expect(screen.queryByTestId('photo-sheet')).toBeNull();
  });

  it('shows the picture, its place in the gallery, and where it came from', () => {
    render(<PhotoSheet photo={photo({ is_cover: true })} index={3} total={6} actions={[]} onClose={() => {}} />);
    expect(frame().querySelector('img')!.getAttribute('src')).toBe('http://cdn/p1.jpg');
    expect(frame().querySelector('img')!.getAttribute('alt')).toBe('Photo 4/6');
    const sheet = screen.getByTestId('photo-sheet');
    // On the picture, and as its name.
    expect(sheet.textContent).toContain('4/6');
    expect(sheet.textContent).toContain('Photo 4/6');
    expect(screen.getByTestId('photo-sheet-meta').textContent).toBe('From Google · Cover');
    expect(sheet.querySelector('[data-icon="logo-google"]')).not.toBeNull();
  });

  it('says an upload is one, and that a hidden one is hidden', () => {
    render(<PhotoSheet photo={photo({ source: 'guide', is_hidden: true })} index={0} total={1} actions={[]} onClose={() => {}} />);
    expect(screen.getByTestId('photo-sheet-meta').textContent).toBe('Uploaded · Hidden');
    expect(screen.getByTestId('photo-sheet').querySelector('[data-icon="logo-google"]')).toBeNull();
  });

  // The frame takes the picture's shape once the picture says what it is.
  it('fits the frame to the picture once it arrives, and ignores a size with a zero side', () => {
    render(<PhotoSheet photo={photo()} index={0} total={1} actions={[]} onClose={() => {}} />);
    const width = W;
    const half = PHONE.height / 2;
    expect(frameH()).toBe(Math.round(width * 3 / 4));
    // Wide enough to sit under the half-screen cap, so the ratio shows.
    arrive(3000, 1000);
    expect(frameH()).toBe(Math.round(width / 3));
    expect(frameH()).toBeLessThan(half);
    // A size with a zero side is no size: it would make the frame a
    // sliver (no height) or a square (no width).
    arrive(1000, 0);
    expect(frameH()).toBe(Math.round(width / 3));
    arrive(0, 1000);
    expect(frameH()).toBe(Math.round(width / 3));
  });

  // Whole, never cropped: the frame is the picture's shape, or a square
  // with dark ground either side.
  it('shows the whole picture, never a crop of it', () => {
    render(<PhotoSheet photo={photo()} index={0} total={1} actions={[]} onClose={() => {}} />);
    expect(frame().querySelector('img')!.getAttribute('contentfit')).toBe('contain');
  });

  // A shape learned for one photograph is not another's.
  it('starts from the guess again for the next photograph', () => {
    const { rerender } = render(<PhotoSheet photo={photo()} index={0} total={2} actions={[]} onClose={() => {}} />);
    arrive(3000, 1000);
    const wide = frameH();
    rerender(<PhotoSheet photo={photo({ id: 'p2', photo_uri: 'http://cdn/p2.jpg' })} index={1} total={2} actions={[]} onClose={() => {}} />);
    expect(frameH()).not.toBe(wide);
    expect(frameH()).toBe(Math.round(W * 3 / 4));
  });

  it('carries the score, right of the name and why beneath, when there is one', () => {
    render(<PhotoSheet photo={photo({ score })} index={0} total={1} actions={[]} onClose={() => {}} />);
    expect(screen.getByTestId('score-ten').textContent).toContain('8.4');
    expect(screen.getByTestId('score-why').textContent).toBe('Well lit.');
  });

  it('says nothing of a score for a photograph nobody has read', () => {
    render(<PhotoSheet photo={photo()} index={0} total={1} actions={[]} onClose={() => {}} />);
    expect(screen.queryByTestId('score-ten')).toBeNull();
    expect(screen.queryByTestId('score-why')).toBeNull();
  });

  // The picture above makes the sentence plain; VoiceOver still hears it.
  it('lists the rows by title alone, keeping each sentence for VoiceOver', () => {
    render(<PhotoSheet photo={photo()} index={0} total={1} actions={[row()]} onClose={() => {}} />);
    const button = screen.getByRole('button', { name: 'Make it the cover' });
    expect(button.textContent).toBe('Make it the cover');
    expect(screen.getByTestId('photo-sheet').textContent).not.toContain('stands for the place');
  });

  it('closes first, then does what the row says', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const act1 = row();
    render(<PhotoSheet photo={photo()} index={0} total={1} actions={[act1]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make it the cover' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(act1.onPress).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(220); });
    expect(act1.onPress).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('closes from the × on the picture, and from the dimmed screen above it', () => {
    const onClose = vi.fn();
    render(<PhotoSheet photo={photo()} index={0} total={1} actions={[]} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('photo-sheet-close'));
    fireEvent.click(screen.getAllByLabelText('Close')[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  // The sheet fades out after `photo` goes null, and the caller has
  // nothing left to show by then.
  it('keeps showing the photograph it last had while it fades', () => {
    const { rerender } = render(<PhotoSheet photo={photo()} index={2} total={3} actions={[row()]} onClose={() => {}} />);
    rerender(<PhotoSheet photo={null} index={0} total={3} actions={[]} onClose={() => {}} />);
    expect(frame().querySelector('img')!.getAttribute('src')).toBe('http://cdn/p1.jpg');
    expect(screen.getByTestId('photo-sheet').textContent).toContain('Photo 3/3');
    expect(screen.getByRole('button', { name: 'Make it the cover' })).toBeTruthy();
  });
});
