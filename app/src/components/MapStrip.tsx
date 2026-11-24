// The map's place strip coming and going (owner, 24 Nov 2026).
//
// It used to be there or not, from one frame to the next, while
// everything round it moved: the pins fade over a tenth of a second
// (`pinFade`), the camera glides. A chip that took the chosen place off
// the map took its strip with it in a single frame — the one thing on
// the screen that jumped. Now it rises in from below and sinks out the
// same way, in the dock's motion (`DockSlot`: up 14pt as it fades in),
// holding what it showed while it goes so its words do not change on
// the way out.
//
// And a strip that goes because its place left the set lets the place go
// too (`onGone`). The choice used to outlive its strip: hidden under
// "Study", the café chosen a minute before came back — strip, coral pin
// and all — the moment "All" was tapped, long after the reader had
// stopped thinking about it. A place still in the new set keeps both.
//
// The timings are the dock's, which the reader already sees rise and
// fall over the same tab bar: 220ms in, 140ms out — leaving quicker than
// arriving, as the pins do.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from './ui';

export default function MapStrip({ style, onGone, children }: {
  style?: StyleProp<ViewStyle>;
  /** The strip has nothing to show any more: its place left the set, or
   *  the reader let it go. Called once, as it starts to sink. */
  onGone: () => void;
  /** The strip for the chosen place, or null for none. */
  children: React.ReactElement | null;
}) {
  const still = useReducedMotion();
  const shown = useRef(new Animated.Value(children ? 1 : 0)).current;
  // What is on screen: the strip given, or — on its way out — the last one.
  // Kept in a ref, not state: a new element arrives with every render of
  // the map, and holding it must not cost the strip a second render.
  const last = useRef(children);
  if (children) last.current = children;
  const showing = !!children;
  const [mounted, setMounted] = useState(showing);
  if (showing && !mounted) setMounted(true);
  const onGoneNow = useRef(onGone);
  onGoneNow.current = onGone;
  const was = useRef(showing);

  useEffect(() => {
    if (was.current && !showing) onGoneNow.current();
    was.current = showing;
    const run = Animated.timing(shown, {
      toValue: showing ? 1 : 0,
      duration: still ? 0 : showing ? 220 : 140,
      useNativeDriver: true,
    });
    run.start(({ finished }) => {
      if (finished && !showing) setMounted(false);
    });
    return () => run.stop();
  }, [showing, shown, still]);

  if (!mounted) return null;
  return (
    <Animated.View
      pointerEvents={showing ? 'box-none' : 'none'}
      testID="map-strip"
      style={[
        style,
        {
          opacity: shown,
          transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children ?? last.current}
    </Animated.View>
  );
}
