// Every place the list would show, as pins on Google's map.
//
// Loaded the way `MiniMap` loads its map and for the same reasons — see
// the essay at the top of that file: the module is native, may be absent
// from the binary, and on iOS needs a key. `canDrawMap` is the verdict;
// the screen that renders this checks it first and never shows the map
// mode where it is false, so by the time this mounts the answer is yes.
// The `Boundary` is for the one case that answer was wrong.
//
// Plain pins for single places, and a bubble with a count where several
// stand too close to tell apart — see `lib/cluster`. Stock markers for
// the places themselves, so 288 of them stay a map rather than 288
// Views; only the bubbles are drawn, and there are never many of those.
// The chosen one is coral; the rest wear
// the colour of their category — the same one the filter row's chip and
// the detail page's glyph wear, so the map reads in the code the reader
// already knows. A place with no category is ink on iOS and azure on
// Android — see `pinColor`.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { pinTint } from '../lib/categories';
import { clusterPins, clusterSize, clusterSkin } from '../lib/cluster';
import type { Place } from '../lib/data';
import type { ExploreOrigin } from '../lib/exploreFilters';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';
import { canDrawMap } from './MiniMap';
import { MapView, Marker, PROVIDER_GOOGLE } from './mapsModule';

/** The unchosen, uncategorised pin's colour — see the note on `pinColor`. */
const INK = Platform.select({ android: '#4A90D9', default: '#17150F' });

/** How long a bubble is redrawn as it moves before it is frozen. A custom
 *  marker view that is frozen from its first frame comes out blank on
 *  iOS, and one that is never frozen redraws on every pan. */
const SETTLE_MS = 600;

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

type Pinned = Place & { lat: number; lng: number };
const pinned = (places: readonly Place[]): Pinned[] =>
  places.filter((p): p is Pinned => p.lat != null && p.lng != null);

/** How wide the map opens, in degrees, before it has been fitted to
 *  anything — about five kilometres, a district. */
const OPENING_SPAN = 0.05;

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
  const { t } = useI18n();
  const ref = useRef<any>(null);
  const [ready, setReady] = useState(false);
  // Memoised so the lookup that hangs off it can hold: `pinned` filters a
  // new array every render, and a Map rebuilt 288 entries deep each time
  // `settled` flips is a memo in name only.
  const pins = useMemo(() => pinned(places), [places]);

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

  // How wide a stretch of the world is on screen — which is the zoom, and
  // so the size of the cells the pins are gathered into. Until the map
  // says, the opening span is the honest guess.
  const [span, setSpan] = useState({ latitudeDelta: OPENING_SPAN, longitudeDelta: OPENING_SPAN });
  const clusters = useMemo(
    () => clusterPins(pins.map((p) => ({ slug: p.slug, lat: p.lat, lng: p.lng })), span, selectedSlug),
    // `pins` is rebuilt every render; its content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, span.latitudeDelta, span.longitudeDelta, selectedSlug],
  );
  const at = useMemo(() => new Map(pins.map((p) => [p.slug, p])), [pins]);

  // A custom marker view frozen from its first frame comes out blank on
  // iOS; one that is never frozen redraws on every pan. So each new set of
  // bubbles is drawn live for a moment and then put to rest.
  const [settled, setSettled] = useState(false);
  // What is drawn on a bubble: which cell, and how many in it. The
  // ground and the figure follow from the count, so nothing else has to
  // be listed here — a frozen marker keeps what it was frozen with.
  const shape = clusters.map((c) => `${c.key}x${c.slugs.length}`).join('|');
  // `ready` is in here, not only `shape`: the countdown must start when
  // the native map exists, or on a slow first launch it can run out
  // before a bubble has ever been drawn, which is the blank marker this
  // mechanism is here to prevent.
  useEffect(() => {
    setSettled(false);
    if (!ready) return;
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [shape, ready]);

  /** A tap on a bubble goes in far enough for it to come apart. */
  const openCluster = (slugs: string[]) => {
    const members = slugs.map((slug) => at.get(slug)).filter((p): p is Pinned => !!p);
    if (!members.length) return;
    ref.current?.fitToCoordinates(
      members.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      // The screen's own insets, the same ones the full fit uses — the
      // header and the strip are still there after a bubble is tapped.
      { edgePadding, animated: true },
    );
  };

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
        initialRegion={{ latitude: first.lat, longitude: first.lng, latitudeDelta: OPENING_SPAN, longitudeDelta: OPENING_SPAN }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onMapReady={() => setReady(true)}
        // The zoom is the grid: every pan and pinch re-cuts the cells, so
        // the mound comes apart as the reader goes in and gathers again
        // as they come out.
        onRegionChangeComplete={(r: { latitudeDelta: number; longitudeDelta: number }) =>
          setSpan({ latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta })}
        testID="places-map"
      >
        {clusters.map((c) => {
          if (c.slugs.length > 1) {
            const size = clusterSize(c.slugs.length);
            const skin = clusterSkin(c.slugs.length);
            return (
              <Marker
                key={c.key}
                identifier={c.key}
                coordinate={{ latitude: c.lat, longitude: c.lng }}
                // Above every pin: a bubble hidden behind the pins it
                // stands for would be a count nobody can read or tap.
                zIndex={2}
                tracksViewChanges={!settled}
                onPress={() => openCluster(c.slugs)}
                accessibilityRole="button"
                accessibilityLabel={t(
                  `${c.slugs.length} places, zoom in`,
                  `${c.slugs.length} địa điểm, phóng to`,
                  `${c.slugs.length}件、拡大`,
                )}
                testID={`cluster-${c.key}`}
              >
                <View
                  style={[
                    s.bubble,
                    { width: size, height: size, borderRadius: size / 2, backgroundColor: skin.fill },
                  ]}
                >
                  <Text style={[s.bubbleText, { color: skin.ink }]}>{c.slugs.length}</Text>
                </View>
              </Marker>
            );
          }
          const p = at.get(c.slugs[0])!;
          return (
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
            pinColor={p.slug === selectedSlug ? colors.accentFill : (pinTint(p, category) ?? INK)}
            // 251 pins overlap; a coral one buried behind three ink ones is
            // invisible. Put the chosen pin on top.
            zIndex={p.slug === selectedSlug ? 1 : 0}
            tracksViewChanges={false}
            onPress={() => onSelect(p.slug)}
          />
          );
        })}
      </MapView>
    </Boundary>
  );
}

// `absoluteFill` spread into an object: RN 0.86's types have no
// `absoluteFillObject`, and the repo already spreads it this way.
const s = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  // A thin white halo and a soft shadow, not a hard dark ring: the halo
  // lifts the bubble off tiles of any colour without drawing a line the
  // reader has to look past, and the ground it lifts is ours — see
  // `clusterSkin` on why the disc is filled and why it is earth.
  bubble: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  bubbleText: { fontSize: 14, fontWeight: '700' },
});
