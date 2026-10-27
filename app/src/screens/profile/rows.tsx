// The rows Profile's cards are made of: the glyph slot, the feature row,
// the setting row, the switch row and the About-me row.

import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CountBadge, PressableScale, Toggle } from '../../components/ui';
import { colors } from '../../theme';
import { GLYPH_BOX, CAPTION_LINE, TITLE_LINE, s } from './styles';

/**
 * The glyph every row on this screen leads with: bare, 19pt, in the
 * tertiary ink, the way `PlaceDetailScreen` draws the address, the phone
 * and the hours.
 *
 * Until 5 Oct 2026 every row wore a 44pt coral well around a 20pt glyph,
 * and a second opinion the owner brought read the wells, not the glyphs,
 * as the thing competing with the words. The well came off the three
 * rows of facts first (About me), on the argument that a well could mean
 * "this row answers a tap" and a bare glyph "this row only tells you
 * something". The owner then asked for the rest of the screen to follow
 * (6 Oct): the settings rows and the crew card already carry a chevron,
 * which says "goes somewhere" on its own, so the well was saying it a
 * second time in colour. One treatment on the screen, then, and the
 * accent is left to what it marks here — the level ring, the request
 * dot, the values that are links.
 *
 * The slot keeps the well's 44pt, so the words column sits where it did
 * on every row of every card. The Delete account screen's download row
 * and the Activity screen's feed marks followed the same day, to these
 * figures; the well is gone from the Profile stack.
 */
export function RowGlyph({ name, line }: {
  name: keyof typeof Ionicons.glyphMap;
  /** The height of the row's first line, when the glyph should sit level
   *  with it rather than with the row's middle — see `GLYPH_BOX`. */
  line?: number;
}) {
  const lift = line == null ? undefined : { height: GLYPH_BOX, marginTop: (line - GLYPH_BOX) / 2 };
  return (
    <View style={[s.rowGlyph, lift]} testID="row-glyph">
      <Ionicons name={name} size={19} color={colors.textTertiary} />
    </View>
  );
}

export function FeatureRow({ icon, title, sub, onPress, last, count }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
  /** A number at the row's end — see `CountBadge`. */
  count?: number;
}) {
  return (
    <PressableScale
      scaleTo={0.98}
      contentStyle={[s.twoLineRow, !last && s.featureRowDivider]}
      onPress={onPress}
      accessibilityRole="button"
      testID="feature-row"
    >
      <RowGlyph name={icon} line={TITLE_LINE} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.featureTitle}>{title}</Text>
        <Text style={s.featureSub}>{sub}</Text>
      </View>
      <CountBadge n={count ?? 0} style={s.rowEnd} />
      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} />
    </PressableScale>
  );
}

/**
 * A setting that is on or off: the label and the switch where a value
 * row has its value.
 *
 * `SettingRow`'s label, not `FeatureRow`'s title: this is still a
 * setting, and a setting's name is regular weight (see `SettingRow`). The
 * switch is the control; the row around it is not a button,
 * so there is one thing to find and one thing VoiceOver names.
 */
export function SwitchRow({ icon, label, value, onChange, last, testID, rowRef }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Null while it is being read: drawn off, and not to be pressed. */
  value: boolean | null;
  onChange: (on: boolean) => void;
  last?: boolean;
  testID?: string;
  rowRef?: React.Ref<React.ComponentRef<typeof View>>;
}) {
  return (
    <View ref={rowRef} style={[s.twoLineRow, !last && s.featureRowDivider]} testID={testID}>
      <RowGlyph name={icon} line={TITLE_LINE} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[s.settingLabel, { lineHeight: TITLE_LINE }]}>{label}</Text>
      </View>
      <Toggle
        value={value ?? false}
        disabled={value === null}
        onValueChange={onChange}
        accessibilityLabel={label}
        style={s.rowEnd}
      />
    </View>
  );
}

/**
 * A setting and what it is currently set to.
 *
 * Not `FeatureRow`, though it was for a while and the difference is
 * what the second line holds. Under a feature it is a sentence —
 * "Sign in to save your favorite places" — and a sentence needs a
 * heading above it, which is why that row's title is the loud half.
 * Under a setting it is a *value*, and a value does not want a heading,
 * it wants to sit next to the thing it is the value of.
 *
 * So it moves to the right, by the chevron, the way every settings row
 * on the platform puts it — and the label drops to regular weight,
 * because nothing on iOS's own Settings screen is semibold either. What
 * made the label shout was never a decision about settings; it was
 * inherited from a card built to sell features to a signed-out visitor.
 *
 * The point of the move is not only the weight. Stacked under About me,
 * two cards of round-icon-plus-two-lines were reading as one kind of
 * thing with its typography flipped at random: quiet label over loud
 * value in the first, loud label over quiet value in the second. Putting
 * the value on the right makes them plainly two different rows, and the
 * question of which hierarchy is "right" stops being asked.
 */
export function SettingRow({ icon, label, value, onPress, last, testID }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Absent on rows that are a destination rather than a setting. */
  value?: string;
  onPress: () => void;
  last?: boolean;
  testID?: string;
}) {
  return (
    <PressableScale
      scaleTo={0.98}
      contentStyle={[s.featureRow, !last && s.featureRowDivider]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
    >
      <RowGlyph name={icon} />
      <Text style={s.settingLabel} numberOfLines={1}>{label}</Text>
      {/* The value takes what is left and truncates rather than wrapping:
          a settings row that grows a second line for one city and not
          another makes the card look uneven for a reason nobody can see.

          One line, and only the value. The city row has tried to say
          more here twice. "Hà Nội · theo vị trí của bạn" on the one line
          truncated on a 320pt window, and the half that went was the
          half that explained the city. A second, smaller line under the
          name ("Theo vị trí" / "Tự chọn", #795) kept the words but made
          this the one row in the card that was two lines tall, beside
          Language and Appearance at one — the thing the move to the
          right had been for was that the three rows read as one kind.
          Where the city came from is said in the sheet this row opens,
          under "Use my location", where there is room to say it in a
          sentence; the row names the city and leaves the rest to it.

          With no value it is still what holds the glyph against the right
          edge, so the empty case is a spacer rather than nothing. */}
      {value === undefined
        ? <View style={{ flex: 1 }} />
        : <Text style={s.settingValue} numberOfLines={1}>{value}</Text>}
      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
    </PressableScale>
  );
}

export function AboutRow({ icon, label, value, children, last, valueTestID }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valueTestID?: string;
  /** The plain answer. Omitted by the one row that draws its own. */
  value?: string;
  /** Drawn in the value's place — the taste row's chips, today. Kept as a
   *  slot rather than a `kind` prop so the row stays a row: it still owns
   *  the glyph, the label and the divider, and only the answer changes
   *  shape. */
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[s.twoLineRow, !last && s.featureRowDivider]} testID="about-row">
      <RowGlyph name={icon} line={CAPTION_LINE} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.aboutLabel}>{label}</Text>
        {children ?? <Text style={s.aboutValue} testID={valueTestID}>{value}</Text>}
      </View>
    </View>
  );
}
