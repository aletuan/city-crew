// @vitest-environment jsdom
//
// Four lines, then "Read more ⌄" on a line of its own; open, the whole
// text and "Show less ⌃" in the same place under it.
//
// `onTextLayout` never fires in jsdom, which lays nothing out, so the
// component's own handler is called with the lines a phone would have
// reported. What that pins is what is drawn around the measurement.

import React from 'react';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import { colors, type } from '../theme';
import { CHIP_H, CHIP_SLOP } from './ui';
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
const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean) as object[]);

const LINE = 'Cà phê ở Đà Lạt bắt ';
const TEXT = LINE.repeat(8).trim();
const measure = (lines: number) => act(() => {
  (textProps().onTextLayout as (e: unknown) => void)({
    nativeEvent: { lines: Array.from({ length: lines }, () => ({ text: LINE, width: 200 })) },
  });
});

describe('MoreText', () => {
  it('stops at four lines', () => {
    expect(MORE_LINES).toBe(4);
  });

  it('paints the whole text first, unclamped, to measure it', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    expect(screen.getByTestId('desc').textContent).toBe(TEXT);
    expect(textProps().numberOfLines).toBeUndefined();
    expect(screen.queryByText('Read more')).toBeNull();
  });

  it('leaves a text of four lines alone, with no link', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    measure(MORE_LINES);
    expect(screen.getByTestId('desc').textContent).toBe(TEXT);
    expect(textProps().numberOfLines).toBeUndefined();
    expect(screen.queryByTestId('desc-more')).toBeNull();
    expect(screen.queryByText('Read more')).toBeNull();
  });

  // Five lines: four drawn by the platform's own clamp, the whole text
  // kept (no cut of ours), and "Read more" under it, not after its words.
  // The paragraph and the link are one button — VoiceOver hears all of it.
  it('stops a longer text at four lines with "Read more" on a line of its own', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    measure(MORE_LINES + 1);
    expect(textProps().numberOfLines).toBe(4);
    expect(screen.getByTestId('desc').textContent).toBe(TEXT);
    const button = screen.getByTestId('desc-more');
    expect(button.textContent).toBe(`${TEXT}Read more`);
    // Not inside the paragraph's Text: its own row.
    expect(screen.getByTestId('desc').contains(screen.getByText('Read more'))).toBe(false);
    expect(button.querySelector('[data-icon="chevron-down"]')).toBeTruthy();
    const press = propsWhere((p) => p.testID === 'desc-more');
    expect(press.accessibilityLabel).toBe(TEXT);
    expect(press.accessibilityRole).toBe('button');
    expect(press.accessibilityHint).toBe('Read more');
    expect(press['aria-expanded']).toBe(false);
  });

  it('opens to the whole text with "Show less" under it, and closes again', () => {
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    render(<MoreText text={TEXT} testID="desc" />);
    measure(5);
    fireEvent.click(screen.getByTestId('desc-more'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('desc').textContent).toBe(TEXT);
    expect(textProps().numberOfLines).toBeUndefined();
    const less = screen.getByTestId('desc-less');
    expect(less.textContent).toBe('Show less');
    expect(less.querySelector('[data-icon="chevron-up"]')).toBeTruthy();
    expect(screen.getByTestId('desc').contains(less)).toBe(false);
    // The paragraph is not the way back: a tap on it does nothing.
    fireEvent.click(screen.getByTestId('desc'));
    expect(screen.getByTestId('desc-less')).toBeTruthy();
    fireEvent.click(less);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('desc-more')).toBeTruthy();
    expect(textProps().numberOfLines).toBe(4);
    spy.mockRestore();
  });

  // The card's other word-and-chevron, the visibility control: the
  // secondary grey, the meta size, regular; the chevron a step lighter.
  it('draws both links as the visibility control is drawn', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    measure(5);
    const word = (label: string) => flat(propsWhere((p) => p.children === label).style);
    const chevron = (name: string) => propsWhere((p) => p.name === name);
    for (const [label, name] of [['Read more', 'chevron-down'], ['Show less', 'chevron-up']] as const) {
      expect(word(label)).toMatchObject({ color: colors.textSecondary, ...type.meta });
      expect(chevron(name)).toMatchObject({ size: 13, color: colors.textTertiary });
      const row = flat(propsWhere((p) => {
        const st = flat(p.style);
        return st.flexDirection === 'row' && st.height === CHIP_H;
      }).style);
      expect(row).toMatchObject({ gap: 5, alignItems: 'center' });
      if (label === 'Read more') fireEvent.click(screen.getByTestId('desc-more'));
    }
  });

  // A 32pt row made a 44pt target, and only as wide as its words.
  it('gives "Show less" the chip slop and its own width', () => {
    render(<MoreText text={TEXT} testID="desc" />);
    measure(5);
    fireEvent.click(screen.getByTestId('desc-more'));
    const less = propsWhere((p) => p.testID === 'desc-less');
    expect(less.hitSlop).toEqual(CHIP_SLOP);
    expect(flat(less.style).alignSelf).toBe('flex-start');
  });

  it('measures a new text afresh, and closed', () => {
    const { rerender } = render(<MoreText text={TEXT} testID="desc" />);
    measure(5);
    fireEvent.click(screen.getByTestId('desc-more'));
    rerender(<MoreText text={`${TEXT} more`} testID="desc" />);
    expect(screen.getByTestId('desc').textContent).toBe(`${TEXT} more`);
    expect(textProps().onTextLayout).toBeTypeOf('function');
    measure(5);
    expect(screen.getByTestId('desc-more')).toBeTruthy();
    expect(screen.queryByTestId('desc-less')).toBeNull();
  });

  it('opens without the slide under Reduce Motion', async () => {
    const still = vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    render(<MoreText text={TEXT} testID="desc" />);
    await act(async () => { await Promise.resolve(); });
    measure(5);
    fireEvent.click(screen.getByTestId('desc-more'));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId('desc-less')).toBeTruthy();
    spy.mockRestore();
    still.mockRestore();
  });

  it('takes no ids for its links when it has none', () => {
    render(<MoreText text={TEXT} />);
    act(() => {
      (propsWhere((p) => typeof p.onTextLayout === 'function').onTextLayout as (e: unknown) => void)({
        nativeEvent: { lines: Array.from({ length: 5 }, () => ({ text: LINE, width: 200 })) },
      });
    });
    expect(propsWhere((p) => p.accessibilityHint === 'Read more').testID).toBeUndefined();
    fireEvent.click(screen.getByRole('button'));
    expect(propsWhere((p) => p.onPress !== undefined && p.hitSlop !== undefined).testID).toBeUndefined();
  });
});
