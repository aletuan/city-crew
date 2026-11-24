// A choice of a few answers, side by side, one press each.
//
// It began on the collection form (owner, 24 Nov 2026 — `SeenLine` in
// `screens/collectionForm/formParts`, where the way there is written
// down) and a check-in's sheet asked for the same thing the same day, so
// it was lifted out rather than drawn twice.
//
// The chips' material (`ui/controls` › `chip`, `chipOn`): a well of
// `surfaceGlass` holding the answers, the chosen one lifted onto the
// elevated ground with the accent's words and glyph, as a chosen chip
// carries them. 44 tall, the secondary control's height
// (`SECONDARY_CONTROL_H`), because each part is a target of its own.
//
// A radio group to a screen reader. `aria-checked` rather than
// `accessibilityState`, which react-native-web drops, as the chips do.

import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../theme';
import { PressableScale, SECONDARY_CONTROL_H } from './ui';
import { Glyph, ICON } from './ui/glyph';

export default function Segmented<K extends string>({ items, chosen, onPick, label, said, testID }: {
  /** `testID` written out by the caller, not built here from the well's:
   *  `scripts/maestroIds.test.ts` reads ids off the lines that set them,
   *  and an id glued from two variables is one no flow can be checked
   *  against. */
  items: readonly { key: K; label: string; icon: keyof typeof Ionicons.glyphMap; testID: string }[];
  chosen: K;
  onPick: (key: K) => void;
  /** What the group asks, for a screen reader. */
  label: string;
  /** What the chosen answer means, read after its name. */
  said?: string;
  /** The well's id. */
  testID: string;
}) {
  return (
    <View style={s.well} testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {items.map((it) => {
        const on = chosen === it.key;
        return (
          <PressableScale
            key={it.key}
            style={s.segAt}
            contentStyle={[s.seg, on && s.segOn]}
            scaleTo={0.97}
            haptic="selection"
            onPress={() => onPick(it.key)}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={on && said ? `${it.label}, ${said}` : it.label}
            testID={it.testID}
          >
            <Glyph name={it.icon} size={ICON.text} color={on ? colors.accent : colors.textSecondary} />
            <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1}>{it.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  well: {
    flexDirection: 'row', height: SECONDARY_CONTROL_H, padding: 3, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft, backgroundColor: colors.surfaceGlass,
  },
  segAt: { flex: 1 },
  seg: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent',
  },
  segOn: { backgroundColor: colors.bgElevated, borderColor: colors.borderGlass },
  segText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium },
  segTextOn: { color: colors.accent, fontWeight: font.semibold },
});
