// @vitest-environment jsdom
//
// The tab bar as a floating island.
//
// Nothing under `src` imports it but `App`, so no screen test had ever
// rendered it, and the three things it decides had no test: which tab a
// press goes to (and when it does not), which tabs wear a waiting dot,
// and when the shared crew copy is asked to refresh. Its duck — hiding
// while the reader scrolls — is `tabBarDuck`'s and is pinned there; what
// is pinned here is that a navigation brings the bar back.

import React from 'react';
import { Pressable, Text } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { FriendshipRow } from '../lib/friends';
import { TAB_BAR_HEIGHT } from './ui';

const auth = vi.hoisted(() => ({ session: { user: { id: 'me' } } as { user: { id: string } } | null }));
const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[], reload: vi.fn(), loadedAt: null as number | null },
}));
const invitations = vi.hoisted(() => ({ waiting: 0 }));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ session: auth.session }) }));
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));
vi.mock('../lib/invitations', () => ({ useInvitations: () => invitations }));
const theme = vi.hoisted(() => ({ scheme: 'dark' as 'dark' | 'light' }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: theme.scheme }) }));

import FloatingTabBar from './FloatingTabBar';
import { TabBarDuckProvider, useTabBarDuck } from './tabBarDuck';

const NAMES = ['Ideas', 'Explore', 'Trips', 'Collections', 'Profile'];

/** The navigator's props, the way `@react-navigation/bottom-tabs` hands
 *  them over: a state with five routes, a descriptor per route, and a
 *  navigation that can be asked whether a press was prevented. */
const propsFor = (index: number, prevent = false) => {
  const navigation = {
    emit: vi.fn(() => ({ defaultPrevented: prevent })),
    navigate: vi.fn(),
  };
  const state = { index, routes: NAMES.map((name) => ({ key: `${name}-k`, name })) };
  const descriptors = Object.fromEntries(NAMES.map((name) => [`${name}-k`, { options: { title: name } }]));
  return { navigation, props: { state, descriptors, navigation } as unknown as BottomTabBarProps };
};

/** A screen that can duck the bar, standing beside it in the tree. */
function Scroller() {
  const { report } = useTabBarDuck();
  return (
    <Pressable accessibilityRole="button" onPress={() => { report(0); report(100); report(140); }}>
      <Text>scroll</Text>
    </Pressable>
  );
}

const mount = (props: BottomTabBarProps) => render(
  <TabBarDuckProvider><Scroller /><FloatingTabBar {...props} /></TabBarDuckProvider>,
);
const tab = (name: string) => screen.getByRole('tab', { name });
const dotsIn = (name: string) => tab(name).querySelectorAll('div').length;

beforeEach(() => {
  auth.session = { user: { id: 'me' } };
  crew.ships = { data: [], reload: vi.fn(), loadedAt: Date.now() };
  invitations.waiting = 0;
  theme.scheme = 'dark';
});
afterEach(() => { vi.useRealTimers(); });

describe('the five tabs', () => {
  it('draws each tab with its name, and marks the selected one', () => {
    mount(propsFor(1).props);
    expect(screen.getAllByRole('tab').map((el) => el.textContent)).toEqual(NAMES);
    // The selected glyph is the solid one; the rest are outlines. (The
    // `selected` state itself is set, but react-native-web drops
    // `accessibilityState` on the floor — see `Chip` — so the glyph is
    // what a test can read.)
    expect(tab('Explore').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('compass');
    expect(tab('Ideas').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('bulb-outline');
    expect(tab('Profile').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('person-outline');
  });

  it('goes to the tab that was pressed, after telling the navigator', () => {
    const { navigation, props } = propsFor(0);
    mount(props);
    fireEvent.click(tab('Trips'));

    expect(navigation.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'Trips-k', canPreventDefault: true });
    expect(navigation.navigate).toHaveBeenCalledWith('Trips');
  });

  it('does not navigate to the tab already showing', () => {
    const { navigation, props } = propsFor(2);
    mount(props);
    fireEvent.click(tab('Trips'));

    expect(navigation.emit).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('falls back to the route’s own name when the navigator gave it no title', () => {
    const { props } = propsFor(0);
    (props.descriptors as Record<string, { options: { title?: string } }>)['Trips-k'].options = {};
    mount(props);
    expect(tab('Trips')).toBeTruthy();
  });

  it('tells the navigator about a long press, and goes nowhere', () => {
    const { navigation, props } = propsFor(0);
    mount(props);
    // A press held past react-native-web's long-press delay: down, the
    // clock moved, up. The clock is faked for the hold alone.
    vi.useFakeTimers();
    fireEvent.mouseDown(tab('Trips'), { button: 0 });
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.mouseUp(tab('Trips'), { button: 0 });

    expect(navigation.emit).toHaveBeenCalledWith({ type: 'tabLongPress', target: 'Trips-k' });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  // The pill's ink is measured per theme — see PILL_INK_LIGHT — and the
  // idle glyphs are full-strength ink or paper, never a mid grey.
  it('inks the captions for paper under a light theme, and for charcoal under dark', () => {
    // The caption's colour is the one decided in render, so it lands
    // inline where a test can read it; the glyph's goes to the icon font.
    const ink = (name: string) => screen.getByText(name).style.color;
    const { unmount } = mount(propsFor(1).props);
    expect(ink('Explore')).toBe('rgb(20, 19, 16)');   // PILL_INK_DARK on solid coral
    expect(ink('Ideas')).toBe('rgb(247, 247, 245)');  // full-strength paper, never a mid grey
    unmount();

    theme.scheme = 'light';
    mount(propsFor(1).props);
    expect(ink('Explore')).toBe('rgb(163, 55, 36)');  // PILL_INK_LIGHT: 5.16:1 on pale coral
    expect(ink('Ideas')).toBe('rgb(23, 21, 15)');
  });

  it('stands down when a listener prevented the press', () => {
    const { navigation, props } = propsFor(0, true);
    mount(props);
    fireEvent.click(tab('Profile'));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});

describe('the waiting dots', () => {
  const request = (addressee: string): FriendshipRow => ({
    requester: 'linh', addressee, status: 'pending', created_at: '2026-09-01',
  });

  it('marks Profile when somebody is waiting on an answer from this reader', () => {
    const { unmount } = mount(propsFor(0).props);
    const quiet = dotsIn('Profile');
    unmount();

    crew.ships.data = [request('me')];
    mount(propsFor(0).props);
    expect(dotsIn('Profile')).toBe(quiet + 1);
  });

  it('does not mark Profile for a request this reader sent', () => {
    const { unmount } = mount(propsFor(0).props);
    const quiet = dotsIn('Profile');
    unmount();

    crew.ships.data = [{ requester: 'me', addressee: 'linh', status: 'pending', created_at: '2026-09-01' }];
    mount(propsFor(0).props);
    expect(dotsIn('Profile')).toBe(quiet);
  });

  it('marks Trips for an invitation waiting on an answer', () => {
    const { unmount } = mount(propsFor(0).props);
    const quiet = dotsIn('Trips');
    unmount();

    invitations.waiting = 2;
    mount(propsFor(0).props);
    expect(dotsIn('Trips')).toBe(quiet + 1);
  });

  it('marks nothing for a reader who is signed out', () => {
    crew.ships.data = [request('me')];
    const { unmount } = mount(propsFor(0).props);
    const signedIn = dotsIn('Profile');
    unmount();

    auth.session = null;
    mount(propsFor(0).props);
    expect(dotsIn('Profile')).toBe(signedIn - 1);
  });
});

describe('the shared crew copy', () => {
  // A request per tab switch was the old price of an honest badge; now
  // the copy is asked again only once it has gone stale.
  it('is refreshed on mount when it has gone stale', () => {
    crew.ships.loadedAt = Date.now() - 10 * 60 * 1000;
    mount(propsFor(0).props);
    expect(crew.ships.reload).toHaveBeenCalledTimes(1);
  });

  it('is left alone while it is fresh', () => {
    mount(propsFor(0).props);
    expect(crew.ships.reload).not.toHaveBeenCalled();
  });

  it('is never asked for on behalf of nobody', () => {
    auth.session = null;
    crew.ships.loadedAt = null;
    mount(propsFor(0).props);
    expect(crew.ships.reload).not.toHaveBeenCalled();
  });
});

describe('the duck', () => {
  // The island itself: two levels above a tab (the row, then the bar).
  // What ducking does to it is read from its inline transform and
  // opacity — the Animated values land there — rather than from
  // `pointerEvents`, which react-native-web turns into a class name.
  const bar = () => screen.getAllByRole('tab')[0].parentElement!.parentElement as HTMLElement;
  // `useTabBarLift` with no safe-area inset is the gap alone, 10pt.
  const AWAY = `translateY(${TAB_BAR_HEIGHT + 10 + 8}px)`;

  it('slides below the edge and fades while the reader scrolls', () => {
    mount(propsFor(0).props);
    expect(bar().style.opacity).toBe('1');
    expect(bar().style.transform).toBe('translateY(0px)');

    fireEvent.click(screen.getByRole('button', { name: 'scroll' }));
    expect(bar().style.opacity).toBe('0');
    expect(bar().style.transform).toBe(AWAY);
  });

  // A navigation is exactly the moment the reader reached for the bar —
  // keyed on the whole state, so a push inside a tab brings it back too.
  it('comes back on any navigation, not only a tab change', () => {
    const { props } = propsFor(0);
    const view = mount(props);
    fireEvent.click(screen.getByRole('button', { name: 'scroll' }));
    expect(bar().style.opacity).toBe('0');

    // Same index, new state object: a push inside the same tab.
    const pushed = { ...props, state: { ...props.state, routes: [...props.state.routes] } } as BottomTabBarProps;
    view.rerender(<TabBarDuckProvider><Scroller /><FloatingTabBar {...pushed} /></TabBarDuckProvider>);
    expect(bar().style.opacity).toBe('1');
    expect(bar().style.transform).toBe('translateY(0px)');
  });
});
