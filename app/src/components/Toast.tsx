// A sentence that says what a tap just did, and then goes.
//
// ── what it is for, and what it is not ──
//
// It reports an outcome — "Open now · 12 places" — at the moment the
// reader is looking for one. It does not carry state: whatever it says
// has to still be true, and still readable somewhere, after it has gone,
// because two seconds later the reader is looking at the map again and
// the toast is not there to ask. On the map that somewhere is the badge
// on the filter control and the sheet behind it.
//
// This is the first toast in the app, and it is on the map rather than
// the lists for a reason `CollectionDetailScreen` gives the other way
// round: there, an undo banner sits in the page because a toast over the
// first card would report on the list by hiding part of it. A map has no
// first card. The row this rides in is empty map, and it covers nothing a
// pan cannot bring back.
//
// ── why it looks like this ──
//
// Dark in both themes. The tiles under it are Google's light ones
// whatever the scheme (see `colors.bgElevatedVeil`), so the ground that
// reads is fixed, not dynamic — the same argument as `onPhoto`. And dark
// is what makes it a message rather than a control: the two buttons
// beside it are white discs, and a white pill next to them would read as
// a third button nobody can press.
//
// 0.80 over `bgHex.dark`, measured against the light tiles it lands on
// with `onPhoto.text` for the ink: 10.33:1 over a white road, 10.65 over
// plain land, 11.42 over park green, 11.85 over water. 0.58 — the scrim
// the place cards put under their rating — is 4.55 over a road, legal and
// visibly grey; 0.86 buys nothing past 0.80 but a flatter slab.

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { font, onPhoto, radius } from '../theme';

/** One thing to say. A new `id` restarts the clock, even for the same words. */
export type ToastNote = { id: number; text: string };

/**
 * How long a note stays, from the moment it starts to appear.
 *
 * Two seconds, as asked for, and a floor rather than a taste: a line of
 * four to six words is read in about one, and the second is for the
 * reader whose eyes were on the pins when it arrived.
 */
export const TOAST_MS = 2000;
/** The fade either side of it — quick in, a little slower out. */
const IN_MS = 160;
const OUT_MS = 220;

export function Toast({ note, testID }: { note: ToastNote | null; testID?: string }) {
  const [shown, setShown] = useState<ToastNote | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!note) return;
    setShown(note);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: IN_MS, useNativeDriver: true }).start();
    // VoiceOver hears it as it appears. A toast is invisible to a screen
    // reader otherwise — nothing focuses it, and it is gone before a
    // swipe could reach it.
    AccessibilityInfo.announceForAccessibility(note.text);
    // Timers, not the animation's completion callback, decide when it is
    // gone: the fade is decoration, and a reader with Reduce Motion — or a
    // frame the system dropped — must not be left with a note that never
    // leaves.
    const out = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: OUT_MS, useNativeDriver: true }).start();
    }, TOAST_MS - OUT_MS);
    const gone = setTimeout(() => setShown(null), TOAST_MS);
    return () => { clearTimeout(out); clearTimeout(gone); };
  }, [note, fade]);

  if (!shown) return null;
  return (
    <Animated.View
      style={[s.toast, { opacity: fade }]}
      testID={testID}
    >
      <Text style={s.text} numberOfLines={1}>{shown.text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: {
    // Sized to its words, and allowed to shrink before it overruns the
    // row. An iPhone SE leaves 239pt beside the two discs (375, less two
    // 22pt margins, two 36pt discs and two 10pt gaps); the longest note,
    // "Chỉ mục đã lưu · 12 địa điểm", is 28 characters, and anything that
    // does not fit ends in an ellipsis rather than a second line.
    flexShrink: 1,
    // The discs' own height, so the row reads as one line of things.
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,11,10,0.80)',
    // Never in the way: the map under it still pans and the buttons
    // beside it still press.
    pointerEvents: 'none',
  },
  text: { color: onPhoto.text, fontSize: 14, fontWeight: font.medium },
});
