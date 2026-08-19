// The tab bar as a floating island — the social-app grammar, in the
// app's own materials.
//
// Icon-first: five glyphs, no captions, and the selected tab sits in a
// coral pill instead of wearing a tinted label — the shape carries "you
// are here". The names survive as accessibility labels, so VoiceOver
// reads what the eye infers. The island is the same glass the pinned
// filter row uses, ringed by the same hairline every card wears, and it
// ducks below the edge while you scroll into content (see tabBarDuck).
//
// The pill keeps `colors.badge`'s split personality on purpose: solid
// coral on charcoal, a coral tint on paper — the reasoning documented on
// the token holds unchanged now the disc grew into a pill.

import React, { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useScheme } from '../lib/theme';
import { colors, radius } from '../theme';
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
  const index = state.index;
  useEffect(() => { duck.show(); }, [index, duck]);

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
              {focused
                ? (
                  <View style={[s.pill, { backgroundColor: colors.badge }]}>
                    <Ionicons name={ICONS[route.name][1]} size={21} color={colors.badgeInk} />
                  </View>
                )
                : (
                  <Ionicons
                    name={ICONS[route.name][0]}
                    size={23}
                    // See App's old bar: React Navigation typed these as
                    // strings, and the constraint outlived it — a glyph
                    // colour prop cannot take a dynamic pair either way.
                    color={light ? '#6E695E' : '#6E706D'}
                  />
                )}
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
  pill: {
    width: 56, height: 36, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
});
