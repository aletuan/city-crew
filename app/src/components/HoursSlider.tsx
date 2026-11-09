// The opening-hours slider in Explore's filter sheet: two heads on one
// trading day, 06:00 to 06:00, under the three segments it is the other
// drawing of. The rule between the two lives in `lib/hoursSlider`; this
// draws it and turns a finger into minutes.
//
// It is drawn as the segment track is, on purpose (owner, 9 Nov 2026:
// "consistent with the current UI"). The ground is the track's glass at
// the track's height, and the span between the heads wears the chosen
// segment's accentSoft and accentLine at the segment's radius, so a span
// reads as a chosen segment stretched to where the heads are, rather
// than as a second kind of control. The reference sketch had a thin rail
// with a coloured bar on it: that is iOS's own slider, and the sheet has
// no other control in that shape.
//
// PanResponder and not gesture-handler, because the sheet's own pull is
// a PanResponder (`sheetDrag`), capturing only a movement that is mostly
// down. A sideways drag on a head is never one, so the head keeps it;
// two responder systems on one sheet would have to be taught that
// instead of agreeing by construction.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import type { HoursWindow } from '../lib/exploreFilters';
import { AXIS, clockAt, headToMove, moveHead, STEP, type Heads } from '../lib/hoursSlider';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';
import { fireHaptic, SECONDARY_CONTROL_H, useReducedMotion } from './ui';

/** The track's padding, as the segment track's (`TRACK_INSET`). */
const INSET = 4;
/** A head's disc. Inside the 36 the track leaves, with 4 either side. */
const HEAD = 28;
/** A head's target, out to 44 square, the app's smallest. */
const HEAD_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
/**
 * How long the heads take to travel to a segment chosen above them. The
 * travel is the point: it is what shows that the segment and the heads
 * are one answer. Short, because the finger that chose is already
 * looking for the next thing; the sheet's own Reset slide is 220 too.
 */
const TRAVEL_MS = 220;
/** The ticks under the track: every six hours, both ends 06:00. */
const TICKS = [0, 360, 720, 1080, AXIS];

export function HoursSlider({ heads, now, onMove }: {
  heads: Heads;
  /** The present moment on the axis, for the mark under the track. */
  now: number;
  /** A new span, on steps. The sheet turns it into an answer. */
  onMove: (span: HoursWindow) => void;
}) {
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const [held, setHeld] = useState<'from' | 'to' | null>(null);
  const still = useReducedMotion();
  // Positions on the axis, animated: a segment chosen above moves the
  // heads, and they travel; a finger moves them, and they are where it
  // is. Animated here rather than by the sheet's LayoutAnimation, which
  // would move whatever else that render shifted too.
  const at = useRef({ from: new Animated.Value(heads.from), to: new Animated.Value(heads.to) }).current;
  const dragging = useRef(false);
  useEffect(() => {
    if (dragging.current || still) {
      at.from.setValue(heads.from);
      at.to.setValue(heads.to);
      return;
    }
    Animated.parallel([
      Animated.timing(at.from, { toValue: heads.from, duration: TRAVEL_MS, useNativeDriver: false }),
      Animated.timing(at.to, { toValue: heads.to, duration: TRAVEL_MS, useNativeDriver: false }),
    ]).start();
  }, [heads.from, heads.to, still, at]);
  // The responders are made once; what they read changes every render.
  const live = useRef({ heads, onMove, width });
  live.current = { heads, onMove, width };

  // The run a head's centre travels, in points. At least one, so a track
  // not yet laid out cannot divide by nothing.
  const run = Math.max(1, width - 2 * INSET - HEAD);
  const x = (pos: number) => INSET + (pos / AXIS) * run;
  const ax = (pos: Animated.Value) => Animated.add(INSET, Animated.multiply(pos, run / AXIS));

  const responders = useMemo(() => {
    const make = (touched: 'from' | 'to') => {
      let start: HoursWindow = { from: 0, to: 0 };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Once a head has the finger, the sheet does not get it back
        // mid-drag: a drag that drifts down is still a drag.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragging.current = true;
          start = { from: live.current.heads.from, to: live.current.heads.to };
          setHeld(touched);
        },
        onPanResponderMove: (_, g) => {
          const { heads: at, onMove: move, width: w } = live.current;
          const delta = (g.dx / Math.max(1, w - 2 * INSET - HEAD)) * AXIS;
          const head = headToMove(start, touched, delta);
          const next = moveHead(start, head, delta);
          if (next.from === at.from && next.to === at.to) return;
          setHeld(head);
          // A tick on every whole hour a head lands on, not on every
          // step: forty-eight ticks across the day is a buzz, not a
          // count.
          if (next[head] % 60 === 0) fireHaptic('selection');
          move(next);
        },
        onPanResponderRelease: () => { dragging.current = false; setHeld(null); },
        onPanResponderTerminate: () => { dragging.current = false; setHeld(null); },
      });
    };
    return { from: make('from'), to: make('to') };
  }, []);

  /** VoiceOver's swipe up and down: a step at a time, the head alone —
   *  no picking a side by direction, since the reader chose a head. */
  const nudge = (head: 'from' | 'to') => (e: AccessibilityActionEvent) => {
    const delta = e.nativeEvent.actionName === 'increment' ? STEP : -STEP;
    onMove(moveHead(heads, head, delta));
  };

  const together = heads.from === heads.to;
  const label = (head: 'from' | 'to') => head === 'from'
    ? t('Open from', 'Mở từ', '開始', '营业自', '營業自')
    : t('Open until', 'Mở đến', '終了', '营业至', '營業至');

  return (
    <View style={s.wrap}>
      <View
        style={s.track}
        testID="hours-track"
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        {/* The span, hugging both heads, so two heads together are one
            chosen segment the width of a head rather than nothing. */}
        <Animated.View
          testID="hours-span"
          style={[s.span, heads.muted && s.mutedSpan, {
            left: Animated.multiply(at.from, run / AXIS),
            width: Animated.add(HEAD + 2 * INSET, Animated.multiply(Animated.subtract(at.to, at.from), run / AXIS)),
          }]}
        />
        {(['from', 'to'] as const).map((head) => (
          <Animated.View
            key={head}
            {...responders[head].panHandlers}
            testID={`hours-head-${head}`}
            hitSlop={HEAD_SLOP}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={label(head)}
            accessibilityValue={{ text: clockAt(heads[head]) }}
            // react-native-web drops `accessibilityValue`, as it drops
            // `accessibilityState` from the segments (`aria-checked`
            // there for the same reason).
            aria-valuetext={clockAt(heads[head])}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={nudge(head)}
            style={[s.head, heads.muted && s.mutedHead, { left: ax(at[head]) }]}
          >
            <View style={s.grip} />
          </Animated.View>
        ))}
        {/* The time over the head under the finger, while it is there.
            Drawn over the segments above rather than given a row of its
            own: the sheet already ends at the home indicator on a 390pt
            phone, and the span's two ends are written in the heading. */}
        {held ? (
          <View style={[s.bubble, { left: x(heads[held]) + HEAD / 2 - BUBBLE_W / 2 }]} pointerEvents="none" testID="hours-bubble">
            <Text style={s.bubbleText}>{clockAt(heads[held])}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.ticks} pointerEvents="none">
        {TICKS.map((pos) => (
          <Text key={pos} style={[s.tick, { left: x(pos) + HEAD / 2 - TICK_W / 2 }]}>{clockAt(pos)}</Text>
        ))}
        {/* Where now is, so a span can be set against it — and so the
            heads, brought together on it, are seen to be on it. Hidden
            under them when they are: "Open now" needs no second mark. */}
        {together && Math.abs(heads.from - now) < 1 ? null : (
          <View style={[s.now, { left: x(now) + HEAD / 2 - NOW / 2 }]} testID="hours-now" />
        )}
      </View>
    </View>
  );
}

const BUBBLE_W = 52;
const TICK_W = 40;
const NOW = 5;

const s = StyleSheet.create({
  wrap: { marginTop: 12 },
  track: {
    height: SECONDARY_CONTROL_H,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.card - 2,
  },
  span: {
    position: 'absolute', top: INSET, height: SECONDARY_CONTROL_H - 2 * INSET,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
    borderRadius: radius.card - 7,
  },
  // "Closed now" marks a moment, not a span anything is open in.
  mutedSpan: { opacity: 0.45 },
  head: {
    position: 'absolute', top: (SECONDARY_CONTROL_H - HEAD) / 2,
    width: HEAD, height: HEAD, borderRadius: HEAD / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.accentLine,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  mutedHead: { opacity: 0.6 },
  // Two short lines, the grip every draggable thing on iOS wears.
  grip: { width: 8, height: 10, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.accent },
  bubble: {
    position: 'absolute', top: -30, width: BUBBLE_W, height: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.accentLine,
  },
  bubbleText: { color: colors.accent, fontSize: 12, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  ticks: { height: 20, marginTop: 3 },
  tick: {
    position: 'absolute', top: 6, width: TICK_W, textAlign: 'center',
    color: colors.textTertiary, fontSize: 11, fontVariant: ['tabular-nums'],
  },
  now: { position: 'absolute', top: 0, width: NOW, height: NOW, borderRadius: NOW / 2, backgroundColor: colors.accent },
});
