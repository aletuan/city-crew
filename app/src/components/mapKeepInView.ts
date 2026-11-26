// The map follows a selection it did not make (owner, 26 Nov 2026).
//
// A pin tapped is already under the reader's finger; a pin chosen by
// swiping the strip may be off the edge of the map, or under the strip
// itself. The camera glides just far enough to bring it inside the padded
// box (`lib/mapPan`) and leaves the zoom alone. It uses the last region the
// map reported and the box it was laid out in, so nothing is asked of the
// native side: a pin already in view costs one subtraction.

import { useEffect, useRef } from 'react';
import { panTarget, type Box, type Region } from '../lib/mapPan';

/** The glide, in ms: the same as a chip's refit takes (`useFit`'s 500)
 *  less what a one-card step needs. */
const GLIDE_MS = 300;

export function useKeepInView(
  map: React.RefObject<any>,
  selectedSlug: string | null,
  at: ReadonlyMap<string, { lat: number; lng: number }>,
  pad: Box,
  still: boolean,
  /** The span the pins are gathered for, kept by the map from each report. */
  setSpan: (span: { latitudeDelta: number; longitudeDelta: number }) => void,
  /** The map's own layout handler, run first. */
  onLayout: (e: { nativeEvent: { layout: { width: number; height: number } } }) => void,
) {
  const region = useRef<Region | null>(null);
  const box = useRef<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const pin = selectedSlug ? at.get(selectedSlug) : undefined;
    if (!pin || !region.current || !box.current) return;
    const to = panTarget(region.current, box.current, pad, pin);
    if (to) map.current?.animateCamera({ center: to }, { duration: still ? 0 : GLIDE_MS });
  // Only a change of selection moves the camera: a re-render, a re-cut of
  // the pins or a new padding must not.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);
  return {
    onLayout: (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      onLayout(e);
      box.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
    },
    onRegionChangeComplete: (r: Region) => {
      setSpan({ latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta });
      region.current = r;
    },
  };
}
