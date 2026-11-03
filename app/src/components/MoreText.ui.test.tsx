// @vitest-environment jsdom
//
// Five lines, then "… Read more" on the fifth; open, the whole text and
// "Show less" after its last word.
//
// `onTextLayout` never fires in jsdom, which lays nothing out, so the
// component's own handler is called with the lines a phone would have
// reported. What that pins is what is drawn around the measurement.

import React from 'react';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import { colors } from '../theme';
import MoreText, { MORE_LINES } from './MoreText';

/** The props React committed for the first element `pick` accepts. */
const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, unknown> => {
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
// The Text's, not MoreText's own, which carries the same id.
const textProps = () => propsWhere((p) => p.testID === 'desc' && !('text' in p));

const LINE = 'Cà phê ở Đà Lạt bắt ';
const TEXT = LINE.repeat(8).trim();
const measure = (lines: number) => act(() => {
  (textProps().onTextLayout as (e: unknown) => void)({
    nativeEvent: { lines: Array.from({ length: lines }, () => ({ text: LINE, width: 200 })) },
  });
});

describe('MoreText', () => {
  it('paints the whole text first, unclamped, to measure it', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    expect(screen.getByTestId('desc').textContent).toBe(TEXT);
    expect(textProps().numberOfLines).toBeUndefined();
    expect(screen.queryByText('Read more')).toBeNull();
  });

  it('leaves a text of five lines alone, with no link', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    measure(MORE_LINES);
    expect(screen.getByTestId('desc').textContent).toBe(TEXT);
    expect(textProps().numberOfLines).toBeUndefined();
    expect(textProps().onPress).toBeUndefined();
    expect(screen.queryByText('Read more')).toBeNull();
  });

  // Six lines: five drawn, the fifth ending "… Read more" in the accent,
  // and the paragraph the button — VoiceOver hears all of it.
  it('stops a longer text at five lines with "… Read more" on the fifth', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    measure(6);
    const el = screen.getByTestId('desc');
    expect(textProps().numberOfLines).toBe(5);
    expect(el.textContent!.endsWith('… Read more')).toBe(true);
    expect(el.textContent!.length).toBeLessThan(TEXT.length);
    expect(getComputedStyle(screen.getByText('Read more')).color)
      .not.toBe(getComputedStyle(el).color);
    expect(textProps().accessibilityLabel).toBe(TEXT);
    expect(textProps().accessibilityRole).toBe('button');
    expect(textProps()['aria-expanded']).toBe(false);
  });

  it('opens to the whole text with "Show less" after it, and closes again', () => {
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    render(<MoreText text={TEXT} testID="desc" />);
    measure(6);
    fireEvent.click(screen.getByTestId('desc'));
    expect(spy).toHaveBeenCalledTimes(1);
    const el = screen.getByTestId('desc');
    expect(el.textContent).toBe(`${TEXT} Show less`);
    expect(textProps().numberOfLines).toBeUndefined();
    expect(textProps()['aria-expanded']).toBe(true);
    fireEvent.click(screen.getByTestId('desc-less'));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('desc').textContent!.endsWith('… Read more')).toBe(true);
    spy.mockRestore();
  });

  // The link is the accent, as "Clear" and "Reset" are.
  it('inks both links in the accent', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    measure(6);
    const ink = (label: string) => (propsWhere((p) => p.children === label).style as { color?: unknown }).color;
    expect(ink('Read more')).toBe(colors.accent);
    fireEvent.click(screen.getByTestId('desc'));
    expect(ink('Show less')).toBe(colors.accent);
  });

  it('measures a new text afresh, and closed', () => {
    const { rerender } = render(<MoreText text={TEXT} testID="desc" />);
    measure(6);
    fireEvent.click(screen.getByTestId('desc'));
    rerender(<MoreText text={`${TEXT} more`} testID="desc" />);
    expect(screen.getByTestId('desc').textContent).toBe(`${TEXT} more`);
    expect(textProps().onTextLayout).toBeTypeOf('function');
    measure(6);
    expect(screen.getByTestId('desc').textContent!.endsWith('… Read more')).toBe(true);
  });

  it('opens without the slide under Reduce Motion', async () => {
    const still = vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    render(<MoreText text={TEXT} testID="desc" />);
    await act(async () => { await Promise.resolve(); });
    measure(6);
    fireEvent.click(screen.getByTestId('desc'));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId('desc').textContent).toBe(`${TEXT} Show less`);
    spy.mockRestore();
    still.mockRestore();
  });

  it('takes no id for its "Show less" when it has none', () => {
    render(<MoreText text={TEXT} />);
    act(() => {
      (propsWhere((p) => typeof p.onTextLayout === 'function').onTextLayout as (e: unknown) => void)({
        nativeEvent: { lines: Array.from({ length: 6 }, () => ({ text: LINE, width: 200 })) },
      });
    });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Show less').getAttribute('data-testid')).toBeNull();
  });
});
