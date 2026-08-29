// What a screen needs around it to render in a Node process.
//
// The app is React Native; this renders it through `react-native-web`, the
// same translation Expo's own web target uses, into jsdom. That is a real
// substitution and it is worth being plain about what it buys and what it
// does not: `View` becomes a `div`, `StyleSheet.create` becomes objects,
// `Pressable` becomes a element with handlers. Layout is not simulated,
// `Animated` values do not tick, and nothing here can tell you a screen
// looks right. What it can tell you is that a screen renders at all, that
// it renders the right words, and that a tap reaches the function it is
// supposed to reach — which is the class of fault that currently reaches
// the phone before anybody sees it.
//
// The stubs below are for native modules with no web implementation. Each
// is the smallest thing that lets a tree mount: a name, not a behaviour. A
// test that needs one to *do* something should mock it locally and say so.

import React from 'react';
import { vi } from 'vitest';

// Metro injects this; a Node process does not, and `expo-modules-core`
// reads it at import time. Without it any tree that reaches an Expo module
// dies on `__DEV__ is not defined` before the app's own code runs.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/** A host element that renders its children and forwards its props. */
const passthrough = (name: string) =>
  function Stub({ children, ...rest }: { children?: React.ReactNode }) {
    return React.createElement('div', { 'data-stub': name, ...rest }, children);
  };

vi.mock('expo-linear-gradient', () => ({ LinearGradient: passthrough('LinearGradient') }));
vi.mock('expo-blur', () => ({ BlurView: passthrough('BlurView') }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// `expo-image` takes a `source` where the web `img` takes `src`, and tests
// assert on alt text and on which photo was chosen, so this one keeps the
// mapping rather than throwing the props away.
vi.mock('expo-image', () => ({
  Image: ({ source, ...rest }: { source?: { uri?: string } | string }) =>
    React.createElement('img', {
      src: typeof source === 'string' ? source : source?.uri,
      ...rest,
    }),
}));

// Icons are drawn from a font that is not installed. The glyph name is kept
// because it is occasionally the only thing distinguishing two controls.
//
// Mocked at the *deep* path, because that is what the app imports. The
// barrel (`@expo/vector-icons`) eagerly requires all sixteen icon families
// and their .ttf files — 3.7 MB of fonts for the one family this app uses —
// so every call site names its family directly. A stub on the barrel would
// intercept nothing.
const icon = ({ name }: { name?: string }) =>
  React.createElement('span', { 'data-icon': name });
vi.mock('@expo/vector-icons/Ionicons', () => ({ default: icon }));

// These must return promises, not undefined. `fireHaptic` calls
// `.catch()` on what it gets back, so a stub that answered `undefined`
// threw a TypeError *before* the press handler beside it ran — every tap in
// the suite silently doing nothing, and the tests failing about the
// handler rather than about the stub.
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(async () => {}),
  selectionAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// No notch and no clock in jsdom, so every inset is zero — which is also
// the value that makes a layout assertion mean the same thing on every
// machine that runs the suite.
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: passthrough('SafeAreaProvider'),
  SafeAreaView: passthrough('SafeAreaView'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
      removeItem: vi.fn(async (k: string) => { store.delete(k); }),
    },
  };
});

// The channel stamp, which `lib/channel` reads at import time and both
// startup-trace flags then ask. Reaching the real module pulls in
// `expo-modules-core`, whose EventEmitter wants a native half that is not
// there — it took four UI test files down the day `lib/trace` started
// asking, and none of them are about channels at all.
//
// `channel: null` is the honest answer for a test run: no build stamped
// it, which `lib/channel` groups with the non-production installs. A test
// that cares which channel it is on should mock `./channel` directly, as
// trace.test.ts and tracereport.test.ts do.
vi.mock('expo-updates', () => ({ channel: null }));

vi.mock('expo-location', () => ({
  getForegroundPermissionsAsync: vi.fn(async () => ({ status: 'undetermined' })),
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: vi.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
  reverseGeocodeAsync: vi.fn(async () => []),
  Accuracy: { Balanced: 3 },
}));

// `Alert.alert` is how half the screens report a failure, and a test that
// asserts on it is asserting on what the reader was told. Kept as a spy
// rather than a no-op for that reason.
vi.mock('react-native/Libraries/Alert/Alert', () => ({ default: { alert: vi.fn() } }));

// React Navigation ships source this toolchain cannot parse, and a smoke
// test has no navigator anyway: every screen takes `navigation` as a prop,
// which is what a test hands it and asserts on. The two hooks below are the
// only parts a component reaches for without going through that prop.
vi.mock('@react-navigation/native', () => ({
  // Runs its effect once on mount. The real one re-runs it on every focus,
  // which a tree that is never blurred cannot distinguish from this.
  useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
  useNavigation: () => ({
    navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), push: vi.fn(),
    popToTop: vi.fn(), setOptions: vi.fn(), addListener: vi.fn(() => vi.fn()),
  }),
  useIsFocused: () => true,
  useRoute: () => ({ params: {} }),
  NavigationContainer: passthrough('NavigationContainer'),
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: vi.fn() }),
  DefaultTheme: { colors: {} },
  DarkTheme: { colors: {} },
}));
