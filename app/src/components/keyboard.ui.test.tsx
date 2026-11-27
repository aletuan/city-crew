// @vitest-environment jsdom
//
// A field that stands on the keyboard: the measured run as an easing, the
// ride that follows it, and the dock that makes room under a page.

import React from 'react';
import { Animated, Keyboard, Platform, Text, View } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, propsWhere, render, renderHook, screen } from '../uitest/render';
import { KEYBOARD_MS, KEYBOARD_RUN, keyboardCurve, keyboardRunFrom, useKeyboardDock, useRide } from './keyboard';

const heard: Record<string, ((e: unknown) => void)[]> = {};
let removed = 0;
let os: string;
beforeEach(() => {
  for (const k of Object.keys(heard)) delete heard[k];
  removed = 0;
  os = Platform.OS;
  (Platform as { OS: string }).OS = 'ios';
  vi.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: (e: unknown) => void) => {
    (heard[event] ??= []).push(cb);
    return { remove: () => { removed += 1; } };
  }) as never);
});
afterEach(() => { (Platform as { OS: string }).OS = os; cleanup(); vi.restoreAllMocks(); });
const timing = () => vi.spyOn(Animated, 'timing').mockImplementation((() => ({ start: () => {} })) as never);
const rise = (height: number) => act(() => heard.keyboardWillShow.forEach((f) => f({ duration: 400, endCoordinates: { height } })));
const fall = () => act(() => heard.keyboardWillHide.forEach((f) => f({ duration: 400, endCoordinates: { height: 0 } })));

describe('keyboardCurve', () => {
  it('is the recording: 21 frames, three quarters up in the first 100 ms', () => {
    expect(KEYBOARD_MS).toBe(350);
    expect(keyboardCurve(0)).toBe(0);
    expect(keyboardCurve(1)).toBe(1);
    expect(keyboardCurve(6 / 21)).toBeCloseTo(0.741, 3);
    expect(keyboardCurve(12 / 21)).toBeCloseTo(0.959, 3);
  });
  it('only ever rises, and reads between two frames in a straight line', () => {
    for (let i = 1; i < KEYBOARD_RUN.length; i++) expect(KEYBOARD_RUN[i]).toBeGreaterThan(KEYBOARD_RUN[i - 1]);
    expect(keyboardCurve(0.5 / 21)).toBeCloseTo(0.167 / 2, 6);
    expect(keyboardCurve(20.5 / 21)).toBeCloseTo(0.999, 6);
  });
  it('holds at its ends for a time outside the run', () => {
    expect(keyboardCurve(-0.2)).toBe(0);
    expect(keyboardCurve(1.3)).toBe(1);
  });
});

describe('keyboardRunFrom', () => {
  it('is the whole run with no head start', () => {
    expect(keyboardRunFrom(0)).toEqual({ easing: keyboardCurve, duration: 350 });
  });
  it('starts where the keyboard already is, and takes only what is left', () => {
    const two = keyboardRunFrom(2);
    expect(two.duration).toBe(317);
    expect(two.easing(0)).toBeCloseTo(0.3, 6);
    expect(two.easing(1 / 19)).toBeCloseTo(0.438, 6);
    expect(two.easing(1)).toBe(1);
  });
  it('never asks for more than the run has, or less than none', () => {
    expect(keyboardRunFrom(-3).duration).toBe(350);
    const late = keyboardRunFrom(99);
    expect(late.duration).toBe(17);
    expect(late.easing(0)).toBeCloseTo(0.998, 6);
  });
});

describe('useRide', () => {
  it('gives each way the head start it was asked for', () => {
    const run = timing();
    renderHook(() => useRide(34, { rise: 1, fall: 2 }));
    rise(336);
    expect(run.mock.calls[0][1].duration).toBe(333);
    expect(run.mock.calls[0][1].easing!(0)).toBeCloseTo(0.167, 6);
    fall();
    expect(run.mock.calls[1][1].duration).toBe(317);
    expect(run.mock.calls[1][1].easing!(0)).toBeCloseTo(0.3, 6);
  });

  it('rises by the keyboard less the margin, on the measured run and not the event\'s, and comes back', () => {
    const run = timing();
    const { result } = renderHook(() => useRide(34));
    expect(result.current.lift).toBe(0);
    rise(336);
    expect(run.mock.calls[0][1]).toMatchObject({ toValue: -302, duration: 350, easing: keyboardCurve, useNativeDriver: true });
    expect(result.current.lift).toBe(302);
    fall();
    expect(run.mock.calls[1][1]).toMatchObject({ toValue: 0, duration: 350, easing: keyboardCurve });
    expect(result.current.lift).toBe(0);
  });
  it('never sinks below the foot for a keyboard shorter than the margin', () => {
    const run = timing();
    const { result } = renderHook(() => useRide(34));
    rise(20);
    expect(run.mock.calls[0][1].toValue).toBe(0);
    expect(result.current.lift).toBe(0);
  });
  it('stops listening when it goes', () => {
    renderHook(() => useRide(34)).unmount();
    expect(removed).toBe(2);
  });
  it('leaves the keyboard to the window off iOS', () => {
    (Platform as { OS: string }).OS = 'android';
    renderHook(() => useRide(34));
    expect(heard.keyboardWillShow).toBeUndefined();
  });
});

describe('useKeyboardDock', () => {
  function Page() {
    const { dock, room } = useKeyboardDock(34);
    return <View><Text testID="room">{room}</Text>{dock(<Text>field</Text>)}</View>;
  }
  it('docks the field over the foot and asks for its height, and the keyboard\'s while it is up', () => {
    timing();
    render(<Page />);
    const room = () => screen.getByTestId('room').textContent;
    const docked = getComputedStyle(screen.getByTestId('keyboard-dock'));
    expect([docked.position, docked.bottom]).toEqual(['absolute', '0px']);
    expect(screen.getByText('field')).toBeTruthy();
    expect(room()).toBe('0');
    act(() => (propsWhere((q) => q.testID === 'keyboard-dock' && 'onLayout' in q).onLayout as (e: unknown) => void)({ nativeEvent: { layout: { height: 90 } } }));
    expect(room()).toBe('90');
    rise(336);
    expect(room()).toBe('392');
    fall();
    expect(room()).toBe('90');
  });
});
