// One city in a list to choose from: its name on the left, its figure in a
// column on the right, and the one on screen in the sheet's tint.
//
// Lifted out of Explore's city switcher (7 Nov 2026), whose rows had been
// argued into this shape over October — no glyphs, because five identical
// pins said nothing five times; the number on the right edge, because it
// is what rows are compared by; no chevron and no tick, `aria-selected`
// carrying the choice for a screen reader. The Collections screen's "Go
// to a city" sheet was a menu of pinned rows with "12 collections" under
// each name and a tick at the end; the owner asked for it to be this.
//
// `sub` is a second line under the name, for a row that stands for more
// than one city — Collections' "Elsewhere", which names the cities it
// gathers. A row for one city needs none.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';
import { fireHaptic, PressableScale } from './ui';

export function CityRow({
  title, sub, count, active, isNew = false, divided, onPress, testID, accessibilityLabel,
}: {
  title: string;
  sub?: string | null;
  /** Drawn bare, right-aligned. Left out rather than drawn as 0: the row
   *  is an offer, and "0" reads as a broken one. */
  count?: number | null;
  active: boolean;
  /** The outlined "NEW" beside the name — a young city. */
  isNew?: boolean;
  /** A hairline above the row, for every row but a list's first. */
  divided: boolean;
  onPress: () => void;
  testID: string;
  /** The row's name aloud, when the figure alone would be a bare number:
   *  "Saigon, 12 collections". Left out, the row reads its own text. */
  accessibilityLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <View>
      {divided && <View style={s.sep} testID="city-divider" />}
      <PressableScale
        haptic="selection"
        contentStyle={[s.row, active && s.rowOn]}
        onPress={() => { fireHaptic('selection'); onPress(); }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        // `aria-*` rather than `accessibilityState`, which
        // react-native-web drops — the same reason `Chip` does it this
        // way, and the only thing besides colour saying which row is
        // chosen.
        aria-selected={active}
        testID={testID}
      >
        <View style={s.words}>
          <View style={s.nameRow}>
            <Text style={[s.title, active && s.on]}>{title}</Text>
            {/* Beside the name, because that is the noun it means.
                Under it — as "15 places · new" — it sat next to the
                count instead, and read as fifteen *newly added* places
                rather than a young catalog. */}
            {isNew && (
              <View style={s.newChip}>
                <Text style={s.newChipText}>{t('NEW', 'MỚI', '新着', '新', '新')}</Text>
              </View>
            )}
          </View>
          {sub ? <Text style={s.sub} numberOfLines={2}>{sub}</Text> : null}
        </View>
        {count != null && (
          <Text style={[s.count, active && s.on]}>{count}</Text>
        )}
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 12,
  },
  // The chosen row wears the sheet's "this is the special one" tint.
  rowOn: { backgroundColor: colors.accentSoft, borderRadius: radius.card - 6 },
  words: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: font.medium },
  sub: { color: colors.textTertiary, fontSize: 13, lineHeight: 17 },
  on: { color: colors.accent },
  // Tabular figures so the column of counts lines up digit for digit;
  // 274 above 43 with proportional numerals reads as a ragged edge.
  count: {
    color: colors.textTertiary, fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  // Outlined rather than filled: the chosen row already wears accentSoft
  // as its ground, and a soft-tinted chip would vanish into it on the one
  // row most likely to carry this — the young city you just switched to.
  newChip: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentLine,
  },
  newChipText: {
    color: colors.accent, fontSize: 10, fontWeight: font.semibold, letterSpacing: 0.6,
  },
  // `marginVertical`, and it is the whole reason this line is visible:
  // flush against the chosen row's tint, an 8% hairline reads as the
  // tint's own border rather than a divider. Three points either side put
  // sheet colour between them.
  sep: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginHorizontal: 4, marginVertical: 3,
  },
});
