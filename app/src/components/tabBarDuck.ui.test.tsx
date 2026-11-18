// @vitest-environment jsdom
//
// The floating tab bar's scroll etiquette — the React half.
//
// The decision is `lib/duck`, a pure state machine with its own tests
// for every way this once went wrong. This file owns turning its edges
// into one animation and one flag, honouring Reduce Motion, and the two
// hooks a screen and the bar reach for. Every screen test stubs
// `useDuckOnScroll` to nothing, so none of this had run under a test.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';

import { TabBarDuckProvider, useDuckOnScroll, useTabBarAway, useTabBarDuck, useTabBarDucked } from './tabBarDuck';

/** A scroll event as a ScrollView would report it. */
const scroll = (y: number, max?: number) => ({
  nativeEvent: {
    contentOffset: { y, x: 0 },
    ...(max == null ? {} : { contentSize: { height: max + 600, width: 0 }, layoutMeasurement: { height: 600, width: 0 } }),
  },
}) as unknown as NativeSyntheticEvent<NativeScrollEvent>;

/** The screen and the bar, in one tree: the screen feeds scrolls in, the
 *  bar reads the flag out. `seen` keeps the Animated value for a test to
 *  read. */
const seen: { anim: Animated.Value | null } = { anim: null };
function Screen({ events }: { events: ReturnType<typeof scroll>[] }) {
  const onScroll = useDuckOnScroll();
  const { ducked, anim, show } = useTabBarDuck();
  // In an effect, not in render: the value is stable for the provider's
  // life, and a test reads it after the events it fires have landed.
  useEffect(() => { seen.anim = anim; }, [anim]);
  return (
    <>
      <Text>{ducked ? 'ducked' : 'shown'}</Text>
      <Pressable accessibilityRole="button" onPress={() => events.forEach((e) => onScroll?.(e))}><Text>scroll</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={show}><Text>show</Text></Pressable>
    </>
  );
}
const mount = (events: ReturnType<typeof scroll>[]) =>
  render(<TabBarDuckProvider><Screen events={events} /></TabBarDuckProvider>);
const feed = () => fireEvent.click(screen.getByRole('button', { name: 'scroll' }));
const value = () => (seen.anim as unknown as { __getValue: () => number }).__getValue();

beforeEach(() => {
  seen.anim = null;
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the bar’s etiquette', () => {
  it('starts shown, and stays shown near the top of a page', () => {
    // Under `topSlack` the bar never ducks, however the page moves.
    mount([scroll(0), scroll(40), scroll(70)]);
    feed();
    expect(screen.getByText('shown')).toBeTruthy();
  });

  it('ducks once the reader has scrolled into content', () => {
    mount([scroll(0), scroll(100), scroll(140)]);
    feed();
    expect(screen.getByText('ducked')).toBeTruthy();
  });

  it('comes back on the first real pull up', () => {
    mount([scroll(0), scroll(100), scroll(140), scroll(125)]);
    feed();
    expect(screen.getByText('shown')).toBeTruthy();
  });

  // The bottom bounce: iOS reports offsets past the end while the page
  // springs back, and read as movement they hid and showed the bar on a
  // page that had not moved.
  it('ignores the bounce past the end of the page', () => {
    mount([scroll(0, 500), scroll(500, 500), scroll(540, 500)]);
    feed();
    // 0 → 500 ducked it; 540 clamps to 500, which is no movement at all.
    expect(screen.getByText('ducked')).toBeTruthy();
    mount([scroll(0, 500), scroll(500, 500), scroll(540, 500), scroll(495, 500)]);
    // Only 5 back — under `showTravel` — so still ducked, where a bounce
    // that was counted as travel would have surfaced it.
    fireEvent.click(screen.getAllByRole('button', { name: 'scroll' })[1]);
    expect(screen.getAllByText('ducked')).toHaveLength(2);
  });

  it('does nothing when asked to surface a bar that is already up', () => {
    const timing = vi.spyOn(Animated, 'timing');
    mount([]);
    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    expect(screen.getByText('shown')).toBeTruthy();
    expect(timing).not.toHaveBeenCalled();
  });

  it('surfaces on demand and forgets where the page was', () => {
    mount([scroll(0), scroll(100), scroll(140)]);
    feed();
    expect(screen.getByText('ducked')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    expect(screen.getByText('shown')).toBeTruthy();
  });
});

describe('the animation', () => {
  it('slides: one timing animation per edge, on the native driver', () => {
    const timing = vi.spyOn(Animated, 'timing');
    mount([scroll(0), scroll(100), scroll(140), scroll(125)]);
    feed();
    // Hide, then show — two edges, two animations, and nothing for the
    // scroll events in between that changed no decision.
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls[0][1]).toEqual(expect.objectContaining({ toValue: 1, useNativeDriver: true }));
    expect(timing.mock.calls[1][1]).toEqual(expect.objectContaining({ toValue: 0 }));
  });

  it('jumps instead when Reduce Motion is on', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = vi.spyOn(Animated, 'timing');
    mount([scroll(0), scroll(100), scroll(140)]);
    // The setting is read once, asynchronously, at mount.
    await act(async () => {});
    feed();
    // The behaviour stays, the animation goes: the value is simply there.
    expect(timing).not.toHaveBeenCalled();
    expect(value()).toBe(1);
    // And back, the same way.
    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    expect(value()).toBe(0);
    expect(timing).not.toHaveBeenCalled();
  });
});

describe('the hooks outside the provider', () => {
  // A screen reused in a modal has no bar to talk to, and a scroll there
  // should mean nothing rather than throw.
  it('gives a screen no handler', () => {
    function Lone() {
      const handler = useDuckOnScroll();
      return <Text>{handler === undefined ? 'no handler' : 'a handler'}</Text>;
    }
    render(<Lone />);
    expect(screen.getByText('no handler')).toBeTruthy();
  });

  it('tells a screen lending its dock that the bar is here, rather than throwing', () => {
    function Lender() { return <Text>{useTabBarDucked() ? 'away' : 'here'}</Text>; }
    render(<Lender />);
    expect(screen.getByText('here')).toBeTruthy();
  });

  it('refuses the bar, loudly: it cannot work without one', () => {
    function Bar() { useTabBarDuck(); return null; }
    expect(() => render(<Bar />)).toThrow('useTabBarDuck outside TabBarDuckProvider');
  });
});

// What a screen that lends the bar's dock reads (`DockSlot`): the same
// flag the bar does.
describe('useTabBarDucked', () => {
  it('follows the bar away and back', () => {
    function Lender({ events }: { events: ReturnType<typeof scroll>[] }) {
      const onScroll = useDuckOnScroll();
      return (
        <>
          <Text>{useTabBarDucked() ? 'away' : 'here'}</Text>
          <Pressable accessibilityRole="button" onPress={() => events.forEach((e) => onScroll?.(e))}><Text>scroll</Text></Pressable>
        </>
      );
    }
    render(<TabBarDuckProvider><Lender events={[scroll(0), scroll(100), scroll(140)]} /></TabBarDuckProvider>);
    expect(screen.getByText('here')).toBeTruthy();
    feed();
    expect(screen.getByText('away')).toBeTruthy();
  });
});

// A screen with something of its own at the foot of the page keeps the
// bar away for as long as it is in front (18 Nov 2026) — the comments
// thread, whose field sits where the bar floats.
describe('a screen that holds the bar away', () => {
  type Heard = { focus: (() => void)[]; blur: (() => void)[] };
  const nav = (heard: Heard) => ({
    addListener: (event: 'focus' | 'blur', cb: () => void) => {
      heard[event].push(cb);
      return () => { heard[event] = heard[event].filter((f) => f !== cb); };
    },
  });
  function Holder({ navigation }: { navigation: ReturnType<typeof nav> }) {
    useTabBarAway(navigation);
    return null;
  }
  const bar = () => screen.getByText(/^(ducked|shown)$/).textContent;
  const mountWith = (held: boolean, heard: Heard, events: ReturnType<typeof scroll>[] = []) => render(
    <TabBarDuckProvider>
      <Screen events={events} />
      {held ? <Holder navigation={nav(heard)} /> : null}
    </TabBarDuckProvider>,
  );

  it('takes the bar away on arriving and gives it back on leaving', () => {
    const heard: Heard = { focus: [], blur: [] };
    const { rerender } = mountWith(true, heard);
    expect(bar()).toBe('ducked');
    rerender(<TabBarDuckProvider><Screen events={[]} /></TabBarDuckProvider>);
    expect(bar()).toBe('shown');
    // And stops listening to the navigator it has left.
    expect(heard).toEqual({ focus: [], blur: [] });
  });

  it('is not talked out of it by a pull up, nor by anything asking for the bar', () => {
    mountWith(true, { focus: [], blur: [] }, [scroll(400, 2000), scroll(200, 2000)]);
    feed();
    expect(bar()).toBe('ducked');
    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    expect(bar()).toBe('ducked');
  });

  it('gives the bar to a screen pushed over it, and takes it back on return', () => {
    const heard: Heard = { focus: [], blur: [] };
    mountWith(true, heard);
    act(() => heard.blur.forEach((f) => f()));
    expect(bar()).toBe('shown');
    // A second blur for the same absence releases nothing twice.
    act(() => heard.blur.forEach((f) => f()));
    act(() => heard.focus.forEach((f) => f()));
    expect(bar()).toBe('ducked');
    // Nor does a second focus hold twice: one blur is enough to let go.
    act(() => heard.focus.forEach((f) => f()));
    act(() => heard.blur.forEach((f) => f()));
    expect(bar()).toBe('shown');
  });

  it('keeps the bar away while any one of two screens still holds it', () => {
    const a: Heard = { focus: [], blur: [] };
    const b: Heard = { focus: [], blur: [] };
    render(
      <TabBarDuckProvider>
        <Screen events={[]} />
        <Holder navigation={nav(a)} />
        <Holder navigation={nav(b)} />
      </TabBarDuckProvider>,
    );
    act(() => a.blur.forEach((f) => f()));
    expect(bar()).toBe('ducked');
    act(() => b.blur.forEach((f) => f()));
    expect(bar()).toBe('shown');
  });

  it('does nothing where there is no bar to hold', () => {
    const heard: Heard = { focus: [], blur: [] };
    render(<Holder navigation={nav(heard)} />);
    expect(heard).toEqual({ focus: [], blur: [] });
  });
});
