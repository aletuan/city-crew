// Trilingual UI: English, Vietnamese, Japanese. Every string is passed
// inline as (en, vi, ja?) — Japanese falls back to English wherever a
// translation hasn't been written, so partial coverage never renders a
// blank. The choice persists across launches.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'vi' | 'ja';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'ja', label: '日本語' },
];

type Str = string | null | undefined;

type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Pick the right variant of a multilingual set; ja falls back to en. */
  t: (en: Str, vi: Str, ja?: Str) => string;
};

const STORE_KEY = 'citycrew.lang';

const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (en) => en ?? '' });

export const useI18n = () => useContext(Ctx);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((v) => {
      if (v === 'en' || v === 'vi' || v === 'ja') setLangState(v);
    }).catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORE_KEY, l).catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => ({
    lang,
    setLang,
    t: (en, vi, ja) => {
      if (lang === 'vi') return vi ?? en ?? '';
      if (lang === 'ja') return ja ?? en ?? vi ?? '';
      return en ?? vi ?? '';
    },
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
