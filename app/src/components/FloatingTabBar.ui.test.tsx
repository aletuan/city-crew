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
const trips = vi.hoisted(() => ({ data: [] as { id: string; title: string; day: string; trip_stops: { arrive_min: number | null; dwell_min: number | null }[] }[] }));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ session: auth.session }) }));
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));
vi.mock('../lib/invitations', () => ({ useInvitations: () => invitations }));
vi.mock('../lib/mytrips', () => ({ useMyTrips: () => trips }));
const theme = vi.hoisted(() => ({ scheme: 'dark' as 'dark' | 'light' }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: theme.scheme }) }));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }) }));
// The phone the island is laid out across; jsdom's own window has no width.
const win = vi.hoisted(() => ({ width: 393 }));
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: win.width, height: 852, scale: 3, fontScale: 1 }),
}));

import { PALETTES } from '../theme';
import FloatingTabBar from './FloatingTabBar';
import PlacesGlyph from './PlacesGlyph';
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
/** By the tab's caption, with or without the waiting count a dot adds to the spoken name. */
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}(,|$)`) });
/** The solid pin's outline, read off a selected glyph rendered alone, so
 *  the bar's tests can tell the two variants apart without knowing the path. */
const PIN_SOLID = (() => {
  const { container, unmount } = render(<PlacesGlyph size={22} color="#000" solid />);
  const d = container.querySelector('[data-testid="places-pin"]')!.getAttribute('d')!;
  unmount();
  return d;
})();
const dotsIn = (name: string) => tab(name).querySelectorAll('div').length;

beforeEach(() => {
  win.width = 393;
  auth.session = { user: { id: 'me' } };
  crew.ships = { data: [], reload: vi.fn(), loadedAt: Date.now() };
  invitations.waiting = 0;
  trips.data = [];
  theme.scheme = 'dark';
});
afterEach(() => { vi.useRealTimers(); });

describe('the five tabs', () => {
  // Glyphs only (11 Oct 2026): the names are for VoiceOver, and drawn
  // nowhere on the bar.
  it('names each tab for VoiceOver, draws no caption, and marks the selected one', () => {
    mount(propsFor(1).props);
    expect(screen.getAllByRole('tab').map((el) => el.getAttribute('aria-label'))).toEqual(NAMES);
    expect(screen.getAllByRole('tab').map((el) => el.textContent)).toEqual(['', '', '', '', '']);
    // The selected glyph is the solid one; the rest are outlines. (The
    // `selected` state itself is set, but react-native-web drops
    // `accessibilityState` on the floor — see `Chip` — so the glyph is
    // what a test can read.)
    expect(tab('Ideas').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('compass-outline');
    expect(tab('Profile').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('person-outline');
    // The Places tab (route `Explore`) draws no font glyph: its mark is
    // `PlacesGlyph`, solid here because it is the selected one.
    expect(tab('Explore').querySelector('[data-icon]')).toBeNull();
    expect(tab('Explore').querySelector('[data-testid="places-glyph"]')).not.toBeNull();
    expect(tab('Explore').querySelector('[data-testid="places-pin"]')?.getAttribute('d')).toBe(PIN_SOLID);
  });

  it('draws the Places glyph as an outline while another tab is selected', () => {
    mount(propsFor(0).props);
    expect(tab('Ideas').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('compass');
    expect(tab('Explore').querySelector('[data-testid="places-pin"]')?.getAttribute('d')).not.toBe(PIN_SOLID);
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

  // The disc's ink is the look's `pillInk`, measured per palette, and the
  // idle glyphs are full-strength ink or paper, never a mid grey.
  it('inks the glyphs from the look: the disc’s ink when selected, full strength when idle', () => {
    const ink = (name: string) => tab(name).querySelector('[data-icon]')!.getAttribute('data-color');
    const { unmount } = mount(propsFor(2).props);
    expect(ink('Trips')).toBe(PALETTES.charcoal.pillInk);   // near-black on solid coral
    expect(ink('Ideas')).toBe(PALETTES.charcoal.text);      // full-strength paper, never a mid grey
    unmount();

    theme.scheme = 'light';
    mount(propsFor(2).props);
    expect(ink('Trips')).toBe(PALETTES.paper.pillInk);      // 5.16:1 on pale coral
    expect(ink('Ideas')).toBe(PALETTES.paper.text);
  });

  // The disc is the look's solid badge, and only the selected tab wears it.
  // The pill is the look's solid badge, and only the selected tab wears it:
  // the cell's width, 56 tall in the 64pt island, round-ended.
  it('wraps the selected tab in a pill of the look’s badge colour', () => {
    mount(propsFor(2).props);
    const pill = (name: string) => tab(name).firstElementChild as HTMLElement;
    const style = getComputedStyle(pill('Trips'));
    expect(style.backgroundColor).toBe('rgb(255, 111, 91)'); // charcoal's badgeSolid
    expect(style.height).toBe('56px');
    expect(style.width).toBe('100%');
    expect(style.borderTopLeftRadius).toBe('28px');
    expect(getComputedStyle(pill('Ideas')).backgroundColor).not.toBe('rgb(255, 111, 91)');
  });

  // The page's own margin, so its edges line up with the cards above it,
  // on any width of phone.
  it('sits the island on the page margin, whatever the phone', () => {
    const island = () => getComputedStyle(tab('Ideas').parentElement!.parentElement!);
    win.width = 320;
    const { unmount } = mount(propsFor(0).props);
    expect(island().left).toBe('22px');
    expect(island().width).toBe('276px');
    unmount();
    win.width = 440;
    mount(propsFor(0).props);
    expect(island().left).toBe('22px');
    expect(island().width).toBe('396px');
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

  // The dot is a view with no text; the count goes into the tab's spoken
  // name so a screen reader hears what the eye sees.
  it('tells VoiceOver how many friend requests are waiting, and says nothing when none are', () => {
    crew.ships = { data: [{ requester: 'them', addressee: 'me', status: 'pending', created_at: '2026-10-01T00:00:00Z' }], reload: vi.fn(), loadedAt: Date.now() };
    mount(propsFor(0).props);
    expect(tab('Profile').getAttribute('aria-label')).toBe('Profile, 1 friend request waiting');
    expect(tab('Trips').getAttribute('aria-label')).toBe('Trips');
  });

  // The ring is plain hex picked by the app's scheme, not the `dyn`
  // `badgeSolid`: a dynamic pair on a border follows the phone, so a
  // light app on a dark phone ringed the dot in charcoal-side coral.
  it('rings the dot in the app\u2019s side of the pair, whatever the phone says', () => {
    const ring = () => [...tab('Profile').querySelectorAll('div')]
      .map((d) => (d as HTMLElement).style.borderTopColor).find(Boolean);
    crew.ships.data = [request('me')];
    const { unmount } = mount(propsFor(0).props);
    expect(ring()).toBe('rgb(255, 111, 91)'); // badgeSolidHex.dark
    unmount();
    theme.scheme = 'light';
    mount(propsFor(0).props);
    expect(ring()).toBe('rgb(247, 220, 211)'); // badgeSolidHex.light
  });

  it('tells VoiceOver how many trip invitations are waiting, plural and all', () => {
    invitations.waiting = 2;
    mount(propsFor(0).props);
    expect(tab('Trips').getAttribute('aria-label')).toBe('Trips, 2 trip invitations waiting');
    expect(tab('Profile').getAttribute('aria-label')).toBe('Profile');
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

  // The third signal the bar carries, and a different kind from the two
  // before it: not somebody waiting on this reader, but the one day the
  // reader has something on. Lit on the day of a trip and only then — a
  // dot for "a trip this week" would be lit for most of a planner's life,
  // and a lit dot is no dot. The same mark as the other two, so the bar
  // has one way of saying "look here" (owner, 7 Oct 2026).
  it('marks Trips on the day of a trip, and says which', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 8, 0));
    const { unmount } = mount(propsFor(0).props);
    const quiet = dotsIn('Trips');
    unmount();

    trips.data = [{ id: 't1', title: 'Hanoi day', day: '2026-10-07', trip_stops: [{ arrive_min: 18 * 60, dwell_min: 90 }] }];
    mount(propsFor(0).props);
    expect(dotsIn('Trips')).toBe(quiet + 1);
    expect(tab('Trips').getAttribute('aria-label')).toBe('Trips, “Hanoi day” is today');
  });

  it('does not mark Trips for a trip tomorrow, nor for one that is over', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 22, 0));
    const { unmount } = mount(propsFor(0).props);
    const quiet = dotsIn('Trips');
    unmount();

    trips.data = [
      { id: 'tomorrow', title: 'Later', day: '2026-10-08', trip_stops: [{ arrive_min: 9 * 60, dwell_min: 60 }] },
      { id: 'over', title: 'Gone', day: '2026-10-07', trip_stops: [{ arrive_min: 9 * 60, dwell_min: 60 }] },
    ];
    mount(propsFor(0).props);
    expect(dotsIn('Trips')).toBe(quiet);
    expect(tab('Trips').getAttribute('aria-label')).toBe('Trips');
  });

  // Two reasons, one dot; the spoken name leads with the one somebody
  // else is waiting on.
  it('speaks the invitation first when a trip is also today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 8, 0));
    invitations.waiting = 1;
    trips.data = [{ id: 't1', title: 'Hanoi day', day: '2026-10-07', trip_stops: [] }];
    mount(propsFor(0).props);
    expect(tab('Trips').getAttribute('aria-label')).toBe('Trips, 1 trip invitation waiting');
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
