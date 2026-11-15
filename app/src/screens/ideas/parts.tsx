import React from 'react';
import { Text, View } from 'react-native';
import { Glyph } from '../../components/ui/glyph';
import { PressableScale, TileGrid } from '../../components/ui';
import { colors, space } from '../../theme';
import { s } from './styles';

/**
 * A question and the grid of answers under it.
 *
 * No count and no "pick one" beside the heading. They were there to say
 * which group swaps and which adds up, and they said it at the cost of a
 * second voice on every heading — four questions, each with an aside.
 * The screen is short on words on purpose, and the thing the asides
 * explained is cheap to discover: a second tap on `Going with…` swaps the
 * answer rather than refusing it, which is a forgiving way to learn a
 * rule and leaves nothing to undo.
 */
/** The tap that opens the community's lists. Explore's "See all" in
 *  weight and colour, a chevron down rather than an arrow right because
 *  what it opens is below, not elsewhere. */
export function MoreRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} contentStyle={s.more} accessibilityRole="button" testID="seeds-more" hitSlop={6}>
      <Text style={s.moreText}>{label}</Text>
      <Glyph name="chevron-down" size={16} color={colors.accent} />
    </PressableScale>
  );
}

export function Section({ title, cols, children }: {
  title: string;
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <Text style={s.heading}>{title}</Text>
      <View style={s.grid}><TileGrid cols={cols}>{children}</TileGrid></View>
    </View>
  );
}
