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
// Each pin is a picture carrying its category's own glyph, drawn by
// `scripts/map-pins.py` and looked up in `mapPins`. It used to be a tint
// on Google's stock marker, which never worked: that prop sets hue and
// little else, so nine categories reached the map as nine hues with no
// glyph and no label beside them. The chosen one is coral with its glyph
// inverted to ink, and a place no category claims gets a grey pin rather
// than a guess.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { clusterPins, clusterSize, clusterSkin } from '../lib/cluster';
import { mapStyle } from '../lib/mapStyle';
import type { Place } from '../lib/data';
import type { ExploreOrigin } from '../lib/exploreFilters';
import { useI18n } from '../lib/i18n';
import { useScheme } from '../lib/theme';
import { pinImage } from './mapPins';
import { canDrawMap } from './MiniMap';
import { MapView, Marker, PROVIDER_GOOGLE } from './mapsModule';

/** How long a bubble is redrawn as it moves before it is frozen. A custom
 *  marker view that is frozen from its first frame comes out blank on
 *  iOS, and one that is never frozen redraws on every pan. */
const SETTLE_MS = 600;

/**
 * The one shape a gathering of places takes on this map, whether the
 * places are under the reader's thumb or a country away.
 *
 * A city used to be a named pill, which made two languages out of one
 * idea: at the zoom where the other cities appear, this city is a bubble
 * of its own and the pair read as different kinds of thing. The name was
 * never ours to draw either — Google's map already writes "Hanoi" where
 * Hanoi is.
 */
function Bubble({ count }: { count: number }) {
  const size = clusterSize(count);
  const skin = clusterSkin(count);
  return (
    <View style={[s.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: skin.fill }]}>
      <Text style={[s.bubbleText, { color: skin.ink }]}>{count}</Text>
    </View>
  );
}

/** The same figure, in words, for a listener. */
function spokenCount(n: number, t: (en: string, vi: string, ja?: string) => string): string {
  return t(`${n} ${n === 1 ? 'place' : 'places'}`, `${n} địa điểm`, `${n}件`);
}

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

export default function PlacesMap({ places, selectedSlug, onSelect, category, origin, fallback, cities, onPickCity, edgePadding = DEFAULT_PADDING }: {
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
  /**
   * The app's other cities, without the one being read.
   *
   * Explore works one city at a time, so at a zoom where the whole
   * country fits, this city is a single bubble and the rest of the app is
   * nowhere — a reader zooming out to see where else there is something
   * found an empty map. These are not places and never join a cluster or
   * the fit: they are somewhere to go, and a tap goes there.
   */
  cities: readonly { id: string; name: string; count: number | null; lat: number; lng: number }[];
  /** A tap on one of those. The screen makes it the city being read, and
   *  everything else on the screen follows. */
  onPickCity: (id: string) => void;
  /** The screen that measures its header passes what it measured;
   *  `DEFAULT_PADDING` otherwise. */
  edgePadding?: { top: number; right: number; bottom: number; left: number };
}) {
  const { t } = useI18n();
  const { scheme } = useScheme();
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
  const shape = [
    clusters.map((c) => `${c.key}x${c.slugs.length}`).join('|'),
    cities.map((c) => `${c.id}:${c.count ?? ''}`).join('|'),
  ].join('/');
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
        // Google draws its own badge for every place we pin, because our
        // places are its places; and it has no dark mode to switch on, so
        // the night reading is a style too — see `lib/mapStyle`.
        customMapStyle={mapStyle(scheme)}
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
                <Bubble count={c.slugs.length} />
              </Marker>
            );
          }
          const p = at.get(c.slugs[0])!;
          return (
          <Marker
            key={p.slug}
            identifier={p.slug}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            // A picture, not a tint. `pinColor` never drew a pin: on iOS
            // Google's marker art imposes its own luminance and takes only
            // hue and some saturation from the prop, and on Android
            // `setPinColor` runs `Color.colorToHSV` and keeps `hsv[0]`
            // alone. Nine categories reached the map as nine hues, with no
            // glyph and no way to say more.
            //
            // `icon` rather than `image`: the two are one prop on Android,
            // but on iOS `image` installs a UIImageView as the marker's
            // `iconView` — a view-backed marker, which is what
            // `tracksViewChanges` and `SETTLE_MS` exist to avoid. `icon`
            // sets `GMSMarker.icon` and stays a picture.
            //
            // No `pinColor`, and not as an oversight. `setPinColor:`
            // assigns `_realMarker.icon = markerImageWithColor:`
            // unconditionally — it *overwrites the icon* — and
            // `didInsertInMap` applies it again after the marker is in the
            // map, synchronously, while `setIconSrc` loads its bitmap
            // asynchronously. A fallback that erases the thing it backs up.
            icon={pinImage(p, category, p.slug === selectedSlug)}
            // Already the default; written down so the tip of the teardrop
            // is the thing standing on the coordinate. An asset drawn to a
            // different shape would have to revisit it.
            anchor={{ x: 0.5, y: 1 }}
            // 251 pins overlap; a coral one buried behind three ink ones is
            // invisible. Put the chosen pin on top.
            zIndex={p.slug === selectedSlug ? 1 : 0}
            tracksViewChanges={false}
            onPress={() => onSelect(p.slug)}
          />
          );
        })}
        {cities.filter((c) => c.count != null).map((c) => (
          <Marker
            key={`city-${c.id}`}
            identifier={`city-${c.id}`}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            // Above the places: at the zoom where a city label shows at
            // all, everything else on screen is one bubble anyway.
            zIndex={3}
            tracksViewChanges={!settled}
            onPress={() => onPickCity(c.id)}
            accessibilityRole="button"
            accessibilityLabel={[
              c.name,
              spokenCount(c.count!, t),
              t('switch to this city', 'chuyển sang thành phố này', 'この都市に切り替える'),
            ].filter(Boolean).join(', ')}
            testID={`city-${c.id}`}
          >
            <Bubble count={c.count!} />
          </Marker>
        ))}
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
