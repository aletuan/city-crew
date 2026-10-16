// @vitest-environment jsdom
//
// The full screen. What is pinned is what the guide sees and can do:
// every photograph a page, whole; the count; the score over the picture
// when there is one; a tap to see the picture with nothing over it; a
// swipe that reports where it rests; and the way out. The pinch is
// UIScrollView's own, which jsdom cannot play, and is left to the phone.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { GalleryPhoto } from '../lib/gallery';
import type { PhotoScore } from '../lib/photoScore';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ t: (en: string) => en, lang: 'en' }),
}));
const PHONE = vi.hoisted(() => ({ width: 393, height: 852, scale: 3, fontScale: 1 }));
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => PHONE,
}));

import PhotoViewer, { settledPage } from './PhotoViewer';

const score: PhotoScore = {
  scorer: 'apple-vision', scorer_version: 1, aesthetic: 0.68, is_utility: false,
  signals: { brightness: 0.5 },
};
const gallery = (n: number, over: Partial<GalleryPhoto> = {}): GalleryPhoto[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`, photo_uri: `http://cdn/p${i + 1}.jpg`, is_cover: false, is_hidden: false,
    sort_order: i, source: 'google', storage_path: null, ...over,
  } as GalleryPhoto));
const swipeTo = (x: number) => {
  const pager = screen.getByTestId('photo-viewer-pager');
  Object.defineProperty(pager, 'scrollLeft', { value: x, configurable: true });
  fireEvent.scroll(pager);
};

describe('settledPage', () => {
  it('is the page an offset rests on, within a point', () => {
    expect(settledPage(0, 300, 3)).toBe(0);
    expect(settledPage(600, 300, 3)).toBe(2);
    expect(settledPage(300.6, 300, 3)).toBe(1);
    expect(settledPage(299.2, 300, 3)).toBe(1);
  });
  // Halfway through a swipe the index stays where it was.
  it('is nothing between pages', () => {
    expect(settledPage(150, 300, 3)).toBeNull();
    expect(settledPage(298, 300, 3)).toBeNull();
  });
  it('is nothing past either end, or with no width to page by', () => {
    expect(settledPage(-300, 300, 3)).toBeNull();
    expect(settledPage(900, 300, 3)).toBeNull();
    expect(settledPage(0, 0, 3)).toBeNull();
  });
});

describe('PhotoViewer', () => {
  it('lays every photograph out as a page, whole, and counts the one shown', () => {
    render(<PhotoViewer photos={gallery(3)} index={1} onIndex={() => {}} onClose={() => {}} />);
    for (const id of ['p1', 'p2', 'p3']) {
      const img = screen.getByTestId(`photo-viewer-page-${id}`).querySelector('img')!;
      expect(img.getAttribute('src')).toBe(`http://cdn/${id}.jpg`);
      expect(img.getAttribute('contentfit')).toBe('contain');
    }
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('2/3');
    expect(screen.getByTestId('photo-viewer-page-p2').getAttribute('aria-label')).toBe('Photo 2/3');
  });

  it('is nothing for an index with no photograph', () => {
    render(<PhotoViewer photos={gallery(2)} index={5} onIndex={() => {}} onClose={() => {}} />);
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
  });

  it('lays the score over the picture, number and reasons', () => {
    render(<PhotoViewer photos={gallery(1, { score })} index={0} onIndex={() => {}} onClose={() => {}} />);
    const over = screen.getByTestId('photo-viewer-score');
    expect(over.textContent).toContain('8.4');
    expect(over.textContent).toContain('Very good');
    expect(over.textContent).toContain('Well lit.');
  });

  it('lays nothing over a photograph nobody has read, or one with no number', () => {
    const { rerender } = render(<PhotoViewer photos={gallery(1)} index={0} onIndex={() => {}} onClose={() => {}} />);
    expect(screen.queryByTestId('photo-viewer-score')).toBeNull();
    rerender(<PhotoViewer photos={gallery(1, { score: { ...score, aesthetic: null } })} index={0} onIndex={() => {}} onClose={() => {}} />);
    expect(screen.queryByTestId('photo-viewer-score')).toBeNull();
  });

  // Photos' way: a tap clears everything off the picture, another brings it back.
  it('hides and shows the bar and the score at a tap', () => {
    render(<PhotoViewer photos={gallery(2, { score })} index={0} onIndex={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('photo-viewer-page-p1'));
    expect(screen.queryByTestId('photo-viewer-close')).toBeNull();
    expect(screen.queryByTestId('photo-viewer-score')).toBeNull();
    fireEvent.click(screen.getByTestId('photo-viewer-page-p1'));
    expect(screen.getByTestId('photo-viewer-close')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-score')).toBeTruthy();
  });

  it('reports the photograph a swipe rests on, and nothing on the way', async () => {
    const onIndex = vi.fn();
    render(<PhotoViewer photos={gallery(3)} index={0} onIndex={onIndex} onClose={() => {}} />);
    swipeTo(PHONE.width * 0.4);
    expect(onIndex).not.toHaveBeenCalled();
    swipeTo(PHONE.width * 2);
    await waitFor(() => expect(onIndex).toHaveBeenCalledWith(2));
    expect(onIndex).toHaveBeenCalledTimes(1);
  });

  it('does not report the photograph already shown', () => {
    const onIndex = vi.fn();
    render(<PhotoViewer photos={gallery(3)} index={1} onIndex={onIndex} onClose={() => {}} />);
    swipeTo(PHONE.width);
    expect(onIndex).not.toHaveBeenCalled();
  });

  it('closes from its ×', () => {
    const onClose = vi.fn();
    render(<PhotoViewer photos={gallery(1)} index={0} onIndex={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('photo-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Looking only: the actions are the sheet's, one tap away underneath.
  it('offers no actions of its own', () => {
    render(<PhotoViewer photos={gallery(1)} index={0} onIndex={() => {}} onClose={() => {}} />);
    const viewer = screen.getByTestId('photo-viewer');
    expect(viewer.querySelector('[data-icon="ellipsis-horizontal"]')).toBeNull();
    expect(viewer.textContent).not.toMatch(/cover|Hide|Delete/);
  });
});
