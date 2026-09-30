// @vitest-environment jsdom
//
// The carousel of an outing's stops. What is pinned: one page per stop,
// whatever the stop has — a photograph, an emoji, a pin for a place gone
// from the catalog; nothing at all when no stop has a picture; the credit
// of the page on screen, and only while the switch is on; the dots; and
// the page a swipe lands on, over the width the carousel measured.
//
// jsdom lays nothing out and react-native-web's ScrollView has no
// momentum to end, so the carousel's own handlers are called with what a
// phone would have reported. What that pins is what the component does
// with a measurement, not the measurement.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../uitest/render';
import type { Place } from '../lib/types';

const state = vi.hoisted(() => ({ credit: false }));
vi.mock('../lib/useFlag', () => ({ useFlag: () => state.credit }));

import StopGallery, { hasPicture } from './StopGallery';

const photo = (uri: string, attribution: string | null = null) => ({
  id: uri, photo_uri: uri, is_cover: true, is_hidden: false, sort_order: 0, attribution_name: attribution,
});
const place = (over: Partial<Place> = {}) => ({ emoji: null, place_photos: [], ...over }) as unknown as Place;

/** Props of the first committed element matching `pick`. */
const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, (...a: unknown[]) => void> => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && pick(p)) return p as Record<string, (...a: unknown[]) => void>;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no matching element in the committed tree');
};
const measure = (width: number) => act(() => {
  propsWhere((p) => p.testID === 'gallery' && 'onLayout' in p).onLayout({ nativeEvent: { layout: { width } } });
});
const swipe = (x: number) => act(() => {
  propsWhere((p) => !!p.horizontal && 'onMomentumScrollEnd' in p)
    .onMomentumScrollEnd({ nativeEvent: { contentOffset: { x } } });
});

/** The gallery with its page held the way a screen holds it. */
function Held({ places }: { places: (Place | null)[] }) {
  const [page, setPage] = React.useState(0);
  return <StopGallery places={places} aspectRatio={3} page={page} onPage={setPage} testID="gallery" />;
}

beforeEach(() => { state.credit = false; });

describe('StopGallery', () => {
  it('draws one page per stop: a photograph, an emoji, or a pin', () => {
    const { container } = render(<Held places={[
      place({ place_photos: [photo('https://img/a.jpg')] } as Partial<Place>),
      place({ emoji: '🍜' }),
      null,
    ]} />);
    expect(container.querySelector('img[src="https://img/a.jpg"]')).toBeTruthy();
    expect(screen.getByText('🍜')).toBeTruthy();
    expect(screen.getByText('📍')).toBeTruthy();
  });

  it('draws nothing when no stop has a picture', () => {
    const { container } = render(<Held places={[place({ emoji: '🍜' }), null]} />);
    expect(container.querySelector('[data-testid="gallery"]')).toBeNull();
    expect(screen.queryByText('🍜')).toBeNull();
  });

  // The credit follows the page on screen, and the page is the swipe's
  // offset over the width the carousel measured, rounded to the nearer.
  it('credits the photograph on screen, page by page, when the switch is on', () => {
    state.credit = true;
    render(<Held places={[
      place({ place_photos: [photo('https://img/a.jpg', 'Photo by Lan')] } as Partial<Place>),
      place({ place_photos: [photo('https://img/b.jpg', 'Photo by Minh')] } as Partial<Place>),
      place({ place_photos: [photo('https://img/c.jpg')] } as Partial<Place>),
    ]} />);
    measure(320);
    expect(screen.getByText('Photo by Lan')).toBeTruthy();
    swipe(320);
    expect(screen.getByText('Photo by Minh')).toBeTruthy();
    expect(screen.queryByText('Photo by Lan')).toBeNull();
    // A page nobody signed has no credit line at all.
    swipe(640);
    expect(screen.queryByText(/Photo by/)).toBeNull();
    swipe(150);
    expect(screen.getByText('Photo by Lan')).toBeTruthy();
    swipe(170);
    expect(screen.getByText('Photo by Minh')).toBeTruthy();
  });

  it('draws no credit when the switch is off', () => {
    render(<Held places={[place({ place_photos: [photo('https://img/a.jpg', 'Photo by Lan')] } as Partial<Place>)]} />);
    expect(screen.queryByText('Photo by Lan')).toBeNull();
  });

  // None for a single stop, where there is nowhere to swipe to.
  it('draws no dots for a single stop', () => {
    render(<Held places={[place({ place_photos: [photo('https://img/a.jpg')] } as Partial<Place>)]} />);
    expect(document.querySelectorAll('[data-testid="gallery"] > div').length).toBe(1);
  });

  // One dot per stop, the one on screen marked.
  it('dots the pages, and marks the one on screen', () => {
    const one = place({ place_photos: [photo('https://img/a.jpg')] } as Partial<Place>);
    render(<Held places={[one, place({ emoji: '🍜' })]} />);
    const dots = () => [...document.querySelectorAll('[data-testid="gallery"] > div:last-child > div')]
      .map((d) => d.className);
    const [on, off] = dots();
    expect(dots()).toHaveLength(2);
    // The marked dot is drawn larger than the rest. Read as strings: the
    // nodes are restyled in place, so a node kept across the swipe would
    // report its new class.
    expect(on).not.toBe(off);
    measure(320);
    swipe(320);
    expect(dots()).toEqual([off, on]);
  });
});

describe('hasPicture', () => {
  it('is true when any stop has a photograph, and not for emoji or gaps', () => {
    expect(hasPicture([null, place({ place_photos: [photo('https://img/a.jpg')] } as Partial<Place>)])).toBe(true);
    expect(hasPicture([null, place({ emoji: '🍜' })])).toBe(false);
    expect(hasPicture([])).toBe(false);
  });
});
