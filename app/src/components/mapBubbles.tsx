// What the map's bubbles and its corner buttons need, kept out of `PlacesMap`.

import React, { useMemo } from 'react';
import MapControls from './MapControls';
import { CATEGORIES } from '../lib/categories';
import { hueOf, type ClusterTint } from '../lib/cluster';
import { useScheme } from '../lib/theme';
import { accentHex } from '../theme';

/**
 * What the bubbles are coloured by: the one category chosen, else the
 * look's own accent hue (`lib/cluster` › `ClusterTint`) — and a key that
 * changes with it, because a bubble's view is frozen once drawn, so a new
 * colour has to be a new marker.
 */
export function useClusterTint(categories: readonly string[]): { tint: ClusterTint; tintKey: string } {
  const { scheme } = useScheme();
  return useMemo(() => {
    const one = categories.length === 1 ? CATEGORIES[categories[0] as keyof typeof CATEGORIES] : undefined;
    if (one) return { tint: { pin: one.pin }, tintKey: one.pin };
    const hue = hueOf(accentHex[scheme]);
    return hue == null ? { tint: null, tintKey: 'grey' } : { tint: { hue }, tintKey: `h${Math.round(hue)}` };
  }, [categories, scheme]);
}

/** Google's zoom for a neighbourhood: where "where am I" is answered. */
const READER_ZOOM = 15;

/**
 * The corner's button. The crosshair asks for the reader's position and
 * puts the map on it, at the neighbourhood zoom — or as it is, if it
 * already shows more. No position, no move: `onLocate` has told the reader
 * why. Without `onLocate` there is no crosshair.
 */
export function MapCorner({ map, still, onLocate }: {
  map: React.RefObject<any>;
  still: boolean;
  /** The reader's position, or null when there is none. */
  onLocate?: () => Promise<{ lat: number; lng: number } | null>;
}) {
  const goToReader = () => {
    void (async () => {
      const here = await onLocate?.();
      if (!here) return;
      const zoom = (await map.current?.getCamera?.())?.zoom ?? 0;
      map.current?.animateCamera(
        { center: { latitude: here.lat, longitude: here.lng }, zoom: Math.max(zoom, READER_ZOOM) },
        { duration: still ? 0 : 400 },
      );
    })();
  };
  return <MapControls onLocate={onLocate ? goToReader : undefined} />;
}
