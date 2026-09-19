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
// stock marker keep the map a map. The chosen one is coral; the rest wear
// the colour of their category — the same one the filter row's chip and
// the detail page's glyph wear, so the map reads in the code the reader
// already knows. A place with no category is ink on iOS and azure on
// Android — see `pinColor`.

import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CATEGORIES, categoryColor } from '../lib/categories';
import type { Place } from '../lib/data';
import type { ExploreOrigin } from '../lib/exploreFilters';
import { colors } from '../theme';
import { canDrawMap } from './MiniMap';
import { MapView, Marker, PROVIDER_GOOGLE } from './mapsModule';

/** The unchosen, uncategorised pin's colour — see the note on `pinColor`. */
const INK = Platform.select({ android: '#4A90D9', default: '#17150F' });

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

type Pinned = Place & { lat: number; lng: number };
const pinned = (places: readonly Place[]): Pinned[] =>
  places.filter((p): p is Pinned => p.lat != null && p.lng != null);

/** `edgePadding`'s default — see the note on that prop. */
const DEFAULT_PADDING = { top: 80, right: 40, bottom: 160, left: 40 };

export default function PlacesMap({ places, selectedSlug, onSelect, category, origin, fallback, edgePadding = DEFAULT_PADDING }: {
  places: readonly Place[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  /**
   * The category chip the reader is standing in, or null for the whole
   * catalog.
   *
   * Inside a chip every pin is already that kind of place, so painting
   * each one what it is "most" says nothing and reads as noise: the
   * filter row says Focus while a dozen pins say café, because a place
   * that is both takes the earlier of the two. Under a chip the chip's
   * own colour is the honest one — one kind asked for, one colour back.
   */
  category: string | null;
  /** The reader's fix, if they gave one — the first place the view
   *  centres on when there is nothing chosen yet. */
  origin: ExploreOrigin | null;
  /** Where to open when there is neither a fix nor a pin — the city's
   *  centre, which the screen always knows. */
  fallback: ExploreOrigin;
  /** The screen that measures its header passes what it measured;
   *  `DEFAULT_PADDING` otherwise. */
  edgePadding?: { top: number; right: number; bottom: number; left: number };
}) {
  const ref = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const pins = pinned(places);
  // Null at "All", and null too for a chip this table has not heard of —
  // then each pin falls back to speaking for itself.
  const chipColor = category ? CATEGORIES[category]?.color ?? null : null;

  // Show all the pins, and show them again whenever the set changes.
  const key = pins.map((p) => p.slug).sort().join('|');
  useEffect(() => {
    if (!ready || !pins.length) return;
    ref.current?.fitToCoordinates(
      pins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding, animated: false },
    );
  // The set is the honest dependency; a re-sort must not snap the map back.
  // The four padding numbers are primitives, so listing them costs nothing,
  // and a measured inset that arrives after the map is already ready — the
  // header's `onLayout` firing late — must still trigger one refit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, edgePadding.top, edgePadding.right, edgePadding.bottom, edgePadding.left]);

  // Every pin here is Google Places content, which the API's terms allow
  // showing only on Google's own map — see the licence note atop
  // `MiniMap.tsx`. No Google map is not a reason to fall back to Apple's;
  // it is a reason to show no map at all.
  if (!canDrawMap || !Marker) return <View style={s.fill} testID="places-map-missing" />;

  const first = origin ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : fallback);
  return (
    <Boundary>
      <MapView
        ref={ref}
        style={s.fill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: first.lat, longitude: first.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onMapReady={() => setReady(true)}
        testID="places-map"
      >
        {pins.map((p) => (
          <Marker
            key={p.slug}
            identifier={p.slug}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            // Category colours are fixed hexes, so they draw the same on
            // both platforms' pins — iOS takes the hex as given, Android's
            // stock marker keeps its HSV hue, which is the part that tells
            // them apart. The uncategorised pin is a fixed hex too, not
            // `colors.text`: that token is a `DynamicColorIOS` object on
            // iOS and near-white on the dark scheme, and a white pin on a
            // map is not a pin. It comes out azure on Android (hue 210°)
            // rather than ink — still far from the chosen pin's coral.
            pinColor={p.slug === selectedSlug ? colors.accentFill : (chipColor ?? categoryColor(p) ?? INK)}
            // 251 pins overlap; a coral one buried behind three ink ones is
            // invisible. Put the chosen pin on top.
            zIndex={p.slug === selectedSlug ? 1 : 0}
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
