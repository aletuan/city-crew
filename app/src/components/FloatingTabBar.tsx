// The tab bar as a floating island — the social-app grammar, in the
// app's own materials.
//
// Five glyphs, each above its own name, and the selected one sits in a
// coral pill that wraps both — the shape carries "you are here", the word
// says which here. The island is the same glass the pinned filter row
// uses, ringed by the same hairline every card wears, and it ducks below
// the edge while you scroll into content (see tabBarDuck).
//
// ── why the captions came back ──
//
// This bar shipped icon-only, on the reasoning that the pill's shape says
// enough and the names survive for VoiceOver. That holds for three of the
// five. It does not hold for the calendar and the bookmark: Trips and
// Collections are both "things I put aside", and no glyph distinguishes a
// day I planned from a list I saved — the reader has to open one to find
// out which. An icon is a reminder of a word you already know, and those
// two never taught it.
//
// The captions cost six points of island height and nothing else. They
// are not a retreat from the icon-first idea; they are the two of five it
// could not carry.
//
// The pill keeps the badge's split personality on purpose: solid coral on
// charcoal, a pale coral on paper — the reasoning documented on the token
// holds unchanged now the disc grew into a pill. What did change is
// *which* badge token, and the ink on it; see PILL_INK_LIGHT.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../lib/auth';
import { useCrew } from '../lib/crew';
import { splitFriendships } from '../lib/friends';
import { useInvitations } from '../lib/invitations';
import { shouldRefresh } from '../lib/stale';
import { useScheme } from '../lib/theme';
import { colors, font, radius } from '../theme';
import { glassHalo, GlassMaterial, PressableScale, TAB_BAR_HEIGHT, useTabBarLift } from './ui';
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
 * And the pill now carries an 11pt word, not only a 22pt glyph, so it is
 * held to 4.5:1 where the disc only ever needed 3:1. On `badgeSolid`'s
 * pale coral, `badgeInk`'s #DC4C33 reaches 3.15 — fine for the glyph it
 * was chosen for, short for the caption beside it. #A33724 is the same
 * hue carried far enough down to reach 5.16.
 *
 * Dark needs no such move: #141310 on solid coral is already 6.79.
 */
const PILL_INK_LIGHT = '#A33724';
const PILL_INK_DARK = '#141310';

// [inactive, active]. Thin monochrome glyphs when idle; the selected tab
// takes the solid variant, reversed out of the pill.
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Ideas: ['bulb-outline', 'bulb'],
  Explore: ['compass-outline', 'compass'],
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
  const waiting = me ? splitFriendships(ships.data, me).incoming.length > 0 : false;

  // And the same mark on Trips, for an invitation waiting on an answer.
  // The second signal the bar carries, and it earns its place by the same
  // test the first one passed: somebody else is waiting on this reader,
  // and the card that says so is two taps away. Read from the one shared
  // copy — see `lib/invitations` — so the dot costs no request of its own.
  const { waiting: invitesWaiting } = useInvitations();

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
    backgroundColor: light ? PILL_INK_LIGHT : PILL_INK_DARK,
    borderColor: colors.badgeSolid as string,
  };

  // It used to clear the whole safe-area inset — 34pt on a modern iPhone,
  // plus the gap, put the bar 44pt off the bottom, which reads as an
  // island adrift rather than a dock. `useTabBarLift` clears the home
  // indicator instead, and is shared so the screens' bottom padding
  // cannot drift away from where the bar actually sits.
  const lift = useTabBarLift();

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
              containerStyle={s.tab}
              // The pill is this view, so it wraps the glyph *and* the
              // word rather than sitting behind the glyph alone. A fill
              // that stops above the caption leaves the selected tab's
              // name outside the thing marking it selected, which reads
              // as a highlight that missed.
              style={[s.tabInner, focused && { backgroundColor: colors.badgeSolid }]}
              scaleTo={0.9}
              // The navigator's tabPress listener already fires the
              // selection haptic; a second one here would double-tap.
              haptic="none"
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
            >
              <View>
              <Ionicons
                name={ICONS[route.name][focused ? 1 : 0]}
                size={22}
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
                color={focused ? (light ? PILL_INK_LIGHT : PILL_INK_DARK) : (light ? '#17150F' : '#F7F7F5')}
              />
              {/* Same mark the Profile card wears, one level up where
                  every screen can see it. Drawn beside the glyph rather
                  than tinting it: a dot is news, a recoloured icon is a
                  different icon. */}
              {route.name === 'Profile' && waiting
                ? <View style={[s.reqDot, dotInk]} /> : null}
              {route.name === 'Trips' && invitesWaiting > 0
                ? <View style={[s.reqDot, dotInk]} /> : null}
              </View>
              <Text
                numberOfLines={1}
                style={[s.caption, !focused && glassHalo(light), {
                  color: focused ? (light ? PILL_INK_LIGHT : PILL_INK_DARK) : (light ? '#17150F' : '#F7F7F5'),
                  fontWeight: focused ? font.semibold : font.regular,
                }]}
              >
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 12, right: 12,
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.tabBar,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  clip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.tabBar,
    overflow: 'hidden',
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tab: { flex: 1, height: '100%' },
  tabInner: {
    // Inset inside the cell so five pills do not touch: 6 top and bottom
    // leaves a 52pt pill in the 64pt island, 3 each side leaves about
    // 64pt of width on a small phone — enough for "Bộ sưu tập" at 11pt,
    // which is the longest caption any of the three languages produces.
    //
    // Concentric with the island: inner radius = radius.tabBar − the
    // inset, so the pill nests inside the island's curve instead of
    // fighting it. At 52 tall that is a full round end either way.
    flex: 1, marginVertical: 6, marginHorizontal: 3,
    borderRadius: radius.tabBar - 6,
    alignItems: 'center', justifyContent: 'center',
  },
  // Geometry only — the colours are `dotInk`, picked per theme in render.
  reqDot: {
    position: 'absolute', top: -1, right: -4,
    width: 9, height: 9, borderRadius: 4.5,
    borderWidth: 1.5,
  },
  caption: {
    // 11, not the 11.5 the old full-width bar used: the island is inset
    // 12pt each side, so its five cells are ~70pt where the old bar's
    // were 75, and the longest label has to clear a pill rather than sit
    // in an open row.
    fontSize: 11, marginTop: 3, lineHeight: 13,
  },
});
