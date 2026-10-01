// @vitest-environment jsdom
//
// The band of a place's own photographs at the top of its card on the plan
// editor. What is pinned: one page per photograph the desk has not hidden,
// the cover first; nothing at all for a place with none; a tap on any page
// goes in without any page being a button; the count in the corner and
// the page it follows, clamped to the pages there are; and the credit of
// the page on screen, only while the switch is on.
//
// jsdom lays nothing out and react-native-web's ScrollView has no momentum
// to end, so the band's own handlers are called with what a phone would
// have reported — the same way `StopGallery`'s test drives its carousel.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { Place, PlacePhoto } from '../lib/types';

const state = vi.hoisted(() => ({ credit: false }));
vi.mock('../lib/useFlag', () => ({ useFlag: () => state.credit }));

import StopHero, { HERO_ASPECT } from './StopHero';

const photo = (uri: string, over: Partial<PlacePhoto> = {}): PlacePhoto => ({
  id: uri, photo_uri: uri, is_cover: false, is_hidden: false, sort_order: 0, attribution_name: null, ...over,
});
const place = (photos: PlacePhoto[]) => ({ slug: 'p', place_photos: photos }) as unknown as Place;

/** Props of the first committed element matching `pick`. */
const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, any> => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && pick(p)) return p;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no matching element in the committed tree');
};
const measure = (width: number) => act(() => {
  propsWhere((p) => p.testID === 'hero' && 'onLayout' in p).onLayout({ nativeEvent: { layout: { width } } });
});
const swipe = (x: number) => act(() => {
  propsWhere((p) => !!p.horizontal && 'onMomentumScrollEnd' in p)
    .onMomentumScrollEnd({ nativeEvent: { contentOffset: { x } } });
});
const srcs = () => [...document.querySelectorAll('img')].map((img) => img.getAttribute('src'));

const draw = (photos: PlacePhoto[], onPress = () => {}) =>
  render(<StopHero place={place(photos)} onPress={onPress} testID="hero" />);

beforeEach(() => { state.credit = false; });

describe('StopHero', () => {
  it('draws one page per photograph, the cover first and the hidden ones left out', () => {
    draw([
      photo('https://img/b.jpg', { sort_order: 1 }),
      photo('https://img/hidden.jpg', { is_hidden: true }),
      photo('https://img/a.jpg', { sort_order: 2, is_cover: true }),
    ]);
    expect(srcs()).toEqual(['https://img/a.jpg', 'https://img/b.jpg']);
  });

  it('draws nothing for a place without a photograph', () => {
    const { container } = draw([]);
    expect(container.querySelector('[data-testid="hero"]')).toBeNull();
    expect(srcs()).toEqual([]);
  });

  it('keeps the proportion the component argues for', () => {
    // 2:1 — see "how tall" in the component. The one figure that decides
    // how tall a 295pt-wide card's picture is (148pt).
    expect(HERO_ASPECT).toBe(2);
  });

  // The card's identity band is the button; the pictures take the same
  // tap without becoming a second control for VoiceOver to meet.
  it('opens from a tap on any page, without announcing buttons', () => {
    const open = vi.fn();
    draw([photo('https://img/a.jpg'), photo('https://img/b.jpg', { sort_order: 1 })], open);
    fireEvent.click(screen.getAllByTestId('hero-page')[1]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  // The card's lift, from a hold on the picture: the biggest thing on the
  // card and the first thing a thumb lands on.
  it('lifts from a hold on any page when given a way to, and lets go on press out', () => {
    const onHold = vi.fn();
    const onRelease = vi.fn();
    render(<StopHero place={place([photo('https://img/a.jpg'), photo('https://img/b.jpg', { sort_order: 1 })])} onPress={() => {}} onHold={onHold} onRelease={onRelease} testID="hero" />);
    const page = propsWhere((p) => p.testID === 'hero-page' && 'onLongPress' in p);
    expect(page.delayLongPress).toBeGreaterThanOrEqual(300);
    act(() => { page.onLongPress({ nativeEvent: { pageY: 512 } }); });
    expect(onHold).toHaveBeenCalledWith(512);
    act(() => { page.onPressOut(); });
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('offers no hold when not given one', () => {
    draw([photo('https://img/a.jpg')]);
    const page = propsWhere((p) => p.testID === 'hero-page');
    expect(page.onLongPress).toBeUndefined();
  });

  // The marks are `PageDots`', in the corner every carousel uses; what is
  // this band's is the page they follow, clamped to the pages there are.
  it('marks the pages and follows the swipe, clamped to the pages there are', () => {
    draw([
      photo('https://img/a.jpg'),
      photo('https://img/b.jpg', { sort_order: 1 }),
      photo('https://img/c.jpg', { sort_order: 2 }),
    ]);
    const marks = () => [...screen.getByTestId('hero-dots').children].map((el) => (el as HTMLElement).className);
    /** The one mark dressed unlike the others: the page in hand. */
    const inHand = () => { const m = marks(); return m.findIndex((c) => m.indexOf(c) === m.lastIndexOf(c)); };
    expect(marks()).toHaveLength(3);
    expect(inHand()).toBe(0);
    measure(300);
    swipe(300);
    expect(inHand()).toBe(1);
    // Rounded to the nearer page, as the scroll view itself settles.
    swipe(170);
    expect(inHand()).toBe(1);
    swipe(140);
    expect(inHand()).toBe(0);
    // A momentum end reported past the end, or before the start, stays
    // on a page that exists.
    swipe(1500);
    expect(inHand()).toBe(2);
    swipe(-300);
    expect(inHand()).toBe(0);
  });

  it('shows no marks for a single photograph, where there is nowhere to swipe to', () => {
    draw([photo('https://img/a.jpg')]);
    expect(screen.queryByTestId('hero-dots')).toBeNull();
  });

  it('credits the photograph on screen, page by page, when the switch is on', () => {
    state.credit = true;
    draw([
      photo('https://img/a.jpg', { attribution_name: 'Photo by Lan' }),
      photo('https://img/b.jpg', { sort_order: 1, attribution_name: 'Photo by Minh' }),
      photo('https://img/c.jpg', { sort_order: 2 }),
    ]);
    measure(300);
    expect(screen.getByText('Photo by Lan')).toBeTruthy();
    swipe(300);
    expect(screen.getByText('Photo by Minh')).toBeTruthy();
    expect(screen.queryByText('Photo by Lan')).toBeNull();
    // A page nobody signed has no credit line at all.
    swipe(600);
    expect(screen.queryByText(/Photo by/)).toBeNull();
  });

  it('draws no credit while the switch is off', () => {
    draw([photo('https://img/a.jpg', { attribution_name: 'Photo by Lan' })]);
    expect(screen.queryByText('Photo by Lan')).toBeNull();
  });
});
