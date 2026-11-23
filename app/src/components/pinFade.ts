// How the map's pins change when the set they show changes — a chip
// tapped, a filter turned on (owner, 23 Nov 2026, from a sample in which
// markers left by shrinking and arrived by springing).
//
// The pins are Google's markers with a picture on them (`image`), not
// React views, so nothing here can scale one or bounce it: a marker takes
// a position, a picture and an `opacity`, and the opacity is the one of
// the three that can move (`GMSMarker.opacity`, set straight through by
// react-native-maps). Scaling would mean a custom view per pin, and 288
// live views is the map this file's neighbour was written to stop being
// — see the head of `PlacesMap`. The bounce the sample had is Google's
// own "pop" (`appearAnimation`), which the library does not expose; it
// needs a native patch and a binary, and is left for one.
//
// So the old pins fade out, the camera glides to the new set, and the
// new pins fade in as it arrives:
//
//     leaving    1 → 0      0–120 ms
//     camera     glides     from 60 ms, for as long as Google takes
//     arriving   0 → 1      260–460 ms
//
// Leaving first and quickly, so the two sets are never on screen as one;
// arriving late, so a pin appears where it will stay rather than sliding
// in with the camera. The figures were set in a mockup shown to the owner
// the same day, and the camera's own length is Google's, not ours —
// `fitToCoordinates` takes no duration.
//
// In steps of `TICK_MS`, because each step is a render that hands every
// changed marker a new opacity across the bridge. Forty milliseconds gives
// three steps out and five in: few enough to cost nothing measurable on
// a set of a few hundred, and the fade is short enough that the eye reads
// steps as a fade. A setting that asks for less motion gets none.

import { useEffect, useRef, useState } from 'react';

export const FADE_OUT_MS = 120;
export const FADE_IN_AT = 260;
export const FADE_IN_MS = 200;
export const TICK_MS = 40;
const DONE_AT = FADE_IN_AT + FADE_IN_MS;

/** A pin's opacity `t` ms into a change: leaving, arriving, or neither. */
export function fadeAt(t: number, role: 'leaving' | 'arriving' | 'staying'): number {
  if (role === 'leaving') return Math.max(0, 1 - t / FADE_OUT_MS);
  if (role === 'arriving') return t < FADE_IN_AT ? 0 : Math.min(1, (t - FADE_IN_AT) / FADE_IN_MS);
  return 1;
}

type Change<P> = { leaving: P[]; gone: Set<string>; arriving: Set<string> };

/**
 * The pins that have just left and are still fading, and each pin's
 * opacity, the leaving ones' included. `pins` is the set now; `still` turns the whole thing off.
 * The first set is never a change — the map opens with its pins.
 */
export function usePinFade<P extends { slug: string }>(pins: readonly P[], still: boolean): {
  leaving: P[];
  opacity: (slug: string) => number;
} {
  const key = pins.map((p) => p.slug).sort().join('|');
  const prev = useRef<readonly P[] | null>(null);
  const [change, setChange] = useState<Change<P> | null>(null);
  const [t, setT] = useState(0);

  useEffect(() => {
    const before = prev.current;
    prev.current = pins;
    if (!before || still) { setChange(null); return undefined; }
    const now = new Set(pins.map((p) => p.slug));
    const was = new Set(before.map((p) => p.slug));
    const leaving = before.filter((p) => !now.has(p.slug));
    setChange({
      leaving,
      gone: new Set(leaving.map((p) => p.slug)),
      arriving: new Set(pins.filter((p) => !was.has(p.slug)).map((p) => p.slug)),
    });
    setT(0);
    const tick = setInterval(() => setT((v) => {
      if (v + TICK_MS < DONE_AT) return v + TICK_MS;
      clearInterval(tick);
      setChange(null);
      return DONE_AT;
    }), TICK_MS);
    return () => clearInterval(tick);
  // The set is the change; a new array with the same pins is not one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, still]);

  if (!change) return { leaving: [], opacity: () => 1 };
  return {
    leaving: t < FADE_OUT_MS ? change.leaving : [],
    opacity: (slug) => fadeAt(t, change.gone.has(slug) ? 'leaving' : change.arriving.has(slug) ? 'arriving' : 'staying'),
  };
}
