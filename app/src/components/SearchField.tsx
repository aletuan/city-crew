// The search box, once.
//
// It was drawn inline on the Search screen — a pill, a magnifier, the
// input, a clear — and drawn again, differently, on Collections: a bare
// row with a smaller glyph and no clear. The check-ins list wanted a
// third, and three boxes that all mean "type to narrow this" should be
// one thing the reader has learned. This is the Search screen's, which
// is the one a reader meets first: a 44pt pill on the card ground with
// the hairline, a 19pt magnifier and the words typed.
//
// ── Cancel, inside the box (owner, 15 Oct 2026) ──
//
// Cancel stood beside the box, as iOS draws it, and the box shrank to
// make room. The owner's reference keeps the box the width of the page
// and puts Cancel inside its right end, a pill of its own, so the box
// and the way out read as one thing. The words give way as it slides
// in; the frame never moves.
//
// No clear (x) any more, by the same reference: Cancel is the one way
// out of a search, and a second control in the same few points asking
// "empty this" was one more thing to tell apart. Emptying the words is
// the keyboard's delete.
//
// Its colours are the theme's, so it follows the look chosen in Profile:
// the glass a step heavier than the box for the pill, the accent for the
// word — the ink "Clear" and "Bỏ lọc" already wear as words that do
// something. Not the accent as a fill: in this app that is a row or a
// chip the reader has chosen (`accentSoft`), and Cancel would read as
// one.
//
// Decorative chrome only otherwise: no title, no back control. The screen
// owns the row the box sits in, and when Cancel shows — on focus for a
// box that filters a screen, always for the Search screen, whose whole
// reason is the search.

import React from 'react';
import { LayoutAnimation, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, radius } from '../theme';
import { PressableScale, useReducedMotion } from './ui';

/**
 * The slide: 200ms, eased out, the pill fading as the words give way —
 * long enough to be seen as the box making room, short enough not to
 * stand between the tap and the keyboard. Configured before the render
 * that moves things, which is how `LayoutAnimation` works, so it runs
 * from the two places that change it: the focus that opens and the tap
 * that closes. Exported because the filter sheet's Reset makes room the
 * same way, and two speeds for one gesture would read as two gestures.
 */
export const SLIDE = LayoutAnimation.create(200, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity);

export default function SearchField({
  value, onChangeText, placeholder, inputRef, autoFocus, onSubmitEditing, onFocus, cancel,
  // Whole ids, not a prefix the ids are built from. `scripts/maestroIds.test.ts`
  // reads the smoke flows' ids back out of the source as literal strings on
  // the lines that set `testID`, and a `${prefix}-input` template has no
  // fixed front for it to match — the Search flow's `search-input` would
  // read as removed. Spelling both ids out here keeps that check honest.
  testID = { input: 'search-input', cancel: 'search-cancel' },
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  inputRef?: React.Ref<TextInput>;
  /** The two ids a smoke flow or a test reaches for. The Search screen
   *  keeps the default, which is what its flows already name. */
  testID?: { input: string; cancel: string };
  autoFocus?: boolean;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  onFocus?: TextInputProps['onFocus'];
  /** The way out, inside the box: shown when `shown`, the word `label`. */
  cancel?: { shown: boolean; label: string; onPress: () => void };
}) {
  const still = useReducedMotion();
  const slide = () => { if (!still) LayoutAnimation.configureNext(SLIDE); };
  return (
    <View style={[s.field, cancel?.shown && s.fieldWithCancel]}>
      <Ionicons name="search-outline" size={19} color={colors.textTertiary} />
      <TextInput
        ref={inputRef}
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="never"
        onSubmitEditing={onSubmitEditing}
        onFocus={(e) => {
          if (cancel && !cancel.shown) slide();
          onFocus?.(e);
        }}
        testID={testID.input}
      />
      {cancel?.shown ? (
        <PressableScale
          onPress={() => { slide(); cancel.onPress(); }}
          scaleTo={0.94}
          haptic="selection"
          contentStyle={s.cancel}
          accessibilityRole="button"
          accessibilityLabel={cancel.label}
          testID={testID.cancel}
        >
          <Text style={s.cancelText}>{cancel.label}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.pill, paddingHorizontal: 16, height: 44,
  },
  // The pill sits 4pt inside the box's own edge on the right, as it does
  // above and below: a 34pt pill in a 44pt box less its 1pt hairline.
  fieldWithCancel: { paddingRight: 4 },
  input: { flex: 1, color: colors.text, fontSize: 16, padding: 0 },
  cancel: {
    height: 34, paddingHorizontal: 14, borderRadius: radius.pill,
    justifyContent: 'center', backgroundColor: colors.surfaceGlassStrong,
  },
  cancelText: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },
});
