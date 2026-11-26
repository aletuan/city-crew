// The row of places the map's strip swipes through, kept beside the choice
// of pin (`lib/mapDeck` has the arithmetic).
//
// What is kept is the *anchor* — the pin that was tapped — and the deck is
// worked out from it and the set the map shows, in the render that needs
// it. It was a list held in state, cut inside the tap handler; a handler
// holds the set it was made with, and a tap that landed between the set
// loading and the reader's fix re-sorting it cut its deck from a set that
// was gone (seen as a deck that stayed a card, in the Explore tests).
//
// A swipe moves `selectedSlug` and never the anchor, so the row holds
// still under the reader's thumb. A change to the set re-anchors on the
// place still open, which rebuilds the deck around it; if that place left
// the set the strip sinks as it always has (`MapStrip` › `onGone`) and the
// anchor is left to the next tap — the reader is never carried to a place
// they did not choose.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Place } from '../../lib/data';
import { buildDeck } from '../../lib/mapDeck';

export function useMapDeck(shown: Place[], selectedSlug: string | null, select: (slug: string | null) => void) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const selectedNow = useRef(selectedSlug);
  selectedNow.current = selectedSlug;
  /** A pin tapped on the map (not a swipe): choose it, and cut its deck. */
  const pickPin = useCallback((slug: string | null) => {
    select(slug);
    setAnchor(slug);
  }, [select]);
  useEffect(() => {
    const open = selectedNow.current;
    if (open && shown.some((p) => p.slug === open)) setAnchor(open);
  }, [shown]);
  const deckPlaces = useMemo(() => {
    if (!anchor) return [];
    const by = new Map(shown.map((p) => [p.slug, p]));
    return buildDeck(shown, anchor).map((slug) => by.get(slug)!);
  }, [anchor, shown]);
  return { pickPin, deckPlaces };
}
