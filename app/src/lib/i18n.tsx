// The UI in English, Vietnamese, Japanese and Simplified Chinese. Every
// string is passed inline as (en, vi, ja?, zh?) — Japanese and Chinese
// fall back to English wherever a translation hasn't been written, so
// partial coverage never renders a blank. The choice persists across
// launches.
//
// Chinese is the fourth argument, and optional, because it arrived after
// eight hundred strings had been written with three (21 Oct 2026): it is
// filled in screen by screen, and until a string has one it reads in
// English. See `spokenIn` for the order.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { type Lang, spokenIn } from './lang';

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

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

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
