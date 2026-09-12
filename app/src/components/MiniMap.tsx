// A small map you drop a pin on, and nothing else.
//
// ── whose map ──
//
// Google's, on both platforms. It used to be Apple's on iOS, and that
// was a constraint rather than a choice: in Expo Go the only map that
// renders on iOS is Apple's, and the Places API terms (§5.3, "No use with
// a non-Google map") forbid showing Google Places content — which every
// place in `places` is, and every search result now is — on any map that
// is not Google's. So the start sheet searched OpenStreetMap instead, and
// this map carried no places at all.
//
// The app ships as its own binary now (EAS Build → TestFlight), which can
// bundle the Google Maps SDK and carry a key for it — see `app.config.js`
// for where the key comes from. With the map Google's, the clause is
// satisfied: the start sheet searches Google Places, the caption under
// the map comes from Google's geocoder, and both may sit on this view.
//
// It still takes no places. That is scope, not licence: the sheet's one
// question is "where does the day start?", and pins for forty cafés
// answer a different one. The day somebody wants them here, the licence
// no longer stands in the way.
//
// ── why it is loaded so carefully ──
//
// `react-native-maps` is native code living in the binary rather than in
// our bundle, and on iOS the Google provider needs the Maps SDK linked
// and keyed. Two builds lack it: Expo Go, which bundles Apple Maps only,
// and a build made without `GOOGLE_MAPS_IOS_KEY` set. Asking for Google
// in either throws from the native side. So the module is required
// behind a guard, the provider is refused where it cannot work, and the
// view is rendered behind a boundary: if anything is missing, or throws
// on mount, the picker loses its map and keeps everything else.
//
// Expo Go on Android does carry Google Maps (with Expo's own key), so
// the map keeps working there; a development build is only needed to
// see it on an iPhone.

import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from './ui';
import { colors, font, radius } from '../theme';

/** Resolved once, at module load, so a missing native module is a null
 *  rather than a red screen. */
const MapView: any = (() => {
  try {
    // Metro resolves a native module that may not be in the binary at all;
    // there is no import form that can fail softly like this.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-maps').default ?? null;
  } catch {
    return null;
  }
})();
const Marker: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-maps').Marker ?? null;
  } catch {
    return null;
  }
})();
const PROVIDER_GOOGLE: string | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-maps').PROVIDER_GOOGLE ?? null;
  } catch {
    return null;
  }
})();

/**
 * Whether this binary can draw a Google map.
 *
 * Android: always, on any build — Expo Go included. iOS: only a build of
 * our own that was given `GOOGLE_MAPS_IOS_KEY`. Expo Go is ruled out by
 * its execution environment; a keyless build is ruled out by the
 * `extra.hasGoogleMapsIosKey` flag app.config.js sets — not
 * `ios.config.googleMapsApiKey`, which Expo strips from the public
 * manifest this reads from, always, in every build. Neither case is an error — the
 * sheet simply has no map — and `MiniMap` says nothing about why, because
 * the person who can do something about it is reading this file, not the
 * screen.
 */
export const canDrawMap: boolean = (() => {
  if (!MapView || !PROVIDER_GOOGLE) return false;
  if (Platform.OS !== 'ios') return true;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return !!Constants.expoConfig?.extra?.hasGoogleMapsIosKey;
})();

type Props = {
  lat: number;
  lng: number;
  /** Called with wherever the reader taps. */
  onPick: (at: { lat: number; lng: number }) => void;
  /** Shown over the map's bottom edge — where the pin currently is, in
   *  words. Supplied by the caller, which is what does the geocoding. */
  caption?: string;
  /** Taller than the default when the map is the point of the screen
   *  rather than the third answer on it. */
  height?: number;
  /** Adds the locate button. Absent, there is none — a control that does
   *  nothing is worse than no control. */
  onLocate?: () => void;
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

export default function MiniMap({ lat, lng, onPick, caption, height, onLocate }: Props) {
  const map = useRef<any>(null);

  // `initialRegion` is what its name says: read once, on mount. The sheet
  // moves this map after a search and after the locate button, and neither
  // did anything until this existed — the pin moved and the map sat where
  // it was. Animated rather than jumped, because a map that teleports
  // leaves the reader working out whether it is the same city.
  useEffect(() => {
    map.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      450,
    );
  }, [lat, lng]);

  if (!canDrawMap) return null;
  return (
    <Boundary>
      <View style={[s.wrap, height ? { height } : null]}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          // Google on both platforms, for the licence reason at the top:
          // what sits on this map is Google Places content, and that may
          // only be shown on Google's map.
          provider={PROVIDER_GOOGLE}
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
        {onLocate ? (
          <PressableScale onPress={onLocate} scaleTo={0.9} style={s.locate} accessibilityRole="button">
            <Ionicons name="navigate" size={17} color={colors.accent} />
          </PressableScale>
        ) : null}
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
  // Opaque for the same reason the caption is: a control over map tiles
  // needs its own ground or it is a shape in a photograph.
  locate: {
    position: 'absolute', top: 10, right: 10,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated,
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
  // The one legitimate `colors.accent` fill in the app: a bare mark with
  // nothing drawn on it. The rule it does not break is about contrast for
  // ink, and there is no ink here.
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  captionText: { color: colors.text, fontSize: 13, fontWeight: font.medium, flexShrink: 1 },
});
