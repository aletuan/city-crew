// @vitest-environment jsdom
// The one heart (18 Nov 2026): what it draws in each tone, what VoiceOver
// hears, and when it moves — for the reader's own press, and for nothing
// else. `Animated` does not tick here: an animation lands at once, so
// what is checked is that one was started, with what, and what is left
// drawn when it is over.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { AccessibilityInfo, Animated } from 'react-native';
import { act, fireEvent, render, screen, textStyleOf, viewStyleOf } from '../uitest/render';
import { colors, onPhoto } from '../theme';
import { LIKE_ON_DARK, LIKE_ON_LIGHT } from '../lib/likeInk';

const state = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, t: (en: string, vi: string) => (state.lang === 'vi' ? vi : en) }),
}));

import LikeHeart, { POP_PEAK, PRESS_WINDOW_MS, rollWay } from './LikeHeart';

// A size no default has, so a tally drawn in any other type is caught.
const COUNT = { fontSize: 13.5 };
type Props = Partial<React.ComponentProps<typeof LikeHeart>>;
const onPress = vi.fn();
const heart = (p: Props = {}) => (
  <LikeHeart liked={false} count={0} onPress={onPress} countStyle={COUNT} testID="heart" countTestID="count" {...p} />
);
const glyph = () => {
  const g = screen.getByTestId('heart').querySelector('[data-icon]')!;
  return [g.getAttribute('data-icon'), g.getAttribute('data-size'), g.getAttribute('data-color')];
};
const flush = async () => { await act(async () => {}); };
/** The tally's type, as it was handed over. */
const typeOf = (el: Element) => {
  const st = textStyleOf(el as HTMLElement);
  return { fontSize: parseFloat(String(st?.fontSize)) };
};

let timing: MockInstance<typeof Animated.timing>;
let spring: MockInstance<typeof Animated.spring>;
const NOW = Date.parse('2026-11-18T01:00:00Z');
beforeEach(() => {
  state.lang = 'en';
  onPress.mockClear();
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  timing = vi.spyOn(Animated, 'timing');
  spring = vi.spyOn(Animated, 'spring');
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('rollWay', () => {
  it('is up when the tally grew and down when it fell', () => {
    expect(rollWay(3, 4)).toBe(1);
    expect(rollWay(4, 3)).toBe(-1);
    expect(rollWay(0, 1)).toBe(1);
    expect(rollWay(1, 0)).toBe(-1);
  });
});

describe('what it draws', () => {
  it('is an outline at 18 in the secondary grey on a card, and filled in the like’s red once liked', () => {
    const { rerender } = render(heart());
    expect(glyph()).toEqual(['heart-outline', '18', String(colors.textSecondary)]);
    rerender(heart({ liked: true }));
    expect(glyph()).toEqual(['heart', '18', String(colors.like)]);
  });

  it('is 15 and white over a photograph, and the like’s red for a photograph once liked', () => {
    const { rerender } = render(heart({ tone: 'photo' }));
    expect(glyph()).toEqual(['heart-outline', '15', String(onPhoto.text)]);
    rerender(heart({ tone: 'photo', liked: true }));
    expect(glyph()).toEqual(['heart', '15', String(onPhoto.like)]);
    // The like's own red in every look (28 Nov 2026), not the look's
    // accent: that was a teal on one look and near-white on another.
    expect(onPhoto.like).toBe(LIKE_ON_DARK);
    expect([LIKE_ON_LIGHT, LIKE_ON_DARK]).toContain(String(colors.like));
  });

  it('prints the tally from one, in the type it was handed, and nothing at none', () => {
    const { rerender } = render(heart());
    expect(screen.queryByTestId('count')).toBeNull();
    expect(screen.getByTestId('heart').textContent).toBe('');
    rerender(heart({ count: 1 }));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(typeOf(screen.getByTestId('count'))).toEqual(COUNT);
  });

  it('lays its row out as it is told, and stands where it is told', () => {
    render(heart({ style: { marginLeft: 'auto' }, contentStyle: { flexDirection: 'row', gap: 5 } }));
    const button = screen.getByTestId('heart');
    expect(viewStyleOf(button).marginLeft).toBe('auto');
    expect(viewStyleOf(button.firstElementChild as HTMLElement)).toMatchObject({ flexDirection: 'row', gap: 5 });
  });
});

describe('what VoiceOver hears', () => {
  it('names the collection where it is one heart of many', () => {
    const { rerender } = render(heart());
    expect(screen.getByRole('button', { name: 'Like this collection' })).toBe(screen.getByTestId('heart'));
    rerender(heart({ liked: true }));
    expect(screen.getByRole('button', { name: 'Unlike this collection' })).toBeTruthy();
  });

  it('says only Like where the list is the page’s subject', () => {
    const { rerender } = render(heart({ brief: true }));
    expect(screen.getByRole('button', { name: 'Like' })).toBeTruthy();
    rerender(heart({ brief: true, liked: true }));
    expect(screen.getByRole('button', { name: 'Unlike' })).toBeTruthy();
  });

  it('says both in Vietnamese', () => {
    state.lang = 'vi';
    const { rerender } = render(heart());
    expect(screen.getByRole('button', { name: 'Thích bộ sưu tập này' })).toBeTruthy();
    rerender(heart({ liked: true }));
    expect(screen.getByRole('button', { name: 'Bỏ thích bộ sưu tập này' })).toBeTruthy();
    rerender(heart({ brief: true }));
    expect(screen.getByRole('button', { name: 'Thích' })).toBeTruthy();
    rerender(heart({ brief: true, liked: true }));
    expect(screen.getByRole('button', { name: 'Bỏ thích' })).toBeTruthy();
  });
});

describe('when it moves', () => {
  /** The targets of every animation started so far. */
  const moved = () => [...timing.mock.calls, ...spring.mock.calls].map(([, cfg]) => cfg.toValue);
  const press = () => fireEvent.click(screen.getByTestId('heart'));

  it('passes the press on, and moves nothing until something changes', async () => {
    render(heart());
    await flush();
    press();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(moved().filter((v) => v === POP_PEAK)).toEqual([]);
    expect(screen.queryByTestId('like-count-rolling')).toBeNull();
  });

  it('swells and springs home when the reader’s press likes it, and slides the tally up', async () => {
    const { rerender } = render(heart({ count: 7 }));
    await flush();
    timing.mockClear(); spring.mockClear();
    press();
    rerender(heart({ liked: true, count: 8 }));
    await flush();
    // The swell out to the peak, the spring back to rest, and the slide.
    expect(timing.mock.calls.map(([, cfg]) => [cfg.toValue, cfg.duration])).toEqual([[POP_PEAK, 110], [1, 320]]);
    // Home, and settling once: a bounce carried it past its size and out
    // again (the owner, 18 Nov 2026: "a little too hard").
    expect(spring.mock.calls.filter(([, cfg]) => cfg.toValue === 1).map(([, cfg]) => (cfg as { bounciness?: number }).bounciness)).toEqual([0]);
    expect(POP_PEAK).toBe(1.12);
    expect(timing.mock.calls.every(([, cfg]) => cfg.useNativeDriver)).toBe(true);
    // Landed: the new figure alone, drawn plainly again.
    expect(screen.queryByTestId('like-count-rolling')).toBeNull();
    expect(screen.getByTestId('heart').textContent).toBe('8');
    expect(typeOf(screen.getByTestId('count'))).toEqual(COUNT);
  });

  it('does not swell when a like is taken back, and slides the tally down', async () => {
    const { rerender } = render(heart({ liked: true, count: 8 }));
    await flush();
    timing.mockClear(); spring.mockClear();
    press();
    rerender(heart({ liked: false, count: 7 }));
    await flush();
    expect(moved()).not.toContain(POP_PEAK);
    expect(timing.mock.calls.map(([, cfg]) => [cfg.toValue, cfg.duration])).toEqual([[1, 320]]);
    expect(screen.getByTestId('heart').textContent).toBe('7');
  });

  // While it slides: both figures, the one leaving laid over the one
  // arriving, each moving the way the tally went.
  it('draws the figure leaving over the one arriving while the tally slides', async () => {
    // Held mid-slide: the animation that would end it never reports.
    timing.mockImplementation(() => ({ start: () => {}, stop: () => {}, reset: () => {} }) as unknown as Animated.CompositeAnimation);
    const { rerender } = render(heart({ count: 7 }));
    await flush();
    press();
    rerender(heart({ liked: true, count: 8 }));
    await flush();
    const rolling = screen.getByTestId('like-count-rolling');
    expect(viewStyleOf(rolling).overflow).toBe('hidden');
    expect([...rolling.children].map((c) => c.textContent)).toEqual(['7', '8']);
    expect(viewStyleOf(rolling.children[0])).toMatchObject({ position: 'absolute', left: 0, top: 0 });
    expect(viewStyleOf(rolling.children[1]).position).toBeUndefined();
    expect(screen.getByTestId('count')).toBe(rolling.children[1]);
    expect(typeOf(rolling.children[0])).toEqual(COUNT);
    expect(typeOf(rolling.children[1])).toEqual(COUNT);
  });

  // Up when it grew: the figure leaving rises out and the one arriving
  // comes from below. Down when it fell: the reverse. 14pt either way.
  it('sends the two figures the way the tally went', async () => {
    timing.mockImplementation(() => ({ start: () => {}, stop: () => {}, reset: () => {} }) as unknown as Animated.CompositeAnimation);
    const interpolate = vi.spyOn(Animated.Value.prototype, 'interpolate');
    // Of the last draw: the one before it still holds the slide before.
    const travelled = () => interpolate.mock.calls.map(([cfg]) => cfg.outputRange).filter((r) => r.some((v) => Math.abs(Number(v)) === 14)).slice(-2);
    const { rerender } = render(heart({ count: 7 }));
    await flush();
    press();
    interpolate.mockClear();
    rerender(heart({ liked: true, count: 8 }));
    await flush();
    expect(new Set(travelled().map(String))).toEqual(new Set(['0,-14', '14,0']));
    press();
    interpolate.mockClear();
    rerender(heart({ liked: false, count: 7 }));
    await flush();
    expect(new Set(travelled().map(String))).toEqual(new Set(['0,14', '-14,0']));
  });

  it('slides the first like in with nothing leaving, and the last one out with nothing arriving', async () => {
    timing.mockImplementation(() => ({ start: () => {}, stop: () => {}, reset: () => {} }) as unknown as Animated.CompositeAnimation);
    const { rerender } = render(heart());
    await flush();
    press();
    rerender(heart({ liked: true, count: 1 }));
    await flush();
    expect([...screen.getByTestId('like-count-rolling').children].map((c) => c.textContent)).toEqual(['1']);
    // And back to none: the one leaving holds the line, in flow.
    press();
    rerender(heart({ liked: false, count: 0 }));
    await flush();
    const rolling = screen.getByTestId('like-count-rolling');
    expect([...rolling.children].map((c) => c.textContent)).toEqual(['1']);
    expect(viewStyleOf(rolling.children[0]).position).toBeUndefined();
    expect(screen.queryByTestId('count')).toBeNull();
  });

  // The tallies arrive after a shelf is drawn, and other people like
  // things: none of that is this reader's press.
  it('draws a change nobody pressed for at once', async () => {
    const { rerender } = render(heart());
    await flush();
    timing.mockClear(); spring.mockClear();
    rerender(heart({ liked: true, count: 12 }));
    await flush();
    expect(moved()).toEqual([]);
    expect(screen.queryByTestId('like-count-rolling')).toBeNull();
    expect(screen.getByTestId('count').textContent).toBe('12');
    expect(glyph()[0]).toBe('heart');
  });

  it('draws a change at once when it comes a second or more after the press', async () => {
    const { rerender } = render(heart({ count: 7 }));
    await flush();
    press();
    timing.mockClear(); spring.mockClear();
    vi.setSystemTime(NOW + PRESS_WINDOW_MS);
    rerender(heart({ liked: true, count: 8 }));
    await flush();
    expect(moved()).toEqual([]);
    expect(screen.getByTestId('count').textContent).toBe('8');
    // One millisecond inside the window, it moves.
    press();
    vi.setSystemTime(NOW + 2 * PRESS_WINDOW_MS - 1);
    rerender(heart({ liked: false, count: 7 }));
    await flush();
    expect(moved()).toEqual([1]);
  });

  it('swells without a slide when the like changes and the tally does not', async () => {
    const { rerender } = render(heart({ count: 3 }));
    await flush();
    timing.mockClear(); spring.mockClear();
    press();
    rerender(heart({ liked: true, count: 3 }));
    await flush();
    expect(timing.mock.calls.map(([, cfg]) => cfg.toValue)).toEqual([POP_PEAK]);
    expect(screen.queryByTestId('like-count-rolling')).toBeNull();
  });

  it('moves nothing for a reader who asked for less motion', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { rerender } = render(heart({ count: 7 }));
    await flush();
    timing.mockClear(); spring.mockClear();
    press();
    rerender(heart({ liked: true, count: 8 }));
    await flush();
    expect(moved()).toEqual([]);
    expect(screen.queryByTestId('like-count-rolling')).toBeNull();
    expect(screen.getByTestId('count').textContent).toBe('8');
    expect(glyph()).toEqual(['heart', '18', String(colors.like)]);
  });
});
