// @vitest-environment jsdom
//
// The deck at the top of the sketching screen, and the one piece of
// state it holds: which plan's places are up.
//
// `SketchingScreen`'s own test covers the walk from one plan to the next,
// which is the behaviour a reader sees. What it cannot reach from there
// is the swap's own edges — a change overtaken by a newer one, and the
// flip to Reduce Motion in the middle of a wait. Both are about landing
// on the right places, which is the only thing this component can get
// wrong.
//
// Nothing here asserts how it looks. `Animated` values do not tick in
// this environment and no layout is computed, so the visible claims —
// the fan, the lift, the dissolve — are for a phone.

import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '../uitest/render';
import SketchDeck from './SketchDeck';
import type { Place } from '../lib/data';

const place = (slug: string, name: string): Place => ({
  slug, name_en: name, name_vi: name, name_ja: null, category: 'food', categories: ['eats'],
  is_featured: false, vibe_tags: [], neighborhood_en: 'Hoàn Kiếm', neighborhood_vi: null,
  neighborhood_ja: null, address: null, lat: null, lng: null, opening_hours: null,
  place_photos: [],
} as unknown as Place);

const A = place('a', 'Alpha');
const B = place('b', 'Bravo');
const C = place('c', 'Charlie');

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const draw = (props: Partial<React.ComponentProps<typeof SketchDeck>> = {}) =>
  render(<SketchDeck places={[A]} span={1} {...props} />);

describe('SketchDeck', () => {
  it('draws the places it was handed, and nothing it was not', () => {
    draw({ places: [A, B], span: 2 });
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.queryByText('Charlie')).toBeNull();
  });

  it('holds its slots when the new plan is shorter than the old one', async () => {
    const { rerender } = draw({ places: [A, B], span: 2 });
    rerender(<SketchDeck places={[C]} span={2} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByText('Charlie')).toBeTruthy();
    // The row still holds two boxes: the one card and the empty frame
    // beside it, which is what stops the card widening on the swap.
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('lands on the newest plan when one swap overtakes another', async () => {
    const { rerender } = draw();
    rerender(<SketchDeck places={[B]} span={1} />);
    // Inside the dissolve, so the first swap is stopped rather than run.
    await act(async () => { await vi.advanceTimersByTimeAsync(60); });
    rerender(<SketchDeck places={[C]} span={1} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(screen.getByText('Charlie')).toBeTruthy();
    // Not the set the first dissolve set out for.
    expect(screen.queryByText('Bravo')).toBeNull();
  });

  it('swaps without a dissolve for a reader who turns Reduce Motion on mid-wait', () => {
    const { rerender } = draw();
    rerender(<SketchDeck places={[B]} span={1} still />);
    // No clock wound: the places are already the new ones.
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
  });
});
