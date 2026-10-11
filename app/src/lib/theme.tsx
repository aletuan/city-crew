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
//
// THE LOOK (10 Oct 2026). Coffee, Rose and the four looks after them
// (Blush, Slate, Midnight, Navy) are not a ground but a set of
// colours, and a colour pair cannot hold a third set — `lib/look.ts` has
// the whole argument. Choosing one keeps the look in `Settings` for the
// next launch and restarts the JavaScript into it; each pins its ground
// (`PINNED` in lib/look), so everything scheme-picked agrees with the
// colours. Light, Dark and Automatic share the standard look and stay the
// instant switch they were.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, DevSettings, Platform, Settings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import {
  canHoldLook, lookOf, needsRestart, parsePref, pinnedScheme, readLook, storeOf, takeReturn, writeLook, writeReturn,
  type Look, type Pref, type Return, type Scheme,
} from './look';

export type { Look, Pref, Return, Scheme } from './look';

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
  /** Choose. A look restarts the app; `returnTo` is where the restart
   *  should put the reader back, if somewhere (`Return` in lib/look). */
  setPref: (p: Pref, returnTo?: Omit<Return, 'at'>) => void;
  /** The look the colours were built in, this run — what `theme.ts` read. */
  look: Look;
  /** Whether a look other than the standard one can be kept here at all.
   *  Off iOS it cannot, and none of the looks is offered. */
  looks: boolean;
  /** False until the stored choice has been read once — the app holds its
   *  first frame on this, so a dark-mode user never sees a white flash. */
  ready: boolean;
  /** Where the restart this launch came from left the reader, or null on
   *  any other launch. Read once, before the navigator mounts. */
  resume: Return | null;
  /** The same, handed over once: the screen that reopens the sheet takes
   *  it, so a remount of that screen later in the run does not open the
   *  sheet again. */
  claimResume: () => Return | null;
};

const Ctx = createContext<ThemeCtx>({
  scheme: FALLBACK, pref: DEFAULT, setPref: () => {}, look: 'standard', looks: false, ready: true,
  resume: null, claimResume: () => null,
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
  Appearance.setColorScheme(pinnedScheme(pref) ?? 'unspecified');
}

/** `Settings` as the look needs it; undefined off iOS. */
const store = () => storeOf(() => Settings);

/**
 * Start the JavaScript again, into the look just kept. `reloadAsync` is the
 * release build's way; a development client refuses it, and there the
 * packager's reload is the same thing. In a release build `DevSettings.reload`
 * is a no-op (React Native defines it only under `__DEV__`), so a refusal
 * there ends in nothing — which is why the sheet that asked watches for the
 * relaunch that never came (`STUCK_MS` in ThemeSwitcher).
 */
async function restart() {
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<Pref>(DEFAULT);
  const [phone, setPhone] = useState<Scheme>(phoneScheme);
  const [ready, setReady] = useState(false);
  // Read once, as `theme.ts` read it at import — this module may not
  // import that one (docs/architecture.md), so it asks the same store.
  const [look] = useState<Look>(() => readLook(store()));
  // And where the last restart left the reader, read once too — taken off
  // the store here, before the navigator mounts, since the navigator is
  // what needs it first (`landingState`).
  const [resume] = useState<Return | null>(() => takeReturn(store(), Date.now()));
  const claimed = useRef(false);
  const claimResume = useCallback(() => {
    if (claimed.current) return null;
    claimed.current = true;
    return resume;
  }, [resume]);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORE_KEY)
      .then((v) => {
        if (!live) return;
        const stored = parsePref(v);
        // A setting whose look is not the one loaded — the look was lost,
        // or kept by a build that did not know this one. The look is put
        // right for the next launch and not restarted into now: a restart
        // the reader did not ask for, at launch, is one bad read away from
        // a loop that never draws a frame.
        if (lookOf(stored) !== look) writeLook(store(), lookOf(stored));
        setPrefState(stored);
        apply(stored);
      })
      .catch(() => apply(DEFAULT))
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [look]);

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

  const setPref = useCallback((next: Pref, returnTo?: Omit<Return, 'at'>) => {
    // Another look: kept, then restarted into. Nothing repaints first —
    // the window pinned to the new ground over the old colours would be a
    // frame of neither. Where the look cannot be kept, a restart would come
    // back as it left, so nothing happens at all. Where the reader was goes
    // in beside the look, for the launch after the restart to read back.
    if (needsRestart(look, next)) {
      if (Platform.OS !== 'ios' || !writeLook(store(), lookOf(next))) return;
      if (returnTo) writeReturn(store(), { ...returnTo, at: Date.now() });
      AsyncStorage.setItem(STORE_KEY, next).catch(() => {}).finally(restart);
      return;
    }
    setPrefState(next);
    apply(next);
    // Read the phone back rather than trusting the last event: iOS may
    // have changed ground while the app sat on an explicit override, and
    // no listener fired for it because the window was not following.
    if (next === 'system') setPhone(phoneScheme());
    AsyncStorage.setItem(STORE_KEY, next).catch(() => {});
  }, [look]);

  const scheme: Scheme = pinnedScheme(pref) ?? phone;
  // iOS only: Android's `Settings` is a stub that warns and keeps nothing.
  const looks = Platform.OS === 'ios' && canHoldLook(store());

  const value = useMemo<ThemeCtx>(
    () => ({ scheme, pref, setPref, look, looks, ready, resume, claimResume }),
    [scheme, pref, setPref, look, looks, ready, resume, claimResume],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
