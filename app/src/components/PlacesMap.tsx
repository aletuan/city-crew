// Every place the list would show, as pins on Google's map.
//
// Loaded the way `MiniMap` loads its map and for the same reasons — see
// the essay at the top of that file: the module is native, may be absent
// from the binary, and on iOS needs a key. `canDrawMap` is the verdict;
// the screen that renders this checks it first and never shows the map
// mode where it is false, so by the time this mounts the answer is yes.
// The `Boundary` is for the one case that answer was wrong.
//
// Plain pins. A pin that is a View with a number in it is a View per
// place, and Saigon has 251 of them; `tracksViewChanges={false}` and the
// stock marker keep the map a map. The chosen one is coral, the rest are
// ink — same two states as everything else that can be chosen here.

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Place } from '../lib/data';
import type { ExploreOrigin } from '../lib/exploreFilters';
import { colors } from '../theme';
import { canDrawMap } from './MiniMap';
import { MapView, Marker, PROVIDER_GOOGLE } from './mapsModule';

/** The unchosen pin's colour — see the note on `pinColor`. */
const INK = '#17150F';

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

type Pinned = Place & { lat: number; lng: number };
const pinned = (places: readonly Place[]): Pinned[] =>
  places.filter((p): p is Pinned => p.lat != null && p.lng != null);

export default function PlacesMap({ places, selectedSlug, onSelect, origin }: {
  places: readonly Place[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  /** The reader's fix, if they gave one — the first place the view
   *  centres on when there is nothing chosen yet. */
  origin: ExploreOrigin | null;
}) {
  const ref = useRef<any>(null);
  const pins = pinned(places);

  // Show all the pins, and show them again whenever the set changes.
  const key = pins.map((p) => p.slug).join('|');
  useEffect(() => {
    if (!pins.length) return;
    ref.current?.fitToCoordinates(
      pins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 80, right: 40, bottom: 160, left: 40 }, animated: false },
    );
  // The joined slugs are the honest dependency; `pins` is a new array each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!MapView || !Marker) return <View style={s.fill} testID="places-map-missing" />;

  const first = origin ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 0, lng: 0 });
  return (
    <Boundary>
      <MapView
        ref={ref}
        style={s.fill}
        provider={canDrawMap ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ latitude: first.lat, longitude: first.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        testID="places-map"
      >
        {pins.map((p) => (
          <Marker
            key={p.slug}
            identifier={p.slug}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            // A fixed hex for the unchosen pin, not `colors.text`: that token
            // is a `DynamicColorIOS` object on iOS and near-white on the dark
            // scheme, and a white pin on a map is not a pin. Ink stays ink on
            // Google's map whatever the app's scheme.
            pinColor={p.slug === selectedSlug ? colors.accentFill : INK}
            tracksViewChanges={false}
            onPress={() => onSelect(p.slug)}
          />
        ))}
      </MapView>
    </Boundary>
  );
}

// `absoluteFill` spread into an object: RN 0.86's types have no
// `absoluteFillObject`, and the repo already spreads it this way.
const s = StyleSheet.create({ fill: { ...StyleSheet.absoluteFill } });
