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
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, viewStyleOf, waitFor } from '../uitest/render';
import type { FriendshipRow } from '../lib/friends';
import { TAB_BAR_HEIGHT } from './ui';

const auth = vi.hoisted(() => ({
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
  // The reader's own row, for the face on the last tab.
  profile: null as { avatar_url: string } | null,
}));
const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[], reload: vi.fn(), loadedAt: null as number | null },
}));
const invitations = vi.hoisted(() => ({ waiting: 0 }));
const trips = vi.hoisted(() => ({ data: [] as { id: string; title: string; day: string; trip_stops: { arrive_min: number | null; dwell_min: number | null }[] }[] }));
vi.mock('../lib/auth', () => {
  const m = { useAuth: () => ({ session: auth.session, profile: auth.profile }) };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));
vi.mock('../lib/invitations', () => ({ useInvitations: () => invitations }));
vi.mock('../lib/mytrips', () => ({ useMyTrips: () => trips }));
const rewards = vi.hoisted(() => ({ unseen: [] as string[] }));
vi.mock('../lib/rewards', () => ({ useRewards: () => rewards }));
const freshNews = vi.hoisted(() => ({ fresh: 0, freshen: vi.fn() }));
vi.mock('../lib/freshNews', () => ({ useFreshNews: () => freshNews }));
const theme = vi.hoisted(() => ({ scheme: 'dark' as 'dark' | 'light' }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: theme.scheme }) }));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }) }));
// The phone the island is laid out across; jsdom's own window has no width.
const win = vi.hoisted(() => ({ width: 393 }));
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: win.width, height: 852, scale: 3, fontScale: 1 }),
}));

// The switch trace, as the bar calls it. Stood in for whole: the real one
// is a module singleton with a three-second timer and an insert behind it,
// and what it does with these calls is `lib/tabtrace.test.ts`'s to pin.
const trace = vi.hoisted(() => ({
  down: vi.fn(), press: vi.fn(), commit: vi.fn(), settled: vi.fn(), device: [] as unknown[],
}));
vi.mock('../lib/tabtrace', () => ({
  tabTrace: { down: trace.down, press: trace.press, commit: trace.commit },
  tabSettled: (device: unknown) => { trace.device.push(device); return trace.settled; },
}));
vi.mock('../lib/channel', () => ({ CHANNEL: 'preview', IS_PRODUCTION_CHANNEL: false }));

// The guide's anchor on the collections tab, as the bar asks for it: the
// real hook, with what it was asked kept.
const anchorCalls = vi.hoisted(() => [] as unknown[][]);
const anchorRefs = vi.hoisted(() => new Map<string, { current: unknown }>());
vi.mock('./SignupTour', async (orig) => {
  const real = await orig<typeof import('./SignupTour')>();
  return {
    ...real,
    useTourAnchor: (...args: Parameters<typeof real.useTourAnchor>) => {
      anchorCalls.push(args);
      const ref = real.useTourAnchor(...args);
      anchorRefs.set(args[0], ref);
      return ref;
    },
  };
});

import { PALETTES, PILL_FADE, pillInk } from '../theme';
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
/** By the tab's caption, with or without the waiting count a dot adds to the spoken name. */
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}(,|$)`) });
/** The waiting dots over a tab: they ride above the pill, in a layer of
 *  their own, so they are found by name rather than inside the tab. */
const dotsIn = (name: string) => document.querySelectorAll(`[data-testid="dot-${name.toLowerCase()}"]`).length;
/** The one pill, its ground, and the window of pill-ink glyphs it carries. */
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
  auth.profile = null;
  crew.ships = { data: [], reload: vi.fn(), loadedAt: Date.now() };
  invitations.waiting = 0;
  trips.data = [];
  rewards.unseen = [];
  freshNews.fresh = 0;
  freshNews.freshen.mockClear();
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
    // Every tab draws its idle glyph; the pill's copies are drawn once, in
    // its window. (`accessibilityState.selected` is set too, but
    // react-native-web drops it on the floor — see `Chip`.)
    //
    // The five are Ionicons' outlines, the app's one family (owner, 18
    // Nov 2026), and the pill's copies are the same outlines, not solids:
    // the pill says which tab (owner, 12 Nov 2026).
    const marks = ['compass-outline', 'location-outline', 'calendar-outline', 'bookmark-outline', 'person-outline'];
    expect(NAMES.map((n) => tab(n).querySelector('[data-icon]')?.getAttribute('data-icon'))).toEqual(marks);
    expect([...solids().querySelectorAll('[data-icon]')].map((g) => g.getAttribute('data-icon'))).toEqual(marks);
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
    expect(solid(2)).toBe(PALETTES.charcoal.pillInk);       // Trips, near-black on solid coral
    expect(ink('Ideas')).toBe(PALETTES.charcoal.text);      // full-strength paper, never a mid grey
    unmount();

    theme.scheme = 'light';
    mount(propsFor(2).props);
    expect(solid(2)).toBe(PALETTES.paper.pillInk);          // 5.16:1 on pale coral
    expect(ink('Ideas')).toBe(PALETTES.paper.text);
  });

  // The pill is the look's solid badge carried a fifth of the way to the
  // page (owner, 2 Nov 2026): the cell's width, 52 tall in the 60pt
  // island, round-ended, opaque. One of it, whichever tab is selected.
  it('draws one pill, a cell wide, a step quieter than the look’s badge', () => {
    mount(propsFor(2).props);
    expect(screen.getAllByTestId('tab-pill')).toHaveLength(1);
    expect(parseFloat(pill().style.width)).toBeCloseTo(CELL);
    const style = getComputedStyle(ground());
    // charcoal's badgeSolid #FF6F5B, a fifth of the way to its #0A0B0A.
    expect(style.backgroundColor).toBe('rgb(206, 91, 75)');
    expect(getComputedStyle(pill()).height).toBe('52px');
    expect(style.borderTopLeftRadius).toBe('26px');
    // The island round-ended at its 60pt height, so its ends and the
    // pill's are concentric: 30 = 26 + the 4pt inset.
    const island = screen.getAllByRole('tab')[0].parentElement!.parentElement!;
    expect(getComputedStyle(island).height).toBe('60px');
    expect(getComputedStyle(island).borderTopLeftRadius).toBe('30px');
  });

  // Solid, so the glass under it never becomes the glyph's ground, and
  // no lighter than every look's ink can stand on.
  it('keeps every look’s pill ink over 3.6:1 on the quieter pill', () => {
    const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    for (const [name, p] of Object.entries(PALETTES)) {
      const ground = rgb(p.badgeSolid).map((c, i) => Math.round(c * (1 - PILL_FADE) + rgb(p.bg)[i] * PILL_FADE));
      const [hi, lo] = [lum(rgb(p.pillInk)), lum(ground)].sort((a, b) => b - a);
      expect([name, (hi + 0.05) / (lo + 0.05) > 3.6]).toEqual([name, true]);
    }
    expect(PILL_FADE).toBeGreaterThan(0);
  });

  // A size near Threads' (owner, 12 Nov 2026): 22, the scale's step for
  // getting about.
  it('draws every glyph at the one size', () => {
    mount(propsFor(0).props);
    const all = [...document.querySelectorAll('[data-icon]')];
    expect(all).toHaveLength(10);
    for (const g of all) {
      expect(g.getAttribute('data-size')).toBe('22');
    }
  });

  // As far from the rim at the sides as above and below: the first and
  // last pills meet the rim on three sides, and an uneven gap there is
  // what the owner saw against Threads. The cells carry no inset of their
  // own, so the row's is the whole of it.
  it('keeps the pill as far from the rim at the sides as above and below', () => {
    mount(propsFor(0).props);
    const cell = tab('Ideas');
    const row = getComputedStyle(cell.parentElement!);
    const above = (TAB_BAR_HEIGHT - parseFloat(getComputedStyle(pill()).height)) / 2;
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

// `lib/tabtrace` measures a change of tab from the finger coming down to
// the pill coming to rest. The arithmetic is its own; what is the bar's is
// calling it at the four instants, and at no others.
describe('what a switch reports', () => {
  const tree = (props: BottomTabBarProps) => (
    <TabBarDuckProvider><Scroller /><FloatingTabBar {...props} /></TabBarDuckProvider>
  );
  beforeEach(() => { [trace.down, trace.press, trace.commit, trace.settled].forEach((f) => f.mockClear()); });
  // react-native-web's press responder starts a press on a timer, so the
  // clock is faked for the touch — as it is for the pill's lift above.
  const touch = (name: string) => {
    vi.useFakeTimers();
    fireEvent.mouseDown(tab(name), { button: 0 });
    act(() => { vi.advanceTimersByTime(150); });
  };

  it('says which phone and which build it is, once', () => {
    expect(trace.device).toEqual([
      { platform: 'web', osVersion: expect.any(String), isDev: expect.any(Boolean), channel: 'preview' },
    ]);
  });

  it('marks the finger coming down on another tab, from where the reader is to where they pressed', () => {
    mount(propsFor(1).props);
    touch('Trips');
    expect(trace.down.mock.calls).toEqual([['Explore', 'Trips']]);
    expect(trace.press).not.toHaveBeenCalled();
  });

  // Nothing travels for a press on the tab already selected, so there is
  // nothing to time: the pill lifts under the finger instead.
  it('marks nothing down for the selected tab', () => {
    mount(propsFor(1).props);
    touch('Explore');
    expect(trace.down).not.toHaveBeenCalled();
  });

  // Before the navigation, not after: `navigate` is where the render
  // being measured begins.
  it('marks the press before it navigates', () => {
    const { navigation, props } = propsFor(1);
    mount(props);
    fireEvent.click(tab('Trips'));
    expect(trace.press).toHaveBeenCalledOnce();
    expect(trace.press.mock.invocationCallOrder[0]).toBeLessThan(navigation.navigate.mock.invocationCallOrder[0]);
  });

  it('marks the commit when the selected tab changes, and hands the journey its end', async () => {
    const { rerender } = render(tree(propsFor(1).props));
    expect(trace.commit).not.toHaveBeenCalled();
    rerender(tree(propsFor(2).props));
    expect(trace.commit.mock.calls).toEqual([['Trips', false]]);
    await waitFor(() => expect(trace.settled).toHaveBeenCalledWith({ finished: true }), { timeout: 3000 });
    expect(trace.settled).toHaveBeenCalledOnce();
  });

  // The navigator hands over a new state on every push inside a tab; the
  // tab has not changed, and nothing set off.
  it('marks no commit for a new state on the same tab, nor for a new width', () => {
    const { rerender } = render(tree(propsFor(1).props));
    rerender(tree(propsFor(1).props));
    win.width = 430;
    rerender(tree(propsFor(1).props));
    expect(trace.commit).not.toHaveBeenCalled();
    expect(trace.settled).not.toHaveBeenCalled();
  });

  // Reduce Motion's slide is a different journey, and the row says so.
  it('marks the commit as still under Reduce Motion, and the slide’s end too', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { rerender } = render(tree(propsFor(0).props));
    await act(async () => {});
    rerender(tree(propsFor(3).props));
    expect(trace.commit.mock.calls).toEqual([['Collections', true]]);
    await waitFor(() => expect(trace.settled).toHaveBeenCalledWith({ finished: true }), { timeout: 2000 });
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
    freshNews.fresh = 1;
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

  // One bell (owner, 20 Nov 2026): Profile's dot is the bell's figure,
  // which counts each request waiting (`lib/freshNews`, tested there).
  it('marks Profile when somebody is waiting on an answer from this reader', () => {
    const { unmount } = mount(propsFor(0).props);
    const quiet = dotsIn('Profile');
    unmount();

    // The dot is the bell's and nothing else's: a request the bell has
    // not counted yet (the phone's mark still being read) lights nothing.
    crew.ships.data = [request('me')];
    const early = mount(propsFor(0).props);
    expect(dotsIn('Profile')).toBe(quiet);
    early.unmount();

    freshNews.fresh = 1;
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

  // A badge lit Profile from 17 to 20 Nov 2026; under one bell it marks
  // itself in its sheet, and the tab says nothing of it.
  it('does not mark Profile for a badge', () => {
    const { unmount } = mount(propsFor(0).props);
    const quiet = dotsIn('Profile');
    unmount();
    rewards.unseen = ['beenThere'];
    mount(propsFor(0).props);
    expect(dotsIn('Profile')).toBe(quiet);
    expect(tab('Profile').getAttribute('aria-label')).toBe('Profile');
  });

  // Anything the bell counts — a reply, a like, a copy — is reason
  // enough for the dot, said by its count; a request is said first.
  it('marks Profile for anything new in the bell, said after a request', () => {
    const { unmount } = mount(propsFor(0).props);
    const quiet = dotsIn('Profile');
    unmount();

    freshNews.fresh = 2;
    const alone = mount(propsFor(0).props);
    expect(dotsIn('Profile')).toBe(quiet + 1);
    expect(tab('Profile').getAttribute('aria-label')).toBe('Profile, 2 new');
    expect(tab('Trips').getAttribute('aria-label')).toBe('Trips');
    alone.unmount();

    crew.ships.data = [request('me')];
    freshNews.fresh = 3;
    mount(propsFor(0).props);
    expect(dotsIn('Profile')).toBe(quiet + 1);
    expect(tab('Profile').getAttribute('aria-label')).toBe('Profile, 1 friend request waiting');
  });

  it('asks whether the comment news has gone stale when it appears and on each change of tab', () => {
    const bar = (props: BottomTabBarProps) => (
      <TabBarDuckProvider><Scroller /><FloatingTabBar {...props} /></TabBarDuckProvider>
    );
    const { rerender } = render(bar(propsFor(0).props));
    expect(freshNews.freshen).toHaveBeenCalledTimes(1);
    rerender(bar(propsFor(0).props));
    expect(freshNews.freshen).toHaveBeenCalledTimes(1);
    rerender(bar(propsFor(2).props));
    expect(freshNews.freshen).toHaveBeenCalledTimes(2);
  });

  it('marks nothing for a reader who is signed out', () => {
    crew.ships.data = [request('me')];
    freshNews.fresh = 1;
    const { unmount } = mount(propsFor(0).props);
    const signedIn = dotsIn('Profile');
    unmount();

    // Signed out, the bell's figure is nought (`lib/freshNews`).
    auth.session = null;
    freshNews.fresh = 0;
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

// The guide's ring on the profile tab (step 4) is the pill's own shape
// (owner, 22 Oct 2026, of the collections tab it rang then): the cell's
// width, and in from the island's rim by the pill's inset, so it is the
// selected tab's mark and never stands out past the bar.
describe('the guide’s rings on the profile and planner tabs', () => {
  const rung = () => {
    anchorCalls.length = 0;
    const out = propsFor(0);
    mount(out.props);
    const seen = new Map<string, [string, () => void, unknown, { x: number; y: number }]>();
    for (const call of anchorCalls) seen.set(call[0] as string, call as [string, () => void, unknown, { x: number; y: number }]);
    return { seen, navigation: out.navigation };
  };

  it('rings the profile and planner tabs only, each the pill’s size: the cell’s width, the pill’s height', () => {
    const { seen } = rung();
    expect([...seen.keys()].sort()).toEqual(['plan', 'profile']);
    for (const id of ['plan', 'profile']) {
      const [, , , outset] = seen.get(id)!;
      expect(outset.x).toBe(0);
      expect(TAB_BAR_HEIGHT + outset.y * 2).toBe(parseFloat(getComputedStyle(pill()).height));
    }
  });

  // Each on its own tab's cell, not a neighbour's.
  it.each([['profile', 'Profile', 'Collections'], ['plan', 'Ideas', 'Explore']])('fixes %s to its own tab', (id, mine, next) => {
    rung();
    const cell = anchorRefs.get(id)!.current as HTMLElement;
    expect(cell.contains(tab(mine)) || tab(mine).contains(cell)).toBe(true);
    expect(cell.contains(tab(next))).toBe(false);
  });

  // Tapping the ring is tapping the tab: the guide hands the press back.
  it.each([['profile', 'Profile'], ['plan', 'Ideas']])('opens the tab when the guide hands %s’s press back', (id, route) => {
    const { seen, navigation } = rung();
    seen.get(id)![1]();
    expect(navigation.navigate).toHaveBeenCalledWith(route);
  });
});

// Your face for the last tab (owner, 26 Nov 2026): the outline when there
// is no face to draw; selected, the pill's ink in a ring around it.
describe('the last tab wears your face', () => {
  const FACE = 'https://x/me.jpg';
  const PRESET = 'preset:';

  it('draws your face, idle and on the pill, in place of the outline', () => {
    auth.profile = { avatar_url: FACE };
    mount(propsFor(0).props);
    expect(screen.queryByTestId('tab-glyph-Profile')).toBeNull();
    const idle = screen.getByTestId('tab-face');
    expect(idle.querySelector(`img[src="${FACE}"]`)).not.toBeNull();
    expect(screen.getByTestId('tab-face-on')).toBeTruthy();
    // The other tabs keep their outlines.
    expect(screen.getByTestId('tab-glyph-Explore')).toBeTruthy();
  });

  // The pill alone says it is selected (owner, 26 Nov 2026): the 1.5pt
  // ring in the pill's ink came off the same day.
  it('wears the same hairline on the pill as off it, and no ring in the pill’s ink', () => {
    auth.profile = { avatar_url: FACE };
    mount(propsFor(4).props);
    const on = viewStyleOf(screen.getByTestId('tab-face-on'));
    const idle = viewStyleOf(screen.getByTestId('tab-face'));
    expect(on.borderWidth).toBe(StyleSheet.hairlineWidth);
    expect(idle.borderWidth).toBe(StyleSheet.hairlineWidth);
    expect(on.borderColor).toBe(idle.borderColor);
    expect([pillInk.light, pillInk.dark]).not.toContain(on.borderColor);
  });

  it('keeps the outline signed out, or with no face to draw', () => {
    auth.profile = { avatar_url: FACE };
    auth.session = null;
    const out = mount(propsFor(0).props);
    expect(screen.getByTestId('tab-glyph-Profile')).toBeTruthy();
    expect(screen.queryByTestId('tab-face')).toBeNull();
    out.unmount();
    auth.session = { user: { id: 'me' } };
    auth.profile = { avatar_url: '' };
    const empty = mount(propsFor(0).props);
    expect(screen.getByTestId('tab-glyph-Profile')).toBeTruthy();
    empty.unmount();
    // A bundled animal this build does not carry: no picture to draw, so
    // the outline rather than a blank disc.
    auth.profile = { avatar_url: `${PRESET}not-an-animal` };
    mount(propsFor(0).props);
    expect(screen.getByTestId('tab-glyph-Profile')).toBeTruthy();
  });
});

