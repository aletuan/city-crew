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
import { AccessibilityInfo, Animated, Pressable, Text } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
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
/** The waiting dots over a tab: they ride above the pill, in a layer of
 *  their own, so they are found by name rather than inside the tab. */
const dotsIn = (name: string) => document.querySelectorAll(`[data-testid="dot-${name.toLowerCase()}"]`).length;
/** The one pill, its ground, and the window of solid glyphs it carries. */
const pill = () => screen.getByTestId('tab-pill');
const ground = () => pill().firstElementChild as HTMLElement;
const solids = () => screen.getByTestId('tab-pill-glyphs');
/** A cell's width at 393pt: the island less RNW's 1px hairline either
 *  side and the 4pt inset either side, in five. */
const CELL = (393 - 44 - 2 - 8) / 5;
const tx = (el: HTMLElement) => Number(/translateX\((-?[\d.]+)px\)/.exec(el.style.transform)?.[1]);

beforeEach(() => {
  win.width = 393;
  auth.session = { user: { id: 'me' } };
  crew.ships = { data: [], reload: vi.fn(), loadedAt: Date.now() };
  invitations.waiting = 0;
  trips.data = [];
  theme.scheme = 'dark';
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the five tabs', () => {
  // Glyphs only (11 Oct 2026): the names are for VoiceOver, and drawn
  // nowhere on the bar.
  it('names each tab for VoiceOver, draws no caption, and marks the selected one', () => {
    mount(propsFor(1).props);
    expect(screen.getAllByRole('tab').map((el) => el.getAttribute('aria-label'))).toEqual(NAMES);
    expect(screen.getAllByRole('tab').map((el) => el.textContent)).toEqual(['', '', '', '', '']);
    // Every tab draws its idle glyph; the solid ones are drawn once, in
    // the pill's window, so whichever cell the pill is over shows solid.
    // (`accessibilityState.selected` is set too, but react-native-web
    // drops it on the floor — see `Chip`.)
    expect(tab('Ideas').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('compass-outline');
    expect(tab('Profile').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('person-outline');
    // The Places tab (route `Explore`) draws no font glyph: its mark is
    // `PlacesGlyph`, an outline in the tab and solid in the window.
    expect(tab('Explore').querySelector('[data-icon]')).toBeNull();
    expect(tab('Explore').querySelector('[data-testid="places-pin"]')?.getAttribute('d')).not.toBe(PIN_SOLID);
    expect([...solids().querySelectorAll('[data-icon]')].map((g) => g.getAttribute('data-icon')))
      .toEqual(['compass', 'calendar', 'bookmark', 'person']);
    expect(solids().querySelector('[data-testid="places-pin"]')?.getAttribute('d')).toBe(PIN_SOLID);
  });

  // The pill stands over the selected cell, and its window looks back at
  // the row from there, so the solid glyph it shows is that cell's.
  it('stands the pill over the selected cell, its window on that cell’s glyph', () => {
    const { unmount } = mount(propsFor(0).props);
    expect(tx(pill())).toBe(0);
    unmount();
    mount(propsFor(3).props);
    expect(tx(pill())).toBeCloseTo(3 * CELL);
    expect(tx(solids())).toBeCloseTo(-3 * CELL);
  });

  // Under the pill the idle glyph gives way to the solid one; elsewhere
  // it is the whole mark.
  it('hides the idle glyph under the pill and nowhere else', () => {
    mount(propsFor(2).props);
    const shown = (name: string) => Number((tab(name).querySelector('[data-icon]')!.parentElement as HTMLElement).style.opacity);
    expect(shown('Trips')).toBe(0);
    expect(shown('Ideas')).toBe(1);
    expect(shown('Collections')).toBe(1);
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
    const solid = (i: number) => solids().querySelectorAll('[data-icon]')[i].getAttribute('data-color');
    const { unmount } = mount(propsFor(2).props);
    expect(solid(1)).toBe(PALETTES.charcoal.pillInk);       // Trips, near-black on solid coral
    expect(ink('Ideas')).toBe(PALETTES.charcoal.text);      // full-strength paper, never a mid grey
    unmount();

    theme.scheme = 'light';
    mount(propsFor(2).props);
    expect(solid(1)).toBe(PALETTES.paper.pillInk);          // 5.16:1 on pale coral
    expect(ink('Ideas')).toBe(PALETTES.paper.text);
  });

  // The pill is the look's solid badge: the cell's width, 56 tall in the
  // 64pt island, round-ended. One of it, whichever tab is selected.
  it('draws one pill, a cell wide, in the look’s badge colour', () => {
    mount(propsFor(2).props);
    expect(screen.getAllByTestId('tab-pill')).toHaveLength(1);
    expect(parseFloat(pill().style.width)).toBeCloseTo(CELL);
    const style = getComputedStyle(ground());
    expect(style.backgroundColor).toBe('rgb(255, 111, 91)'); // charcoal's badgeSolid
    expect(getComputedStyle(pill()).height).toBe('56px');
    expect(style.borderTopLeftRadius).toBe('28px');
  });

  // Drawn at 25, not 22: at 22 the ink came out a few points smaller than
  // Threads' in a pill of the same size. Both kinds of glyph, the
  // Ionicons four and the drawn pin.
  it('draws every glyph at the one size', () => {
    mount(propsFor(0).props);
    for (const name of ['Ideas', 'Trips', 'Collections', 'Profile']) {
      expect(tab(name).querySelector('[data-icon]')!.getAttribute('data-size')).toBe('25');
    }
    expect(tab('Explore').querySelector('[data-stub="Svg"]')!.getAttribute('width')).toBe('25');
    for (const g of solids().querySelectorAll('[data-icon]')) expect(g.getAttribute('data-size')).toBe('25');
    expect(solids().querySelector('[data-stub="Svg"]')!.getAttribute('width')).toBe('25');
  });

  // As far from the rim at the sides as above and below: the first and
  // last pills meet the rim on three sides, and an uneven gap there is
  // what the owner saw against Threads. The cells carry no inset of their
  // own, so the row's is the whole of it.
  it('keeps the pill as far from the rim at the sides as above and below', () => {
    mount(propsFor(0).props);
    const cell = tab('Ideas');
    const row = getComputedStyle(cell.parentElement!);
    const above = (64 - parseFloat(getComputedStyle(pill()).height)) / 2;
    expect(above).toBe(4);
    expect(parseFloat(row.paddingLeft)).toBe(above);
    expect(parseFloat(row.paddingRight)).toBe(above);
    // The pill itself starts the inset in, inside the island's hairline.
    expect(parseFloat(getComputedStyle(pill()).left)).toBe(above);
    expect(parseFloat(getComputedStyle(pill()).top)).toBe(above - 1);
    expect(parseFloat(getComputedStyle(cell).paddingLeft || '0')).toBe(0);
    expect(parseFloat(getComputedStyle(cell).paddingRight || '0')).toBe(0);
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

// The pill's journey, after a 60fps recording of Threads: it leaves on a
// spring, stretched toward where it is going and lifted, and lands. The
// animations are read off their calls — what each is asked to reach —
// and the landing off the pill itself.
describe('the pill’s travel', () => {
  const tree = (props: BottomTabBarProps) => (
    <TabBarDuckProvider><Scroller /><FloatingTabBar {...props} /></TabBarDuckProvider>
  );
  const asked = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map((c) => (c[1] as { toValue: number }).toValue);

  it('travels on a spring, stretched toward the tab and lifted, and lands on it', async () => {
    const spring = vi.spyOn(Animated, 'spring');
    const timing = vi.spyOn(Animated, 'timing');
    const { rerender } = render(tree(propsFor(0).props));
    rerender(tree(propsFor(2).props));
    // Two cells over: the pill runs 1.56 wide, and rises.
    expect(asked(spring)).toContain(2 * CELL);
    expect(spring.mock.calls.every((c) => (c[1] as { useNativeDriver: boolean }).useNativeDriver)).toBe(true);
    expect(asked(timing)).toEqual(expect.arrayContaining([1.56, 1]));
    await waitFor(() => expect(tx(pill())).toBeCloseTo(2 * CELL, 0), { timeout: 2000 });
    expect(tx(solids())).toBeCloseTo(-2 * CELL, 0);
  });

  // One cell over covers both glyphs; however far it goes, the stretch
  // stops at 1.6.
  it('stretches by the distance, to a ceiling', () => {
    const timing = vi.spyOn(Animated, 'timing');
    const { rerender } = render(tree(propsFor(0).props));
    rerender(tree(propsFor(1).props));
    expect(asked(timing)).toContain(1.28);
    timing.mockClear();
    rerender(tree(propsFor(4).props));
    expect(asked(timing)).toContain(1.6);
  });

  it('only slides, unstretched and unlifted, when Reduce Motion is on', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spring = vi.spyOn(Animated, 'spring');
    const timing = vi.spyOn(Animated, 'timing');
    const { rerender } = render(tree(propsFor(0).props));
    // The setting is read once, asynchronously, at mount.
    await act(async () => {});
    timing.mockClear();
    rerender(tree(propsFor(3).props));
    expect(spring).not.toHaveBeenCalled();
    expect(asked(timing)).toEqual([3 * CELL]);
    // Nor does a press lift it.
    fireEvent.mouseDown(tab('Collections'), { button: 0 });
    expect(asked(timing)).toEqual([3 * CELL]);
  });

  // The selected tab under the finger: the pill rises, rather than the
  // cell shrinking away; and settles on release.
  it('lifts the pill while the selected tab is held, and only that tab', () => {
    // The press responder starts a press on a timer, so the clock is faked
    // for the hold.
    vi.useFakeTimers();
    const timing = vi.spyOn(Animated, 'timing');
    const hold = (name: string) => {
      fireEvent.mouseDown(tab(name), { button: 0 });
      act(() => { vi.advanceTimersByTime(150); });
    };
    render(tree(propsFor(1).props));
    timing.mockClear();
    hold('Ideas');
    expect(asked(timing)).not.toContain(0.7);
    fireEvent.mouseUp(tab('Ideas'), { button: 0 });
    timing.mockClear();
    hold('Explore');
    expect(asked(timing)).toContain(0.7);
    fireEvent.mouseUp(tab('Explore'), { button: 0 });
    expect(asked(timing)).toContain(0);
  });

  // On a pale look the lift is the page laid over the pill — it pales
  // toward glass; on a dark one, the type, faintly. Never a darkening.
  it('pales the lifted pill with the look’s own colours', () => {
    const veil = () => ground().firstElementChild as HTMLElement;
    const { unmount } = render(tree(propsFor(0).props));
    expect(getComputedStyle(veil()).backgroundColor).toBe('rgb(247, 247, 245)'); // charcoal's text
    expect(veil().style.opacity).toBe('0');
    unmount();
    theme.scheme = 'light';
    render(tree(propsFor(0).props));
    expect(getComputedStyle(veil()).backgroundColor).toBe('rgb(245, 241, 234)'); // paper's page
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
    const ring = () => (screen.getByTestId('dot-profile') as HTMLElement).style.borderTopColor;
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
