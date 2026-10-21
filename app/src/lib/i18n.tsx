// The UI in English, Vietnamese, Japanese and Simplified Chinese. Every
// string is passed inline as (en, vi, ja?, zh?) — Japanese and Chinese
// fall back to English wherever a translation hasn't been written, so
// partial coverage never renders a blank. The choice persists across
// launches; until one is made, the app speaks the phone's language when
// it has it (see `langFromLocales`).
//
// Chinese is the fourth argument, and optional, because it arrived after
// eight hundred strings had been written with three (21 Oct 2026): it is
// filled in screen by screen, and until a string has one it reads in
// English. See `spokenIn` for the order.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager, Platform, Settings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { type Lang, langFromLocales, spokenIn } from './lang';

export { spokenIn, type Lang };

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '简体中文' },
];

type Str = string | null | undefined;

type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Pick the right variant of a multilingual set; ja and zh fall back to en. */
  t: (en: Str, vi: Str, ja?: Str, zh?: Str) => string;
};

const STORE_KEY = 'citycrew.lang';

const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (en) => en ?? '' });

export const useI18n = () => useContext(Ctx);

/**
 * The languages the phone is set to, most preferred first.
 *
 * Read from what React Native already carries, not `expo-localization`:
 * that is a native module, and the runtime version follows the SDK, so an
 * update that imported it would reach binaries built without it and fail
 * at launch. iOS keeps the reader's whole list in the `AppleLanguages`
 * default; Android's I18nManager names the first locale only, which is
 * the one that matters. A runtime with neither — the web build the tests
 * render through — reports nothing and gets English. `Intl` was the
 * obvious fallback and was left out: under Node it follows the shell's
 * `LANG`, so the whole suite would have run in Vietnamese on a machine
 * set to Vietnamese, and neither platform the app ships on needs it.
 */
export function deviceLocales(): string[] {
  if (Platform.OS === 'ios') {
    const list: unknown = Settings.get('AppleLanguages');
    if (Array.isArray(list)) return list.filter((x): x is string => typeof x === 'string');
  }
  const id = I18nManager.getConstants().localeIdentifier;
  return id ? [id] : [];
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The phone's language from the first frame, so a Vietnamese reader is
  // not shown a frame of English while storage is read; and never stored,
  // so a reader who changes the phone's language is followed until they
  // choose one here.
  const [lang, setLangState] = useState<Lang>(() => langFromLocales(deviceLocales()));

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((v) => {
      if (v === 'en' || v === 'vi' || v === 'ja' || v === 'zh') setLangState(v);
    }).catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORE_KEY, l).catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => ({
    lang,
    setLang,
    t: (en, vi, ja, zh) => {
      const spoken = spokenIn(lang, en, vi, ja, zh);
      return (spoken === 'vi' ? vi : spoken === 'ja' ? ja : spoken === 'zh' ? zh : spoken === 'en' ? en : null) ?? '';
    },
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
