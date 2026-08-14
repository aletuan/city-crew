// The hook that fetches what `weather.ts` describes.
//
// Split from it so the parsing stays testable in plain Node: this half
// touches React and the network, that half is arithmetic and a lookup
// table.

import { useEffect, useState } from 'react';
import { parseSky, skyUrl, type Sky } from './weather';

/** Long enough that scrolling Explore costs nothing, short enough that
 *  an afternoon storm shows up. */
const FRESH_MS = 30 * 60 * 1000;

/** Shared across mounts: the screen remounts on every tab switch, and a
 *  cache inside the hook would be a request per visit. */
const cache = new Map<string, { at: number; sky: Sky }>();

/**
 * Current conditions, or null.
 *
 * Null is not an error state to render — it is the normal state before
 * the answer arrives and the permanent state when there is no answer.
 * The caller draws nothing at all for it. Weather is decoration here; the
 * date beside it is the content, and a spinner or a dash where a
 * temperature might go would make the decoration look load-bearing.
 */
export function useSky(lat: number | undefined, lng: number | undefined): Sky | null {
  const key = lat != null && lng != null ? `${lat},${lng}` : '';
  const [sky, setSky] = useState<Sky | null>(() => cache.get(key)?.sky ?? null);

  useEffect(() => {
    if (!key || lat == null || lng == null) { setSky(null); return; }

    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < FRESH_MS) { setSky(hit.sky); return; }
    // Show the stale reading while the fresh one is on its way. An hour
    // old is closer to the truth than nothing, and it stops the eyebrow
    // flickering empty on every visit.
    if (hit) setSky(hit.sky);

    let alive = true;
    // Abandoned rather than retried. A missed reading costs a number
    // nobody was waiting for, and the next visit asks again.
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 6000);

    fetch(skyUrl(lat, lng), { signal: stop.signal })
      .then((r) => r.json())
      .then((json) => {
        const next = parseSky(json);
        if (!next) return;
        cache.set(key, { at: Date.now(), sky: next });
        if (alive) setSky(next);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));

    return () => { alive = false; clearTimeout(timer); stop.abort(); };
  }, [key, lat, lng]);

  return sky;
}
