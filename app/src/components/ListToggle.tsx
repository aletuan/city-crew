// A place in one list, or not: the ⊕ that puts it there and the ✓ that
// says it is, on Search when it was opened from a collection to add to it
// (owner, 23 Oct 2026).
//
// One tap, either way, and no sheet. The bookmark asks which list because
// it does not know; here the reader already said, by opening Search from
// the list, so asking again would be the same question twice. The tick
// moves when it is tapped — `toggle` in `lib/save` draws it at once and
// writes behind.
//
// The save sheet's checkbox colours, on a disc rather than a box: ticked
// is a surface (`accentFill`, its check `accentInk`), unticked is the
// glass every other control on a card wears. A disc because on a card it
// takes the bookmark's corner, and the bookmark is a disc.

import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../lib/i18n';
import { colors, onPhoto } from '../theme';
import { PressableScale } from './ui';

export default function ListToggle({ on, title, onPress, overPhoto, style, testID }: {
  on: boolean;
  /** The list's name, for a screen reader: "Add to Thảo Điền, checked". */
  title: string;
  onPress: () => void;
  /** On a card's photograph, in the bookmark's place: its size and its
   *  dark glass. Off one, the row's smaller disc on the screen's glass. */
  overPhoto?: boolean;
  /** Where it sits: the card's corner. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      // What react-native-web keeps of the state — see `SaveSheet`.
      aria-checked={on}
      accessibilityLabel={t(`Add to ${title}`, `Thêm vào ${title}`, `「${title}」に追加`, `添加到“${title}”`, `新增到「${title}」`)}
      hitSlop={overPhoto ? 8 : 10}
      testID={testID}
      style={style}
      contentStyle={[overPhoto ? s.photo : s.row, on && s.on]}
    >
      <Ionicons
        name={on ? 'checkmark' : 'add'}
        size={overPhoto ? 22 : 20}
        color={on ? colors.accentInk : overPhoto ? onPhoto.text : colors.accent}
      />
    </PressableScale>
  );
}

const s = StyleSheet.create({
  // The bookmark's disc, to the point: 40pt, the same glass and hairline.
  photo: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  // A row's: 34pt beside a 64pt thumbnail, with the 10pt slop making 54.
  row: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  on: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
});
