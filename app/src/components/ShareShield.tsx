// A pane over the whole app that takes every touch while the system share
// sheet is up. See `lib/share` for the tap it exists to catch.
//
// Transparent, and nothing is drawn: the reader sees the app exactly as
// it was. Mounted once, last in the root, so paint order puts it above
// every screen and the tab bar. It claims no touch itself; being the
// view that is hit is enough, because a touch is only offered to the view
// it lands on and that view's ancestors, and nothing under the pane is
// either.

import React, { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { isShielded, subscribeShield } from '../lib/share';

export default function ShareShield() {
  const up = useSyncExternalStore(subscribeShield, isShielded);
  if (!up) return null;
  return <View style={StyleSheet.absoluteFill} testID="share-shield" accessible={false} />;
}
