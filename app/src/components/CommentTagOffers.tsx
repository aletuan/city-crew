// What "@" offers while a comment is being written (C5 of
// `docs/comments-plan.md`): the people the writer may tag and the
// list's places, as rows over the field. Which rows, and how many, is
// `lib/commentTags.offersFor`; this draws them and says which was
// pressed.
//
// ── rows, not chips ──
//
// A row has room for a face and two names — the handle that will be
// written and the name the writer knows the person by — which is how a
// tag is chosen when two friends' handles begin alike. Chips over the
// keyboard (WhatsApp's old way) show one word each.
//
// A person's row is their face; a place's is the pin the app uses for
// places everywhere, in a disc of the face's size, so the two kinds are
// told apart before a word is read. The second line says "Place" and
// nothing more: the list is the list's own, and its address would be a
// third thing to read.
//
// The rows do not scroll (`OFFERED`), and they stand over the field and
// not under the keyboard's own bar: pressed, they keep the keyboard up.
// Nothing here is inside a `ScrollView`, which is what would take the
// first tap to put the keyboard away (`CommentQuick` has that story).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './ui/controls';
import { Glyph, ICON } from './ui/glyph';
import { SECONDARY_CONTROL_H } from './ui/layout';
import { Avatar } from './ui/surfaces';
import { wordsOf, type Offer } from '../lib/commentTags';
import { useI18n } from '../lib/i18n';
import { colors, font } from '../theme';

/** The face on a row: the composer's own 28. */
const FACE = 28;

export default function CommentTagOffers({ offers, onTake }: {
  offers: readonly Offer[];
  onTake: (offer: Offer) => void;
}) {
  const { t } = useI18n();
  if (!offers.length) return null;
  return (
    <View style={s.list} testID="composer-offers">
      {offers.map((offer) => {
        const words = wordsOf(offer);
        const isPerson = offer.kind === 'person';
        const second = isPerson
          ? offer.person.full_name
          : t('Place', 'Địa điểm', 'スポット', '地点', '地點');
        return (
          <PressableScale
            key={isPerson ? `u:${offer.person.id}` : `p:${offer.place.id}`}
            onPress={() => onTake(offer)}
            haptic="selection"
            contentStyle={s.row}
            accessibilityRole="button"
            accessibilityLabel={t(`Tag ${words}`, `Gắn thẻ ${words}`, `${words} をタグ付け`, `标记 ${words}`, `標記 ${words}`)}
            testID={isPerson ? 'composer-offer-person' : 'composer-offer-place'}
          >
            {isPerson ? (
              <Avatar url={offer.person.avatar_url} size={FACE} />
            ) : (
              <View style={s.pin}>
                <Glyph name="location-outline" size={ICON.text} color={colors.textSecondary} />
              </View>
            )}
            <View style={s.names}>
              <Text style={s.first} numberOfLines={1}>{isPerson ? offer.person.handle : offer.place.name}</Text>
              {second ? <Text style={s.second} numberOfLines={1}>{second}</Text> : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 8 },
  // A row is the scale's 44, so five of them are the 220 `OFFERED` was
  // measured against.
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, height: SECONDARY_CONTROL_H },
  pin: {
    width: FACE, height: FACE, borderRadius: FACE / 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
  },
  names: { flex: 1 },
  first: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: font.medium },
  second: { color: colors.textTertiary, fontSize: 12, lineHeight: 16 },
});
