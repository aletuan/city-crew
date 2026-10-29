// "New", in the corner of a collection's cover (owner, 29 Oct 2026).
//
// One mark for every place a collection card is drawn — the Collections
// grid and list, Explore's shelf, Search — so a list made this week looks
// new everywhere it turns up, not on one screen. Which lists are new is
// `isNewList` (`lib/newest`): made in the last seven days, by somebody
// other than the reader.
//
// A label, not a button: it sits on a card that is already the control,
// so it takes no press and is not on the button scale. The card's own
// ground and ink, opaque, so it reads on any photograph in either theme —
// the owner's mockup drew it cream on a dark cover, which is the light
// theme's `surfaceCard`. Pinned to the top-left corner of whatever cover
// holds it, the corner a reader's eye starts in and the one nothing else
// on a card uses: the title and the heart are along the bottom.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useI18n } from '../lib/i18n';
import { colors, font } from '../theme';

export default function NewBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n();
  return (
    <View style={[s.badge, style]} testID="new-badge" pointerEvents="none">
      <Text style={s.word}>{t('New', 'Mới', '新着', '新', '新')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // 10pt in from both edges: clear of every card's corner radius (the
  // shelf's is the largest, at `radius.card`), and the mockup's inset.
  badge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: colors.surfaceCard,
  },
  word: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: font.semibold },
});
