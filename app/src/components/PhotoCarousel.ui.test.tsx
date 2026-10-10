// @vitest-environment jsdom
//
// The paging every photo carousel in the app shares: a page per item,
// the page in hand reported from a momentum end and clamped to the pages
// there are, the width measured or given, the marks in the corner, the
// credit of the page on screen while the switch is on, and overlays a
// screen lays between the pictures and the marks.
//
// jsdom lays nothing out and react-native-web's ScrollView has no
// momentum to end, so the carousel's own handlers are called with what a
// phone would have reported.

import React from 'react';
import { Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../uitest/render';

const state = vi.hoisted(() => ({ credit: false }));
vi.mock('../lib/useFlag', () => ({ useFlag: () => state.credit }));

import PhotoCarousel from './PhotoCarousel';

type Shot = { uri: string; by: string | null };
const shots: Shot[] = [{ uri: 'a', by: 'Lan' }, { uri: 'b', by: 'Minh' }, { uri: 'c', by: null }];

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
  propsWhere((p) => p.testID === 'car' && 'onLayout' in p).onLayout({ nativeEvent: { layout: { width } } });
});
const swipe = (x: number) => act(() => {
  propsWhere((p) => !!p.horizontal && 'onMomentumScrollEnd' in p).onMomentumScrollEnd({ nativeEvent: { contentOffset: { x } } });
});

const draw = (over: Partial<React.ComponentProps<typeof PhotoCarousel<Shot>>> = {}) => {
  const onPage = vi.fn();
  const r = render(
    <PhotoCarousel
      pages={shots}
      page={0}
      onPage={onPage}
      aspectRatio={2}
      renderPage={(sh, i, style) => <Text key={sh.uri} style={style} testID={`page-${i}`}>{sh.uri}</Text>}
      attributionOf={(sh) => sh.by}
      testID="car"
      {...over}
    />,
  );
  return { ...r, onPage };
};

beforeEach(() => { state.credit = false; });

describe('PhotoCarousel', () => {
  it('draws one page per item, each at the measured width and the given proportion', () => {
    draw();
    measure(300);
    expect(screen.getAllByTestId(/^page-/)).toHaveLength(3);
    const style = propsWhere((p) => p.testID === 'page-0').style as { width: number; aspectRatio: number };
    expect(style).toEqual({ width: 300, aspectRatio: 2 });
  });

  it('takes a width and a height when given them instead of measuring', () => {
    draw({ width: 390, height: 320, aspectRatio: undefined });
    expect(propsWhere((p) => p.testID === 'page-0').style).toEqual({ width: 390, height: 320 });
  });

  it('reports the page a momentum end landed on, rounded and clamped', () => {
    const { onPage } = draw();
    measure(300);
    swipe(300); expect(onPage).toHaveBeenLastCalledWith(1);
    swipe(170); expect(onPage).toHaveBeenLastCalledWith(1);
    swipe(140); expect(onPage).toHaveBeenLastCalledWith(0);
    swipe(1500); expect(onPage).toHaveBeenLastCalledWith(2);
    swipe(-300); expect(onPage).toHaveBeenLastCalledWith(0);
  });

  it('counts the pages in the corner it is told, following the page it is given', () => {
    const { rerender } = draw({ countRight: 22, countBottom: 15 });
    const pill = screen.getByTestId('car-count') as HTMLElement;
    expect(pill.textContent).toBe('1 / 3');
    expect(pill.style.right).toBe('22px');
    expect(pill.style.bottom).toBe('15px');
    rerender(
      <PhotoCarousel pages={shots} page={2} onPage={() => {}} aspectRatio={2} attributionOf={(sh) => sh.by}
        renderPage={(sh, i, style) => <Text key={sh.uri} style={style} testID={`page-${i}`}>{sh.uri}</Text>} testID="car" />,
    );
    expect(screen.getByTestId('car-count').textContent).toBe('3 / 3');
  });

  it('credits the page on screen, only while the switch is on', () => {
    state.credit = true;
    const { rerender } = draw({ page: 1 });
    expect(screen.getByText('Minh')).toBeTruthy();
    expect(screen.queryByText('Lan')).toBeNull();
    rerender(
      <PhotoCarousel pages={shots} page={2} onPage={() => {}} aspectRatio={2} attributionOf={(sh) => sh.by}
        renderPage={(sh, i, style) => <Text key={sh.uri} style={style}>{sh.uri}</Text>} testID="car" />,
    );
    expect(screen.queryByText(/Lan|Minh/)).toBeNull();
  });

  it('prints no credit while the switch is off', () => {
    draw({ page: 0 });
    expect(screen.queryByText('Lan')).toBeNull();
  });

  it('lays a screen’s overlays between the pictures and the marks', () => {
    draw({ children: <Text testID="scrim">scrim</Text> });
    const root = screen.getByTestId('car');
    const order = [...root.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'));
    expect(order.indexOf('page-0')).toBeLessThan(order.indexOf('scrim'));
    expect(order.indexOf('scrim')).toBeLessThan(order.indexOf('car-count'));
  });

  it('draws nothing at all for no pages', () => {
    draw({ pages: [] });
    expect(screen.queryByTestId('car')).toBeNull();
  });
});
