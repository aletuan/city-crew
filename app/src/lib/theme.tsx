// Which ground the app is standing on, and the memory of that choice.
//
// The colours themselves are in `src/theme.ts` — pairs that UIKit resolves
// at draw time. This decides *which half of every pair* is showing, by
// telling the window its interface style; from there the repaint is the
// platform's job, not React's.
//
// The scheme also lives in React state, and that is deliberate. A handful
// of things are not colours and cannot be a dynamic pair: the blur
// material's tint, the status bar's content, the ambient glow, and one tab
// bar prop that is typed `string`. Those read the scheme from here rather
// than from `Appearance`, which does not promise to notify listeners of a
// change the app itself made.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Scheme = 'dark' | 'light';

/** Dark is the app's original and its default: someone who never opens
 *  the setting sees the design the rest of it was drawn for. */
const DEFAULT: Scheme = 'dark';
const STORE_KEY = 'citycrew.scheme';

type ThemeCtx = {
  scheme: Scheme;
  setScheme: (s: Scheme) => void;
  /** False until the stored choice has been read once — the app holds its
   *  first frame on this, so a dark-mode user never sees a white flash. */
  ready: boolean;
};

const Ctx = createContext<ThemeCtx>({ scheme: DEFAULT, setScheme: () => {}, ready: true });

export const useScheme = () => useContext(Ctx);

/** The window follows the app, not the phone: this app ships its own
 *  setting, so the system's dark-mode switch is not consulted. */
function apply(scheme: Scheme) {
  if (Platform.OS === 'ios') Appearance.setColorScheme(scheme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<Scheme>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORE_KEY)
      .then((v) => {
        if (!live) return;
        const stored: Scheme = v === 'light' ? 'light' : DEFAULT;
        setSchemeState(stored);
        apply(stored);
      })
      .catch(() => apply(DEFAULT))
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);

  const setScheme = useCallback((next: Scheme) => {
    setSchemeState(next);
    apply(next);
    AsyncStorage.setItem(STORE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeCtx>(() => ({ scheme, setScheme, ready }), [scheme, setScheme, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
