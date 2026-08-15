// A small map you drop a pin on, and nothing else.
//
// ── why this may show no places, ever ──
//
// Everything in `places` came out of the Google Places API — `importPlace`
// writes the name, the address, the coordinates, the rating, the hours and
// the photographs from it. Storing that in Postgres does not stop it being
// Google Maps Content, and the Places API terms are explicit: §5.3, "No
// use with a non-Google map" — *Customer must not use Google Maps Content
// from the Places API in conjunction with a non-Google map.*
//
// On iOS in Expo Go the only map that renders is Apple's. So this map is
// allowed to exist exactly as long as it carries none of the catalog:
// where the reader is, and where they have pointed. The moment somebody
// adds "show nearby places here", it is a licence breach rather than a
// feature — which is why this component takes no places and offers no way
// to pass any.
//
// The reverse geocode is the platform's (Apple on iOS, Android's on
// Android) through `expo-location`, not Google's, for the same reason.
//
// ── why it is loaded so carefully ──
//
// `react-native-maps` is native code living in the Expo Go binary rather
// than in our bundle. Expo's own docs say Apple Maps needs no setup in
// Expo Go, and SDK 54 pins the version this project installs — but there
// are open reports of it crashing on this exact SDK, and a screen is not
// the right thing to bet on that. So the module is required behind a
// guard and rendered behind a boundary: if it is missing, or if it throws
// on mount, the picker loses its map and keeps everything else.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../theme';

/** Resolved once, at module load, so a missing native module is a null
 *  rather than a red screen. */
const MapView: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('react-native-maps').default ?? null;
  } catch {
    return null;
  }
})();
const Marker: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('react-native-maps').Marker ?? null;
  } catch {
    return null;
  }
})();

type Props = {
  lat: number;
  lng: number;
  /** Called with wherever the reader taps. */
  onPick: (at: { lat: number; lng: number }) => void;
  /** Shown over the map's bottom edge — where the pin currently is, in
   *  words. Supplied by the caller, which is what does the geocoding. */
  caption?: string;
};

/**
 * Catches a native module that mounts and then throws.
 *
 * A class, because this is the one thing hooks cannot do. There is no
 * retry: if the map failed once on this device it will fail again, and
 * offering a button that re-crashes the screen is not a kindness.
 */
class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export default function MiniMap({ lat, lng, onPick, caption }: Props) {
  if (!MapView) return null;
  return (
    <Boundary>
      <View style={s.wrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          // No provider named, which on iOS means Apple's and on Android
          // the platform default. Naming Google here would need a key this
          // app does not ship — and would not fix the licence question,
          // because Expo Go cannot apply our key anyway.
          initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          onPress={(e: any) => {
            const c = e?.nativeEvent?.coordinate;
            if (c) onPick({ lat: c.latitude, lng: c.longitude });
          }}
        >
          {Marker ? <Marker coordinate={{ latitude: lat, longitude: lng }} /> : null}
        </MapView>
        {caption ? (
          <View style={s.caption} pointerEvents="none">
            <View style={s.dot} />
            <Text style={s.captionText} numberOfLines={1}>{caption}</Text>
          </View>
        ) : null}
      </View>
    </Boundary>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: 168, borderRadius: radius.card, overflow: 'hidden',
    backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  // Opaque, not glass: map tiles are busy in a way no scrim can settle,
  // and a caption you have to work to read is worse than no caption.
  caption: {
    position: 'absolute', left: 10, bottom: 10, maxWidth: '86%',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  captionText: { color: colors.text, fontSize: 13, fontWeight: font.medium, flexShrink: 1 },
});
