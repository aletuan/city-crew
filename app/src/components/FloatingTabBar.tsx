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

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../lib/auth';
import { useCrew } from '../lib/crew';
import { splitFriendships } from '../lib/friends';
import { useI18n } from '../lib/i18n';
import { useInvitations } from '../lib/invitations';
import { useMyTrips } from '../lib/mytrips';
import { minutesOf, todayISO } from '../lib/day';
import { tripsToday } from '../lib/trips';
import { shouldRefresh } from '../lib/stale';
import { useScheme } from '../lib/theme';
import { badgeSolidHex, colors, pillInk, radius, textHex } from '../theme';
import { glassHalo, GlassMaterial, PressableScale, TAB_BAR_HEIGHT, useTabBarFrame, useTabBarLift } from './ui';
import { useTabBarDuck } from './tabBarDuck';
import PlacesGlyph from './PlacesGlyph';

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

// [inactive, active]. Thin monochrome glyphs when idle; the selected tab
// takes the solid variant, reversed out of the pill.
//
// The first two moved with their captions (App.tsx, 2 Oct 2026). The
// planning tab, now "Explore", takes the compass the catalog tab wore —
// the glyph a reader already reads as "find out what to do". The catalog
// tab, now "Places", is not in this table: its glyph is a pin standing on
// a map, which Ionicons does not have, drawn in `PlacesGlyph`. The bulb
// that used to mark "Ideas" went with the word.
/** The air between the pill and the island's rim — the same on every
 *  side, so the pill's round ends are concentric with the island's. */
const PILL_INSET = 4;
/** The pill's height: the island's, less the inset above and below. */
const PILL_H = TAB_BAR_HEIGHT - PILL_INSET * 2;
/**
 * The glyph's box, in points. Ionicons draws inside its box with margin,
 * so the ink is smaller than the number: measured on the owner's Pro Max
 * screenshot (2.15px a point), at 22 the five glyphs drew 18–20pt —
 * the compass 38px across, the person 40, the calendar and bookmark 43.
 * Threads' glyphs in the same screenshot pair draw 46–48px, about 22pt,
 * in a 53pt pill. At 25 ours draw about 21–23pt, the same ink in a pill
 * 3pt taller; the owner had found the air around them too wide.
 */
const GLYPH = 25;

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Ideas: ['compass-outline', 'compass'],
  Trips: ['calendar-outline', 'calendar'],
  Collections: ['bookmark-outline', 'bookmark'],
  Profile: ['person-outline', 'person'],
};

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
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
  const { session } = useAuth();
  const me = session?.user?.id;
  const { ships } = useCrew();
  const { reload } = ships;
  const loadedAtRef = useRef(ships.loadedAt);
  loadedAtRef.current = ships.loadedAt;
  useEffect(() => {
    if (me && shouldRefresh(loadedAtRef.current, Date.now())) reload();
  }, [index, me, reload]);
  const requestsWaiting = me ? splitFriendships(ships.data, me).incoming.length : 0;
  const waiting = requestsWaiting > 0;

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
  const { t } = useI18n();

  // What VoiceOver says for a tab wearing a dot. The dot is a 9pt view
  // with no text, so until 2 Oct 2026 a reader using the screen reader
  // heard "Profile" and never learned a person was waiting on them — the
  // one signal the bar carries, carried for sighted readers only. The
  // count goes in the label rather than a hint: a hint is read after a
  // pause, and is off by default for many readers. The eye still gets a
  // dot and no number, as before — see the dots' own comment.
  const spoken = (name: string, label: string): string => {
    if (name === 'Profile' && requestsWaiting > 0) {
      return t(
        `${label}, ${requestsWaiting} friend request${requestsWaiting === 1 ? '' : 's'} waiting`,
        `${label}, ${requestsWaiting} lời mời kết bạn đang chờ`,
        `${label}、友達リクエスト${requestsWaiting}件待ち`,
      );
    }
    if (name === 'Trips' && invitesWaiting > 0) {
      return t(
        `${label}, ${invitesWaiting} trip invitation${invitesWaiting === 1 ? '' : 's'} waiting`,
        `${label}, ${invitesWaiting} lời mời chuyến đi đang chờ`,
        `${label}、旅程の招待${invitesWaiting}件待ち`,
      );
    }
    // After the invitation, when both apply: the one somebody else is
    // waiting on comes first. The soonest trip is named, as Activity
    // names it.
    if (name === 'Trips' && today.length > 0) {
      const title = today[0].title;
      return t(`${label}, “${title}” is today`, `${label}, “${title}” là hôm nay`, `${label}、「${title}」は今日です`);
    }
    return label;
  };

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
            const event = navigation.emit({
              type: 'tabPress', target: route.key, canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <PressableScale
              key={route.key}
              // The whole cell is the target; the pill inside it is only
              // the mark.
              containerStyle={s.tab}
              style={[s.tabInner, focused && { backgroundColor: colors.badgeSolid }]}
              scaleTo={0.9}
              // The navigator's tabPress listener already fires the
              // selection haptic; a second one here would double-tap.
              haptic="none"
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={spoken(route.name, label)}
              testID={`tab-${route.name.toLowerCase()}`}
            >
              <View>
              {route.name === 'Explore' ? (
                <PlacesGlyph
                  size={GLYPH}
                  solid={focused}
                  color={inkOf(focused, light)}
                  testID="places-glyph"
                />
              ) : (
              <Ionicons
                name={ICONS[route.name][focused ? 1 : 0]}
                size={GLYPH}
                // Only when idle: the selected glyph sits on an opaque
                // pill, whose ground is known, so a halo there would be
                // decoration on a problem that does not exist.
                style={focused ? undefined : glassHalo(light)}
                // See App's old bar: React Navigation typed these as
                // strings, and the constraint outlived it — a glyph
                // colour prop cannot take a dynamic pair either way.
                //
                // Full strength when idle, where this used to be a mid
                // grey. That grey was the reason the glass had to stay
                // nearly opaque: over an unknown photograph the scrim
                // averages towards mid-tone, and a mid-tone glyph on it
                // cannot contrast at any opacity. See GlassMaterial for
                // the measurements — the two changes are one change.
                color={inkOf(focused, light)}
              />
              )}
              {/* Same mark the Profile card wears, one level up where
                  every screen can see it. Drawn beside the glyph rather
                  than tinting it: a dot is news, a recoloured icon is a
                  different icon. */}
              {route.name === 'Profile' && waiting
                ? <View style={[s.reqDot, dotInk]} /> : null}
              {route.name === 'Trips' && (invitesWaiting > 0 || today.length > 0)
                ? <View style={[s.reqDot, dotInk]} /> : null}
              </View>
            </PressableScale>
          );
        })}
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
  // A pill that fills its cell, Threads' shape: `PILL_INSET` from the
  // island's rim on every side it meets. Its round ends are concentric
  // with the island's, since 56/2 is the island's 32pt radius less 4.
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
  tabInner: {
    width: '100%', height: PILL_H, borderRadius: PILL_H / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  // Geometry only — the colours are `dotInk`, picked per theme in render.
  reqDot: {
    position: 'absolute', top: -1, right: -4,
    width: 9, height: 9, borderRadius: 4.5,
    borderWidth: 1.5,
  },
});
