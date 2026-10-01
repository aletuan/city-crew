// Holding a row of a list and dragging it to a new place.
//
// Lifted out of `CollectionDetailScreen`, which built it for its places,
// so that the plan editor's stops can be moved the same way. One gesture
// for the app: a reader who has put a collection in order already knows
// how to put an evening in order.
//
// ── what it is made of ──
//
// The hold is the row's own long press, which the row wires up itself
// (`onLift`); a press that lifted never also opens the row, and a finger
// that moves before the hold completes cancels it and scrolls instead.
// The drag after the lift belongs to a responder on the view around the
// list (`panHandlers`), which asks for the touch on every move and wants
// it only while a row is up, so a scroll or a tap never meets it; once it
// has the touch it does not give it back. While JavaScript holds the
// touch, React Native tells the scroll view to leave it alone — the
// screen still sets `scrollEnabled={!lift}` so the two never answer the
// same drag.
//
// This replaced a gesture-handler pan that waited out a long press. On a
// phone it lifted (the haptic fired) and then never moved: one native
// recognizer arbitrated against the scroll view's, reconfigured on every
// render mid-gesture, and none of it watchable from a test. The responder
// system is the one every button in the app already runs on. And all of
// it is JavaScript and React Native's own `Animated`: the usual recipe is
// `react-native-reanimated`, a native module, which would mean a build
// through the store before anybody could drag and every OTA after it
// refused by the builds already installed.
//
// ── what the rows do ──
//
// Each row measures itself (`onPitch`: its height, gap included) so the
// drop is computed against the rows as they are — they are not one
// height. The row at `from` wears `styleOf(from)`: raised, shadowed, and
// travelling with the finger through `dragY`, driven straight into the
// transform so a move does not re-render the list. The rows it has passed
// wear `styleOf(i)` too — stepped aside by one lifted pitch, into the room
// it left. Letting go calls `onMove(from, to)`, which is the same move
// VoiceOver's "Move up" and "Move down" actions make: VoiceOver cannot
// drag, so a row that can be held also offers those, and says so in its
// hint.
//
// The maths — where a drag lands, who steps aside — is `lib/order`, where
// it can be tested as arithmetic.

import { useEffect, useRef, useState } from 'react';
import {
  Animated, PanResponder, StyleSheet, type GestureResponderHandlers, type StyleProp, type ViewStyle,
} from 'react-native';
import { dropSlot, stepAside } from '../lib/order';
import { fireHaptic } from './ui';

/**
 * How long a finger rests on a row before the row lifts.
 *
 * The same row opens on a tap, and the list under it scrolls, so the hold
 * has to be told apart from both. A tap is over in about a tenth of a
 * second. A scroll moves the finger first, and more than ten points of
 * travel before the hold completes cancels the lift, so a flick never
 * picks a row up. What is left is a finger that lands and stays, which is
 * only ever a hold or a hesitation. 400 ms sits under iOS's own 500 ms
 * long press, so the lift does not feel slow to take, and is long enough
 * that a thumb resting on a row while reading does not lift it.
 */
export const LIFT_AFTER_MS = 400;

/** The row in the finger: where it came from, the slot it hovers over, its
 *  own pitch, and where the finger was when it lifted. */
export type Held = { from: number; to: number; pitch: number; y0: number };

export type ListDrag = {
  /** For drawing: the row that is up and the slot it is over. Null between drags. */
  lift: Held | null;
  /** The finger's travel since the lift, positive downward. */
  dragY: Animated.Value;
  /** For the view around the rows: the responder that carries the drag. */
  panHandlers: GestureResponderHandlers;
  /** The hold completed on row `index`, with the finger at `pageY`. */
  onLift: (index: number, pageY: number) => void;
  /** The row's button let go of the touch: by the finger coming up, or by
   *  the list taking the drag over. Only the first is a drop. */
  onRelease: () => void;
  /** Row `key` measured `pitch` points tall, gap included. */
  onPitch: (key: string, pitch: number) => void;
  /** What row `i` wears right now: raised and travelling, stepped aside, or
   *  nothing. For an `Animated.View`. */
  styleOf: (i: number) => Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
};

export function useListDrag({ keys, onMove, pitchGuess }: {
  /** The rows, in their current order, by a key each row reports its pitch under. */
  keys: readonly string[];
  /** The drop: row `from` landed on slot `to`. Never called with `from === to`. */
  onMove: (from: number, to: number) => void;
  /** A row's pitch before it has reported one: the first frame only, or a
   *  platform that does not report layout. */
  pitchGuess: number;
}): ListDrag {
  // `lift` is for drawing. `liftRef` is the same thing for the touch
  // handlers, which fire faster than renders and must not read a render
  // behind. `claimed` is whether the list's responder has taken the touch
  // from the row's button.
  const [lift, setLift] = useState<Held | null>(null);
  const liftRef = useRef<Held | null>(null);
  const claimed = useRef(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const pitchByKey = useRef(new Map<string, number>());
  const raise = (next: Held | null) => {
    liftRef.current = next;
    setLift(next);
  };
  const pitches = () => keys.map((k) => pitchByKey.current.get(k) ?? pitchGuess);

  const onLift = (index: number, pageY: number) => {
    dragY.setValue(0);
    claimed.current = false;
    raise({ from: index, to: index, pitch: pitches()[index], y0: pageY });
    fireHaptic('light');
  };
  const onDrag = (pageY: number) => {
    const held = liftRef.current;
    if (!held) return;
    const dy = pageY - held.y0;
    dragY.setValue(dy);
    const to = dropSlot(pitches(), held.from, dy);
    if (to !== held.to) {
      raise({ ...held, to });
      fireHaptic('selection');
    }
  };
  const onDrop = () => {
    const held = liftRef.current;
    if (!held) return;
    raise(null);
    if (held.to !== held.from) onMove(held.from, held.to);
  };
  const onRelease = () => { if (!claimed.current) onDrop(); };

  // Made once. Its handlers read the latest `onDrag` and `onDrop` through
  // a ref, since those close over this render's `keys` and `onMove`.
  const dragTo = useRef({ onDrag, onDrop });
  useEffect(() => { dragTo.current = { onDrag, onDrop }; });
  const [drag] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => liftRef.current !== null,
    onPanResponderGrant: () => { claimed.current = true; },
    onPanResponderMove: (_e, g) => dragTo.current.onDrag(g.moveY),
    onPanResponderRelease: () => dragTo.current.onDrop(),
    onPanResponderTerminate: () => dragTo.current.onDrop(),
    onPanResponderTerminationRequest: () => false,
  }));
  const onPitch = (key: string, pitch: number) => { pitchByKey.current.set(key, pitch); };

  const styleOf = (i: number): Animated.WithAnimatedValue<StyleProp<ViewStyle>> => {
    if (!lift) return undefined;
    if (lift.from === i) return [s.lifted, { transform: [{ translateY: dragY }, { scale: 1.02 }] }];
    const shift = stepAside(i, lift.from, lift.to, lift.pitch);
    return shift !== 0 ? { transform: [{ translateY: shift }] } : undefined;
  };

  return { lift, dragY, panHandlers: drag.panHandlers, onLift, onRelease, onPitch, styleOf };
}

const s = StyleSheet.create({
  // Lifted: above its neighbours, with the shadow of something held off
  // the page. `zIndex` for iOS and the web, `elevation` for Android. A
  // `FlatList` draws each row in a cell of its own, and a zIndex here does
  // not reach past the cell to the siblings the row has to pass over — so
  // a list built on one raises the cell too (see `LiftCell` in
  // `CollectionDetailScreen`); rows laid straight into a `ScrollView` are
  // siblings already and need nothing more.
  lifted: {
    zIndex: 10, elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
});
