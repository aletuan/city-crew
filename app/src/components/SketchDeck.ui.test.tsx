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
// the fan, the lift, the dissolve — are for a phone. That also rules out
// asserting the order of the two clocks inside a slot: the picture is
// handed over before the word, but with the fade completing instantly
// both land in one tick, and a test of it passed against a version that
// had them the other way round. It is not here for that reason.

import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '../uitest/render';
import { Image } from 'expo-image';
import SketchDeck, { CROSS_MS, lieOf, NAME_IN, NAME_OUT, SWAP_STEP_MS } from './SketchDeck';
import { DECK_HOLD_MS } from '../lib/sketch';
import type { Place } from '../lib/data';

const prefetch = Image.prefetch as unknown as ReturnType<typeof vi.fn>;

const shot = (uri: string) => ({ photo_uri: uri, is_cover: true, is_hidden: false, sort_order: 0 });
const place = (slug: string, name: string, photos: unknown[] = []): Place => ({
  slug, name_en: name, name_vi: name, name_ja: null, category: 'food', categories: ['eats'],
  is_featured: false, vibe_tags: [], neighborhood_en: 'Hoàn Kiếm', neighborhood_vi: null,
  neighborhood_ja: null, address: null, lat: null, lng: null, opening_hours: null,
  place_photos: photos,
} as unknown as Place);

const A = place('a', 'Alpha');
const B = place('b', 'Bravo');
const C = place('c', 'Charlie');

beforeEach(() => { vi.useFakeTimers(); prefetch.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

const draw = (props: Partial<React.ComponentProps<typeof SketchDeck>> = {}) =>
  render(<SketchDeck places={[A]} span={1} {...props} />);

describe('SketchDeck', () => {
  // The two paces live in two files — the swap here, the hold in `lib` —
  // and nothing but this checks that they agree. Lengthen the swap past
  // the hold and every set spends its whole turn changing, which is the
  // fault these numbers were raised to fix, arrived at from the other
  // side.
  it('finishes a swap with the set still standing', () => {
    const rowSwap = 2 * SWAP_STEP_MS + CROSS_MS;
    expect(rowSwap).toBeLessThan(DECK_HOLD_MS);
    // And by enough to be a rest rather than a gap between two moves.
    expect(DECK_HOLD_MS - rowSwap).toBeGreaterThan(rowSwap);
  });

  // The picture and the word are timed apart on purpose and have to land
  // together: a name that settles after its photo has finished dissolving
  // is the card changing twice.
  it('lands the name inside the picture it belongs to', () => {
    expect(NAME_OUT + NAME_IN).toBe(CROSS_MS);
  });

  // The row is a hand of cards laid on a table, not a rack. What a test
  // can hold is the arithmetic under that: the shape of the row, not how
  // it looks, which is for a phone.
  describe('how the cards lie', () => {
    const row = (count: number) => Array.from({ length: count }, (_, i) => lieOf(i, count));

    it('stands the middle card highest and puts it in front', () => {
      const three = row(3);
      expect(three[1].hang).toBe(0);
      expect(Math.min(...three.map((c) => c.hang))).toBe(three[1].hang);
      expect(Math.max(...three.map((c) => c.over))).toBe(three[1].over);
    });

    // Mirrored about the middle, a row is a diagram: the eye finds the
    // axis and stops looking. No two cards may share a baseline.
    it('hangs no two cards at the same height', () => {
      for (const count of [2, 3]) {
        const hangs = row(count).map((c) => c.hang);
        expect(new Set(hangs).size).toBe(count);
      }
    });

    // A single card is still a card somebody put down.
    it('leans every card, including the only one', () => {
      for (const count of [1, 2, 3]) {
        for (const card of row(count)) expect(card.tilt).not.toBe(0);
      }
    });

    // The formula has to cover a row wider than `deckSpan` allows today,
    // which is the reason it is a formula.
    it('lies a row wider than the deck asks for', () => {
      const four = row(4);
      expect(new Set(four.map((c) => c.hang)).size).toBe(4);
      expect(four.every((c) => Number.isFinite(c.over))).toBe(true);
    });
  });

  // Scenery behind the cards: a dotted run, a handful of loose strokes,
  // and the pin they run to.
  it('draws the trail behind the cards', () => {
    draw();
    expect(document.querySelectorAll('[data-stub="Path"]').length).toBe(2);
    expect(document.querySelector('[data-icon="location"]')).toBeTruthy();
  });

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

  // The jerk this fixes was not the fade. A cover is only asked for when
  // something renders it, so the first card of a set used to be asking
  // the network for its photo at the moment it was uncovered, and what
  // came back up was an empty frame that filled in a beat later.
  it('asks for the next plan’s covers while this one is still up', () => {
    const D = place('d', 'Delta', [shot('https://example.test/d.jpg')]);
    const E = place('e', 'Echo', [shot('https://example.test/e.jpg')]);
    draw({ places: [A], next: [D, E], span: 2 });
    expect(prefetch).toHaveBeenCalledWith(['https://example.test/d.jpg', 'https://example.test/e.jpg']);
    // And they are not on screen — only asked for.
    expect(screen.queryByText('Delta')).toBeNull();
  });

  // The reverse of what #669 asserted, and deliberately.
  //
  // That change keyed the view by its uri so a swap threw the old one
  // away, because an old-to-new blend running under a dip came back up as
  // two photos mixed. With the dip gone the blend is the effect, and it
  // needs the old bitmap to blend *from* — which only the same view has.
  // A new view would have nothing, and would show the fill until its own
  // picture decoded: the empty frame this screen has been reported for
  // four times.
  it('keeps one picture view across a swap, so it has something to dissolve from', async () => {
    const P = place('p', 'Papa', [shot('https://example.test/p.jpg')]);
    const Q = place('q', 'Quebec', [shot('https://example.test/q.jpg')]);
    const { rerender } = draw({ places: [P], span: 1 });
    const before = document.querySelector('img');
    expect(before?.getAttribute('src')).toBe('https://example.test/p.jpg');

    rerender(<SketchDeck places={[Q]} span={1} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    const after = document.querySelector('img');
    expect(after?.getAttribute('src')).toBe('https://example.test/q.jpg');
    // The same node wearing the new source: the old view held on to, not
    // replaced.
    expect(after).toBe(before);
  });

  it('asks for nothing when there is no plan after this one', () => {
    draw({ places: [A] });
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('swaps without a dissolve for a reader who turns Reduce Motion on mid-wait', () => {
    const { rerender } = draw();
    rerender(<SketchDeck places={[B]} span={1} still />);
    // No clock wound: the places are already the new ones.
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
  });
});
