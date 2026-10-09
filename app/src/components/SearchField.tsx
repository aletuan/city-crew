// The search box, once.
//
// It was drawn inline on the Search screen — a pill, a magnifier, the
// input, a clear — and drawn again, differently, on Collections: a bare
// row with a smaller glyph and no clear. The check-ins list wanted a
// third, and three boxes that all mean "type to narrow this" should be
// one thing the reader has learned. This is the Search screen's, which
// is the one a reader meets first: a 44pt pill on the card ground with
// the hairline, a 19pt magnifier, 15.5pt type, and a clear that appears
// only once there is something to clear. Collections' row is left as it
// is for now and is the next to move over.
//
// Decorative chrome only: no title, no back control. The screen owns the
// row the box sits in, because where it sits — beside a back control on
// Search, under a title on the check-ins — is the screen's business.

import React from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius } from '../theme';
import { PressableScale } from './ui';

export default function SearchField({
  value, onChangeText, placeholder, inputRef, autoFocus, onSubmitEditing, onFocus,
  // Whole ids, not a prefix the ids are built from. `scripts/maestroIds.test.ts`
  // reads the smoke flows' ids back out of the source as literal strings on
  // the lines that set `testID`, and a `${prefix}-input` template has no
  // fixed front for it to match — the Search flow's `search-input` would
  // read as removed. Spelling both ids out here keeps that check honest.
  testID = { input: 'search-input', clear: 'search-clear' },
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  inputRef?: React.Ref<TextInput>;
  /** The two ids a smoke flow or a test reaches for. The Search screen
   *  keeps the default, which is what its flows already name. */
  testID?: { input: string; clear: string };
  autoFocus?: boolean;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  onFocus?: TextInputProps['onFocus'];
}) {
  return (
    <View style={s.field}>
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
        onFocus={onFocus}
        testID={testID.input}
      />
      {value.length > 0 && (
        <PressableScale onPress={() => onChangeText('')} scaleTo={0.9} accessibilityLabel="Clear" testID={testID.clear}>
          <Ionicons name="close-circle" size={19} color={colors.textTertiary} />
        </PressableScale>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.pill, paddingHorizontal: 16, height: 44,
  },
  input: { flex: 1, color: colors.text, fontSize: 15.5, padding: 0 },
});
