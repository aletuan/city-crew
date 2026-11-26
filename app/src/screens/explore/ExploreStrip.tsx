// The strip at the foot of Explore's map: the open place's card, or — when
// other places stand near it — the row of cards to swipe (`MapDeck`).
//
// Out of `ExploreMap` on 26 Nov 2026 when the swipe arrived, which sits at
// the function ceiling (`oversize.js`). The choice of one card or a row is
// here: a deck of one is the card as it always was, with no peeking edge to
// promise a neighbour that is not there.

import React from 'react';
import MapDeck from '../../components/MapDeck';
import MapPlaceCard from '../../components/MapPlaceCard';
import MapStrip from '../../components/MapStrip';
import { chosenKind } from '../../lib/categories';
import { distanceKm } from '../../lib/geo';
import type { Place } from '../../lib/data';
import type { Nav } from '../../nav';
import { s } from './styles';
import type { ExploreFiltering } from './useExploreFilters';

export default function ExploreStrip({ filters, navigation, tabClearance }: {
  filters: ExploreFiltering;
  navigation: Nav;
  tabClearance: number;
}) {
  const { picked, sortOrigin, selected, selectedKm, selectedSlug, setSelectedSlug, deckPlaces } = filters;
  const card = (place: Place, km: number | null, swipe?: { next?: () => void; previous?: () => void }, inset?: boolean) => (
    <MapPlaceCard
      place={place}
      distanceKm={km}
      // The same rule the map draws the pin with, so the mark on the
      // card and the pin cannot drift apart.
      kind={chosenKind(place, picked)}
      now={new Date()}
      onPress={() => navigation.navigate('PlaceDetail', { slug: place.slug })}
      swipe={swipe}
      inset={inset}
    />
  );
  const kmTo = (p: Place) => sortOrigin && p.lat != null && p.lng != null
    ? distanceKm(sortOrigin.lat, sortOrigin.lng, p.lat, p.lng)
    : null;
  return (
    <MapStrip style={[s.mapStrip, { bottom: tabClearance + 12 }]} onGone={() => setSelectedSlug(null)}>
      {selected && selectedSlug ? (
        deckPlaces.length > 1 && deckPlaces.some((p) => p.slug === selectedSlug) ? (
          // Rebuilt, not scrolled back, when the deck changes: a new
          // deck starts on its first card.
          <MapDeck
            key={deckPlaces[0].slug + deckPlaces.length}
            places={deckPlaces}
            selectedSlug={selectedSlug}
            onSwipe={setSelectedSlug}
            renderCard={(place, swipe) => card(place, kmTo(place), swipe, false)}
          />
        ) : card(selected, selectedKm)
      ) : null}
    </MapStrip>
  );
}
