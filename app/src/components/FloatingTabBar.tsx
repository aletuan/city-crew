// The tab bar as a floating island — the social-app grammar, in the
// app's own materials.
//
// Five glyphs, and the selected one sits in a pill — the shape carries
// "you are here". The island is the same glass the pinned filter
// row uses, ringed by the same hairline every card wears, and it ducks
// below the edge while you scroll into content (see tabBarDuck).
//
// ── icons only, a second time ──
//
// This bar shipped icon-only once, and the captions came back because
// two glyphs do not teach their words: Trips (a calendar) and Collections
// (a bookmark) are both "things I put aside". On 11 Oct 2026 the owner
// chose the icon-only bar again, from a reference, knowing that history:
// the captions go, and the names stay for VoiceOver, which reads every
// tab by its name and its waiting count. If the two tabs are mistaken for
// each other again, a distinct glyph for Trips is the fix to reach for
// before the words.
//
// The pill is the badge's colours: `badgeSolid` under `pillInk`, both
// taken from the look the reader chose in Profile → Theme — a pale coral
// under brick on paper, solid coral under near-black on charcoal and the
// coffee brown, Rose's pale rose under its deep rose. Solid rather than
// the 16% `badge` tint because the bar is glass over whatever scrolls
// beneath it, and a tint there would take the colour of the photograph.
// See the note above `inkOf` for the ink's measurements.
//
// ONE PILL, travelling (11 Oct 2026). It used to be each tab's own
// background, so a change of tab was a pill vanishing and another
// appearing in the same frame. Now it is one view over the row that
// springs to the new cell, stretched toward it and lifted on the way, the
// way Threads' does — the measurements are in "the pill's travel" below.
// The pill-ink glyphs live in a window inside it, so a glyph takes the
// pill's ink exactly where the pill covers it, half and half mid-flight.

import { useTourAnchor } from './SignupTour';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSession } from '../lib/auth';
import { CHANNEL } from '../lib/channel';
import { useCrew } from '../lib/crew';
import { splitFriendships } from '../lib/friends';
import { useI18n } from '../lib/i18n';
import { useInvitations } from '../lib/invitations';
import { useMyTrips } from '../lib/mytrips';
import { useFreshNews } from '../lib/freshNews';
import { minutesOf, todayISO } from '../lib/day';
import { tripsToday } from '../lib/trips';
import { shouldRefresh } from '../lib/stale';
import { tabSettled, tabTrace } from '../lib/tabtrace';
import { useScheme } from '../lib/theme';
import { badgeSolidHex, bgHex, colors, pillGround, pillInk, radius, textHex } from '../theme';
import { GlassMaterial, Glyph, ICON, PressableScale, TAB_BAR_HEIGHT, useReducedMotion, useTabBarFrame, useTabBarLift, type GlyphName } from './ui';
import { useTabBarDuck } from './tabBarDuck';

/**
 * The ink on the selected pill — not `colors.badgeInk`, and measured.
 *
 * Two things changed under that token at once. The pill is `badgeSolid`
 * rather than `badge`, because `badge` on paper is a 16% coral tint and
 * the glass beneath it is no longer nearly opaque: a translucent fill on
 * a translucent bar leaves the pill's ground being whatever photograph is
 * scrolling past, and the label came out at 1.35:1 over a dark one. The
 * token's own docs predicted this — `badgeSolid` exists because "a 16%
 * fill there let the picture through and left the glyph sitting on
 * whatever pixels happened to be under it".
 *
 * It was measured while the pill carried an 11pt word, so it is held to
 * 4.5:1 where a glyph alone needs only 3:1. On `badgeSolid`'s pale coral,
 * `badgeInk`'s #DC4C33 reaches 3.15; #A33724 is the same hue carried far
 * enough down to reach 5.16. The word went on 11 Oct 2026 and the ink
 * stayed: a margin over the threshold is not a reason to spend it.
 *
 * Dark needs no such move: #141310 on solid coral is already 6.79.
 * Rose's pill is its own pale #F0D2CA, under #8E3C4A at 5.10. The values
 * live in the palettes now (`pillInk` in theme.ts), one per look.
 */

/** The ink a glyph wears: on the pill when selected, at
 *  full strength on the glass when idle (see the glyph's note on why
 *  not a mid grey). It was the same four-way ternary written three
 *  times, which is three places to change two of. */
const inkOf = (focused: boolean, light: boolean) =>
  (focused ? pillInk[light ? 'light' : 'dark'] : textHex[light ? 'light' : 'dark']);

// ── the five marks (owner, 12 and 18 Nov 2026) ──
//
// Ionicons' outlines, the family of every other glyph in the app. From
// 12 to 18 Nov they were Lucide's thinner lines, chosen from a reference
// over what this bar wore then — a filled compass needle, a solid
// calendar on the selected tab and a pin standing on a many-lined folded
// map (`PlacesGlyph`, which went with it) — and they came back with the
// rest of that set when the owner asked for one font across the app
// (`Glyph` has the three ways out and what each cost). The needle is
// filled again and the line is 1.4pt where Lucide's was 1.1: Ionicons
// has one compass and one weight.
//
// What 12 Nov decided apart from the family stays: the selected tab
// keeps the outline and takes the pill's ink, as the reference does.
// The pill already says "here", and a mark that turns solid in it said
// it twice. Instagram and Apple's own tab bars fill the selected glyph;
// they have no pill. And the catalog tab is a pin alone, not a pin on a
// map.
//
// The planning tab, "Explore", wears the compass — "find out what to do".
// The catalog tab, "Places", the pin on the ground.
/** The air between the pill and the island's rim — the same on every
 *  side, so the pill's round ends are concentric with the island's. */
const PILL_INSET = 4;
/** The pill's height: the island's, less the inset above and below. */
const PILL_H = TAB_BAR_HEIGHT - PILL_INSET * 2;
/**
 * The glyph's box, in points: 22, the scale's step for getting about.
 *
 * Set against a reference on 12 Nov 2026, read against its own pill so
 * the scale cancels: its marks are 0.28 of the pill's height, where
 * Ionicons at 25 had been 0.40. The owner took the lightness and not the
 * size: a 52pt pill at 0.28 is a 14pt mark, where Threads' tab marks
 * measure 22 and Apple's sit in a 25pt box, and the owner had already
 * once found these marks too small for the air around them. So 22, down
 * from 25, and it stayed 22 when the marks came back to Ionicons.
 */
const GLYPH = ICON.nav;
/** How much wider the pill runs per cell it travels, and the most it
 *  will: one cell over covers both glyphs, as Threads' does. */
const STRETCH_PER_STEP = 0.28;
const STRETCH_MAX = 0.6;
/** How far the pill grows while it travels or is pressed: 56pt to about
 *  59, past the 4pt inset by a point and a half, as the recording's pill
 *  rides past the rim. */
const LIFT_SCALE = 1.06;

const ICONS: Record<string, GlyphName> = {
  Explore: 'location-outline',
  Ideas: 'compass-outline',
  Trips: 'calendar-outline',
  Collections: 'bookmark-outline',
  Profile: 'person-outline',
};

type T = (en: string, vi: string, ja?: string, zh?: string, hant?: string) => string;

/**
 * What VoiceOver says for a tab wearing a dot. The dot is a 9pt view
 * with no text, so until 2 Oct 2026 a reader using the screen reader
 * heard "Profile" and never learned a person was waiting on them — the
 * one signal the bar carries, carried for sighted readers only. The
 * count goes in the label rather than a hint: a hint is read after a
 * pause, and is off by default for many readers. The eye still gets a
 * dot and no number, as before — see the dots' own comment.
 *
 * Out of the component (17 Nov 2026), which stands at its ceiling
 * (`oversize.js`) and had a fourth reason for a dot to say.
 */
/**
 * The bell's figure, which is the Profile tab's dot (owner, 20 Nov
 * 2026: one bell): everything for you on Activity since it was last
 * opened, and each friend request waiting — `lib/freshNews`. It is
 * asked again on a change of tab once it has gone stale, as the crew is.
 *
 * Badges no longer light the tab. They are not news somebody gave you,
 * the banner said so as each was earned, and the sheet marks which are
 * new; the tab lit for a badge was found by the owner as a dot with no
 * reason in sight.
 *
 * A hook of its own because the bar's function stands at its ceiling
 * (`oversize.js`).
 */
function useProfileNews(index: number): number {
  const { fresh, freshen } = useFreshNews();
  useEffect(() => { freshen(); }, [index, freshen]);
  return fresh;
}

export function spokenTab(
  name: string,
  label: string,
  on: { requests: number; invites: number; today: string | null; news: number },
  t: T,
): string {
  if (name === 'Profile' && on.requests > 0) {
    return t(
      `${label}, ${on.requests} friend request${on.requests === 1 ? '' : 's'} waiting`,
      `${label}, ${on.requests} lời mời kết bạn đang chờ`,
      `${label}、友達リクエスト${on.requests}件待ち`,
      `${label}，${on.requests} 个好友请求待处理`, `${label}，${on.requests} 個好友請求待處理`,
    );
  }
  // After the request, when both apply: the person waiting comes first,
  // then the rest of what the bell holds, counted as the bell counts.
  if (name === 'Profile' && on.news > 0) {
    return t(
      `${label}, ${on.news} new`,
      `${label}, ${on.news} tin mới`,
      `${label}、新着${on.news}件`,
      `${label}，${on.news} 条新消息`, `${label}，${on.news} 條新訊息`,
    );
  }
  if (name === 'Trips' && on.invites > 0) {
    return t(
      `${label}, ${on.invites} trip invitation${on.invites === 1 ? '' : 's'} waiting`,
      `${label}, ${on.invites} lời mời chuyến đi đang chờ`,
      `${label}、旅程の招待${on.invites}件待ち`,
      `${label}，${on.invites} 个行程邀请待处理`, `${label}，${on.invites} 個行程邀請待處理`,
    );
  }
  // After the invitation, when both apply: the one somebody else is
  // waiting on comes first. The soonest trip is named, as Activity
  // names it.
  if (name === 'Trips' && on.today !== null) {
    const title = on.today;
    return t(`${label}, “${title}” is today`, `${label}, “${title}” là hôm nay`, `${label}、「${title}」は今日です`, `${label}，“${title}”就在今天`, `${label}，「${title}」就在今天`);
  }
  return label;
}

/**
 * Where the pill's journey reports its end — see `lib/tabtrace` for what
 * is being measured and why. Made here, once, because which phone this is
 * is `react-native`'s to say and `lib/*.ts` may not ask it.
 */
const settled = tabSettled({ platform: Platform.OS, osVersion: String(Platform.Version), isDev: __DEV__, channel: CHANNEL });

/**
 * The guide's rings on the bar (`SignupTour`): the profile tab (step 4)
 * and the planner's tab (step 5). Step 3 rang the collections tab until
 * 21 Nov 2026, when it went to open the Collections page itself. Step 5
 * rang the planner's first question for one release that day; a ring
 * round a whole block of tiles lit most of the screen (owner), so it went
 * back to the tab, with the guide opening the planner behind it. The
 * pill's own shape (owner, 22 Oct 2026): the cell's width, and the inset
 * in from the island's rim above and below. Ringed as other controls
 * are, a little clear of the cell's box, it was 82×70 against the 75×56
 * pill a reader knows as "the selected tab", and stood 4pt out past the
 * island's rim top and foot. Out of the bar for its ceiling.
 */
function useTabAnchors(navigation: BottomTabBarProps['navigation']) {
  const ring = { x: 0, y: -PILL_INSET };
  const Profile = useTourAnchor('profile', () => navigation.navigate('Profile'), undefined, ring);
  const Ideas = useTourAnchor('plan', () => navigation.navigate('Ideas'), undefined, ring);
  return { Profile, Ideas } as Record<string, typeof Profile | undefined>;
}

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const anchors = useTabAnchors(navigation);
  const light = useScheme().scheme === 'light';
  const duck = useTabBarDuck();

  // Landing anywhere surfaces the bar: a navigation is exactly the moment
  // the reader reached for it, or is about to want it.
  //
  // Keyed on the whole navigation state, not on `state.index`. The index
  // only changes when the *tab* changes, so a push inside a tab — Explore
  // to a place's page — kept whatever the bar was doing, and a reader who
  // had scrolled (bar ducked) arrived on PlaceDetail with no bar and no
  // way to get it back: detail screens feed no scroll, so nothing ever
  // called it home. The screens plainly expect it — both detail screens
  // reserve `useTabBarClearance` at the bottom for a bar that was not
  // there. The state object is replaced on every navigation action,
  // nested pushes included, and on nothing else — scrolling never touches
  // it, which is what keeps this from re-growing the strobe below.
  //
  // Depend on `show` — stable — and NEVER on the context object: that
  // value is rebuilt every time `ducked` flips, and an effect keyed on it
  // re-surfaced the bar on the very frame each scroll hid it. Hide, show,
  // hide, show, at scroll-event rate: the strobe a reader saw as the bar
  // shivering while they pulled the page up.
  const index = state.index;
  const here = state.routes[index].name;
  const { show } = duck;
  useEffect(() => { show(); }, [state, show]);

  // The waiting-request dot on the Profile tab — the one signal worth
  // carrying on the bar itself, because a request is a person waiting on
  // an answer and the card that says so lives three taps deep. Read from
  // the shared crew copy, and re-read on a tab change only once the
  // answer has gone stale: this used to be a private query fired on
  // every switch, which kept the badge honest at the price of a request
  // per tap — and now that the whole app hangs off one copy, that same
  // eagerness would have refetched faces and counts with it.
  const { session } = useSession();
  const me = session?.user?.id;
  const { ships } = useCrew();
  const { reload } = ships;
  const loadedAtRef = useRef(ships.loadedAt);
  loadedAtRef.current = ships.loadedAt;
  useEffect(() => {
    if (me && shouldRefresh(loadedAtRef.current, Date.now())) reload();
  }, [index, me, reload]);
  const requestsWaiting = me ? splitFriendships(ships.data, me).incoming.length : 0;

  // And the same mark on Trips, for an invitation waiting on an answer.
  // The second signal the bar carries, and it earns its place by the same
  // test the first one passed: somebody else is waiting on this reader,
  // and the card that says so is two taps away. Read from the one shared
  // copy — see `lib/invitations` — so the dot costs no request of its own.
  const { waiting: invitesWaiting } = useInvitations();
  // And a third, of a different kind (7 Oct 2026): not somebody waiting
  // on this reader, but the one day the reader has somewhere to be. Lit
  // on the day of a trip and only then — see `tripsToday` for why not the
  // week — and drawn as the same mark, so the bar has one way of saying
  // "look here". Read from the shared trips copy, as the other two are
  // read from theirs; it costs no request. The clock is read at render,
  // and the bar re-renders on every tab change, which is as often as the
  // dot needs to be right.
  const myTrips = useMyTrips();
  const today = tripsToday(myTrips.data, todayISO(), minutesOf());
  // Profile's dot is the bell's (owner, 20 Nov 2026): the request above
  // is in its figure, with everything else for you since Activity was
  // last opened — `useProfileNews`. Badges lit it for three days from 17
  // Nov, and comments from the 19th, each as a reason of its own.
  const news = useProfileNews(index);
  const { t } = useI18n();

  // What VoiceOver says for a tab wearing a dot — `spokenTab`.
  const spoken = (name: string, label: string) => (
    spokenTab(name, label, { requests: requestsWaiting, invites: invitesWaiting, today: today[0]?.title ?? null, news }, t)
  );

  // The dot wears one pair per theme, selected or not: pill-ink core,
  // ringed in the pill's own coral.
  //
  // It has been through two grounds' worth of lessons. Coral-on-surface
  // sank into the selected pill (same hue on same hue — the owner went
  // hunting for it), so the focused tab learned this pair. Then the split
  // showed its other half: on paper, `badgeSolid` is a pale tint, and the
  // idle dot faded into the bar — found by the owner again. So the pair
  // stops being conditional. Every ground the bar offers — glass or pill,
  // paper or charcoal — contrasts with at least one half: the ink core
  // carries it on the pill and on paper, the coral ring on charcoal's
  // idle bar. One mark, wherever it lands.
  const dotInk = {
    backgroundColor: pillInk[light ? 'light' : 'dark'],
    // Plain hex, by the app's scheme: `badgeSolid` itself is a `dyn` pair,
    // and on a border that follows the phone, not the app (`bgHex`).
    borderColor: light ? badgeSolidHex.light : badgeSolidHex.dark,
  };

  // It used to clear the whole safe-area inset — 34pt on a modern iPhone,
  // plus the gap, put the bar 44pt off the bottom, which reads as an
  // island adrift rather than a dock. `useTabBarLift` clears the home
  // indicator instead, and is shared so the screens' bottom padding
  // cannot drift away from where the bar actually sits.
  const lift = useTabBarLift();
  const frame = useTabBarFrame();

  // ── the pill's travel ──
  //
  // Measured off a 60fps screen recording of Threads (11 Oct 2026): the
  // pill leaves its cell stretched toward the next one, covering both
  // glyphs for four or five frames (~75ms); it travels lifted — larger,
  // past the bar's rim, paler, a clear glass rather than a grey — and the
  // glyph changes exactly where the pill covers it, half one and half
  // the other mid-way; then it holds the rise a beat and settles, about
  // 300ms in all. The refraction through that glass is Liquid Glass and
  // native-only; everything else is here.
  const n = state.routes.length;
  // Inside the island's hairline ring, less the inset either side.
  // Floored at a point: before the window has a width (and in a test
  // runner, whose window has none) the sum is negative, and an
  // interpolation's ranges must still run forwards.
  const cell = Math.max((frame.width - StyleSheet.hairlineWidth * 2 - PILL_INSET * 2) / n, 1);
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(index * cell)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const shown = useRef({ index, cell });
  useEffect(() => {
    const was = shown.current;
    shown.current = { index, cell };
    // A new width (rotation, a split screen) is not a journey: jump.
    if (was.cell !== cell) { x.setValue(index * cell); return; }
    if (was.index === index) return;
    // The pill is told to go on the next line or the one after: this is
    // the instant `lib/tabtrace` calls `commit`, and `settled` its end.
    tabTrace.commit(here, reduced);
    if (reduced) { Animated.timing(x, { toValue: index * cell, duration: 160, useNativeDriver: true }).start(settled); return; }
    const steps = Math.abs(index - was.index);
    Animated.parallel([
      Animated.spring(x, { toValue: index * cell, useNativeDriver: true, stiffness: 320, damping: 28, mass: 1 }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1 + Math.min(STRETCH_PER_STEP * steps, STRETCH_MAX), duration: 90, useNativeDriver: true }),
        Animated.spring(stretch, { toValue: 1, useNativeDriver: true, stiffness: 260, damping: 18, mass: 1 }),
      ]),
      Animated.sequence([
        Animated.timing(rise, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.delay(110),
        Animated.timing(rise, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start(settled);
  }, [index, here, cell, reduced, x, stretch, rise]);
  // The selected tab, pressed: the pill lifts under the finger rather
  // than the cell shrinking away from it.
  const press = (down: boolean) => {
    if (reduced) return;
    Animated.timing(rise, { toValue: down ? 0.7 : 0, duration: down ? 90 : 180, useNativeDriver: true }).start();
  };
  /** How much of a tab's idle glyph shows: all of it while the pill is a
   *  cell or more away, none under it. */
  const cover = (i: number) => x.interpolate({
    inputRange: [(i - 1) * cell, i * cell, (i + 1) * cell],
    outputRange: [1, 0, 1],
    extrapolate: 'clamp',
  });
  /** A tab's mark, idle or on the pill. The pill's copies live only in its
   *  window, so where the pill is, the mark wears the pill's ink. */
  const glyph = (name: string, onPill: boolean) => (
    <Glyph
      name={ICONS[name]}
      size={GLYPH}
      // Full strength when idle, where this used to be a mid grey. That
      // grey was the reason the glass had to stay nearly opaque: over an
      // unknown photograph the scrim averages towards mid-tone, and a
      // mid-tone glyph on it cannot contrast at any opacity. See
      // GlassMaterial for the measurements — the two changes are one.
      //
      // No halo: the Ionicons marks wore `glassHalo`, a text shadow, and
      // a drawing has no text to shadow — as `PlacesGlyph` never had one.
      // The glass's scrim carries the contrast; check it over a bright
      // photograph before trusting this line.
      color={inkOf(onPill, light)}
      testID={`tab-glyph-${name}${onPill ? '-on' : ''}`}
    />
  );

  const slide = duck.anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TAB_BAR_HEIGHT + lift + 8],
  });
  const fade = duck.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      pointerEvents={duck.ducked ? 'none' : 'auto'}
      style={[s.bar, {
        bottom: lift,
        left: frame.left,
        width: frame.width,
        borderColor: colors.borderGlass,
        transform: [{ translateY: slide }],
        opacity: fade,
        // On paper a floating white island needs the shadow to exist at
        // all; on charcoal the same shadow is the ambient darkness.
        shadowOpacity: light ? 0.16 : 0.35,
      }]}
    >
      {/* Clip lives on its own layer: iOS draws shadows outside bounds,
          and overflow:hidden on the shadowed view would eat them. */}
      <View style={s.clip}>
        <GlassMaterial />
      </View>
      <View style={s.row}>
        {state.routes.map((route, i) => {
          const focused = index === i;
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const onPress = () => {
            tabTrace.press();
            const event = navigation.emit({
              type: 'tabPress', target: route.key, canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <PressableScale
              key={route.key}
              anchorRef={anchors[route.name]}
              // The whole cell is the target; the pill over it is only
              // the mark.
              style={s.tab}
              contentStyle={s.tabInner}
              // The glyph gives a little under the finger; the pill is
              // what answers (`press` below), as Threads' does.
              scaleTo={0.92}
              // The navigator's tabPress listener already fires the
              // selection haptic; a second one here would double-tap.
              haptic="none"
              onPress={onPress}
              // On another tab the finger coming down is where a switch
              // is measured from (`lib/tabtrace`); nothing is drawn for it.
              onPressIn={() => (focused ? press(true) : tabTrace.down(here, route.name))}
              onPressOut={focused ? () => press(false) : undefined}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={spoken(route.name, label)}
              testID={`tab-${route.name.toLowerCase()}`}
            >
              {/* The idle glyph, every tab. It gives way as the pill
                  arrives over it, and the solid copy in the pill's window
                  takes its place — see `cover`. */}
              <Animated.View style={{ opacity: cover(i) }}>
                {glyph(route.name, false)}
              </Animated.View>
            </PressableScale>
          );
        })}
        {/* The pill: one for the whole bar, travelling between cells. Over
            the glyphs and under no touch. Two layers on one track: the
            ground, which stretches and lifts, and a window the cell's size
            that does neither and shows the solid glyphs through it. */}
        <Animated.View
          pointerEvents="none"
          style={[s.pill, { width: cell, transform: [{ translateX: x }] }]}
          testID="tab-pill"
        >
          <Animated.View
            style={[s.pillGround, {
              // A step quieter than the badge (`pillGround`), and opaque.
              backgroundColor: light ? pillGround.light : pillGround.dark,
              transform: [{ scaleX: stretch }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [1, LIFT_SCALE] }) }],
            }]}
          >
            <Animated.View
              style={[s.pillGround, {
                backgroundColor: light ? bgHex.light : textHex.dark,
                opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [0, light ? 0.55 : 0.22] }),
              }]}
            />
          </Animated.View>
          <View style={s.window}>
            <Animated.View
              style={[s.windowRow, { width: cell * n, transform: [{ translateX: Animated.multiply(x, -1) }] }]}
              testID="tab-pill-glyphs"
            >
              {state.routes.map((route) => (
                <View key={route.key} style={[s.windowCell, { width: cell }]}>
                  {glyph(route.name, true)}
                </View>
              ))}
            </Animated.View>
          </View>
        </Animated.View>
        {/* The dots ride above everything, the pill included: on the
            selected tab they would otherwise be under it. */}
        <View pointerEvents="none" style={s.dotRow}>
          {state.routes.map((route) => (
            <View key={route.key} style={[s.windowCell, { width: cell }]}>
              <View style={s.dotBox}>
                {(route.name === 'Profile' && news > 0)
                  || (route.name === 'Trips' && (invitesWaiting > 0 || today.length > 0))
                  ? <View style={[s.reqDot, dotInk]} testID={`dot-${route.name.toLowerCase()}`} /> : null}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.tabBar,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.tabBar,
    overflow: 'hidden',
  },
  // The inset is the row's, not the cell's: it puts the end cells' pills
  // `PILL_INSET` from the rim at the sides, as they are above and below.
  row: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: PILL_INSET,
  },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  tabInner: { alignItems: 'center', justifyContent: 'center' },
  // A pill that fills its cell, Threads' shape: `PILL_INSET` from the
  // island's rim on every side it meets. Its round ends are concentric
  // with the island's, since 52/2 is the island's 30pt radius less 4
  // (56 in a 64pt island until 2 Nov 2026 — see `TAB_BAR_HEIGHT`).
  //
  // It went through a 52pt disc and then a 60×44 pill the same day (11 Oct
  // 2026). Both left a wide band of glass between the mark and the rim,
  // which the owner measured against Threads, whose pill is the cell.
  //
  // Then the inset was the cell's own 2pt padding at the sides against 4pt
  // above and below. On a Pro Max screenshot the selected Explore pill sat
  // 4px from the rim at the side and 8px from it above, at 2.15px a point
  // — and the end was no longer concentric, so the hairline showed as a
  // sliver beside it. Threads' pill, measured in the same screenshot pair,
  // sits about 10px (4.5pt) from its rim on the left, top and bottom alike.
  pill: {
    position: 'absolute', left: PILL_INSET, top: (TAB_BAR_HEIGHT - PILL_H) / 2 - StyleSheet.hairlineWidth,
    height: PILL_H,
  },
  pillGround: { ...StyleSheet.absoluteFill, borderRadius: PILL_H / 2 },
  window: { ...StyleSheet.absoluteFill, borderRadius: PILL_H / 2, overflow: 'hidden' },
  windowRow: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row' },
  windowCell: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  dotRow: {
    position: 'absolute', left: PILL_INSET, right: PILL_INSET, top: 0, bottom: 0,
    flexDirection: 'row',
  },
  // The glyph's box, so a dot sits where it sat on the glyph.
  dotBox: { width: GLYPH, height: GLYPH },
  // Geometry only — the colours are `dotInk`, picked per theme in render.
  reqDot: {
    position: 'absolute', top: -1, right: -4,
    width: 9, height: 9, borderRadius: 4.5,
    borderWidth: 1.5,
  },
});
