// The tab bar as a floating island — the social-app grammar, in the
// app's own materials.
//
// Five glyphs in coral wells, each under its own name. The selected tab
// fills its well and tints its caption — the shape still carries "you are
// here", the word says which here. The island is the same glass the
// pinned filter row uses, ringed by the same hairline every card wears,
// and it ducks below the edge while you scroll into content (see
// tabBarDuck).
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
// The pill keeps `colors.badge`'s split personality on purpose: solid
// coral on charcoal, a coral tint on paper — the reasoning documented on
// the token holds unchanged now the disc grew into a pill.

import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useScheme } from '../lib/theme';
import { colors, font, radius } from '../theme';
import { GlassMaterial, PressableScale, TAB_BAR_GAP, TAB_BAR_HEIGHT } from './ui';
import { useTabBarDuck } from './tabBarDuck';

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
  const insets = useSafeAreaInsets();
  const light = useScheme().scheme === 'light';
  const duck = useTabBarDuck();

  // Landing anywhere surfaces the bar: a navigation is exactly the moment
  // the reader reached for it, or is about to want it.
  //
  // Depend on `show` — stable — and NEVER on the context object: that
  // value is rebuilt every time `ducked` flips, and an effect keyed on it
  // re-surfaced the bar on the very frame each scroll hid it. Hide, show,
  // hide, show, at scroll-event rate: the strobe a reader saw as the bar
  // shivering while they pulled the page up.
  const index = state.index;
  const { show } = duck;
  useEffect(() => { show(); }, [index, show]);

  const slide = duck.anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TAB_BAR_HEIGHT + TAB_BAR_GAP + insets.bottom + 8],
  });
  const fade = duck.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      pointerEvents={duck.ducked ? 'none' : 'auto'}
      style={[s.bar, {
        bottom: insets.bottom + TAB_BAR_GAP,
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
              style={s.tabInner}
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
              {/* One well, both states, so the glyph does not shift a
                  point up or down as the pill appears under it — which is
                  what a bare icon beside a filled one does when only the
                  filled one has a box. */}
              <View style={[s.well, focused && { backgroundColor: colors.badge }]}>
                <Ionicons
                  name={ICONS[route.name][focused ? 1 : 0]}
                  size={focused ? 21 : 22}
                  // See App's old bar: React Navigation typed these as
                  // strings, and the constraint outlived it — a glyph
                  // colour prop cannot take a dynamic pair either way.
                  color={focused ? colors.badgeInk : (light ? '#6E695E' : '#6E706D')}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[s.caption, {
                  color: focused ? colors.accent : (light ? '#6E695E' : '#6E706D'),
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
  tabInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  well: {
    // Shorter and narrower than the icon-only pill it replaces, because
    // it no longer has the tab to itself — the caption takes the bottom
    // third. 56 wide leaves air between neighbouring pills on a small
    // phone, where the tab cell is about 70pt.
    width: 56, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  caption: {
    // 11, not the 11.5 the old full-width bar used: the island is inset
    // 12pt each side, so its five cells are ~70pt where the old bar's
    // were 75, and the longest label has to clear a pill rather than sit
    // in an open row.
    fontSize: 11, marginTop: 3, lineHeight: 13,
  },
});
