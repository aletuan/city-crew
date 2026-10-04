// The photographer's name on a photograph, wherever one is shown.
//
// Seven surfaces printed this line — the cards, the trip list, the
// invitation, the three carousels — each reading the attribution switch
// itself and each writing the same three-line conditional. One place
// reads the switch now, and a surface says only where the line sits and
// how it is set: the corner differs on purpose (bottom left under a
// carousel's marks, bottom right on a card, top right on an invitation
// where the asker takes the bottom), and the size with it.
//
// Required wherever the photo is shown, and read from the picture on
// screen — one photograph visible, one credit owed.

import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useFlag } from '../lib/useFlag';

export default function PhotoCredit({ name, style, testID }: {
  name: string | null | undefined;
  /** Where it sits and how it is set — the surface's, in full. */
  style: StyleProp<TextStyle>;
  testID?: string;
}) {
  const credit = useFlag('photo_attribution');
  if (!credit || !name) return null;
  return <Text style={style} numberOfLines={1} testID={testID}>{name}</Text>;
}
