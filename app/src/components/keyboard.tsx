// A field that stands on the keyboard: where it is, frame by frame.
//
// ── the run, measured ──
//
// A field at the foot of a page (the thread's) or over one (the first
// comment's, `CommentQuick`) has to move as the keyboard moves, or it is
// seen arriving after it. It did: the field ran the keyboard's reported
// duration on a bezier drawn from UIKit's old curve, and on the owner's
// phone (a 60 fps recording, 27 Nov 2026) the keyboard was 74% of the way
// up after 100 ms and 96% after 200, while the field took 400 to land —
// 35 pt behind it for most of the run, its row hidden under the keys, and
// on the thread's page (a `KeyboardAvoidingView` then) not on screen at
// all for the first 270.
//
// So the run is the keyboard's own, read off that recording: the top of
// the Q key in each frame of three rises, as a share of the 317 pt it
// travels. Two falls, measured the same way, lie on the same figures half
// a frame along, so one table serves both ways. It is not a bezier and no
// fit is claimed: the table is the easing. The duration is the table's,
// not the event's — what the event reported was never read off a device,
// and the run it produced was the late one.
//
// Not verified on a phone: that the field now holds to the keyboard
// within a frame. The next recording says.
//
// iOS alone. Android sends no `Will` event and its window gives way to
// the keyboard itself, so nothing here moves there.
//
// Rejected again, as on 22 Nov: `react-native-keyboard-controller`, which
// follows the keyboard frame by frame and would need no table — a native
// module, so a new binary through TestFlight.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** The keyboard's progress at each sixtieth of a second, start to rest. */
export const KEYBOARD_RUN = [
  0, 0.167, 0.3, 0.438, 0.558, 0.662, 0.741, 0.811, 0.858, 0.896, 0.924,
  0.943, 0.959, 0.968, 0.978, 0.984, 0.987, 0.991, 0.994, 0.996, 0.998, 1,
] as const;
/** How long that is: 21 frames. */
export const KEYBOARD_MS = Math.round(((KEYBOARD_RUN.length - 1) * 1000) / 60);

/** The table as an easing: progress at `t`, 0 to 1 of the run. */
export function keyboardCurve(t: number): number {
  const at = Math.min(Math.max(t, 0), 1) * (KEYBOARD_RUN.length - 1);
  const i = Math.min(Math.floor(at), KEYBOARD_RUN.length - 2);
  return KEYBOARD_RUN[i] + (KEYBOARD_RUN[i + 1] - KEYBOARD_RUN[i]) * (at - i);
}

/**
 * How far a field at the screen's foot stands above it: `ride`, to move it
 * by on the native driver, and `lift`, the same distance as a plain number
 * for whatever has to make room (a scroll view's foot).
 *
 * The distance is the keyboard's height less `margin` — the home
 * indicator's inset the field keeps under its row, which the keyboard then
 * covers; never below the foot, for a keyboard shorter than that.
 */
export function useRide(margin: number): { ride: Animated.Value; lift: number } {
  const ride = useRef(new Animated.Value(0)).current;
  const [lift, setLift] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const to = (up: number) => {
      setLift(up);
      Animated.timing(ride, { toValue: 0 - up, duration: KEYBOARD_MS, easing: keyboardCurve, useNativeDriver: true }).start();
    };
    const rise = Keyboard.addListener('keyboardWillShow', (e) => to(Math.max(0, e.endCoordinates.height - margin)));
    const fall = Keyboard.addListener('keyboardWillHide', () => to(0));
    return () => { rise.remove(); fall.remove(); };
  }, [ride, margin]);
  return { ride, lift };
}

/**
 * A field docked at a page's foot, riding the keyboard.
 *
 * `dock(field)` draws it over the page's foot, and `room` is what the page
 * must leave clear under its last line: the field's own height, and the
 * keyboard's while it is up. The page's scroll view keeps its full height
 * and gets that room as a spacer, where a `KeyboardAvoidingView` resized
 * it — late, as the header tells. The field keeps `margin` under its row
 * the whole time; the keyboard covers it.
 */
export function useKeyboardDock(margin: number): { dock: (field: React.ReactNode) => React.ReactElement; room: number } {
  const { ride, lift } = useRide(margin);
  const [height, setHeight] = useState(0);
  const dock = (field: React.ReactNode) => (
    <Animated.View
      style={[s.dock, { transform: [{ translateY: ride }] }]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      testID="keyboard-dock"
    >
      {field}
      <View style={s.under} pointerEvents="none" />
    </Animated.View>
  );
  return { dock, room: height + lift };
}

const s = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // The field's ground carried on down under the keyboard, so what shows
  // round the keyboard's rounded top corners is this and not the page.
  under: { position: 'absolute', top: '100%', left: 0, right: 0, height: 600, backgroundColor: colors.bg },
});
