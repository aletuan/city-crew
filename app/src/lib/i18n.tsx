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

/**
 * Which of the three variants `t` will hand a reader of `lang`, or null
 * when every slot is empty. The fallback order, written once: Vietnamese
 * falls to English; Japanese falls to English, then Vietnamese; English
 * falls to Vietnamese. `t` is this plus a lookup, so the two cannot drift.
 *
 * Exported because a screen sometimes needs to know *that* it fell back,
 * not only what to print: a Japanese reader shown an English blurb is
 * told so (`PlaceDetailScreen`), and a silent fallback reads as a bug.
 * Null, not undefined, is "nothing" here — an empty string is a written
 * (if empty) value, exactly as `t`'s `??` has always treated it.
 */
export function spokenIn(lang: Lang, en: Str, vi: Str, ja?: Str): Lang | null {
  const order: [Lang, Str][] = lang === 'vi'
    ? [['vi', vi], ['en', en]]
    : lang === 'ja'
      ? [['ja', ja], ['en', en], ['vi', vi]]
      : [['en', en], ['vi', vi]];
  const hit = order.find(([, s]) => s != null);
  return hit ? hit[0] : null;
}

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
      const spoken = spokenIn(lang, en, vi, ja);
      return (spoken === 'vi' ? vi : spoken === 'ja' ? ja : spoken === 'en' ? en : null) ?? '';
    },
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
