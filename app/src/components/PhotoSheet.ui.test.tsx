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
import { colors, space } from '../theme';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ t: (en: string) => en, lang: 'en' }),
}));
// jsdom's window has no size to React Native; an iPhone 15's points
// instead, so the frame has a width to be a share of.
const PHONE = vi.hoisted(() => ({ width: 393, height: 852, scale: 3, fontScale: 1 }));
// Zero, as everywhere in the suite, but settable: one test needs the
// home indicator's inset to tell "on it" from "10pt above it".
const INSETS = vi.hoisted(() => ({ top: 0, bottom: 0, left: 0, right: 0 }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => INSETS,
}));
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
    // The count on the photograph, once: no "Photo 4/6" head repeating it.
    expect(sheet.textContent).toContain('4/6');
    expect(sheet.textContent).not.toContain('Photo 4/6');
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

  // What it shows, from the photo labels, with its mark — and nothing
  // where the labels are not sure (owner, 18 Oct 2026).
  it('names what the photograph shows, and passes the kind to the analysis', () => {
    render(<PhotoSheet {...props({ photos: [photo({ kind: 'food', score })] })} />);
    const kind = screen.getByTestId('photo-sheet-kind');
    expect(kind.textContent).toBe('Food & drink');
    expect(kind.querySelector('[data-icon="restaurant-outline"]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('score-detail-toggle'));
    expect(screen.getByTestId('score-standing').textContent).toContain('food and drink photos');
    expect(screen.getByTestId('score-source').textContent).toBe('Photo analysed by Apple Vision and Claude.');
  });

  it('says no kind when the labels have none to say', () => {
    render(<PhotoSheet {...props({ photos: [photo({ kind: null, score })] })} />);
    expect(screen.queryByTestId('photo-sheet-kind')).toBeNull();
    fireEvent.click(screen.getByTestId('score-detail-toggle'));
    expect(screen.getByTestId('score-source').textContent).toBe('Analysed on this phone by Apple Vision.');
  });

  it('says a hidden photograph is hidden, and a hidden cover both', () => {
    render(<PhotoSheet {...props({ photos: [photo({ is_hidden: true, is_cover: true })] })} />);
    expect(screen.getByTestId('photo-sheet-status').textContent).toBe('Cover · Hidden');
  });

  // With a kind, the cover is a star beside it and not a word under the
  // standing (owner, 18 Oct 2026); without one it stays the word.
  it('marks the cover with a star beside the kind', () => {
    const { rerender } = render(<PhotoSheet {...props({ photos: [photo({ kind: 'interior', score, is_cover: true })] })} />);
    const star = screen.getByTestId('photo-sheet-cover');
    expect(star.querySelector('[data-icon="star"]')!.getAttribute('data-color')).toBe(colors.okInk);
    expect(star.getAttribute('aria-label')).toBe('Cover');
    expect(screen.getByTestId('photo-sheet-kind').contains(star)).toBe(true);
    expect(screen.queryByTestId('photo-sheet-status')).toBeNull();
    rerender(<PhotoSheet {...props({ photos: [photo({ kind: 'interior', score, is_cover: true, is_hidden: true })] })} />);
    expect(screen.getByTestId('photo-sheet-status').textContent).toBe('Hidden');
    rerender(<PhotoSheet {...props({ photos: [photo({ kind: 'interior', score })] })} />);
    expect(screen.queryByTestId('photo-sheet-cover')).toBeNull();
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

  // The kind leads the head, the number beside it, the status under it;
  // no sentence of reasons, which the analysis rows already say, no
  // "Photo n/m" and no "who measured" (owner, 16 and 18 Oct 2026).
  it('leads with what the photograph is, the number beside it, and no sentence', () => {
    render(<PhotoSheet {...props({ photos: [photo({ kind: 'interior', score, is_hidden: true })] })} />);
    const kind = screen.getByTestId('photo-sheet-kind');
    const ten = screen.getByTestId('score-ten');
    const status = screen.getByTestId('photo-sheet-status');
    expect(ten.textContent).toContain('8.4');
    expect(kind.textContent).toBe('Inside');
    const column = kind.parentElement!;
    expect(column.contains(status)).toBe(true);
    expect(column.firstElementChild).toBe(kind);
    expect(column.contains(ten)).toBe(false);
    expect(column.parentElement!.contains(ten)).toBe(true);
    expect(screen.queryByTestId('score-why')).toBeNull();
    expect(screen.queryByText('Well lit.')).toBeNull();
    // Where the number stands, under the kind's words, unfolded — not in
    // the analysis (owner, 18 Oct 2026).
    const standing = screen.getByTestId('score-standing');
    expect(standing.textContent).toMatch(/^Higher than \d+% of interior photos$/);
    expect(column.contains(standing)).toBe(true);
    expect(kind.compareDocumentPosition(standing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getComputedStyle(standing.parentElement!).marginLeft).toBe('28px');
    expect(screen.queryByTestId('score-detail-light')).toBeNull();
    expect(screen.queryByText(/^Photo \d/)).toBeNull();
    expect(screen.queryByTestId('score-source')).toBeNull();
    // What the sentence said is in the analysis, beside its bar.
    fireEvent.click(screen.getByTestId('score-detail-toggle'));
    expect(screen.getByText('Well lit')).toBeTruthy();
  });

  it('shows the number and the catalog\'s standing where the labels name no kind', () => {
    render(<PhotoSheet {...props({ photos: [photo({ kind: null, score })] })} />);
    expect(screen.getByTestId('score-ten').textContent).toContain('8.4');
    expect(screen.queryByTestId('photo-sheet-kind')).toBeNull();
    expect(screen.queryByTestId('score-why')).toBeNull();
    const standing = screen.getByTestId('score-standing');
    expect(standing.textContent).toMatch(/^Higher than \d+% of the catalog's photos$/);
    expect(getComputedStyle(standing.parentElement!).marginLeft).not.toBe('28px');
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
    expect(screen.getByTestId('photo-sheet').textContent).toContain('3/3');
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

  it('folds the detailed analysis under the reasons, for a scored photograph only', () => {
    const { rerender } = render(<PhotoSheet {...props({ photos: [photo({ score })] })} />);
    expect(screen.getByTestId('score-detail-toggle')).toBeTruthy();
    expect(screen.queryByTestId('score-detail-light')).toBeNull();
    rerender(<PhotoSheet {...props()} />);
    expect(screen.queryByTestId('score-detail')).toBeNull();
  });

  // Opened once, it stays open as the guide swipes through the gallery.
  it('keeps the detailed analysis open from one photograph to the next', () => {
    const photos = gallery(2, { score });
    const { rerender } = render(<PhotoSheet {...props({ photos, index: 0 })} />);
    fireEvent.click(screen.getByTestId('score-detail-toggle'));
    expect(screen.getByTestId('score-detail-light')).toBeTruthy();
    rerender(<PhotoSheet {...props({ photos, index: 1 })} />);
    expect(screen.getByTestId('score-detail-light')).toBeTruthy();
    fireEvent.click(screen.getByTestId('score-detail-toggle'));
    expect(screen.queryByTestId('score-detail-light')).toBeNull();
  });

  // A dock under the scroll, the same with the analysis open or folded,
  // scored or not: the act stays one tap from the reading (owner, 17 Oct
  // 2026).
  it('docks the actions as one strip under the scroll, analysis open or not', () => {
    const actions = [
      row({ short: 'Cover' }),
      row({ key: 'hide', icon: 'eye-off-outline', title: 'Hide it', short: 'Hide' }),
      row({ key: 'delete', icon: 'trash-outline', title: 'Delete it', destructive: true }),
    ];
    render(<PhotoSheet {...props({ photos: [photo({ score })], actionsFor: () => actions })} />);
    const strip = screen.getByTestId('sheet-strip');
    const labels = () => [...screen.getByTestId('sheet-strip').querySelectorAll('[role="button"]')].map((b) => b.textContent);
    // A word each, the title where there is no shorter one; VoiceOver
    // still hears the whole title.
    expect(labels()).toEqual(['Cover', 'Hide', 'Delete it']);
    expect(screen.getByTestId('sheet-action-cover').getAttribute('aria-label')).toBe('Make it the cover');
    expect(screen.getByTestId('sheet-action-delete').querySelector('[data-icon="trash-outline"]')).toBeTruthy();
    // Outside the scroll, so it stays in reach at any length.
    const scroll = screen.getByTestId('photo-sheet-frame').closest('[class]')!.parentElement!;
    expect(scroll.contains(strip)).toBe(false);
    fireEvent.click(screen.getByTestId('score-detail-toggle'));
    expect(labels()).toEqual(['Cover', 'Hide', 'Delete it']);
  });

  // On the home indicator's inset, not 10pt above it (owner, 18 Oct
  // 2026); a phone with no inset keeps 10pt off the edge.
  it('sits the dock on the inset, keeping 10pt where there is none', () => {
    const dock = () => getComputedStyle(screen.getByTestId('sheet-strip').parentElement!).paddingBottom;
    const { unmount } = render(<PhotoSheet {...props({ actionsFor: () => [row()] })} />);
    expect(dock()).toBe('10px');
    unmount();
    INSETS.bottom = 34;
    try {
      render(<PhotoSheet {...props({ actionsFor: () => [row()] })} />);
      expect(dock()).toBe('34px');
    } finally {
      INSETS.bottom = 0;
    }
  });

  it('docks the strip for an unscored photograph too, and draws no dock with nothing to do', () => {
    const { rerender } = render(<PhotoSheet {...props({ actionsFor: () => [row()] })} />);
    expect(screen.getByTestId('sheet-strip')).toBeTruthy();
    rerender(<PhotoSheet {...props({ actionsFor: () => [] })} />);
    expect(screen.queryByTestId('sheet-strip')).toBeNull();
  });

  it('closes the sheet first, then acts', () => {
    vi.useFakeTimers();
    try {
      const onPress = vi.fn();
      const onClose = vi.fn();
      render(<PhotoSheet {...props({ photos: [photo({ score })], actionsFor: () => [row({ onPress })], onClose })} />);
      fireEvent.click(screen.getByTestId('sheet-action-cover'));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(220); });
      expect(onPress).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

});
