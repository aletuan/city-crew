// @vitest-environment jsdom
//
// The hold-and-drag the collection screen and the plan editor share. What
// is pinned, with the touch system's side played by hand the way the
// collection's own test plays it: a lift is a haptic and a held row; a
// release before the list claims the touch is a drop where the row was,
// and moves nothing; once claimed, the finger's travel over the rows'
// measured pitches picks the slot, with a tick on each change; letting go
// (or being terminated) lands the row and reports the move once; and the
// rows' styles — the held one raised and travelling, the passed ones
// stepped aside by the held one's pitch, the rest untouched. Given a grid,
// the same with the finger counted both ways and the tiles stepping a cell
// along, round a row's end.

import React, { useEffect } from 'react';
import { Animated, PanResponder, View, type PanResponderCallbacks } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '../uitest/render';

// A phone's window: jsdom's own is 0 tall to React Native's eyes.
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
}));
const fireHaptic = vi.hoisted(() => vi.fn());
vi.mock('./ui', async (orig) => ({ ...(await orig<Record<string, unknown>>()), fireHaptic }));

import {
  LIFT_AFTER_MS, SCROLL_EDGE, SCROLL_MAX, useListDrag, type DragGrid, type DragScroll, type ListDrag,
} from './useListDrag';

// The responder as the hook made it, with its callbacks kept.
const responder = vi.hoisted(() => ({ config: null as null | PanResponderCallbacks }));
const realCreate = PanResponder.create.bind(PanResponder);
vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
  responder.config = config;
  return realCreate(config);
});

const api = { current: null as ListDrag | null };
const onMove = vi.fn();

/** Three rows under the hook, their styles on view, the hook's handle kept. */
function Rows({ keys, grid, scroll }: { keys: readonly string[]; grid?: DragGrid; scroll?: DragScroll }) {
  const d = useListDrag({ keys, onMove, pitchGuess: 100, grid, scroll });
  useEffect(() => { api.current = d; });
  return (
    <View ref={d.areaRef} {...d.panHandlers}>
      {keys.map((k, i) => <Animated.View key={k} testID={`row-${k}`} style={d.styleOf(i)} />)}
      <Animated.Text testID="state">{d.lift ? `${d.lift.from}>${d.lift.to}` : 'idle'}</Animated.Text>
    </View>
  );
}

const d = () => api.current!;
const cfg = () => responder.config!;
const evt = {} as never;
const Y0 = 480;
const at = (dy: number) => ({ moveY: Y0 + dy }) as never;
const lift = (i: number) => act(() => { d().onLift(i, Y0); });
const release = () => act(() => { d().onRelease(); });
/** The finger's first move: the list asks for the touch and, when it wants
 *  it, is granted it and the row's button is told it has lost it. */
const claim = () => {
  let wanted = false;
  act(() => {
    wanted = !!cfg().onMoveShouldSetPanResponderCapture!(evt, at(0));
    if (wanted) { cfg().onPanResponderGrant!(evt, at(0)); d().onRelease(); }
  });
  return wanted;
};
const move = (dy: number) => act(() => { cfg().onPanResponderMove!(evt, at(dy)); });
const drop = () => act(() => { cfg().onPanResponderRelease!(evt, at(0)); });
const state = () => screen.getByTestId('state').textContent;
const measure = (k: string, h: number) => act(() => { d().onPitch(k, h); });
const styleOf = (k: string) => (screen.getByTestId(`row-${k}`) as HTMLElement).style;

beforeEach(() => {
  responder.config = null;
  api.current = null;
  onMove.mockReset();
  fireHaptic.mockReset();
  render(<Rows keys={['a', 'b', 'c']} />);
});
afterEach(() => { vi.clearAllMocks(); });

describe('useListDrag', () => {
  it('holds under iOS’s own long press and over a tap', () => {
    expect(LIFT_AFTER_MS).toBeGreaterThanOrEqual(300);
    expect(LIFT_AFTER_MS).toBeLessThan(500);
  });

  it('lifts a row with a tap of the haptic, and holds it where it is', () => {
    expect(state()).toBe('idle');
    lift(1);
    expect(state()).toBe('1>1');
    expect(fireHaptic).toHaveBeenCalledWith('light');
  });

  it('wants the touch only while a row is up, and never gives it back', () => {
    expect(cfg().onMoveShouldSetPanResponderCapture!(evt, at(0))).toBe(false);
    lift(0);
    expect(cfg().onMoveShouldSetPanResponderCapture!(evt, at(0))).toBe(true);
    expect(cfg().onPanResponderTerminationRequest!(evt, at(0))).toBe(false);
  });

  it('puts a row down where it was when the finger comes up without moving', () => {
    lift(1);
    release();
    expect(state()).toBe('idle');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('keeps the row up when the release is the list taking the touch over', () => {
    lift(1);
    expect(claim()).toBe(true);
    expect(state()).toBe('1>1');
    expect(onMove).not.toHaveBeenCalled();
  });

  // Rows are 100 tall until measured. A row is passed once the held row's
  // centre is past the middle of it: 50 down is not past b, 60 is.
  it('picks the slot from the travel over the rows’ pitches, with a tick on each change', () => {
    lift(0);
    claim();
    fireHaptic.mockReset();
    move(40);
    expect(state()).toBe('0>0');
    expect(fireHaptic).not.toHaveBeenCalled();
    move(60);
    expect(state()).toBe('0>1');
    expect(fireHaptic).toHaveBeenCalledTimes(1);
    expect(fireHaptic).toHaveBeenCalledWith('selection');
    move(160);
    expect(state()).toBe('0>2');
    expect(fireHaptic).toHaveBeenCalledTimes(2);
    // Back up: no tick for a move that changes nothing.
    move(170);
    expect(fireHaptic).toHaveBeenCalledTimes(2);
    move(-10);
    expect(state()).toBe('0>0');
  });

  it('measures the rows as they are, not as guessed', () => {
    measure('b', 300);
    lift(0);
    claim();
    // Past b's middle is now 150 of travel, not 50.
    move(140);
    expect(state()).toBe('0>0');
    move(160);
    expect(state()).toBe('0>1');
  });

  it('lands the row and reports the move once on letting go', () => {
    lift(2);
    claim();
    move(-160);
    expect(state()).toBe('2>0');
    drop();
    expect(state()).toBe('idle');
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(2, 0);
    // A second release, from the row's button catching up, is not a second drop.
    release();
    drop();
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('reports nothing when the row lands where it started', () => {
    lift(1);
    claim();
    move(20);
    drop();
    expect(onMove).not.toHaveBeenCalled();
    expect(state()).toBe('idle');
  });

  it('lands the row when the system takes the touch away', () => {
    lift(0);
    claim();
    move(60);
    act(() => { cfg().onPanResponderTerminate!(evt, at(60)); });
    expect(onMove).toHaveBeenCalledWith(0, 1);
    expect(state()).toBe('idle');
  });

  it('ignores a move or a drop with nothing lifted', () => {
    move(60);
    drop();
    expect(onMove).not.toHaveBeenCalled();
    expect(state()).toBe('idle');
  });

  // The held row is raised and scaled; the rows it has passed step aside
  // by its pitch, the other way; the rest wear nothing.
  it('dresses the held row and the rows it has passed, and nobody else', () => {
    for (const k of ['a', 'b', 'c']) expect(styleOf(k).transform).toBe('');
    measure('a', 120);
    lift(0);
    claim();
    move(200);
    expect(state()).toBe('0>2');
    // (The raise itself — zIndex, shadow — is a StyleSheet class under
    // react-native-web, so only the travel is readable here.)
    expect(styleOf('a').transform).toMatch(/scale\(1\.02/);
    expect(styleOf('b').transform).toBe('translateY(-120px)');
    expect(styleOf('c').transform).toBe('translateY(-120px)');
    move(60);
    expect(styleOf('b').transform).toBe('translateY(-120px)');
    expect(styleOf('c').transform).toBe('');
    drop();
    for (const k of ['a', 'b', 'c']) expect(styleOf(k).transform).toBe('');
  });

  // A list's row has nowhere to go sideways, so a finger that drifts
  // across as it drags does not take the row with it.
  it('keeps a list’s row in its column whatever the finger does across', () => {
    lift(0);
    claim();
    act(() => { cfg().onPanResponderMove!(evt, { moveX: 300, moveY: Y0 + 60 } as never); });
    expect(state()).toBe('0>1');
    expect(styleOf('a').transform).toBe('translateX(0px) translateY(60px) scale(1.02)');
  });

  it('steps rows aside downward when the held row comes up from below', () => {
    measure('c', 80);
    lift(2);
    claim();
    move(-200);
    expect(styleOf('a').transform).toBe('translateY(80px)');
    expect(styleOf('b').transform).toBe('translateY(80px)');
    expect(styleOf('c').transform).toMatch(/scale\(1\.02/);
  });
});

describe('useListDrag on a grid', () => {
  // Five tiles, three to a row, a cell 100 each way:  a b c / d e
  const X0 = 150;
  const at2 = (dx: number, dy: number) => ({ moveX: X0 + dx, moveY: Y0 + dy }) as never;
  const move2 = (dx: number, dy: number) => act(() => { cfg().onPanResponderMove!(evt, at2(dx, dy)); });
  const lift2 = (i: number) => act(() => { d().onLift(i, Y0, X0); });
  beforeEach(() => {
    cleanup();
    render(<Rows keys={['a', 'b', 'c', 'd', 'e']} grid={{ cols: 3, pitch: 100 }} />);
  });

  it('counts the finger both ways from where the tile lifted, with a tick on each new cell', () => {
    lift2(0);
    claim();
    fireHaptic.mockReset();
    move2(40, 0);
    expect(state()).toBe('0>0');
    move2(60, 0);
    expect(state()).toBe('0>1');
    move2(60, 100);
    expect(state()).toBe('0>4');
    expect(fireHaptic).toHaveBeenCalledTimes(2);
    expect(styleOf('a').transform).toBe('translateX(60px) translateY(100px) scale(1.02)');
  });

  // The cells measure nothing: a row's height, which a list would read,
  // is not what a grid steps by.
  it('steps by the grid’s pitch, not the rows’ measured heights', () => {
    measure('b', 300);
    lift2(0);
    claim();
    move2(100, 0);
    expect(state()).toBe('0>1');
    expect(styleOf('b').transform).toBe('translateX(-100px) translateY(0px)');
  });

  it('steps the passed tiles a cell along, round the row’s end, and lands the tile', () => {
    lift2(4);
    claim();
    move2(-100, -100);
    expect(state()).toBe('4>0');
    expect(styleOf('a').transform).toBe('translateX(100px) translateY(0px)');
    expect(styleOf('c').transform).toBe('translateX(-200px) translateY(100px)');
    expect(styleOf('d').transform).toBe('translateX(100px) translateY(0px)');
    drop();
    expect(onMove).toHaveBeenCalledWith(4, 0);
    for (const k of ['a', 'b', 'c', 'd', 'e']) expect(styleOf(k).transform).toBe('');
  });

  // One cell held by something that does not move, as the collection's
  // "Add place" is:  + a b / c d e. The rows are counted from 0 still;
  // the cells they stand in are one on.
  describe('a cell in', () => {
    beforeEach(() => {
      cleanup();
      render(<Rows keys={['a', 'b', 'c', 'd', 'e']} grid={{ cols: 3, pitch: 100, lead: 1 }} />);
    });

    it('lands by the cells the tiles stand in, and steps them round their own rows’ ends', () => {
      lift2(0);
      claim();
      move2(0, 100);
      // a's cell is the first row's middle, so down a row is d's.
      expect(state()).toBe('0>3');
      expect(styleOf('b').transform).toBe('translateX(-100px) translateY(0px)');
      expect(styleOf('c').transform).toBe('translateX(200px) translateY(-100px)');
      expect(styleOf('d').transform).toBe('translateX(-100px) translateY(0px)');
      drop();
      expect(onMove).toHaveBeenCalledWith(0, 3);
    });

    it('lands a tile let go over the held cell first', () => {
      lift2(2);
      claim();
      move2(0, -100);
      expect(state()).toBe('2>0');
      drop();
      expect(onMove).toHaveBeenCalledWith(2, 0);
    });
  });
});

// Past the edge of the screen (owner, 22 Oct 2026): the list is held still
// under a drag, so near either end of the part that shows it scrolls
// itself, a frame at a time, and the distance it scrolls is the row's.
describe('useListDrag near the ends of a list that scrolls', () => {
  // The list shows from 100 to 700 on screen, 600 tall, over 1600 of
  // content: it can scroll 1000. It says how tall its content is when it
  // lays out, before anybody has scrolled it.
  const TOP = 100;
  const BOTTOM = 700;
  const to = vi.fn();
  const scrollTo = (y: number) => act(() => { d().onScrolled({ contentOffset: { x: 0, y } } as never); });
  const show = (scroll: DragScroll) => {
    cleanup();
    render(<Rows keys={['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']} scroll={scroll} />);
    (d().areaRef.current as unknown as { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void })
      .measureInWindow = (cb) => cb(0, TOP, 390, BOTTOM - TOP);
    act(() => { d().onContentSizeChange(390, 1600); });
  };
  const fingerAt = (pageY: number) => act(() => { cfg().onPanResponderMove!(evt, { moveX: 0, moveY: pageY } as never); });
  const frames = (n: number) => act(() => { for (let i = 0; i < n; i++) vi.advanceTimersToNextFrame(); });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    to.mockReset();
    show({ to });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('keeps still while the finger is clear of both ends', () => {
    act(() => { d().onLift(2, 400); });
    claim();
    fingerAt(BOTTOM - SCROLL_EDGE - 1);
    frames(5);
    expect(to).not.toHaveBeenCalled();
  });

  it('scrolls on near the foot, a frame at a time, and the row travels with it', () => {
    act(() => { d().onLift(0, 400); });
    claim();
    // Half way into the foot's edge: half the most, each frame.
    fingerAt(BOTTOM - SCROLL_EDGE / 2);
    frames(3);
    const step = SCROLL_MAX / 2;
    expect(to.mock.calls.map(([y]) => y)).toEqual([step, step * 2, step * 3]);
    scrollTo(step * 3);
    // The finger moved 264, the list 21 under it: the row is 285 down,
    // past b, c and the middle of d, so over d.
    expect(styleOf('a').transform).toBe(`translateX(0px) translateY(${BOTTOM - SCROLL_EDGE / 2 - 400 + step * 3}px) scale(1.02)`);
    expect(state()).toBe('0>3');
  });

  it('scrolls back near the top, and stops at the start', () => {
    scrollTo(20);
    act(() => { d().onLift(5, 400); });
    claim();
    fingerAt(TOP);
    frames(3);
    // The most each frame, until there is no further to go.
    expect(to.mock.calls.map(([y]) => y)).toEqual([20 - SCROLL_MAX, 0]);
  });

  it('stops at the end of the list', () => {
    scrollTo(995);
    act(() => { d().onLift(0, 400); });
    claim();
    fingerAt(BOTTOM);
    frames(4);
    expect(to.mock.calls.map(([y]) => y)).toEqual([1000]);
  });

  it('stops when the row is let go', () => {
    act(() => { d().onLift(0, 400); });
    claim();
    fingerAt(BOTTOM);
    frames(1);
    drop();
    frames(5);
    expect(to).toHaveBeenCalledTimes(1);
  });

  // The floating bar lies over the list's foot, so the edge starts at the
  // bar's top: on an 844 window, a bar covering 244 leaves the list
  // showing to 600, not 700.
  it('measures the foot’s edge from the top of what lies over it', () => {
    show({ to, coveredBelow: 244 });
    act(() => { d().onLift(0, 300); });
    claim();
    fingerAt(600 - SCROLL_EDGE - 1);
    frames(2);
    expect(to).not.toHaveBeenCalled();
    fingerAt(600 - SCROLL_EDGE / 2);
    frames(1);
    expect(to).toHaveBeenCalledWith(SCROLL_MAX / 2);
  });
});

describe('useListDrag without a scroll', () => {
  it('never asks for a frame', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    lift(0);
    claim();
    move(10_000);
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });
});
