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
//
// ── on a grid ──
//
// The same hook drags the collection's tiles, three to a row (owner, 22
// Oct 2026), given `grid`. The order is still the list's, read row by row,
// so all that changes is the arithmetic: the finger's travel is counted
// both ways, a tile lands on the cell under it (`gridSlot`), and the tiles
// it has passed shuffle one cell along, round a row's end where they have
// to (`gridStepAside`). Every cell is the one size, so the grid hands its
// pitch over rather than having the tiles measure themselves. A grid can
// begin a cell in (`lead`): the collection keeps its first cell for the
// owner's "Add place" tile, which neither moves nor takes a tile dropped
// on it.
//
// ── past the edge of the screen ──
//
// The list is held still while a row is up (the screen's `scrollEnabled`),
// so the drag and the scroll never answer the same finger. That left a
// row no way to reach a place off screen: a list of twenty, three tiles
// to a row, is seven rows, and the first was a drag or three from the
// last (owner, 22 Oct 2026). Given `scroll`, the hook scrolls the list
// itself while the finger is near either end of the part that shows —
// a frame at a time, faster the deeper in (`edgeSpeed`) — and counts the
// distance scrolled as the row's travel, so the row stays under the
// finger and lands where the finger is over. The foot of the list that
// the floating tab bar lies over is not "showing": the edge is measured
// from the bar's top.

import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Animated, PanResponder, StyleSheet, useWindowDimensions, View, type GestureResponderHandlers, type NativeScrollEvent,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { dropSlot, edgeSpeed, gridSlot, gridStepAside, stepAside } from '../lib/order';
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

/**
 * How near either end of the list the finger has to be before the list
 * scrolls under it, and how fast it scrolls at the most, in points a
 * frame. 72 is a little over a finger's width, so a thumb resting on the
 * last card showing does not set the list moving. 14 is about 840pt a
 * second at 60 frames, a phone's height in a second, so a long list
 * crosses quickly while the start of the edge is slow enough to stop on
 * a card. Both are starting figures, to be judged on a phone.
 */
export const SCROLL_EDGE = 72;
export const SCROLL_MAX = 14;

/** The row in the finger: where it came from, the slot it hovers over, its
 *  own pitch, where the finger was when it lifted, and how far the list
 *  was scrolled then. */
export type Held = { from: number; to: number; pitch: number; x0: number; y0: number; s0: number };

/** For a list that can scroll itself while a row is dragged near its ends. */
export type DragScroll = {
  /** Scroll the list to this offset, at once. */
  to: (offset: number) => void;
  /** Points at the window's foot that something lies over — the floating
   *  tab bar — so the list's foot edge starts above it. */
  coveredBelow?: number;
};

/** The rows laid out as a grid: so many to a row, each cell `pitch` from the
 *  next both ways (a tile and the gap after it). */
export type DragGrid = {
  cols: number;
  pitch: number;
  /** Cells before the first row, held by something that does not move —
   *  the owner's "Add place" tile in the collection's first cell. The rows
   *  are still counted from 0; only where each one stands moves on. */
  lead?: number;
};

export type ListDrag = {
  /** For drawing: the row that is up and the slot it is over. Null between drags. */
  lift: Held | null;
  /** The finger's travel since the lift, positive downward. */
  dragY: Animated.Value;
  /** The same, across, positive rightward. Only a grid moves along it. */
  dragX: Animated.Value;
  /** For the view around the rows: the responder that carries the drag. */
  panHandlers: GestureResponderHandlers;
  /** The hold completed on row `index`, with the finger at `pageY` (and
   *  `pageX`, which only a grid reads). */
  onLift: (index: number, pageY: number, pageX?: number) => void;
  /** The row's button let go of the touch: by the finger coming up, or by
   *  the list taking the drag over. Only the first is a drop. */
  onRelease: () => void;
  /** Row `key` measured `pitch` points tall, gap included. */
  onPitch: (key: string, pitch: number) => void;
  /** For the view around the rows, with `panHandlers`: where the list
   *  shows on screen, measured when a row lifts. */
  areaRef: React.RefObject<ComponentRef<typeof View> | null>;
  /** For the list's `onScroll`: where it is scrolled to. */
  onScrolled: (e: NativeScrollEvent) => void;
  /** For the list's `onContentSizeChange`: how tall its content is, which
   *  with the height it shows in says how far it can scroll. A list the
   *  reader has not scrolled yet has sent no scroll event to say it. */
  onContentSizeChange: (width: number, height: number) => void;
  /** What row `i` wears right now: raised and travelling, stepped aside, or
   *  nothing. For an `Animated.View`. */
  styleOf: (i: number) => Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
};

export function useListDrag({ keys, onMove, pitchGuess, grid = null, scroll = null }: {
  /** The rows, in their current order, by a key each row reports its pitch under. */
  keys: readonly string[];
  /** The drop: row `from` landed on slot `to`. Never called with `from === to`. */
  onMove: (from: number, to: number) => void;
  /** A row's pitch before it has reported one: the first frame only, or a
   *  platform that does not report layout. */
  pitchGuess: number;
  /** Set when the rows are tiles in a grid rather than one under another. */
  grid?: DragGrid | null;
  /** Set when the list should scroll itself near its ends during a drag. */
  scroll?: DragScroll | null;
}): ListDrag {
  // `lift` is for drawing. `liftRef` is the same thing for the touch
  // handlers, which fire faster than renders and must not read a render
  // behind. `claimed` is whether the list's responder has taken the touch
  // from the row's button.
  const [lift, setLift] = useState<Held | null>(null);
  const liftRef = useRef<Held | null>(null);
  const claimed = useRef(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const pitchByKey = useRef(new Map<string, number>());
  const { height: winH } = useWindowDimensions();
  const areaRef = useRef<ComponentRef<typeof View>>(null);
  // Where the list is scrolled and how far it can go, from its own scroll
  // events; where it shows on screen, from the lift; where the finger is;
  // and the frame waiting to scroll it, if one is.
  const scrolled = useRef({ y: 0, content: 0 });
  const shows = useRef({ top: 0, bottom: 0, height: 0 });
  const finger = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);
  const raise = (next: Held | null) => {
    liftRef.current = next;
    setLift(next);
  };
  const pitches = () => keys.map((k) => pitchByKey.current.get(k) ?? pitchGuess);

  const onLift = (index: number, pageY: number, pageX = 0) => {
    dragY.setValue(0);
    dragX.setValue(0);
    claimed.current = false;
    finger.current = { x: pageX, y: pageY };
    if (scroll) {
      areaRef.current?.measureInWindow((_x, y, _w, h) => {
        shows.current = { top: y, bottom: Math.min(y + h, winH - (scroll.coveredBelow ?? 0)), height: h };
      });
    }
    raise({ from: index, to: index, pitch: pitches()[index], x0: pageX, y0: pageY, s0: scrolled.current.y });
    fireHaptic('light');
  };
  // Where the held row is over: the finger's travel since the lift, and
  // down, the distance the list has scrolled under it since too.
  const place = () => {
    const held = liftRef.current;
    if (!held) return;
    const { x: pageX, y: pageY } = finger.current;
    const dy = pageY - held.y0 + (scrolled.current.y - held.s0);
    dragY.setValue(dy);
    // A list's row goes nowhere sideways, so only a grid's tile follows
    // the finger across.
    const dx = grid ? pageX - held.x0 : 0;
    dragX.setValue(dx);
    // On a grid the arithmetic is the cells', the lead's among them, and a
    // tile over the lead lands first.
    const lead = grid?.lead ?? 0;
    const to = grid
      ? Math.max(0, gridSlot(keys.length + lead, grid.cols, grid.pitch, held.from + lead, dx, dy) - lead)
      : dropSlot(pitches(), held.from, dy);
    if (to !== held.to) {
      raise({ ...held, to });
      fireHaptic('selection');
    }
  };
  // One frame of scrolling, while the finger stays near an end and the
  // list has further to go that way; then the next.
  const tick = () => {
    frame.current = null;
    if (!scroll || !liftRef.current) return;
    const speed = edgeSpeed(finger.current.y, shows.current.top, shows.current.bottom, SCROLL_EDGE, SCROLL_MAX);
    const { y, content } = scrolled.current;
    const next = Math.min(Math.max(0, content - shows.current.height), Math.max(0, y + speed));
    if (next === y) return;
    scrolled.current = { y: next, content };
    scroll.to(next);
    place();
    frame.current = requestAnimationFrame(() => tickRef.current());
  };
  const tickRef = useRef(tick);
  useEffect(() => { tickRef.current = tick; });
  const onDrag = (pageX: number, pageY: number) => {
    finger.current = { x: pageX, y: pageY };
    place();
    if (scroll && frame.current === null) frame.current = requestAnimationFrame(() => tickRef.current());
  };
  // Leaving the screen mid-scroll leaves no frame behind.
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const onScrolled = (e: NativeScrollEvent) => { scrolled.current = { ...scrolled.current, y: e.contentOffset.y }; };
  const onContentSizeChange = (_w: number, h: number) => { scrolled.current = { ...scrolled.current, content: h }; };
  // A frame already asked for when the row lands finds nothing held and
  // does nothing, so letting go needs no cancelling of its own.
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
    onPanResponderMove: (_e, g) => dragTo.current.onDrag(g.moveX, g.moveY),
    onPanResponderRelease: () => dragTo.current.onDrop(),
    onPanResponderTerminate: () => dragTo.current.onDrop(),
    onPanResponderTerminationRequest: () => false,
  }));
  const onPitch = (key: string, pitch: number) => { pitchByKey.current.set(key, pitch); };

  const styleOf = (i: number): Animated.WithAnimatedValue<StyleProp<ViewStyle>> => {
    if (!lift) return undefined;
    if (lift.from === i) {
      return [s.lifted, { transform: [{ translateX: dragX }, { translateY: dragY }, { scale: 1.02 }] }];
    }
    if (grid) {
      const lead = grid.lead ?? 0;
      const { dx, dy } = gridStepAside(i + lead, lift.from + lead, lift.to + lead, grid.cols, grid.pitch);
      return dx !== 0 || dy !== 0 ? { transform: [{ translateX: dx }, { translateY: dy }] } : undefined;
    }
    const shift = stepAside(i, lift.from, lift.to, lift.pitch);
    return shift !== 0 ? { transform: [{ translateY: shift }] } : undefined;
  };

  return { lift, dragY, dragX, panHandlers: drag.panHandlers, onLift, onRelease, onPitch, styleOf, areaRef, onScrolled, onContentSizeChange };
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
