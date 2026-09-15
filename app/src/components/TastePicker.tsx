// The chips that say what you want more of.
//
// One component, two askers: a step after signing up and the row in Edit
// profile. They ask the same question and must not drift apart, which is
// the whole reason it is a component rather than a block of JSX in each.
//
// The chips are the app's own `Chip`, wearing each category's glyph and
// hue — the same pair the Search zero-state's "Browse" row wears and the
// same dot a place card carries. A reader who has met the taxonomy on one
// screen has met it here.
//
// Nothing here decides anything: the cap, the toggle and the cleaning are
// `lib/tastepick`, pure and tested. This draws them.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../lib/categories';
import { useI18n } from '../lib/i18n';
import { tasteFull, TASTE_MAX, toggleTaste } from '../lib/tastepick';
import { colors, font, space } from '../theme';
import { Tile, TileGrid } from './ui';

export default function TastePicker({ chosen, onChange }: {
  chosen: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const full = tasteFull(chosen);

  return (
    <View>
      {/* Nine in threes rather than a wrapped row of pills. The labels
          have nothing to do with each other and their widths were the
          only thing setting the layout — see `Tile` for the argument. */}
      <TileGrid cols={3}>
        {Object.entries(CATEGORIES).map(([key, c]) => {
          const on = chosen.includes(key);
          return (
            <Tile
              key={key}
              label={t(c.en, c.vi, c.ja)}
              icon={c.icon}
              iconColor={c.color}
              active={on}
              onPress={() => onChange(toggleTaste(chosen, key))}
            />
          );
        })}
      </TileGrid>
      {/* The counter earns its place only once the ceiling is in sight:
          "0/5" on an untouched screen reads as a quota to fill, which is
          the opposite of what an optional question should say. It appears
          when the next tap is the last one that will work. */}
      {chosen.length >= TASTE_MAX - 1 ? (
        <Text style={s.note}>
          {full
            ? t(
                `That is the five. Tap one again to swap it.`,
                `Đã đủ năm. Chạm lại một mục để đổi.`,
                `5つまでです。入れ替えるにはもう一度タップしてください。`,
              )
            : t(
                `${chosen.length} of ${TASTE_MAX}.`,
                `${chosen.length}/${TASTE_MAX}.`,
                `${chosen.length}/${TASTE_MAX}。`,
              )}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  note: { color: colors.textTertiary, fontSize: 13, fontWeight: font.regular, marginTop: space.cardGap - 4 },
});
