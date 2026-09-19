// Which ground the app is standing on, and the memory of that choice.
//
// The colours themselves are in `src/theme.ts` — pairs that UIKit resolves
// at draw time. This decides *which half of every pair* is showing, by
// telling the window its interface style; from there the repaint is the
// platform's job, not React's.
//
// TWO WORDS, NOT ONE. `pref` is what the person chose and what is stored;
// `scheme` is the ground actually showing. They differ only under
// `'system'`, where the phone decides — and every consumer wants the
// second one, so `scheme` stays the name the context hands out and the
// eleven call sites of `useScheme().scheme` did not change when this
// setting arrived.
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

/** The ground: one of the two the design was drawn for. */
export type Scheme = 'dark' | 'light';
/** The setting: the two grounds, or a deferral to the phone. */
export type Pref = Scheme | 'system';

/** Follow the phone. Someone who never opens the setting gets the app in
 *  the same ground as everything else they are looking at — and the two
 *  readings are both the design, so neither is a downgrade. */
const DEFAULT: Pref = 'system';
/** The ground to stand on when the phone will not say (Android, the web
 *  build, a simulator that answers null). Dark is the app's original. */
const FALLBACK: Scheme = 'dark';
const STORE_KEY = 'citycrew.scheme';

type ThemeCtx = {
  /** The ground showing right now. */
  scheme: Scheme;
  /** What the person chose — what the Appearance sheet ticks. */
  pref: Pref;
  setPref: (p: Pref) => void;
  /** False until the stored choice has been read once — the app holds its
   *  first frame on this, so a dark-mode user never sees a white flash. */
  ready: boolean;
};

const Ctx = createContext<ThemeCtx>({
  scheme: FALLBACK, pref: DEFAULT, setPref: () => {}, ready: true,
});

export const useScheme = () => useContext(Ctx);

/** What the phone itself is set to, or the fallback if it will not say. */
function phoneScheme(): Scheme {
  return Appearance.getColorScheme() === 'light' ? 'light' : FALLBACK;
}

/**
 * Point the window at a ground, or hand it back to the phone.
 *
 * `'unspecified'` is React Native's word for "stop overriding": the window
 * returns to the system's interface style and every `DynamicColorIOS` pair
 * resolves against it from the next frame. `app.json` already ships
 * `userInterfaceStyle: "automatic"`, so nothing native has to change for
 * this to work — which is why this setting can go out over the air.
 */
function apply(pref: Pref) {
  if (Platform.OS !== 'ios') return;
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

/** The stored string, narrowed. Anything unrecognised — including the
 *  absence of a value on a fresh install — means the default. */
function readPref(v: string | null): Pref {
  return v === 'light' || v === 'dark' || v === 'system' ? v : DEFAULT;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<Pref>(DEFAULT);
  const [phone, setPhone] = useState<Scheme>(phoneScheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORE_KEY)
      .then((v) => {
        if (!live) return;
        const stored = readPref(v);
        setPrefState(stored);
        apply(stored);
      })
      .catch(() => apply(DEFAULT))
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);

  // The phone's own switch. This listener fires for a change made in
  // Settings or by the sunset schedule, not for `setColorScheme` calls the
  // app makes itself — so it is exactly the signal `'system'` needs, and
  // silent the rest of the time. It stays subscribed under every pref:
  // keeping `phone` current means switching back to Auto repaints from the
  // first frame rather than after the next system change.
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => setPhone(phoneScheme()));
    return () => sub.remove();
  }, []);

  const setPref = useCallback((next: Pref) => {
    setPrefState(next);
    apply(next);
    // Read the phone back rather than trusting the last event: iOS may
    // have changed ground while the app sat on an explicit override, and
    // no listener fired for it because the window was not following.
    if (next === 'system') setPhone(phoneScheme());
    AsyncStorage.setItem(STORE_KEY, next).catch(() => {});
  }, []);

  const scheme: Scheme = pref === 'system' ? phone : pref;

  const value = useMemo<ThemeCtx>(
    () => ({ scheme, pref, setPref, ready }),
    [scheme, pref, setPref, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
