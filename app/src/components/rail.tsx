// The rail an itinerary runs down: a paw where the evening starts, a dot
// at every stop after it, and a line between.
//
// Three screens draw the same evening — the options card, the editor,
// the saved trip — and until 3 Oct 2026 they drew three rails: coral
// dots on the options card, numbered discs in the editor, no rail at all
// on the saved trip. The owner asked for one, and for it to be the
// options card's. So this is that rail, lifted out of `PlanOptionsScreen`
// with its sizes and offsets intact, and the other two screens draw it
// too. "The same mark" is a fact about the code now rather than a hope
// about three files, as `PageDots` is for the carousels.
//
// ── why the paw ──
//
// The screen before the options card spends five seconds on a paw in a
// ring — the orb the reader watches while the planner works — and the
// paw on the first stop is where that orb lands: the thing that was
// working becomes the thing it made. Carried into the editor and the
// saved trip, the mark the reader followed is still standing at the
// start of their evening after they tap "View & edit" and after they
// save. Numbers, which the editor wore instead, said only the order,
// and the rail and the clock say that already.
//
// ── why coral on every stop ──
//
// The theme's rule is that coral marks active state and is used
// sparingly, and a dot on every stop is not a state. The rail is the
// exception the theme header records: it is the route itself, drawn once
// per screen, and the options card had worn it this way from the start.
// What the rule still forbids is a coral *surface* under a thing that is
// not the route — the editor's numbered discs were that, and went.
//
// ── sizes ──
//
// 16pt column, which is what the start mark needs to hold a legible 9pt
// paw; the 8pt dots centre in it, so dots and line stay on one axis. The
// dot sits 6pt down and the paw 2pt, measured against a 15pt name's cap
// height on the options card: a disc twice the width reaches the cap
// height on its own, a dot has to be nudged down to it. The editor sets
// the mark beside a card's top edge rather than a line of type, and
// keeps the same offsets rather than tuning a second pair — one mark,
// one place it sits.

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';

/** The mark on the first stop. With `land`, it settles into place — the
 *  options card's arrival, see `useArrival` there; without, it is simply
 *  there, which is what a screen reached by a tap wants. */
export function StartMark({ land }: { land?: Animated.Value }) {
  // 2.6 rather than the orb's true ratio to this mark. Landing from the
  // full 92pt would put a disc over the stop's name for a sixth of a
  // second, which is a bloom across the text rather than a mark arriving.
  const landing = land
    ? { opacity: land, transform: [{ scale: land.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) }] }
    : undefined;
  return (
    <Animated.View style={[s.start, landing]} testID="rail-start">
      <Ionicons name="paw" size={9} color={colors.accentInk} />
    </Animated.View>
  );
}

/**
 * One stop's column: its mark, and the line down to the next stop when
 * there is one. `alignSelf: 'stretch'` and a `flex: 1` line, so the line
 * reaches the next mark whatever stands beside it — a one-line row, a
 * card with a photograph, a leg nested under a stop. The options card
 * learned this the hard way: its line used to be `height: 34`, measured
 * once against a one-line row and then load-bearing, and every change to
 * the spacing broke the timeline into stubs.
 */
export function RailColumn({ first, last, land }: {
  first: boolean;
  last: boolean;
  land?: Animated.Value;
}) {
  return (
    <View style={s.col}>
      {first ? <StartMark land={land} /> : <View style={s.dot} testID="rail-dot" />}
      {!last && <View style={s.line} testID="rail-line" />}
    </View>
  );
}

/** The column's width, for a screen that lines something up with the
 *  body beside it. */
export const RAIL_WIDTH = 16;

const s = StyleSheet.create({
  col: { alignItems: 'center', width: RAIL_WIDTH, alignSelf: 'stretch' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: colors.accentFill },
  start: {
    width: 16, height: 16, borderRadius: 8, marginTop: 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill,
  },
  line: { flex: 1, width: 2, backgroundColor: colors.borderGlassSoft },
});
