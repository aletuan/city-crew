// One stop of an evening: the hour, the rail, and the stop beside them.
//
// The options card and the saved trip drew this row separately — the
// same hour column, the same pair of marks for the stop the picture is
// on, the same name over meta over sentence, the same journey out — and
// kept two copies of every style, which #783 had to make agree by hand
// after the rail moved. This is the one copy. The editor does not use it:
// its stop is a card with a photograph and controls, a different thing
// that happens to stand beside the same rail.
//
// ── what the two screens still decide ──
//
// The words. The meta line is `stopFacts`'s on the options card and
// `summaryLine`'s on the saved trip; the sentence is the model's, with
// its language mark where the saved trip knows one; whether the body
// opens a place, and what VoiceOver calls that. All of it arrives as
// strings and a callback, so this file holds no knowledge of a plan or a
// trip row — it is a row, and the screens are what make it a stop.
//
// ── the pair of marks ──
//
// When the picture above is this stop's, the hour takes the accent and
// the name goes a weight heavier. Weight only, and nothing dimmed: fading
// the other rows would make the itinerary harder to read to say
// something about the carousel, and the itinerary is why the screen
// exists. Semibold to bold is a small shift on purpose — findable when
// you look, invisible when you do not — and the hour beside it is the
// louder half of the pair, the one that carries at a glance.
//
// ── measurements ──
//
// `flex-start`, not `center`: a stop is two lines or more, and centred
// the hour and the mark would float to the middle instead of sitting on
// the name they belong to. The hour's 2pt of top padding is optical, not
// arithmetic — the caption's smaller cap height sits high in its line
// box, so matching the box tops leaves the digits reading above the
// name. 12pt under every stop but the last, where the saved trip had a
// hairline with 12pt either side and the options card had 10pt either
// side of the leg; the rail's line fills it. The journey out sits 8pt
// under the last line, so between two stops the rhythm is 8 above the
// leg and 12 below — the options card's old 10 and 10, moved by two.

import React from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useI18n } from '../lib/i18n';
import type { Leg } from '../lib/travel';
import { colors, font, space, type } from '../theme';
import LegRow from './LegRow';
import { RailColumn } from './rail';
import { PressableScale } from './ui';

export default function StopRow({
  time, here = false, first, last, land, name, gone, meta, why, whyLang, whyLines, nameLines, leg,
  onPress, pressLabel, style, timeTestID,
}: {
  /** The arrival, already formatted; null prints a dash. */
  time: string | null;
  /** For the smoke flows, which read a stop's hour back by id. */
  timeTestID?: string;
  /** Whether the picture above is this stop's. */
  here?: boolean;
  first: boolean;
  last: boolean;
  /** The options card's landing for the paw — see `rail`. */
  land?: Animated.Value;
  /** The place's name, or null for a place the catalog no longer lists. */
  name: string | null;
  /** What to print in a delisted stop's place. */
  gone?: string;
  meta?: string | null;
  /** The model's sentence, and the language it was written in when known. */
  why?: string | null;
  whyLang?: string | null;
  whyLines?: number;
  nameLines?: number;
  /** The journey out of this stop, when it could be measured. */
  leg?: Leg | null;
  /** Where the body goes when pressed, and VoiceOver's name for that. */
  onPress?: () => void;
  pressLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { lang } = useI18n();
  const body = (
    <>
      {name !== null
        ? (
          <>
            <Text style={[s.name, here && s.nameHere]} numberOfLines={nameLines}>{name}</Text>
            {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
          </>
        )
        : <Text style={s.gone}>{gone}</Text>}
      {!!why && (
        <Text style={s.why} numberOfLines={whyLines} testID="stop-why">
          {why}
          {whyLang && whyLang !== lang ? <Text style={s.whyLang}>{`  · ${whyLang.toUpperCase()}`}</Text> : null}
        </Text>
      )}
    </>
  );
  return (
    <View style={[s.row, !last && s.gap, style]}>
      <Text style={[s.time, here && s.timeHere]} testID={timeTestID}>{time ?? '—'}</Text>
      <RailColumn first={first} last={last} land={land} />
      <View style={s.body}>
        {onPress
          ? (
            // Split across the two halves on purpose: the outer takes the
            // column's width, the inner spaces the lines — `PressableScale`
            // documents this exact trap.
            <PressableScale
              containerStyle={s.pressOuter}
              style={s.lines}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={pressLabel}
            >
              {body}
            </PressableScale>
          )
          : <View style={s.lines}>{body}</View>}
        {leg && <LegRow leg={leg} style={s.leg} />}
      </View>
    </View>
  );
}

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  gap: { paddingBottom: 12 },
  time: {
    ...CAPTION, color: colors.textSecondary, width: 44,
    fontVariant: ['tabular-nums'], paddingTop: 2,
  },
  timeHere: { color: colors.accent, fontWeight: font.semibold },
  body: { flex: 1 },
  pressOuter: { alignSelf: 'stretch' },
  lines: { gap: space.nameToMeta },
  name: { ...type.body, color: colors.text, fontWeight: font.semibold },
  nameHere: { fontWeight: font.bold },
  meta: { ...CAPTION, color: colors.textTertiary },
  gone: { ...type.body, color: colors.textTertiary, fontStyle: 'italic' },
  // A step down from the name and up from the meta line, because it is
  // the row's only claim about why this place rather than another.
  why: { ...CAPTION, color: colors.textSecondary, lineHeight: 18 },
  whyLang: { color: colors.textTertiary, fontWeight: font.semibold },
  leg: { marginTop: 8 },
});
