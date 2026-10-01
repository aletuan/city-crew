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
// stepped aside by the held one's pitch, the rest untouched.

import React, { useEffect } from 'react';
import { Animated, PanResponder, View, type PanResponderCallbacks } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../uitest/render';

const fireHaptic = vi.hoisted(() => vi.fn());
vi.mock('./ui', async (orig) => ({ ...(await orig<Record<string, unknown>>()), fireHaptic }));

import { LIFT_AFTER_MS, useListDrag, type ListDrag } from './useListDrag';

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
function Rows({ keys }: { keys: readonly string[] }) {
  const d = useListDrag({ keys, onMove, pitchGuess: 100 });
  useEffect(() => { api.current = d; });
  return (
    <View {...d.panHandlers}>
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
